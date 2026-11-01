import { DIRS } from "./grid";
import { resolveMove } from "./rules";
import type { World } from "./types";

/**
 * The (cell, keys held) state graph of a map under the real movement rules,
 * built once per map: the landing zone and the v2 station audit both ask
 * "from where can you still reach X?". Falls are not edges (the game picks
 * where you land); nothing is terminal (with seals the exit is walkable).
 */

export interface StateGraph {
  cells: number;
  masks: number;
  /** Key bit picked up on arriving at a cell (0 if none). */
  keyAt: Uint8Array;
  /** Forward edges in CSR form. */
  head: Int32Array;
  to: Int32Array;
  /** Reverse edges in CSR form. */
  rHead: Int32Array;
  rFrom: Int32Array;
}

const cache = new WeakMap<object, StateGraph>();

export function stateGraph(world: World): StateGraph {
  const hit = cache.get(world.occupant);
  if (hit) return hit;
  const cells = world.grid.width * world.grid.height;
  let bits = 0;
  for (const o of world.occupant) if (o?.type === "key" || o?.type === "door") bits = Math.max(bits, o.color + 1);
  const masks = 1 << bits;
  const keyAt = new Uint8Array(cells);
  world.occupant.forEach((o, c) => {
    if (o?.type === "key") keyAt[c] = 1 << o.color;
  });
  const total = cells * masks;
  const from: number[] = [];
  const to: number[] = [];
  for (let c = 0; c < cells; c++) {
    for (let m = 0; m < masks; m++) {
      for (const d of DIRS) {
        const r = resolveMove(world, c, d, m);
        if (r.outcome !== "moved" && r.outcome !== "teleported") continue;
        from.push(c * masks + m);
        to.push(r.to * masks + (m | keyAt[r.to]));
      }
    }
  }
  const csr = (src: number[], dst: number[]) => {
    const head = new Int32Array(total + 1);
    for (const s of src) head[s + 1]++;
    for (let i = 0; i < total; i++) head[i + 1] += head[i];
    const fill = head.slice(0, total);
    const out = new Int32Array(src.length);
    for (let i = 0; i < src.length; i++) out[fill[src[i]]++] = dst[i];
    return { head, out };
  };
  const fwd = csr(from, to);
  const rev = csr(to, from);
  const g: StateGraph = { cells, masks, keyAt, head: fwd.head, to: fwd.out, rHead: rev.head, rFrom: rev.out };
  cache.set(world.occupant, g);
  return g;
}

/** States (any keys) from which `target` cell can be reached. */
export function canReach(g: StateGraph, target: number): Uint8Array {
  const ok = new Uint8Array(g.cells * g.masks);
  const stack: number[] = [];
  for (let m = 0; m < g.masks; m++) {
    ok[target * g.masks + m] = 1;
    stack.push(target * g.masks + m);
  }
  while (stack.length > 0) {
    const t = stack.pop()!;
    for (let e = g.rHead[t]; e < g.rHead[t + 1]; e++) {
      const s = g.rFrom[e];
      if (!ok[s]) {
        ok[s] = 1;
        stack.push(s);
      }
    }
  }
  return ok;
}

/** States reachable from the given start states. */
export function forwardFrom(g: StateGraph, starts: readonly number[]): Uint8Array {
  const seen = new Uint8Array(g.cells * g.masks);
  const stack: number[] = [];
  for (const s of starts) {
    if (!seen[s]) {
      seen[s] = 1;
      stack.push(s);
    }
  }
  while (stack.length > 0) {
    const s = stack.pop()!;
    for (let e = g.head[s]; e < g.head[s + 1]; e++) {
      const t = g.to[e];
      if (!seen[t]) {
        seen[t] = 1;
        stack.push(t);
      }
    }
  }
  return seen;
}
