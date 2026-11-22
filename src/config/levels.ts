import type { AllyClassId } from './allies';
import type { BossKind, ZombieType } from './enemies';
import type { PropKind } from './props';
import type { WeaponId } from './weapons';

export type BiomeId = 'suburbs' | 'highway' | 'neon' | 'fort';

export interface ChapterDef {
  id: number;
  name: string;
  biome: BiomeId;
  subtitle: string;
  story: string;
  color: string;
}

export const CHAPTERS: ChapterDef[] = [
  { id: 0, name: 'Мейпл-Хиллс', biome: 'suburbs', subtitle: 'Глава 1', color: '#7bc950',
    story: 'День 47. Радио ловит сигнал: «Ковчег» на базе Форт-Хейвен принимает выживших. До него — сотня миль мёртвой земли. Мы выходим на рассвете.' },
  { id: 1, name: 'Трасса №9', biome: 'highway', subtitle: 'Глава 2', color: '#9aa5b1',
    story: 'Пригород позади. Трасса забита брошенными машинами, а под мостом что-то шевелится. Говорят, твари там стали крупнее.' },
  { id: 2, name: 'Неоновый район', biome: 'neon', subtitle: 'Глава 3', color: '#ff4fd8',
    story: 'Электричество в центре почти не работает. Вывески мигают в темноте, и в каждой подворотне кто-то кричит. Держитесь вместе.' },
  { id: 3, name: 'Форт-Хейвен', biome: 'fort', subtitle: 'Глава 4', color: '#ff8c42',
    story: 'Мы дошли. Ворота базы распахнуты, сирены молчат. «Ковчег» пал. Остался последний шанс — эвакуационная площадка на крыше штаба.' },
];

export type ForkSide = 'survivors' | 'weapon' | 'horde' | 'traps' | 'power' | 'medkit' | 'mystery';

export type LevelEvent =
  | { type: 'horde'; at: number; size: number; mix?: [ZombieType, number][] }
  | { type: 'fork'; at: number; len: number; left: ForkSide[]; right: ForkSide[] }
  | { type: 'narrow'; at: number; len: number; width: number }
  | { type: 'bus'; at: number }
  | { type: 'airdrop'; at: number; weapon: WeaponId }
  | { type: 'flank'; at: number; count: number; zt: ZombieType }
  | { type: 'minefield'; at: number; rows: number }
  | { type: 'gauntlet'; at: number; rows: number }
  | { type: 'barrels'; at: number };

export interface LevelDef {
  id: string;
  chapter: number;
  index: number;
  name: string;
  desc: string;
  length: number;
  seed: number;
  speed: number;
  /** zombies per second at start / end of the level */
  spawns: Partial<Record<ZombieType, [number, number]>>;
  /** objects per 1000px */
  objects: { crate: number; ammo: number; cage: number; mystery: number; barrel: number; power: number; medkit: number };
  obstacles: { kinds: PropKind[]; density: number };
  weapons: WeaponId[];
  allies: AllyClassId[];
  events: LevelEvent[];
  boss?: BossKind;
  night?: boolean;
  intro?: ZombieType[];
  tutorial?: boolean;
  endless?: boolean;
}

const O = (crate: number, cage: number, extra: Partial<LevelDef['objects']> = {}): LevelDef['objects'] => ({
  crate, cage, ammo: 0.2, mystery: 0.15, barrel: 0.3, power: 0.15, medkit: 0.08, ...extra,
});

export const LEVELS: LevelDef[] = [
  // ───────── Chapter 1: Maple Hills ─────────
  {
    id: '1-1', chapter: 0, index: 0, name: 'Первые шаги', desc: 'Выберемся из пригорода. Освобождай выживших и подбирай оружие.',
    length: 5200, seed: 101, speed: 95, tutorial: true,
    spawns: { walker: [0.8, 1.7] },
    objects: O(0.35, 0.4, { mystery: 0, ammo: 0.1, barrel: 0.35 }),
    obstacles: { kinds: ['fence', 'car'], density: 0.35 },
    weapons: ['smg', 'shotgun'], allies: ['rifleman'],
    events: [{ type: 'horde', at: 0.82, size: 16 }],
  },
  {
    id: '1-2', chapter: 0, index: 1, name: 'Соседский дозор', desc: 'Бегуны! Ящики «?» могут таить сюрприз — хороший или плохой.',
    length: 6200, seed: 102, speed: 95, intro: ['runner'],
    spawns: { walker: [1.0, 2.0], runner: [0.12, 0.45] },
    objects: O(0.35, 0.4, { mystery: 0.3 }),
    obstacles: { kinds: ['fence', 'car', 'barrier'], density: 0.5 },
    weapons: ['smg', 'shotgun', 'rifle'], allies: ['rifleman', 'gunner'],
    events: [{ type: 'flank', at: 0.4, count: 8, zt: 'runner' }, { type: 'horde', at: 0.86, size: 26 }],
  },
  {
    id: '1-3', chapter: 0, index: 2, name: 'Вечеринка в квартале', desc: 'Орда на подходе. Взрывай бочки, чтобы проредить толпу.',
    length: 7000, seed: 103, speed: 98,
    spawns: { walker: [1.2, 2.3], runner: [0.25, 0.6] },
    objects: O(0.38, 0.42, { barrel: 0.5 }),
    obstacles: { kinds: ['fence', 'car', 'barrier', 'spikes'], density: 0.55 },
    weapons: ['smg', 'shotgun', 'rifle', 'launcher'], allies: ['rifleman', 'gunner', 'medic'],
    events: [{ type: 'barrels', at: 0.25 }, { type: 'horde', at: 0.45, size: 34 }, { type: 'horde', at: 0.86, size: 46, mix: [['walker', 4], ['runner', 1]] }],
  },
  {
    id: '1-4', chapter: 0, index: 3, name: 'Бойня', desc: 'Дорогу перекрыл Мясник. Следи за красной полосой — он бросается по ней.',
    length: 3600, seed: 104, speed: 98, boss: 'butcher',
    spawns: { walker: [1.0, 1.8], runner: [0.2, 0.4] },
    objects: O(0.45, 0.5, { power: 0.25 }),
    obstacles: { kinds: ['fence', 'car'], density: 0.4 },
    weapons: ['smg', 'shotgun', 'rifle'], allies: ['rifleman', 'gunner', 'medic'],
    events: [{ type: 'horde', at: 0.6, size: 24 }],
  },

  // ───────── Chapter 2: Route 9 ─────────
  {
    id: '2-1', chapter: 1, index: 4, name: 'Пробка', desc: 'Трасса забита машинами. Широкий отряд будет цеплять обломки.',
    length: 7200, seed: 201, speed: 100, intro: ['brute'],
    spawns: { walker: [1.3, 2.4], runner: [0.3, 0.6], brute: [0.03, 0.11] },
    objects: O(0.38, 0.42),
    obstacles: { kinds: ['car', 'car', 'barrier'], density: 1.0 },
    weapons: ['smg', 'shotgun', 'rifle', 'launcher'], allies: ['rifleman', 'gunner', 'sniper', 'medic'],
    events: [{ type: 'gauntlet', at: 0.3, rows: 4 }, { type: 'horde', at: 0.55, size: 36 }, { type: 'gauntlet', at: 0.75, rows: 5 }],
  },
  {
    id: '2-2', chapter: 1, index: 5, name: 'Развилка', desc: 'Дорога делится. Выбирай сторону — второго шанса не будет.',
    length: 7600, seed: 202, speed: 100, intro: ['bloater'],
    spawns: { walker: [1.4, 2.5], runner: [0.35, 0.7], brute: [0.05, 0.12], bloater: [0.08, 0.22] },
    objects: O(0.35, 0.38),
    obstacles: { kinds: ['car', 'barrier', 'spikes'], density: 0.7 },
    weapons: ['smg', 'shotgun', 'rifle', 'launcher', 'flamer'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [
      { type: 'fork', at: 0.22, len: 900, left: ['survivors', 'horde'], right: ['weapon', 'traps'] },
      { type: 'horde', at: 0.5, size: 38 },
      { type: 'fork', at: 0.66, len: 900, left: ['power', 'traps'], right: ['medkit', 'mystery', 'horde'] },
    ],
  },
  {
    id: '2-3', chapter: 1, index: 6, name: 'Мост', desc: 'Мост узкий. Плевуны бьют по площади — не стой на месте.',
    length: 8000, seed: 203, speed: 100, intro: ['spitter'],
    spawns: { walker: [1.5, 2.6], runner: [0.4, 0.7], brute: [0.05, 0.13], bloater: [0.08, 0.2], spitter: [0.05, 0.14] },
    objects: O(0.36, 0.4),
    obstacles: { kinds: ['car', 'barrier', 'fence'], density: 0.6 },
    weapons: ['smg', 'shotgun', 'rifle', 'launcher', 'flamer'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [{ type: 'bus', at: 0.18 }, { type: 'narrow', at: 0.36, len: 1900, width: 300 }, { type: 'horde', at: 0.88, size: 44 }],
  },
  {
    id: '2-4', chapter: 1, index: 7, name: 'Гнездо', desc: 'Под мостом — Матка. Она рожает стаи ползунов. Не дай им окружить отряд.',
    length: 4000, seed: 204, speed: 100, boss: 'brood',
    spawns: { walker: [1.4, 2.2], runner: [0.4, 0.6], bloater: [0.1, 0.15], spitter: [0.05, 0.1] },
    objects: O(0.45, 0.5, { power: 0.25 }),
    obstacles: { kinds: ['car', 'barrier'], density: 0.6 },
    weapons: ['shotgun', 'rifle', 'launcher', 'flamer', 'minigun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [{ type: 'horde', at: 0.55, size: 32 }],
  },

  // ───────── Chapter 3: Neon District ─────────
  {
    id: '3-1', chapter: 2, index: 8, name: 'Отключение', desc: 'Ночь. Видно только то, что освещают фонари отряда. Омоновцы в броне.',
    length: 7600, seed: 301, speed: 100, night: true, intro: ['riot'],
    spawns: { walker: [1.5, 2.6], runner: [0.4, 0.8], riot: [0.08, 0.22], bloater: [0.05, 0.12], brute: [0.03, 0.08] },
    objects: O(0.38, 0.42),
    obstacles: { kinds: ['car', 'barrier', 'fire'], density: 0.6 },
    weapons: ['rifle', 'launcher', 'flamer', 'shotgun', 'minigun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [{ type: 'flank', at: 0.3, count: 10, zt: 'runner' }, { type: 'airdrop', at: 0.5, weapon: 'flamer' }, { type: 'horde', at: 0.85, size: 46, mix: [['walker', 5], ['riot', 1]] }],
  },
  {
    id: '3-2', chapter: 2, index: 9, name: 'Крикуны', desc: 'Крик слышен за кварталы. Крикун ускоряет орду — он цель номер один.',
    length: 8000, seed: 302, speed: 102, night: true, intro: ['screamer'],
    spawns: { walker: [1.6, 2.7], runner: [0.4, 0.8], riot: [0.08, 0.18], screamer: [0.04, 0.1], spitter: [0.04, 0.1] },
    objects: O(0.38, 0.42),
    obstacles: { kinds: ['car', 'barrier', 'fire', 'spikes'], density: 0.6 },
    weapons: ['rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [
      { type: 'horde', at: 0.3, size: 40 },
      { type: 'fork', at: 0.5, len: 1000, left: ['survivors', 'survivors', 'horde'], right: ['weapon', 'power'] },
      { type: 'horde', at: 0.86, size: 50, mix: [['walker', 4], ['runner', 2], ['screamer', 0.2]] },
    ],
  },
  {
    id: '3-3', chapter: 2, index: 10, name: 'Торговый центр', desc: 'Сброс груза с вертолёта! К ящику сбегутся все твари в округе.',
    length: 8600, seed: 303, speed: 102, night: true,
    spawns: { walker: [1.7, 2.8], runner: [0.5, 0.9], riot: [0.1, 0.2], screamer: [0.04, 0.1], spitter: [0.05, 0.12], bloater: [0.06, 0.12], brute: [0.04, 0.1] },
    objects: O(0.38, 0.45),
    obstacles: { kinds: ['car', 'barrier', 'fire'], density: 0.6 },
    weapons: ['rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [{ type: 'bus', at: 0.15 }, { type: 'airdrop', at: 0.4, weapon: 'railgun' }, { type: 'narrow', at: 0.55, len: 1400, width: 320 }, { type: 'horde', at: 0.88, size: 54 }],
  },
  {
    id: '3-4', chapter: 2, index: 11, name: 'Песня Сирены', desc: 'Сирена телепортируется и бьёт звуковыми кольцами. Ищи в кольце проём.',
    length: 4200, seed: 304, speed: 102, boss: 'siren', night: true,
    spawns: { walker: [1.6, 2.4], runner: [0.5, 0.8], riot: [0.1, 0.15], screamer: [0.03, 0.06] },
    objects: O(0.45, 0.5, { power: 0.25 }),
    obstacles: { kinds: ['car', 'barrier'], density: 0.5 },
    weapons: ['rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [{ type: 'horde', at: 0.5, size: 36 }],
  },

  // ───────── Chapter 4: Fort Haven ─────────
  {
    id: '4-1', chapter: 3, index: 12, name: 'Периметр', desc: 'Минные поля у ворот базы. Мины взрывают и зомби — используй это.',
    length: 8200, seed: 401, speed: 104,
    spawns: { walker: [1.8, 2.9], runner: [0.5, 0.9], brute: [0.06, 0.14], riot: [0.1, 0.2], spitter: [0.05, 0.1] },
    objects: O(0.38, 0.42),
    obstacles: { kinds: ['barrier', 'car', 'spikes'], density: 0.6 },
    weapons: ['rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [{ type: 'minefield', at: 0.25, rows: 5 }, { type: 'horde', at: 0.45, size: 46 }, { type: 'minefield', at: 0.65, rows: 6 }, { type: 'horde', at: 0.88, size: 56 }],
  },
  {
    id: '4-2', chapter: 3, index: 13, name: 'Карантин', desc: 'Зона заражения: толстяки, плевуны и огонь. Береги здоровье.',
    length: 8800, seed: 402, speed: 104,
    spawns: { walker: [1.8, 3.0], runner: [0.5, 1.0], bloater: [0.15, 0.3], spitter: [0.08, 0.16], screamer: [0.04, 0.08], brute: [0.05, 0.12] },
    objects: O(0.38, 0.42, { medkit: 0.14 }),
    obstacles: { kinds: ['fire', 'barrier', 'car', 'spikes'], density: 0.65 },
    weapons: ['rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [
      { type: 'bus', at: 0.2 },
      { type: 'fork', at: 0.45, len: 1000, left: ['survivors', 'traps', 'horde'], right: ['power', 'medkit', 'mystery'] },
      { type: 'barrels', at: 0.7 },
      { type: 'horde', at: 0.88, size: 56, mix: [['walker', 4], ['bloater', 1], ['runner', 1]] },
    ],
  },
  {
    id: '4-3', chapter: 3, index: 14, name: 'Последняя миля', desc: 'Всё, что осталось от армии мёртвых, — между тобой и штабом.',
    length: 9600, seed: 403, speed: 106,
    spawns: { walker: [2.0, 3.2], runner: [0.6, 1.1], brute: [0.07, 0.15], riot: [0.1, 0.22], bloater: [0.1, 0.2], spitter: [0.06, 0.12], screamer: [0.04, 0.08] },
    objects: O(0.4, 0.45),
    obstacles: { kinds: ['car', 'barrier', 'fire', 'spikes'], density: 0.65 },
    weapons: ['rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [
      { type: 'horde', at: 0.2, size: 46 },
      { type: 'airdrop', at: 0.35, weapon: 'minigun' },
      { type: 'narrow', at: 0.45, len: 1500, width: 320 },
      { type: 'horde', at: 0.65, size: 56 },
      { type: 'minefield', at: 0.75, rows: 4 },
      { type: 'horde', at: 0.9, size: 64, mix: [['walker', 4], ['runner', 2], ['brute', 0.2], ['riot', 0.5]] },
    ],
  },
  {
    id: '4-4', chapter: 3, index: 15, name: 'Колосс', desc: 'Последний бой. Колосс бросает машины и сотрясает землю. Продержись до вертолёта.',
    length: 4500, seed: 404, speed: 104, boss: 'colossus',
    spawns: { walker: [1.8, 2.6], runner: [0.5, 0.8], riot: [0.1, 0.15], brute: [0.05, 0.08] },
    objects: O(0.5, 0.55, { power: 0.25 }),
    obstacles: { kinds: ['car', 'barrier'], density: 0.5 },
    weapons: ['rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
    events: [{ type: 'horde', at: 0.5, size: 44 }],
  },
];

export const ENDLESS: LevelDef = {
  id: 'endless', chapter: 3, index: 99, name: 'Бесконечная дорога', desc: 'Как далеко ты зайдёшь? Сложность растёт с каждой сотней метров.',
  length: Infinity, seed: 999, speed: 102, endless: true,
  spawns: { walker: [1.2, 1.2], runner: [0.3, 0.3], brute: [0.02, 0.02], bloater: [0.05, 0.05], spitter: [0.03, 0.03], riot: [0.05, 0.05], screamer: [0.02, 0.02] },
  objects: O(0.4, 0.45),
  obstacles: { kinds: ['car', 'barrier', 'fence', 'spikes', 'fire'], density: 0.6 },
  weapons: ['smg', 'shotgun', 'rifle', 'launcher', 'flamer', 'minigun', 'railgun'], allies: ['rifleman', 'gunner', 'sniper', 'medic', 'demo'],
  events: [],
};

export const levelById = (id: string) => (id === 'endless' ? ENDLESS : LEVELS.find(l => l.id === id)!);
