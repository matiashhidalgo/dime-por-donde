import { type Dir, isOpen, neighbor } from "./grid";
import type { World } from "./types";

/**
 * Movement rules — shared by the solver and (later) the explorer's game loop,
 * so what the solver proves possible is exactly what the player can do.
 *
 *  - Walls block. A locked door blocks (the player doesn't move).
 *  - Ice: once you step on ice you keep sliding the same way until a wall or
 *    locked door stops you, or you slide off the ice onto normal ground.
 *  - Portal: entering a portal cell sends you to its partner; you land there
 *    and stop. Walking back onto it later sends you back.
 *  - Pit: entering one (walking or sliding) makes you fall.
 */

export type MoveOutcome = "blocked" | "locked" | "moved" | "teleported" | "fell";

export interface MoveResult {
  outcome: MoveOutcome;
  from: number;
  /** Where the player ends: final cell, partner portal, or the pit fallen into. */
  to: number;
  /** Cells entered in order (excludes `from`). Empty when blocked/locked. */
  trail: number[];
  slid: boolean;
  /** Door color when outcome is "locked". */
  lockedColor?: number;
  /** Portal pair index when outcome is "teleported". */
  portal?: number;
}

export function isLockedFor(world: World, cell: number, keys: number): number {
  const occ = world.occupant[cell];
  if (occ?.type === "door" && (keys & (1 << occ.color)) === 0) return occ.color;
  return -1;
}

export function portalPartner(world: World, cell: number): { to: number; pair: number } | null {
  const occ = world.occupant[cell];
  if (occ?.type !== "portal") return null;
  const p = world.portals[occ.pair];
  return { to: occ.end === 0 ? p.b : p.a, pair: occ.pair };
}

export function resolveMove(world: World, from: number, dir: Dir, keys: number): MoveResult {
  const g = world.grid;
  if (!isOpen(g, from, dir)) return { outcome: "blocked", from, to: from, trail: [], slid: false };
  const first = neighbor(g, from, dir);
  const firstLock = isLockedFor(world, first, keys);
  if (firstLock >= 0) {
    return { outcome: "locked", from, to: from, trail: [], slid: false, lockedColor: firstLock };
  }

  const trail: number[] = [];
  let cur = first;
  for (;;) {
    trail.push(cur);
    const occ = world.occupant[cur];
    if (occ?.type === "pit") return { outcome: "fell", from, to: cur, trail, slid: trail.length > 1 };
    const portal = portalPartner(world, cur);
    if (portal) {
      return { outcome: "teleported", from, to: portal.to, trail, slid: trail.length > 1, portal: portal.pair };
    }
    if (!world.ice[cur] || !isOpen(g, cur, dir)) break;
    const next = neighbor(g, cur, dir);
    if (isLockedFor(world, next, keys) >= 0) break;
    cur = next;
  }
  return { outcome: "moved", from, to: cur, trail, slid: trail.length > 1 || world.ice[cur] === 1 };
}

/**
 * Applies a swirl inversion to a raw input direction.
 * "x" swaps left/right; "xy" also swaps up/down.
 */
export function invertDir(dir: Dir, axes: "x" | "xy" | null): Dir {
  if (!axes) return dir;
  if (dir === 1 || dir === 3) return (dir === 1 ? 3 : 1) as Dir;
  if (axes === "xy") return (dir === 0 ? 2 : 0) as Dir;
  return dir;
}
