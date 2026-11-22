import type { Boss } from '../sim/world';
import { OUTLINE, ellipse, rrect } from './sprites';

/** Bosses are unique, so they are drawn procedurally every frame. Origin = boss center. */
export function drawBoss(g: CanvasRenderingContext2D, b: Boss, flash: boolean) {
  const t = b.anim;
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.globalAlpha = b.alpha;
  // ground shadow
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(4, b.r * 0.35, b.r * 1.15, b.r * 0.75, 0, 0, Math.PI * 2); g.fill();
  switch (b.kind) {
    case 'butcher': butcher(g, b, t); break;
    case 'brood': brood(g, b, t); break;
    case 'siren': siren(g, b, t); break;
    case 'colossus': colossus(g, b, t); break;
  }
  if (flash) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(-b.r * 2, -b.r * 2, b.r * 4, b.r * 4);
  }
  g.restore();
}

function butcher(g: CanvasRenderingContext2D, b: Boss, t: number) {
  const charge = b.state === 'charge';
  const s = Math.sin(t * (charge ? 16 : 5));
  const R = b.r;
  // legs
  rrect(g, -R * 0.45, -R * 0.75 + s * 6, R * 0.32, R * 0.55, 6, '#3b2f2a');
  rrect(g, R * 0.13, -R * 0.75 - s * 6, R * 0.32, R * 0.55, 6, '#3b2f2a');
  // arms
  rrect(g, -R * 1.05, -R * 0.2 + s * 4, R * 0.32, R * 0.85, 8, '#9db07e');
  rrect(g, R * 0.73, -R * 0.2 - s * 4, R * 0.32, R * 0.85, 8, '#9db07e');
  // cleaver
  g.save();
  g.translate(R * 0.9, R * 0.62 - s * 4);
  g.rotate(charge ? 0.2 : 0.5 + s * 0.2);
  rrect(g, -3, -6, 6, 16, 2, '#4a3426');
  rrect(g, -12, 8, 24, 22, 3, '#c9ced6');
  g.fillStyle = 'rgba(140,20,20,0.8)'; g.fillRect(-10, 20, 12, 8);
  g.restore();
  // body + apron
  ellipse(g, 0, 0, R * 0.95, R * 0.72, '#8fae6c', true, 3);
  rrect(g, -R * 0.55, -R * 0.35, R * 1.1, R * 0.95, 10, '#e8e2d4', true, 2.5);
  g.fillStyle = 'rgba(150,20,20,0.75)';
  for (const [x, y, r] of [[-8, 0, 9], [10, 12, 7], [-2, 22, 6], [14, -6, 5]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  // head
  ellipse(g, 0, R * 0.35, R * 0.38, R * 0.34, '#a3b98a', true, 2.5);
  ellipse(g, 0, R * 0.52, R * 0.18, R * 0.12, '#d4a6a0', true, 1.5);
  ellipse(g, -R * 0.15, R * 0.32, 3, 3, '#ff3b1f', false);
  ellipse(g, R * 0.15, R * 0.32, 3, 3, '#ff3b1f', false);
}

function brood(g: CanvasRenderingContext2D, b: Boss, t: number) {
  const R = b.r;
  // legs
  g.strokeStyle = OUTLINE;
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const a = side * (0.5 + k * 0.45) + Math.sin(t * 4 + i) * 0.12;
    const x1 = Math.sin(a) * R * 1.1, y1 = Math.cos(a) * R * 0.9;
    const x2 = Math.sin(a) * R * 1.6, y2 = Math.cos(a) * R * 1.4 + 10;
    g.lineWidth = 9; g.strokeStyle = OUTLINE;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(x1, y1 - 8); g.lineTo(x2, y2); g.stroke();
    g.lineWidth = 5; g.strokeStyle = '#5e3a6e';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(x1, y1 - 8); g.lineTo(x2, y2); g.stroke();
  }
  // abdomen with eggs
  const pulse = 1 + Math.sin(t * 3) * 0.04;
  ellipse(g, 0, -R * 0.35, R * 0.95 * pulse, R * 0.8 * pulse, '#8e44ad', true, 3);
  for (const [x, y, r] of [[-18, -30, 9], [14, -40, 8], [0, -14, 10], [22, -16, 7], [-24, -8, 6]]) ellipse(g, x, y, r * pulse, r * pulse, '#e0b3ff', true, 1.6);
  // head
  ellipse(g, 0, R * 0.42, R * 0.55, R * 0.42, '#6c3483', true, 3);
  for (const [x, y] of [[-10, 0.5], [10, 0.5], [-5, 0.6], [5, 0.6], [0, 0.48]]) ellipse(g, x, R * y, 3.4, 3.4, '#d6ff3a', true, 1);
  ellipse(g, 0, R * 0.78, 9, 6, '#2a0a24', true, 2);
}

function siren(g: CanvasRenderingContext2D, b: Boss, t: number) {
  const R = b.r;
  const glow = g.createRadialGradient(0, 0, 4, 0, 0, R * 2.4);
  glow.addColorStop(0, 'rgba(255,79,216,0.55)');
  glow.addColorStop(1, 'rgba(255,79,216,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(0, 0, R * 2.4, 0, Math.PI * 2); g.fill();
  // flowing hair
  g.fillStyle = '#1d1621';
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const rr = R * (1.1 + Math.sin(t * 6 + i) * 0.12);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 1.2 - 4);
  }
  g.closePath(); g.fill();
  // body
  ellipse(g, 0, -R * 0.1, R * 0.6, R * 0.5, '#6b3e75', true, 2.5);
  // arms spread
  rrect(g, -R * 1.1, -R * 0.2 + Math.sin(t * 3) * 3, R * 0.6, 8, 4, '#e6e1d3');
  rrect(g, R * 0.5, -R * 0.2 - Math.sin(t * 3) * 3, R * 0.6, 8, 4, '#e6e1d3');
  // head
  ellipse(g, 0, R * 0.35, R * 0.42, R * 0.42, '#e6e1d3', true, 2.5);
  const open = 0.5 + Math.abs(Math.sin(t * 5)) * 0.6;
  ellipse(g, 0, R * 0.55, 6, 5 * open, '#2a0a24', true, 1.5);
  ellipse(g, -6, R * 0.3, 2.6, 2.6, '#ff5cf0', false);
  ellipse(g, 6, R * 0.3, 2.6, 2.6, '#ff5cf0', false);
}

function colossus(g: CanvasRenderingContext2D, b: Boss, t: number) {
  const R = b.r;
  const s = Math.sin(t * 2.5);
  const raise = b.state === 'slam' ? Math.min(1, b.t / 0.8) : b.state === 'throw' ? Math.min(1, b.t / 0.6) : 0;
  // legs
  rrect(g, -R * 0.6, -R * 0.95 + s * 5, R * 0.42, R * 0.6, 10, '#4a3b33');
  rrect(g, R * 0.18, -R * 0.95 - s * 5, R * 0.42, R * 0.6, 10, '#4a3b33');
  // fists
  const fy = R * 0.55 - raise * R * 0.9;
  ellipse(g, -R * 1.05, fy + s * 4, R * 0.36, R * 0.36, '#7e8f5e', true, 3);
  ellipse(g, R * 1.05, fy - s * 4, R * 0.36, R * 0.36, '#7e8f5e', true, 3);
  rrect(g, -R * 1.15, -R * 0.2, R * 0.3, fy + R * 0.2, 10, '#869a63');
  rrect(g, R * 0.85, -R * 0.2, R * 0.3, fy + R * 0.2, 10, '#869a63');
  // armored torso
  ellipse(g, 0, 0, R * 1.0, R * 0.78, '#6f8052', true, 3.5);
  rrect(g, -R * 0.7, -R * 0.45, R * 0.6, R * 0.5, 8, '#5b5f66', true, 2.5);
  rrect(g, R * 0.1, -R * 0.4, R * 0.55, R * 0.45, 8, '#5b5f66', true, 2.5);
  // glowing cracks
  g.strokeStyle = `rgba(255,140,40,${0.6 + Math.sin(t * 6) * 0.3})`;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-20, 10); g.lineTo(-6, 18); g.lineTo(4, 8); g.lineTo(18, 20);
  g.moveTo(-30, -6); g.lineTo(-18, -2);
  g.stroke();
  // head
  ellipse(g, 0, R * 0.45, R * 0.36, R * 0.3, '#7e8f5e', true, 3);
  rrect(g, -R * 0.3, R * 0.38, R * 0.6, 7, 3, '#2b2b2b', false);
  ellipse(g, -8, R * 0.43, 3.4, 2.6, '#ff8c1a', false);
  ellipse(g, 8, R * 0.43, 3.4, 2.6, '#ff8c1a', false);
}
