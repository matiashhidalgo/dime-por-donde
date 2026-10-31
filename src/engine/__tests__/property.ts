import { writeFileSync, mkdirSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { auditGame } from "../audit";
import { CODE_ALPHABET, type Level, encodeCode } from "../code";
import { DIFFICULTIES } from "../difficulty";
import { MAX_ATTEMPTS, fingerprint, gamesForCode } from "../generate";
import { createRng } from "../rng";
import type { Game } from "../types";
import { quantile } from "./helpers";

export const SEEDS = 2000;

/** Deterministic list of real game codes for a level. */
export function codesFor(level: Level, n = SEEDS): string[] {
  const rng = createRng(`property-${level}`);
  return Array.from({ length: n }, () =>
    encodeCode({ mode: level, seed: Array.from({ length: 6 }, () => rng.pick([...CODE_ALPHABET])).join("") }),
  );
}

/**
 * The 2,000-seed property suite for one level. Generating once collects
 * everything; each `it` then checks one property over all games, so a failure
 * names the property and the first offending code.
 */
export function propertySuite(level: Level): void {
  const cfg = DIFFICULTIES[level];
  const codes = codesFor(level);
  const games: Game[] = [];
  const again: string[] = [];
  let msPerGame = 0;
  beforeAll(() => {
    const t0 = performance.now();
    for (const code of codes) {
      games.push(gamesForCode(code)[0]);
      again.push(fingerprint(gamesForCode(code)[0]));
    }
    msPerGame = (performance.now() - t0) / (codes.length * 2);
  }, 600_000);

  it(`same code → same maze (${SEEDS} codes, generated twice)`, () => {
    games.forEach((g, i) => expect(fingerprint(g), codes[i]).toBe(again[i]));
  });

  it("different codes → different mazes", () => {
    expect(new Set(games.map(fingerprint)).size).toBe(games.length);
  });

  it("every game passes the independent audit (solvable, no soft-locks, keys/portals/items reachable, ranges)", () => {
    for (let i = 0; i < games.length; i++) {
      const a = auditGame(games[i]);
      expect(a.problems, codes[i]).toEqual([]);
    }
  });

  it("never needs the fallback and retries stay rare", () => {
    expect(games.filter((g) => g.stats.fallback)).toHaveLength(0);
    const attempts = games.map((g) => g.stats.attempt);
    expect(Math.max(...attempts)).toBeLessThan(MAX_ATTEMPTS / 4);
    expect(attempts.reduce((s, a) => s + a, 0) / games.length).toBeLessThan(0.5);
  });

  it("route effort spreads across the level's range (not piled on one edge)", () => {
    const effort = games.map((g) => g.stats.effort);
    const [lo, hi] = cfg.effort;
    const p50 = quantile(effort, 0.5);
    expect(p50).toBeGreaterThan(lo + (hi - lo) * 0.15);
    expect(p50).toBeLessThan(lo + (hi - lo) * 0.75);
  });

  it("obstacle amounts are reasonable for the level", () => {
    for (const g of games) {
      const s = g.stats;
      const cells = cfg.width * cfg.height;
      // Hazards never swallow the board: pits + ice ≤ 15% of cells.
      expect((s.pits + s.iceCells) / cells, g.seed).toBeLessThanOrEqual(0.15);
      expect(s.stars).toBe(cfg.stars);
      expect(s.checkpoints).toBe(cfg.checkpoints);
      expect(s.landmarks).toBeGreaterThanOrEqual(Math.round(cfg.width / cfg.landmarkZone) ** 2 - 1);
    }
  });

  it("variety survives the fairness filters (algorithms, themes, obstacle types)", () => {
    const share = (pred: (g: Game) => boolean) => games.filter(pred).length / games.length;
    for (const alg of ["backtracker", "prim", "mixed"]) expect(share((g) => g.algorithm === alg), alg).toBeGreaterThan(0.2);
    for (const th of ["forest", "cave", "ice", "desert"]) expect(share((g) => g.theme === th), th).toBeGreaterThan(0.18);
    for (const t of ["doors", "portals", "ice", "swirls"] as const) {
      expect(share((g) => g.obstacleTypes.includes(t)), t).toBeGreaterThan(0.15);
    }
  });

  it("writes the stats report", () => {
    const report = summarize(level, games, msPerGame);
    mkdirSync("docs/stats", { recursive: true });
    writeFileSync(`docs/stats/${level}.json`, JSON.stringify(report, null, 2));
    console.log(`\n[${level}] ${JSON.stringify(report)}`);
  });
}

function summarize(level: Level, games: Game[], msPerGame: number) {
  const pick = (f: (g: Game) => number) => {
    const v = games.map(f);
    return {
      min: Math.min(...v),
      p5: quantile(v, 0.05),
      p50: quantile(v, 0.5),
      p95: quantile(v, 0.95),
      max: Math.max(...v),
      mean: Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10,
    };
  };
  const count = <T extends string>(f: (g: Game) => T[]) => {
    const out: Record<string, number> = {};
    for (const g of games) for (const k of f(g)) out[k] = (out[k] ?? 0) + 1;
    return out;
  };
  const failures: Record<string, number> = {};
  for (const g of games) for (const [k, v] of Object.entries(g.stats.failures)) failures[k] = (failures[k] ?? 0) + v;
  return {
    level,
    games: games.length,
    msPerGame: Math.round(msPerGame * 10) / 10,
    attempts: pick((g) => g.stats.attempt),
    retryReasons: failures,
    algorithms: count((g) => [g.algorithm]),
    themes: count((g) => [g.theme]),
    obstacleTypes: count((g) => g.obstacleTypes),
    plainPath: pick((g) => g.stats.plainPath),
    solutionMoves: pick((g) => g.stats.solutionMoves),
    routeDecisions: pick((g) => g.stats.routeDecisions),
    effort: pick((g) => g.stats.effort),
    deadEnds: pick((g) => g.stats.deadEnds),
    junctions: pick((g) => g.stats.junctions),
    loops: pick((g) => g.stats.loops),
    pits: pick((g) => g.stats.pits),
    doors: pick((g) => g.stats.doors),
    portalPairs: pick((g) => g.stats.portalPairs),
    ponds: pick((g) => g.stats.ponds),
    iceCells: pick((g) => g.stats.iceCells),
    swirls: pick((g) => g.stats.swirls),
    lanterns: pick((g) => g.stats.lanterns),
    landmarks: pick((g) => g.stats.landmarks),
    statesExplored: pick((g) => g.stats.statesExplored),
  };
}
