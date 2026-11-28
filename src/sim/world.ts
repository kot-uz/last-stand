import { ALLIES, RANK_BONUS, SQUAD_CAP, type AllyClassId } from '../config/allies';
import { BOSSES, ZOMBIES, ZOMBIE_INDEX, type BossKind, type ZombieDef, type ZombieType } from '../config/enemies';
import type { LevelDef } from '../config/levels';
import { PROPS, type PowerId, type PropDef, type PropKind } from '../config/props';
import type { Modifiers } from '../config/upgrades';
import { WEAPONS, type ProjKind, type WeaponDef, type WeaponId } from '../config/weapons';
import { Rng, SpatialGrid, clamp, dist2 } from '../core/util';

export const VIEW_W = 540;
export const VIEW_H = 960;
/** distance from the squad to the bottom edge of the view */
export const SQUAD_FROM_BOTTOM = 190;
export const ROAD_L = 34;
export const ROAD_R = VIEW_W - 34;
export const MEMBER_R = 11;

export interface SquadSave { cls: AllyClassId; rank: number }

export interface Member {
  id: number;
  cls: AllyClassId;
  x: number; y: number;
  hp: number; maxHp: number;
  rank: number;
  cd: number;
  iframe: number;
  hurt: number;
  recoil: number;
  anim: number;
  hitProps: number[];
  aimX: number; aimY: number;
  /** join animation 1 → 0 */
  join: number;
}

export interface Zombie {
  id: number;
  def: ZombieDef;
  ti: number;
  look: number;
  x: number; y: number;
  vx: number;
  kx: number; ky: number;
  hp: number; maxHp: number;
  r: number;
  flash: number;
  burn: number;
  burnDps: number;
  buff: number;
  stagger: number;
  anim: number;
  state: number;
  timer: number;
  count: number;
  holdY: number;
  dead: boolean;
}

export interface Bullet {
  x: number; y: number; vx: number; vy: number;
  dmg: number; pierce: number; life: number; r: number;
  kind: ProjKind; aoe: number; burn: number; knock: number; ap: boolean;
  hits: number[];
  color: string;
  // lob (grenade)
  sx: number; sy: number; tx: number; ty: number; t: number; dur: number;
  dead: boolean;
}

export interface Prop {
  id: number;
  kind: PropKind;
  def: PropDef;
  x: number; y: number; w: number; h: number;
  hp: number; maxHp: number;
  payload: string;
  dead: boolean;
  flash: number;
  t: number;
  fuse: number;
  /** remaining lifetime, -1 = forever */
  life: number;
  /** airdrop fall timer */
  fall: number;
  variant: number;
}

export interface Coin { x: number; y: number; vx: number; vy: number; v: number; t: number; magnet: boolean; dead: boolean; rush?: boolean }

export interface EShot {
  kind: 'acid' | 'car' | 'egg';
  sx: number; sy: number; tx: number; ty: number; t: number; dur: number; dead: boolean;
  strike?: boolean;
}

export interface Wave {
  kind: 'shock' | 'ring';
  x: number; y: number; r: number; speed: number;
  gap: number; gapW: number; dmg: number;
  hit: number[]; dead: boolean;
}

export interface Boss {
  kind: BossKind;
  name: string;
  x: number; y: number;
  hp: number; maxHp: number; r: number;
  state: string;
  t: number;
  phase: number;
  flash: number;
  anim: number;
  aimX: number;
  cycle: number;
  alpha: number;
  dead: boolean;
  entered: boolean;
}

export interface Fx { k: string; x: number; y: number; a?: number; b?: number; c?: string; s?: string }

export interface Trigger { y: number; kind: string; data: any; done: boolean }

export interface Narrow { y0: number; y1: number; width: number }

export interface Stats {
  kills: number;
  coins: number;
  rescued: number;
  available: number;
  lost: number;
  startSize: number;
  time: number;
  bossKilled: boolean;
  peakZombies: number;
}

export interface LeaderWeapon { def: WeaponDef; ammo: number; maxAmmo: number; lvl: number }

let nextId = 1;
export const newId = () => nextId++;

export class World {
  level: LevelDef;
  mods: Modifiers;
  rng: Rng;
  fxRng = new Rng(7);
  time = 0;
  squadY = 0;
  scroll: number;
  targetX = VIEW_W / 2;
  squad: Member[] = [];
  weapon: LeaderWeapon;
  zombies: Zombie[] = [];
  bullets: Bullet[] = [];
  props: Prop[] = [];
  coins: Coin[] = [];
  /** post-boss auto-collect: started flag and value gathered but not yet announced */
  coinRush = false;
  rushValue = 0;
  shots: EShot[] = [];
  waves: Wave[] = [];
  boss: Boss | null = null;
  bossPhase = false;
  powers: Record<PowerId, number> = { rapid: 0, fire: 0, shield: 0, multi: 0, strike: 0 };
  narrows: Narrow[] = [];
  triggers: Trigger[] = [];
  state: 'playing' | 'won' | 'lost' = 'playing';
  endT = 0;
  fx: Fx[] = [];
  sfx: string[] = [];
  banners: { text: string; sub?: string; color?: string; big?: boolean }[] = [];
  stats: Stats;
  grid: SpatialGrid;
  slowmo = 0;
  hitstop = 0;
  spawnAcc: Record<string, number> = {};
  genY = 0;
  reserved: [number, number][] = [];
  slotsDirty = true;
  slots: { x: number; y: number }[] = [];
  /** demo mode for title screen: no fail state */
  demo = false;

  constructor(level: LevelDef, mods: Modifiers, squad: SquadSave[]) {
    this.level = level;
    this.mods = mods;
    this.rng = new Rng(level.seed);
    this.scroll = level.speed;
    this.grid = new SpatialGrid(VIEW_W + 200, 1300 + 900, 48, 2048);
    this.weapon = { def: WEAPONS.pistol, ammo: 0, maxAmmo: 0, lvl: 1 };
    this.addMember('commander', 0, true);
    for (const s of squad) this.addMember(s.cls, s.rank, true);
    this.stats = { kills: 0, coins: 0, rescued: 0, available: 0, lost: 0, startSize: this.squad.length, time: 0, bossKilled: false, peakZombies: 0 };
  }

  /** visible height in logical px (540 wide); set by the app from the screen aspect */
  viewH = VIEW_H;
  get camTop() { return this.squadY - this.viewH + SQUAD_FROM_BOTTOM; }
  get camBottom() { return this.squadY + SQUAD_FROM_BOTTOM; }
  get dist() { return -this.squadY; }
  get progress() { return this.level.endless ? 0 : clamp(this.dist / this.level.length, 0, 1); }
  get leader(): Member | undefined { return this.squad[0]; }

  emit(k: string, x: number, y: number, a?: number, b?: number, c?: string, s?: string) {
    this.fx.push({ k, x, y, a, b, c, s });
  }
  sound(id: string) { this.sfx.push(id); }
  banner(text: string, sub?: string, color?: string, big = false) { this.banners.push({ text, sub, color, big }); }

  roadBounds(y: number): [number, number] {
    let l = ROAD_L, r = ROAD_R;
    for (const n of this.narrows) {
      if (y > n.y0 + 160 || y < n.y1 - 160) continue;
      // ramp in/out over 160px
      let k = 1;
      if (y > n.y0) k = 1 - (y - n.y0) / 160;
      else if (y < n.y1) k = 1 - (n.y1 - y) / 160;
      const half = (VIEW_W / 2 - n.width / 2) * clamp(k, 0, 1);
      l = Math.max(l, ROAD_L + half * 0.98);
      r = Math.min(r, ROAD_R - half * 0.98);
    }
    return [l, r];
  }

  // ─────────── squad ───────────
  memberMaxHp(cls: AllyClassId, rank: number) {
    return Math.round(ALLIES[cls].hp * this.mods.hpMul * (1 + rank * RANK_BONUS));
  }

  addMember(cls: AllyClassId, rank: number, initial = false): Member | null {
    if (this.squad.length >= SQUAD_CAP + 1) return null;
    const maxHp = this.memberMaxHp(cls, rank);
    const l = this.leader;
    const m: Member = {
      id: newId(), cls, x: l ? l.x : VIEW_W / 2, y: l ? l.y + 30 : this.squadY, hp: maxHp, maxHp, rank,
      cd: Math.random() * 0.5, iframe: 0, hurt: 0, recoil: 0, anim: Math.random() * 10, hitProps: [], aimX: 0, aimY: -1,
      join: initial ? 0 : 1,
    };
    this.squad.push(m);
    this.slotsDirty = true;
    return m;
  }

  hurtMember(m: Member, dmg: number, ignoreIframe = false): boolean {
    if (this.state !== 'playing' || this.demo && m === this.leader && m.hp < dmg + 5) return false;
    if (this.powers.shield > 0) {
      this.emit('shieldhit', m.x, m.y);
      return false;
    }
    if (m.iframe > 0 && !ignoreIframe) return false;
    m.hp -= dmg;
    m.iframe = 0.28;
    m.hurt = 0.25;
    this.emit('hurt', m.x, m.y, dmg);
    this.sound('hurt');
    if (m.hp <= 0) this.killMember(m);
    return true;
  }

  killMember(m: Member) {
    const i = this.squad.indexOf(m);
    if (i < 0) return;
    this.squad.splice(i, 1);
    this.slotsDirty = true;
    this.stats.lost++;
    this.emit('mdeath', m.x, m.y, 0, 0, ALLIES[m.cls].colors.body);
    this.sound('mdeath');
    this.emit('shake', 0, 0, 7);
    if (i === 0 && this.squad.length) {
      this.emit('text', this.squad[0].x, this.squad[0].y - 30, 18, 0, '#ffb627', 'Новый лидер!');
    }
    if (this.squad.length === 0 && this.state === 'playing') {
      this.state = 'lost';
      this.endT = 0;
      this.sound('defeat');
    }
  }

  // ─────────── zombies ───────────
  spawnZombie(type: ZombieType, x: number, y: number): Zombie {
    const def = ZOMBIES[type];
    const hpScale = this.level.endless ? 1 + this.dist / 9000 : 1;
    const z: Zombie = {
      id: newId(), def, ti: ZOMBIE_INDEX[type], look: Math.floor(this.rng.next() * def.looks.length),
      x, y, vx: 0, kx: 0, ky: 0, hp: def.hp * hpScale, maxHp: def.hp * hpScale, r: def.r,
      flash: 0, burn: 0, burnDps: 0, buff: 0, stagger: 0, anim: this.rng.next() * 10,
      state: 0, timer: 1 + this.rng.next() * 1.5, count: 0, holdY: 180 + this.rng.next() * 120, dead: false,
    };
    this.zombies.push(z);
    return z;
  }

  damageZombie(z: Zombie, dmg: number, ap: boolean, burn = 0, knock = 0, kx = 0): boolean {
    if (z.dead) return false;
    if (z.def.armor && !ap) {
      dmg *= 1 - z.def.armor;
      this.emit('spark', z.x, z.y + z.r * 0.6);
    }
    z.hp -= dmg;
    z.flash = 0.08;
    if (burn > 0) { z.burn = 2.5; z.burnDps = Math.max(z.burnDps, burn); }
    if (knock > 0) { z.ky -= knock * z.def.knockMul * 10; z.kx += kx * z.def.knockMul; }
    if (z.hp <= 0) { this.killZombie(z, true); return true; }
    return false;
  }

  killZombie(z: Zombie, reward: boolean) {
    if (z.dead) return;
    z.dead = true;
    this.stats.kills++;
    this.emit('zdeath', z.x, z.y, z.ti, z.look, undefined, z.burn > 0 ? 'burn' : undefined);
    this.sound(z.def.r > 16 ? 'zdeath_big' : 'zdeath');
    if (z.def.r > 20) { this.emit('shake', 0, 0, 4); this.hitstop = Math.max(this.hitstop, 0.04); }
    if (reward && this.rng.next() < z.def.coinChance) this.dropCoins(z.x, z.y, z.def.coin);
    if (z.def.explodeOnDeath) {
      const e = z.def.explodeOnDeath;
      this.explode(z.x, z.y, e.r, e.dmg, { squad: true, kind: 'gas' });
    }
  }

  dropCoins(x: number, y: number, value: number, maxCoins = 5, spread = 1) {
    const v = value * (1 + this.mods.luck * 0.06);
    const n = Math.min(maxCoins, Math.max(1, Math.round(value / 2)));
    for (let i = 0; i < n; i++) {
      const a = this.fxRng.next() * Math.PI * 2;
      const s = (40 + this.fxRng.next() * 80) * spread;
      this.coins.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, v: v / n, t: 0, magnet: false, dead: false });
    }
  }

  // ─────────── explosions ───────────
  explode(x: number, y: number, r: number, dmg: number, o: { squad?: boolean; kind?: string; noProps?: boolean } = {}) {
    this.emit('explosion', x, y, r, 0, undefined, o.kind ?? 'fire');
    this.emit('shake', 0, 0, Math.min(14, r / 9));
    this.sound(o.kind === 'gas' ? 'gas' : 'explosion');
    const rr = r * r;
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d2 = dist2(x, y, z.x, z.y);
      if (d2 > (r + z.r) * (r + z.r)) continue;
      const d = Math.sqrt(d2);
      const k = 1 - 0.45 * Math.min(1, d / r);
      const nx = d > 0.01 ? (z.x - x) / d : 0, ny = d > 0.01 ? (z.y - y) / d : -1;
      z.kx += nx * 220 * z.def.knockMul;
      z.ky += ny * 220 * z.def.knockMul;
      this.damageZombie(z, dmg * k, true, o.kind === 'fire' ? 8 : 0);
    }
    if (!o.noProps) {
      for (const p of this.props) {
        if (p.dead) continue;
        if (Math.abs(p.x - x) > r + p.w / 2 || Math.abs(p.y - y) > r + p.h / 2) continue;
        if (p.kind === 'barrel' || p.kind === 'mine') { if (p.fuse <= 0) p.fuse = 0.12 + this.fxRng.next() * 0.08; }
        else if (p.def.hp > 0 && !p.def.pickup) this.damageProp(p, dmg * 0.8);
      }
    }
    if (o.squad) {
      for (let i = this.squad.length - 1; i >= 0; i--) {
        const m = this.squad[i];
        if (dist2(x, y, m.x, m.y) < rr) this.hurtMember(m, dmg * 0.55, true);
      }
    }
    const b = this.boss;
    if (b && !b.dead && dist2(x, y, b.x, b.y) < (r + b.r) * (r + b.r)) this.damageBoss(dmg);
  }

  damageBoss(dmg: number) {
    const b = this.boss;
    if (!b || b.dead || !b.entered) return;
    b.hp -= dmg;
    b.flash = 0.06;
    if (b.hp <= 0) {
      b.hp = 0;
      b.dead = true;
      this.stats.bossKilled = true;
      this.emit('bossdeath', b.x, b.y, b.r);
      this.emit('shake', 0, 0, 20);
      this.sound('bossdeath');
      this.slowmo = 1.6;
      this.dropCoins(b.x, b.y, 120, 40, 4);
      for (const z of this.zombies) if (!z.dead) this.killZombie(z, true);
      this.win();
    }
  }

  // ─────────── props ───────────
  addProp(kind: PropKind, x: number, y: number, payload = '', extra: Partial<Prop> = {}): Prop {
    const def = PROPS[kind];
    const p: Prop = {
      id: newId(), kind, def, x, y, w: def.w, h: def.h, hp: def.hp, maxHp: def.hp, payload,
      dead: false, flash: 0, t: 0, fuse: 0, life: -1, fall: 0, variant: Math.floor(this.rng.next() * 4), ...extra,
    };
    if (extra.hp !== undefined) p.maxHp = extra.hp;
    this.props.push(p);
    return p;
  }

  damageProp(p: Prop, dmg: number) {
    if (p.dead || p.hp <= 0 && p.def.hp > 0) return;
    if (p.def.hp <= 0) return;
    if (p.fall > 0) return;
    p.hp -= dmg;
    p.flash = 0.06;
    if (p.hp <= 0) this.breakProp(p);
  }

  breakProp(p: Prop) {
    if (p.dead) return;
    p.dead = true;
    const { x, y } = p;
    switch (p.kind) {
      case 'crate':
      case 'airdrop':
        this.emit('break', x, y, 0, 0, '#a0703c');
        this.sound('crate');
        this.addProp('p_weapon', x, y, p.payload, { t: 0 });
        break;
      case 'ammo':
        this.emit('break', x, y, 0, 0, '#6b8f3c');
        this.sound('crate');
        this.addProp('p_ammo', x, y);
        break;
      case 'cage':
        this.emit('break', x, y, 0, 0, '#9aa0a6');
        this.sound('cage');
        this.addProp('p_survivor', x, y, p.payload);
        break;
      case 'bus': {
        this.emit('break', x, y, 1, 0, '#f2b134');
        this.sound('cage');
        const list = p.payload.split(',');
        list.forEach((c, i) => this.addProp('p_survivor', x - 40 + i * 40, y + 10, c));
        break;
      }
      case 'mystery':
        this.emit('break', x, y, 0, 0, '#7a5cff');
        this.sound('crate');
        this.openMystery(p);
        break;
      case 'barrel':
        this.explode(x, y, 92, 85, { squad: true });
        break;
      case 'mine':
        this.explode(x, y, 70, 60, { squad: true });
        break;
      case 'car':
        this.explode(x, y, 110, 90, { squad: true });
        this.emit('wreck', x, y, p.variant);
        break;
      case 'fence':
        this.emit('break', x, y, 0, 0, '#c9a46b');
        this.sound('wood');
        break;
    }
  }

  openMystery(p: Prop) {
    const good = 0.62 + this.mods.luck * 0.04;
    const r = this.rng.next();
    if (r < good) {
      const roll = this.rng.next();
      if (roll < 0.3) {
        const pool = this.level.weapons.filter(w => WEAPONS[w].tier >= 2);
        this.addProp('p_weapon', p.x, p.y, this.rng.pick(pool.length ? pool : this.level.weapons));
      } else if (roll < 0.55) {
        this.addProp('p_power', p.x, p.y, this.rng.pick(['rapid', 'multi', 'shield', 'fire', 'strike'] as PowerId[]));
      } else if (roll < 0.75) {
        this.addProp('p_survivor', p.x, p.y, this.rng.pick(this.level.allies));
        this.stats.available++;
      } else {
        this.dropCoins(p.x, p.y, 30);
        this.emit('text', p.x, p.y - 20, 20, 0, '#ffd166', 'Джекпот!');
      }
      this.sound('good');
    } else {
      this.emit('text', p.x, p.y - 20, 22, 0, '#ff4d4d', 'ЗАСАДА!');
      this.sound('ambush');
      const n = 6 + Math.floor(this.rng.next() * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnZombie('runner', p.x + Math.cos(a) * 50, p.y + Math.sin(a) * 30 - 20);
      }
    }
  }

  // ─────────── pickups & powers ───────────
  giveWeapon(id: WeaponId) {
    const def = WEAPONS[id];
    const max = Math.round(def.ammo * this.mods.ammoMul);
    if (this.weapon.def.id === id) {
      this.weapon.lvl = Math.min(3, this.weapon.lvl + 1);
      this.weapon.maxAmmo = max;
      this.weapon.ammo = Math.min(max, this.weapon.ammo + Math.round(max * 0.7));
      this.banner(`${def.name} ${'I'.repeat(this.weapon.lvl)}`, 'Усилено! +15% урона', '#ffb627');
    } else {
      this.weapon = { def, ammo: max, maxAmmo: max, lvl: 1 };
      this.banner(def.name, 'Новое оружие', '#ffb627');
    }
  }

  activatePower(id: PowerId) {
    if (id === 'strike') {
      this.banner('УДАР С ВОЗДУХА', undefined, '#ff4d4d');
      this.sound('strike');
      for (let i = 0; i < 7; i++) {
        const x = 70 + i * 67 + (this.fxRng.next() - 0.5) * 30;
        const y = this.camTop + 120 + this.fxRng.next() * 420;
        this.shots.push({ kind: 'car', sx: x, sy: y - 900, tx: x, ty: y, t: -i * 0.08, dur: 0.55, dead: false, strike: true });
      }
      return;
    }
    const dur = { rapid: 8, fire: 9, shield: 6, multi: 8 }[id];
    this.powers[id] = dur;
  }

  win() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.endT = 0;
    this.sound('victory');
  }

  /** visible list of all things auto-fire could target */
  hasTargetNear(x: number, y: number, range: number, halfW: number): boolean {
    const top = Math.max(y - range, this.camTop - 10);
    for (const z of this.zombies) {
      if (!z.dead && z.y < y && z.y > top && Math.abs(z.x - x) < halfW + z.r) return true;
    }
    for (const p of this.props) {
      if (!p.dead && p.def.target && p.fall <= 0 && p.y < y && p.y > top && Math.abs(p.x - x) < halfW + p.w / 2) return true;
    }
    const b = this.boss;
    if (b && !b.dead && b.entered && b.y < y && Math.abs(b.x - x) < halfW + b.r + 60) return true;
    return false;
  }
}

export function bossDef(kind: BossKind) { return BOSSES[kind]; }
