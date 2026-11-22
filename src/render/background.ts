import type { BiomeId } from '../config/levels';
import { Rng } from '../core/util';
import { ROAD_L, ROAD_R, VIEW_W } from '../sim/world';
import { OUTLINE, cached, ellipse, rrect, shade, sprite, type Sprite } from './sprites';

export const TILE_H = 480;

export interface BiomeStyle {
  id: BiomeId;
  bg: string;
  tint?: string;
  rain?: boolean;
  dust?: boolean;
  gap: string;
  rail: string;
}

export const BIOMES: Record<BiomeId, BiomeStyle> = {
  suburbs: { id: 'suburbs', bg: '#5d8a3f', gap: '#2f5f8a', rail: '#d9d4c7' },
  highway: { id: 'highway', bg: '#5b6152', gap: '#1d3448', rail: '#b8bec6', tint: 'rgba(120,140,160,0.10)' },
  neon: { id: 'neon', bg: '#17151d', gap: '#07070c', rail: '#ff4fd8', rain: true },
  fort: { id: 'fort', bg: '#7a6a55', gap: '#2b2118', rail: '#ffb627', tint: 'rgba(255,120,40,0.10)', dust: true },
};

const tiles = new Map<BiomeId, Sprite>();

export function groundTile(id: BiomeId): Sprite {
  let t = tiles.get(id);
  if (t) return t;
  const rng = new Rng(id.length * 131 + 7);
  t = sprite(VIEW_W, TILE_H, g => {
    g.translate(-VIEW_W / 2, -TILE_H / 2);
    switch (id) {
      case 'suburbs': drawSuburbs(g, rng); break;
      case 'highway': drawHighway(g, rng); break;
      case 'neon': drawNeon(g, rng); break;
      case 'fort': drawFort(g, rng); break;
    }
  });
  tiles.set(id, t);
  return t;
}

function noise(g: CanvasRenderingContext2D, rng: Rng, x0: number, x1: number, colors: string[], n: number, size: [number, number]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rng.pick(colors);
    const s = rng.range(size[0], size[1]);
    g.beginPath();
    g.ellipse(rng.range(x0, x1), rng.range(0, TILE_H), s, s * rng.range(0.4, 1), rng.range(0, 3), 0, Math.PI * 2);
    g.fill();
  }
}

function cracks(g: CanvasRenderingContext2D, rng: Rng, n: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  for (let i = 0; i < n; i++) {
    let x = rng.range(ROAD_L + 20, ROAD_R - 20), y = rng.range(10, TILE_H - 10);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += rng.range(-12, 12); y += rng.range(-10, 10); g.lineTo(x, y); }
    g.stroke();
  }
}

function asphalt(g: CanvasRenderingContext2D, rng: Rng, base: string, specks: string[]) {
  g.fillStyle = base;
  g.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, TILE_H);
  noise(g, rng, ROAD_L, ROAD_R, specks, 900, [0.6, 2]);
  // patches
  for (let i = 0; i < 5; i++) {
    g.fillStyle = shade(base, rng.range(-0.12, 0.06));
    g.globalAlpha = 0.6;
    rrect(g, rng.range(ROAD_L + 10, ROAD_R - 90), rng.range(0, TILE_H - 60), rng.range(40, 90), rng.range(30, 60), 6, g.fillStyle as string, false);
    g.globalAlpha = 1;
  }
}

function dashes(g: CanvasRenderingContext2D, x: number, color: string, len = 34, gap = 46, w = 5) {
  g.fillStyle = color;
  for (let y = 0; y < TILE_H; y += len + gap) g.fillRect(x - w / 2, y + 8, w, len);
}

function drawSuburbs(g: CanvasRenderingContext2D, rng: Rng) {
  g.fillStyle = '#5d8a3f';
  g.fillRect(0, 0, VIEW_W, TILE_H);
  noise(g, rng, 0, VIEW_W, ['#6b9a48', '#527c37', '#78a852'], 500, [1, 3]);
  // sidewalks
  for (const [x0, x1] of [[ROAD_L - 22, ROAD_L], [ROAD_R, ROAD_R + 22]]) {
    g.fillStyle = '#c9c3b4';
    g.fillRect(x0, 0, x1 - x0, TILE_H);
    g.fillStyle = '#b3ad9f';
    for (let y = 0; y < TILE_H; y += 40) g.fillRect(x0, y, x1 - x0, 2);
  }
  asphalt(g, rng, '#4b4f58', ['#545862', '#43464e', '#5a5e68'], );
  // curbs
  g.fillStyle = '#8f8a80';
  g.fillRect(ROAD_L - 3, 0, 4, TILE_H);
  g.fillRect(ROAD_R - 1, 0, 4, TILE_H);
  dashes(g, VIEW_W / 2, '#f2d16b', 40, 40, 5);
  cracks(g, rng, 6, 'rgba(25,25,30,0.5)');
  // manhole + leaves
  ellipse(g, 160, 300, 14, 14, '#3a3d44', true, 1.5);
  g.strokeStyle = '#2d3036'; g.lineWidth = 1.5;
  for (let i = -8; i <= 8; i += 4) { g.beginPath(); g.moveTo(160 + i, 289); g.lineTo(160 + i, 311); g.stroke(); }
  noise(g, rng, ROAD_L, ROAD_R, ['#a5762f', '#c0902f', '#8a5a26'], 30, [1.5, 3]);
}

function drawHighway(g: CanvasRenderingContext2D, rng: Rng) {
  g.fillStyle = '#5b6152';
  g.fillRect(0, 0, VIEW_W, TILE_H);
  noise(g, rng, 0, VIEW_W, ['#666d5c', '#50574a', '#727a66'], 400, [1, 3]);
  g.fillStyle = '#6e7178';
  g.fillRect(ROAD_L - 18, 0, 18, TILE_H);
  g.fillRect(ROAD_R, 0, 18, TILE_H);
  asphalt(g, rng, '#40434b', ['#484b54', '#383b42', '#4f525b']);
  g.fillStyle = '#f2d16b';
  g.fillRect(ROAD_L + 6, 0, 4, TILE_H);
  g.fillStyle = '#e8e8e8';
  g.fillRect(ROAD_R - 10, 0, 4, TILE_H);
  dashes(g, ROAD_L + (ROAD_R - ROAD_L) / 3, '#e8e8e8', 30, 50, 4);
  dashes(g, ROAD_L + ((ROAD_R - ROAD_L) * 2) / 3, '#e8e8e8', 30, 50, 4);
  cracks(g, rng, 9, 'rgba(20,20,25,0.55)');
  // skid marks & oil
  g.strokeStyle = 'rgba(20,20,22,0.35)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(220, 40); g.bezierCurveTo(240, 140, 300, 200, 310, 300); g.stroke();
  g.beginPath(); g.moveTo(236, 40); g.bezierCurveTo(256, 140, 316, 200, 326, 300); g.stroke();
  ellipse(g, 400, 380, 22, 12, 'rgba(15,15,20,0.45)', false);
  // guard rails
  for (const x of [ROAD_L - 14, ROAD_R + 10]) {
    g.fillStyle = '#9aa0a8'; g.fillRect(x, 0, 4, TILE_H);
    g.fillStyle = '#c3c8cf'; g.fillRect(x + 1, 0, 1.5, TILE_H);
    g.fillStyle = '#5b6068';
    for (let y = 10; y < TILE_H; y += 60) g.fillRect(x - 1, y, 6, 6);
  }
}

function drawNeon(g: CanvasRenderingContext2D, rng: Rng) {
  g.fillStyle = '#17151d';
  g.fillRect(0, 0, VIEW_W, TILE_H);
  // sidewalk tiles
  for (const [x0, x1] of [[0, ROAD_L], [ROAD_R, VIEW_W]]) {
    g.fillStyle = '#2a2733';
    g.fillRect(x0, 0, x1 - x0, TILE_H);
    g.strokeStyle = '#1e1c25'; g.lineWidth = 1;
    for (let y = 0; y < TILE_H; y += 24) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  }
  asphalt(g, rng, '#211f28', ['#29262f', '#1b1a21', '#2e2b35']);
  // wet reflections
  for (let i = 0; i < 9; i++) {
    const x = rng.range(ROAD_L + 30, ROAD_R - 30), y = rng.range(0, TILE_H);
    const col = rng.pick(['rgba(255,79,216,0.13)', 'rgba(76,201,240,0.13)', 'rgba(255,182,39,0.10)']);
    g.fillStyle = col;
    g.beginPath(); g.ellipse(x, y, rng.range(20, 50), rng.range(8, 18), 0, 0, Math.PI * 2); g.fill();
  }
  dashes(g, VIEW_W / 2, 'rgba(230,230,240,0.55)', 26, 54, 4);
  // crosswalk
  g.fillStyle = 'rgba(230,230,240,0.35)';
  for (let x = ROAD_L + 10; x < ROAD_R - 10; x += 26) g.fillRect(x, 200, 14, 54);
  // neon curb strips
  g.fillStyle = '#ff4fd8'; g.fillRect(ROAD_L - 3, 0, 3, TILE_H);
  g.fillStyle = '#4cc9f0'; g.fillRect(ROAD_R, 0, 3, TILE_H);
  cracks(g, rng, 6, 'rgba(0,0,0,0.5)');
}

function drawFort(g: CanvasRenderingContext2D, rng: Rng) {
  g.fillStyle = '#7a6a55';
  g.fillRect(0, 0, VIEW_W, TILE_H);
  noise(g, rng, 0, VIEW_W, ['#86755e', '#6c5e4b', '#8f7f66'], 400, [1, 3]);
  // concrete slabs
  g.fillStyle = '#8c8578';
  g.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, TILE_H);
  noise(g, rng, ROAD_L, ROAD_R, ['#958e81', '#837c70', '#9c968a'], 700, [0.6, 2]);
  g.strokeStyle = '#6f695e'; g.lineWidth = 2;
  for (let y = 0; y <= TILE_H; y += 120) { g.beginPath(); g.moveTo(ROAD_L, y); g.lineTo(ROAD_R, y); g.stroke(); }
  for (let x = ROAD_L; x <= ROAD_R; x += (ROAD_R - ROAD_L) / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, TILE_H); g.stroke(); }
  // hazard stripes along the edges
  for (const x of [ROAD_L, ROAD_R - 10]) {
    g.save(); g.beginPath(); g.rect(x, 0, 10, TILE_H); g.clip();
    g.fillStyle = '#ffb627'; g.fillRect(x, 0, 10, TILE_H);
    g.fillStyle = '#1d1d1d';
    for (let y = -20; y < TILE_H; y += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 10); g.lineTo(x + 10, y + 22); g.lineTo(x, y + 12); g.fill(); }
    g.restore();
  }
  // painted helipad arrows / numbers
  g.fillStyle = 'rgba(240,240,230,0.35)';
  g.beginPath(); g.moveTo(270, 330); g.lineTo(300, 370); g.lineTo(282, 370); g.lineTo(282, 410); g.lineTo(258, 410); g.lineTo(258, 370); g.lineTo(240, 370); g.closePath(); g.fill();
  cracks(g, rng, 8, 'rgba(60,50,40,0.5)');
  ellipse(g, 140, 120, 26, 16, 'rgba(40,30,20,0.25)', false);
}

// ───────────────────────────── roadside decor ─────────────────────────────

export interface Decor { y: number; x: number; kind: string; v: number; over: boolean }

export function decorFor(id: BiomeId, band: number): Decor[] {
  const rng = new Rng(band * 7919 + id.length * 31);
  const out: Decor[] = [];
  const y = -band * 150;
  for (const side of [0, 1]) {
    if (!rng.chance(0.75)) continue;
    const x = side === 0 ? rng.range(-6, 14) : VIEW_W - rng.range(-6, 14);
    const yy = y - rng.range(0, 140);
    let kind = 'tree';
    switch (id) {
      case 'suburbs': kind = rng.weighted([['tree', 5], ['bush', 3], ['mailbox', 1], ['hydrant', 1], ['lamp', 1]]); break;
      case 'highway': kind = rng.weighted([['pole', 2], ['sign', 1], ['bush', 2], ['cone', 2], ['tire', 1]]); break;
      case 'neon': kind = rng.weighted([['neon', 4], ['bin', 2], ['lamp', 2], ['box', 1]]); break;
      case 'fort': kind = rng.weighted([['sandbag', 4], ['wire', 2], ['flood', 1], ['crates', 2]]); break;
    }
    out.push({ y: yy, x, kind, v: rng.int(0, 3), over: kind === 'tree' || kind === 'neon' || kind === 'flood' || kind === 'lamp' || kind === 'pole' });
  }
  return out;
}

const NEON_COLORS = ['#ff4fd8', '#4cc9f0', '#ffb627', '#7bff6b'];

export function decorSprite(kind: string, v: number): Sprite {
  return cached(`dec_${kind}_${v}`, 90, 90, g => {
    switch (kind) {
      case 'tree': {
        const r = 26 + v * 4;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(6, 8, r, 0, Math.PI * 2); g.fill();
        const greens = [['#3f7a2f', '#4f9238', '#66ad48'], ['#5a7f2a', '#6e9a34', '#8ab84a'], ['#2f6b3a', '#3d8549', '#58a463'], ['#9a6a2a', '#b8822f', '#d39a3c']][v];
        ellipse(g, 0, 0, r, r, greens[0], true, 2);
        for (let i = 0; i < 6; i++) { const a = i * 1.05; ellipse(g, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.5, r * 0.5, greens[1], false); }
        ellipse(g, -r * 0.25, -r * 0.3, r * 0.45, r * 0.4, greens[2], false);
        break;
      }
      case 'bush':
        for (const [x, y, r] of [[-8, 2, 11], [8, 0, 12], [0, -6, 10]]) ellipse(g, x, y, r, r, v % 2 ? '#4e8a36' : '#5f7a3a', true, 1.6);
        ellipse(g, -2, -6, 5, 4, '#7fb85a', false);
        break;
      case 'mailbox': rrect(g, -4, -4, 8, 8, 1, '#5a4a3a'); rrect(g, -7, -10, 14, 9, 4, '#2e86de'); break;
      case 'hydrant': ellipse(g, 0, 0, 7, 7, '#d62828'); ellipse(g, 0, 0, 3.5, 3.5, '#ff6b6b', false); break;
      case 'lamp': case 'pole': {
        const gr = g.createRadialGradient(0, 0, 1, 0, 0, 34);
        gr.addColorStop(0, kind === 'lamp' ? 'rgba(255,230,150,0.45)' : 'rgba(220,230,255,0.3)');
        gr.addColorStop(1, 'rgba(255,230,150,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill();
        ellipse(g, 0, 0, 5, 5, '#5b5f66', true, 1.6);
        ellipse(g, 0, 0, 2.6, 2.6, '#fff6c8', false);
        break;
      }
      case 'sign': rrect(g, -18, -10, 36, 20, 3, '#2a7a3a', true, 2); rrect(g, -14, -6, 28, 3, 1, '#fff', false); rrect(g, -14, 1, 18, 3, 1, '#fff', false); break;
      case 'cone': ellipse(g, 0, 0, 8, 8, '#ff7b22', true, 1.6); ellipse(g, 0, 0, 4, 4, '#fff', false); ellipse(g, 0, 0, 2, 2, '#ff7b22', false); break;
      case 'tire': ellipse(g, 0, 0, 10, 10, '#1d1d20', true, 1.6); ellipse(g, 0, 0, 4.5, 4.5, '#3a3a40', false); break;
      case 'neon': {
        const col = NEON_COLORS[v];
        const gr = g.createRadialGradient(0, 0, 2, 0, 0, 44);
        gr.addColorStop(0, col + '88'); gr.addColorStop(1, col + '00');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
        rrect(g, -9, -24, 18, 48, 4, '#1b1a22', true, 2);
        g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 8;
        g.beginPath(); g.roundRect(-5, -19, 10, 38, 3); g.stroke();
        g.shadowBlur = 0;
        break;
      }
      case 'bin': rrect(g, -9, -11, 18, 22, 3, '#3d5a40', true, 1.8); rrect(g, -7, -9, 14, 5, 2, '#4e7352', false); break;
      case 'box': rrect(g, -10, -10, 20, 20, 2, '#8a6a44', true, 1.6); break;
      case 'sandbag':
        for (const [x, y] of [[-10, -6], [6, -6], [-2, 5], [14, 5], [-18, 5]]) rrect(g, x - 8, y - 5, 16, 10, 5, '#b9a477', true, 1.4);
        break;
      case 'wire':
        g.strokeStyle = '#3a3a3a'; g.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-15 + i * 10, 0, 7, 0, Math.PI * 2); g.stroke(); }
        break;
      case 'flood': {
        const gr = g.createRadialGradient(0, 0, 2, 0, 0, 44);
        gr.addColorStop(0, 'rgba(255,240,200,0.5)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
        rrect(g, -8, -8, 16, 16, 3, '#4a4d52', true, 2); ellipse(g, 0, 0, 4, 4, '#fffbe0', false);
        break;
      }
      case 'crates':
        rrect(g, -16, -12, 18, 18, 2, '#6b7a44', true, 1.6); rrect(g, 0, -4, 16, 16, 2, '#7d8c52', true, 1.6);
        break;
    }
  });
}

export function finishSprite(): Sprite {
  return cached('finish', VIEW_W, 120, g => {
    // barricade with an open gate in the middle
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = side * (90 + i * 46);
        rrect(g, x - 22, -14, 44, 28, 4, i % 2 ? '#7d6a4a' : '#8f7a55', true, 2);
        g.strokeStyle = '#5a4a32'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 18, -10); g.lineTo(x + 18, 10); g.stroke();
      }
      rrect(g, side * 66 - 7, -46, 14, 60, 3, '#4a4d52', true, 2);
      g.fillStyle = '#2ec4b6';
      g.beginPath(); g.moveTo(side * 66, -46); g.lineTo(side * 66 + side * 34, -38); g.lineTo(side * 66, -28); g.fill();
      g.strokeStyle = OUTLINE; g.lineWidth = 1.5; g.stroke();
    }
    g.fillStyle = 'rgba(46,196,182,0.35)';
    g.fillRect(-60, -6, 120, 12);
  });
}
