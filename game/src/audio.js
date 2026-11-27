// Procedural sound effects with plain WebAudio — no audio files, no network.
// The context is created on the first user gesture (browsers block audio before
// that), and every effect is a short oscillator/gain envelope.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // One envelope: freq slides from f0 to f1 over `dur` seconds.
  tone(f0, f1, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.buffer = buf;
    src.connect(gain).connect(this.ctx.destination);
    src.start(t0);
  }

  click() { this.tone(700, 500, 0.06, 'square', 0.08); }
  jump() { this.tone(280, 620, 0.16, 'sine', 0.16); }
  pickup() { this.tone(880, 1320, 0.09, 'sine', 0.14); this.tone(1320, 1760, 0.1, 'sine', 0.1, 0.07); }
  hit() { this.noise(0.18, 0.25); this.tone(180, 60, 0.25, 'sawtooth', 0.18); }
  gobble() {
    // Three quick low clucks, the turkey announcing itself.
    this.tone(320, 180, 0.09, 'square', 0.12, 0);
    this.tone(300, 170, 0.09, 'square', 0.12, 0.12);
    this.tone(340, 150, 0.14, 'square', 0.14, 0.24);
  }
  caught() {
    // Sad descending trombone-ish line.
    this.tone(392, 370, 0.22, 'sawtooth', 0.14, 0);
    this.tone(370, 349, 0.22, 'sawtooth', 0.14, 0.22);
    this.tone(349, 311, 0.3, 'sawtooth', 0.14, 0.44);
    this.tone(311, 233, 0.5, 'sawtooth', 0.16, 0.66);
  }
  escaped() {
    // Bright little fanfare.
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.16, i * 0.11));
    this.tone(1047, 1319, 0.3, 'triangle', 0.14, 0.46);
  }
}
