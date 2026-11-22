import { CAR_EXPLOSION } from '../config/props';
import { clamp, damp, dist2, lerp } from '../core/util';
import { recycleBullet } from './squad';
import { MEMBER_R, VIEW_W, World, type Bullet, type Zombie } from './world';

const buf: number[] = [];

// ─────────────────────────── zombies ───────────────────────────

export function updateZombies(w: World, dt: number) {
  const sq = w.squad;
  const camTop = w.camTop;
  const t = w.time;
  for (const z of w.zombies) {
    if (z.dead) continue;
    const def = z.def;
    z.flash -= dt;
    z.buff -= dt;
    if (z.burn > 0) {
      z.burn -= dt;
      z.hp -= z.burnDps * dt;
      if (w.fxRng.next() < dt * 7) w.emit('ember', z.x, z.y);
      if (z.hp <= 0) { w.killZombie(z, true); continue; }
    }
    // nearest squad member (weighted toward horizontal distance)
    let tx = z.x, ty = w.squadY, best = 1e9;
    for (const m of sq) {
      const d = Math.abs(m.x - z.x) + Math.abs(m.y - z.y) * 0.35;
      if (d < best) { best = d; tx = m.x; ty = m.y; }
    }
    let spd = def.speed * (z.buff > 0 ? 1.65 : 1);
    if (z.stagger > 0) { z.stagger -= dt; spd *= 0.15; }

    // ranged specials hold position near the top of the screen
    if ((def.spitter || def.screamer) && z.state < 2 && w.state === 'playing') {
      const holdLine = camTop + z.holdY;
      if (z.y >= holdLine) {
        z.state = 1;
        z.y = holdLine;
        spd = 0;
      }
      if (z.state === 1) {
        z.timer -= dt;
        if (z.timer <= 0) {
          if (def.spitter) spit(w, z);
          else scream(w, z);
          z.count++;
          z.timer = def.spitter ? 2.1 : 4.5;
          if (z.count >= (def.spitter ? 4 : 3)) z.state = 2;
        }
      }
    }

    const dy = ty - z.y;
    if (dy > -30 && dy < 700) {
      const desired = clamp((tx - z.x) * 1.6, -def.maxSide, def.maxSide);
      const acc = def.home * dt * (z.buff > 0 ? 1.5 : 1);
      z.vx += clamp(desired - z.vx, -acc, acc);
    }
    const wob = def.id === 'walker' ? Math.sin(t * 1.6 + z.id) * 9 : 0;
    z.x += (z.vx + wob + z.kx) * dt;
    z.y += (spd + z.ky) * dt;
    const k = damp(5, dt);
    z.kx -= z.kx * k;
    z.ky -= z.ky * k;
    z.anim += dt * (spd * 0.07 + 1.5);

    if (z.y > w.squadY + 220 || z.x < -120 || z.x > VIEW_W + 120 || z.y < camTop - 900) z.dead = true;
  }

  // solid props push zombies sideways
  for (const p of w.props) {
    if (p.dead || !p.def.solid || p.y < camTop - 100 || p.y > w.camBottom + 100) continue;
    const hw = p.w / 2, hh = p.h / 2;
    for (const z of w.zombies) {
      if (z.dead) continue;
      const dx = z.x - p.x;
      if (Math.abs(dx) > hw + z.r || Math.abs(z.y - p.y) > hh + z.r) continue;
      z.x = dx < 0 ? p.x - hw - z.r : p.x + hw + z.r;
    }
  }
}

function spit(w: World, z: Zombie) {
  const sq = w.squad;
  if (!sq.length) return;
  const m = sq[Math.floor(w.rng.next() * sq.length)];
  const dur = 1.15;
  w.shots.push({ kind: 'acid', sx: z.x, sy: z.y, tx: m.x + (w.rng.next() - 0.5) * 30, ty: m.y - w.scroll * dur, t: 0, dur, dead: false });
  w.emit('spit', z.x, z.y);
  w.sound('spit');
}

function scream(w: World, z: Zombie) {
  w.emit('scream', z.x, z.y, 230);
  w.sound('scream');
  for (const o of w.zombies) if (!o.dead && dist2(o.x, o.y, z.x, z.y) < 230 * 230) o.buff = 3.2;
  if (w.zombies.length < 320) for (let i = 0; i < 3; i++) w.spawnZombie('runner', z.x + (i - 1) * 30, z.y - 20);
}

export function buildGrid(w: World) {
  w.grid.reset(w.camTop - 500);
  const zs = w.zombies;
  for (let i = 0; i < zs.length; i++) if (!zs[i].dead) w.grid.insert(i, zs[i].x, zs[i].y);
}

export function separateZombies(w: World) {
  const zs = w.zombies;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.dead) continue;
    const n = w.grid.queryInto(z.x, z.y, z.r + 24, buf);
    for (let q = 0; q < n; q++) {
      const j = buf[q];
      if (j <= i) continue;
      const o = zs[j];
      if (o.dead) continue;
      const dx = o.x - z.x, dy = o.y - z.y;
      const rr = z.r + o.r - 2;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / d;
      const wz = o.r / (z.r + o.r), wo = 1 - wz;
      z.x -= dx * push * wz * 0.8; z.y -= dy * push * wz * 0.5;
      o.x += dx * push * wo * 0.8; o.y += dy * push * wo * 0.5;
    }
  }
}

export function zombieContacts(w: World) {
  if (w.state !== 'playing') return;
  const zs = w.zombies;
  for (let mi = w.squad.length - 1; mi >= 0; mi--) {
    const m = w.squad[mi];
    if (!m) continue;
    const n = w.grid.queryInto(m.x, m.y, MEMBER_R + 26, buf);
    for (let q = 0; q < n; q++) {
      const z = zs[buf[q]];
      if (z.dead) continue;
      const rr = z.r + MEMBER_R;
      if (dist2(z.x, z.y, m.x, m.y) > rr * rr) continue;
      if (z.def.bruiser) {
        if (z.stagger > 0) continue;
        w.hurtMember(m, z.def.dmg, true);
        z.ky = -340; z.stagger = 0.7;
        w.emit('bash', m.x, m.y);
      } else {
        w.hurtMember(m, z.def.dmg, true);
        w.emit('bite', m.x, m.y);
        w.killZombie(z, false);
      }
      if (!w.squad.includes(m)) break;
    }
  }
}

// ─────────────────────────── bullets ───────────────────────────

function bulletStep(w: World, b: Bullet): boolean {
  // zombies
  const zs = w.zombies;
  const n = w.grid.queryInto(b.x, b.y, b.r + 26, buf);
  for (let q = 0; q < n; q++) {
    const z = zs[buf[q]];
    if (z.dead || b.hits.includes(z.id)) continue;
    const rr = z.r + b.r;
    if (dist2(z.x, z.y, b.x, b.y) > rr * rr) continue;
    if (b.kind === 'rocket') { w.explode(b.x, b.y, b.aoe, b.dmg); return true; }
    b.hits.push(z.id);
    const kx = b.vx * 0.04;
    w.damageZombie(z, b.dmg, b.ap, b.burn, b.knock, kx);
    if (b.kind !== 'flame' || w.fxRng.next() < 0.15) w.emit('hit', b.x, b.y, z.ti, 0, z.def.looks[0].skin);
    if (--b.pierce < 0) return true;
  }
  // props
  for (const p of w.props) {
    if (p.dead || !p.def.blocksBullets || p.fall > 0) continue;
    if (Math.abs(b.x - p.x) > p.w / 2 + b.r || Math.abs(b.y - p.y) > p.h / 2 + b.r) continue;
    if (b.kind === 'rocket') { w.explode(b.x, b.y, b.aoe, b.dmg); return true; }
    if (b.hits.includes(p.id)) continue;
    b.hits.push(p.id);
    if (p.def.hp > 0) {
      w.damageProp(p, b.dmg * (p.kind === 'car' ? 0.6 : 1));
      if (b.kind !== 'flame') w.emit('chip', b.x, b.y, 0, 0, propChipColor(p.kind));
    } else if (b.kind !== 'flame') w.emit('spark', b.x, b.y);
    if (b.kind === 'flame' && !p.def.solid) continue;
    return true;
  }
  // boss
  const boss = w.boss;
  if (boss && !boss.dead && boss.entered && !b.hits.includes(-1)) {
    const rr = boss.r + b.r;
    if (dist2(boss.x, boss.y, b.x, b.y) < rr * rr) {
      if (b.kind === 'rocket') { w.explode(b.x, b.y, b.aoe, b.dmg); return true; }
      b.hits.push(-1);
      w.damageBoss(b.dmg * (b.burn > 0 ? 1.1 : 1));
      if (b.kind !== 'flame' || w.fxRng.next() < 0.15) w.emit('hit', b.x, b.y, -1, 0, '#c0392b');
      if (b.kind !== 'flame' || --b.pierce < 0) return true;
    }
  }
  return false;
}

function propChipColor(kind: string) {
  switch (kind) {
    case 'crate': case 'airdrop': case 'fence': return '#b98a4e';
    case 'cage': return '#c0c4c8';
    case 'mystery': return '#9b7bff';
    case 'bus': return '#f2b134';
    case 'barrel': return '#e63946';
    default: return '#aab';
  }
}

export function updateBullets(w: World, dt: number) {
  const top = w.camTop - 80, bot = w.camBottom + 60;
  for (const b of w.bullets) {
    if (b.dead) continue;
    if (b.kind === 'grenade') {
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      b.x = lerp(b.sx, b.tx, k);
      b.y = lerp(b.sy, b.ty, k);
      if (k >= 1) {
        w.explode(b.x, b.y, b.aoe, b.dmg, { kind: 'frag' });
        b.dead = true;
      }
      continue;
    }
    const sp = Math.abs(b.vx) + Math.abs(b.vy);
    const steps = Math.max(1, Math.ceil((sp * dt) / 14));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      if (bulletStep(w, b)) { b.dead = true; break; }
    }
    if (b.dead) continue;
    if (b.kind === 'flame') { b.r += dt * 26; b.vx *= 1 - damp(2, dt); b.vy = lerp(b.vy, -w.scroll, damp(2, dt)); }
    b.life -= dt;
    if (b.life <= 0) {
      if (b.kind === 'rocket') w.explode(b.x, b.y, b.aoe, b.dmg);
      b.dead = true;
    } else if (b.y < top || b.y > bot || b.x < -40 || b.x > VIEW_W + 40) b.dead = true;
  }
}

// ─────────────────────────── props ───────────────────────────

export function updateProps(w: World, dt: number) {
  const zs = w.zombies;
  const bot = w.camBottom + 160;
  for (const p of w.props) {
    if (p.dead) continue;
    p.t += dt;
    p.flash -= dt;
    if (p.y - p.h / 2 > bot) { p.dead = true; continue; }
    if (p.life > 0) {
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
    }
    if (p.fall > 0) {
      p.fall -= dt;
      if (p.fall <= 0) { w.emit('land', p.x, p.y); w.emit('shake', 0, 0, 6); w.sound('thud'); }
      continue;
    }
    if (p.fuse > 0) {
      p.fuse -= dt;
      if (p.fuse <= 0) { w.breakProp(p); continue; }
    }
    if (p.y < w.camTop - 60) continue;
    // zombies interacting with traps
    if (p.kind === 'mine' && p.fuse <= 0) {
      const n = w.grid.queryInto(p.x, p.y, 30, buf);
      for (let q = 0; q < n; q++) {
        const z = zs[buf[q]];
        if (!z.dead && dist2(z.x, z.y, p.x, p.y) < (z.r + 10) ** 2) { p.fuse = 0.12; w.sound('beep'); break; }
      }
    } else if (p.kind === 'spikes' || p.kind === 'fire') {
      const n = w.grid.queryInto(p.x, p.y, Math.max(p.w, p.h) / 2 + 14, buf);
      for (let q = 0; q < n; q++) {
        const z = zs[buf[q]];
        if (z.dead || Math.abs(z.x - p.x) > p.w / 2 || Math.abs(z.y - p.y) > p.h / 2) continue;
        if (p.kind === 'fire') { z.burn = 2; z.burnDps = Math.max(z.burnDps, 14); }
        else w.damageZombie(z, 40 * dt, true);
      }
    }
  }
}

// ─────────────────────── enemy projectiles ───────────────────────

export function updateShots(w: World, dt: number) {
  for (const s of w.shots) {
    if (s.dead) continue;
    s.t += dt;
    if (s.t < s.dur) continue;
    s.dead = true;
    switch (s.kind) {
      case 'acid':
        w.addProp('acid', s.tx, s.ty, '', { life: 2.4 });
        w.emit('splash', s.tx, s.ty);
        w.sound('splat');
        break;
      case 'egg':
        w.emit('splash', s.tx, s.ty, 1);
        w.sound('splat');
        for (let i = 0; i < 4; i++) w.spawnZombie('crawler', s.tx + (i - 1.5) * 16, s.ty - 10);
        break;
      case 'car':
        if (s.strike) {
          w.explode(s.tx, s.ty, 85, 140);
        } else {
          w.explode(s.tx, s.ty, CAR_EXPLOSION.r * 0.65, 34, { squad: true, noProps: true });
          w.addProp('car', s.tx, s.ty, '', { life: 9, hp: 160, variant: 3 });
        }
        break;
    }
  }
  for (const v of w.waves) {
    if (v.dead) continue;
    if (v.kind === 'shock') {
      v.y += v.speed * dt;
      if (v.y > w.camBottom + 40) { v.dead = true; continue; }
      for (const m of [...w.squad]) {
        if (v.hit.includes(m.id) || Math.abs(m.y - v.y) > 16) continue;
        if (Math.abs(m.x - v.gap) < v.gapW / 2) continue;
        v.hit.push(m.id);
        w.hurtMember(m, v.dmg, true);
      }
    } else {
      v.r += v.speed * dt;
      if (v.r > 1100) { v.dead = true; continue; }
      for (const m of [...w.squad]) {
        if (v.hit.includes(m.id)) continue;
        const d = Math.hypot(m.x - v.x, m.y - v.y);
        if (Math.abs(d - v.r) > 13) continue;
        const a = Math.atan2(m.y - v.y, m.x - v.x);
        let diff = Math.abs(a - v.gap) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < v.gapW) continue;
        v.hit.push(m.id);
        w.hurtMember(m, v.dmg, true);
      }
    }
  }
}

export function cleanup(w: World) {
  compact(w.zombies);
  const bs = w.bullets;
  let j = 0;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (b.dead) recycleBullet(b);
    else bs[j++] = b;
  }
  bs.length = j;
  compact(w.props);
  compact(w.coins);
  compact(w.shots);
  compact(w.waves);
}

function compact<T extends { dead: boolean }>(arr: T[]) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
  arr.length = j;
}
