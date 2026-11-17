// Every sound in EMBERKEEP is synthesized with WebAudio at run time: no audio
// files ship with the game, so nothing loads over the network and the dossier
// stays small. Each effect is a short oscillator/noise gesture with its own
// shape, and the ambient drone is two detuned sines under a low-pass filter.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.drone = null;
  }

  // The context is created on the first user gesture (a click or key press), so
  // autoplay rules never block it. In headless runs it stays null and every
  // method below is a silent no-op.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone({ type = 'sine', from = 440, to = null, dur = 0.1, vol = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.15, vol = 0.2, low = 400, high = 4000, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone({ type: 'square', from: 720, to: 320, dur: 0.07, vol: 0.08 }); }
  hit() { this.tone({ type: 'triangle', from: 300, to: 180, dur: 0.05, vol: 0.1 }); }
  die() {
    this.tone({ type: 'sine', from: 420, to: 60, dur: 0.22, vol: 0.16 });
    this.noise({ dur: 0.12, vol: 0.1, low: 800, high: 3000 });
  }
  shard(step = 0) {
    const base = 660 + Math.min(step, 12) * 32;
    this.tone({ type: 'sine', from: base, to: base * 1.5, dur: 0.09, vol: 0.1 });
  }
  hurt() {
    this.tone({ type: 'sawtooth', from: 160, to: 50, dur: 0.3, vol: 0.22 });
    this.noise({ dur: 0.2, vol: 0.16, low: 200, high: 900 });
  }
  heal() { this.tone({ type: 'sine', from: 520, to: 880, dur: 0.18, vol: 0.12 }); }
  waveStart() {
    this.tone({ type: 'triangle', from: 220, dur: 0.16, vol: 0.16 });
    this.tone({ type: 'triangle', from: 330, dur: 0.22, vol: 0.16, delay: 0.14 });
  }
  upgrade() {
    [523, 659, 784].forEach((f, i) => this.tone({ type: 'sine', from: f, dur: 0.14, vol: 0.12, delay: i * 0.07 }));
  }
  bossRoar() {
    this.tone({ type: 'sawtooth', from: 90, to: 45, dur: 0.7, vol: 0.22 });
    this.noise({ dur: 0.5, vol: 0.12, low: 100, high: 500 });
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.14, delay: i * 0.18 }));
  }
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'sine', from: f, dur: 0.25, vol: 0.14, delay: i * 0.12 }));
  }

  // A quiet two-voice drone that starts once, under everything else.
  startDrone() {
    if (!this.ctx || this.drone || this.muted) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const a = this.ctx.createOscillator();
    a.type = 'sine';
    a.frequency.value = 55;
    const b = this.ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = 55.7;
    a.connect(filter);
    b.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    a.start();
    b.start();
    this.drone = { gain, a, b };
  }
}
