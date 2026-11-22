export interface ZombieLook {
  skin: string;
  cloth: string;
  cloth2: string;
  /** body scale relative to radius */
  build: 'normal' | 'lean' | 'huge' | 'fat' | 'hunch' | 'riot' | 'screamer' | 'crawler';
  eye: string;
}

export interface ZombieDef {
  id: string;
  name: string;
  hp: number;
  /** forward speed px/s (toward squad) */
  speed: number;
  dmg: number;
  r: number;
  /** horizontal steering acceleration toward squad */
  home: number;
  maxSide: number;
  coinChance: number;
  coin: number;
  /** knockback multiplier (0 = immovable) */
  knockMul: number;
  armor?: number;
  explodeOnDeath?: { r: number; dmg: number };
  spitter?: boolean;
  screamer?: boolean;
  /** survives contact, gets knocked back instead of dying */
  bruiser?: boolean;
  burnMul?: number;
  looks: ZombieLook[];
  tip?: string;
}

const Z = <T extends Record<string, ZombieDef>>(t: T) => t;

export const ZOMBIES = Z({
  walker: {
    id: 'walker', name: 'Ходок', hp: 22, speed: 32, dmg: 10, r: 12, home: 60, maxSide: 38,
    coinChance: 0.35, coin: 1, knockMul: 1,
    looks: [
      { skin: '#8fb573', cloth: '#5b6c8f', cloth2: '#3d4a66', build: 'normal', eye: '#ffef5a' },
      { skin: '#9bbf7a', cloth: '#8f5b5b', cloth2: '#5e3a3a', build: 'normal', eye: '#ffef5a' },
      { skin: '#86a86d', cloth: '#a3956b', cloth2: '#6d6346', build: 'normal', eye: '#ffef5a' },
      { skin: '#a2c27f', cloth: '#5f8a6e', cloth2: '#3d5a47', build: 'normal', eye: '#ffef5a' },
    ],
  },
  runner: {
    id: 'runner', name: 'Бегун', hp: 14, speed: 118, dmg: 8, r: 11, home: 420, maxSide: 140,
    coinChance: 0.45, coin: 1, knockMul: 1.3,
    looks: [
      { skin: '#b5c07a', cloth: '#b23a48', cloth2: '#7a2232', build: 'lean', eye: '#ff4d4d' },
      { skin: '#a9b56f', cloth: '#3b3b3b', cloth2: '#222', build: 'lean', eye: '#ff4d4d' },
    ],
    tip: 'Бегуны быстрые и рвутся прямо к отряду. Стреляй заранее!',
  },
  brute: {
    id: 'brute', name: 'Брут', hp: 260, speed: 26, dmg: 30, r: 23, home: 45, maxSide: 30,
    coinChance: 1, coin: 6, knockMul: 0.15, bruiser: true,
    looks: [{ skin: '#7d9a62', cloth: '#4a4a52', cloth2: '#2f2f35', build: 'huge', eye: '#ffb000' }],
    tip: 'Брут выдерживает огромный урон и не умирает при атаке. Держи его на расстоянии.',
  },
  bloater: {
    id: 'bloater', name: 'Толстяк', hp: 60, speed: 24, dmg: 12, r: 18, home: 50, maxSide: 30,
    coinChance: 0.8, coin: 3, knockMul: 0.5, explodeOnDeath: { r: 88, dmg: 45 },
    looks: [{ skin: '#a6c25c', cloth: '#c7b36b', cloth2: '#8a7a3e', build: 'fat', eye: '#fff' }],
    tip: 'Толстяк взрывается токсичным газом. Убивай издалека — газ ранит и зомби вокруг!',
  },
  spitter: {
    id: 'spitter', name: 'Плевун', hp: 45, speed: 40, dmg: 10, r: 12, home: 80, maxSide: 70,
    coinChance: 1, coin: 3, knockMul: 1, spitter: true,
    looks: [{ skin: '#7fd15a', cloth: '#3e6b3a', cloth2: '#244022', build: 'hunch', eye: '#d6ff3a' }],
    tip: 'Плевун держит дистанцию и плюёт кислотой туда, где стоит отряд. Не стой на месте!',
  },
  riot: {
    id: 'riot', name: 'Омоновец', hp: 90, speed: 38, dmg: 14, r: 14, home: 55, maxSide: 34,
    coinChance: 1, coin: 4, knockMul: 0.4, armor: 0.7,
    looks: [{ skin: '#8fae76', cloth: '#2c3e63', cloth2: '#1b2740', build: 'riot', eye: '#ffef5a' }],
    tip: 'Омоновец в броне: обычные пули наносят лишь 30% урона. Огонь, взрывы и пробивание игнорируют броню.',
  },
  screamer: {
    id: 'screamer', name: 'Крикун', hp: 60, speed: 30, dmg: 8, r: 12, home: 50, maxSide: 40,
    coinChance: 1, coin: 5, knockMul: 1, screamer: true,
    looks: [{ skin: '#d8d4c4', cloth: '#6b3e75', cloth2: '#462750', build: 'screamer', eye: '#ff5cf0' }],
    tip: 'Крикун ускоряет зомби вокруг и зовёт бегунов. Убивай его первым!',
  },
  crawler: {
    id: 'crawler', name: 'Ползун', hp: 8, speed: 92, dmg: 5, r: 8, home: 260, maxSide: 110,
    coinChance: 0.1, coin: 1, knockMul: 1.5,
    looks: [{ skin: '#9aa86a', cloth: '#5a4a3a', cloth2: '#3a2f25', build: 'crawler', eye: '#ffef5a' }],
  },
});

export type ZombieType = keyof typeof ZOMBIES;
export const ZOMBIE_LIST = Object.values(ZOMBIES) as ZombieDef[];
export const ZOMBIE_INDEX: Record<string, number> = Object.fromEntries(ZOMBIE_LIST.map((z, i) => [z.id, i]));

export type BossKind = 'butcher' | 'brood' | 'siren' | 'colossus';
export interface BossDef { kind: BossKind; name: string; title: string; hp: number; r: number; color: string }
export const BOSSES: Record<BossKind, BossDef> = {
  butcher: { kind: 'butcher', name: 'Мясник', title: 'Хозяин бойни', hp: 3400, r: 40, color: '#c0392b' },
  brood: { kind: 'brood', name: 'Матка', title: 'Мать роя', hp: 4400, r: 56, color: '#8e44ad' },
  siren: { kind: 'siren', name: 'Сирена', title: 'Голос мёртвого города', hp: 6200, r: 34, color: '#ff4fd8' },
  colossus: { kind: 'colossus', name: 'Колосс', title: 'Падение Ковчега', hp: 9800, r: 64, color: '#e67e22' },
};
