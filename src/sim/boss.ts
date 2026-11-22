import { approach, clamp, dist2, lerp } from '../core/util';
import { MEMBER_R, VIEW_W, World, type Boss } from './world';

/** Boss positions are expressed relative to the (stationary) camera during the fight. */
export function updateBoss(w: World, dt: number) {
  const b = w.boss;
  if (!b || b.dead) return;
  b.t += dt;
  b.flash -= dt;
  b.anim += dt;
  const top = w.camTop;
  const L = w.leader;
  const lx = L ? L.x : VIEW_W / 2;

  if (b.state === 'enter') {
    b.y = approach(b.y, top + 180, 140 * dt);
    if (b.y >= top + 179) {
      b.entered = true;
      next(b, 'idle');
    }
    return;
  }
  const hpr = b.hp / b.maxHp;
  if (b.phase === 1 && hpr < 0.5) {
    b.phase = 2;
    w.banner(`${b.name.toUpperCase()} В ЯРОСТИ`, 'Атаки ускоряются', '#ff4d4d');
    w.sound('bossroar');
    w.emit('shake', 0, 0, 10);
  }
  if (b.kind === 'colossus' && b.phase === 2 && hpr < 0.25) {
    b.phase = 3;
    w.banner('ПОСЛЕДНИЙ РЫВОК', 'Вертолёт на подходе!', '#ff4d4d');
    w.sound('bossroar');
  }
  const fast = b.phase >= 2 ? 0.7 : 1;

  switch (b.kind) {
    case 'butcher': butcher(w, b, dt, lx, top, fast); break;
    case 'brood': brood(w, b, dt, lx, top, fast); break;
    case 'siren': siren(w, b, dt, lx, top, fast); break;
    case 'colossus': colossus(w, b, dt, lx, top, fast); break;
  }

  // body contact
  for (const m of [...w.squad]) {
    const rr = b.r + MEMBER_R;
    if (dist2(m.x, m.y, b.x, b.y) < rr * rr) w.hurtMember(m, b.state === 'charge' ? 45 : 25);
  }
}

function next(b: Boss, state: string) {
  b.state = state;
  b.t = 0;
}

function butcher(w: World, b: Boss, dt: number, lx: number, top: number, fast: number) {
  switch (b.state) {
    case 'idle':
      b.x = approach(b.x, lx, 90 * dt);
      b.y = top + 180 + Math.sin(b.anim * 2) * 8;
      if (b.t > 2.2 * fast) {
        b.cycle++;
        if (b.phase === 2 && b.cycle % 2 === 0) {
          for (let i = 0; i < 7; i++) w.spawnZombie('walker', 60 + i * 70, top - 30);
          w.emit('text', b.x, b.y - 60, 20, 0, '#ff4d4d', 'Подмога!');
        }
        b.aimX = clamp(lx, 60, VIEW_W - 60);
        next(b, 'aim');
        w.sound('alarm');
      }
      break;
    case 'aim':
      b.x = approach(b.x, b.aimX, 400 * dt);
      if (b.t > 0.95 * fast) { next(b, 'charge'); w.sound('bossroar'); }
      break;
    case 'charge':
      b.y += 980 * dt;
      if (w.fxRng.next() < 0.5) w.emit('dust', b.x, b.y - b.r);
      // crush zombies in the way
      for (const z of w.zombies) if (!z.dead && Math.abs(z.x - b.x) < b.r && Math.abs(z.y - b.y) < b.r) w.killZombie(z, false);
      if (b.y > top + 1080) {
        b.y = top - 120;
        b.x = clamp(lx + (w.rng.next() - 0.5) * 200, 80, VIEW_W - 80);
        next(b, 'return');
      }
      break;
    case 'return':
      b.y = approach(b.y, top + 180, 320 * dt);
      if (b.y >= top + 179) next(b, 'idle');
      break;
  }
}

function brood(w: World, b: Boss, dt: number, lx: number, top: number, fast: number) {
  b.x = VIEW_W / 2 + Math.sin(b.anim * 0.45) * 150;
  b.y = top + 150 + Math.sin(b.anim * 1.3) * 10;
  switch (b.state) {
    case 'idle':
      if (b.t > 1.8 * fast) {
        b.cycle++;
        next(b, ['birth', 'spit', 'egg', 'spit'][b.cycle % 4]);
      }
      break;
    case 'birth': {
      const n = b.phase === 2 ? 9 : 6;
      const every = 1.2 / n;
      const before = Math.floor((b.t - dt) / every), now = Math.floor(b.t / every);
      if (now > before && now <= n) {
        w.spawnZombie('crawler', b.x + (w.rng.next() - 0.5) * 60, b.y + b.r * 0.6);
        w.emit('splash', b.x, b.y + b.r * 0.6, 1);
      }
      if (b.t > 1.3) next(b, 'idle');
      break;
    }
    case 'spit':
      if (b.t > 0.5) {
        // a fan of acid with one guaranteed gap the squad can slip through
        const n = b.phase === 2 ? 6 : 5;
        const gap = 1 + Math.floor(w.rng.next() * (n - 1));
        for (let i = 0; i < n; i++) {
          if (i === gap) continue;
          const tx = clamp(lx + (i - (n - 1) / 2) * 76, 50, VIEW_W - 50);
          const dur = 1.1 + i * 0.05;
          w.shots.push({ kind: 'acid', sx: b.x, sy: b.y, tx, ty: w.squadY - 20 + (w.rng.next() - 0.5) * 70, t: 0, dur, dead: false });
        }
        w.sound('spit');
        next(b, 'idle');
      }
      break;
    case 'egg':
      if (b.t > 0.4) {
        for (let i = 0; i < 3; i++) {
          w.shots.push({ kind: 'egg', sx: b.x, sy: b.y, tx: lerp(90, VIEW_W - 90, w.rng.next()), ty: top + 380 + w.rng.next() * 160, t: 0, dur: 1.0, dead: false });
        }
        w.sound('spit');
        next(b, 'idle');
      }
      break;
  }
}

const SIREN_X = [120, VIEW_W / 2, VIEW_W - 120];

function siren(w: World, b: Boss, dt: number, lx: number, top: number, fast: number) {
  b.y = top + 190 + Math.sin(b.anim * 2.2) * 12;
  switch (b.state) {
    case 'idle':
      if (b.t > 1.4 * fast) {
        b.cycle++;
        next(b, ['ring', 'blink', 'ring', 'scream', 'blink'][b.cycle % 5]);
      }
      break;
    case 'blink':
      b.alpha = Math.max(0, 1 - b.t * 3);
      if (b.t > 0.35 && b.alpha === 0) {
        const opts = SIREN_X.filter(x => Math.abs(x - b.x) > 10);
        b.x = opts[Math.floor(w.rng.next() * opts.length)];
        w.emit('blink', b.x, b.y);
        next(b, 'appear');
      }
      break;
    case 'appear':
      b.alpha = Math.min(1, b.t * 3);
      if (b.alpha >= 1) next(b, 'idle');
      break;
    case 'ring': {
      const count = b.phase === 2 ? 2 : 1;
      const every = 0.75;
      const before = Math.floor((b.t - dt) / every), now = Math.floor(b.t / every);
      if (now > before && now <= count) {
        // gap aimed at a random spot on the squad line, never where the leader currently is
        let gx = lerp(70, VIEW_W - 70, w.rng.next());
        if (Math.abs(gx - lx) < 90) gx = lx < VIEW_W / 2 ? lx + 160 : lx - 160;
        const gap = Math.atan2(w.squadY - b.y, gx - b.x);
        w.waves.push({ kind: 'ring', x: b.x, y: b.y, r: b.r, speed: 250, gap, gapW: 0.24, dmg: 26, hit: [], dead: false });
        w.sound('ring');
      }
      if (b.t > every * count + 0.3) next(b, 'idle');
      break;
    }
    case 'scream':
      if (b.t > 0.5) {
        w.emit('scream', b.x, b.y, 600);
        w.sound('scream');
        for (const z of w.zombies) z.buff = 4;
        for (let i = 0; i < (b.phase === 2 ? 8 : 5); i++) w.spawnZombie('runner', 60 + w.rng.next() * (VIEW_W - 120), top - 30 - i * 20);
        next(b, 'idle');
      }
      break;
  }
}

function colossus(w: World, b: Boss, dt: number, lx: number, top: number, fast: number) {
  const rage = b.phase === 3 ? 0.6 : fast;
  b.y = top + 165 + Math.sin(b.anim * 1.5) * 6;
  if (b.state !== 'slam') b.x = approach(b.x, clamp(lx, 150, VIEW_W - 150), 45 * dt);
  switch (b.state) {
    case 'idle':
      if (b.t > 1.7 * rage) {
        b.cycle++;
        next(b, ['throw', 'slam', 'throw', 'summon', 'slam'][b.cycle % 5]);
      }
      break;
    case 'throw':
      if (b.t > 0.6) {
        const n = b.phase >= 2 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const tx = clamp(lx + (i === 0 ? 0 : (w.rng.next() < 0.5 ? -1 : 1) * 110) + (w.rng.next() - 0.5) * 30, 60, VIEW_W - 60);
          w.shots.push({ kind: 'car', sx: b.x, sy: b.y - 40, tx, ty: w.squadY - 10, t: -i * 0.25, dur: 1.35, dead: false });
        }
        w.sound('throw_big');
        next(b, 'idle');
      }
      break;
    case 'slam':
      if (b.t > 0.8) {
        const n = b.phase === 3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const gap = lerp(90, VIEW_W - 90, w.rng.next());
          w.waves.push({ kind: 'shock', x: 0, y: b.y + b.r - i * 140, r: 0, speed: 330, gap, gapW: 140, dmg: 28, hit: [], dead: false });
        }
        w.emit('shake', 0, 0, 14);
        w.emit('slam', b.x, b.y + b.r);
        w.sound('slam');
        next(b, 'idle');
      }
      break;
    case 'summon':
      if (b.t > 0.5) {
        w.spawnZombie('brute', 90, top - 30);
        w.spawnZombie('brute', VIEW_W - 90, top - 30);
        for (let i = 0; i < 6; i++) w.spawnZombie('walker', 80 + i * 76, top - 60);
        w.sound('bossroar');
        next(b, 'idle');
      }
      break;
  }
}
