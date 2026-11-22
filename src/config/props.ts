export type PropKind =
  | 'crate' | 'ammo' | 'cage' | 'mystery' | 'barrel' | 'mine' | 'bus' | 'airdrop'
  | 'car' | 'barrier' | 'median' | 'fence' | 'spikes' | 'fire' | 'acid'
  | 'p_weapon' | 'p_ammo' | 'p_survivor' | 'p_medkit' | 'p_power';

export interface PropDef {
  w: number;
  h: number;
  /** 0 = cannot be destroyed by gunfire */
  hp: number;
  solid: boolean;
  blocksBullets: boolean;
  /** damage to a squad member on first contact */
  contactDmg: number;
  /** damage per second while standing inside (hazards) */
  dps?: number;
  /** collected on touch */
  pickup?: boolean;
  /** shows a hp bar & is a valid target for auto fire */
  target?: boolean;
}

export const PROPS: Record<PropKind, PropDef> = {
  crate: { w: 44, h: 40, hp: 110, solid: false, blocksBullets: true, contactDmg: 0, target: true },
  ammo: { w: 36, h: 30, hp: 45, solid: false, blocksBullets: true, contactDmg: 0, target: true },
  cage: { w: 46, h: 46, hp: 120, solid: false, blocksBullets: true, contactDmg: 0, target: true },
  mystery: { w: 40, h: 40, hp: 70, solid: false, blocksBullets: true, contactDmg: 0, target: true },
  barrel: { w: 26, h: 26, hp: 25, solid: false, blocksBullets: true, contactDmg: 0, target: true },
  mine: { w: 22, h: 22, hp: 10, solid: false, blocksBullets: false, contactDmg: 0 },
  bus: { w: 120, h: 64, hp: 650, solid: false, blocksBullets: true, contactDmg: 0, target: true },
  airdrop: { w: 50, h: 50, hp: 140, solid: false, blocksBullets: true, contactDmg: 0, target: true },
  car: { w: 56, h: 92, hp: 420, solid: true, blocksBullets: true, contactDmg: 18 },
  barrier: { w: 90, h: 24, hp: 0, solid: true, blocksBullets: true, contactDmg: 14 },
  median: { w: 28, h: 400, hp: 0, solid: true, blocksBullets: true, contactDmg: 0 },
  fence: { w: 100, h: 14, hp: 40, solid: true, blocksBullets: true, contactDmg: 8 },
  spikes: { w: 90, h: 26, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, dps: 30 },
  fire: { w: 70, h: 50, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, dps: 26 },
  acid: { w: 56, h: 56, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, dps: 22 },
  p_weapon: { w: 40, h: 40, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, pickup: true },
  p_ammo: { w: 34, h: 34, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, pickup: true },
  p_survivor: { w: 34, h: 34, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, pickup: true },
  p_medkit: { w: 32, h: 32, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, pickup: true },
  p_power: { w: 34, h: 34, hp: 0, solid: false, blocksBullets: false, contactDmg: 0, pickup: true },
};

export type PowerId = 'rapid' | 'fire' | 'shield' | 'multi' | 'strike';
export interface PowerDef { id: PowerId; name: string; dur: number; color: string; icon: string }
export const POWERS: Record<PowerId, PowerDef> = {
  rapid: { id: 'rapid', name: 'Скорострельность', dur: 8, color: '#ffd23f', icon: '»' },
  fire: { id: 'fire', name: 'Зажигательные', dur: 9, color: '#ff6b1a', icon: '♨' },
  shield: { id: 'shield', name: 'Щит', dur: 6, color: '#4cc9f0', icon: '◈' },
  multi: { id: 'multi', name: 'Мультивыстрел', dur: 8, color: '#b388ff', icon: '⋔' },
  strike: { id: 'strike', name: 'Удар с воздуха', dur: 0, color: '#ff4d4d', icon: '✈' },
};
export const TIMED_POWERS: PowerId[] = ['rapid', 'fire', 'shield', 'multi'];

export const BARREL_EXPLOSION = { r: 92, dmg: 85 };
export const MINE_EXPLOSION = { r: 70, dmg: 60 };
export const CAR_EXPLOSION = { r: 110, dmg: 90 };
export const MEDKIT_HEAL = 0.35;
export const AMMO_REFILL = 0.6;
