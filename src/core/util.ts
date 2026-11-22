export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
/** frame-rate independent exponential smoothing factor */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Mulberry32 seeded RNG */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  weighted<T>(items: readonly [T, number][]): T {
    let total = 0;
    for (const [, w] of items) total += w;
    let r = this.next() * total;
    for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
    return items[items.length - 1][0];
  }
}

/** Uniform spatial hash grid storing indices into an external array. Rebuilt every frame. */
export class SpatialGrid {
  readonly cell: number;
  private cols: number;
  private rows: number;
  private heads: Int32Array;
  private next: Int32Array;
  private originY = 0;
  constructor(width: number, height: number, cell: number, capacity = 4096) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell) + 2;
    this.rows = Math.ceil(height / cell) + 2;
    this.heads = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(capacity);
  }
  reset(originY: number) {
    this.originY = originY;
    this.heads.fill(-1);
  }
  private key(x: number, y: number) {
    const cx = clamp(Math.floor(x / this.cell) + 1, 0, this.cols - 1);
    const cy = clamp(Math.floor((y - this.originY) / this.cell) + 1, 0, this.rows - 1);
    return cy * this.cols + cx;
  }
  insert(i: number, x: number, y: number) {
    if (i >= this.next.length) {
      const n = new Int32Array(this.next.length * 2);
      n.set(this.next);
      this.next = n;
    }
    const k = this.key(x, y);
    this.next[i] = this.heads[k];
    this.heads[k] = i;
  }
  /** Writes indices of entries in cells overlapping the query box into out; returns count. */
  queryInto(x: number, y: number, r: number, out: number[]): number {
    const c = this.cell;
    const x0 = clamp(Math.floor((x - r) / c) + 1, 0, this.cols - 1);
    const x1 = clamp(Math.floor((x + r) / c) + 1, 0, this.cols - 1);
    const y0 = clamp(Math.floor((y - r - this.originY) / c) + 1, 0, this.rows - 1);
    const y1 = clamp(Math.floor((y + r - this.originY) / c) + 1, 0, this.rows - 1);
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let i = this.heads[cy * this.cols + cx];
        while (i !== -1) {
          out[n++] = i;
          i = this.next[i];
        }
      }
    }
    return n;
  }
  /** Calls fn for each index in cells overlapping the query circle. Return true from fn to stop. */
  query(x: number, y: number, r: number, fn: (i: number) => boolean | void) {
    const c = this.cell;
    const x0 = clamp(Math.floor((x - r) / c) + 1, 0, this.cols - 1);
    const x1 = clamp(Math.floor((x + r) / c) + 1, 0, this.cols - 1);
    const y0 = clamp(Math.floor((y - r - this.originY) / c) + 1, 0, this.rows - 1);
    const y1 = clamp(Math.floor((y + r - this.originY) / c) + 1, 0, this.rows - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let i = this.heads[cy * this.cols + cx];
        while (i !== -1) {
          if (fn(i)) return;
          i = this.next[i];
        }
      }
    }
  }
}
