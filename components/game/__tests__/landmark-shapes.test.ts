import { describe, expect, it } from "vitest";
import { generateGame } from "@/src/engine";
import { landmarkShapes } from "../landmark-shapes";

/** v2: landmarks are nameless silhouettes, generated per map (GAME_SPEC_V2.md §2). */
describe("landmark silhouettes", () => {
  const games = Array.from({ length: 30 }, (_, i) => generateGame({ seed: `shape${i}`, level: "hard", version: 1 }));

  it("one silhouette per landmark, all different within a map", () => {
    for (const g of games) {
      const shapes = landmarkShapes(g);
      expect(shapes).toHaveLength(g.landmarks.length);
      expect(new Set(shapes.map((s) => s.d)).size).toBe(shapes.length);
    }
  });

  it("is deterministic: both devices draw the same shapes for a code", () => {
    const a = generateGame({ seed: "shape0", level: "hard", version: 1 });
    expect(landmarkShapes(a)).toEqual(landmarkShapes(games[0]));
  });

  it("changes from map to map, so nothing can be memorized", () => {
    const first = (i: number) => landmarkShapes(games[i]).map((s) => s.d).join("|");
    expect(new Set(games.map((_, i) => first(i))).size).toBe(games.length);
  });

  it("stays inside its 2×2 box (never spills into the next cell) as plain SVG path data", () => {
    for (const g of games.slice(0, 10)) {
      for (const { d } of landmarkShapes(g)) {
        expect(d).toMatch(/^(M[-\d. L]+Z)+$/);
        const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
        for (const n of nums) expect(Math.abs(n)).toBeLessThanOrEqual(1);
      }
    }
  });
});
