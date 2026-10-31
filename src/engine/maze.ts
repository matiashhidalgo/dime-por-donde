import { type Grid, type Dir, DIRS, carve, createGrid, degree, isOpen, neighbor } from "./grid";
import type { Rng } from "./rng";

/**
 * Maze carving. Three textures, picked per seed:
 *  - backtracker: long winding corridors, few branches (DFS).
 *  - prim:        short corridors, lots of little dead ends.
 *  - mixed:       growing-tree blend of both (newest cell with probability p).
 * All three produce a perfect maze (a spanning tree); braiding then opens a
 * fraction of dead ends to add loops and alternative routes.
 */

export type MazeAlgorithm = "backtracker" | "prim" | "mixed";

export function carveMaze(width: number, height: number, algorithm: MazeAlgorithm, rng: Rng): Grid {
  const g = createGrid(width, height);
  if (algorithm === "prim") carvePrim(g, rng);
  else carveGrowingTree(g, rng, algorithm === "backtracker" ? 1 : 0.55 + rng.next() * 0.3);
  return g;
}

/** Growing tree: p = 1 is a pure recursive backtracker, lower p adds branching. */
function carveGrowingTree(g: Grid, rng: Rng, pNewest: number): void {
  const total = g.width * g.height;
  const visited = new Uint8Array(total);
  const active: number[] = [];
  const start = rng.int(total);
  visited[start] = 1;
  active.push(start);
  while (active.length > 0) {
    const i = rng.chance(pNewest) ? active.length - 1 : rng.int(active.length);
    const c = active[i];
    const options: Dir[] = [];
    for (const d of DIRS) {
      const n = neighbor(g, c, d);
      if (n >= 0 && !visited[n]) options.push(d);
    }
    if (options.length === 0) {
      active.splice(i, 1);
      continue;
    }
    const d = rng.pick(options);
    const n = neighbor(g, c, d);
    carve(g, c, d);
    visited[n] = 1;
    active.push(n);
  }
}

/** Randomized Prim (frontier-cell variant). */
function carvePrim(g: Grid, rng: Rng): void {
  const total = g.width * g.height;
  const state = new Uint8Array(total); // 0 = out, 1 = frontier, 2 = in
  const frontier: number[] = [];
  const add = (c: number) => {
    state[c] = 2;
    for (const d of DIRS) {
      const n = neighbor(g, c, d);
      if (n >= 0 && state[n] === 0) {
        state[n] = 1;
        frontier.push(n);
      }
    }
  };
  add(rng.int(total));
  while (frontier.length > 0) {
    const i = rng.int(frontier.length);
    const c = frontier[i];
    frontier[i] = frontier[frontier.length - 1];
    frontier.pop();
    const into: Dir[] = [];
    for (const d of DIRS) {
      const n = neighbor(g, c, d);
      if (n >= 0 && state[n] === 2) into.push(d);
    }
    carve(g, c, rng.pick(into));
    add(c);
  }
}

export function deadEnds(g: Grid): number[] {
  const out: number[] = [];
  for (let c = 0; c < g.width * g.height; c++) if (degree(g, c) === 1) out.push(c);
  return out;
}

/**
 * Opens roughly `fraction` of the dead ends. Prefers knocking into another
 * dead end (removes two at once and keeps corridors tidy), then into the
 * neighbor with the fewest openings so we don't create big open blobs.
 */
export function braid(g: Grid, fraction: number, rng: Rng): number {
  let opened = 0;
  for (const c of rng.shuffle(deadEnds(g))) {
    if (degree(g, c) !== 1 || !rng.chance(fraction)) continue;
    const closed: Dir[] = [];
    for (const d of DIRS) if (!isOpen(g, c, d) && neighbor(g, c, d) >= 0) closed.push(d);
    if (closed.length === 0) continue;
    const deadNeighbors = closed.filter((d) => degree(g, neighbor(g, c, d)) === 1);
    let pool = deadNeighbors;
    if (pool.length === 0) {
      const min = Math.min(...closed.map((d) => degree(g, neighbor(g, c, d))));
      pool = closed.filter((d) => degree(g, neighbor(g, c, d)) === min);
    }
    carve(g, c, rng.pick(pool));
    opened++;
  }
  return opened;
}
