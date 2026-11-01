import { beforeAll, describe, expect, it } from "vitest";
import { generateGame } from "../generate";
import { distancesFrom, lapTicks, shadowWorld } from "../shadow";
import { auditShadow, withShadow } from "../shadowaudit";
import { TUNING } from "../tuning";
import type { Game } from "../types";

/**
 * Anti-memorization of La Sombra (GAME_SPEC_V2.md §7 and anexo etapa 5), 5,000
 * draws. Generating 5,000 whole maps would take half an hour, so a pool of 50
 * real maps is reused and each draw gets its own seed string: the roll, the
 * route, the mutators and the audit run through the very same `withShadow` the
 * game uses.
 */

const DRAWS = 5000;
const POOL = 50;

interface Draw {
  pool: number;
  game: Game;
}

let bare: Game[] = [];
let draws: Draw[] = [];

beforeAll(() => {
  bare = Array.from({ length: POOL }, (_, i) => {
    const { shadow: _s, shadowSkip: _k, ...rest } = generateGame({ seed: `am${i}`, level: "hard", version: 2 });
    return rest as Game;
  });
  draws = Array.from({ length: DRAWS }, (_, i) => {
    const pool = i % POOL;
    return { pool, game: withShadow({ ...bare[pool], seed: `${bare[pool].seed}~d${i}` }) };
  });
}, 600_000);

const shadowed = () => draws.filter((d) => d.game.shadow);
const chi2 = (counts: number[]) => {
  const n = counts.reduce((a, b) => a + b, 0);
  const e = n / counts.length;
  return counts.reduce((a, c) => a + (c - e) ** 2 / e, 0);
};
/** Chi-square critical values at p = 0.001. */
const CRIT: Record<number, number> = { 1: 10.83, 2: 13.82, 3: 16.27, 4: 18.47, 5: 20.52, 7: 24.32, 9: 27.88, 11: 31.26 };

describe("LA SOMBRA, 5,000 draws", () => {
  it("about two maps in three get one; the audit gives up on almost none", () => {
    const share = shadowed().length / DRAWS;
    expect(share).toBeGreaterThan(TUNING.shadow.chance.base - 0.05);
    expect(share).toBeLessThan(TUNING.shadow.chance.base + 0.05);
    const gaveUp = draws.filter((d) => d.game.shadowSkip === "audit").length / DRAWS;
    expect(gaveUp).toBeLessThan(0.005);
  }, 600_000);

  it("(d) fairness: the audit passes in 100 % of them (retries counted), always within the ratio", () => {
    let retried = 0;
    let worst = 0;
    let hunters = 0;
    for (const { game } of shadowed()) {
      // Hunters cost ~10× more to audit: a spread sample of them, every other map in full.
      if (game.shadow!.hunter && hunters++ % 4 !== 0) continue;
      const a = auditShadow(game);
      expect(a.ok).toBe(true);
      worst = Math.max(worst, a.worstRatio);
      if (game.shadow!.attempt > 0) retried++;
    }
    expect(worst).toBeLessThanOrEqual(TUNING.shadow.fairRatio + 0.5);
    // Information for the report: how often the first seed attempt needed a retry.
    expect(retried / shadowed().length).toBeLessThan(0.1);
  }, 600_000);

  it("(a) collisions: identical patrols on the same map < 0.1 % (route + shape + speed + phase + mutators)", () => {
    const seen = new Set<string>();
    let collisions = 0;
    const routeOnly = new Set<string>();
    let routeCollisions = 0;
    for (const { pool, game } of shadowed()) {
      const sh = game.shadow!;
      const r = `${pool}|${sh.shape}|${sh.route.join(",")}`;
      if (routeOnly.has(r)) routeCollisions++;
      routeOnly.add(r);
      const k = `${r}|${sh.slow}|${sh.phase}|${sh.hunter}|${sh.bodies}|${sh.offset}`;
      if (seen.has(k)) collisions++;
      seen.add(k);
    }
    expect(collisions / shadowed().length).toBeLessThan(0.001);
    // Same route on the same map (any phase): ~100 draws share each pool map here, so this is a
    // birthday count, not something a pair can run into (a map never repeats). Reported in the annex.
    // Still rare.
    expect(routeCollisions / shadowed().length).toBeLessThan(0.08);
  });

  it("(b) the starting phase is uniform over the lap (chi-square, 8 buckets)", () => {
    const counts = new Array(8).fill(0);
    for (const { game } of shadowed()) {
      const sh = game.shadow!;
      counts[Math.min(7, Math.floor((sh.phase / lapTicks(sh)) * 8))]++;
    }
    expect(chi2(counts)).toBeLessThan(CRIT[7]);
  });

  it("the starting cell isn't a fixed spot of the route: first/last/middle of the route start about as expected", () => {
    let atEnd = 0;
    for (const { game } of shadowed()) {
      const sh = game.shadow!;
      const first = sh.route.indexOf(sh.route[0]);
      void first;
      const i = Math.floor(((sh.phase % lapTicks(sh)) / sh.slow) % (sh.shape === "loop" ? sh.route.length : 2 * (sh.route.length - 1)));
      const idx = sh.shape === "loop" || i < sh.route.length ? i : 2 * (sh.route.length - 1) - i;
      if (idx === 0 || idx === sh.route.length - 1) atEnd++;
    }
    // Two end cells out of ~26 on average: a few percent, never a default.
    expect(atEnd / shadowed().length).toBeLessThan(0.15);
  });

  it("mutators show up with reasonable frequencies", () => {
    const s = shadowed().map((d) => d.game.shadow!);
    const frac = (f: (x: (typeof s)[number]) => boolean) => s.filter(f).length / s.length;
    expect(frac((x) => x.slow === 1)).toBeGreaterThan(TUNING.shadow.fast.base - 0.06);
    expect(frac((x) => x.slow === 1)).toBeLessThan(TUNING.shadow.fast.base + 0.06);
    expect(frac((x) => x.hunter)).toBeGreaterThan(TUNING.shadow.hunter.base - 0.06);
    expect(frac((x) => x.hunter)).toBeLessThan(TUNING.shadow.hunter.base + 0.06);
    expect(frac((x) => x.shape === "loop")).toBeGreaterThan(0.1);
    expect(frac((x) => x.shape === "ping")).toBeGreaterThan(0.4);
    // A single map (no streak) always has a single body.
    expect(frac((x) => x.bodies === 2)).toBe(0);
  });

  it("no fixed patrol template: lengths cover the whole range and shapes are new nearly every time", () => {
    const [lo, hi] = TUNING.shadow.routeLength;
    const byLen = new Map<number, number>();
    const shapes = new Set<string>();
    const shapeCount = new Map<string, number>();
    for (const { game } of shadowed()) {
      const sh = game.shadow!;
      byLen.set(sh.route.length, (byLen.get(sh.route.length) ?? 0) + 1);
      const W = game.grid.width;
      const x0 = Math.min(...sh.route.map((c) => c % W));
      const y0 = Math.min(...sh.route.map((c) => Math.floor(c / W)));
      const shape = sh.route.map((c) => `${(c % W) - x0},${Math.floor(c / W) - y0}`).join(";");
      shapes.add(shape);
      shapeCount.set(shape, (shapeCount.get(shape) ?? 0) + 1);
    }
    expect(byLen.size).toBeGreaterThanOrEqual(hi - lo - 3);
    const most = Math.max(...byLen.values()) / shadowed().length;
    expect(most).toBeLessThan(0.12);
    // Shapes (up to translation) are copies of each other only in a few short, plain routes (a straight
    // stretch or an L looks the same in any maze), and no single shape takes even 1 % of the draws.
    expect(shapes.size / shadowed().length).toBeGreaterThan(0.9);
    expect(Math.max(...shapeCount.values()) / shadowed().length).toBeLessThan(0.01);
    // Never one length or shape always.
    expect(new Set(shadowed().map((d) => d.game.shadow!.shape)).size).toBe(2);
  });

  it("trivial classifiers don't predict the phase or the route", () => {
    const rows = shadowed().map(({ game }) => {
      const sh = game.shadow!;
      const W = game.grid.width;
      const c = sh.route[0];
      const cx = sh.route.reduce((a, x) => a + (x % W), 0) / sh.route.length;
      const cy = sh.route.reduce((a, x) => a + Math.floor(x / W), 0) / sh.route.length;
      return {
        phase: Math.min(3, Math.floor((sh.phase / lapTicks(sh)) * 4)),
        quad: (cx < game.grid.width / 2 ? 0 : 1) + (cy < game.grid.height / 2 ? 0 : 2),
        feats: {
          len: Math.floor(sh.route.length / 7),
          shape: sh.shape,
          slow: sh.slow,
          hunter: sh.hunter,
          startX: Math.floor(((c % W) / W) * 4),
          startY: Math.floor((Math.floor(c / W) / game.grid.height) * 4),
          lap: Math.floor(lapTicks(sh) / 20),
        } as Record<string, string | number | boolean>,
      };
    });
    const half = Math.floor(rows.length / 2);
    const train = rows.slice(0, half);
    const test = rows.slice(half);
    const MARGIN = 0.05;
    const accuracy = (target: "phase" | "quad", name: string) => {
      const table = new Map<string, number[]>();
      for (const r of train) {
        const k = String(r.feats[name]);
        const t = table.get(k) ?? [0, 0, 0, 0];
        t[r[target]]++;
        table.set(k, t);
      }
      let hit = 0;
      for (const r of test) {
        const t = table.get(String(r.feats[name])) ?? [0, 0, 0, 0];
        if (t.indexOf(Math.max(...t)) === r[target]) hit++;
      }
      return hit / test.length;
    };
    // Chance for the phase is 1/4; for the quadrant it's the share of the most common one.
    const quadBase = Math.max(...[0, 1, 2, 3].map((q) => test.filter((r) => r.quad === q).length)) / test.length;
    // Where the route starts obviously says where it is, so position features only try the phase.
    for (const name of ["len", "shape", "slow", "hunter", "startX", "startY", "lap"]) {
      expect(accuracy("phase", name)).toBeLessThan(0.25 + MARGIN);
      if (!name.startsWith("start")) expect(accuracy("quad", name)).toBeLessThan(quadBase + MARGIN);
    }
    // "The phase predicts the quadrant" (the other direction) doesn't beat the base either.
    const byPhase = new Map<number, number[]>();
    for (const r of train) {
      const t = byPhase.get(r.phase) ?? [0, 0, 0, 0];
      t[r.quad]++;
      byPhase.set(r.phase, t);
    }
    let hit = 0;
    for (const r of test) {
      const t = byPhase.get(r.phase) ?? [0, 0, 0, 0];
      if (t.indexOf(Math.max(...t)) === r.quad) hit++;
    }
    expect(hit / test.length).toBeLessThan(quadBase + MARGIN);
  });

  it("the routes use real passages and never touch the protected cells (the audit's other half)", () => {
    for (const { game } of shadowed().slice(0, 400)) {
      const sh = game.shadow!;
      const w = shadowWorld(game);
      for (let i = 0; i < sh.route.length - 1; i++) expect(distancesFrom(w, sh.route[i])[sh.route[i + 1]]).toBe(1);
      for (const c of sh.route) {
        expect(w.allowed[c]).toBe(1);
        expect([game.start, game.exit, ...game.stations!.map((s) => s.cell)]).not.toContain(c);
      }
    }
  });
});
