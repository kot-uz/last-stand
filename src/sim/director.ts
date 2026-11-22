import type { AllyClassId } from '../config/allies';
import { BOSSES, type ZombieType } from '../config/enemies';
import type { ForkSide, LevelEvent } from '../config/levels';
import { PROPS, TIMED_POWERS, type PowerId, type PropKind } from '../config/props';
import { WEAPONS, type WeaponId } from '../config/weapons';
import { clamp, lerp } from '../core/util';
import { VIEW_W, World } from './world';

const CHUNK = 800;
const START_CLEAR = 520;

/** Generates the track ahead of the camera and runs spawning / triggers. */
export function updateDirector(w: World, dt: number) {
  const L = w.level;
  // lazy track generation
  while (w.genY > w.camTop - 1400) {
    const d0 = -w.genY;
    genChunk(w, d0, d0 + CHUNK);
    w.genY -= CHUNK;
  }

  // triggers
  for (const t of w.triggers) {
    if (t.done) continue;
    if (t.kind === 'warn' ? w.squadY - 520 <= t.y : w.camTop - 60 <= t.y) {
      t.done = true;
      fireTrigger(w, t.kind, t.data, t.y);
    }
  }
  if (w.triggers.length > 40) w.triggers = w.triggers.filter(t => !t.done);

  if (w.state !== 'playing') return;

  // finish / boss
  if (!L.endless && w.dist >= L.length) {
    if (L.boss) {
      if (!w.bossPhase) startBoss(w);
    } else {
      w.win();
    }
  }
  if (w.bossPhase) w.scroll = Math.max(0, w.scroll - L.speed * dt * 0.8);

  // continuous spawning
  if (w.dist < START_CLEAR - 150) return;
  const p = w.progress;
  let mul = 1 + L.index * 0.02;
  if (L.endless) mul = 1 + w.dist / 5000;
  if (w.bossPhase) mul = w.boss && w.boss.entered ? 0.45 : 0.1;
  if (L.tutorial && w.dist < 1400) mul *= 0.6;
  for (const [type, [a, b]] of Object.entries(L.spawns) as [ZombieType, [number, number]][]) {
    let rate = lerp(a, b, w.bossPhase ? 1 : p) * mul;
    if (L.endless) {
      const unlock: Partial<Record<ZombieType, number>> = { runner: 400, bloater: 2500, brute: 3500, spitter: 4500, riot: 5500, screamer: 7000 };
      if (w.dist < (unlock[type] ?? 0)) continue;
    }
    w.spawnAcc[type] = (w.spawnAcc[type] ?? 0) + rate * dt;
    while (w.spawnAcc[type] >= 1) {
      const group = type === 'walker' ? Math.min(Math.floor(w.spawnAcc[type]), 1 + Math.floor(w.rng.next() * 3)) : 1;
      w.spawnAcc[type] -= group;
      const y = w.camTop - 30 - w.rng.next() * 50;
      const [l, r] = w.roadBounds(y);
      const cx = lerp(l + 20, r - 20, w.rng.next());
      for (let i = 0; i < group; i++) w.spawnZombie(type, clamp(cx + (w.rng.next() - 0.5) * 60, l + 10, r - 10), y - i * 22);
    }
  }
}

function startBoss(w: World) {
  const kind = w.level.boss!;
  w.bossPhase = true;
  const def = BOSSES[kind];
  w.boss = {
    kind, name: def.name, x: VIEW_W / 2, y: w.camTop - 160, hp: def.hp, maxHp: def.hp, r: def.r,
    state: 'enter', t: 0, phase: 1, flash: 0, anim: 0, aimX: VIEW_W / 2, cycle: 0, alpha: 1, dead: false, entered: false,
  };
  w.banner(def.name.toUpperCase(), def.title, def.color, true);
  w.sound('bossroar');
  w.emit('shake', 0, 0, 10);
}

// ───────────────────────── generation ─────────────────────────

function isReserved(w: World, d: number) {
  for (const [a, b] of w.reserved) if (d >= a && d <= b) return true;
  return false;
}

function pickWeapon(w: World, minTier = 1): WeaponId {
  const pool = w.level.weapons.filter(id => WEAPONS[id].tier >= minTier);
  const list = pool.length ? pool : w.level.weapons;
  return w.rng.weighted(list.map(id => [id, 4 - WEAPONS[id].tier + 0.5] as [WeaponId, number]));
}

function pickAlly(w: World): AllyClassId {
  return w.rng.weighted(w.level.allies.map(a => [a, a === 'rifleman' ? 3 : 2] as [AllyClassId, number]));
}

function pickPower(w: World): PowerId {
  return w.rng.chance(0.1) ? 'strike' : w.rng.pick(TIMED_POWERS);
}

function placeFree(w: World, placed: { x: number; d: number; r: number }[], d0: number, d1: number, r: number, xl = 70, xr = VIEW_W - 70) {
  for (let tries = 0; tries < 10; tries++) {
    const d = lerp(d0, d1, w.rng.next());
    if (isReserved(w, d)) continue;
    const [l, rr] = w.roadBounds(-d);
    const x = lerp(Math.max(xl, l + r), Math.min(xr, rr - r), w.rng.next());
    let ok = true;
    for (const p of placed) if (Math.abs(p.d - d) < p.r + r + 20 && Math.abs(p.x - x) < p.r + r + 20) { ok = false; break; }
    if (ok) {
      placed.push({ x, d, r });
      return { x, d };
    }
  }
  return null;
}

function genChunk(w: World, d0: number, d1: number) {
  const L = w.level;
  // events whose start is inside this chunk (first chunk handles anything before START)
  for (const ev of L.events) {
    const d = ev.at * L.length;
    if (d >= d0 && d < d1) placeEvent(w, ev, d);
  }
  if (L.endless) endlessEvents(w, d0, d1);

  const lo = Math.max(d0, START_CLEAR);
  const hi = L.endless ? d1 : Math.min(d1, L.length - (L.boss ? 300 : 150));
  if (hi <= lo) {
    if (d0 < START_CLEAR && L.tutorial) tutorialStart(w);
    return;
  }
  const span = (hi - lo) / 1000;
  const placed: { x: number; d: number; r: number }[] = [];
  const count = (density: number) => {
    const v = density * span;
    return Math.floor(v) + (w.rng.next() < v - Math.floor(v) ? 1 : 0);
  };
  const o = L.objects;

  for (let i = count(o.cage); i--;) {
    const p = placeFree(w, placed, lo, hi, 34);
    if (!p) continue;
    w.addProp('cage', p.x, -p.d, pickAlly(w), { hp: PROPS.cage.hp * hpScale(w) });
    w.stats.available++;
    // guard zombies near survivors make the choice riskier
    w.triggers.push({ y: -p.d - 60, kind: 'guard', data: { x: p.x, n: 2 + Math.floor(w.rng.next() * 3) }, done: false });
  }
  for (let i = count(o.crate); i--;) {
    const p = placeFree(w, placed, lo, hi, 30);
    if (p) w.addProp('crate', p.x, -p.d, pickWeapon(w), { hp: PROPS.crate.hp * hpScale(w) });
  }
  for (let i = count(o.ammo); i--;) {
    const p = placeFree(w, placed, lo, hi, 24);
    if (p) w.addProp('ammo', p.x, -p.d);
  }
  for (let i = count(o.mystery); i--;) {
    const p = placeFree(w, placed, lo, hi, 28);
    if (p) w.addProp('mystery', p.x, -p.d, '', { hp: PROPS.mystery.hp * hpScale(w) });
  }
  for (let i = count(o.barrel); i--;) {
    const p = placeFree(w, placed, lo, hi, 18);
    if (!p) continue;
    w.addProp('barrel', p.x, -p.d);
    if (w.rng.chance(0.5)) w.addProp('barrel', p.x + 26, -p.d + 8);
  }
  for (let i = count(o.power); i--;) {
    const p = placeFree(w, placed, lo, hi, 22);
    if (p) w.addProp('p_power', p.x, -p.d, pickPower(w));
  }
  for (let i = count(o.medkit); i--;) {
    const p = placeFree(w, placed, lo, hi, 22);
    if (p) w.addProp('p_medkit', p.x, -p.d);
  }
  for (let i = count(L.obstacles.density); i--;) {
    const kind = w.rng.pick(L.obstacles.kinds);
    const def = PROPS[kind];
    const p = placeFree(w, placed, lo, hi, Math.max(def.w, def.h) / 2, 40 + def.w / 2, VIEW_W - 40 - def.w / 2);
    if (p) w.addProp(kind, p.x, -p.d, '', kind === 'car' ? { variant: w.rng.int(0, 3) } : {});
  }
}

function hpScale(w: World) {
  return 1 + w.level.index * 0.12 + (w.level.endless ? w.dist / 6000 : 0);
}

function tutorialStart(w: World) {
  w.triggers.push({ y: -40, kind: 'hint', data: 'Веди пальцем влево-вправо, чтобы двигать отряд', done: false });
  w.triggers.push({ y: -700, kind: 'hint', data: 'Отряд стреляет сам — ты выбираешь цель позицией', done: false });
  w.triggers.push({ y: -1300, kind: 'hint', data: 'Разбей клетку и пробеги через выжившего', done: false });
  w.triggers.push({ y: -2000, kind: 'hint', data: 'На ящике видно оружие внутри. Расстреляй и подбери!', done: false });
  // guaranteed early cage & crate
  w.addProp('cage', 200, -1050, 'rifleman');
  w.stats.available++;
  w.addProp('crate', 360, -1750, 'smg');
}

function placeEvent(w: World, ev: LevelEvent, d: number) {
  const y = -d;
  switch (ev.type) {
    case 'horde':
      w.triggers.push({ y: y + 380, kind: 'warn', data: { text: 'ОРДА!', sub: 'Держи строй', color: '#ff4d4d' }, done: false });
      w.triggers.push({ y, kind: 'horde', data: ev, done: false });
      break;
    case 'flank':
      w.triggers.push({ y: y + 300, kind: 'warn', data: { text: 'ЗАСАДА С ФЛАНГОВ', color: '#ff8c42' }, done: false });
      w.triggers.push({ y, kind: 'flank', data: ev, done: false });
      break;
    case 'bus': {
      const list = [pickAlly(w), pickAlly(w), pickAlly(w)];
      w.addProp('bus', VIEW_W / 2, y, list.join(','), { hp: PROPS.bus.hp * hpScale(w) });
      w.stats.available += 3;
      w.reserved.push([d - 90, d + 90]);
      w.triggers.push({ y: y + 380, kind: 'warn', data: { text: 'АВТОБУС ВЫЖИВШИХ', sub: 'Вскрой его — 3 бойца внутри', color: '#2ec4b6' }, done: false });
      w.triggers.push({ y: y - 120, kind: 'guard', data: { x: VIEW_W / 2, n: 8 }, done: false });
      break;
    }
    case 'airdrop':
      w.triggers.push({ y: y + 200, kind: 'airdrop', data: ev, done: false });
      break;
    case 'narrow': {
      w.narrows.push({ y0: y, y1: y - ev.len, width: ev.width });
      w.triggers.push({ y: y + 380, kind: 'warn', data: { text: 'УЗКИЙ ПРОХОД', sub: 'Дорога сужается', color: '#ffb627' }, done: false });
      break;
    }
    case 'fork':
      placeFork(w, d, ev.len, ev.left, ev.right);
      break;
    case 'gauntlet': {
      w.reserved.push([d - 60, d + ev.rows * 230 + 60]);
      for (let r = 0; r < ev.rows; r++) {
        const ry = y - r * 230;
        const gap = lerp(110, 430, w.rng.next());
        const gapW = 130 - r * 4;
        for (let x = 60; x < VIEW_W - 40; x += 70) {
          if (Math.abs(x - gap) < gapW / 2 + 28) continue;
          const kind: PropKind = w.rng.chance(0.65) ? 'car' : 'barrier';
          w.addProp(kind, x + (w.rng.next() - 0.5) * 10, ry + (w.rng.next() - 0.5) * 30, '', { variant: w.rng.int(0, 3) });
          if (kind === 'barrier') x -= 15;
        }
        if (r === 1) w.addProp('crate', gap, ry - 115, pickWeapon(w, 2));
      }
      break;
    }
    case 'minefield': {
      w.reserved.push([d - 40, d + ev.rows * 150 + 40]);
      w.triggers.push({ y: y + 380, kind: 'warn', data: { text: 'МИННОЕ ПОЛЕ', sub: 'Мины взрывают и зомби', color: '#ffb627' }, done: false });
      for (let r = 0; r < ev.rows; r++) {
        const ry = y - r * 150;
        const gap = lerp(110, 430, w.rng.next());
        for (let x = 55; x < VIEW_W - 40; x += 46) {
          if (Math.abs(x - gap) < 62) continue;
          if (w.rng.chance(0.82)) w.addProp('mine', x + (w.rng.next() - 0.5) * 14, ry + (w.rng.next() - 0.5) * 40);
        }
      }
      break;
    }
    case 'barrels': {
      w.reserved.push([d - 120, d + 120]);
      const cx = lerp(170, 370, w.rng.next());
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        w.addProp('barrel', cx + Math.cos(a) * 55, y + Math.sin(a) * 45);
      }
      w.addProp('p_power', cx, y, 'fire');
      w.triggers.push({ y: y - 60, kind: 'guard', data: { x: cx, n: 10 }, done: false });
      break;
    }
  }
}

function placeFork(w: World, d: number, len: number, left: ForkSide[], right: ForkSide[]) {
  const y0 = -d;
  w.reserved.push([d - 60, d + len + 60]);
  w.addProp('median', VIEW_W / 2, y0 - len / 2, '', { h: len });
  w.triggers.push({ y: y0 + 420, kind: 'warn', data: { text: 'РАЗВИЛКА', sub: 'Выбери сторону', color: '#2ec4b6' }, done: false });
  const side = (contents: ForkSide[], xl: number, xr: number) => {
    const step = (len - 220) / Math.max(1, contents.length);
    contents.forEach((c, i) => {
      const yy = y0 - 140 - i * step - step / 2;
      const cx = (xl + xr) / 2;
      switch (c) {
        case 'survivors':
          w.addProp('cage', cx - 30, yy, pickAlly(w));
          w.addProp('cage', cx + 30, yy - 40, pickAlly(w));
          w.stats.available += 1; // only one side is reachable; count conservatively
          break;
        case 'weapon': w.addProp('crate', cx, yy, pickWeapon(w, 2)); break;
        case 'power': w.addProp('p_power', cx, yy, pickPower(w)); break;
        case 'medkit': w.addProp('p_medkit', cx, yy); break;
        case 'mystery': w.addProp('mystery', cx, yy); break;
        case 'traps':
          w.addProp('spikes', cx, yy + 50);
          w.addProp(w.rng.chance(0.5) ? 'fire' : 'barrier', xl + 50, yy - 30);
          w.addProp('barrel', xr - 30, yy - 20);
          break;
        case 'horde':
          w.triggers.push({ y: yy - 100, kind: 'sidehorde', data: { xl, xr, n: 16 + w.level.index * 2 }, done: false });
          break;
      }
    });
  };
  side(left, 50, VIEW_W / 2 - 20);
  side(right, VIEW_W / 2 + 20, VIEW_W - 50);
}

function endlessEvents(w: World, d0: number, d1: number) {
  if (d0 < 1200) return;
  // one event roughly every 1600px
  if (Math.floor(d0 / 1600) === Math.floor(d1 / 1600)) return;
  const d = Math.ceil(d0 / 1600) * 1600;
  const n = d / 1600;
  const roll = w.rng.weighted<LevelEvent['type']>([['horde', 4], ['fork', 2], ['gauntlet', 1.5], ['minefield', 1], ['bus', 1], ['airdrop', 1], ['flank', 1.5], ['barrels', 1]]);
  const size = 24 + n * 5;
  const ev: LevelEvent =
    roll === 'horde' ? { type: 'horde', at: 0, size } :
    roll === 'fork' ? { type: 'fork', at: 0, len: 900, left: [w.rng.pick(['survivors', 'weapon', 'power'] as ForkSide[]), 'horde'], right: [w.rng.pick(['medkit', 'mystery', 'weapon'] as ForkSide[]), 'traps'] } :
    roll === 'gauntlet' ? { type: 'gauntlet', at: 0, rows: 4 } :
    roll === 'minefield' ? { type: 'minefield', at: 0, rows: 4 } :
    roll === 'bus' ? { type: 'bus', at: 0 } :
    roll === 'airdrop' ? { type: 'airdrop', at: 0, weapon: pickWeapon(w, 3) } :
    roll === 'flank' ? { type: 'flank', at: 0, count: 8 + n, zt: 'runner' } :
    { type: 'barrels', at: 0 };
  placeEvent(w, ev, d);
}

// ───────────────────────── triggers ─────────────────────────

function fireTrigger(w: World, kind: string, data: any, y: number) {
  switch (kind) {
    case 'hint':
      w.emit('hint', 0, 0, 0, 0, undefined, data);
      break;
    case 'warn':
      w.banner(data.text, data.sub, data.color);
      w.sound('alarm');
      break;
    case 'horde': {
      const mix: [ZombieType, number][] = data.mix ?? [['walker', 5], ['runner', w.level.spawns.runner ? 1 : 0]];
      const size = Math.round(data.size * 1.25);
      const [l, r] = w.roadBounds(w.camTop);
      for (let i = 0; i < size; i++) {
        const row = Math.floor(i / 9);
        const t = w.rng.weighted(mix.filter(m => m[1] > 0));
        const x = lerp(l + 14, r - 14, w.rng.next());
        w.spawnZombie(t, x, w.camTop - 40 - row * 34 - w.rng.next() * 20);
      }
      w.emit('shake', 0, 0, 5);
      w.sound('horde');
      break;
    }
    case 'flank': {
      for (let i = 0; i < data.count; i++) {
        const left = i % 2 === 0;
        const z = w.spawnZombie(data.zt, left ? -20 : VIEW_W + 20, w.camTop + 120 + w.rng.next() * 300);
        z.vx = left ? 140 : -140;
      }
      break;
    }
    case 'sidehorde': {
      for (let i = 0; i < data.n; i++) {
        const x = lerp(data.xl + 14, data.xr - 14, w.rng.next());
        w.spawnZombie(w.rng.chance(0.2) && w.level.spawns.runner ? 'runner' : 'walker', x, y - Math.floor(i / 5) * 30 - w.rng.next() * 30);
      }
      break;
    }
    case 'guard': {
      const types: ZombieType[] = ['walker'];
      if (w.level.spawns.runner) types.push('runner');
      if (w.level.spawns.riot && w.rng.chance(0.4)) types.push('riot');
      for (let i = 0; i < data.n; i++) w.spawnZombie(w.rng.pick(types), data.x + (w.rng.next() - 0.5) * 120, y - w.rng.next() * 60);
      break;
    }
    case 'airdrop': {
      const x = lerp(110, VIEW_W - 110, w.rng.next());
      const ty = w.camTop + 260;
      w.addProp('airdrop', x, ty - 200, data.weapon, { fall: 1.6, hp: PROPS.airdrop.hp * hpScale(w) });
      w.banner('СБРОС ГРУЗА', WEAPONS[data.weapon as WeaponId].name, '#7df9ff');
      w.sound('heli');
      // the noise attracts runners from both sides
      for (let i = 0; i < 10; i++) {
        const z = w.spawnZombie(i % 3 === 0 && w.level.spawns.riot ? 'riot' : 'runner', i % 2 ? -20 : VIEW_W + 20, ty - 260 - w.rng.next() * 200);
        z.vx = i % 2 ? 120 : -120;
      }
      break;
    }
  }
}
