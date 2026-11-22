/**
 * Headless campaign playthrough with an autopilot.
 * Validates that every level is completable, logs balance & performance metrics.
 * Usage: npm run simtest [-- skill=0.8 levels=1-1,2-3 endless]
 */
import { LEVELS, ENDLESS, type LevelDef } from '../src/config/levels';
import { UPGRADES, upgradeCost } from '../src/config/upgrades';
import { botControl } from '../src/sim/bot';
import { step } from '../src/sim/step';
import { World } from '../src/sim/world';
import { buyUpgrade, finishLevel, mods, resetSave, save } from '../src/meta/save';

declare const process: { argv: string[] };
const args: Record<string, string> = Object.fromEntries(process.argv.slice(2).map((a: string) => a.split("=")));
const skill = Number(args.skill ?? 0.85);
const only = args.levels ? String(args.levels).split(',') : null;

resetSave();

function shop() {
  // greedy: cheapest available upgrade first
  for (;;) {
    let best: (typeof UPGRADES)[number] | null = null, bc = 1e9;
    for (const u of UPGRADES) {
      const l = save.upgrades[u.id] ?? 0;
      if (l >= u.max) continue;
      const c = upgradeCost(u, l);
      if (c < bc) { bc = c; best = u; }
    }
    if (!best || bc > save.coins) return;
    buyUpgrade(best.id);
  }
}

function run(level: LevelDef, maxTime = 420) {
  const w = new World(level, mods(), save.squad);
  let steps = 0;
  const t0 = performance.now();
  let maxStep = 0;
  while (true) {
    botControl(w, skill);
    const s0 = performance.now();
    step(w);
    const sd = performance.now() - s0;
    if (sd > maxStep) maxStep = sd;
    w.fx.length = 0; w.sfx.length = 0; w.banners.length = 0;
    steps++;
    if (w.state !== 'playing' && w.endT > 1) break;
    if (w.stats.time > maxTime) break;
  }
  const ms = performance.now() - t0;
  return { w, steps, avg: ms / steps, maxStep };
}

const levels = only ? [...LEVELS, ENDLESS].filter(l => only.includes(l.id)) : args.endless ? [ENDLESS] : LEVELS;
let totalAttempts = 0;
for (const level of levels) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    totalAttempts++;
    shop();
    const squadIn = save.squad.length;
    const { w, avg, maxStep } = run(level);
    const r = finishLevel(w);
    const s = w.stats;
    console.log(
      `${level.id.padEnd(7)} try${attempt} ${w.state.padEnd(7)} t=${s.time.toFixed(0)}s dist=${Math.round(w.dist)} kills=${s.kills} ` +
      `squad ${squadIn + 1}->${w.squad.length} rescued=${s.rescued}/${s.available} lost=${s.lost} ` +
      `peakZ=${s.peakZombies} +${r.total}c bank=${save.coins} stars=${r.stars} wpn=${w.weapon.def.id} ` +
      `step avg=${avg.toFixed(3)}ms max=${maxStep.toFixed(1)}ms`,
    );
    if (w.state === 'won' || level.endless) break;
  }
}
console.log('upgrades', JSON.stringify(save.upgrades), 'attempts', totalAttempts);
