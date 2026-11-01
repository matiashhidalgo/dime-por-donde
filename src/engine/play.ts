import { type Curse, type CurseKind, cursedDir, drawCurse } from "./curses";
import { DIRS, type Dir, bfs, isOpen, neighbor } from "./grid";
import { createRng, hashString } from "./rng";
import { canReach, stateGraph } from "./reach";
import { invertDir, isLockedFor, resolveMove } from "./rules";
import { type ShadowRun, advanceBody, initShadowRun, retreat, shadowWorld, stunNear, touches } from "./shadow";
import { TUNING } from "./tuning";
import type { LockFeedback } from "./lock";
import type { Game } from "./types";

/**
 * The explorer's game state and rules, move by move (GAME_SPEC_V2.md §3).
 * Pure and clock-free: every step returns a fresh state, and the same inputs
 * always give the same round. Movement itself is `resolveMove` — the same
 * function the solver uses — so the player can do exactly what the fairness
 * checks proved possible.
 *
 *  - 3 shared hearts. A pit or burning out costs one; 0 = the expedition ends.
 *  - A candle burns one unit per move and sight shrinks with it (3 → 2 → 1 →
 *    dark). Lanterns refill it, the small route candles top it up. Too long in
 *    the dark costs a heart and relights it partway.
 *  - A pit drops you somewhere far (seeded by the fall number), and your keys
 *    stay down there.
 *  - v1 swirls invert controls for longer and thicken the fog; in v2 a swirl
 *    lays a curse instead (curses.ts), lifted by time or by a cure key.
 *  - v2: with 1 or 2 seals and in danger, the exit offers an emergency way out.
 *  - Streak maps play with shorter candles and fewer free tries (PlayRules).
 */

/** Per-cell memory flags. */
export const SEEN = 1;
export const VISITED = 2;
export const PIT_KNOWN = 4;

export interface Inversion {
  axes: "x" | "xy";
  /** Moves left before controls go back to normal. */
  left: number;
}

/** Rules this expedition is played with (single games: the tuning values). */
export interface PlayRules {
  /** Candle units when full. */
  maxLight: number;
  lockFreeTries: number;
  keyFreeTries: number;
  healEvery: number;
}

/**
 * Single expeditions use the tuning values; a streak map applies its PLAY
 * level (map index + escapes × escapeBump, explorer's device only).
 */
export function playRules(opts: { streak?: boolean; level?: number } = {}): PlayRules {
  if (!opts.streak) {
    return {
      maxLight: TUNING.candle.max,
      lockFreeTries: TUNING.trials.lockFreeTries,
      keyFreeTries: TUNING.trials.keyFreeTries,
      healEvery: TUNING.seal.healEvery,
    };
  }
  const L = Math.max(0, Math.floor(opts.level ?? 0));
  const st = TUNING.streak;
  return {
    maxLight: Math.round(TUNING.candle.max * Math.max(st.candleFloor, st.candleStart - st.candleShrink * L)),
    lockFreeTries: Math.max(1, TUNING.trials.lockFreeTries - Math.floor(L / st.lockFreeEvery)),
    keyFreeTries: L >= st.keyFreeUntil ? 0 : TUNING.trials.keyFreeTries,
    healEvery: st.healEvery,
  };
}

export interface PlayState {
  rules: PlayRules;
  cell: number;
  /** Key mask (bit = KEY_COLORS index). Lost on a fall. */
  keys: number;
  hearts: number;
  /** Hearts lost so far (heals don't undo it): what a streak tallies. */
  hurts: number;
  /** Candle units left, 0..rules.maxLight. */
  light: number;
  /** Moves made in total darkness since the light went out. */
  dark: number;
  /** Falls so far (also the index of the next landing draw). */
  pits: number;
  /** Cells already used as landing spots (never reused). */
  landings: number[];
  /** Bitmask of collected star indices. */
  stars: number;
  /** Bitmask of used lantern indices. */
  lanterns: number;
  /** Bitmask of used route candles (game.checkpoints indices). */
  candles: number;
  invert: Inversion | null;
  /** v2: the curse in force, if any. */
  curse: Curse | null;
  /** v2: curses laid so far (the next one is number `curses`). */
  curses: number;
  /** v2: curses lifted with a cure key. */
  cured: number;
  /** v2: bitmask of seals won (station indices). */
  seals: number;
  /** v2: La Sombra's bodies, if this map has one (moves only when the explorer does). */
  shadow: ShadowRun | null;
  /** Ticks so far: inputs that went somewhere or waited. What the Sombra's clock counts. */
  ticks: number;
  /** Times it touched the explorer. */
  touches: number;
  /** v2: what happened at each station so far (survives leaving and coming back). */
  trials: TrialProgress[];
  /** SEEN | VISITED | PIT_KNOWN per cell. */
  memo: Uint8Array;
  /** Inputs that actually moved you (falls included). */
  moves: number;
  arrived: boolean;
  /** Arrived through the emergency exit (1 or 2 seals). */
  escaped: boolean;
  lost: boolean;
}

export interface TrialProgress {
  /** Every failure (free ones included). */
  fails: number;
  /** Failures that cost light (every TUNING.trials.heartEvery-th also a heart). */
  paid: number;
  /** Figures picked wrongly (direction B), so they stay crossed out. */
  wrong: number[];
  /** Lock combinations tried, with what the lock answered. */
  guesses: { guess: number[]; feedback: LockFeedback }[];
  /** Wrong seal keys typed. */
  keyErrors: number;
  /** Piano, direction B: melodies checked and how many notes sat in place. */
  melodies: { answer: number[]; right: number }[];
}

export type HurtCause = "pit" | "dark" | "trial" | "shadow";

export type PlayEvent =
  | { type: "blocked" }
  | { type: "locked"; color: number; cell: number }
  | { type: "slid"; cells: number }
  | { type: "teleported"; pair: number; from: number; to: number }
  | { type: "fell"; pit: number; landing: number; keysLost: number }
  | { type: "hurt"; cause: HurtCause; hearts: number }
  | { type: "dimmed"; radius: number }
  | { type: "darkness" }
  | { type: "burnout" }
  | { type: "key"; color: number }
  | { type: "star"; index: number; count: number }
  | { type: "lantern"; index: number }
  | { type: "candle"; index: number }
  | { type: "swirl"; axes: "x" | "xy"; steps: number }
  | { type: "unswirl" }
  | { type: "curse"; k: number; kind: CurseKind; steps: number }
  | { type: "uncurse"; k: number; cured: boolean }
  | { type: "shadowTouch"; hearts: number }
  | { type: "shadowStunned"; count: number }
  | { type: "waited" }
  | { type: "emergencyExit"; seals: number }
  | { type: "arrived" }
  | { type: "defeat"; cause: HurtCause }
  | { type: "station"; index: number; sealed: boolean }
  | { type: "exitSealed"; missing: number; emergency: boolean }
  | { type: "trialFail"; index: number; paid: boolean }
  | { type: "seal"; index: number; count: number }
  | { type: "heal"; hearts: number }
  | { type: "exitOpen" };

export interface StepResult {
  state: PlayState;
  events: PlayEvent[];
  /** Direction actually walked after any inversion. */
  dir: Dir;
  /**
   * Cells the body passes through, in order, for animation: walking/sliding
   * cells, then (on a teleport) the partner portal, or (on a fall) the pit.
   */
  trail: number[];
  outcome: "blocked" | "locked" | "moved" | "teleported" | "fell" | "waited";
}

/**
 * Fresh expedition. A streak map passes the hearts carried from the last map
 * and its play level.
 */
export function createPlay(game: Game, opts: { hearts?: number; level?: number } = {}): PlayState {
  const memo = new Uint8Array(game.grid.width * game.grid.height);
  memo[game.start] |= VISITED;
  const rules = playRules({ streak: !!game.streak, level: opts.level });
  const s: PlayState = {
    rules,
    cell: game.start,
    keys: 0,
    hearts: Math.max(1, Math.min(TUNING.hearts, opts.hearts ?? TUNING.hearts)),
    hurts: 0,
    light: rules.maxLight,
    dark: 0,
    pits: 0,
    landings: [],
    stars: 0,
    lanterns: 0,
    candles: 0,
    invert: null,
    curse: null,
    curses: 0,
    cured: 0,
    seals: 0,
    shadow: game.shadow ? initShadowRun(game.shadow) : null,
    ticks: 0,
    touches: 0,
    trials: (game.stations ?? []).map(() => ({ fails: 0, paid: 0, wrong: [], guesses: [], keyErrors: 0, melodies: [] })),
    memo,
    moves: 0,
    arrived: false,
    escaped: false,
    lost: false,
  };
  markSeen(game, s);
  return s;
}

/** Candle sight before fog: 3, 2, 1 or 0 (only your own cell). */
export function candleRadius(light: number, max: number = TUNING.candle.max): number {
  const frac = light / max;
  for (const l of TUNING.candle.levels) if (frac >= l.atLeast) return l.radius;
  return 0;
}

/** What the explorer can see right now, swirl fog and blinding curses included. */
export function visionRadius(s: PlayState): number {
  const r = candleRadius(s.light, s.rules.maxLight);
  if (r === 0) return r;
  if (s.curse?.kind === "blind") return Math.min(r, TUNING.curse.blindRadius);
  if (!s.invert) return r;
  return Math.max(1, r - TUNING.swirl.fog);
}

/** Remaining light as 0..1, for the HUD flame. */
export const lightFraction = (s: PlayState) => s.light / s.rules.maxLight;

const bits = (m: number) => {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
};

export const starCount = (s: PlayState) => bits(s.stars);
export const sealCount = (s: PlayState) => bits(s.seals);
/** v1 games have no stations: the exit is always open. */
export const exitOpen = (game: Game, s: PlayState) => sealCount(s) >= (game.stations?.length ?? 0);

/** In danger: few hearts or the candle out (when the emergency exit is offered). */
export const inDanger = (s: PlayState) => s.hearts <= TUNING.emergency.hearts || s.light === 0;

/** Standing on the sealed exit with 1 or 2 seals, in danger. */
export function emergencyAvailable(game: Game, s: PlayState): boolean {
  if (!game.stations || s.arrived || s.lost || s.cell !== game.exit || exitOpen(game, s)) return false;
  return sealCount(s) >= 1 && inDanger(s);
}

/** Leaves through the emergency exit (the UI asks first). */
export function takeEmergencyExit(game: Game, prev: PlayState): { state: PlayState; events: PlayEvent[] } {
  if (!emergencyAvailable(game, prev)) return { state: prev, events: [] };
  const s: PlayState = { ...prev, arrived: true, escaped: true, curse: null };
  return { state: s, events: [{ type: "emergencyExit", seals: sealCount(s) }] };
}

/**
 * Real-step sight: BFS through open passages up to `radius`. Walls block it.
 * A locked door is seen but not seen through. Returns distance per cell, -1 = hidden.
 */
export function visibility(game: Game, from: number, radius: number, keys: number): Int8Array {
  const g = game.grid;
  const dist = new Int8Array(g.width * g.height).fill(-1);
  const queue = [from];
  dist[from] = 0;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    if (dist[c] >= radius) continue;
    if (c !== from && isLockedFor(game, c, keys) >= 0) continue;
    for (const d of DIRS) {
      if (!isOpen(g, c, d)) continue;
      const n = neighbor(g, c, d);
      if (dist[n] >= 0) continue;
      dist[n] = dist[c] + 1;
      queue.push(n);
    }
  }
  return dist;
}

function markSeen(game: Game, s: PlayState): void {
  const dist = visibility(game, s.cell, visionRadius(s), s.keys);
  for (let c = 0; c < dist.length; c++) if (dist[c] >= 0) s.memo[c] |= SEEN;
}

// ── Falling far ──────────────────────────────────────────────────────────────

const landingCache = new WeakMap<Game, Int32Array>();

/**
 * Floor a fall may drop you on: any cell from which the exit — and, in v2,
 * every station — can still be reached starting WITHOUT keys (you just lost
 * them; keys you held go back to their spots), plain ground (no item, ice,
 * portal, door or station), not beside a pit and not near the exit. Exact:
 * reverse searches over (cell, keys held) states, computed once per map.
 */
export function landingZone(game: Game): Int32Array {
  const cached = landingCache.get(game);
  if (cached) return cached;
  const n = game.grid.width * game.grid.height;
  const g = stateGraph(game);
  const stations = game.stations ?? [];
  const targets = [game.exit, ...stations.map((st) => st.cell)].map((t) => canReach(g, t));
  const toExit = bfs(game.grid, game.exit);
  const zone: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!targets.every((ok) => ok[c * g.masks]) || game.occupant[c] || game.ice[c]) continue;
    if (stations.some((st) => st.cell === c)) continue;
    if (toExit[c] >= 0 && toExit[c] < TUNING.pit.exitMargin) continue;
    let besidePit = false;
    for (const d of DIRS) if (isOpen(game.grid, c, d) && game.occupant[neighbor(game.grid, c, d)]?.type === "pit") besidePit = true;
    if (!besidePit) zone.push(c);
  }
  const out = Int32Array.from(zone.length > 0 ? zone : [game.start]);
  landingCache.set(game, out);
  return out;
}

/**
 * Where fall number `fallIndex` (0-based) out of `pit` lands: a seeded pick
 * among the farthest share of the landing zone, never a spot already used.
 * Both devices could compute it — the guide doesn't, on purpose: finding the
 * explorer again is the point.
 */
export function landingFor(game: Game, pit: number, fallIndex: number, used: readonly number[]): number {
  const all = Array.from(landingZone(game));
  const fresh = all.filter((c) => !used.includes(c));
  const zone = fresh.length > 0 ? fresh : all; // a tiny map ran out: reuse rather than refuse
  const dist = bfs(game.grid, pit);
  const far = (c: number) => (dist[c] < 0 ? Number.MAX_SAFE_INTEGER : dist[c]);
  zone.sort((a, b) => far(b) - far(a) || a - b);
  const pool = zone.slice(0, Math.max(1, Math.ceil(zone.length * TUNING.pit.farFraction)));
  const rng = createRng(`${game.seed}:fall:${fallIndex}:${hashString(String(pit))}`);
  return rng.pick(pool);
}

// ── One move ─────────────────────────────────────────────────────────────────

/** Where a pressed direction goes right now (v1 inversion or v2 curse). */
export const effectiveDir = (s: PlayState, input: Dir): Dir => cursedDir(invertDir(input, s.invert?.axes ?? null), s.curse);

/** One player input. `input` is the raw direction pressed; inversions and curses apply here. */
export function stepPlay(game: Game, prev: PlayState, input: Dir): StepResult {
  const dir = effectiveDir(prev, input);
  if (prev.arrived || prev.lost) return { state: prev, events: [], dir, trail: [], outcome: "blocked" };

  const r = resolveMove(game, prev.cell, dir, prev.keys);
  if (r.outcome === "blocked") return { state: prev, events: [{ type: "blocked" }], dir, trail: [], outcome: "blocked" };
  if (r.outcome === "locked") {
    const cell = neighbor(game.grid, prev.cell, dir);
    return { state: prev, events: [{ type: "locked", color: r.lockedColor!, cell }], dir, trail: [], outcome: "locked" };
  }

  const s: PlayState = { ...prev, memo: prev.memo.slice(), moves: prev.moves + 1, ticks: prev.ticks + 1 };
  const events: PlayEvent[] = [];
  const trail = [...r.trail];
  const radiusBefore = visionRadius(prev);

  // Inversion counts down on every move that goes somewhere.
  if (s.invert) {
    const left = s.invert.left - 1;
    s.invert = left > 0 ? { ...s.invert, left } : null;
    if (!s.invert) events.push({ type: "unswirl" });
  }
  if (s.curse) {
    const left = s.curse.left - 1;
    if (left > 0) s.curse = { ...s.curse, left };
    else {
      events.push({ type: "uncurse", k: s.curse.k, cured: false });
      s.curse = null;
    }
  }
  if (r.slid && r.trail.length > 1) events.push({ type: "slid", cells: r.trail.length });
  s.light = Math.max(0, s.light - (prev.curse?.kind === "hungry" ? TUNING.curse.hungryBurn : 1));

  if (r.outcome === "fell") {
    const landing = landingFor(game, r.to, s.pits, s.landings);
    events.push({ type: "fell", pit: r.to, landing, keysLost: s.keys });
    s.pits++;
    s.landings = [...s.landings, landing];
    s.memo[r.to] |= PIT_KNOWN | SEEN;
    s.keys = 0;
    s.cell = landing;
    s.memo[landing] |= VISITED;
    s.invert = null; // a fresh start after a fall
    if (s.curse) {
      events.push({ type: "uncurse", k: s.curse.k, cured: false });
      s.curse = null;
    }
    hurt(s, "pit", events);
    if (!s.lost) tickShadow(game, s, [...trail, s.cell], events);
    if (!s.lost) burn(s, events, radiusBefore, prev.light > 0);
    markSeen(game, s);
    return { state: s, events, dir, trail, outcome: "fell" };
  }

  for (const c of r.trail) s.memo[c] |= VISITED;
  if (r.outcome === "teleported") {
    events.push({ type: "teleported", pair: r.portal!, from: r.trail[r.trail.length - 1], to: r.to });
    trail.push(r.to);
    s.memo[r.to] |= VISITED;
  }
  s.cell = r.to;

  for (const c of r.trail) pickUp(game, s, c, events);
  const atExit = s.cell === game.exit || r.trail.includes(game.exit);
  if (atExit && exitOpen(game, s)) {
    s.arrived = true;
    events.push({ type: "arrived" });
  } else {
    if (atExit) {
      // Danger is judged after this move's pickups and burn (below), so check it on the state as it will be.
      events.push({ type: "exitSealed", missing: (game.stations?.length ?? 0) - sealCount(s), emergency: false });
    }
    const st = game.stations?.find((x) => x.cell === s.cell);
    if (st) events.push({ type: "station", index: st.index, sealed: !!(s.seals & (1 << st.index)) });
    tickShadow(game, s, trail, events);
    if (!s.lost) burn(s, events, radiusBefore, prev.light > 0);
    if (atExit && s.cell === game.exit) {
      const ev = events.find((e) => e.type === "exitSealed");
      if (ev && ev.type === "exitSealed") ev.emergency = emergencyAvailable(game, s);
    }
  }
  markSeen(game, s);
  return { state: s, events, dir, trail, outcome: r.outcome };
}

/**
 * Stands still for one tick (only on maps with a Sombra): the candle burns as
 * for a step and the Sombra moves, so waiting out a patrol has a price.
 */
export function waitPlay(game: Game, prev: PlayState): StepResult {
  const none: StepResult = { state: prev, events: [], dir: 2, trail: [], outcome: "blocked" };
  if (prev.arrived || prev.lost || !game.shadow || !prev.shadow) return none;
  const s: PlayState = { ...prev, ticks: prev.ticks + 1 };
  const events: PlayEvent[] = [{ type: "waited" }];
  const radiusBefore = visionRadius(prev);
  if (s.invert) {
    const left = s.invert.left - 1;
    s.invert = left > 0 ? { ...s.invert, left } : null;
    if (!s.invert) events.push({ type: "unswirl" });
  }
  if (s.curse) {
    const left = s.curse.left - 1;
    if (left > 0) s.curse = { ...s.curse, left };
    else {
      events.push({ type: "uncurse", k: s.curse.k, cured: false });
      s.curse = null;
    }
  }
  s.light = Math.max(0, s.light - (prev.curse?.kind === "hungry" ? TUNING.curse.hungryBurn : 1));
  tickShadow(game, s, [s.cell], events);
  if (!s.lost) burn(s, events, radiusBefore, prev.light > 0);
  markSeen(game, s);
  return { state: s, events, dir: 2, trail: [], outcome: "waited" };
}

/**
 * One tick for La Sombra, after the explorer's move. `crossed` = every cell the
 * explorer passed through (so a slide or a swap can't skip through a body).
 * A touch costs a heart and part of the candle, makes the explorer immune for a
 * few ticks and sends the body walking away.
 */
function tickShadow(game: Game, s: PlayState, crossed: readonly number[], events: PlayEvent[]): void {
  const run = s.shadow;
  const sh = game.shadow;
  if (!run || !sh) return;
  const w = shadowWorld(game);
  const moved = run.bodies.map((b) => advanceBody(w, sh, b, s.cell));
  const hit = run.immune === 0 && touches(run.bodies.map((b) => b.cell), moved.map((b) => b.cell), crossed);
  if (!hit) {
    s.shadow = { bodies: moved, immune: Math.max(0, run.immune - 1) };
    return;
  }
  const bodies = moved.map((b, i) => (crossed.includes(run.bodies[i].cell) || crossed.includes(b.cell) ? retreat(b, TUNING.shadow.retreat) : b));
  s.shadow = { bodies, immune: TUNING.shadow.immune };
  s.touches++;
  s.light = Math.max(0, s.light - Math.round(s.rules.maxLight * TUNING.shadow.lightLoss));
  events.push({ type: "shadowTouch", hearts: Math.max(0, s.hearts - TUNING.shadow.hurt) });
  for (let i = 0; i < TUNING.shadow.hurt && !s.lost; i++) hurt(s, "shadow", events);
}

export function hurt(s: PlayState, cause: HurtCause, events: PlayEvent[]): void {
  s.hearts = Math.max(0, s.hearts - 1);
  s.hurts++;
  events.push({ type: "hurt", cause, hearts: s.hearts });
  if (s.hearts === 0) {
    s.lost = true;
    events.push({ type: "defeat", cause });
  }
}

/**
 * Darkness bookkeeping after a move (refills from pickups already applied).
 * The move that blows the candle out is free; the grace counts moves after it.
 */
function burn(s: PlayState, events: PlayEvent[], radiusBefore: number, wasLit: boolean): void {
  if (s.light > 0) {
    s.dark = 0;
  } else if (wasLit) {
    s.dark = 0;
    events.push({ type: "darkness" });
  } else {
    s.dark++;
    if (s.dark > TUNING.candle.darkGrace) {
      s.dark = 0;
      s.light = Math.round(s.rules.maxLight * TUNING.candle.relight);
      events.push({ type: "burnout" });
      hurt(s, "dark", events);
    }
  }
  const radius = visionRadius(s);
  if (radius < radiusBefore && radius > 0 && !s.lost) events.push({ type: "dimmed", radius });
}

export function refill(s: PlayState, fraction: number): void {
  s.light = Math.min(s.rules.maxLight, s.light + Math.round(s.rules.maxLight * fraction));
  s.dark = 0;
}

function pickUp(game: Game, s: PlayState, c: number, events: PlayEvent[]): void {
  const o = game.occupant[c];
  if (!o) return;
  switch (o.type) {
    case "key":
      if (!(s.keys & (1 << o.color))) {
        s.keys |= 1 << o.color;
        events.push({ type: "key", color: o.color });
      }
      break;
    case "star":
      if (!(s.stars & (1 << o.index))) {
        s.stars |= 1 << o.index;
        events.push({ type: "star", index: o.index, count: starCount(s) });
      }
      break;
    case "lantern":
      if (!(s.lanterns & (1 << o.index))) {
        s.lanterns |= 1 << o.index;
        refill(s, TUNING.candle.lanternRefill);
        events.push({ type: "lantern", index: o.index });
        if (s.shadow) {
          const r = stunNear(game, s.shadow, s.cell, TUNING.shadow.lanternRange, TUNING.shadow.lanternStun);
          s.shadow = r.run;
          if (r.stunned > 0) events.push({ type: "shadowStunned", count: r.stunned });
        }
      }
      break;
    case "checkpoint":
      if (!(s.candles & (1 << o.index))) {
        s.candles |= 1 << o.index;
        refill(s, TUNING.candle.candleRefill);
        events.push({ type: "candle", index: o.index });
      }
      break;
    case "swirl": {
      if (game.version >= 2) {
        // v2: a curse, not an inversion. A new one replaces the one in force.
        const c = drawCurse(game.seed, s.curses);
        s.curses++;
        s.curse = c;
        s.invert = null;
        events.push({ type: "curse", k: c.k, kind: c.kind, steps: c.left });
        break;
      }
      const sw = game.swirls[o.index];
      const steps = Math.round(sw.steps * TUNING.swirl.stepsFactor);
      s.invert = { axes: sw.axes, left: steps };
      events.push({ type: "swirl", axes: sw.axes, steps });
      break;
    }
  }
}
