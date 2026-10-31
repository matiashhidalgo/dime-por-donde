import {
  DIFFICULTIES,
  DX,
  DY,
  type Dir,
  KEY_COLORS,
  type Game,
  type Inversion,
  type PlayEvent,
  type PlayState,
  SEEN,
  type StepResult,
  createPlay,
  doorName,
  keyName,
  portalName,
  refreshSight,
  starCount,
  stepPlay,
  visibility,
  visionRadius,
} from "@/src/engine";
import { type Sfx, audio } from "@/lib/audio";
import { type Particle, type Scene, TRAIL_LIFE, buildRows, draw, themePalette } from "./render";

/**
 * Runs the explorer view outside React: input → engine step → animation →
 * draw. The loop only spins while something moves; at rest it ticks slowly
 * for ambient life (or not at all with reduced motion).
 */

export interface HudState {
  /** Stars collected so far. */
  stars: number;
  keys: number;
  checkpointIndex: number;
  pits: number;
  lanternUntil: number;
  invert: Inversion | null;
  /** Names of what's close by, for describing out loud. */
  nearby: string[];
  arrived: boolean;
}

export interface ControllerOptions {
  game: Game;
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  fonts: Scene["fonts"];
  onHud: (h: HudState) => void;
  onEvent: (e: PlayEvent, s: PlayState) => void;
  onArrive: (s: PlayState) => void;
}

type Seg =
  | { kind: "walk"; fx: number; fy: number; tx: number; ty: number; dur: number; slide: boolean }
  | { kind: "bump"; dir: Dir; dur: number }
  | { kind: "vanish"; dur: number; fall: boolean }
  | { kind: "jump"; x: number; y: number }
  | { kind: "appear"; dur: number }
  | { kind: "apply" }
  | { kind: "sfx"; name: Sfx }
  | { kind: "puff"; big: boolean };

const WALK_MS = 125;
const SLIDE_MS = 70;
const AMBIENT_FPS = 24;

export class ExplorerController {
  private game: Game;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: ControllerOptions;
  private scene: Scene;
  private logic: PlayState;
  private pending: StepResult | null = null;
  private queue: Seg[] = [];
  private segStart = 0;
  private buffer: Dir | null = null;
  private held: Dir[] = [];
  private raf = 0;
  private timer = 0;
  private last = 0;
  private dpr = 1;
  private dist: Int8Array;
  private lanternActive = false;
  private arrivedAt = 0;
  private openedDoors = new Set<number>();
  private burstDoors = new Set<number>();
  private disposed = false;
  readonly perf = { frames: 0, drawMs: 0, maxDrawMs: 0, slowFrames: 0 };

  constructor(opts: ControllerOptions) {
    this.opts = opts;
    this.game = opts.game;
    this.canvas = opts.canvas;
    this.ctx = opts.canvas.getContext("2d", { alpha: false })!;
    const now = Date.now();
    this.logic = createPlay(this.game, now);
    const n = this.game.grid.width * this.game.grid.height;
    const sx = (this.game.start % this.game.grid.width) + 0.5;
    const sy = Math.floor(this.game.start / this.game.grid.width) + 0.5;
    this.scene = {
      game: this.game,
      pal: themePalette(this.game),
      state: this.logic,
      vis: new Float32Array(n),
      target: new Float32Array(n),
      inSight: new Uint8Array(n),
      cam: { x: sx, y: sy },
      tile: 48,
      width: 0,
      height: 0,
      time: 0,
      player: { x: sx, y: sy, facing: 2, squash: 0, scale: 1, alpha: 1, hop: 0 },
      shake: 0,
      particles: [],
      trail: [],
      invertFx: 0,
      invertBoth: false,
      lanternFx: 0,
      rows: buildRows(this.game),
      fonts: opts.fonts,
    };
    this.dist = new Int8Array(n);
    this.computeTargets();
    this.scene.vis.set(this.scene.target);
    this.emitHud();
  }

  get state(): PlayState {
    return this.logic;
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.scene.width = width;
    this.scene.height = height;
    const vision = DIFFICULTIES[this.game.level].vision;
    // Sight diameter (+ a margin) fits the short side; phones get bigger cells.
    this.scene.tile = Math.round(Math.max(44, Math.min(84, Math.min(width, height) / (2 * vision + 1.8))));
    this.wake();
  }

  /** A direction was pressed (keyboard, swipe or pad). */
  press(dir: Dir, hold: boolean): void {
    if (hold && !this.held.includes(dir)) this.held.push(dir);
    if (this.logic.arrived) return;
    if (this.queue.length > 0) this.buffer = dir;
    else this.step(dir);
    this.wake();
  }

  release(dir?: Dir): void {
    this.held = dir === undefined ? [] : this.held.filter((d) => d !== dir);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
  }

  // ───────────────────────────────────────────── stepping

  private step(input: Dir): void {
    const r = stepPlay(this.game, this.logic, input, Date.now());
    const p = this.scene.player;
    p.facing = r.dir;
    if (r.outcome === "blocked" || r.outcome === "locked") {
      this.queue.push({ kind: "sfx", name: r.outcome === "locked" ? "locked" : "bump" }, { kind: "bump", dir: r.dir, dur: 150 }, { kind: "puff", big: false });
      if (r.outcome === "locked") for (const e of r.events) this.opts.onEvent(e, this.logic);
      this.startQueue();
      return;
    }
    this.logic = r.state;
    this.pending = r;
    const W = this.game.grid.width;
    const pos = (c: number) => [(c % W) + 0.5, Math.floor(c / W) + 0.5] as const;
    let [fx, fy] = [p.x, p.y];
    const walkCells = r.outcome === "teleported" ? r.trail.slice(0, -1) : r.trail;
    const slide = walkCells.length > 1;
    // A door this explorer has the key for swings open the first time through.
    const door = r.trail.find((c) => this.game.occupant[c]?.type === "door" && !this.openedDoors.has(c));
    if (door !== undefined) {
      this.openedDoors.add(door);
      this.queue.push({ kind: "sfx", name: "door" });
    }
    this.queue.push({ kind: "sfx", name: slide ? "slide" : "step" });
    walkCells.forEach((c) => {
      const [tx, ty] = pos(c);
      this.queue.push({ kind: "walk", fx, fy, tx, ty, dur: slide ? SLIDE_MS : WALK_MS, slide });
      [fx, fy] = [tx, ty];
    });
    if (r.outcome === "teleported") {
      const [tx, ty] = pos(r.state.cell);
      this.queue.push(
        { kind: "sfx", name: "portal" },
        { kind: "vanish", dur: 200, fall: false },
        { kind: "apply" },
        { kind: "jump", x: tx, y: ty },
        { kind: "sfx", name: "appear" },
        { kind: "appear", dur: 220 },
        { kind: "puff", big: false },
      );
    } else if (r.outcome === "fell") {
      const [tx, ty] = pos(r.state.cell);
      this.queue.push(
        { kind: "sfx", name: "fall" },
        { kind: "vanish", dur: 320, fall: true },
        { kind: "apply" },
        { kind: "jump", x: tx, y: ty },
        { kind: "appear", dur: 300 },
        { kind: "puff", big: true },
      );
    } else {
      this.queue.push({ kind: "apply" });
    }
    this.startQueue();
  }

  private startQueue(): void {
    this.segStart = performance.now();
  }

  /** The animation reached the point where the move "happens". */
  private apply(): void {
    const r = this.pending;
    this.pending = null;
    if (!r) return;
    this.scene.state = r.state;
    this.computeTargets();
    const p = this.scene.player;
    const reduce = this.opts.reducedMotion;
    for (const e of r.events) {
      this.opts.onEvent(e, r.state);
      const sound = EVENT_SFX[e.type];
      if (sound) audio.play(sound, this.game.theme);
      if (reduce) continue;
      if (e.type === "star") this.burst(p.x, p.y, 14, ["#f2b84b", "#ffe08a", "#fff6d1"], true);
      if (e.type === "key") this.burst(p.x, p.y, 10, ["#ffffff", "#fff2c2"], false);
      if (e.type === "lantern") this.burst(p.x, p.y, 10, ["#ffd166", "#fff1c1"], false);
      if (e.type === "checkpoint") this.burst(p.x, p.y, 12, ["#3d9a5f", "#7fd49b", "#ffffff"], false);
      if (e.type === "swirl") this.burst(p.x, p.y, 12, ["#8a5cf0", "#c5a8ff", "#5b2fa0"], false, 0.8);
      if (e.type === "fell") this.scene.shake = 1;
      if (e.type === "arrived") this.burst(p.x, p.y, 46, ["#e07a5f", "#f2b84b", "#3d9a5f", "#3d6fd8", "#d6589f", "#ffffff"], false, 1.6);
    }
    if (!reduce) {
      for (const c of r.trail) {
        const o = this.game.occupant[c];
        if (o?.type === "door" && this.openedDoors.has(c) && !this.burstDoors.has(c)) {
          this.burstDoors.add(c);
          const [x, y] = this.cellCenter(c);
          this.burst(x, y, 10, [KEY_COLORS[o.color].hex, "#ffffff"], false, 0.8);
        }
      }
    }
    if (r.state.arrived) this.arrivedAt = performance.now();
    this.emitHud();
  }

  private computeTargets(): void {
    const s = this.scene.state;
    const now = Date.now();
    const R = visionRadius(this.game, s, now);
    this.lanternActive = now < s.lanternUntil;
    this.dist = visibility(this.game, s.cell, R, s.keys);
    const memory = DIFFICULTIES[this.game.level].memory;
    const memAlpha = memory === "full" ? 0.34 : memory === "dim" ? 0.15 : 0;
    const { target, inSight } = this.scene;
    for (let c = 0; c < target.length; c++) {
      const d = this.dist[c];
      if (d >= 0) {
        target[c] = 1 - 0.42 * Math.pow(d / (R + 0.5), 2);
        inSight[c] = 1;
      } else {
        target[c] = s.memo[c] & SEEN ? memAlpha : 0;
        inSight[c] = 0;
      }
    }
    this.scene.invertBoth = s.invert?.axes === "xy";
  }

  private emitHud(): void {
    const s = this.scene.state;
    const nearby: string[] = [];
    const items: { d: number; name: string }[] = [];
    for (const row of this.scene.rows) {
      for (const it of row) {
        const d = this.dist[it.cell];
        if (d < 0 || d > 2) continue;
        let name: string | null = null;
        if (it.kind === "landmark") name = it.landmark.label;
        else {
          const o = this.game.occupant[it.cell]!;
          if (o.type === "key" && !(s.keys & (1 << o.color))) name = keyName(o.color);
          else if (o.type === "door") name = doorName(o.color);
          else if (o.type === "portal") name = portalName(this.game.portals[o.pair].symbol);
          else if (o.type === "exit") name = "la salida";
          else if (o.type === "checkpoint") name = "una bandera";
        }
        if (name) items.push({ d, name });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) if (!nearby.includes(it.name) && nearby.length < 3) nearby.push(it.name);
    this.opts.onHud({
      stars: starCount(s),
      keys: s.keys,
      checkpointIndex: s.checkpointIndex,
      pits: s.pits,
      lanternUntil: s.lanternUntil,
      invert: s.invert,
      nearby,
      arrived: s.arrived,
    });
  }

  private burst(x: number, y: number, n: number, colors: string[], star: boolean, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 3) * 0.4;
      const sp = (0.9 + ((i * 37) % 10) / 12) * power;
      this.scene.particles.push({
        x,
        y: y - 0.2,
        z: 0.3,
        vx: Math.cos(a) * sp * 1.4,
        vy: Math.sin(a) * sp * 0.9,
        vz: 2.2 * power + ((i * 13) % 7) / 6,
        life: 900 * power,
        max: 900 * power,
        color: colors[i % colors.length],
        size: star ? 0.09 : 0.045,
        star,
      });
    }
  }

  /** Little dust ring on the floor: landing after a jump, or a bonk on a wall. */
  private puff(big: boolean): void {
    if (this.opts.reducedMotion) return;
    const p = this.scene.player;
    const n = big ? 12 : 5;
    const dust = this.scene.pal.wallTop;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = big ? 1.4 : 0.7;
      this.scene.particles.push({
        x: p.x + (big ? 0 : DX[p.facing] * 0.3),
        y: p.y + 0.1 + (big ? 0 : DY[p.facing] * 0.3),
        z: 0.05,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.6,
        vz: 0.6,
        life: big ? 520 : 320,
        max: big ? 520 : 320,
        color: dust,
        size: big ? 0.06 : 0.04,
        star: false,
      });
    }
  }

  // ───────────────────────────────────────────── loop

  private wake(): void {
    if (this.disposed) return;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(t: number): void {
    if (this.disposed) return;
    // Clamped: timestamps can jump around after tab switches.
    const dt = this.last ? Math.max(0, Math.min(50, t - this.last)) : 16;
    this.last = t;
    const sc = this.scene;
    sc.time = t;
    const busy = this.update(t, dt);

    if (sc.width > 0) {
      const t0 = performance.now();
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      draw(this.ctx, sc);
      const ms = performance.now() - t0;
      const p = this.perf;
      p.frames++;
      p.drawMs += (ms - p.drawMs) * 0.05;
      p.maxDrawMs = Math.max(p.maxDrawMs, ms);
      if (dt > 20) p.slowFrames++;
    }

    if (this.arrivedAt && t - this.arrivedAt > (this.opts.reducedMotion ? 600 : 1400)) {
      this.arrivedAt = 0;
      this.opts.onArrive(this.logic);
    }

    if (busy || this.arrivedAt) {
      this.raf = requestAnimationFrame((n) => this.frame(n));
    } else if (!this.opts.reducedMotion) {
      this.last = 0;
      this.timer = window.setTimeout(() => {
        this.raf = requestAnimationFrame((n) => this.frame(n));
      }, 1000 / AMBIENT_FPS);
    } else {
      this.last = 0;
    }
  }

  /** Advances animations. Returns true while anything is still moving. */
  private update(t: number, dt: number): boolean {
    const sc = this.scene;
    const p = sc.player;
    const reduce = this.opts.reducedMotion;
    let busy = false;

    // Movement queue. Instant segments (apply, jump) run back to back; timed
    // ones hold the queue until done. When it drains, the buffered or held
    // direction starts the next move right away, so walking feels continuous.
    let landedFrom: Seg["kind"] | null = null;
    while (this.queue.length > 0) {
      const seg = this.queue[0];
      if (seg.kind === "apply") this.apply();
      else if (seg.kind === "sfx") audio.play(seg.name, this.game.theme);
      else if (seg.kind === "puff") this.puff(seg.big);
      else if (seg.kind === "jump") {
        p.x = seg.x;
        p.y = seg.y;
      } else {
        const dur = reduce ? Math.min(seg.dur, 60) : seg.dur;
        const k = Math.max(0, Math.min(1, (t - this.segStart) / dur));
        if (seg.kind === "walk") {
          const e = seg.slide ? k : easeInOut(k);
          p.x = seg.fx + (seg.tx - seg.fx) * e;
          p.y = seg.fy + (seg.ty - seg.fy) * e;
          p.hop = seg.slide || reduce ? 0 : Math.sin(Math.PI * k) * 0.09;
          p.squash = seg.slide ? -0.12 : reduce ? 0 : Math.sin(Math.PI * k) * 0.3;
          if (seg.slide && !reduce) {
            const last = sc.trail[sc.trail.length - 1];
            if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.12) sc.trail.push({ x: p.x, y: p.y, life: TRAIL_LIFE });
          }
          landedFrom = "walk";
        } else if (seg.kind === "bump") {
          const amt = Math.sin(Math.PI * k) * 0.12;
          const base = this.cellCenter(this.logic.cell);
          p.x = base[0] + DX[seg.dir] * amt;
          p.y = base[1] + DY[seg.dir] * amt;
          p.squash = -Math.sin(Math.PI * k) * 0.35;
          landedFrom = "bump";
        } else if (seg.kind === "vanish") {
          p.scale = 1 - k * 0.85;
          p.alpha = 1 - k;
          p.hop = seg.fall ? -k * 0.4 : k * 0.25;
        } else if (seg.kind === "appear") {
          p.scale = 0.4 + 0.6 * k;
          p.alpha = k;
          p.hop = (1 - k) * 0.35;
          landedFrom = "appear";
        }
        if (k < 1) {
          busy = true;
          break;
        }
        if (seg.kind === "appear") {
          p.scale = 1;
          p.alpha = 1;
          p.hop = 0;
        }
      }
      this.queue.shift();
      this.segStart = t;
      if (this.queue.length === 0) {
        p.hop = 0;
        p.squash = landedFrom === "walk" && !reduce ? -0.25 : 0; // land
        const next = this.buffer ?? (this.held.length ? this.held[this.held.length - 1] : null);
        this.buffer = null;
        if (next !== null && !this.logic.arrived) this.step(next);
        this.segStart = t;
      }
    }
    if (this.queue.length > 0) busy = true;

    // Squash settles back.
    if (Math.abs(p.squash) > 0.005 && this.queue.length === 0) {
      p.squash *= Math.exp(-dt / 70);
      busy = true;
    } else if (this.queue.length === 0) p.squash = 0;

    // Camera follows; a long jump (portal, respawn) travels faster.
    const dx = p.x - sc.cam.x;
    const dy = p.y - sc.cam.y;
    const far = Math.hypot(dx, dy) > 4;
    const kc = reduce ? 1 : 1 - Math.exp(-dt / (far ? 90 : 140));
    sc.cam.x += dx * kc;
    sc.cam.y += dy * kc;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) busy = true;
    else {
      sc.cam.x = p.x;
      sc.cam.y = p.y;
    }

    // Fog eases in and out.
    const kv = reduce ? 1 : 1 - Math.exp(-dt / 150);
    let fogMoving = false;
    const { vis, target } = sc;
    for (let i = 0; i < vis.length; i++) {
      const d = target[i] - vis[i];
      if (d === 0) continue;
      if (Math.abs(d) < 0.004) vis[i] = target[i];
      else {
        vis[i] += d * kv;
        fogMoving = true;
      }
    }
    busy ||= fogMoving;

    // Lantern and inversion effects.
    const now = Date.now();
    if (this.lanternActive && now >= sc.state.lanternUntil) {
      this.logic = refreshSight(this.game, this.logic, now);
      if (!this.pending) this.scene.state = this.logic;
      this.computeTargets();
      this.emitHud();
      busy = true;
    }
    // Not `busy ||= ease(…)`: that would skip the easing whenever busy is already true.
    const lanternEasing = ease(sc, "lanternFx", this.lanternActive ? 1 : 0, dt, reduce);
    const invertEasing = ease(sc, "invertFx", sc.state.invert ? 1 : 0, dt, reduce);
    busy = busy || lanternEasing || invertEasing;
    if (sc.shake > 0) {
      sc.shake = reduce ? 0 : Math.max(0, sc.shake - dt / 380);
      busy = true;
    }

    // Ice trail fades from the tail.
    if (sc.trail.length) {
      for (const q of sc.trail) q.life -= dt;
      while (sc.trail.length && sc.trail[0].life <= 0) sc.trail.shift();
      busy = true;
    }

    // Particles.
    if (sc.particles.length) {
      const s = dt / 1000;
      for (const q of sc.particles) {
        q.x += q.vx * s;
        q.y += q.vy * s;
        q.z = Math.max(0, q.z + q.vz * s);
        q.vz -= 7 * s;
        q.vx *= 0.97;
        q.vy *= 0.97;
        q.life -= dt;
      }
      sc.particles = sc.particles.filter((q) => q.life > 0);
      busy = true;
    }
    return busy;
  }

  private cellCenter(c: number): [number, number] {
    const W = this.game.grid.width;
    return [(c % W) + 0.5, Math.floor(c / W) + 0.5];
  }
}

function ease(sc: Scene, key: "lanternFx" | "invertFx", to: number, dt: number, reduce: boolean): boolean {
  const d = to - sc[key];
  if (Math.abs(d) < 0.01) {
    sc[key] = to;
    return false;
  }
  sc[key] += reduce ? d : d * (1 - Math.exp(-dt / 220));
  return true;
}

const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Sounds played when the move lands (the fall and portal sounds play earlier, with their animation). */
const EVENT_SFX: Partial<Record<PlayEvent["type"], Sfx>> = {
  key: "key",
  star: "star",
  lantern: "lantern",
  checkpoint: "checkpoint",
  swirl: "swirl",
  unswirl: "unswirl",
  arrived: "win",
};
