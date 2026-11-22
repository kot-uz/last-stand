export type ProjKind = 'bullet' | 'pellet' | 'rocket' | 'flame' | 'rail' | 'grenade' | 'snipe';

export interface WeaponDef {
  id: string;
  name: string;
  /** damage per projectile */
  dmg: number;
  /** shots per second */
  rate: number;
  /** projectile speed px/s */
  speed: number;
  /** total spread angle in radians (random for count=1, fan for count>1) */
  spread: number;
  /** projectiles per shot */
  count: number;
  /** extra targets a projectile passes through */
  pierce: number;
  /** max travel distance px */
  range: number;
  kind: ProjKind;
  /** explosion radius */
  aoe?: number;
  /** burn damage per second applied on hit */
  burn?: number;
  /** knockback impulse (px) */
  knock?: number;
  armorPierce?: boolean;
  /** 0 = infinite */
  ammo: number;
  color: string;
  sfx: string;
  /** rarity used by generators: 1 common .. 3 rare */
  tier: number;
}

const W = <T extends Record<string, WeaponDef>>(t: T) => t;

export const WEAPONS = W({
  pistol: { id: 'pistol', name: 'Пистолет', dmg: 12, rate: 4, speed: 950, spread: 0.03, count: 1, pierce: 0, range: 620, kind: 'bullet', ammo: 0, color: '#ffe08a', sfx: 'pistol', tier: 0 },
  smg: { id: 'smg', name: 'Пистолет-пулемёт', dmg: 8, rate: 11, speed: 1000, spread: 0.16, count: 1, pierce: 0, range: 560, kind: 'bullet', ammo: 260, color: '#ffd166', sfx: 'smg', tier: 1 },
  shotgun: { id: 'shotgun', name: 'Дробовик', dmg: 7, rate: 1.7, speed: 900, spread: 0.55, count: 7, pierce: 0, range: 330, kind: 'pellet', knock: 26, ammo: 45, color: '#ffb347', sfx: 'shotgun', tier: 1 },
  rifle: { id: 'rifle', name: 'Штурмовая винтовка', dmg: 15, rate: 8, speed: 1150, spread: 0.06, count: 1, pierce: 1, range: 680, kind: 'bullet', ammo: 200, color: '#fff3b0', sfx: 'rifle', tier: 2 },
  minigun: { id: 'minigun', name: 'Миниган', dmg: 9, rate: 24, speed: 1100, spread: 0.22, count: 1, pierce: 0, range: 600, kind: 'bullet', ammo: 550, color: '#ffe066', sfx: 'minigun', tier: 3 },
  launcher: { id: 'launcher', name: 'Гранатомёт', dmg: 70, rate: 1.2, speed: 620, spread: 0.02, count: 1, pierce: 0, range: 620, kind: 'rocket', aoe: 72, armorPierce: true, ammo: 16, color: '#ff8c42', sfx: 'launcher', tier: 2 },
  flamer: { id: 'flamer', name: 'Огнемёт', dmg: 5, rate: 30, speed: 430, spread: 0.38, count: 1, pierce: 99, range: 250, kind: 'flame', burn: 14, armorPierce: true, ammo: 420, color: '#ff6b1a', sfx: 'flamer', tier: 2 },
  railgun: { id: 'railgun', name: 'Рельсотрон', dmg: 160, rate: 0.8, speed: 0, spread: 0, count: 1, pierce: 999, range: 900, kind: 'rail', armorPierce: true, ammo: 12, color: '#7df9ff', sfx: 'railgun', tier: 3 },

  // ally weapons
  a_rifle: { id: 'a_rifle', name: 'Винтовка', dmg: 9, rate: 3, speed: 1000, spread: 0.08, count: 1, pierce: 0, range: 560, kind: 'bullet', ammo: 0, color: '#fff1c1', sfx: 'ally', tier: 0 },
  a_shotgun: { id: 'a_shotgun', name: 'Обрез', dmg: 6, rate: 1.3, speed: 850, spread: 0.5, count: 4, pierce: 0, range: 300, kind: 'pellet', knock: 18, ammo: 0, color: '#ffc38a', sfx: 'ally_sg', tier: 0 },
  a_sniper: { id: 'a_sniper', name: 'Снайперская', dmg: 45, rate: 0.7, speed: 1700, spread: 0, count: 1, pierce: 3, range: 900, kind: 'snipe', armorPierce: true, ammo: 0, color: '#c8f7ff', sfx: 'sniper', tier: 0 },
  a_pistol: { id: 'a_pistol', name: 'Пистолет', dmg: 6, rate: 2, speed: 900, spread: 0.06, count: 1, pierce: 0, range: 520, kind: 'bullet', ammo: 0, color: '#fff1c1', sfx: 'ally', tier: 0 },
  a_grenade: { id: 'a_grenade', name: 'Гранаты', dmg: 32, rate: 0.38, speed: 0, spread: 0, count: 1, pierce: 0, range: 520, kind: 'grenade', aoe: 58, armorPierce: true, ammo: 0, color: '#9bd36a', sfx: 'throw', tier: 0 },
});

export type WeaponId = keyof typeof WEAPONS;
export const LEADER_WEAPONS: WeaponId[] = ['smg', 'shotgun', 'rifle', 'minigun', 'launcher', 'flamer', 'railgun'];
