import { MAX_RANK } from '../config/allies';
import { LEVELS } from '../config/levels';
import { UPGRADES, modifiersFrom, upgradeCost, type UpgradeId } from '../config/upgrades';
import type { SquadSave, World } from '../sim/world';

export interface SaveData {
  v: 1;
  coins: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  stars: Record<string, number>;
  unlocked: number;
  squad: SquadSave[];
  sound: boolean;
  music: boolean;
  seenStory: number[];
  seenTips: string[];
  endlessBest: number;
  finished: boolean;
}

const KEY = 'last-stand-save-v1';

const fresh = (): SaveData => ({
  v: 1, coins: 0, upgrades: {}, stars: {}, unlocked: 0, squad: [], sound: true, music: true,
  seenStory: [], seenTips: [], endlessBest: 0, finished: false,
});

export let save: SaveData = load();

function load(): SaveData {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return fresh();
}

export function persist() {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function resetSave() {
  save = fresh();
  persist();
}

export const mods = () => modifiersFrom(save.upgrades);

export function buyUpgrade(id: UpgradeId): boolean {
  const def = UPGRADES.find(u => u.id === id)!;
  const lvl = save.upgrades[id] ?? 0;
  if (lvl >= def.max) return false;
  const cost = upgradeCost(def, lvl);
  if (save.coins < cost) return false;
  save.coins -= cost;
  save.upgrades[id] = lvl + 1;
  persist();
  return true;
}

export interface LevelResult {
  won: boolean;
  stars: number;
  starFlags: [boolean, boolean, boolean];
  newStars: number;
  collected: number;
  clearBonus: number;
  starBonus: number;
  campBonus: number;
  total: number;
  kept: SquadSave[];
  promoted: number;
  sentToCamp: number;
  distance: number;
}

export function finishLevel(w: World): LevelResult {
  const L = w.level;
  const won = w.state === 'won';
  const s = w.stats;
  const collected = Math.round(s.coins);
  const res: LevelResult = {
    won, stars: 0, starFlags: [false, false, false], newStars: 0, collected, clearBonus: 0, starBonus: 0,
    campBonus: 0, total: 0, kept: [], promoted: 0, sentToCamp: 0, distance: Math.round(w.dist / 10),
  };

  if (L.endless) {
    res.total = collected;
    save.coins += res.total;
    if (res.distance > save.endlessBest) save.endlessBest = res.distance;
    persist();
    return res;
  }

  if (!won) {
    res.total = Math.round(collected * 0.5);
    save.coins += res.total;
    persist();
    return res;
  }

  const needRescue = Math.ceil(s.available * 0.6);
  res.starFlags = [true, s.rescued >= needRescue, s.lost === 0];
  res.stars = res.starFlags.filter(Boolean).length;
  const prev = save.stars[L.id] ?? 0;
  res.newStars = Math.max(0, res.stars - prev);
  save.stars[L.id] = Math.max(prev, res.stars);
  res.clearBonus = 40 + 12 * L.index;
  res.starBonus = res.newStars * 20;

  // squad carry-over: veterans first, capped by barracks
  const cap = mods().barracks;
  const allies = w.squad.filter(m => m.cls !== 'commander').sort((a, b) => b.rank - a.rank || b.hp / b.maxHp - a.hp / a.maxHp);
  const kept = allies.slice(0, cap);
  res.sentToCamp = allies.length - kept.length;
  res.campBonus = res.sentToCamp * 12;
  res.kept = kept.map(m => {
    const rank = Math.min(MAX_RANK, m.rank + 1);
    if (rank > m.rank) res.promoted++;
    return { cls: m.cls, rank };
  });
  save.squad = res.kept;

  res.total = collected + res.clearBonus + res.starBonus + res.campBonus;
  save.coins += res.total;
  if (L.index + 1 > save.unlocked) save.unlocked = Math.min(LEVELS.length - 1, L.index + 1);
  if (L.index === LEVELS.length - 1) save.finished = true;
  persist();
  return res;
}

export function totalStars() {
  return Object.values(save.stars).reduce((a, b) => a + b, 0);
}
