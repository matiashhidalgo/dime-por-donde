import { DIFFICULTIES, PIT_PENALTY_SECONDS } from "./difficulty";
import { DIRS, type Dir, isOpen, neighbor } from "./grid";
import { invertDir, isLockedFor, resolveMove } from "./rules";
import type { Game } from "./types";

/**
 * The explorer's game state and rules, turn by turn. Pure: no DOM, no clock
 * of its own (time comes in as `now`), every step returns a fresh state.
 * Movement itself is `resolveMove` — the same function the solver uses — so
 * the player can do exactly what the fairness checks proved possible.
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

export interface PlayState {
  cell: number;
  /** Key mask (bit = KEY_COLORS index). Keys are never spent. */
  keys: number;
  /** Where a fall sends you back: the start until a flag is touched. */
  checkpoint: number;
  /** Index into game.checkpoints of the last flag touched, -1 = start. */
  checkpointIndex: number;
  pits: number;
  /** Bitmask of collected star indices. */
  stars: number;
  /** Bitmask of used lantern indices. */
  lanterns: number;
  /** Lantern light lasts until this timestamp (ms); 0 = none. */
  lanternUntil: number;
  invert: Inversion | null;
  /** SEEN | VISITED | PIT_KNOWN per cell. */
  memo: Uint8Array;
  /** Inputs that actually moved you (falls included). */
  moves: number;
  arrived: boolean;
}

export type PlayEvent =
  | { type: "blocked" }
  | { type: "locked"; color: number; cell: number }
  | { type: "slid"; cells: number }
  | { type: "teleported"; pair: number; from: number; to: number }
  | { type: "fell"; pit: number; respawn: number }
  | { type: "key"; color: number }
  | { type: "star"; index: number; count: number }
  | { type: "lantern"; index: number; until: number }
  | { type: "checkpoint"; index: number }
  | { type: "swirl"; axes: "x" | "xy"; steps: number }
  | { type: "unswirl" }
  | { type: "arrived" };

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
  outcome: "blocked" | "locked" | "moved" | "teleported" | "fell";
}

export function createPlay(game: Game, now = 0): PlayState {
  const memo = new Uint8Array(game.grid.width * game.grid.height);
  memo[game.start] |= VISITED;
  const s: PlayState = {
    cell: game.start,
    keys: 0,
    checkpoint: game.start,
    checkpointIndex: -1,
    pits: 0,
    stars: 0,
    lanterns: 0,
    lanternUntil: 0,
    invert: null,
    memo,
    moves: 0,
    arrived: false,
  };
  markSeen(game, s, now);
  return s;
}

export const visionRadius = (game: Game, s: PlayState, now: number) =>
  DIFFICULTIES[game.level].vision + (now < s.lanternUntil ? DIFFICULTIES[game.level].lanternBonus : 0);

export const penaltyMs = (s: PlayState) => s.pits * PIT_PENALTY_SECONDS * 1000;

export const starCount = (s: PlayState) => {
  let n = 0;
  for (let m = s.stars; m; m &= m - 1) n++;
  return n;
};

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

function markSeen(game: Game, s: PlayState, now: number): void {
  const dist = visibility(game, s.cell, visionRadius(game, s, now), s.keys);
  for (let c = 0; c < dist.length; c++) if (dist[c] >= 0) s.memo[c] |= SEEN;
}

/** Call when the lantern runs out (or anything else changes sight without a move). */
export function refreshSight(game: Game, s: PlayState, now: number): PlayState {
  const next = { ...s, memo: s.memo.slice() };
  markSeen(game, next, now);
  return next;
}

/** One player input. `input` is the raw direction pressed; inversions apply here. */
export function stepPlay(game: Game, prev: PlayState, input: Dir, now: number): StepResult {
  const dir = invertDir(input, prev.invert?.axes ?? null);
  if (prev.arrived) return { state: prev, events: [], dir, trail: [], outcome: "blocked" };

  const r = resolveMove(game, prev.cell, dir, prev.keys);
  if (r.outcome === "blocked") return { state: prev, events: [{ type: "blocked" }], dir, trail: [], outcome: "blocked" };
  if (r.outcome === "locked") {
    const cell = neighbor(game.grid, prev.cell, dir);
    return { state: prev, events: [{ type: "locked", color: r.lockedColor!, cell }], dir, trail: [], outcome: "locked" };
  }

  const s: PlayState = { ...prev, memo: prev.memo.slice(), moves: prev.moves + 1 };
  const events: PlayEvent[] = [];
  const trail = [...r.trail];

  // Inversion counts down on every move that goes somewhere.
  if (s.invert) {
    const left = s.invert.left - 1;
    s.invert = left > 0 ? { ...s.invert, left } : null;
    if (!s.invert) events.push({ type: "unswirl" });
  }
  if (r.slid && r.trail.length > 1) events.push({ type: "slid", cells: r.trail.length });

  if (r.outcome === "fell") {
    s.pits++;
    s.memo[r.to] |= PIT_KNOWN | SEEN;
    s.cell = s.checkpoint;
    s.invert = null; // a fresh start after a fall
    events.push({ type: "fell", pit: r.to, respawn: s.checkpoint });
    markSeen(game, s, now);
    return { state: s, events, dir, trail, outcome: "fell" };
  }

  for (const c of r.trail) s.memo[c] |= VISITED;
  if (r.outcome === "teleported") {
    events.push({ type: "teleported", pair: r.portal!, from: r.trail[r.trail.length - 1], to: r.to });
    trail.push(r.to);
    s.memo[r.to] |= VISITED;
  }
  s.cell = r.to;

  for (const c of r.trail) pickUp(game, s, c, now, events);
  if (s.cell === game.exit || r.trail.includes(game.exit)) {
    s.arrived = true;
    events.push({ type: "arrived" });
  }
  markSeen(game, s, now);
  return { state: s, events, dir, trail, outcome: r.outcome };
}

function pickUp(game: Game, s: PlayState, c: number, now: number, events: PlayEvent[]): void {
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
        s.lanternUntil = now + DIFFICULTIES[game.level].lanternSeconds * 1000;
        events.push({ type: "lantern", index: o.index, until: s.lanternUntil });
      }
      break;
    case "checkpoint":
      if (s.checkpoint !== c) {
        s.checkpoint = c;
        s.checkpointIndex = o.index;
        events.push({ type: "checkpoint", index: o.index });
      }
      break;
    case "swirl": {
      const sw = game.swirls[o.index];
      s.invert = { axes: sw.axes, left: sw.steps };
      events.push({ type: "swirl", axes: sw.axes, steps: sw.steps });
      break;
    }
  }
}
