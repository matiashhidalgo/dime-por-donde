import { describe, expect, it } from "vitest";
import { BIT, DIRS, OPPOSITE, bfs, degree, neighbor } from "../grid";
import { type MazeAlgorithm, braid, carveMaze, deadEnds } from "../maze";
import { createRng } from "../rng";

const ALGS: MazeAlgorithm[] = ["backtracker", "prim", "mixed"];

function passages(open: Uint8Array): number {
  let n = 0;
  for (const m of open) n += (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
  return n / 2;
}

describe.each(ALGS)("%s", (alg) => {
  it("carves a perfect maze: connected tree, symmetric walls, nothing open to the outside", () => {
    for (let i = 0; i < 100; i++) {
      const g = carveMaze(14, 11, alg, createRng(`${alg}${i}`));
      expect(passages(g.open)).toBe(14 * 11 - 1);
      expect(bfs(g, 0).every((d) => d >= 0)).toBe(true);
      for (let c = 0; c < 14 * 11; c++) {
        for (const d of DIRS) {
          if (!(g.open[c] & BIT[d])) continue;
          const n = neighbor(g, c, d);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(g.open[n] & BIT[OPPOSITE[d]]).toBeTruthy();
        }
      }
    }
  });

  it("braiding removes dead ends and adds loops", () => {
    const g = carveMaze(18, 18, alg, createRng(`braid-${alg}`));
    const before = deadEnds(g).length;
    braid(g, 1, createRng("b"));
    expect(deadEnds(g).length).toBeLessThan(before * 0.2);
    expect(passages(g.open)).toBeGreaterThan(18 * 18 - 1);
  });
});

describe("texture", () => {
  it("prim makes more dead ends than backtracker (the point of varying it)", () => {
    let prim = 0;
    let back = 0;
    for (let i = 0; i < 40; i++) {
      prim += deadEnds(carveMaze(18, 18, "prim", createRng(`p${i}`))).length;
      back += deadEnds(carveMaze(18, 18, "backtracker", createRng(`b${i}`))).length;
    }
    expect(prim).toBeGreaterThan(back * 2);
  });

  it("degree never exceeds 4", () => {
    const g = carveMaze(10, 10, "mixed", createRng("deg"));
    braid(g, 1, createRng("deg2"));
    for (let c = 0; c < 100; c++) expect(degree(g, c)).toBeLessThanOrEqual(4);
  });
});
