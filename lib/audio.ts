/**
 * Every sound in the game, synthesized with WebAudio: no files, nothing to
 * download. One shared engine for both views.
 *
 * - The AudioContext is only created on the first user gesture (autoplay rules).
 * - Mode is "all" (music + effects), "sfx" (effects only) or "off", remembered
 *   in localStorage (wrapped in try/catch through lib/storage).
 * - Volumes are deliberately low: this plays next to a video call.
 * - Suspends while the tab is hidden.
 */
import type { ThemeId } from "@/src/engine";
import { readJSON, writeJSON } from "./storage";

export type SoundMode = "all" | "sfx" | "off";
export type Sfx =
  | "step"
  | "slide"
  | "bump"
  | "locked"
  | "door"
  | "key"
  | "star"
  | "lantern"
  | "checkpoint"
  | "portal"
  | "appear"
  | "fall"
  | "swirl"
  | "unswirl"
  | "win"
  | "tick"
  | "go"
  | "pin"
  | "tap";

const MODE_KEY = "laberinto.sound.v1";
const MASTER = 0.8;
const MUSIC = 0.24;

type Wave = OscillatorType;

interface Theme {
  /** MIDI root of the music. */
  root: number;
  /** Scale degrees (semitones) the melody picks from. */
  scale: number[];
  /** Chord roots (semitones over root) cycled every bar. */
  chords: number[];
  /** Seconds per beat. */
  beat: number;
  pad: Wave;
  pluck: Wave;
  /** Pad brightness (lowpass Hz). */
  bright: number;
  /** Chance a beat gets a melody note. */
  density: number;
  /** Step sound: band center, Q, filter kind. */
  step: { freq: number; q: number; type: BiquadFilterType; gain: number };
}

const THEMES: Record<ThemeId, Theme> = {
  forest: {
    root: 62, // D
    scale: [0, 2, 4, 7, 9, 12, 14],
    chords: [0, 7, 9, 5],
    beat: 0.62,
    pad: "triangle",
    pluck: "triangle",
    bright: 1400,
    density: 0.45,
    step: { freq: 700, q: 0.9, type: "bandpass", gain: 0.5 },
  },
  cave: {
    root: 57, // A
    scale: [0, 3, 5, 7, 10, 12, 15],
    chords: [0, -4, -2, -5],
    beat: 0.8,
    pad: "sine",
    pluck: "sine",
    bright: 900,
    density: 0.3,
    step: { freq: 1900, q: 4, type: "bandpass", gain: 0.42 },
  },
  ice: {
    root: 64, // E
    scale: [0, 2, 4, 6, 7, 11, 12, 14],
    chords: [0, 2, -3, -1],
    beat: 0.72,
    pad: "sine",
    pluck: "sine",
    bright: 2200,
    density: 0.35,
    step: { freq: 4200, q: 0.7, type: "highpass", gain: 0.36 },
  },
  desert: {
    root: 60, // C, phrygian-dominant flavor
    scale: [0, 1, 4, 5, 7, 8, 12],
    chords: [0, 1, 0, -2],
    beat: 0.68,
    pad: "sawtooth",
    pluck: "triangle",
    bright: 750,
    density: 0.4,
    step: { freq: 1100, q: 0.6, type: "lowpass", gain: 0.5 },
  },
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Listener = () => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private echo!: GainNode;
  private noiseBuf!: AudioBuffer;
  private modeValue: SoundMode = "all";
  private loaded = false;
  private listeners = new Set<Listener>();
  private music: { theme: ThemeId; timer: number; next: number; beat: number } | null = null;
  private wantMusic: ThemeId | null = null;
  private lastStep = 0;
  private stepFlip = false;

  get mode(): SoundMode {
    if (!this.loaded) {
      this.loaded = true;
      const m = readJSON<SoundMode>(MODE_KEY, "all");
      this.modeValue = m === "all" || m === "sfx" || m === "off" ? m : "all";
    }
    return this.modeValue;
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    if (this.listeners.size === 1) window.addEventListener("storage", this.onStorage);
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) window.removeEventListener("storage", this.onStorage);
    };
  };

  /** Another tab of this device changed the sound setting. */
  private onStorage = (e: StorageEvent) => {
    if (e.key !== MODE_KEY) return;
    this.loaded = false;
    const m = this.mode;
    this.setMode(m);
  };

  setMode(m: SoundMode): void {
    this.modeValue = m;
    this.loaded = true;
    writeJSON(MODE_KEY, m);
    this.listeners.forEach((fn) => fn());
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m === "off" ? 0 : MASTER, this.ctx.currentTime, 0.05);
    if (m !== "all") this.stopMusic(false);
    else if (this.wantMusic) this.startMusic(this.wantMusic);
  }

  /** Call from a user gesture: creates or resumes the context. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.build();
    }
    if (this.ctx.state === "suspended" && document.visibilityState === "visible") void this.ctx.resume();
    if (this.wantMusic && !this.music) this.startMusic(this.wantMusic);
  }

  private build(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.mode === "off" ? 0 : MASTER;
    // A gentle limiter so stacked sounds never clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.0001;
    this.musicBus.connect(this.master);
    // Shared echo: a soft feedback delay both buses can send to.
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.5;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    this.echo.connect(delay).connect(tone).connect(fb).connect(delay);
    tone.connect(this.master);
    // One second of white noise, reused by every noisy sound.
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.visibilityState === "hidden") void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  // ───────────────────────────────────────────── building blocks

  private tone(
    freq: number,
    at: number,
    dur: number,
    o: { type?: Wave; gain?: number; attack?: number; to?: number; bus?: AudioNode; echo?: number; vibrato?: number } = {},
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 9;
      depth.gain.value = o.vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
    }
    const peak = o.gain ?? 0.2;
    const attack = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, attack + 0.02));
    osc.connect(g).connect(o.bus ?? this.sfxBus);
    if (o.echo) {
      const send = ctx.createGain();
      send.gain.value = o.echo;
      g.connect(send).connect(this.echo);
    }
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private noise(at: number, dur: number, o: { type: BiquadFilterType; freq: number; q?: number; gain: number; to?: number; echo?: number }): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.freq, at);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(o.gain, at + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    if (o.echo) {
      const send = ctx.createGain();
      send.gain.value = o.echo;
      g.connect(send).connect(this.echo);
    }
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  private arp(notes: number[], at: number, gap: number, o: Parameters<AudioEngine["tone"]>[3] & { len?: number }): void {
    notes.forEach((m, i) => this.tone(hz(m), at + i * gap, o.len ?? 0.3, o));
  }

  // ───────────────────────────────────────────── effects

  play(name: Sfx, theme: ThemeId = "forest"): void {
    if (this.mode === "off" || !this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case "step": {
        // Rate-limited, alternating feet, a touch of pitch drift.
        if (t - this.lastStep < 0.07) return;
        this.lastStep = t;
        this.stepFlip = !this.stepFlip;
        const s = THEMES[theme].step;
        const f = s.freq * (this.stepFlip ? 1 : 0.86) * (0.95 + Math.random() * 0.1);
        this.noise(t, 0.055, { type: s.type, freq: f, q: s.q, gain: s.gain * 0.22, echo: theme === "cave" ? 0.5 : 0 });
        if (theme === "forest" || theme === "desert") this.tone(this.stepFlip ? 150 : 130, t, 0.05, { gain: 0.05 });
        break;
      }
      case "slide":
        this.noise(t, 0.42, { type: "bandpass", freq: 3200, to: 1300, q: 1.4, gain: 0.07 });
        this.tone(1568, t, 0.35, { gain: 0.018, to: 1320 });
        break;
      case "bump":
        this.tone(120, t, 0.11, { gain: 0.16, to: 70 });
        this.noise(t, 0.05, { type: "lowpass", freq: 600, gain: 0.05 });
        break;
      case "locked":
        this.tone(233, t, 0.1, { type: "square", gain: 0.035 });
        this.tone(196, t + 0.11, 0.16, { type: "square", gain: 0.035 });
        this.tone(90, t, 0.12, { gain: 0.12 });
        break;
      case "door":
        this.tone(95, t, 0.18, { gain: 0.16, to: 60 });
        this.noise(t + 0.02, 0.35, { type: "bandpass", freq: 420, to: 260, q: 6, gain: 0.05 });
        this.arp([72, 76, 79], t + 0.18, 0.07, { type: "triangle", gain: 0.07, echo: 0.3 });
        break;
      case "key":
        this.arp([81, 86, 90, 93], t, 0.06, { type: "triangle", gain: 0.08, len: 0.25, echo: 0.35 });
        this.tone(hz(105), t + 0.22, 0.4, { gain: 0.02, echo: 0.4 });
        break;
      case "star":
        this.arp([84, 88, 91, 96], t, 0.05, { gain: 0.09, len: 0.32, echo: 0.45 });
        this.arp([103, 100], t + 0.24, 0.06, { gain: 0.025, len: 0.2, echo: 0.5 });
        break;
      case "lantern":
        [67, 71, 74, 79].forEach((m) => this.tone(hz(m), t, 1.2, { type: "triangle", gain: 0.035, attack: 0.25, echo: 0.2 }));
        this.tone(hz(91), t + 0.3, 0.6, { gain: 0.03, echo: 0.4 });
        break;
      case "checkpoint":
        this.arp([76, 81], t, 0.12, { type: "triangle", gain: 0.09, len: 0.45, echo: 0.3 });
        this.noise(t, 0.18, { type: "bandpass", freq: 900, q: 0.8, gain: 0.03 });
        break;
      case "portal":
        this.tone(260, t, 0.4, { gain: 0.08, to: 1250, vibrato: 30, echo: 0.4 });
        this.noise(t, 0.4, { type: "bandpass", freq: 500, to: 3500, q: 3, gain: 0.04 });
        break;
      case "appear":
        this.tone(1100, t, 0.3, { gain: 0.06, to: 520, vibrato: 20, echo: 0.3 });
        break;
      case "fall":
        this.tone(760, t, 0.5, { type: "triangle", gain: 0.1, to: 110 });
        this.tone(70, t + 0.48, 0.25, { gain: 0.2, to: 45 });
        this.noise(t + 0.48, 0.22, { type: "lowpass", freq: 500, gain: 0.08 });
        break;
      case "swirl":
        this.tone(520, t, 0.6, { type: "triangle", gain: 0.06, to: 300, vibrato: 90 });
        this.tone(780, t + 0.05, 0.55, { gain: 0.03, to: 460, vibrato: 120, echo: 0.3 });
        break;
      case "unswirl":
        this.arp([72, 79], t, 0.07, { gain: 0.06, len: 0.18 });
        break;
      case "win": {
        this.arp([72, 76, 79, 84], t, 0.11, { type: "triangle", gain: 0.1, len: 0.4, echo: 0.3 });
        [72, 76, 79, 84, 88].forEach((m) => this.tone(hz(m), t + 0.5, 1.6, { type: "triangle", gain: 0.045, attack: 0.03, echo: 0.3 }));
        this.arp([96, 100, 103, 108], t + 0.55, 0.08, { gain: 0.025, len: 0.3, echo: 0.5 });
        break;
      }
      case "tick":
        this.tone(660, t, 0.14, { gain: 0.1 });
        break;
      case "go":
        [76, 83, 88].forEach((m) => this.tone(hz(m), t, 0.5, { type: "triangle", gain: 0.07, echo: 0.3 }));
        break;
      case "pin":
        this.tone(940, t, 0.06, { gain: 0.06, to: 620 });
        break;
      case "tap":
        this.tone(520, t, 0.04, { gain: 0.04 });
        break;
    }
  }

  // ───────────────────────────────────────────── music

  /** Soft generative ambience for a theme. Plays only in "all" mode. */
  startMusic(theme: ThemeId): void {
    this.wantMusic = theme;
    if (!this.ctx || this.mode !== "all") return;
    if (this.music?.theme === theme) return;
    this.stopMusic(false);
    const th = THEMES[theme];
    // Start after the old tails have faded under the closed bus.
    this.music = { theme, timer: 0, next: this.ctx.currentTime + 0.6, beat: 0 };
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
    this.musicBus.gain.setTargetAtTime(MUSIC, this.ctx.currentTime + 0.6, 1.2);
    const schedule = () => {
      const m = this.music;
      if (!m || !this.ctx) return;
      while (m.next < this.ctx.currentTime + 1.2) {
        this.musicBeat(th, m.beat, m.next);
        m.beat++;
        m.next += th.beat;
      }
    };
    schedule();
    this.music.timer = window.setInterval(schedule, 300);
  }

  stopMusic(forget = true): void {
    if (forget) this.wantMusic = null;
    if (!this.music) return;
    window.clearInterval(this.music.timer);
    this.music = null;
    if (this.ctx) {
      // Fade out; tails already scheduled die under the closed bus.
      const t = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setTargetAtTime(0.0001, t, 0.4);
    }
  }

  private musicBeat(th: Theme, beat: number, at: number): void {
    const ctx = this.ctx!;
    const bar = Math.floor(beat / 8);
    const chordRoot = th.root - 12 + th.chords[bar % th.chords.length];
    // Pad: one slow chord every 8 beats.
    if (beat % 8 === 0) {
      const len = th.beat * 8 + 1.2;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = th.bright;
      filter.connect(this.musicBus);
      const minorish = th.scale.includes(3) || th.scale.includes(1);
      for (const iv of [0, minorish ? 3 : 4, 7, 12]) {
        for (const det of [-6, 6]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = th.pad;
          osc.frequency.value = hz(chordRoot + iv);
          osc.detune.value = det;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.linearRampToValueAtTime(th.pad === "sawtooth" ? 0.05 : 0.09, at + 1.6);
          g.gain.setValueAtTime(th.pad === "sawtooth" ? 0.05 : 0.09, at + len - 1.4);
          g.gain.linearRampToValueAtTime(0.0001, at + len);
          osc.connect(g).connect(filter);
          osc.start(at);
          osc.stop(at + len + 0.05);
        }
      }
    }
    // Melody: sparse plucks from the scale, more likely on strong beats.
    const strong = beat % 2 === 0;
    if (Math.random() < th.density * (strong ? 1.3 : 0.6)) {
      const note = th.root + th.scale[Math.floor(Math.random() * th.scale.length)];
      this.tone(hz(note), at, th.beat * 1.6, { type: th.pluck, gain: 0.13, attack: 0.01, bus: this.musicBus, echo: 0.25 });
    }
    // Cave drips.
    if (th === THEMES.cave && Math.random() < 0.12) {
      this.tone(hz(th.root + 36 + Math.floor(Math.random() * 5)), at + th.beat / 2, 0.12, { gain: 0.05, to: hz(th.root + 31), bus: this.musicBus, echo: 0.6 });
    }
  }
}

export const audio = new AudioEngine();

/** Wire the first-gesture unlock once (call from the app root). */
export function installAudioUnlock(): () => void {
  const go = () => audio.unlock();
  const opts = { capture: true, passive: true } as const;
  window.addEventListener("pointerdown", go, opts);
  window.addEventListener("keydown", go, opts);
  window.addEventListener("touchend", go, opts);
  return () => {
    window.removeEventListener("pointerdown", go, opts);
    window.removeEventListener("keydown", go, opts);
    window.removeEventListener("touchend", go, opts);
  };
}

/** Phone buzz, when the device has one. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // some browsers throw when called without a gesture
  }
}
