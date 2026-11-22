/** Procedural WebAudio sound effects + a light generative music loop. No asset files. */
class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  noiseBuf!: AudioBuffer;
  enabled = true;
  musicOn = true;
  private last = new Map<string, number>();
  private musicTimer = 0;
  private step = 0;
  private intensity = 0;
  private nextNote = 0;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.7 : 0;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.22 : 0;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.ctx) this.master.gain.value = on ? 0.7 : 0;
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.value = on ? 0.22 : 0;
  }
  suspend() { this.ctx?.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  private noise(t: number, dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', q = 1) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(gn).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private tone(t: number, dur: number, vol: number, f0: number, f1: number, type: OscillatorType = 'square', bus?: GainNode) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** throttled playback: ignore repeats of the same id within `gap` seconds */
  play(id: string) {
    const c = this.ctx;
    if (!c || !this.enabled || c.state !== 'running') return;
    const t = c.currentTime;
    const gaps: Record<string, number> = {
      pistol: 0.06, smg: 0.05, rifle: 0.05, minigun: 0.045, ally: 0.07, ally_sg: 0.08, flamer: 0.09, shotgun: 0.05,
      zdeath: 0.04, zdeath_big: 0.08, hurt: 0.08, coin: 0.035, explosion: 0.06, gas: 0.08, splat: 0.05, beep: 0.1, spark: 0.05,
    };
    const gap = gaps[id] ?? 0.03;
    if (t - (this.last.get(id) ?? -1) < gap) return;
    this.last.set(id, t);
    const r = Math.random();
    switch (id) {
      case 'pistol': this.noise(t, 0.09, 0.32, 3200, 400); this.tone(t, 0.06, 0.12, 300, 90); break;
      case 'smg': this.noise(t, 0.06, 0.22, 4000, 600); break;
      case 'rifle': this.noise(t, 0.1, 0.3, 2600, 300); this.tone(t, 0.07, 0.1, 220, 70); break;
      case 'minigun': this.noise(t, 0.05, 0.2, 3500, 700); break;
      case 'shotgun': this.noise(t, 0.22, 0.5, 1800, 120); this.tone(t, 0.12, 0.2, 140, 40, 'sawtooth'); break;
      case 'launcher': this.noise(t, 0.25, 0.3, 900, 200, 'bandpass', 2); this.tone(t, 0.2, 0.12, 180, 60, 'triangle'); break;
      case 'flamer': this.noise(t, 0.16, 0.12, 900, 300, 'bandpass', 0.7); break;
      case 'railgun': this.tone(t, 0.35, 0.25, 1800, 120, 'sawtooth'); this.noise(t, 0.2, 0.2, 6000, 1500, 'highpass'); break;
      case 'ally': this.noise(t, 0.07, 0.14, 2800 + r * 600, 500); break;
      case 'ally_sg': this.noise(t, 0.15, 0.22, 1600, 150); break;
      case 'sniper': this.noise(t, 0.16, 0.3, 5000, 300); this.tone(t, 0.12, 0.08, 900, 120, 'triangle'); break;
      case 'throw': this.tone(t, 0.15, 0.08, 400, 900, 'triangle'); break;
      case 'zdeath': this.noise(t, 0.12, 0.18, 900 + r * 400, 150, 'bandpass', 2); this.tone(t, 0.12, 0.06, 160 + r * 40, 60, 'sawtooth'); break;
      case 'zdeath_big': this.noise(t, 0.3, 0.3, 600, 80, 'lowpass'); this.tone(t, 0.3, 0.12, 110, 40, 'sawtooth'); break;
      case 'hurt': this.tone(t, 0.14, 0.18, 220, 90, 'square'); break;
      case 'mdeath': this.tone(t, 0.45, 0.22, 330, 60, 'sawtooth'); this.noise(t, 0.3, 0.2, 800, 100); break;
      case 'explosion': this.noise(t, 0.7, 0.7, 1200, 40); this.tone(t, 0.5, 0.35, 90, 30, 'sine'); break;
      case 'gas': this.noise(t, 0.6, 0.4, 700, 60, 'bandpass', 1.5); this.tone(t, 0.3, 0.15, 70, 40, 'sine'); break;
      case 'coin': this.tone(t, 0.08, 0.07, 1400 + r * 300, 2200, 'triangle'); break;
      case 'crate': this.noise(t, 0.2, 0.35, 1400, 200, 'bandpass', 1.4); break;
      case 'wood': this.noise(t, 0.15, 0.25, 1100, 200, 'bandpass', 2); break;
      case 'cage': this.tone(t, 0.25, 0.12, 900, 500, 'triangle'); this.noise(t, 0.2, 0.2, 5000, 1500, 'highpass'); break;
      case 'weapon': [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.06, 0.18, 0.12, f, f, 'square')); break;
      case 'recruit': [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.06, 0.16, 0.1, f, f * 1.01, 'triangle')); break;
      case 'power': this.tone(t, 0.35, 0.14, 300, 1400, 'sawtooth'); break;
      case 'heal': [660, 880].forEach((f, i) => this.tone(t + i * 0.08, 0.2, 0.1, f, f, 'sine')); break;
      case 'ammo': this.noise(t, 0.08, 0.2, 5000, 2000, 'highpass'); this.tone(t + 0.05, 0.08, 0.08, 800, 800, 'square'); break;
      case 'good': [784, 988, 1175].forEach((f, i) => this.tone(t + i * 0.05, 0.15, 0.1, f, f, 'triangle')); break;
      case 'ambush': this.tone(t, 0.4, 0.16, 200, 100, 'sawtooth'); break;
      case 'empty': this.tone(t, 0.06, 0.1, 1200, 1100, 'square'); this.tone(t + 0.09, 0.06, 0.1, 900, 800, 'square'); break;
      case 'alarm': [0, 0.22].forEach(d => this.tone(t + d, 0.18, 0.12, 880, 660, 'square')); break;
      case 'horde': this.noise(t, 1.2, 0.3, 400, 120, 'bandpass', 1); this.tone(t, 1, 0.12, 80, 60, 'sawtooth'); break;
      case 'bossroar': this.tone(t, 1.1, 0.3, 140, 45, 'sawtooth'); this.noise(t, 1, 0.35, 600, 90, 'bandpass', 1.2); break;
      case 'bossdeath': this.noise(t, 1.8, 0.8, 900, 30); this.tone(t, 1.6, 0.4, 120, 25, 'sawtooth'); break;
      case 'spit': this.noise(t, 0.18, 0.2, 2000, 600, 'bandpass', 3); break;
      case 'splat': this.noise(t, 0.16, 0.22, 900, 200, 'bandpass', 2); break;
      case 'scream': this.tone(t, 0.7, 0.18, 1400, 900, 'sawtooth'); this.tone(t, 0.7, 0.12, 1460, 950, 'square'); break;
      case 'ring': this.tone(t, 0.5, 0.18, 600, 1200, 'sine'); break;
      case 'slam': this.noise(t, 0.6, 0.6, 400, 40); this.tone(t, 0.5, 0.4, 60, 25, 'sine'); break;
      case 'throw_big': this.noise(t, 0.4, 0.3, 300, 1200, 'bandpass', 1); break;
      case 'thud': this.tone(t, 0.25, 0.3, 120, 40, 'sine'); break;
      case 'heli': this.noise(t, 1.4, 0.25, 200, 150, 'lowpass'); for (let i = 0; i < 8; i++) this.noise(t + i * 0.12, 0.08, 0.2, 300, 120); break;
      case 'strike': for (let i = 0; i < 5; i++) this.tone(t + i * 0.05, 0.3, 0.06, 1200 - i * 100, 300, 'sine'); break;
      case 'beep': this.tone(t, 0.06, 0.12, 1500, 1500, 'square'); break;
      case 'victory': [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.12, 0.35, 0.14, f, f, 'triangle')); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.2, 0.4, 0.14, f, f * 0.98, 'sawtooth')); break;
      case 'click': this.tone(t, 0.05, 0.1, 900, 700, 'square'); break;
      case 'buy': [660, 990].forEach((f, i) => this.tone(t + i * 0.06, 0.12, 0.1, f, f, 'square')); break;
      case 'star': this.tone(t, 0.3, 0.14, 880, 1760, 'triangle'); break;
    }
  }

  /** simple driving pulse: bass + hats, intensity follows the action */
  music(dt: number, intensity: number, playing: boolean) {
    const c = this.ctx;
    if (!c || !this.musicOn || !this.enabled || c.state !== 'running') return;
    this.intensity += (intensity - this.intensity) * Math.min(1, dt * 2);
    if (!playing) return;
    if (this.nextNote < c.currentTime) this.nextNote = c.currentTime + 0.05;
    const spb = 60 / 128 / 2;
    while (this.nextNote < c.currentTime + 0.12) {
      const t = this.nextNote;
      const s = this.step % 32;
      const bass = [41, 41, 0, 41, 44, 0, 41, 0, 39, 39, 0, 39, 36, 0, 39, 0];
      const n = bass[s % 16];
      if (n) {
        const f = 440 * Math.pow(2, (n - 69 + 12) / 12);
        this.tone(t, spb * 0.9, 0.16, f, f, 'sawtooth', this.musicBus);
      }
      if (s % 4 === 0) { this.tone(t, 0.18, 0.5, 120, 40, 'sine', this.musicBus); }
      if (this.intensity > 0.25 && s % 2 === 1) this.hat(t, 0.05 + this.intensity * 0.06);
      if (this.intensity > 0.55 && s % 8 === 4) this.snare(t);
      this.step++;
      this.nextNote += spb;
    }
    void this.musicTimer;
  }

  private hat(t: number, vol: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }
  private snare(t: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.16);
  }
}

export const audio = new Audio();
