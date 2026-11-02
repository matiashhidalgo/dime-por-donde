import { DIRS, type Dir, bfs, isOpen, neighbor } from "./grid";
import { createRng } from "./rng";
import { type Family, type Silhouette, silhouettes } from "./silhouettes";
import { TUNING } from "./tuning";
import type { Game } from "./types";

/**
 * LA SOMBRA (GAME_SPEC_V2.md, anexo etapa 5): a patrol that moves only when
 * the explorer does. Pure and clock-free like the rest of the rules: one tick
 * per explorer input that goes somewhere (or per «esperar»), nothing while a
 * trial is open. The same `advanceBody` drives the game and the fairness
 * audit, so what the audit proves is exactly what gets played.
 *
 *  - `Shadow` is part of the map (v2 only, drawn by seed, never fixed).
 *  - `Body` is one body's running state, kept inside the explorer's PlayState.
 *  - Off-route behaviour (hunting, backing off, going home) never enters the
 *    entrance, the exit, a station or the cells beside them.
 */

export interface Shadow {
  /** Patrol cells in order, through passages. A loop closes on its first cell. */
  route: number[];
  shape: "loop" | "ping";
  /** Ticks per cell moved: 1 (fast) or 2. */
  slow: 1 | 2;
  /** Patrol clock at tick 0 of body 0. */
  phase: number;
  /** «Cazador»: turns toward an explorer inside `hunterRadius`, gives up after `chaseTicks`. */
  hunter: boolean;
  /** 1 body, or 2 on the same route half a lap apart (never with a hunter). */
  bodies: 1 | 2;
  /** Clock distance of body 1 behind body 0. */
  offset: number;
  /** Seed of its look (a silhouette with eyes, procedural per game). */
  look: string;
  /** Which seed attempt passed the fairness audit. */
  attempt: number;
}

export type BodyMode = "patrol" | "chase" | "retreat" | "return";

export interface Body {
  cell: number;
  /** Patrol clock (meaningful while patrolling). */
  clock: number;
  mode: BodyMode;
  /** Cadence counter for off-route steps when slow = 2. */
  sub: number;
  /** Ticks left of a chase or a retreat. */
  left: number;
  /** Frozen for this many more ticks (a lantern's doing). */
  stun: number;
}

/** What a PlayState holds of the Sombra. */
export interface ShadowRun {
  bodies: Body[];
  /** The explorer cannot be touched for this many more ticks. */
  immune: number;
}

// ── The patrol as a function of the clock ────────────────────────────────────

export const cellLap = (sh: Shadow): number => (sh.shape === "loop" ? sh.route.length : 2 * (sh.route.length - 1));
/** Ticks in one full lap. */
export const lapTicks = (sh: Shadow): number => cellLap(sh) * sh.slow;

export function routeIndexAt(sh: Shadow, clock: number): number {
  const P = lapTicks(sh);
  const k = Math.floor((((clock % P) + P) % P) / sh.slow);
  if (sh.shape === "loop") return k;
  return k < sh.route.length ? k : 2 * (sh.route.length - 1) - k;
}

export const patrolCell = (sh: Shadow, clock: number): number => sh.route[routeIndexAt(sh, clock)];

export function initBodies(sh: Shadow): Body[] {
  return Array.from({ length: sh.bodies }, (_, i) => {
    const clock = (sh.phase + i * sh.offset) % lapTicks(sh);
    return { cell: patrolCell(sh, clock), clock, mode: "patrol" as const, sub: 0, left: 0, stun: 0 };
  });
}

export const initShadowRun = (sh: Shadow): ShadowRun => ({ bodies: initBodies(sh), immune: 0 });

// ── Floor the Sombra may use ─────────────────────────────────────────────────

export interface ShadowWorld {
  game: Game;
  /** 1 = the Sombra may stand here. */
  allowed: Uint8Array;
  dists: Map<number, Int16Array>;
}

const worldCache = new WeakMap<Game, ShadowWorld>();
/** Distance tables depend only on the maze, so every candidate Sombra of a map shares them. */
const distCache = new WeakMap<object, Map<number, Int16Array>>();

/** Plain floor away from the entrance, the exit and the stations (and the cells around them). */
export function shadowWorld(game: Game): ShadowWorld {
  const hit = worldCache.get(game);
  if (hit) return hit;
  const g = game.grid;
  const n = g.width * g.height;
  const banned = new Uint8Array(n);
  const ring = (c: number) => {
    const cx = c % g.width;
    const cy = Math.floor(c / g.width);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < g.width && y < g.height) banned[y * g.width + x] = 1;
      }
  };
  ring(game.start);
  ring(game.exit);
  for (const st of game.stations ?? []) ring(st.cell);
  const allowed = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    const o = game.occupant[c];
    const plain = !o || o.type === "key" || o.type === "star" || o.type === "lantern" || o.type === "checkpoint";
    if (plain && !game.ice[c] && !banned[c]) allowed[c] = 1;
  }
  let dists = distCache.get(game.grid);
  if (!dists) distCache.set(game.grid, (dists = new Map()));
  const w: ShadowWorld = { game, allowed, dists };
  worldCache.set(game, w);
  return w;
}

/** Walking distance (through passages, doors ignored) from `from` to every cell; Int16, -1 unreachable. */
export function distancesFrom(w: ShadowWorld, from: number): Int16Array {
  const hit = w.dists.get(from);
  if (hit) return hit;
  const d = Int16Array.from(bfs(w.game.grid, from));
  if (w.dists.size > w.allowed.length) w.dists.clear();
  w.dists.set(from, d);
  return d;
}

/** Allowed neighbours of `c` through passages, in direction order. */
function openNeighbors(w: ShadowWorld, c: number): number[] {
  const out: number[] = [];
  for (const d of DIRS) {
    if (!isOpen(w.game.grid, c, d)) continue;
    const n = neighbor(w.game.grid, c, d);
    if (w.allowed[n]) out.push(n);
  }
  return out;
}

interface Home {
  /** Next cell toward the route (-1 on the route itself or cut off). */
  next: Int32Array;
  idx: Map<number, number>;
}
const homeCache = new WeakMap<Shadow, Home>();

function homeOf(w: ShadowWorld, sh: Shadow): Home {
  const hit = homeCache.get(sh);
  if (hit) return hit;
  const n = w.allowed.length;
  const next = new Int32Array(n).fill(-1);
  const dist = new Int32Array(n).fill(-1);
  const idx = new Map<number, number>();
  const queue: number[] = [];
  sh.route.forEach((c, i) => {
    if (!idx.has(c)) idx.set(c, i);
    if (dist[c] < 0) {
      dist[c] = 0;
      queue.push(c);
    }
  });
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h];
    for (const nb of openNeighbors(w, c)) {
      if (dist[nb] >= 0) continue;
      dist[nb] = dist[c] + 1;
      next[nb] = c;
      queue.push(nb);
    }
  }
  const home = { next, idx };
  homeCache.set(sh, home);
  return home;
}

// ── One tick of one body ─────────────────────────────────────────────────────

/** Walks toward (sign +1) or away from (−1) the explorer, one cell, if that helps. */
function stepRelative(w: ShadowWorld, cell: number, explorer: number, sign: 1 | -1): number {
  const dist = distancesFrom(w, explorer);
  const here = dist[cell] < 0 ? 9999 : dist[cell];
  let best = cell;
  let bestScore = 0;
  for (const nb of openNeighbors(w, cell)) {
    const dn = dist[nb] < 0 ? 9999 : dist[nb];
    const gain = sign === 1 ? here - dn : dn - here;
    if (gain > bestScore) {
      bestScore = gain;
      best = nb;
    }
  }
  return best;
}

/**
 * Advances a body one tick given where the explorer is NOW (after their move).
 * Deterministic: same body, same explorer cell → same result.
 */
export function advanceBody(w: ShadowWorld, sh: Shadow, b: Body, explorer: number): Body {
  if (b.stun > 0) return { ...b, stun: b.stun - 1 };
  const R = TUNING.shadow.hunterRadius;
  const near = (cell: number) => {
    const d = distancesFrom(w, explorer)[cell];
    return d >= 0 && d <= R;
  };

  if (b.mode === "patrol") {
    if (sh.hunter && near(b.cell)) return advanceBody(w, sh, { ...b, mode: "chase", left: TUNING.shadow.chaseTicks, sub: sh.slow - 1 }, explorer);
    const clock = b.clock + 1;
    return { ...b, clock, cell: patrolCell(sh, clock) };
  }

  // Off-route movement moves one cell every `slow` ticks.
  if (b.sub + 1 < sh.slow) return { ...b, sub: b.sub + 1 };
  const base = { ...b, sub: 0 };

  if (b.mode === "chase") {
    const d = distancesFrom(w, explorer)[b.cell];
    if (b.left <= 0 || d < 0 || d > R + 1) return advanceBody(w, sh, { ...b, mode: "return", sub: sh.slow - 1, left: 0 }, explorer);
    return { ...base, cell: stepRelative(w, b.cell, explorer, 1), left: b.left - 1 };
  }
  if (b.mode === "retreat") {
    const cell = stepRelative(w, b.cell, explorer, -1);
    const left = b.left - 1;
    return { ...base, cell, left, mode: left > 0 ? "retreat" : "return" };
  }
  // return: back to the nearest route cell, then patrol on from there
  const home = homeOf(w, sh);
  const at = home.idx.get(b.cell);
  if (at !== undefined) {
    const clock = at * sh.slow;
    return { ...base, mode: "patrol", clock, cell: sh.route[at], left: 0 };
  }
  const nxt = home.next[b.cell];
  if (nxt < 0) return { ...base, mode: "patrol", clock: 0, cell: sh.route[0] }; // cut off: snap home (never happens on a drawn route)
  const arrived = home.idx.get(nxt);
  if (arrived !== undefined) return { ...base, mode: "patrol", clock: arrived * sh.slow, cell: nxt, left: 0 };
  return { ...base, cell: nxt };
}

/** Where every body stands, for drawing and contact. */
export const bodyCells = (run: ShadowRun): number[] => run.bodies.map((b) => b.cell);

// ── Contact ──────────────────────────────────────────────────────────────────

/** True if the explorer's passage (cells crossed this tick) meets a body before or after it moved. */
export function touches(before: readonly number[], after: readonly number[], crossed: readonly number[]): boolean {
  for (const c of before) if (crossed.includes(c)) return true;
  for (const c of after) if (crossed.includes(c)) return true;
  return false;
}

/** Walking distance from the explorer to the nearest body (cells), or Infinity. */
export function shadowDistance(game: Game, run: ShadowRun | null, explorer: number): number {
  if (!run || !game.shadow) return Infinity;
  const d = distancesFrom(shadowWorld(game), explorer);
  let best = Infinity;
  for (const b of run.bodies) if (d[b.cell] >= 0) best = Math.min(best, d[b.cell]);
  return best;
}

/** Bodies within `range` walking cells of `cell`, stunned (a lantern's light). */
export function stunNear(game: Game, run: ShadowRun, cell: number, range: number, ticks: number): { run: ShadowRun; stunned: number } {
  const d = distancesFrom(shadowWorld(game), cell);
  let stunned = 0;
  const bodies = run.bodies.map((b) => {
    if (d[b.cell] >= 0 && d[b.cell] <= range) {
      stunned++;
      return { ...b, stun: Math.max(b.stun, ticks) };
    }
    return b;
  });
  return { run: { ...run, bodies }, stunned };
}

/** After a touch: the body walks away from the explorer for a few ticks. */
export function retreat(b: Body, ticks: number): Body {
  return { ...b, mode: "retreat", left: ticks, sub: 0, stun: 0 };
}

// ── Drawing a Sombra for a map ───────────────────────────────────────────────

/**
 * Chance of something that grows with the streak map index (capped). A single
 * expedition (no streak index) uses `base`; a Racha starts gentler at `start`
 * on map 0 and climbs `perMap` per map up to `cap`.
 */
export const rampFor = (r: { base: number; start?: number; perMap: number; cap: number }, streakIndex: number | undefined): number =>
  streakIndex === undefined ? r.base : Math.min(r.cap, (r.start ?? r.base) + r.perMap * streakIndex);

function drawRoute(w: ShadowWorld, rng: ReturnType<typeof createRng>): { route: number[]; shape: "loop" | "ping" } | null {
  const [lo, hi] = TUNING.shadow.routeLength;
  const g = w.game.grid;
  const cells: number[] = [];
  for (let c = 0; c < w.allowed.length; c++) if (w.allowed[c]) cells.push(c);
  if (cells.length < lo) return null;

  // A closed loop: an edge whose shortest way around (without it) has the right length.
  if (rng.chance(TUNING.shadow.loopShare)) {
    const tries = rng.shuffle(cells).slice(0, 60);
    for (const u of tries) {
      const nbs = openNeighbors(w, u);
      if (nbs.length < 2) continue;
      const v = rng.pick(nbs);
      const path = shortestAround(w, u, v, hi);
      if (path && path.length >= lo && path.length <= hi) return { route: path, shape: "loop" };
    }
  }

  // There and back: a self-avoiding path along the corridors from a random cell, found
  // by a randomized depth-first search with a small budget so it can back out of dead
  // ends. It insists on the drawn length (lengths come out near-uniform wherever the
  // maze has room) and settles for any legal length after 90 tries.
  for (let t = 0; t < 140; t++) {
    const start = rng.pick(cells);
    const want = rng.range(lo, hi);
    const walk = [start];
    const seen = new Set(walk);
    let budget = 500;
    let longest = walk.slice();
    const dfs = (): boolean => {
      if (walk.length === want) return true;
      if (walk.length > longest.length) longest = walk.slice();
      if (budget-- <= 0) return false;
      const end = walk[walk.length - 1];
      for (const n of rng.shuffle(openNeighbors(w, end))) {
        if (seen.has(n)) continue;
        walk.push(n);
        seen.add(n);
        if (dfs()) return true;
        walk.pop();
        seen.delete(n);
        if (budget <= 0) return false;
      }
      return false;
    };
    if (dfs()) return { route: walk, shape: "ping" };
    if (t >= 90 && longest.length >= lo) return { route: longest, shape: "ping" };
  }
  void g;
  return null;
}

/** Shortest cycle through the edge u–v: u … v, as cells in order (length ≤ max), or null. */
function shortestAround(w: ShadowWorld, u: number, v: number, max: number): number[] | null {
  const prev = new Map<number, number>([[u, -1]]);
  const queue = [u];
  const depth = new Map<number, number>([[u, 0]]);
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h];
    if ((depth.get(c) ?? 0) >= max) continue;
    for (const nb of openNeighbors(w, c)) {
      if (c === u && nb === v) continue; // not the direct edge
      if (prev.has(nb)) continue;
      prev.set(nb, c);
      depth.set(nb, (depth.get(c) ?? 0) + 1);
      if (nb === v) {
        const path: number[] = [];
        for (let x: number = v; x !== -1; x = prev.get(x) ?? -1) path.push(x);
        return path.reverse();
      }
      queue.push(nb);
    }
  }
  return null;
}

/** One candidate Sombra for `game`, from the seed key (no audit). */
export function drawShadow(game: Game, key: string, attempt: number): Shadow | null {
  const w = shadowWorld(game);
  const rng = createRng(key);
  const r = drawRoute(w, rng.fork("route"));
  if (!r) return null;
  const index = game.streak?.index;
  const S = TUNING.shadow;
  const slow: 1 | 2 = rng.fork("speed").chance(rampFor(S.fast, index)) ? 1 : 2;
  const hunter = rng.fork("hunter").chance(rampFor(S.hunter, index));
  const two = !hunter && index !== undefined && index >= S.twoBodiesFrom && rng.fork("bodies").chance(S.twoBodiesChance);
  const sh: Shadow = {
    route: r.route,
    shape: r.shape,
    slow,
    phase: 0,
    hunter,
    bodies: two ? 2 : 1,
    offset: 0,
    look: `${key}|look`,
    attempt,
  };
  const P = lapTicks(sh);
  sh.phase = rng.fork("phase").int(P);
  if (two) sh.offset = Math.max(1, Math.floor(P / 2) + rng.fork("offset").range(-2, 2));
  return sh;
}

/** Does this map get a Sombra at all? (Rolled apart from the route, so a retry doesn't change it.) */
export function shadowRolls(game: Game): boolean {
  return createRng(`${game.seed}|v2|shadow|exists`).chance(rampFor(TUNING.shadow.chance, game.streak?.index));
}

// ── Look ─────────────────────────────────────────────────────────────────────

export interface ShadowLook extends Silhouette {
  /** Eyes in the silhouette's 2×2 box (y = 1 is the floor). */
  eyes: { x: number; y: number; r: number }[];
  /** Wobble speed multiplier, 0.7–1.4. */
  sway: number;
}

const BODY_FAMILIES: readonly Family[] = ["spikes", "blob", "cluster", "crown", "arch", "tree"];
const lookCache = new Map<string, ShadowLook>();

/** A procedural silhouette with eyes, new for every game (same machinery as the landmarks). */
export function shadowLook(sh: Shadow): ShadowLook {
  const hit = lookCache.get(sh.look);
  if (hit) return hit;
  const rng = createRng(`${sh.look}|body`);
  const family = rng.pick(BODY_FAMILIES);
  const sil = silhouettes(`${sh.look}|sil`, 1, [family])[0];
  const count = rng.pick([1, 2, 2, 2, 3]);
  const spread = 0.28 + rng.next() * 0.3;
  const y = 0.2 + rng.next() * 0.45;
  const eyes = Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? (rng.next() - 0.5) * 0.3 : (i / (count - 1) - 0.5) * 2 * spread,
    y: y + (count === 3 && i === 1 ? -0.14 : 0),
    r: 0.06 + rng.next() * 0.05,
  }));
  const look = { ...sil, eyes, sway: 0.7 + rng.next() * 0.7 };
  if (lookCache.size > 64) lookCache.clear();
  lookCache.set(sh.look, look);
  return look;
}

export type { Dir };
