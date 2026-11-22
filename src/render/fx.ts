import { ZOMBIE_LIST } from '../config/enemies';
import { Rng } from '../core/util';
import type { Fx, World } from '../sim/world';
import { greenSplats, scorch, splats, zombieSet, type Sprite } from './sprites';

export const enum PK { Dot, Spark, Smoke, Glow, Ring, Gib, Shell, Flame, Star, Coin }

export interface Particle {
  k: PK; x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; grow: number;
  color: string; drag: number; grav: number; rot: number; vr: number;
}

export interface Decal { x: number; y: number; s: Sprite; rot: number; a: number; scale: number }
export interface FloatText { x: number; y: number; text: string; color: string; size: number; life: number; max: number }
export interface Light { x: number; y: number; r: number; life: number; max: number; color: string }

const MAX_P = 1400;
const MAX_DECALS = 320;

export class Effects {
  parts: Particle[] = [];
  pool: Particle[] = [];
  decals: Decal[] = [];
  texts: FloatText[] = [];
  lights: Light[] = [];
  beams: { x: number; y0: number; y1: number; life: number }[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#fff';
  hurt = 0;
  hints: { text: string; life: number }[] = [];
  rng = new Rng(1234);
  lowQuality = false;

  reset() {
    this.pool.push(...this.parts);
    this.parts.length = 0;
    this.decals.length = 0;
    this.texts.length = 0;
    this.lights.length = 0;
    this.beams.length = 0;
    this.shake = 0;
    this.flash = 0;
    this.hurt = 0;
    this.hints.length = 0;
  }

  p(k: PK, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, o: Partial<Particle> = {}) {
    if (this.parts.length >= (this.lowQuality ? MAX_P / 2 : MAX_P)) return;
    const q = this.pool.pop() ?? ({} as Particle);
    q.k = k; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.life = life; q.max = life; q.size = size; q.color = color;
    q.grow = 0; q.drag = 2; q.grav = 0; q.rot = 0; q.vr = 0;
    Object.assign(q, o);
    this.parts.push(q);
  }

  burst(k: PK, x: number, y: number, n: number, speed: number, life: number, size: number, color: string, o: Partial<Particle> = {}) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r.next() * Math.PI * 2, s = speed * (0.3 + r.next() * 0.7);
      this.p(k, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + r.next() * 0.6), size * (0.6 + r.next() * 0.7), color, { rot: r.next() * 6, vr: (r.next() - 0.5) * 12, ...o });
    }
  }

  decal(x: number, y: number, s: Sprite, scale = 1, a = 1) {
    if (this.decals.length >= MAX_DECALS) this.decals.shift();
    this.decals.push({ x, y, s, rot: this.rng.next() * Math.PI * 2, a, scale });
  }

  light(x: number, y: number, r: number, life: number, color = 'rgba(255,200,120,1)') {
    if (this.lights.length > 60) return;
    this.lights.push({ x, y, r, life, max: life, color });
  }

  text(x: number, y: number, text: string, color: string, size = 18) {
    this.texts.push({ x, y, text, color, size, life: 1.1, max: 1.1 });
  }

  /** translate simulation events into visuals */
  consume(w: World) {
    for (const e of w.fx) this.handle(e, w);
    w.fx.length = 0;
  }

  private handle(e: Fx, w: World) {
    const r = this.rng;
    switch (e.k) {
      case 'muzzle': {
        const big = e.a === 1;
        this.p(PK.Glow, e.x, e.y - 4, 0, -w.scroll, 0.06, big ? 11 : 7, e.c ?? '#ffd166');
        if (e.s !== 'flame') {
          this.p(PK.Shell, e.x + 4, e.y + 8, 60 + r.next() * 50, 20 + r.next() * 30, 0.35, 2, '#d4a74a', { drag: 4, vr: 20 });
          if (big) this.light(e.x, e.y - 10, 60, 0.06);
        }
        break;
      }
      case 'hit': {
        const col = e.c ?? '#8fb573';
        this.p(PK.Spark, e.x, e.y, (r.next() - 0.5) * 160, -60 - r.next() * 80, 0.14, 2, '#fff2b3', { drag: 6 });
        if (e.a !== -1) this.burst(PK.Dot, e.x, e.y, 2, 90, 0.3, 2.2, r.chance(0.5) ? '#8e1b1b' : col, { drag: 5 });
        else this.burst(PK.Dot, e.x, e.y, 2, 120, 0.3, 2.5, '#9b1d1d', { drag: 5 });
        break;
      }
      case 'zdeath': {
        const def = ZOMBIE_LIST[e.a!];
        const set = zombieSet(e.a!, e.b!);
        const green = def.id === 'bloater' || def.id === 'spitter';
        this.decal(e.x, e.y, set.corpse, 1, 0.95);
        this.decal(e.x + (r.next() - 0.5) * 10, e.y + (r.next() - 0.5) * 10, (green ? greenSplats : splats)[r.int(0, (green ? greenSplats : splats).length - 1)], def.r / 11);
        const look = def.looks[e.b!];
        this.burst(PK.Gib, e.x, e.y, 4 + Math.round(def.r / 4), 160, 0.55, 3.2, look.skin, { drag: 4 });
        this.burst(PK.Dot, e.x, e.y, 7, 150, 0.4, 2.6, green ? '#9bd23a' : '#8e1b1b', { drag: 5 });
        if (e.s === 'burn') this.burst(PK.Smoke, e.x, e.y, 3, 30, 0.8, 9, 'rgba(40,30,30,0.5)', { grow: 10, drag: 1 });
        break;
      }
      case 'bite':
        this.burst(PK.Dot, e.x, e.y, 6, 120, 0.35, 2.4, '#c0392b', { drag: 5 });
        this.decal(e.x, e.y, splats[r.int(0, splats.length - 1)], 0.6, 0.7);
        break;
      case 'bash':
        this.p(PK.Ring, e.x, e.y, 0, 0, 0.25, 6, '#ffffff', { grow: 80 });
        break;
      case 'hurt':
        this.hurt = Math.min(1, this.hurt + 0.35);
        this.burst(PK.Dot, e.x, e.y, 4, 100, 0.35, 2.4, '#d62828', { drag: 5 });
        if ((e.a ?? 0) >= 8) this.text(e.x + (r.next() - 0.5) * 16, e.y - 18, '-' + Math.round(e.a!), '#ff5a5a', 14);
        break;
      case 'mdeath':
        this.burst(PK.Dot, e.x, e.y, 16, 200, 0.6, 3, '#b3121f', { drag: 4 });
        this.burst(PK.Gib, e.x, e.y, 6, 180, 0.6, 3.5, e.c ?? '#2ec4b6', { drag: 4 });
        this.decal(e.x, e.y, splats[r.int(0, splats.length - 1)], 1.3);
        this.p(PK.Ring, e.x, e.y, 0, 0, 0.4, 8, '#ff3b3b', { grow: 90 });
        break;
      case 'explosion': {
        const R = e.a ?? 80;
        const gas = e.s === 'gas';
        const frag = e.s === 'frag';
        const core = gas ? '#c6ff3a' : '#ffe08a';
        this.p(PK.Glow, e.x, e.y, 0, 0, 0.22, R * 0.9, core);
        this.p(PK.Ring, e.x, e.y, 0, 0, 0.35, R * 0.3, gas ? '#b6ff5a' : '#fff1c9', { grow: R * 2.2 });
        this.burst(PK.Flame, e.x, e.y, frag ? 8 : 16, R * 3, 0.5, R * 0.22, gas ? '#8bd43a' : '#ff8c42', { drag: 5, grow: R * 0.3 });
        this.burst(PK.Smoke, e.x, e.y, frag ? 4 : 9, R * 1.2, 1.3, R * 0.2, gas ? 'rgba(120,170,40,0.45)' : 'rgba(45,40,40,0.55)', { drag: 2.5, grow: R * 0.5 });
        this.burst(PK.Spark, e.x, e.y, frag ? 8 : 14, R * 6, 0.35, 2, '#ffd166', { drag: 3 });
        this.decal(e.x, e.y, gas ? greenSplats[0] : scorch[r.int(0, 2)], gas ? R / 22 : R / 50, 0.9);
        this.light(e.x, e.y, R * 2.4, 0.35, gas ? 'rgba(170,255,80,1)' : 'rgba(255,170,80,1)');
        this.flash = Math.max(this.flash, gas ? 0.05 : 0.1);
        this.flashColor = gas ? '#c6ff3a' : '#ffd9a0';
        break;
      }
      case 'shake': this.shake = Math.min(22, Math.max(this.shake, e.a ?? 5)); break;
      case 'spark': this.p(PK.Spark, e.x, e.y, (r.next() - 0.5) * 220, -r.next() * 160, 0.16, 2, '#cfe8ff', { drag: 5 }); break;
      case 'chip': this.burst(PK.Gib, e.x, e.y, 2, 120, 0.35, 2.2, e.c ?? '#b98a4e', { drag: 5 }); break;
      case 'break': {
        const big = e.a === 1;
        this.burst(PK.Gib, e.x, e.y, big ? 26 : 14, big ? 260 : 200, 0.7, big ? 4.5 : 3.5, e.c ?? '#a0703c', { drag: 3.5 });
        this.p(PK.Ring, e.x, e.y, 0, 0, 0.3, 10, '#fff', { grow: 160 });
        this.burst(PK.Smoke, e.x, e.y, 5, 60, 0.7, 10, 'rgba(200,190,170,0.4)', { grow: 18, drag: 2 });
        break;
      }
      case 'wreck': this.decal(e.x, e.y, scorch[0], 1.4, 1); break;
      case 'pickup':
        this.p(PK.Ring, e.x, e.y, 0, 0, 0.35, 10, '#ffffff', { grow: 120 });
        this.burst(PK.Star, e.x, e.y, 10, 180, 0.6, 4, '#ffe066', { drag: 3 });
        this.light(e.x, e.y, 90, 0.3, 'rgba(255,240,180,1)');
        break;
      case 'coin': this.burst(PK.Star, e.x, e.y - 6, 1, 50, 0.3, 2.5, '#ffd166', { drag: 3 }); break;
      case 'heal': this.p(PK.Star, e.x + (r.next() - 0.5) * 16, e.y - 6, 0, -50 - w.scroll, 0.6, 3.5, '#63e6be', { drag: 1 }); break;
      case 'shieldhit': this.p(PK.Ring, e.x, e.y, 0, -w.scroll, 0.2, 14, '#4cc9f0', { grow: 30 }); break;
      case 'text': this.text(e.x, e.y, e.s ?? '', e.c ?? '#fff', e.a ?? 18); break;
      case 'beam':
        this.beams.push({ x: e.x, y0: e.y, y1: e.a!, life: 0.2 });
        this.burst(PK.Spark, e.x, e.y - 20, 6, 200, 0.2, 2, '#c8fbff', { drag: 4 });
        this.light(e.x, (e.y + e.a!) / 2, 220, 0.18, 'rgba(125,249,255,1)');
        break;
      case 'ember': this.p(PK.Flame, e.x + (r.next() - 0.5) * 12, e.y, (r.next() - 0.5) * 20, -40, 0.35, 4, '#ff8c42', { grow: -6, drag: 1 }); break;
      case 'scream':
        for (let i = 0; i < 3; i++) this.p(PK.Ring, e.x, e.y, 0, 0, 0.5 + i * 0.15, 10, '#ff5cf0', { grow: (e.a ?? 230) * 2 });
        break;
      case 'spit': this.burst(PK.Dot, e.x, e.y + 6, 5, 70, 0.3, 2.5, '#b6ff3a', { drag: 4 }); break;
      case 'splash':
        this.burst(PK.Dot, e.x, e.y, 12, 160, 0.4, 3, e.a === 1 ? '#c084fc' : '#a6f53a', { drag: 5 });
        this.p(PK.Ring, e.x, e.y, 0, 0, 0.25, 6, e.a === 1 ? '#c084fc' : '#c6ff3a', { grow: 120 });
        break;
      case 'land': this.burst(PK.Smoke, e.x, e.y, 10, 120, 0.8, 10, 'rgba(200,190,170,0.5)', { grow: 20, drag: 3 }); break;
      case 'crash': this.burst(PK.Spark, e.x, e.y, 6, 160, 0.25, 2, '#fff', { drag: 4 }); break;
      case 'dust': this.p(PK.Smoke, e.x + (r.next() - 0.5) * 40, e.y, 0, 0, 0.6, 12, 'rgba(120,100,80,0.45)', { grow: 30 }); break;
      case 'blink': this.burst(PK.Star, e.x, e.y, 18, 200, 0.5, 4, '#ff4fd8', { drag: 3 }); break;
      case 'slam':
        this.burst(PK.Smoke, e.x, e.y, 14, 220, 0.9, 14, 'rgba(120,90,60,0.5)', { grow: 30, drag: 3 });
        this.decal(e.x, e.y, scorch[1], 1.6, 0.8);
        break;
      case 'bossdeath':
        for (let i = 0; i < 6; i++) {
          const x = e.x + (r.next() - 0.5) * (e.a ?? 40) * 2, y = e.y + (r.next() - 0.5) * (e.a ?? 40) * 2;
          this.burst(PK.Flame, x, y, 14, 300, 0.7, 14, '#ff8c42', { drag: 4, grow: 20 });
          this.burst(PK.Gib, x, y, 10, 300, 0.9, 5, '#7a1f1f', { drag: 3 });
        }
        this.p(PK.Ring, e.x, e.y, 0, 0, 0.7, 20, '#fff', { grow: 900 });
        for (let i = 0; i < 5; i++) this.decal(e.x + (r.next() - 0.5) * 80, e.y + (r.next() - 0.5) * 80, splats[i % splats.length], 2.4);
        this.flash = 0.6;
        this.flashColor = '#fff';
        break;
      case 'hint':
        this.hints.push({ text: e.s ?? '', life: 4 });
        break;
    }
  }

  update(dt: number, w: World) {
    const parts = this.parts;
    let j = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.pool.push(p); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.vr * dt;
      parts[j++] = p;
    }
    parts.length = j;
    for (const t of this.texts) { t.life -= dt; t.y -= (30 + 40 * (t.life / t.max)) * dt; t.y -= w.scroll * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter(b => b.life > 0);
    for (const l of this.lights) l.life -= dt;
    this.lights = this.lights.filter(l => l.life > 0);
    const bottom = w.camBottom + 120;
    if (this.decals.length && this.decals[0].y > bottom) this.decals = this.decals.filter(d => d.y < bottom);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.hurt = Math.max(0, this.hurt - dt * 1.8);
    if (this.hints.length) { this.hints[0].life -= dt; if (this.hints[0].life <= 0) this.hints.shift(); }
  }
}
