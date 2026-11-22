export type UpgradeId = 'caliber' | 'trigger' | 'pouch' | 'armor' | 'drill' | 'barracks' | 'magnet' | 'medic' | 'luck';

export interface UpgradeDef {
  id: UpgradeId;
  tab: 'arsenal' | 'squad';
  name: string;
  icon: string;
  max: number;
  base: number;
  desc: (lvl: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'caliber', tab: 'arsenal', name: 'Калибр', icon: '◉', max: 10, base: 35, desc: l => `Урон оружия лидера +${l * 12}%` },
  { id: 'trigger', tab: 'arsenal', name: 'Спусковой крючок', icon: '⟫', max: 8, base: 40, desc: l => `Темп стрельбы лидера +${l * 8}%` },
  { id: 'pouch', tab: 'arsenal', name: 'Подсумок', icon: '▤', max: 6, base: 45, desc: l => `Боезапас найденного оружия +${l * 20}%` },
  { id: 'luck', tab: 'arsenal', name: 'Удача', icon: '♣', max: 5, base: 60, desc: l => `+${l * 6}% монет, ящики «?» щедрее` },
  { id: 'magnet', tab: 'arsenal', name: 'Магнит', icon: '⊛', max: 5, base: 30, desc: l => `Радиус подбора монет +${l * 25}%` },
  { id: 'armor', tab: 'squad', name: 'Бронежилеты', icon: '⛨', max: 8, base: 40, desc: l => `HP всех бойцов +${l * 12}%` },
  { id: 'drill', tab: 'squad', name: 'Муштра', icon: '✦', max: 8, base: 45, desc: l => `Урон союзников +${l * 10}%` },
  { id: 'barracks', tab: 'squad', name: 'Казарма', icon: '⌂', max: 6, base: 70, desc: l => `Переносимых бойцов: ${3 + l}` },
  { id: 'medic', tab: 'squad', name: 'Полевая медицина', icon: '✚', max: 5, base: 55, desc: l => `Регенерация ${(l * 0.6).toFixed(1)} HP/с` },
];

export const upgradeCost = (def: UpgradeDef, lvl: number) => Math.round(def.base * Math.pow(1.5, lvl));

export interface Modifiers {
  leaderDmg: number;
  leaderRate: number;
  ammoMul: number;
  hpMul: number;
  allyDmg: number;
  magnet: number;
  regen: number;
  luck: number;
  barracks: number;
}

export function modifiersFrom(levels: Partial<Record<UpgradeId, number>>): Modifiers {
  const l = (id: UpgradeId) => levels[id] ?? 0;
  return {
    leaderDmg: 1 + l('caliber') * 0.12,
    leaderRate: 1 + l('trigger') * 0.08,
    ammoMul: 1 + l('pouch') * 0.2,
    hpMul: 1 + l('armor') * 0.12,
    allyDmg: 1 + l('drill') * 0.1,
    magnet: 1 + l('magnet') * 0.25,
    regen: l('medic') * 0.6,
    luck: l('luck'),
    barracks: 3 + l('barracks'),
  };
}
