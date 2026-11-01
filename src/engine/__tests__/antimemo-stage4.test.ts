import { describe, expect, it } from "vitest";
import { PIANO_COLORS, PIANO_SCALES, PIANO_TIMBRES, contourOf, interestingMelody, melodyRanks, pianoTrial } from "../piano";
import { TANGRAM_BOARD, TANGRAM_MAX_TILINGS, canonicalKey, checkTangram, corners, countTilings, hasHoles, shapeKey, tangramTrial, turnCells } from "../tangram";

/**
 * Anti-memorization for the stage 4 trials (GAME_SPEC_V2.md §7, anexo etapa
 * 4): 5,000 seeds each. Nothing a pair could remember from earlier games — a
 * key, a color, a contour, a piece's turn, the decoy's size — may predict the
 * answer of a new one.
 */

const SEEDS = 5000;
const keyOf = (i: number) => `S4${i}|v2|station|${i % 3}`;

/** Chi-square critical value (Wilson–Hilferty) for upper-tail z (3.09 = p 0.001). */
const chiCrit = (df: number, z = 3.09) => df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
/** z for p = 0.001 / 12 and 0.001 / 4 (Bonferroni over a family of checks). */
const Z_FAMILY_OF_12 = 3.77;
const Z_FAMILY_OF_4 = 3.48;
function chiSquare(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  const e = total / counts.length;
  return counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
}
const argBy = (xs: number[], better: (a: number, b: number) => boolean) => xs.reduce((best, x, i) => (better(x, xs[best]) ? i : best), 0);
/** Allowed lift of a trivial classifier over chance. */
const MARGIN = 0.025;

describe("PIANO DE LA BRUJA, 5,000 seeds", () => {
  const trials = Array.from({ length: SEEDS }, (_, i) => pianoTrial(keyOf(i), i % 2 ? "A" : "B"));
  const ranks = trials.map(melodyRanks);

  it("(a) instances don't repeat (< 0.1 %)", () => {
    const id = (t: (typeof trials)[0]) => `${t.scale}|${t.tonic}|${t.timbre}|${t.beat}|${t.keys.map((k) => k.midi).join()}|${t.melody.join()}|${t.durations.join()}`;
    expect(1 - new Set(trials.map(id)).size / SEEDS).toBeLessThan(0.001);
  });

  it("a new key → note mapping every game: never sorted, the lowest key anywhere (chi-square)", () => {
    for (const t of trials) {
      const r = t.keys.map((k) => k.rank);
      expect(r.every((x, i) => x === i)).toBe(false);
      expect(r.every((x, i) => x === r.length - 1 - i)).toBe(false);
    }
    for (const size of [6, 7, 8]) {
      const group = trials.filter((t) => t.keys.length === size);
      expect(group.length).toBeGreaterThan(SEEDS / 4);
      const counts = new Array(size).fill(0);
      for (const t of group) counts[t.keys.findIndex((k) => k.rank === 0)]++;
      expect(chiSquare(counts), `${size} keys`).toBeLessThan(chiCrit(size - 1, Z_FAMILY_OF_4));
    }
    // Two games in a row almost never share the layout.
    let same = 0;
    for (let i = 1; i < SEEDS; i++) if (trials[i].keys.map((k) => k.rank).join() === trials[i - 1].keys.map((k) => k.rank).join()) same++;
    expect(same / SEEDS).toBeLessThan(0.01);
  });

  it("(b) the answer is uniform by position: every slot, every keyboard size (chi-square, Bonferroni over 12)", () => {
    for (const size of [6, 7, 8]) {
      const group = trials.filter((t) => t.keys.length === size);
      for (let slot = 0; slot < 4; slot++) {
        const counts = new Array(size).fill(0);
        for (const t of group) counts[t.melody[slot]]++;
        expect(chiSquare(counts), `${size} keys, slot ${slot}`).toBeLessThan(chiCrit(size - 1, Z_FAMILY_OF_12));
      }
    }
  });

  it("(c) no trivial classifier beats chance", () => {
    const chance = trials.reduce((s, t) => s + 1 / t.keys.length, 0) / SEEDS;
    const rate = (f: (t: (typeof trials)[0], r: number[]) => boolean) => trials.filter((t, i) => f(t, ranks[i])).length / SEEDS;
    const firstIsFirst = rate((t) => t.melody[0] === 0);
    const lastKeyFirst = rate((t) => t.melody[0] === t.keys.length - 1);
    const highestFirst = rate((t, r) => r[0] === t.keys.length - 1);
    const lowestFirst = rate((_, r) => r[0] === 0);
    const firstColor = trials.filter((t) => t.keys[t.melody[0]].color === PIANO_COLORS[0]).length / trials.filter((t) => t.keys.some((k) => k.color === PIANO_COLORS[0])).length;
    for (const [name, v] of Object.entries({ firstIsFirst, lastKeyFirst, highestFirst, lowestFirst, firstColor })) expect(v, name).toBeLessThan(chance + MARGIN);
    // «It goes up» / «it goes down»: never.
    expect(rate((_, r) => r.every((x, i) => i === 0 || x > r[i - 1]))).toBe(0);
    expect(rate((_, r) => r.every((x, i) => i === 0 || x < r[i - 1]))).toBe(0);
    // «It starts (or ends) on the tonic»: no more than the share of tonic keys.
    const tonicShare = trials.reduce((s, t) => s + t.keys.filter((k) => k.rank % PIANO_SCALES[t.scale].length === 0).length / t.keys.length, 0) / SEEDS;
    const onTonic = (r: number, t: (typeof trials)[0]) => r % PIANO_SCALES[t.scale].length === 0;
    expect(rate((t, r) => onTonic(r[0], t))).toBeLessThan(tonicShare + MARGIN);
    expect(rate((t, r) => onTonic(r[r.length - 1], t))).toBeLessThan(tonicShare + MARGIN);
  });

  it("every melody passes the interest filter; contours are varied (entropy)", () => {
    for (const r of ranks) expect(interestingMelody(r)).toBe(true);
    const counts = new Map<string, number>();
    for (const r of ranks) counts.set(contourOf(r), (counts.get(contourOf(r)) ?? 0) + 1);
    let h = 0;
    for (const c of counts.values()) h -= (c / SEEDS) * Math.log2(c / SEEDS);
    // Measured: ≈ 6.0 bits over ≈ 180 contours. A 4-note melody only has a
    // handful of shapes (up-down-up is the commonest, ≈ 7 %), which is why the
    // answer is the notes, never the contour.
    expect(h).toBeGreaterThan(5.5);
    expect(counts.size).toBeGreaterThan(120);
    expect(Math.max(...counts.values()) / SEEDS).toBeLessThan(0.1);
  });

  it("mutators: scale, timbre, keyboard size, length, repeats, rhythm and tempo all vary", () => {
    const frac = (f: (t: (typeof trials)[0]) => boolean) => trials.filter(f).length / SEEDS;
    expect(new Set(trials.map((t) => t.scale)).size).toBe(Object.keys(PIANO_SCALES).length);
    expect(new Set(trials.map((t) => t.timbre)).size).toBe(PIANO_TIMBRES.length);
    for (const n of [6, 7, 8]) expect(frac((t) => t.keys.length === n)).toBeGreaterThan(0.25);
    for (const n of [4, 5, 6]) expect(frac((t) => t.melody.length === n)).toBeGreaterThan(0.25);
    expect(frac((t) => t.repeats)).toBeGreaterThan(0.4);
    expect(new Set(trials.map((t) => t.beat)).size).toBe(5);
    for (const t of trials) {
      expect(new Set(t.durations).size).toBeGreaterThan(1);
      if (!t.repeats) expect(new Set(t.melody).size).toBe(t.melody.length);
      expect(new Set(t.keys.map((k) => k.color)).size).toBe(t.keys.length);
      expect(new Set(t.keys.map((k) => k.shape)).size).toBe(t.keys.length);
    }
  });
});

describe("TANGRAM A CIEGAS, 5,000 seeds", () => {
  const trials = Array.from({ length: SEEDS }, (_, i) => tangramTrial(keyOf(i), i % 2 ? "A" : "B"));

  it("(d) the construction's solution is always valid", () => {
    for (const t of trials) {
      const c = checkTangram(t, t.solution);
      expect(c.ready && c.fits).toBe(true);
      expect(t.solution.length).toBe(t.pieces.length - (t.decoy ? 1 : 0));
      expect(hasHoles(t.silhouette)).toBe(false);
      expect(corners(t.silhouette).pinches).toBe(0);
    }
  });

  it("(a) silhouettes don't repeat (canonical shape, < 0.1 %)", () => {
    expect(1 - new Set(trials.map((t) => canonicalKey(t.silhouette))).size / SEEDS).toBeLessThan(0.001);
  });

  it("(e) no rectangles or near-convex silhouettes; pieces all different", () => {
    for (const t of trials) {
      expect(corners(t.silhouette).reflex).toBeGreaterThanOrEqual(2);
      let w = 0;
      let h = 0;
      for (const [x, y] of t.silhouette) {
        w = Math.max(w, x + 1);
        h = Math.max(h, y + 1);
      }
      expect(t.area / (w * h)).toBeLessThanOrEqual(0.8);
      expect(w).toBeLessThanOrEqual(TANGRAM_BOARD);
      expect(h).toBeLessThanOrEqual(TANGRAM_BOARD);
      const canon = t.pieces.map((p) => canonicalKey(p.cells, true));
      expect(new Set(canon).size).toBe(canon.length);
    }
  });

  it("(e) alternative tilings stay few", () => {
    const tilings = trials.slice(0, 1000).map((t) => countTilings(t.silhouette, t.pieces.map((p) => p.cells), t.turn, t.turns, TANGRAM_MAX_TILINGS + 1));
    for (const n of tilings) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(TANGRAM_MAX_TILINGS);
    }
    const sorted = [...tilings].sort((a, b) => a - b);
    expect(sorted[500]).toBeLessThanOrEqual(4);
  });

  it("distributions: piece count uniform; areas, corners and every mutator show up", () => {
    const counts = [3, 4, 5].map((n) => trials.filter((t) => t.solution.length === n).length);
    expect(chiSquare(counts)).toBeLessThan(chiCrit(2));
    const frac = (f: (t: (typeof trials)[0]) => boolean) => trials.filter(f).length / SEEDS;
    expect(frac((t) => t.turns)).toBeGreaterThan(0.6);
    expect(frac((t) => !t.turns)).toBeGreaterThan(0.2);
    expect(frac((t) => t.decoy)).toBeGreaterThan(0.3);
    expect(frac((t) => t.concavity === "many")).toBeGreaterThan(0.4);
    expect(frac((t) => t.concavity === "few")).toBeGreaterThan(0.4);
    for (let a = 15; a <= 23; a++) expect(frac((t) => t.area === a), `area ${a}`).toBeGreaterThan(0.01);
    expect(new Set(trials.map((t) => corners(t.silhouette).reflex)).size).toBeGreaterThan(4);
  });

  it("(b) the silhouette's turn and position are uniform (chi-square, Bonferroni over 4)", () => {
    expect(chiSquare([0, 1, 2, 3].map((q) => trials.filter((t) => t.turn === q).length))).toBeLessThan(chiCrit(3, Z_FAMILY_OF_4));
    for (const axis of [0, 1] as const) {
      // Per room left in the frame, the offset is uniform over it.
      let chi = 0;
      let df = 0;
      for (let room = 2; room <= TANGRAM_BOARD; room++) {
        const group = trials.filter((t) => TANGRAM_BOARD - Math.max(...t.silhouette.map((c) => c[axis] + 1)) + 1 === room);
        if (group.length < room * 20) continue;
        const counts = new Array(room).fill(0);
        for (const t of group) counts[t.offset[axis]]++;
        chi += chiSquare(counts);
        df += room - 1;
      }
      expect(df).toBeGreaterThan(5);
      expect(chi, `axis ${axis}`).toBeLessThan(chiCrit(df, Z_FAMILY_OF_4));
    }
  });

  it("(c) «leave it as it comes» fits no more than chance", () => {
    let hits = 0;
    let chance = 0;
    let n = 0;
    for (const t of trials) {
      if (!t.turns) continue;
      for (const s of t.solution) {
        const p = t.pieces[s.piece];
        const want = shapeKey(turnCells(p.cells, s.turn));
        const same = [0, 1, 2, 3].filter((q) => shapeKey(turnCells(p.cells, q)) === want).length;
        chance += same / 4;
        if (shapeKey(turnCells(p.cells, p.trayTurn)) === want) hits++;
        n++;
      }
    }
    expect(hits / n).toBeLessThan(chance / n + MARGIN);
  });

  it("(c) the decoy isn't the biggest, smallest, first, last, most or least compact piece", () => {
    const withDecoy = trials.filter((t) => t.decoy);
    const chance = withDecoy.reduce((s, t) => s + 1 / t.pieces.length, 0) / withDecoy.length;
    const compact = (cells: readonly (readonly [number, number])[]) => {
      let w = 0;
      let h = 0;
      for (const [x, y] of cells) {
        w = Math.max(w, x + 1);
        h = Math.max(h, y + 1);
      }
      return cells.length / (w * h);
    };
    const classifiers: Record<string, (t: (typeof trials)[0]) => number> = {
      first: () => 0,
      last: (t) => t.pieces.length - 1,
      biggest: (t) => argBy(t.pieces.map((p) => p.cells.length), (a, b) => a > b),
      smallest: (t) => argBy(t.pieces.map((p) => p.cells.length), (a, b) => a < b),
      mostCompact: (t) => argBy(t.pieces.map((p) => compact(p.cells)), (a, b) => a > b),
      leastCompact: (t) => argBy(t.pieces.map((p) => compact(p.cells)), (a, b) => a < b),
      mostCorners: (t) => argBy(t.pieces.map((p) => corners(p.cells).reflex), (a, b) => a > b),
    };
    for (const [name, f] of Object.entries(classifiers)) {
      const rate = withDecoy.filter((t) => t.pieces[f(t)].decoy).length / withDecoy.length;
      expect(rate, name).toBeLessThan(chance + 0.04);
    }
  });
});
