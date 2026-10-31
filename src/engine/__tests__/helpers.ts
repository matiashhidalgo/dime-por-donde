import { type Dir, carve, cellAt, createGrid } from "../grid";
import type { Occupant, PortalPair, World } from "../types";

/** Tiny hand-built worlds for rule/solver tests. Nothing is open until you carve it. */
export function makeWorld(width: number, height: number) {
  const grid = createGrid(width, height);
  const world: World & { occupant: (Occupant | null)[]; portals: PortalPair[] } = {
    grid,
    ice: new Uint8Array(width * height),
    occupant: new Array<Occupant | null>(width * height).fill(null),
    portals: [],
  };
  const at = (x: number, y: number) => cellAt(grid, x, y);
  return {
    world,
    at,
    /** Opens a straight run of passages from (x,y) going `dir` for `len` steps. */
    run(x: number, y: number, dir: Dir, len: number) {
      let c = at(x, y);
      for (let i = 0; i < len; i++) {
        carve(grid, c, dir);
        c = c + [-width, 1, width, -1][dir];
      }
    },
    ice(...cells: number[]) {
      for (const c of cells) world.ice[c] = 1;
    },
    put(c: number, occ: Occupant) {
      world.occupant[c] = occ;
    },
    portal(a: number, b: number) {
      const pair = world.portals.length;
      world.portals.push({ a, b, symbol: pair });
      world.occupant[a] = { type: "portal", pair, end: 0 };
      world.occupant[b] = { type: "portal", pair, end: 1 };
    },
  };
}

export function quantile(values: readonly number[], p: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}
