import { describe, expect, it } from "vitest";
import { createRng, hashString, mulberry32 } from "../rng";

describe("rng", () => {
  it("same seed → same sequence", () => {
    const a = createRng("hola");
    const b = createRng("hola");
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    expect(createRng("a").next()).not.toBe(createRng("b").next());
  });

  it("has a pinned output so engine results can't drift silently", () => {
    expect(hashString("laberinto")).toBe(hashString("laberinto"));
    const r = mulberry32(42);
    expect([r(), r(), r()].map((x) => x.toFixed(6))).toEqual(["0.601104", "0.448291", "0.852466"]);
  });

  it("forks are independent of the parent's later draws", () => {
    const p1 = createRng("x");
    const f1 = p1.fork("maze");
    const p2 = createRng("x");
    p2.next();
    p2.next();
    const f2 = p2.fork("maze");
    expect(f1.next()).toBe(f2.next());
  });

  it("int/range stay in bounds and cover the range", () => {
    const r = createRng("bounds");
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = r.range(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it("is roughly uniform", () => {
    const r = createRng("uniform");
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) buckets[r.int(10)]++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
  });

  it("shuffle is a permutation and weighted respects zero weights", () => {
    const r = createRng("shuffle");
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    for (let i = 0; i < 1000; i++) expect(r.weighted([0, 1, 0, 3])).not.toBe(0);
  });
});
