import { describe, expect, it } from "vitest";
import { FIGURE_DISTANCE, figureRaster, figuresTrial, rasterArea, rasterDistance, turnedDistance } from "../figures";
import { glyphSet } from "../glyphs";
import { checkCureKey, cureKeys, drawCurse, echoCure, sigilCure } from "../curses";
import { CLUE_TYPES, type LockTrial, allCombos, clueHolds, lockTrial, solveLock } from "../lock";
import { createRng } from "../rng";
import { MAX_GUIDE_FAILS, sealKeys } from "../sealcode";
import { stationEmblems } from "../stations";
import type { Game } from "../types";

/**
 * Anti-memorization (GAME_SPEC_V2.md §0, anexo etapa 2): 5,000 seeds per
 * trial. Nothing a pair could remember from earlier games — a position, a
 * shape, a key, a glyph — may predict the answer of a new one.
 */

const SEEDS = 5000;
const keyOf = (i: number) => `AM${i}|v2|station|${i % 3}`;

/**
 * Chi-square critical value (Wilson–Hilferty). Default p = 0.001 (z 3.09);
 * a family of checks can pass a stricter z so the family stays at 0.001.
 */
const chiCrit = (df: number, z = 3.09) => df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
/** z for p = 0.001 / 6 (Bonferroni over 6 checks). */
const Z_FAMILY_OF_6 = 3.59;
function chiSquare(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  const e = total / counts.length;
  return counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
}
const argBy = (xs: number[], better: (a: number, b: number) => boolean) =>
  xs.reduce((best, x, i) => (better(x, xs[best]) ? i : best), 0);

describe("FIGURAS RARAS, 5,000 seeds", () => {
  const trials = Array.from({ length: SEEDS }, (_, i) => figuresTrial(keyOf(i), i % 2 ? "A" : "B"));
  const rasters = trials.map((t) => t.params.map((p) => figureRaster(p)));

  it("the correct position is uniform (chi-square per candidate count)", () => {
    let chi = 0;
    let df = 0;
    for (let n = 9; n <= 12; n++) {
      const group = trials.filter((t) => t.candidates.length === n);
      expect(group.length).toBeGreaterThan(SEEDS / 8);
      const counts = new Array(n).fill(0);
      for (const t of group) counts[t.correct]++;
      chi += chiSquare(counts);
      df += n - 1;
    }
    expect(chi).toBeLessThan(chiCrit(df));
  });

  it("no trivial classifier beats chance", () => {
    const chance = trials.reduce((s, t) => s + 1 / t.candidates.length, 0) / SEEDS;
    const classifiers: Record<string, (r: Uint8Array[]) => number> = {
      first: () => 0,
      last: (r) => r.length - 1,
      middle: (r) => r.length >> 1,
      largest: (r) => argBy(r.map(rasterArea), (a, b) => a > b),
      smallest: (r) => argBy(r.map(rasterArea), (a, b) => a < b),
      central: (r) => argBy(r.map((a) => r.reduce((s, b) => s + rasterDistance(a, b), 0)), (a, b) => a < b),
      oddOneOut: (r) => argBy(r.map((a) => r.reduce((s, b) => s + rasterDistance(a, b), 0)), (a, b) => a > b),
      closestToMean: (r) => {
        const mean = new Uint8Array(r[0].length);
        for (let p = 0; p < mean.length; p++) mean[p] = r.reduce((s, a) => s + a[p], 0) * 2 >= r.length ? 1 : 0;
        return argBy(r.map((a) => rasterDistance(a, mean)), (a, b) => a < b);
      },
    };
    const report: Record<string, number> = {};
    for (const [name, pick] of Object.entries(classifiers)) {
      let hits = 0;
      trials.forEach((t, i) => {
        if (pick(rasters[i]) === t.correct) hits++;
      });
      report[name] = hits / SEEDS;
    }
    for (const [name, acc] of Object.entries(report)) expect(acc, `${name} vs chance ${chance.toFixed(3)}`).toBeLessThan(chance + 0.025);
  });

  it("candidates are neighbours: distinguishable, yet alike", () => {
    let overMax = 0;
    for (const r of rasters) {
      let lo = 1;
      let hi = 0;
      for (let a = 0; a < r.length; a++) {
        for (let b = a + 1; b < r.length; b++) {
          const d = turnedDistance(r[a], r[b]);
          lo = Math.min(lo, d);
          hi = Math.max(hi, d);
        }
      }
      expect(lo).toBeGreaterThanOrEqual(FIGURE_DISTANCE.min);
      if (hi > FIGURE_DISTANCE.max) overMax++;
    }
    expect(overMax / SEEDS).toBeLessThan(0.02);
  });

  it("figure sets don't repeat across seeds", () => {
    const seen = new Set(trials.map((t) => t.candidates[t.correct]));
    expect(1 - seen.size / SEEDS).toBeLessThan(0.001);
  });

  it("every mutator shows up", () => {
    const frac = (f: (t: (typeof trials)[0]) => boolean) => trials.filter(f).length / SEEDS;
    expect(frac((t) => t.holes)).toBeGreaterThan(0.3);
    expect(frac((t) => t.mirror)).toBeGreaterThan(0.1);
    expect(frac((t) => t.turn > 0 && !t.mirror)).toBeGreaterThan(0.2);
    expect(frac((t) => t.turn === 0 && !t.mirror)).toBeGreaterThan(0.3);
    for (const s of ["low", "mid", "high"] as const) expect(frac((t) => t.similarity === s)).toBeGreaterThan(0.2);
  });
});

describe("CERRADURA DE DEDUCCIÓN, 5,000 seeds", () => {
  const trials: LockTrial[] = Array.from({ length: SEEDS }, (_, i) => lockTrial(keyOf(i)));
  const candidatesOf = (t: LockTrial) => allCombos(t.glyphCount, t.slots, t.repeats).filter((c) => t.clues.every((k) => clueHolds(k, c)));

  it("(a) every clue is true of the secret", () => {
    for (const t of trials) for (const c of t.clues) expect(clueHolds(c, t.secret)).toBe(true);
  });

  it("(b) the clues alone never pin it down (≥ 8 combinations left)", () => {
    for (const t of trials) {
      expect(t.ambiguity).toBeGreaterThanOrEqual(8);
      expect(t.clues.length).toBeGreaterThanOrEqual(3);
      expect(t.clues.length).toBeLessThanOrEqual(5);
    }
  });

  it("(c) clues + lights open it in ≤ 6 tries in ≥ 99.9 % of games (independent solver)", () => {
    let over = 0;
    trials.forEach((t, i) => {
      if (solveLock(candidatesOf(t), t.secret, t.feedback, createRng(`indep${i}`)) > 6) over++;
    });
    expect(over / SEEDS).toBeLessThanOrEqual(0.001);
  });

  it("(d) without the guide's clues it's clearly harder", () => {
    let withClues = 0;
    let without = 0;
    const sample = trials.slice(0, 400);
    sample.forEach((t, i) => {
      withClues += solveLock(candidatesOf(t), t.secret, t.feedback, createRng(`w${i}`));
      without += solveLock(allCombos(t.glyphCount, t.slots, t.repeats), t.secret, t.feedback, createRng(`w${i}`));
    });
    expect(without / sample.length).toBeGreaterThan(withClues / sample.length + 1);
  });

  it("(e) the secret is uniform: every slot, every glyph", () => {
    for (let g = 6; g <= 8; g++) {
      const group = trials.filter((t) => t.glyphCount === g);
      for (let slot = 0; slot < 4; slot++) {
        const counts = new Array(g).fill(0);
        for (const t of group) counts[t.secret[slot]]++;
        expect(chiSquare(counts), `${g} glyphs, slot ${slot}`).toBeLessThan(chiCrit(g - 1));
      }
    }
  });

  it("(e) no simple feature gives the secret away", () => {
    const rate = (f: (t: LockTrial) => boolean) => trials.filter(f).length / SEEDS;
    const chance = trials.reduce((s, t) => s + 1 / t.glyphCount, 0) / SEEDS;
    expect(rate((t) => t.secret[0] === t.explorerOrder[0])).toBeLessThan(chance + 0.025);
    expect(rate((t) => t.secret[0] === t.guideOrder[0])).toBeLessThan(chance + 0.025);
    expect(rate((t) => t.secret[0] === 0)).toBeLessThan(chance + 0.025);
    expect(rate((t) => t.explorerOrder.join() === t.guideOrder.join())).toBe(0);
  });

  it("(f) every clue type shows up often enough", () => {
    const counts = Object.fromEntries(CLUE_TYPES.map((k) => [k, 0]));
    let total = 0;
    for (const t of trials) for (const c of t.clues) (counts[c.type]++, total++);
    for (const k of CLUE_TYPES) expect(counts[k] / total, k).toBeGreaterThan(0.1);
  });

  it("(g) instances don't repeat (< 0.1 %)", () => {
    const seen = new Set(trials.map((t) => `${t.glyphs.join("")}|${t.secret.join()}`));
    expect(1 - seen.size / SEEDS).toBeLessThan(0.001);
  });

  it("mutators: slots, glyph count, repeats and feedback mode all vary", () => {
    const frac = (f: (t: LockTrial) => boolean) => trials.filter(f).length / SEEDS;
    expect(frac((t) => t.slots === 5)).toBeGreaterThan(0.3);
    expect(frac((t) => t.repeats)).toBeGreaterThan(0.25);
    expect(frac((t) => t.feedback === "counts")).toBeGreaterThan(0.2);
    for (let g = 6; g <= 8; g++) expect(frac((t) => t.glyphCount === g)).toBeGreaterThan(0.2);
  });
});

describe("keys, emblems and glyphs, 5,000 games", () => {
  const seeds = Array.from({ length: SEEDS }, (_, i) => `KG${i}`);

  it("within a game the 30 keys are distinct", () => {
    for (const s of seeds.slice(0, 500)) expect(new Set(sealKeys(s, 3).flat()).size).toBe(3 * (MAX_GUIDE_FAILS + 1));
  });

  it("a key remembered from another game (almost) never opens anything", () => {
    const first = seeds.map((s) => sealKeys(s, 3)[0][0]);
    expect(1 - new Set(first).size / SEEDS).toBeLessThan(0.001);
    let opens = 0;
    for (let i = 1; i < SEEDS; i++) if (sealKeys(seeds[i], 3).flat().includes(first[i - 1])) opens++;
    expect(opens / SEEDS).toBeLessThan(0.001);
  });

  it("emblems change between games", () => {
    const emblems = seeds.map((seed) => stationEmblems({ seed } as Game).map((e) => e.d).join("|"));
    expect(1 - new Set(emblems).size / SEEDS).toBeLessThan(0.001);
  });

  it("glyph sets change between stations and games", () => {
    const sets = seeds.map((s) => glyphSet(s, 7).paths.join("|"));
    expect(1 - new Set(sets).size / SEEDS).toBeLessThan(0.001);
  });
});

describe("CURA: sigilo y antídoto, 5,000 seeds", () => {
  const trials = Array.from({ length: SEEDS }, (_, i) => sigilCure(`SG${i}`, i % 7));
  const rasters = trials.map((t) => t.params.map((p) => figureRaster(p)));

  it("6 candidates, correct one uniform (chi-square)", () => {
    const counts = new Array(6).fill(0);
    for (const t of trials) {
      expect(t.candidates).toHaveLength(6);
      counts[t.correct]++;
    }
    expect(chiSquare(counts)).toBeLessThan(chiCrit(5));
  });

  it("no trivial classifier beats chance (1/6) by more than 2.5 points", () => {
    const pickers: Record<string, (r: Uint8Array[]) => number> = {
      first: () => 0,
      last: (r) => r.length - 1,
      largest: (r) => argBy(r.map(rasterArea), (a, b) => a > b),
      smallest: (r) => argBy(r.map(rasterArea), (a, b) => a < b),
      central: (r) => argBy(r.map((a) => r.reduce((s, b) => s + rasterDistance(a, b), 0)), (a, b) => a < b),
      oddOneOut: (r) => argBy(r.map((a) => r.reduce((s, b) => s + rasterDistance(a, b), 0)), (a, b) => a > b),
    };
    for (const [name, pick] of Object.entries(pickers)) {
      const acc = trials.filter((t, i) => pick(rasters[i]) === t.correct).length / SEEDS;
      expect(acc, name).toBeLessThan(1 / 6 + 0.025);
    }
  });

  it("candidates stay distinguishable; sets don't repeat (< 0.1 %)", () => {
    trials.slice(0, 500).forEach((t, i) => {
      const r = rasters[i];
      for (let a = 0; a < r.length; a++) for (let b = a + 1; b < r.length; b++) expect(turnedDistance(r[a], r[b])).toBeGreaterThanOrEqual(FIGURE_DISTANCE.min);
      expect(t.candidates).toHaveLength(6);
    });
    expect(1 - new Set(trials.map((t) => t.candidates.join("|"))).size / SEEDS).toBeLessThan(0.001);
  });

  it("mutators: turned, mirrored and holes all show up", () => {
    const frac = (f: (t: (typeof trials)[0]) => boolean) => trials.filter(f).length / SEEDS;
    expect(frac((t) => t.mirror)).toBeGreaterThan(0.1);
    expect(frac((t) => t.turn > 0 && !t.mirror)).toBeGreaterThan(0.2);
    expect(frac((t) => t.holes)).toBeGreaterThan(0.3);
  });
});

describe("CURA: eco, 5,000 seeds", () => {
  const echoes = Array.from({ length: SEEDS }, (_, i) => echoCure(`EC${i}`, i % 7));

  it("the sequence is uniform per slot, per set size (chi-square)", () => {
    for (const size of [5, 6]) {
      const group = echoes.filter((e) => e.glyphs.length === size);
      expect(group.length).toBeGreaterThan(SEEDS / 4);
      for (let slot = 0; slot < 3; slot++) {
        const counts = new Array(size).fill(0);
        for (const e of group) counts[e.sequence[slot]]++;
        // 2 set sizes × 3 slots: Bonferroni keeps the whole family at p = 0.001.
        expect(chiSquare(counts), `${size} glyphs, slot ${slot}`).toBeLessThan(chiCrit(size - 1, Z_FAMILY_OF_6));
      }
    }
  });

  it("no keyboard shortcut: «the first key», «the same as last time» don't predict the answer", () => {
    const chance = echoes.reduce((s, e) => s + 1 / e.glyphs.length, 0) / SEEDS;
    const rate = (f: (e: (typeof echoes)[0]) => boolean) => echoes.filter(f).length / SEEDS;
    expect(rate((e) => e.sequence[0] === e.keyboard[0])).toBeLessThan(chance + 0.025);
    expect(rate((e) => e.sequence[0] === 0)).toBeLessThan(chance + 0.025);
    expect(rate((e) => e.keyboard.every((g, i) => g === i))).toBe(0);
    for (const e of echoes) if (!e.repeats) expect(new Set(e.sequence).size).toBe(e.sequence.length);
  });

  it("instances and glyph sets don't repeat (< 0.1 %)", () => {
    expect(1 - new Set(echoes.map((e) => `${e.glyphs.join("")}|${e.sequence.join()}`)).size / SEEDS).toBeLessThan(0.001);
    expect(1 - new Set(echoes.map((e) => e.glyphs.join(""))).size / SEEDS).toBeLessThan(0.001);
  });

  it("mutators: length, set size, repeats and rhythm all vary", () => {
    const frac = (f: (e: (typeof echoes)[0]) => boolean) => echoes.filter(f).length / SEEDS;
    expect(frac((e) => e.sequence.length === 4)).toBeGreaterThan(0.3);
    expect(frac((e) => e.sequence.length === 3)).toBeGreaterThan(0.3);
    expect(frac((e) => e.repeats)).toBeGreaterThan(0.3);
    expect(new Set(echoes.map((e) => e.beatMs)).size).toBeGreaterThan(2);
  });
});

describe("curses and cure keys, 5,000 seeds", () => {
  it("curse kinds and cure kinds are drawn evenly (chi-square)", () => {
    const kinds: Record<string, number> = {};
    let sigils = 0;
    for (let i = 0; i < SEEDS; i++) {
      const c = drawCurse(`CK${i}`, i % 9);
      kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
      if (c.cure === "sigil") sigils++;
    }
    expect(chiSquare(Object.values(kinds))).toBeLessThan(chiCrit(Object.keys(kinds).length - 1));
    expect(chiSquare([sigils, SEEDS - sigils])).toBeLessThan(chiCrit(1));
  });

  it("the curse sequence of a game doesn't repeat across games", () => {
    const seqs = Array.from({ length: SEEDS }, (_, i) =>
      Array.from({ length: 6 }, (_, k) => {
        const c = drawCurse(`CS${i}`, k);
        return `${c.kind}${c.turn}${c.cure}${c.left}`;
      }).join("|"),
    );
    expect(1 - new Set(seqs).size / SEEDS).toBeLessThan(0.001);
  });

  it("within a game, every cure key of every curse is distinct", () => {
    for (let i = 0; i < 200; i++) {
      const all = Array.from({ length: 8 }, (_, k) => cureKeys(`CD${i}`, k)).flat();
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("a cure key remembered from another game (almost) never cures anything (< 0.1 %)", () => {
    let cures = 0;
    for (let i = 1; i < SEEDS; i++) {
      const old = cureKeys(`CO${i - 1}`, 0)[0];
      for (let k = 0; k < 3; k++) if (checkCureKey(`CO${i}`, k, old).ok) cures++;
    }
    expect(cures / (SEEDS * 3)).toBeLessThan(0.001);
  });
});
