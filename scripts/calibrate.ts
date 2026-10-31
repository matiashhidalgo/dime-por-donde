/**
 * Difficulty calibration report: `npx vite-node scripts/calibrate.ts [seeds]`.
 *
 * Generates N games per level and prints what a round costs the pair: route
 * length, decisions, pits that sit beside the route (each one = a warning the
 * guide has to give), detour to grab every star, the current par time and an
 * estimate of real play time under a talking-pace model (see PACE below).
 */
import { DIFFICULTIES, LEVELS, SLOW_FACTOR, bfsMulti, degree, generateGame, isOpen, neighbor, parSeconds, solve } from "../src/engine";
import type { Dir } from "../src/engine";

const N = Number(process.argv[2] ?? 400);

/**
 * Talking-pace model (assumption, not measured): walking a cell while
 * narrating ≈1.6 s; every junction on the route ≈11 s of "what do you see /
 * go left"; every pit next to the route ≈4 s of warning; ~40 s to orient at the
 * start; 1.25× for wrong turns and backtracking.
 */
const PACE = { move: 1.6, decision: 11, pitWarning: 4, start: 40, wander: 1.25 };

type Row = Record<string, number>;
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

for (const level of LEVELS) {
  const rows: Row[] = [];
  for (let i = 0; i < N; i++) {
    const game = generateGame({ seed: `cal${i}`, level, version: 1 });
    const sol = solve(game, game.start, game.exit);
    const route = new Set(sol.route);
    let pitsNear = 0;
    for (const p of game.pits) {
      for (const d of [0, 1, 2, 3] as Dir[]) {
        if (isOpen(game.grid, p, d) && route.has(neighbor(game.grid, p, d))) {
          pitsNear++;
          break;
        }
      }
    }
    const fromRoute = bfsMulti(game.grid, sol.route);
    const starDetour = game.stars.reduce((sum, s) => sum + 2 * Math.max(0, fromRoute[s]), 0);
    const decisions = game.stats.routeDecisions;
    const moves = sol.moves;
    const est =
      (PACE.start + PACE.move * (moves + starDetour) + PACE.decision * decisions + PACE.pitWarning * pitsNear) * PACE.wander;
    rows.push({
      moves,
      decisions,
      effort: game.stats.effort,
      pits: game.pits.length,
      pitsNearRoute: pitsNear,
      starDetour,
      junctionShare: sol.route.filter((c) => degree(game.grid, c) >= 3).length / sol.route.length,
      parMin: parSeconds(game) / 60,
      estMin: est / 60,
      estOverPar: est / parSeconds(game),
    });
  }
  const keys = Object.keys(rows[0]);
  console.log(`\n${DIFFICULTIES[level].name} (${N} partidas)`);
  console.log("                 p5      p50     p95");
  for (const k of keys) {
    const xs = rows.map((r) => r[k]);
    const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2)).padStart(8);
    console.log(`${k.padEnd(15)}${f(q(xs, 0.05))}${f(q(xs, 0.5))}${f(q(xs, 0.95))}`);
  }
  const slow = rows.filter((r) => r.estOverPar > SLOW_FACTOR).length;
  console.log(`estimado > ${SLOW_FACTOR}×par (pierde ★ por tiempo): ${((100 * slow) / N).toFixed(0)} %`);
}
