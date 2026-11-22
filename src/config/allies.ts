import type { WeaponId } from './weapons';

export type AllyClassId = 'commander' | 'rifleman' | 'gunner' | 'sniper' | 'medic' | 'demo';

export interface AllyClass {
  id: AllyClassId;
  name: string;
  hp: number;
  weapon: WeaponId;
  /** jacket / accent / helmet colors */
  colors: { body: string; accent: string; head: string; hair: string };
  desc: string;
  icon: string;
}

export const ALLIES: Record<AllyClassId, AllyClass> = {
  commander: { id: 'commander', name: 'Командир', hp: 100, weapon: 'pistol', colors: { body: '#2ec4b6', accent: '#ff9f1c', head: '#f2c9a0', hair: '#3b2a20' }, desc: 'Лидер отряда. Подбирает оружие.', icon: '★' },
  rifleman: { id: 'rifleman', name: 'Стрелок', hp: 60, weapon: 'a_rifle', colors: { body: '#4f7cac', accent: '#c0d6df', head: '#e8b98f', hair: '#2b2b2b' }, desc: 'Надёжный огонь на средней дистанции.', icon: '⌖' },
  gunner: { id: 'gunner', name: 'Штурмовик', hp: 78, weapon: 'a_shotgun', colors: { body: '#a0522d', accent: '#ffcb77', head: '#c68e6a', hair: '#1d1d1d' }, desc: 'Обрез: мощный, но ближний веер. Крепкий.', icon: '✸' },
  sniper: { id: 'sniper', name: 'Снайпер', hp: 50, weapon: 'a_sniper', colors: { body: '#556b2f', accent: '#d4e09b', head: '#f0d0b0', hair: '#8b5a2b' }, desc: 'Сам выбирает самую живучую цель, пробивает 3 врагов и броню.', icon: '◎' },
  medic: { id: 'medic', name: 'Медик', hp: 55, weapon: 'a_pistol', colors: { body: '#f4f1de', accent: '#e63946', head: '#e0ac8a', hair: '#c97c3d' }, desc: 'Постоянно лечит самого раненого бойца.', icon: '✚' },
  demo: { id: 'demo', name: 'Подрывник', hp: 62, weapon: 'a_grenade', colors: { body: '#6d597a', accent: '#b5e48c', head: '#d9a47a', hair: '#222' }, desc: 'Бросает гранаты в самую плотную толпу.', icon: '✹' },
};

export const RECRUITABLE: AllyClassId[] = ['rifleman', 'gunner', 'sniper', 'medic', 'demo'];
export const RANK_BONUS = 0.15;
export const MAX_RANK = 3;
export const SQUAD_CAP = 24;
export const MEDIC_HEAL = 5;
