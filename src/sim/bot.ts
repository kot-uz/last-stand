import { clamp } from '../core/util';
import { VIEW_W, World } from './world';

/**
 * Simple autopilot: scores candidate columns by value ahead vs. danger.
 * Used for headless balance tests and the title-screen attract mode.
 */
export function botControl(w: World, skill = 1) {
  const L = w.leader;
  if (!L) return;
  const [bl, br] = w.roadBounds(w.squadY);
  let bestX = L.x, bestS = -1e9;
  const top = w.camTop;
  for (let cx = bl + 30; cx <= br - 30; cx += 20) {
    let s = -Math.abs(cx - L.x) * 0.02;
    for (const z of w.zombies) {
      if (z.dead) continue;
      const dy = w.squadY - z.y;
      if (dy < -20 || dy > 650) continue;
      const dx = Math.abs(z.x - cx);
      // shooting zombies in our column is good when they are far, dangerous when near
      if (dx < 50) s += dy > 260 ? 0.6 + z.maxHp * 0.004 : -(z.def.dmg * (260 - dy)) / 120;
      if (dx < 34 && dy < 140) s -= z.def.dmg * 0.6;
    }
    for (const p of w.props) {
      if (p.dead || p.y < top) continue;
      const dy = w.squadY - p.y;
      if (dy < -30 || dy > 700) continue;
      const dx = Math.abs(p.x - cx);
      const hw = p.w / 2 + 30;
      if (p.def.pickup) { if (dx < hw) s += p.kind === 'p_survivor' ? 30 : 22; }
      else if (p.def.target && p.kind !== 'barrel') { if (dx < hw && dy > 120) s += p.kind === 'cage' || p.kind === 'bus' ? 26 : 14; }
      else if ((p.def.solid || p.def.dps || p.kind === 'mine' || p.kind === 'barrel') && dx < hw + 10 && dy < 340) s -= 30;
    }
    for (const sh of w.shots) if (!sh.dead && Math.abs(sh.tx - cx) < 60) s -= 40;
    for (const v of w.waves) {
      if (v.kind === 'shock' && Math.abs(v.gap - cx) < v.gapW / 2 - 15) s += 60;
      if (v.kind === 'ring') {
        const gx = v.x + Math.cos(v.gap) * (w.squadY - v.y) / Math.max(0.2, Math.sin(v.gap));
        if (Math.abs(gx - cx) < 40) s += 60;
      }
    }
    const b = w.boss;
    if (b && !b.dead) {
      if (b.state === 'aim' || b.state === 'charge') { if (Math.abs(b.aimX - cx) < b.r + 40) s -= 200; }
      else if (Math.abs(b.x - cx) < b.r) s += 5;
    }
    if (s > bestS) { bestS = s; bestX = cx; }
  }
  // imperfect play: react with some lag / noise
  const noise = (1 - skill) * 60 * Math.sin(w.time * 1.3);
  w.targetX = clamp(bestX + noise, 0, VIEW_W);
}
