import { ALLIES, type AllyClassId } from '../config/allies';
import { CHAPTERS } from '../config/levels';
import { POWERS, type PowerId } from '../config/props';
import type { WeaponId } from '../config/weapons';
import { ROAD_L, ROAD_R, VIEW_W, World, type Prop } from '../sim/world';
import { BIOMES, TILE_H, decorFor, decorSprite, finishSprite, groundTile, type BiomeStyle, type Decor } from './background';
import { drawBoss } from './bosses';
import { Effects, PK } from './fx';
import {
  FRAMES, OUTLINE, SS, cached, classBadge, drawWeaponIcon, ellipse, powerBadge, propSprite, rrect,
  survivorFlashSprite, survivorSprite, weaponBadge, zombieSet, type Sprite,
} from './sprites';

const glowCache = new Map<string, HTMLCanvasElement>();
function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color);
    gr.addColorStop(0.35, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1;
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    // fade the solid colour to transparent at the edge
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
  }
  return c;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  fx = new Effects();
  scale = 1;
  dpr = 1;
  viewH = 960;
  biome: BiomeStyle = BIOMES.suburbs;
  night = false;
  private lightC: HTMLCanvasElement;
  private bossC = document.createElement('canvas');
  private lg: CanvasRenderingContext2D;
  private order: number[] = [];
  private decor = new Map<number, Decor[]>();
  private rain: { x: number; y: number; s: number }[] = [];
  private time = 0;
  private camX = 0;
  private camY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.lightC = document.createElement('canvas');
    this.lg = this.lightC.getContext('2d')!;
    for (let i = 0; i < 90; i++) this.rain.push({ x: Math.random() * VIEW_W, y: Math.random() * 1200, s: 0.7 + Math.random() * 0.6 });
  }

  /** fits a 540-wide logical view into the css size; returns the logical view height */
  resize(cssW: number, cssH: number): number {
    this.dpr = Math.min(window.devicePixelRatio || 1, cssW < 700 ? 2.5 : 2);
    const aspect = cssH / cssW;
    this.viewH = Math.round(Math.min(1200, Math.max(860, VIEW_W * aspect)));
    this.scale = Math.min(cssW / VIEW_W, cssH / this.viewH);
    const w = Math.round(VIEW_W * this.scale), h = Math.round(this.viewH * this.scale);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.lightC.width = VIEW_W / 2;
    this.lightC.height = Math.ceil(this.viewH / 2);
    this.g.imageSmoothingEnabled = true;
    return this.viewH;
  }

  setLevel(w: World) {
    this.biome = BIOMES[CHAPTERS[w.level.chapter].biome];
    this.night = !!w.level.night;
    this.decor.clear();
    this.fx.reset();
    this.fx.lowQuality = (navigator.hardwareConcurrency ?? 8) <= 4;
  }

  render(w: World, dt: number) {
    this.time += dt;
    const g = this.g;
    const fx = this.fx;
    fx.consume(w);
    fx.update(dt, w);

    const k = this.scale * this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.biome.bg;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const sh = fx.shake;
    this.camX = sh > 0 ? (Math.random() - 0.5) * sh : 0;
    this.camY = w.camTop + (sh > 0 ? (Math.random() - 0.5) * sh : 0);
    g.setTransform(k, 0, 0, k, -this.camX * k, -this.camY * k);
    const top = w.camTop, bottom = w.camBottom;

    this.drawGround(top, bottom);
    this.drawNarrows(w, top, bottom);
    for (const d of fx.decals) {
      if (d.y < top - 60 || d.y > bottom + 60) continue;
      const s = d.s, sw = s.w * d.scale, shh = s.h * d.scale;
      g.globalAlpha = d.a;
      g.save();
      g.translate(d.x, d.y);
      g.rotate(d.rot);
      g.drawImage(s.c, -sw / 2, -shh / 2, sw, shh);
      g.restore();
    }
    g.globalAlpha = 1;
    this.drawDecor(top, bottom, false);
    if (!w.level.endless && !w.level.boss) {
      const fy = -w.level.length;
      if (fy > top - 100 && fy < bottom + 100) {
        const s = finishSprite();
        g.drawImage(s.c, 0, fy - 60, VIEW_W, 120);
      }
    }
    this.drawProps(w, top, bottom, true);
    this.drawTelegraphs(w);
    this.drawCoins(w);
    this.drawZombies(w, top, bottom);
    this.drawProps(w, top, bottom, false);
    this.drawSquad(w);
    this.drawBullets(w);
    if (w.boss && !w.boss.dead) {
      const b = w.boss;
      const size = Math.ceil(b.r * 4.4);
      const px = Math.ceil(size * k);
      if (this.bossC.width !== px) { this.bossC.width = px; this.bossC.height = px; }
      const bg = this.bossC.getContext('2d')!;
      bg.setTransform(1, 0, 0, 1, 0, 0);
      bg.clearRect(0, 0, px, px);
      bg.setTransform(k, 0, 0, k, px / 2, px / 2);
      drawBoss(bg, b, b.flash > 0);
      g.drawImage(this.bossC, b.x - size / 2, b.y - size / 2, size, size);
    }
    this.drawParticles(top, bottom);
    this.drawShots(w);
    this.drawDecor(top, bottom, true);
    if (this.night) this.drawNight(w, k);
    this.drawWeather(w);
    this.drawCoinRush(w);
    this.drawTexts();

    // screen-space overlays
    g.setTransform(k, 0, 0, k, 0, 0);
    if (this.biome.tint) {
      g.fillStyle = this.biome.tint;
      g.fillRect(0, 0, VIEW_W, this.viewH);
    }
    if (fx.flash > 0) {
      g.globalAlpha = Math.min(0.6, fx.flash);
      g.fillStyle = fx.flashColor;
      g.fillRect(0, 0, VIEW_W, this.viewH);
      g.globalAlpha = 1;
    }
    if (w.powers.shield > 0) this.vignette('rgba(76,201,240,', 0.22 + Math.sin(this.time * 6) * 0.05);
    if (fx.hurt > 0) this.vignette('rgba(200,20,20,', fx.hurt * 0.55);
    const L = w.leader;
    if (L && L.hp / L.maxHp < 0.3 && w.state === 'playing') this.vignette('rgba(160,0,0,', 0.18 + Math.sin(this.time * 5) * 0.08);
  }

  private vignette(rgb: string, a: number) {
    const g = this.g;
    const gr = g.createRadialGradient(VIEW_W / 2, this.viewH / 2, this.viewH * 0.32, VIEW_W / 2, this.viewH / 2, this.viewH * 0.75);
    gr.addColorStop(0, rgb + '0)');
    gr.addColorStop(1, rgb + a + ')');
    g.fillStyle = gr;
    g.fillRect(0, 0, VIEW_W, this.viewH);
  }

  private drawGround(top: number, bottom: number) {
    const tile = groundTile(this.biome.id);
    const g = this.g;
    let y = Math.floor(top / TILE_H) * TILE_H;
    for (; y < bottom; y += TILE_H) g.drawImage(tile.c, 0, y, VIEW_W, TILE_H + 0.5);
  }

  private drawNarrows(w: World, top: number, bottom: number) {
    const g = this.g;
    for (const n of w.narrows) {
      if (n.y1 - 170 > bottom || n.y0 + 170 < top) continue;
      const y0 = Math.min(bottom + 10, n.y0 + 170), y1 = Math.max(top - 10, n.y1 - 170);
      for (const side of [0, 1]) {
        g.beginPath();
        g.moveTo(side ? VIEW_W : 0, y0);
        for (let y = y0; y >= y1; y -= 12) {
          const [l, r] = w.roadBounds(y);
          g.lineTo(side ? r + 2 : l - 2, y);
        }
        g.lineTo(side ? VIEW_W : 0, y1);
        g.closePath();
        g.fillStyle = this.biome.gap;
        g.fill();
        // water shimmer
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.lineWidth = 2;
        for (let y = Math.ceil(y1 / 40) * 40; y < y0; y += 40) {
          const [l, r] = w.roadBounds(y);
          const off = Math.sin(this.time * 2 + y * 0.05) * 6;
          g.beginPath();
          if (side) { g.moveTo(r + 14 + off, y); g.lineTo(Math.min(VIEW_W, r + 40 + off), y); }
          else { g.moveTo(Math.max(0, l - 40 + off), y); g.lineTo(l - 14 + off, y); }
          g.stroke();
        }
        // rail
        g.beginPath();
        for (let y = y0; y >= y1; y -= 12) {
          const [l, r] = w.roadBounds(y);
          const x = side ? r + 3 : l - 3;
          if (y === y0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.lineWidth = 6; g.strokeStyle = OUTLINE; g.stroke();
        g.lineWidth = 3; g.strokeStyle = this.biome.rail; g.stroke();
      }
    }
  }

  private drawDecor(top: number, bottom: number, over: boolean) {
    const g = this.g;
    const b0 = Math.floor(-bottom / 150) - 1, b1 = Math.ceil(-top / 150) + 1;
    for (let band = b0; band <= b1; band++) {
      let list = this.decor.get(band);
      if (!list) {
        list = decorFor(this.biome.id, band);
        this.decor.set(band, list);
        if (this.decor.size > 80) this.decor.delete(this.decor.keys().next().value!);
      }
      for (const d of list) {
        if (d.over !== over) continue;
        const s = decorSprite(d.kind, d.v);
        g.drawImage(s.c, d.x - s.w / 2, d.y - s.h / 2, s.w, s.h);
      }
    }
  }

  private img(s: Sprite, x: number, y: number, scale = 1) {
    const w = s.w * scale, h = s.h * scale;
    this.g.drawImage(s.c, x - w / 2, y - h / 2, w, h);
  }

  private hpBar(x: number, y: number, w: number, ratio: number, color = '#ff5a4f') {
    const g = this.g;
    g.fillStyle = 'rgba(10,10,15,0.75)';
    g.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, 7);
    g.fillStyle = color;
    g.fillRect(x - w / 2, y, w * Math.max(0, ratio), 4);
  }

  private drawProps(w: World, top: number, bottom: number, low: boolean) {
    const g = this.g;
    for (const p of w.props) {
      if (p.y + p.h / 2 + 60 < top || p.y - p.h / 2 - 60 > bottom) continue;
      const isLow = p.kind === 'spikes' || p.kind === 'mine' || p.kind === 'acid' || p.kind === 'fire';
      if (isLow !== low) continue;
      this.drawProp(w, p);
      if (p.def.target && p.hp < p.maxHp && p.fall <= 0) {
        this.hpBar(p.x, p.y - p.h / 2 - 12, Math.min(56, p.w + 6), p.hp / p.maxHp, p.kind === 'cage' || p.kind === 'bus' ? '#2ec4b6' : '#ffb627');
      }
    }
    void g;
  }

  private drawProp(w: World, p: Prop) {
    const g = this.g;
    const t = this.time;
    const flash = p.flash > 0;
    switch (p.kind) {
      case 'crate': case 'ammo': case 'mystery': case 'barrel': {
        const s = propSprite(p.kind);
        const wob = flash ? (Math.random() - 0.5) * 3 : 0;
        if (p.kind === 'mystery') {
          g.globalAlpha = 0.35 + Math.sin(t * 4) * 0.15;
          this.img({ c: glow('#9b7bff'), w: 90, h: 90 }, p.x, p.y);
          g.globalAlpha = 1;
        }
        this.img(s, p.x + wob, p.y);
        if (flash) this.flashOver(s, p.x + wob, p.y);
        if (p.kind === 'crate') this.img(weaponBadge(p.payload as WeaponId), p.x, p.y - 34 + Math.sin(t * 3) * 2);
        if (p.kind === 'barrel' && p.fuse > 0) { g.globalAlpha = 0.8; this.img({ c: glow('#ffef5a'), w: 50, h: 50 }, p.x, p.y); g.globalAlpha = 1; }
        break;
      }
      case 'airdrop': {
        const s = propSprite('airdrop');
        if (p.fall > 0) {
          const k = p.fall / 1.6;
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.beginPath(); g.ellipse(p.x, p.y + 10, 26 * (1 - k * 0.5), 14 * (1 - k * 0.5), 0, 0, Math.PI * 2); g.fill();
          const y = p.y - k * 240;
          // parachute
          ellipse(g, p.x, y - 46, 46, 30, '#e8e2d4', true, 2);
          g.fillStyle = '#e63946';
          for (let i = -2; i <= 2; i += 2) { g.beginPath(); g.ellipse(p.x + i * 12, y - 46, 6, 28, 0, 0, Math.PI * 2); g.fill(); }
          g.strokeStyle = OUTLINE; g.lineWidth = 1;
          g.beginPath(); g.moveTo(p.x - 40, y - 40); g.lineTo(p.x - 20, y - 18); g.moveTo(p.x + 40, y - 40); g.lineTo(p.x + 20, y - 18); g.stroke();
          this.img(s, p.x, y);
        } else {
          g.globalAlpha = 0.4 + Math.sin(t * 5) * 0.2;
          this.img({ c: glow('#7df9ff'), w: 110, h: 110 }, p.x, p.y);
          g.globalAlpha = 1;
          this.img(s, p.x, p.y);
          if (flash) this.flashOver(s, p.x, p.y);
          this.img(weaponBadge(p.payload as WeaponId), p.x, p.y - 38 + Math.sin(t * 3) * 2);
        }
        break;
      }
      case 'cage': {
        const ss = survivorSprite(p.payload as AllyClassId, Math.floor(t * 6) % FRAMES, false);
        this.img(ss, p.x, p.y + Math.sin(t * 8 + p.id) * 1.5);
        const bars = propSprite('cagebars');
        this.img(bars, p.x, p.y);
        if (flash) this.flashOver(bars, p.x, p.y);
        this.img(classBadge(p.payload as AllyClassId), p.x, p.y - 34 + Math.sin(t * 3) * 2);
        break;
      }
      case 'bus': {
        const s = propSprite('bus');
        this.img(s, p.x, p.y);
        if (flash) this.flashOver(s, p.x, p.y);
        const list = p.payload.split(',');
        list.forEach((c, i) => this.img(classBadge(c as AllyClassId), p.x - 34 + i * 34, p.y - 48 + Math.sin(t * 3 + i) * 2));
        break;
      }
      case 'car': {
        const s = propSprite('car', p.variant);
        if (p.life > 0 && p.life < 1) g.globalAlpha = p.life;
        this.img(s, p.x, p.y);
        if (flash) this.flashOver(s, p.x, p.y);
        g.globalAlpha = 1;
        if (p.hp < p.maxHp && p.hp < p.maxHp * 0.5 && Math.random() < 0.3) this.fx.p(PK.Smoke, p.x + (Math.random() - 0.5) * 30, p.y - 20, 0, -20, 0.9, 6, 'rgba(50,50,50,0.4)', { grow: 14 });
        break;
      }
      case 'barrier': case 'fence': case 'spikes': {
        const s = propSprite(p.kind);
        this.img(s, p.x, p.y);
        if (flash) this.flashOver(s, p.x, p.y);
        break;
      }
      case 'median': {
        const s = propSprite('median', 0, p.w, Math.round(p.h));
        this.img(s, p.x, p.y);
        break;
      }
      case 'mine': {
        this.img(propSprite('mine'), p.x, p.y);
        const on = p.fuse > 0 || Math.sin(t * 6 + p.id) > 0.6;
        ellipse(g, p.x, p.y, 2.6, 2.6, on ? '#ff3030' : '#6a1a1a', false);
        if (on) { g.globalAlpha = 0.6; this.img({ c: glow('#ff3030'), w: 26, h: 26 }, p.x, p.y); g.globalAlpha = 1; }
        break;
      }
      case 'fire': {
        g.globalAlpha = 0.55;
        this.img({ c: glow('#ff6b1a'), w: p.w * 1.6, h: p.h * 1.6 }, p.x, p.y);
        g.globalAlpha = 1;
        ellipse(g, p.x, p.y, p.w / 2, p.h / 2, 'rgba(40,20,10,0.5)', false);
        if (Math.random() < 0.7) this.fx.p(PK.Flame, p.x + (Math.random() - 0.5) * p.w * 0.8, p.y + (Math.random() - 0.5) * p.h * 0.6, 0, -40, 0.5, 9, Math.random() < 0.5 ? '#ff8c42' : '#ffd166', { grow: -10, drag: 1 });
        break;
      }
      case 'acid': {
        const a = p.life > 0 ? Math.min(1, p.life * 2) : 1;
        g.globalAlpha = 0.75 * a;
        ellipse(g, p.x, p.y, p.w / 2, p.h / 2.6, '#7fd13a', false);
        ellipse(g, p.x - 6, p.y - 3, p.w / 3.2, p.h / 4, '#b6ff5a', false);
        g.globalAlpha = 1;
        if (Math.random() < 0.25) this.fx.p(PK.Dot, p.x + (Math.random() - 0.5) * p.w * 0.7, p.y + (Math.random() - 0.5) * p.h * 0.4, 0, -20, 0.4, 2.5, '#d6ff7a');
        break;
      }
      default:
        this.drawPickup(p);
    }
  }

  private flashOver(s: Sprite, x: number, y: number) {
    const g = this.g;
    g.globalAlpha = 0.55;
    g.globalCompositeOperation = 'lighter';
    this.img(s, x, y);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  private drawPickup(p: Prop) {
    const g = this.g;
    const t = p.t;
    const pop = t < 0.3 ? Math.sin((t / 0.3) * Math.PI * 0.5) * 1.15 : 1;
    const bob = Math.sin(this.time * 4 + p.id) * 3;
    const y = p.y + bob;
    const glowCol = p.kind === 'p_power' ? POWERS[p.payload as PowerId].color : p.kind === 'p_medkit' ? '#ff6b6b' : p.kind === 'p_survivor' ? '#2ec4b6' : '#ffd166';
    g.globalAlpha = 0.45 + Math.sin(this.time * 5) * 0.15;
    this.img({ c: glow(glowCol), w: 70, h: 70 }, p.x, p.y);
    g.globalAlpha = 1;
    g.strokeStyle = glowCol;
    g.lineWidth = 2;
    g.globalAlpha = 0.6;
    g.beginPath(); g.ellipse(p.x, p.y + 10, 18, 8, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
    switch (p.kind) {
      case 'p_weapon': this.img(weaponBadge(p.payload as WeaponId), p.x, y, pop * 1.15); break;
      case 'p_ammo': this.img(propSprite('ammo_pick'), p.x, y, pop); break;
      case 'p_medkit': this.img(propSprite('medkit'), p.x, y, pop); break;
      case 'p_power': this.img(powerBadge(p.payload as PowerId), p.x, y, pop); break;
      case 'p_survivor': {
        const s = survivorSprite(p.payload as AllyClassId, Math.floor(this.time * 10) % FRAMES, false);
        this.img(s, p.x, y, pop);
        const bub = cached('bubble', 22, 22, gg => {
          ellipse(gg, 0, 0, 9, 9, '#fff', true, 1.6);
          gg.fillStyle = '#e63946'; gg.font = 'bold 13px sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('!', 0, 1);
        });
        this.img(bub, p.x + 14, y - 22 + Math.sin(this.time * 6) * 2);
        break;
      }
    }
  }

  private coinSprite() {
    return cached('coin', 14, 14, gg => {
      ellipse(gg, 0, 0, 5.5, 5.5, '#ffc93c', true, 1.4);
      ellipse(gg, -1.2, -1.2, 2.2, 2.2, '#fff1b0', false);
    });
  }

  private drawCoins(w: World) {
    const g = this.g;
    const coin = this.coinSprite();
    for (const c of w.coins) {
      if (c.rush) continue;
      const s = 0.8 + Math.abs(Math.sin(c.t * 8 + c.x)) * 0.35;
      g.drawImage(coin.c, c.x - 7 * s, c.y - 7, 14 * s, 14);
    }
  }

  /** post-boss auto-collect: glowing coins with golden trails, drawn above everything */
  private drawCoinRush(w: World) {
    const L = w.leader;
    if (!L || !w.coinRush || !w.coins.length) return;
    const g = this.g;
    const coin = this.coinSprite();
    const halo = glow('#ffc93c');
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45 + Math.sin(this.time * 14) * 0.15;
    g.drawImage(halo, L.x - 55, L.y - 55, 110, 110);
    g.lineCap = 'round';
    g.strokeStyle = '#ffd166';
    for (const c of w.coins) {
      if (!c.rush) continue;
      g.globalAlpha = 0.7;
      g.drawImage(halo, c.x - 16, c.y - 16, 32, 32);
      if (c.t <= 0) continue;
      const dx = c.x - L.x, dy = c.y - L.y;
      const d = Math.hypot(dx, dy) || 1;
      const len = Math.min(70, c.t * 260);
      // two strokes: wide faint tail + thin bright core
      for (const [part, width, a] of [[1, 3, 0.35], [0.5, 5, 0.6]]) {
        g.globalAlpha = a;
        g.lineWidth = width;
        g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x + (dx / d) * len * part, c.y + (dy / d) * len * part); g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.lineCap = 'butt';
    for (const c of w.coins) {
      if (!c.rush) continue;
      const s = 1 + Math.abs(Math.sin(c.t * 14 + c.x)) * 0.5;
      g.drawImage(coin.c, c.x - 7 * s, c.y - 8.5, 14 * s, 17);
    }
  }

  private drawZombies(w: World, top: number, bottom: number) {
    const g = this.g;
    const zs = w.zombies;
    const order = this.order;
    order.length = 0;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      if (!z.dead && z.y > top - 50 && z.y < bottom + 50) order.push(i);
    }
    order.sort((a, b) => zs[a].y - zs[b].y);
    for (const i of order) {
      const z = zs[i];
      const set = zombieSet(z.ti, z.look);
      const f = Math.floor(z.anim) % FRAMES;
      if (z.buff > 0) {
        g.globalAlpha = 0.5;
        g.drawImage(glow('#ff4fd8'), z.x - z.r * 2, z.y - z.r * 2, z.r * 4, z.r * 4);
        g.globalAlpha = 1;
      }
      const img = z.flash > 0 ? set.flash[f] : set.frames[f];
      g.drawImage(img.c, z.x - set.size / 2, z.y - set.size / 2, set.size, set.size);
      if (z.burn > 0) {
        g.globalAlpha = 0.45 + Math.random() * 0.2;
        g.drawImage(glow('#ff7b22'), z.x - z.r * 1.4, z.y - z.r * 1.6, z.r * 2.8, z.r * 2.8);
        g.globalAlpha = 1;
      }
      if (z.maxHp >= 80 && z.hp < z.maxHp) this.hpBar(z.x, z.y - z.r - 10, z.r * 2, z.hp / z.maxHp);
      if ((z.def.spitter || z.def.screamer) && z.state === 1 && z.timer < 0.5) {
        g.globalAlpha = 0.8;
        g.drawImage(glow(z.def.spitter ? '#b6ff3a' : '#ff5cf0'), z.x - 20, z.y - 20, 40, 40);
        g.globalAlpha = 1;
      }
    }
  }

  private drawSquad(w: World) {
    const g = this.g;
    const sq = w.squad;
    const L = sq[0];
    if (!L) return;
    // leader ring
    g.strokeStyle = 'rgba(46,196,182,0.9)';
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(L.x, L.y + 8, 16, 8, 0, 0, Math.PI * 2); g.stroke();
    const idx = sq.map((_, i) => i).sort((a, b) => sq[a].y - sq[b].y);
    for (const i of idx) {
      const m = sq[i];
      const f = Math.floor(m.anim * 2) % FRAMES;
      const s = survivorSprite(m.cls as AllyClassId, f);
      const sc = m.join > 0 ? 1 + Math.sin(m.join * Math.PI) * 0.5 : 1;
      const ry = m.recoil * 2;
      if (m.join > 0) {
        g.globalAlpha = m.join;
        g.drawImage(glow('#2ec4b6'), m.x - 30, m.y - 30, 60, 60);
        g.globalAlpha = 1;
      }
      this.img(s, m.x, m.y - 4 + ry, sc);
      if (m.hurt > 0) {
        g.globalAlpha = Math.min(1, m.hurt * 4) * 0.8;
        this.img(survivorFlashSprite(m.cls), m.x, m.y - 4 + ry, sc);
        g.globalAlpha = 1;
      }
      if (i === 0 && w.weapon.def.id !== 'pistol') {
        g.save();
        g.translate(m.x + 5, m.y - 18 + ry);
        g.rotate(-Math.PI / 2);
        drawWeaponIcon(g, w.weapon.def.id, 20, '#22232a');
        g.restore();
      }
      if (m.rank > 0) {
        g.fillStyle = '#ffd166';
        for (let r = 0; r < m.rank; r++) {
          const x = m.x - (m.rank - 1) * 3.5 + r * 7, y = m.y + 15;
          g.beginPath(); g.moveTo(x - 3, y - 1); g.lineTo(x, y + 2); g.lineTo(x + 3, y - 1); g.lineTo(x + 3, y + 1); g.lineTo(x, y + 4); g.lineTo(x - 3, y + 1); g.fill();
        }
      }
      if (m.hp < m.maxHp) this.hpBar(m.x, m.y - 26, 22, m.hp / m.maxHp, m.hp / m.maxHp > 0.5 ? '#63e6be' : m.hp / m.maxHp > 0.25 ? '#ffd166' : '#ff5a4f');
    }
    if (w.powers.shield > 0) {
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const m of sq) { minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x); minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y); }
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2 + 26, ry = (maxY - minY) / 2 + 26;
      g.fillStyle = 'rgba(76,201,240,0.12)';
      g.strokeStyle = `rgba(150,230,255,${0.6 + Math.sin(this.time * 8) * 0.2})`;
      g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  private drawBullets(w: World) {
    const g = this.g;
    g.lineCap = 'round';
    for (const b of w.bullets) {
      switch (b.kind) {
        case 'bullet': case 'pellet': case 'snipe': {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          const len = b.kind === 'snipe' ? 30 : b.kind === 'pellet' ? 8 : 14;
          const tx = b.x - (b.vx / sp) * len, ty = b.y - (b.vy / sp) * len;
          g.strokeStyle = b.color;
          g.lineWidth = b.kind === 'snipe' ? 2.4 : 2.6;
          g.beginPath(); g.moveTo(tx, ty); g.lineTo(b.x, b.y); g.stroke();
          if (b.burn > 0) { g.globalAlpha = 0.6; g.drawImage(glow('#ff7b22'), b.x - 6, b.y - 6, 12, 12); g.globalAlpha = 1; }
          break;
        }
        case 'flame': {
          const k = 1 - b.life / 0.6;
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = Math.max(0, 0.75 - k * 0.6);
          const s = b.r * 2.6;
          g.drawImage(glow(k < 0.35 ? '#ffd166' : '#ff6b1a'), b.x - s / 2, b.y - s / 2, s, s);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'rocket': {
          ellipse(g, b.x, b.y, 3.2, 7, '#4a5a3a', true, 1.2);
          g.globalAlpha = 0.9;
          g.drawImage(glow('#ffb347'), b.x - 8, b.y + 3, 16, 16);
          g.globalAlpha = 1;
          if (Math.random() < 0.8) this.fx.p(PK.Smoke, b.x, b.y + 10, (Math.random() - 0.5) * 20, 30, 0.5, 4, 'rgba(200,200,200,0.4)', { grow: 14 });
          break;
        }
        case 'grenade': {
          const k = Math.min(1, b.t / b.dur);
          const h = Math.sin(k * Math.PI) * 55;
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.beginPath(); g.ellipse(b.x, b.y, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
          ellipse(g, b.x, b.y - h, 4, 4, '#4f5d3a', true, 1.2);
          break;
        }
      }
    }
    for (const bm of this.fx.beams) {
      const a = bm.life / 0.2;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(125,249,255,${a * 0.5})`;
      g.lineWidth = 16 * a;
      g.beginPath(); g.moveTo(bm.x, bm.y0); g.lineTo(bm.x, bm.y1); g.stroke();
      g.strokeStyle = `rgba(230,255,255,${a})`;
      g.lineWidth = 4 * a;
      g.beginPath(); g.moveTo(bm.x, bm.y0); g.lineTo(bm.x, bm.y1); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
  }

  private drawTelegraphs(w: World) {
    const g = this.g;
    for (const s of w.shots) {
      if (s.strike) continue;
      const k = Math.max(0, s.t / s.dur);
      const r = s.kind === 'car' ? 54 : s.kind === 'egg' ? 26 : 32;
      const col = s.kind === 'car' ? '255,70,50' : s.kind === 'egg' ? '192,132,252' : '170,255,60';
      g.fillStyle = `rgba(${col},${0.12 + k * 0.2})`;
      g.beginPath(); g.ellipse(s.tx, s.ty, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(${col},0.9)`;
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(s.tx, s.ty, r, r * 0.6, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.ellipse(s.tx, s.ty, r * k, r * 0.6 * k, 0, 0, Math.PI * 2); g.stroke();
    }
    const b = w.boss;
    if (b && !b.dead && b.kind === 'butcher' && b.state === 'aim') {
      const a = 0.25 + Math.abs(Math.sin(this.time * 14)) * 0.25;
      g.fillStyle = `rgba(255,40,40,${a})`;
      g.fillRect(b.aimX - b.r - 6, b.y, (b.r + 6) * 2, w.camBottom - b.y);
      g.fillStyle = `rgba(255,220,220,${a + 0.2})`;
      for (let y = b.y + 60; y < w.camBottom; y += 70) {
        g.beginPath(); g.moveTo(b.aimX - 14, y); g.lineTo(b.aimX, y + 16); g.lineTo(b.aimX + 14, y); g.lineTo(b.aimX, y + 6); g.fill();
      }
    }
    for (const v of w.waves) {
      if (v.kind === 'shock') {
        const l = v.gap - v.gapW / 2, r = v.gap + v.gapW / 2;
        g.fillStyle = 'rgba(255,140,40,0.85)';
        g.fillRect(ROAD_L - 30, v.y - 9, l - ROAD_L + 30, 18);
        g.fillRect(r, v.y - 9, ROAD_R + 30 - r, 18);
        g.fillStyle = 'rgba(255,240,200,0.9)';
        g.fillRect(ROAD_L - 30, v.y - 3, l - ROAD_L + 30, 6);
        g.fillRect(r, v.y - 3, ROAD_R + 30 - r, 6);
        g.fillStyle = 'rgba(99,230,190,0.25)';
        g.fillRect(l, v.y - 40, r - l, 80);
      } else {
        g.lineWidth = 12;
        g.strokeStyle = 'rgba(255,79,216,0.55)';
        g.beginPath(); g.arc(v.x, v.y, v.r, v.gap + v.gapW, v.gap - v.gapW + Math.PI * 2); g.stroke();
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(255,230,250,0.95)';
        g.beginPath(); g.arc(v.x, v.y, v.r, v.gap + v.gapW, v.gap - v.gapW + Math.PI * 2); g.stroke();
      }
    }
  }

  private drawShots(w: World) {
    const g = this.g;
    for (const s of w.shots) {
      if (s.t < 0) continue;
      const k = Math.min(1, s.t / s.dur);
      const x = s.sx + (s.tx - s.sx) * k;
      const y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * (s.kind === 'car' ? 160 : 90);
      if (s.kind === 'car') {
        if (s.strike) {
          g.fillStyle = '#2b2b2b';
          ellipse(g, x, y, 4, 10, '#3a3d44', true, 1.4);
          g.globalAlpha = 0.9;
          g.drawImage(glow('#ffb347'), x - 8, y - 22, 16, 16);
          g.globalAlpha = 1;
        } else {
          g.save();
          g.translate(x, y);
          g.rotate(k * 7);
          const sc = 0.7 + Math.sin(k * Math.PI) * 0.35;
          const cs = propSprite('car', 3);
          g.drawImage(cs.c, -cs.w * sc / 2, -cs.h * sc / 2, cs.w * sc, cs.h * sc);
          g.restore();
        }
      } else {
        const col = s.kind === 'egg' ? '#c084fc' : '#a6f53a';
        g.globalAlpha = 0.7;
        g.drawImage(glow(col), x - 14, y - 14, 28, 28);
        g.globalAlpha = 1;
        ellipse(g, x, y, s.kind === 'egg' ? 7 : 5.5, s.kind === 'egg' ? 8 : 5.5, col, true, 1.4);
      }
    }
  }

  private drawParticles(top: number, bottom: number) {
    const g = this.g;
    for (const p of this.fx.parts) {
      if (p.y < top - 80 || p.y > bottom + 80) continue;
      const a = p.life / p.max;
      switch (p.k) {
        case PK.Dot: case PK.Gib:
          g.fillStyle = p.color;
          g.globalAlpha = Math.min(1, a * 2);
          g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case PK.Shell:
          g.fillStyle = p.color;
          g.globalAlpha = Math.min(1, a * 3);
          g.fillRect(p.x - 1, p.y - 2, 2, 4);
          break;
        case PK.Spark:
          g.strokeStyle = p.color;
          g.globalAlpha = a;
          g.lineWidth = p.size;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
          break;
        case PK.Smoke: {
          g.globalAlpha = a * 0.9;
          const s = Math.max(1, p.size) * 2;
          g.drawImage(glow(p.color), p.x - s / 2, p.y - s / 2, s, s);
          break;
        }
        case PK.Glow: case PK.Flame: {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = p.k === PK.Glow ? a : Math.min(1, a * 1.4);
          const s = Math.max(1, p.size) * 2;
          g.drawImage(glow(p.color), p.x - s / 2, p.y - s / 2, s, s);
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case PK.Star: {
          g.globalAlpha = Math.min(1, a * 2);
          g.fillStyle = p.color;
          const s = p.size;
          g.beginPath(); g.moveTo(p.x, p.y - s); g.lineTo(p.x + s * 0.4, p.y); g.lineTo(p.x, p.y + s); g.lineTo(p.x - s * 0.4, p.y); g.fill();
          g.beginPath(); g.moveTo(p.x - s, p.y); g.lineTo(p.x, p.y + s * 0.4); g.lineTo(p.x + s, p.y); g.lineTo(p.x, p.y - s * 0.4); g.fill();
          break;
        }
        case PK.Ring:
          g.globalAlpha = a;
          g.strokeStyle = p.color;
          g.lineWidth = 3 * a + 1;
          g.beginPath(); g.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2); g.stroke();
          break;
      }
    }
    g.globalAlpha = 1;
  }

  private drawNight(w: World, k: number) {
    const lg = this.lg;
    const W = this.lightC.width, H = this.lightC.height;
    const top = this.camY;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, W, H);
    lg.fillStyle = 'rgba(6,6,22,0.86)';
    lg.fillRect(0, 0, W, H);
    lg.setTransform(0.5, 0, 0, 0.5, -this.camX * 0.5, -top * 0.5);
    lg.globalCompositeOperation = 'destination-out';
    const hole = glow('rgba(0,0,0,1)');
    const L = w.leader;
    if (L) {
      // flashlight cone ahead of the squad
      lg.save();
      lg.translate(L.x, L.y - 260);
      lg.scale(1, 1.9);
      lg.globalAlpha = 0.95;
      lg.drawImage(hole, -230, -230, 460, 460);
      lg.restore();
    }
    lg.globalAlpha = 1;
    for (const m of w.squad) lg.drawImage(hole, m.x - 80, m.y - 80, 160, 160);
    for (const l of this.fx.lights) {
      lg.globalAlpha = Math.min(1, l.life / l.max * 1.5);
      lg.drawImage(hole, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    lg.globalAlpha = 0.8;
    const b0 = Math.floor(-w.camBottom / 150) - 1, b1 = Math.ceil(-w.camTop / 150) + 1;
    for (let band = b0; band <= b1; band++) {
      for (const d of this.decor.get(band) ?? []) {
        if (d.kind === 'neon' || d.kind === 'lamp') lg.drawImage(hole, d.x - 90, d.y - 90, 180, 180);
      }
    }
    for (const z of w.zombies) if (z.burn > 0) lg.drawImage(hole, z.x - 40, z.y - 40, 80, 80);
    for (const p of w.props) {
      if (p.kind === 'fire') lg.drawImage(hole, p.x - 110, p.y - 110, 220, 220);
      else if (p.def.pickup || p.kind === 'airdrop') lg.drawImage(hole, p.x - 45, p.y - 45, 90, 90);
    }
    if (w.boss && !w.boss.dead) lg.drawImage(hole, w.boss.x - 160, w.boss.y - 160, 320, 320);
    lg.globalAlpha = 1;
    const g = this.g;
    g.save();
    g.setTransform(k, 0, 0, k, 0, 0);
    g.drawImage(this.lightC, 0, 0, VIEW_W, H * 2);
    g.restore();
    // eyes glow through the darkness
    g.fillStyle = '#ffef5a';
    for (const z of w.zombies) {
      if (z.dead) continue;
      const hy = z.y + z.r * 0.55;
      g.fillRect(z.x - 3, hy, 1.8, 1.8);
      g.fillRect(z.x + 1.2, hy, 1.8, 1.8);
    }
  }

  private drawWeather(w: World) {
    const g = this.g;
    const top = this.camY;
    if (this.biome.rain) {
      g.strokeStyle = 'rgba(180,200,255,0.35)';
      g.lineWidth = 1.2;
      g.beginPath();
      const H = this.viewH + 40;
      for (const r of this.rain) {
        r.y += 900 * r.s / 60;
        r.x -= 120 * r.s / 60;
        if (r.y > H) { r.y -= H; r.x = Math.random() * (VIEW_W + 80); }
        if (r.x < -20) r.x += VIEW_W + 40;
        g.moveTo(r.x, top + r.y);
        g.lineTo(r.x + 4 * r.s, top + r.y - 18 * r.s);
      }
      g.stroke();
    }
    if (this.biome.dust) {
      g.fillStyle = 'rgba(255,210,150,0.35)';
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + this.time * (20 + (i % 5) * 6)) % VIEW_W;
        const y = (i * 173 + Math.sin(this.time + i) * 20) % this.viewH;
        g.fillRect(x, top + y, 2, 2);
      }
    }
  }

  private drawTexts() {
    const g = this.g;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of this.fx.texts) {
      const a = Math.min(1, t.life / t.max * 3);
      const pop = t.max - t.life < 0.12 ? 1 + (0.12 - (t.max - t.life)) * 4 : 1;
      g.globalAlpha = a;
      g.font = `${Math.round(t.size * pop)}px "Russo One", Impact, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = OUTLINE;
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
    g.globalAlpha = 1;
  }
}

export { SS, ALLIES };
