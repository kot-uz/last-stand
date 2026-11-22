import { ALLIES, type AllyClassId } from '../config/allies';
import { ZOMBIE_LIST, type ZombieLook } from '../config/enemies';
import { POWERS, type PowerId } from '../config/props';
import type { WeaponId } from '../config/weapons';

/** sprite pixel density relative to logical units */
export const SS = 2;
export const OUTLINE = '#15141c';
export const FRAMES = 8;

export interface Sprite { c: HTMLCanvasElement; w: number; h: number }

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SS);
  c.height = Math.ceil(h * SS);
  return c;
}

/** Creates a sprite of logical size w×h, drawing callback receives a ctx with origin at the center. */
export function sprite(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  g.scale(SS, SS);
  g.translate(w / 2, h / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  return { c, w, h };
}

const cache = new Map<string, Sprite>();
export function cached(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  let s = cache.get(key);
  if (!s) { s = sprite(w, h, draw); cache.set(key, s); }
  return s;
}

/** White silhouette copy used for hit flashes */
export function silhouette(s: Sprite, color = '#fff'): Sprite {
  const c = document.createElement('canvas');
  c.width = s.c.width; c.height = s.c.height;
  const g = c.getContext('2d')!;
  g.drawImage(s.c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return { c, w: s.w, h: s.h };
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = true, lw = 1.6) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) { g.lineWidth = lw; g.strokeStyle = OUTLINE; g.stroke(); }
}

export function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true, lw = 1.6) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  if (stroke) { g.lineWidth = lw; g.strokeStyle = OUTLINE; g.stroke(); }
}

function shadow(g: CanvasRenderingContext2D, rx: number, ry: number, oy = 3) {
  g.beginPath();
  g.ellipse(2, oy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fill();
}

// ───────────────────────────── survivors ─────────────────────────────

function drawHeadgear(g: CanvasRenderingContext2D, cls: AllyClassId, c: { body: string; accent: string; head: string; hair: string }) {
  switch (cls) {
    case 'commander':
      ellipse(g, 0, 1, 6.6, 6.4, '#2b6f68');
      ellipse(g, 0, 0.2, 5.2, 4.8, '#3a8f86', false);
      rrect(g, -6.5, -2.4, 13, 2.4, 1, c.accent, false);
      break;
    case 'rifleman':
      ellipse(g, 0, 1, 6.6, 6.4, '#4b5d3a');
      ellipse(g, -1, 0, 4.4, 4, '#5f7449', false);
      break;
    case 'gunner':
      ellipse(g, 0, 1, 6.4, 6.2, c.hair);
      rrect(g, -6.4, -1.6, 12.8, 3, 1.4, '#c0392b', false);
      break;
    case 'sniper':
      ellipse(g, 0, 1.5, 7, 7, '#4a5a2a');
      ellipse(g, 0, 0.5, 4.5, 4.2, '#5d7036', false);
      break;
    case 'medic':
      ellipse(g, 0, 1, 6.4, 6.2, c.hair);
      ellipse(g, 0, 0, 5, 4.2, '#f4f1de');
      rrect(g, -0.9, -2.8, 1.8, 5.2, 0.4, '#e63946', false);
      rrect(g, -2.6, -1.1, 5.2, 1.8, 0.4, '#e63946', false);
      break;
    case 'demo':
      ellipse(g, 0, 1, 6.8, 6.6, '#3d3a46');
      rrect(g, -5, -3.5, 10, 3, 1.5, '#9bd36a', true, 1);
      break;
  }
}

function drawSurvivor(g: CanvasRenderingContext2D, cls: AllyClassId, phase: number, gun: boolean) {
  const c = ALLIES[cls].colors;
  const s = Math.sin(phase);
  shadow(g, 10, 7, 6);
  // legs
  rrect(g, -6, 2 + s * 4, 4.5, 8, 2, '#2d2f3a');
  rrect(g, 1.5, 2 - s * 4, 4.5, 8, 2, '#2d2f3a');
  // backpack
  rrect(g, -6, 3, 12, 7, 2.5, shade(c.body, -0.35));
  // torso
  ellipse(g, 0, 0, 10, 6.8, c.body);
  ellipse(g, -3, -1.5, 4, 2.6, shade(c.body, 0.25), false);
  // arms + gun
  if (gun) {
    const len = cls === 'sniper' ? 20 : cls === 'gunner' ? 13 : 15;
    rrect(g, 2.4, -6 - len, 3.4, len + 2, 1, '#26272e', true, 1.2);
    if (cls === 'sniper') rrect(g, 2, -15, 4.2, 4, 1, '#111', false);
    ellipse(g, 4.3, -6, 2.6, 2.6, c.head);
    ellipse(g, -2.5, -5.2, 2.6, 2.6, c.head);
  } else {
    ellipse(g, 8.5, 0, 2.8, 2.8, c.head);
    ellipse(g, -8.5, 0, 2.8, 2.8, c.head);
  }
  // shoulders accent
  rrect(g, -9, -2.2, 3.5, 3.2, 1.2, c.accent, false);
  rrect(g, 5.5, -2.2, 3.5, 3.2, 1.2, c.accent, false);
  // head
  ellipse(g, 0, 0.5, 6, 6, c.head);
  drawHeadgear(g, cls, c);
}

const survivorFrames = new Map<string, Sprite[]>();
export function survivorSprite(cls: AllyClassId, frame: number, gun = true): Sprite {
  const key = cls + (gun ? 'g' : 'n');
  let arr = survivorFrames.get(key);
  if (!arr) {
    arr = [];
    for (let i = 0; i < FRAMES; i++) arr.push(sprite(34, 44, g => { g.translate(0, 4); drawSurvivor(g, cls, (i / FRAMES) * Math.PI * 2, gun); }));
    survivorFrames.set(key, arr);
  }
  return arr[frame % FRAMES];
}
const survivorFlash = new Map<string, Sprite>();
export function survivorFlashSprite(cls: AllyClassId): Sprite {
  let s = survivorFlash.get(cls);
  if (!s) { s = silhouette(survivorSprite(cls, 0), '#ff3b3b'); survivorFlash.set(cls, s); }
  return s;
}

// ───────────────────────────── zombies ─────────────────────────────

function drawZombie(g: CanvasRenderingContext2D, look: ZombieLook, r: number, phase: number) {
  const s = Math.sin(phase), c2 = Math.cos(phase);
  const k = r / 12;
  g.save();
  g.scale(k, k);
  const { skin, cloth, cloth2, build, eye } = look;
  const skinD = shade(skin, -0.25);

  if (build === 'crawler') {
    shadow(g, 11, 7, 3);
    rrect(g, -10, -6 + s * 3, 5, 12, 2.5, skin);
    rrect(g, 5, -6 - s * 3, 5, 12, 2.5, skin);
    ellipse(g, 0, -1, 7, 9, cloth);
    ellipse(g, 0, 6, 4.6, 4.6, skin);
    ellipse(g, -1.6, 8, 1, 1, eye, false);
    ellipse(g, 1.6, 8, 1, 1, eye, false);
    g.restore();
    return;
  }

  const wide = build === 'huge' ? 1.35 : build === 'lean' ? 0.85 : build === 'fat' ? 1.2 : 1;
  shadow(g, 11 * wide, 7.5, 5);
  // legs (behind = up, since zombies face down)
  rrect(g, -6 * wide, -9 + s * 4, 4.6, 8, 2, cloth2);
  rrect(g, 1.6 * wide, -9 - s * 4, 4.6, 8, 2, cloth2);

  // arms reaching forward (down)
  const armLen = build === 'huge' ? 15 : build === 'riot' ? 9 : 13;
  const sway = c2 * 2.5;
  if (build !== 'riot' && build !== 'fat') {
    rrect(g, -8.5 * wide - 1, -1 + sway, 4.2, armLen, 2, skin);
    rrect(g, 8.5 * wide - 3.2, -1 - sway, 4.2, armLen, 2, skin);
    ellipse(g, -8.5 * wide + 1, armLen - 1 + sway, 2.6, 2.6, skinD);
    ellipse(g, 8.5 * wide - 1, armLen - 1 - sway, 2.6, 2.6, skinD);
  }

  if (build === 'fat') {
    ellipse(g, 0, 0, 13, 11.5, skin);
    ellipse(g, -3, -3, 6, 4.5, shade(skin, 0.2), false);
    for (const [x, y, rr] of [[-6, 3, 2.4], [5, -4, 2], [6, 5, 2.8], [-2, 7, 1.8]]) ellipse(g, x, y, rr, rr, '#d4e157', true, 1);
    rrect(g, -12, -1 + sway, 4, 9, 2, skin);
    rrect(g, 8, -1 - sway, 4, 9, 2, skin);
  } else if (build === 'riot') {
    ellipse(g, 0, -1, 10.5, 7.2, cloth);
    rrect(g, -7, -5, 14, 6, 2, shade(cloth, 0.2), false);
    rrect(g, -9, -2 + sway * 0.3, 4, 8, 2, skin);
  } else {
    ellipse(g, 0, -1, 10 * wide, 6.8 * (build === 'huge' ? 1.25 : 1), cloth);
    ellipse(g, -3 * wide, -3, 4 * wide, 2.4, shade(cloth, 0.2), false);
    // torn bits / blood
    ellipse(g, 4 * wide, 1, 2.2, 1.6, '#7a1f1f', false);
  }

  // head (forward = down)
  const hy = build === 'hunch' ? 6 : build === 'huge' ? 3 : 3.5;
  const hr = build === 'huge' ? 5.6 : build === 'fat' ? 5.2 : 5.8;
  if (build === 'screamer') {
    ellipse(g, 0, hy - 3, 7.4, 7, '#1d1621');
    ellipse(g, 0, hy, hr, hr, skin);
    ellipse(g, 0, hy + 3, 2.6, 2.2, '#2a0a24', false);
  } else {
    ellipse(g, 0, hy, hr, hr, skin);
    ellipse(g, -1.5, hy - 2, 3, 2.2, skinD, false);
  }
  if (build === 'riot') {
    // helmet with visor + shield
    ellipse(g, 0, hy - 0.5, hr + 0.8, hr + 0.4, '#1b2740');
    rrect(g, -4.5, hy + 0.6, 9, 3.6, 1.5, 'rgba(160,210,255,0.7)', true, 1);
    rrect(g, -11, 9, 22, 5.5, 2, '#7d8da6');
    rrect(g, -9.5, 10.2, 19, 2.2, 1, '#aebbd0', false);
  }
  if (build === 'hunch') {
    ellipse(g, 0, hy + 5, 3.6, 3, '#c6ff3a', true, 1);
  }
  if (build !== 'riot') {
    ellipse(g, -2, hy + 2.6, 1.15, 1.15, eye, false);
    ellipse(g, 2, hy + 2.6, 1.15, 1.15, eye, false);
  }
  g.restore();
}

interface ZSet { frames: Sprite[]; flash: Sprite[]; corpse: Sprite; size: number }
let zsets: ZSet[][] = [];

export function buildZombieSprites() {
  zsets = ZOMBIE_LIST.map(def =>
    def.looks.map(look => {
      const size = Math.ceil(def.r * 3.6 + 10);
      const frames: Sprite[] = [];
      for (let i = 0; i < FRAMES; i++) frames.push(sprite(size, size, g => drawZombie(g, look, def.r, (i / FRAMES) * Math.PI * 2)));
      const flash = frames.map(f => silhouette(f));
      const corpse = sprite(size, size, g => {
        g.rotate(Math.PI / 2);
        g.globalAlpha = 0.95;
        drawZombie(g, look, def.r, 0.7);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(30,8,8,0.45)';
        g.fillRect(-size, -size, size * 2, size * 2);
      });
      return { frames, flash, corpse, size };
    }),
  );
}
export const zombieSet = (ti: number, look: number) => zsets[ti][look];

// ───────────────────────────── decals ─────────────────────────────

export const splats: Sprite[] = [];
export const greenSplats: Sprite[] = [];
export const scorch: Sprite[] = [];
export function buildDecals() {
  const mk = (color: string, color2: string, n: number, out: Sprite[]) => {
    for (let v = 0; v < n; v++) {
      out.push(sprite(48, 48, g => {
        let seed = v * 977 + color.length * 13;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(0, 0, 9 + rnd() * 4, 7 + rnd() * 4, rnd() * 3, 0, Math.PI * 2);
        g.fill();
        for (let i = 0; i < 9; i++) {
          const a = rnd() * Math.PI * 2, d = 6 + rnd() * 14, rr = 1.2 + rnd() * 3.5;
          g.beginPath();
          g.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = color2;
        g.beginPath();
        g.ellipse(-2, -2, 4, 3, 0, 0, Math.PI * 2);
        g.fill();
      }));
    }
  };
  mk('rgba(110,14,18,0.85)', 'rgba(150,25,25,0.6)', 6, splats);
  mk('rgba(110,170,40,0.75)', 'rgba(170,220,60,0.6)', 4, greenSplats);
  for (let v = 0; v < 3; v++) {
    scorch.push(sprite(110, 110, g => {
      const gr = g.createRadialGradient(0, 0, 4, 0, 0, 50);
      gr.addColorStop(0, 'rgba(15,10,8,0.75)');
      gr.addColorStop(0.6, 'rgba(25,18,14,0.45)');
      gr.addColorStop(1, 'rgba(25,18,14,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, 50, 0, Math.PI * 2);
      g.fill();
    }));
  }
}

// ───────────────────────────── weapon icons ─────────────────────────────

export function drawWeaponIcon(g: CanvasRenderingContext2D, id: WeaponId | string, s: number, color = '#1a1a22') {
  g.save();
  g.scale(s / 20, s / 20);
  g.fillStyle = color;
  const R = (x: number, y: number, w: number, h: number, r = 1) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  switch (id) {
    case 'pistol': R(-7, -4, 13, 4.5); R(-6, -1, 4, 7, 1.2); break;
    case 'smg': R(-9, -4, 17, 5); R(-3, 0, 3.5, 7); R(2, 0, 3, 5); R(-11, -3, 3, 3); break;
    case 'shotgun': R(-11, -3, 22, 3.6); R(-11, 0, 9, 3.5); R(-4, 0.5, 5, 2.6); break;
    case 'rifle': R(-11, -3.5, 22, 4.5); R(-2, 0, 3.5, 7); R(-11, -1, 6, 5); R(3, -6, 4, 2.6); break;
    case 'minigun': R(-11, -5, 16, 10, 3); R(4, -4, 8, 2); R(4, -1, 8, 2); R(4, 2, 8, 2); break;
    case 'launcher': R(-11, -4, 22, 7, 3); R(-3, 2, 3.5, 6); g.beginPath(); g.moveTo(11, -5); g.lineTo(15, -0.5); g.lineTo(11, 4); g.fill(); break;
    case 'flamer': R(-11, -3, 16, 5); R(5, -2, 6, 3); R(-8, 1, 6, 7, 3); g.beginPath(); g.arc(13, -0.5, 2.5, 0, Math.PI * 2); g.fill(); break;
    case 'railgun': R(-11, -3, 22, 5, 2); R(-8, -6, 14, 2); R(-8, 3, 14, 2); R(-2, 2, 3, 6); break;
  }
  g.restore();
}

export function weaponBadge(id: WeaponId): Sprite {
  return cached('wb_' + id, 34, 34, g => {
    ellipse(g, 0, 0, 15, 15, '#ffb627', true, 2);
    ellipse(g, 0, 0, 12, 12, '#ffd36b', false);
    drawWeaponIcon(g, id, 22);
  });
}

export function classBadge(cls: AllyClassId): Sprite {
  return cached('cb_' + cls, 30, 30, g => {
    ellipse(g, 0, 0, 12.5, 12.5, ALLIES[cls].colors.body, true, 2);
    g.fillStyle = '#fff';
    g.font = 'bold 14px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ALLIES[cls].icon, 0, 1);
  });
}

export function powerBadge(id: PowerId): Sprite {
  const p = POWERS[id];
  return cached('pb_' + id, 40, 40, g => {
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, 19);
    gr.addColorStop(0, p.color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(-20, -20, 40, 40);
    rrect(g, -11, -13, 22, 26, 8, p.color, true, 2);
    rrect(g, -7, -10, 6, 18, 3, 'rgba(255,255,255,0.45)', false);
    g.fillStyle = OUTLINE;
    g.font = 'bold 16px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(p.icon, 0, 1);
  });
}

// ───────────────────────────── props ─────────────────────────────

const CAR_COLORS = ['#c0392b', '#2e86de', '#e1b12c', '#5f6b73'];

export function propSprite(kind: string, variant = 0, w = 0, h = 0): Sprite {
  switch (kind) {
    case 'crate':
      return cached('crate', 50, 48, g => {
        shadow(g, 23, 14, 8);
        rrect(g, -22, -20, 44, 40, 3, '#a0703c', true, 2);
        g.strokeStyle = '#6b4520'; g.lineWidth = 2;
        for (const y of [-10, 0, 10]) { g.beginPath(); g.moveTo(-20, y); g.lineTo(20, y); g.stroke(); }
        g.strokeStyle = '#7b5228'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-18, -16); g.lineTo(18, 16); g.stroke();
        for (const [x, y] of [[-22, -20], [16, -20], [-22, 14], [16, 14]]) rrect(g, x, y, 6, 6, 1, '#5a5f66', false);
      });
    case 'airdrop':
      return cached('airdrop', 56, 56, g => {
        shadow(g, 26, 16, 8);
        rrect(g, -24, -24, 48, 48, 4, '#4f5d3a', true, 2);
        rrect(g, -20, -20, 40, 40, 2, '#5f7046', false);
        g.strokeStyle = '#ffb627'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-24, 0); g.lineTo(24, 0); g.moveTo(0, -24); g.lineTo(0, 24); g.stroke();
      });
    case 'ammo':
      return cached('ammo', 40, 36, g => {
        shadow(g, 18, 11, 6);
        rrect(g, -17, -14, 34, 28, 3, '#55702f', true, 2);
        rrect(g, -17, -14, 34, 7, 2, '#3f5522', false);
        for (let i = 0; i < 4; i++) { rrect(g, -11 + i * 6, -3, 4, 12, 2, '#e9c46a', true, 1); rrect(g, -11 + i * 6, -3, 4, 4, 2, '#b08d3c', false); }
      });
    case 'mystery':
      return cached('mystery', 46, 46, g => {
        shadow(g, 20, 13, 8);
        rrect(g, -19, -19, 38, 38, 5, '#6a4cc2', true, 2);
        rrect(g, -15, -15, 30, 30, 3, '#7f60e0', false);
        g.fillStyle = '#ffe066'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.strokeStyle = OUTLINE; g.lineWidth = 3; g.strokeText('?', 0, 2); g.fillText('?', 0, 2);
      });
    case 'barrel':
      return cached('barrel', 32, 32, g => {
        shadow(g, 13, 9, 5);
        ellipse(g, 0, 0, 12.5, 12.5, '#d62828', true, 2);
        ellipse(g, 0, 0, 9, 9, '#b51f1f', false);
        g.strokeStyle = '#ff6b6b'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#ffd23f';
        g.beginPath(); g.moveTo(0, -6); g.lineTo(5.5, 4); g.lineTo(-5.5, 4); g.closePath(); g.fill();
        g.fillStyle = OUTLINE; g.fillRect(-0.8, -2.5, 1.6, 4);
      });
    case 'mine':
      return cached('mine', 26, 26, g => {
        ellipse(g, 0, 0, 10, 10, '#3b3f36', true, 1.6);
        ellipse(g, 0, 0, 6.5, 6.5, '#575c4f', false);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ellipse(g, Math.cos(a) * 8, Math.sin(a) * 8, 1.4, 1.4, '#2a2d26', false); }
      });
    case 'car':
      return cached('car' + variant, 64, 100, g => drawCar(g, variant));
    case 'barrier':
      return cached('barrier', 96, 30, g => {
        shadow(g, 45, 10, 5);
        rrect(g, -45, -12, 90, 24, 4, '#bfbab0', true, 2);
        rrect(g, -41, -8, 82, 9, 3, '#d8d3c8', false);
        g.save(); g.beginPath(); g.rect(-45, 4, 90, 8); g.clip();
        for (let x = -50; x < 50; x += 14) { g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 7, 12); g.lineTo(x + 15, 4); g.lineTo(x + 8, 4); g.fill(); }
        g.restore();
      });
    case 'fence':
      return cached('fence', 104, 22, g => {
        shadow(g, 50, 6, 4);
        rrect(g, -50, -3, 100, 5, 1, '#b08655', true, 1.4);
        for (let x = -48; x <= 44; x += 10) rrect(g, x, -7, 7, 13, 2, '#e8d7b5', true, 1.4);
      });
    case 'spikes':
      return cached('spikes', 94, 30, g => {
        rrect(g, -45, -5, 90, 10, 2, '#3a3d44', true, 1.6);
        g.fillStyle = '#c9ccd2';
        for (let x = -42; x <= 40; x += 8) {
          g.beginPath(); g.moveTo(x, -4); g.lineTo(x + 4, -12); g.lineTo(x + 8, -4); g.fill();
          g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 4, 12); g.lineTo(x + 8, 4); g.fill();
        }
      });
    case 'bus':
      return cached('bus', 128, 74, g => {
        shadow(g, 62, 30, 8);
        rrect(g, -60, -30, 120, 60, 7, '#f2b134', true, 2.2);
        rrect(g, -54, -24, 108, 48, 4, '#e5a21f', false);
        for (let i = 0; i < 6; i++) rrect(g, -50 + i * 17, -27, 12, 6, 2, '#4a6b8a', true, 1);
        for (let i = 0; i < 6; i++) rrect(g, -50 + i * 17, 21, 12, 6, 2, '#4a6b8a', true, 1);
        rrect(g, -60, -10, 8, 20, 2, '#3d5a73', true, 1.4);
        g.fillStyle = OUTLINE; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('SCHOOL BUS', 4, 0);
      });
    case 'median':
      return cached('median' + h, 32, h + 8, g => {
        rrect(g, -13, -h / 2, 26, h, 6, '#a9a49a', true, 2);
        rrect(g, -8, -h / 2 + 4, 10, h - 8, 4, '#c4bfb4', false);
        g.fillStyle = '#ffb627';
        for (let y = -h / 2 + 20; y < h / 2 - 10; y += 60) { g.beginPath(); g.moveTo(-6, y); g.lineTo(6, y - 8); g.lineTo(6, y - 2); g.lineTo(-6, y + 6); g.fill(); }
      });
    case 'cagebars':
      return cached('cagebars', 52, 52, g => {
        g.strokeStyle = OUTLINE; g.lineWidth = 4.5;
        g.strokeRect(-22, -22, 44, 44);
        g.strokeStyle = '#a9b0b8'; g.lineWidth = 2.6;
        g.strokeRect(-22, -22, 44, 44);
        for (let x = -14; x <= 14; x += 7) {
          g.strokeStyle = OUTLINE; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, -22); g.lineTo(x, 22); g.stroke();
          g.strokeStyle = '#c0c6cd'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, -22); g.lineTo(x, 22); g.stroke();
        }
      });
    case 'medkit':
      return cached('medkit', 36, 36, g => {
        rrect(g, -14, -12, 28, 24, 4, '#f4f1de', true, 2);
        rrect(g, -3, -8, 6, 16, 1, '#e63946', false);
        rrect(g, -8, -3, 16, 6, 1, '#e63946', false);
      });
    case 'ammo_pick':
      return cached('ammo_pick', 36, 36, g => {
        for (let i = 0; i < 3; i++) { rrect(g, -9 + i * 6, -9, 5, 18, 2.5, '#e9c46a', true, 1.4); rrect(g, -9 + i * 6, -9, 5, 6, 2.5, '#b08d3c', false); }
      });
  }
  return cached('none', 4, 4, () => {});
}

function drawCar(g: CanvasRenderingContext2D, v: number) {
  const burnt = v === 3;
  const col = burnt ? '#3b3532' : CAR_COLORS[v % CAR_COLORS.length];
  shadow(g, 30, 46, 6);
  rrect(g, -27, -44, 54, 88, 10, col, true, 2.2);
  // wheels
  for (const [x, y] of [[-29, -28], [23, -28], [-29, 18], [23, 18]]) rrect(g, x, y, 6, 14, 2, '#1c1c20', false);
  rrect(g, -21, -26, 42, 16, 5, burnt ? '#1e1b1a' : '#9cc3d8', true, 1.6); // windshield
  rrect(g, -22, -8, 44, 34, 6, burnt ? '#2c2725' : shade(col, -0.15), true, 1.6); // roof
  rrect(g, -19, 26, 38, 10, 4, burnt ? '#1e1b1a' : '#7aa4ba', true, 1.4); // rear window
  if (!burnt) {
    rrect(g, -16, -5, 14, 24, 4, shade(col, 0.15), false);
    // cracks
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-6, -24); g.lineTo(0, -18); g.lineTo(8, -22); g.moveTo(0, -18); g.lineTo(2, -11); g.stroke();
    ellipse(g, 12, 32, 4, 3, 'rgba(120,60,20,0.6)', false);
  } else {
    for (const [x, y, r] of [[-8, -30, 5], [10, 10, 7], [-12, 30, 4]]) ellipse(g, x, y, r, r * 0.8, 'rgba(255,120,30,0.35)', false);
  }
  rrect(g, -24, -45, 10, 4, 2, '#fff4c2', false);
  rrect(g, 14, -45, 10, 4, 2, '#fff4c2', false);
}

export function buildAll() {
  buildZombieSprites();
  buildDecals();
  for (const cls of Object.keys(ALLIES) as AllyClassId[]) { survivorSprite(cls, 0); survivorSprite(cls, 0, false); }
}
