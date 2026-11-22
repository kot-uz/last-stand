import { clamp } from './util';

/** Relative drag (touch/mouse anywhere) + keyboard. Produces a horizontal delta in logical px. */
export class Input {
  private dx = 0;
  private pointer: number | null = null;
  private lastX = 0;
  private mouseX: number | null = null;
  private left = false;
  private right = false;
  sensitivity = 1.35;
  getScale: () => number = () => 1;
  onPause: () => void = () => {};
  onFirstInput: () => void = () => {};
  touched = false;

  attach(el: HTMLElement) {
    el.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.pointer = e.pointerId;
      this.lastX = e.clientX;
      this.touched = true;
      this.onFirstInput();
    });
    window.addEventListener('pointermove', e => {
      // Desktop mouse: the squad follows the cursor without holding a button.
      if (e.pointerType === 'mouse') {
        if (this.mouseX !== null) this.dx += ((e.clientX - this.mouseX) / this.getScale()) * this.sensitivity;
        this.mouseX = e.clientX;
        return;
      }
      if (e.pointerId !== this.pointer) return;
      this.dx += ((e.clientX - this.lastX) / this.getScale()) * this.sensitivity;
      this.lastX = e.clientX;
    });
    const up = (e: PointerEvent) => { if (e.pointerId === this.pointer) this.pointer = null; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.left = true; this.touched = true; this.onFirstInput(); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.right = true; this.touched = true; this.onFirstInput(); }
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause();
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.right = false;
    });
    document.documentElement.addEventListener('mouseleave', () => { this.mouseX = null; });
    window.addEventListener('blur', () => { this.mouseX = null; this.left = this.right = false; this.pointer = null; });
  }

  /** apply accumulated input to a target x */
  apply(targetX: number, dt: number, min: number, max: number): number {
    let x = targetX + this.dx;
    this.dx = 0;
    if (this.left) x -= 600 * dt;
    if (this.right) x += 600 * dt;
    return clamp(x, min, max);
  }

  /** drop accumulated movement (e.g. mouse hover while in menus/pause) */
  flush() { this.dx = 0; }

  reset() { this.dx = 0; this.pointer = null; }
}
