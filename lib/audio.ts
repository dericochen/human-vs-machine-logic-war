// Original synthesized audio via the Web Audio API — no external assets, no
// network, no licensing concerns. Music and SFX are generated from oscillators
// and noise. Audio starts only after the first user gesture (browser policy).

type SfxKind = "click" | "correct" | "wrong" | "start" | "stageUp" | "finalTick" | "victory" | "defeat";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private intensity = 0;
  musicMuted = false;
  sfxMuted = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.5, when = 0, dest?: AudioNode): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest ?? this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noiseBurst(dur: number, vol = 0.3, when = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    src.connect(filter).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  play(kind: SfxKind): void {
    if (this.sfxMuted) return;
    switch (kind) {
      case "click":
        this.tone(660, 0.06, "triangle", 0.35);
        break;
      case "correct":
        this.tone(880, 0.12, "triangle", 0.5);
        this.tone(1320, 0.18, "triangle", 0.45, 0.09);
        break;
      case "wrong":
        this.tone(220, 0.2, "sawtooth", 0.3);
        this.tone(160, 0.28, "sawtooth", 0.3, 0.08);
        break;
      case "start":
        this.tone(440, 0.3, "sawtooth", 0.35);
        this.tone(880, 0.4, "sawtooth", 0.35, 0.2);
        break;
      case "stageUp":
        this.tone(523, 0.12, "square", 0.3);
        this.tone(659, 0.12, "square", 0.3, 0.1);
        this.tone(784, 0.2, "square", 0.3, 0.2);
        break;
      case "finalTick":
        this.tone(1200, 0.04, "square", 0.25);
        break;
      case "victory":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.5, i * 0.12));
        break;
      case "defeat":
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.35, i * 0.14));
        break;
    }
  }

  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    const scale = [220, 261.63, 329.63, 392, 440, 523.25];
    const tick = () => {
      if (!this.ctx || !this.musicGain || this.musicMuted) return;
      // Ambient bass pad + sparse arpeggio; intensity raises note density.
      const bass = 55 + this.intensity * 4;
      this.tone(bass, 1.6, "sine", 0.4, 0, this.musicGain);
      if (this.step % (this.intensity > 6 ? 1 : 2) === 0) {
        const note = scale[(this.step + this.intensity) % scale.length];
        this.tone(note, 0.3, "triangle", 0.12, 0, this.musicGain);
      }
      this.step++;
    };
    tick();
    this.musicTimer = setInterval(tick, 480);
  }

  setIntensity(n: number): void {
    this.intensity = Math.max(0, Math.min(10, n));
  }

  stopMusic(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setMusicMuted(m: boolean): void {
    this.musicMuted = m;
    if (this.musicGain) this.musicGain.gain.value = m ? 0 : 0.16;
  }

  setSfxMuted(m: boolean): void {
    this.sfxMuted = m;
    if (this.sfxGain) this.sfxGain.gain.value = m ? 0 : 0.5;
  }
}

export const audio = new AudioEngine();
