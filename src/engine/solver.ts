import { DECISION_WEIGHT } from "./difficulty";
import { DIRS, type Dir, type Grid, degree } from "./grid";
import { resolveMove } from "./rules";
import type { World } from "./types";

/**
 * Fairness solver: BFS over (cell, keys held). Ice slides, portals and doors
 * come from the real movement rules. Swirls only remap inputs, so they never
 * change what's reachable and are ignored here. Falling into a pit is not a
 * usable move (it costs time and sends you back), so it's left out — which
 * makes every check below conservative.
 */

export interface SolveResult {
  solvable: boolean;
  moves: number;
  /** Every cell crossed from start to exit, slides and teleports included. */
  route: number[];
  dirs: Dir[];
  /** 1 if some reachable state stands on the cell. */
  reachable: Uint8Array;
  /** Reachable states from which the exit can no longer be reached (soft-locks). */
  deadStates: number;
  statesExplored: number;
}

function keyColorAt(world: World, cell: number): number {
  const occ = world.occupant[cell];
  return occ?.type === "key" ? occ.color : -1;
}

/** Bits needed for the key mask: highest door/key color present + 1. */
function keyBits(world: World): number {
  let bits = 0;
  for (const occ of world.occupant) {
    if (occ?.type === "door" || occ?.type === "key") bits = Math.max(bits, occ.color + 1);
  }
  return bits;
}

/** `startKeys` (default none) lets a simulation re-plan mid-round while holding keys. */
export function solve(world: World, start: number, exit: number, startKeys = 0): SolveResult {
  const cells = world.grid.width * world.grid.height;
  const masks = 1 << keyBits(world);
  const total = cells * masks;
  const seen = new Uint8Array(total);
  const parent = new Int32Array(total).fill(-1);
  const parentDir = new Int8Array(total).fill(-1);
  const order: number[] = [];
  const edgesFrom: number[] = [];
  const edgesTo: number[] = [];
  const reachable = new Uint8Array(cells);

  const startMask = ((keyColorAt(world, start) >= 0 ? 1 << keyColorAt(world, start) : 0) | startKeys) & (masks - 1);
  const s0 = start * masks + startMask;
  seen[s0] = 1;
  order.push(s0);
  let goal = -1;

  for (let head = 0; head < order.length; head++) {
    const s = order[head];
    const cell = Math.floor(s / masks);
    const mask = s % masks;
    reachable[cell] = 1;
    if (cell === exit) {
      if (goal < 0) goal = s;
      continue; // exit is terminal
    }
    for (const d of DIRS) {
      const r = resolveMove(world, cell, d, mask);
      if (r.outcome === "blocked" || r.outcome === "locked" || r.outcome === "fell") continue;
      const k = keyColorAt(world, r.to);
      const nextMask = k >= 0 ? mask | (1 << k) : mask;
      const t = r.to * masks + nextMask;
      if (t === s) continue;
      edgesFrom.push(s);
      edgesTo.push(t);
      if (seen[t]) continue;
      seen[t] = 1;
      parent[t] = s;
      parentDir[t] = d;
      order.push(t);
    }
  }

  // Reverse reachability from every exit state → anything left over is a soft-lock.
  const canFinish = new Uint8Array(total);
  const revHead = new Int32Array(total).fill(-1);
  const revNext = new Int32Array(edgesFrom.length);
  for (let i = 0; i < edgesFrom.length; i++) {
    revNext[i] = revHead[edgesTo[i]];
    revHead[edgesTo[i]] = i;
  }
  const stack: number[] = [];
  for (const s of order) {
    if (Math.floor(s / masks) === exit) {
      canFinish[s] = 1;
      stack.push(s);
    }
  }
  while (stack.length > 0) {
    const t = stack.pop()!;
    for (let e = revHead[t]; e >= 0; e = revNext[e]) {
      const s = edgesFrom[e];
      if (!canFinish[s]) {
        canFinish[s] = 1;
        stack.push(s);
      }
    }
  }
  let deadStates = 0;
  for (const s of order) if (!canFinish[s]) deadStates++;

  if (goal < 0) {
    return { solvable: false, moves: -1, route: [], dirs: [], reachable, deadStates, statesExplored: order.length };
  }

  const dirs: Dir[] = [];
  const states: number[] = [];
  for (let s = goal; s !== s0; s = parent[s]) {
    dirs.push(parentDir[s] as Dir);
    states.push(parent[s]);
  }
  dirs.reverse();
  states.reverse();
  const route = [start];
  for (let i = 0; i < dirs.length; i++) {
    const cell = Math.floor(states[i] / masks);
    const r = resolveMove(world, cell, dirs[i], states[i] % masks);
    route.push(...r.trail);
    if (r.outcome === "teleported") route.push(r.to);
  }
  return { solvable: true, moves: dirs.length, route, dirs, reachable, deadStates, statesExplored: order.length };
}

/** Junctions the explorer stands on along a route (slid-over ice doesn't count). */
export function routeDecisions(grid: Grid, ice: Uint8Array, route: readonly number[]): number {
  let n = 0;
  for (const c of route) if (degree(grid, c) >= 3 && !ice[c]) n++;
  return n;
}

/** Effort score used for the per-level fairness range. */
export function routeEffort(grid: Grid, ice: Uint8Array, s: SolveResult): number {
  return s.moves + DECISION_WEIGHT * routeDecisions(grid, ice, s.route);
}
