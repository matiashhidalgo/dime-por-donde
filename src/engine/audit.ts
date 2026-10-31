import { DIFFICULTIES, OBSTACLE_TYPES } from "./difficulty";
import { BIT, DIRS, OPPOSITE, bfs, cellLabel, neighbor } from "./grid";
import { solve, routeEffort } from "./solver";
import type { Game, World } from "./types";

/**
 * Independent re-check of a generated game. Used by the test suite on
 * thousands of seeds and by /debug to show a green/red badge. It re-solves
 * from scratch instead of trusting anything the generator stored.
 */

export interface Audit {
  ok: boolean;
  problems: string[];
}

export function auditGame(game: Game): Audit {
  const problems: string[] = [];
  const g = game.grid;
  const total = g.width * g.height;
  const cfg = DIFFICULTIES[game.level];
  const label = (c: number) => cellLabel(g, c);
  const fail = (msg: string) => problems.push(msg);

  // ── Structure ──
  if (g.width !== cfg.width || g.height !== cfg.height) fail("wrong size for level");
  for (let c = 0; c < total; c++) {
    for (const d of DIRS) {
      if (!(g.open[c] & BIT[d])) continue;
      const n = neighbor(g, c, d);
      if (n < 0) fail(`${label(c)} open to the outside`);
      else if (!(g.open[n] & BIT[OPPOSITE[d]])) fail(`${label(c)} one-sided wall`);
    }
  }
  if (bfs(g, 0).some((d) => d < 0)) fail("maze not fully connected");

  // ── Occupants match the lists, one per cell, never on ice ──
  const expected = new Map<number, string>();
  const claim = (c: number, what: string) => {
    if (expected.has(c)) fail(`${label(c)} holds ${expected.get(c)} and ${what}`);
    expected.set(c, what);
  };
  claim(game.start, "start");
  claim(game.exit, "exit");
  game.checkpoints.forEach((c) => claim(c, "checkpoint"));
  game.pits.forEach((c) => claim(c, "pit"));
  game.doors.forEach((d) => claim(d.cell, "door"));
  game.keys.forEach((k) => claim(k.cell, "key"));
  game.portals.forEach((p) => (claim(p.a, "portal"), claim(p.b, "portal")));
  game.swirls.forEach((s) => claim(s.cell, "swirl"));
  game.stars.forEach((c) => claim(c, "star"));
  game.lanterns.forEach((c) => claim(c, "lantern"));
  for (let c = 0; c < total; c++) {
    const occ = game.occupant[c];
    if ((occ?.type ?? null) !== (expected.get(c) ?? null)) fail(`${label(c)} occupant mismatch`);
    if (occ && game.ice[c]) fail(`${label(c)} ${occ.type} on ice`);
  }
  const doorColors = game.doors.map((d) => d.color).sort();
  const keyColors = game.keys.map((k) => k.color).sort();
  if (doorColors.join() !== keyColors.join()) fail("doors and keys don't pair up");
  if (new Set(doorColors).size !== doorColors.length) fail("repeated door color");

  // ── Landmarks: unique phrases, on free ground ──
  const labels = game.landmarks.map((l) => l.label);
  if (new Set(labels).size !== labels.length) fail("repeated landmark label");
  for (const l of game.landmarks) if (game.occupant[l.cell] || game.ice[l.cell]) fail(`landmark on busy ${label(l.cell)}`);

  // ── Obstacle mix within the level's ranges ──
  const types = game.obstacleTypes;
  if (!game.stats.fallback) {
    const [tMin, tMax] = cfg.obstacleTypeCount;
    if (types.length < tMin || types.length > tMax) fail(`${types.length} obstacle types`);
    if (!types.includes("pits")) fail("no pits type");
    if (types.some((t) => !OBSTACLE_TYPES.includes(t))) fail("unknown obstacle type");
    const within = (n: number, [lo, hi]: readonly [number, number], what: string, on: boolean) => {
      if (on && (n < lo || n > hi)) fail(`${n} ${what} (expected ${lo}-${hi})`);
      if (!on && n !== 0) fail(`${what} present but type not chosen`);
    };
    within(game.pits.length, cfg.pits, "pits", types.includes("pits"));
    within(game.doors.length, [1, cfg.doors[1]], "doors", types.includes("doors"));
    within(game.portals.length, [1, cfg.portalPairs[1]], "portal pairs", types.includes("portals"));
    within(game.ponds.length, [1, cfg.icePonds[1]], "ponds", types.includes("ice"));
    within(game.swirls.length, [1, cfg.swirls[1]], "swirls", types.includes("swirls"));
    if (game.stars.length !== cfg.stars) fail(`${game.stars.length} stars`);
    if (game.lanterns.length > cfg.lanterns[1]) fail(`${game.lanterns.length} lanterns`);
    if (game.checkpoints.length !== cfg.checkpoints) fail(`${game.checkpoints.length} checkpoints`);
  }

  // ── Fairness, re-solved from scratch ──
  const world: World = { grid: g, ice: game.ice, occupant: game.occupant, portals: game.portals };
  const s = solve(world, game.start, game.exit);
  if (!s.solvable) fail("exit unreachable");
  if (s.solvable && s.moves !== game.solution.moves) fail("stored solution length differs");
  if (s.deadStates > 0) fail(`${s.deadStates} soft-lock states`);
  const must: [number, string][] = [
    ...game.keys.map((k) => [k.cell, "key"] as [number, string]),
    ...game.portals.flatMap((p) => [[p.a, "portal"], [p.b, "portal"]] as [number, string][]),
    ...game.stars.map((c) => [c, "star"] as [number, string]),
    ...game.lanterns.map((c) => [c, "lantern"] as [number, string]),
    ...game.checkpoints.map((c) => [c, "checkpoint"] as [number, string]),
    ...game.swirls.map((w) => [w.cell, "swirl"] as [number, string]),
  ];
  for (const [c, what] of must) if (!s.reachable[c]) fail(`${what} at ${label(c)} unreachable`);

  // No key locked behind its own door: remove the key, it must still be reachable.
  for (const k of game.keys) {
    const occupant = game.occupant.slice();
    occupant[k.cell] = null;
    const without = solve({ ...world, occupant }, game.start, game.exit);
    if (!without.reachable[k.cell]) fail(`key at ${label(k.cell)} sits behind its own door`);
  }

  if (!game.stats.fallback && s.solvable) {
    const effort = routeEffort(g, game.ice, s);
    const [lo, hi] = cfg.effort;
    if (effort < lo || effort > hi) fail(`effort ${effort} outside ${lo}-${hi}`);
  }

  return { ok: problems.length === 0, problems };
}
