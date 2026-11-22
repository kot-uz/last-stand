import { ALLIES, MEDIC_HEAL, RANK_BONUS, SQUAD_CAP, type AllyClassId } from '../config/allies';
import { AMMO_REFILL, MEDKIT_HEAL, POWERS, type PowerId } from '../config/props';
import { WEAPONS, type WeaponDef, type WeaponId } from '../config/weapons';
import { approach, clamp, damp, dist2 } from '../core/util';
import { MEMBER_R, VIEW_W, World, type Bullet, type Member } from './world';

const LEADER_SPEED = 600;
const SPACING = 21;

const bulletPool: Bullet[] = [];
export function makeBullet(w: World): Bullet {
  const b = bulletPool.pop() ?? ({ hits: [] as number[] } as Bullet);
  b.hits.length = 0;
  b.dead = false;
  b.aoe = 0; b.burn = 0; b.knock = 0; b.ap = false; b.t = 0; b.dur = 0;
  w.bullets.push(b);
  return b;
}
export function recycleBullet(b: Bullet) { if (bulletPool.length < 2000) bulletPool.push(b); }

function computeSlots(w: World) {
  const n = w.squad.length;
  w.slots.length = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) { w.slots.push({ x: 0, y: 0 }); continue; }
    const a = i * 2.39996323;
    const r = SPACING * Math.sqrt(i) * 1.02;
    w.slots.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.82 + 6 });
  }
  w.slotsDirty = false;
}

export function updateSquad(w: World, dt: number) {
  if (w.slotsDirty) computeSlots(w);
  const L = w.leader;
  if (!L) return;
  const [bl, br] = w.roadBounds(w.squadY);

  // the formation must fit the road: clamp leader target by formation half-width
  let half = 0;
  for (const s of w.slots) half = Math.max(half, Math.abs(s.x));
  half = Math.min(half, (br - bl) / 2 - MEMBER_R);
  const tx = clamp(w.targetX, bl + MEMBER_R + half * 0.6, br - MEMBER_R - half * 0.6);
  L.x = approach(L.x, tx, LEADER_SPEED * dt);
  L.y = w.squadY;

  const k = damp(11, dt);
  const won = w.state === 'won';
  for (let i = 0; i < w.squad.length; i++) {
    const m = w.squad[i];
    if (w.slots.length !== w.squad.length) computeSlots(w);
    if (i > 0) {
      const s = w.slots[i];
      m.x += (L.x + s.x - m.x) * k;
      m.y += (L.y + s.y - m.y) * k;
    }
    const [l, r] = w.roadBounds(m.y);
    m.x = clamp(m.x, l + MEMBER_R, r - MEMBER_R);
    m.anim += dt * (w.scroll / 60 + 1.2);
    m.iframe = Math.max(0, m.iframe - dt);
    m.hurt = Math.max(0, m.hurt - dt);
    m.recoil = Math.max(0, m.recoil - dt * 8);
    m.join = Math.max(0, m.join - dt * 2.5);
    if (w.mods.regen > 0 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + w.mods.regen * dt);
    if (!won) {
      collideProps(w, m);
      fire(w, m, i, dt);
    }
  }
  if (won) return;

  // medics
  for (const m of w.squad) {
    if (m.cls !== 'medic') continue;
    let worst: Member | null = null, wr = 0.999;
    for (const o of w.squad) {
      const r = o.hp / o.maxHp;
      if (r < wr) { wr = r; worst = o; }
    }
    if (worst) {
      worst.hp = Math.min(worst.maxHp, worst.hp + MEDIC_HEAL * (1 + m.rank * RANK_BONUS) * dt);
      if (w.fxRng.next() < dt * 4) w.emit('heal', worst.x, worst.y);
    }
  }

  // coins
  const magR = 78 * w.mods.magnet;
  for (const c of w.coins) {
    if (c.dead) continue;
    c.t += dt;
    if (!c.magnet) {
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.vx *= 1 - damp(4, dt); c.vy *= 1 - damp(4, dt);
      if (c.t > 0.25) {
        for (const m of w.squad) if (dist2(c.x, c.y, m.x, m.y) < magR * magR) { c.magnet = true; break; }
      }
      if (c.y > w.camBottom + 40) c.dead = true;
    } else {
      const dx = L.x - c.x, dy = L.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 360 + c.t * 500;
      c.x += (dx / d) * sp * dt;
      c.y += (dy / d) * sp * dt - w.scroll * dt;
      if (d < 16) {
        c.dead = true;
        w.stats.coins += c.v;
        w.emit('coin', L.x, L.y);
        w.sound('coin');
      }
    }
  }

  // powers
  for (const id of Object.keys(w.powers) as PowerId[]) if (w.powers[id] > 0) w.powers[id] = Math.max(0, w.powers[id] - dt);
}

function collideProps(w: World, m: Member) {
  for (const p of w.props) {
    if (p.dead || p.fall > 0) continue;
    const hw = p.w / 2, hh = p.h / 2;
    const dx = m.x - p.x, dy = m.y - p.y;
    if (Math.abs(dx) > hw + MEMBER_R || Math.abs(dy) > hh + MEMBER_R) continue;
    const def = p.def;
    if (def.pickup) {
      if (Math.abs(dx) < hw + MEMBER_R - 2 && Math.abs(dy) < hh + MEMBER_R - 2) collect(w, p.kind, p.payload, p.x, p.y), (p.dead = true);
      continue;
    }
    if (def.solid) {
      if (def.contactDmg > 0 && !m.hitProps.includes(p.id)) {
        m.hitProps.push(p.id);
        if (m.hitProps.length > 12) m.hitProps.shift();
        if (p.kind === 'fence') {
          w.hurtMember(m, def.contactDmg);
          w.breakProp(p);
          continue;
        }
        if (w.hurtMember(m, def.contactDmg)) w.emit('crash', m.x, p.y + hh);
      }
      // push sideways out of the obstacle
      const push = dx < 0 ? p.x - hw - MEMBER_R : p.x + hw + MEMBER_R;
      const [l, r] = w.roadBounds(m.y);
      if (push < l + MEMBER_R) m.x = p.x + hw + MEMBER_R;
      else if (push > r - MEMBER_R) m.x = p.x - hw - MEMBER_R;
      else m.x = push;
      continue;
    }
    if (def.dps) {
      if (w.hurtMember(m, def.dps * 0.3)) { /* iframe throttles dps into ticks */ }
      if (p.kind === 'fire' || p.kind === 'acid') m.hurt = 0.1;
    }
    if (p.kind === 'mine' && p.fuse <= 0) {
      p.fuse = 0.15;
      w.sound('beep');
    }
  }
}

function collect(w: World, kind: string, payload: string, x: number, y: number) {
  w.emit('pickup', x, y);
  switch (kind) {
    case 'p_weapon':
      w.giveWeapon(payload as WeaponId);
      w.emit('text', x, y - 24, 20, 0, '#ffb627', '+' + WEAPONS[payload as WeaponId].name.toUpperCase());
      w.sound('weapon');
      break;
    case 'p_ammo':
      if (w.weapon.def.ammo === 0) {
        w.dropCoins(x, y, 12);
        w.emit('text', x, y - 24, 18, 0, '#ffd166', '+МОНЕТЫ');
      } else {
        w.weapon.ammo = Math.min(w.weapon.maxAmmo, w.weapon.ammo + Math.round(w.weapon.maxAmmo * AMMO_REFILL));
        w.emit('text', x, y - 24, 18, 0, '#9bd36a', '+ПАТРОНЫ');
      }
      w.sound('ammo');
      break;
    case 'p_survivor': {
      const cls = payload as AllyClassId;
      if (w.squad.length >= SQUAD_CAP + 1) {
        w.dropCoins(x, y, 12);
        w.emit('text', x, y - 24, 18, 0, '#ffd166', 'Отряд полон: +монеты');
      } else {
        w.addMember(cls, 0);
        w.stats.rescued++;
        w.emit('text', x, y - 24, 20, 0, ALLIES[cls].colors.body, '+' + ALLIES[cls].name.toUpperCase());
      }
      w.sound('recruit');
      break;
    }
    case 'p_medkit':
      for (const m of w.squad) {
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * MEDKIT_HEAL);
        w.emit('heal', m.x, m.y);
      }
      w.emit('text', x, y - 24, 20, 0, '#ff6b6b', '+ЗДОРОВЬЕ');
      w.sound('heal');
      break;
    case 'p_power': {
      const id = payload as PowerId;
      w.activatePower(id);
      w.emit('text', x, y - 24, 20, 0, POWERS[id].color, POWERS[id].name.toUpperCase());
      w.sound('power');
      break;
    }
  }
}

// ─────────────────────────── firing ───────────────────────────

function fire(w: World, m: Member, idx: number, dt: number) {
  const leader = idx === 0;
  const def: WeaponDef = leader ? w.weapon.def : WEAPONS[ALLIES[m.cls].weapon];
  const rateMul = (w.powers.rapid > 0 ? 2 : 1) * (leader ? w.mods.leaderRate : 1);
  m.cd -= dt * rateMul;
  if (m.cd > 0) return;

  let tx = m.x, ty = m.y - def.range;
  if (def.kind === 'snipe' || def.kind === 'grenade') {
    const t = def.kind === 'snipe' ? findTough(w, m, def.range) : findCluster(w, m, def.range);
    if (!t) { m.cd = 0.15; return; }
    tx = t.x; ty = t.y;
  } else if (!w.hasTargetNear(m.x, m.y, def.range, 70 + def.spread * 120)) {
    m.cd = 0.06;
    return;
  }
  m.cd = Math.max(0, m.cd) + 1 / def.rate;
  m.recoil = 1;

  const rank = 1 + m.rank * RANK_BONUS;
  let dmg = def.dmg * rank * (leader ? w.mods.leaderDmg * (1 + 0.15 * (w.weapon.lvl - 1)) : w.mods.allyDmg);
  let burn = def.burn ?? 0;
  if (w.powers.fire > 0) burn = Math.max(burn, 12);
  const ap = !!def.armorPierce || w.powers.fire > 0;

  const ox = m.x + 5, oy = m.y - 16;
  w.emit('muzzle', ox, oy, leader ? 1 : 0, 0, def.color, def.kind);
  if (leader || w.fxRng.next() < 0.5) w.sound(def.sfx);

  if (def.kind === 'rail') {
    railShot(w, ox, oy, def.range, dmg);
  } else if (def.kind === 'grenade') {
    const b = makeBullet(w);
    const d = Math.hypot(tx - ox, ty - oy);
    Object.assign(b, { x: ox, y: oy, sx: ox, sy: oy, tx, ty, t: 0, dur: 0.45 + d / 900, vx: 0, vy: 0, dmg, pierce: 0, life: 9, r: 5, kind: 'grenade', aoe: def.aoe ?? 50, burn: 0, knock: 0, ap: true, color: def.color });
  } else {
    const extra = w.powers.multi > 0 ? 2 : 0;
    const count = def.count + extra;
    const baseA = def.kind === 'snipe' ? Math.atan2(ty - oy, tx - ox) : -Math.PI / 2;
    const spread = def.spread + (extra && def.count === 1 ? 0.35 : 0);
    for (let i = 0; i < count; i++) {
      let a: number;
      if (count > 1) a = baseA - spread / 2 + (spread * i) / (count - 1) + (w.fxRng.next() - 0.5) * 0.06;
      else a = baseA + (w.fxRng.next() - 0.5) * spread;
      const sp = def.speed * (def.kind === 'pellet' || def.kind === 'flame' ? 0.85 + w.fxRng.next() * 0.3 : 1);
      const b = makeBullet(w);
      b.x = ox; b.y = oy;
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp - w.scroll;
      b.dmg = dmg; b.pierce = def.pierce; b.life = def.range / sp;
      b.r = def.kind === 'flame' ? 8 : def.kind === 'rocket' ? 6 : 4;
      b.kind = def.kind; b.aoe = def.aoe ?? 0; b.burn = burn; b.knock = def.knock ?? 0; b.ap = ap;
      b.color = def.color;
    }
  }

  if (leader && def.ammo > 0) {
    w.weapon.ammo--;
    if (w.weapon.ammo <= 0) {
      w.emit('text', m.x, m.y - 40, 18, 0, '#ff6b6b', 'Патроны кончились');
      w.weapon = { def: WEAPONS.pistol, ammo: 0, maxAmmo: 0, lvl: 1 };
      w.sound('empty');
    }
  }
}

function railShot(w: World, x: number, y: number, range: number, dmg: number) {
  const top = Math.max(w.camTop - 20, y - range);
  w.emit('beam', x, y, top);
  w.emit('shake', 0, 0, 3);
  for (const z of w.zombies) {
    if (!z.dead && z.y < y && z.y > top && Math.abs(z.x - x) < z.r + 9) w.damageZombie(z, dmg, true, 0, 4);
  }
  for (const p of w.props) {
    if (!p.dead && p.def.hp > 0 && !p.def.pickup && p.y < y && p.y > top && Math.abs(p.x - x) < p.w / 2 + 6) w.damageProp(p, dmg);
  }
  const b = w.boss;
  if (b && !b.dead && b.y < y && Math.abs(b.x - x) < b.r + 6) w.damageBoss(dmg);
}

function findTough(w: World, m: Member, range: number) {
  let best: { x: number; y: number } | null = null, score = 0;
  const top = Math.max(m.y - range, w.camTop + 10);
  for (const z of w.zombies) {
    if (z.dead || z.y > m.y - 30 || z.y < top) continue;
    const dx = Math.abs(z.x - m.x), dy = m.y - z.y;
    if (dx > dy * 0.7 + 40) continue;
    const s = z.hp + (z.def.screamer || z.def.spitter ? 200 : 0) + z.y * 0.05;
    if (s > score) { score = s; best = z; }
  }
  const b = w.boss;
  if (b && !b.dead && b.entered && b.y < m.y && b.hp > score) best = b;
  if (!best) {
    for (const p of w.props) {
      if (p.dead || !p.def.target || p.fall > 0 || p.y > m.y - 30 || p.y < top) continue;
      if (Math.abs(p.x - m.x) < 120) return p;
    }
  }
  return best;
}

function findCluster(w: World, m: Member, range: number) {
  const top = Math.max(m.y - range, w.camTop + 40);
  let best: { x: number; y: number } | null = null, score = 0;
  const zs = w.zombies;
  const step = Math.max(1, Math.floor(zs.length / 40));
  for (let i = 0; i < zs.length; i += step) {
    const z = zs[i];
    if (z.dead || z.y > m.y - 80 || z.y < top) continue;
    let n = 0;
    for (let j = 0; j < zs.length; j += step) {
      const o = zs[j];
      if (!o.dead && Math.abs(o.x - z.x) < 55 && Math.abs(o.y - z.y) < 55) n++;
    }
    n -= (m.y - z.y) * 0.002; // prefer closer groups
    if (n > score) { score = n; best = z; }
  }
  const b = w.boss;
  if (!best && b && !b.dead && b.entered) return b;
  return best;
}

export { VIEW_W };
