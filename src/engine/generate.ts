import { type GameCode, type Level, GENERATOR_VERSION, LEVELS, parseCode } from "./code";
import { DECISION_WEIGHT, DIFFICULTIES, type ObstacleType } from "./difficulty";
import { degree } from "./grid";
import { type MazeAlgorithm, braid, carveMaze, deadEnds } from "./maze";
import {
  type Build,
  PlacementError,
  carvePonds,
  chooseEnds,
  createBuild,
  mustReach,
  placeCheckpoints,
  placeDoorsAndKeys,
  placeLandmarks,
  placeLanterns,
  placePits,
  placePortals,
  placeStars,
  placeSwirls,
} from "./place";
import { type Rng, createRng, hashString } from "./rng";
import { routeDecisions, routeEffort, solve } from "./solver";
import { withStations } from "./stations";
import { THEMES, THEME_IDS, type ThemeId } from "./themes";
import type { Game, GameStats } from "./types";

/**
 * Orchestrator. Generator v1 is FROZEN once shipped: any change to what it
 * outputs must become v2 (old codes have to keep producing the same maze).
 * The golden-fingerprint test guards this.
 *
 * Retry rule: attempt n reseeds every phase with `…|n`. Both devices walk the
 * same attempts in the same order, so they always land on the same game.
 */

export const MAX_ATTEMPTS = 40;
const ALGORITHMS: readonly MazeAlgorithm[] = ["backtracker", "prim", "mixed"];
const OPTIONAL_TYPES: readonly ObstacleType[] = ["doors", "portals", "ice", "swirls"];

export interface GenerateInput {
  seed: string;
  level: Level;
  version?: number;
  /** Duo mode pins themes so three rounds never repeat one. */
  theme?: ThemeId;
}

type AttemptResult = { ok: true; game: Game } | { ok: false; reason: string };

export function generateGame(input: GenerateInput): Game {
  const version = input.version ?? GENERATOR_VERSION;
  // v2 = the frozen v1 map + 3 sealed stations on their own RNG stream. A map
  // that can't host stations safely is skipped for the next seed variant.
  if (version === 2) {
    for (let variant = 0; ; variant++) {
      const seed = variant === 0 ? input.seed : `${input.seed}~${variant}`;
      const game = withStations({ ...generateGame({ ...input, seed, version: 1 }), version: 2 });
      if (game) return game;
    }
  }
  if (version !== 1) throw new Error(`generator v${version} not available`);
  const failures: Record<string, number> = {};
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const r = attemptBuild(input, attempt, false);
    if (r.ok) {
      r.game.stats.failures = failures;
      return r.game;
    }
    failures[r.reason] = (failures[r.reason] ?? 0) + 1;
  }
  const r = attemptBuild(input, MAX_ATTEMPTS, true);
  if (!r.ok) throw new Error(`fallback failed: ${r.reason}`);
  r.game.stats.failures = failures;
  return r.game;
}

/** One code → one game, or three for "Dúo de 3 rondas" (easy → medium → hard, distinct themes). */
export function gamesForCode(code: string | GameCode): Game[] {
  let info: GameCode;
  if (typeof code === "string") {
    const parsed = parseCode(code);
    if (!parsed.ok) throw new Error(parsed.message);
    info = parsed.value;
  } else {
    info = code;
  }
  // v2 reuses the «duo» header for Racha: its maps come from streakGame (streak.ts).
  if (info.mode === "duo" && info.version >= 2) throw new Error("streak code: build its maps with streakGame");
  if (info.mode !== "duo") return [generateGame({ seed: info.seed, level: info.mode, version: info.version })];
  const themes = createRng(`v${info.version}|duo|${info.seed}|themes`).shuffle(THEME_IDS);
  return LEVELS.map((level, i) =>
    generateGame({ seed: `${info.seed}#duo${i + 1}`, level, version: info.version, theme: themes[i] }),
  );
}

function chooseTypes(rng: Rng, min: number, max: number): ObstacleType[] {
  const count = rng.range(min, max);
  return ["pits", ...rng.shuffle(OPTIONAL_TYPES).slice(0, count - 1)];
}

function attemptBuild(input: GenerateInput, attempt: number, fallback: boolean): AttemptResult {
  const cfg = DIFFICULTIES[input.level];
  const base = `v1|${input.level}|${input.seed}`;
  // Theme depends only on the seed, so a retry never changes the look.
  const theme = input.theme ?? createRng(`${base}|theme`).pick(THEME_IDS);
  const rng = createRng(`${base}|${attempt}`);
  const range = (r: readonly [number, number], label: string) => rng.fork(`n-${label}`).range(r[0], r[1]);

  const algorithm = ALGORITHMS[rng.fork("algorithm").weighted(ALGORITHMS.map((a) => cfg.algorithmWeights[a]))];
  const grid = carveMaze(cfg.width, cfg.height, algorithm, rng.fork("maze"));
  const braidRng = rng.fork("braid");
  const braidOpened = braid(grid, cfg.braid[0] + braidRng.next() * (cfg.braid[1] - cfg.braid[0]), braidRng);
  const types: ObstacleType[] = fallback ? [] : chooseTypes(rng.fork("types"), ...cfg.obstacleTypeCount);
  const has = (t: ObstacleType) => types.includes(t);

  const b = createBuild(cfg, grid);
  try {
    chooseEnds(b, rng.fork("ends"));
    if (has("ice")) carvePonds(b, range(cfg.icePonds, "ponds"), rng.fork("ponds"));
    if (has("doors")) placeDoorsAndKeys(b, range(cfg.doors, "doors"), rng.fork("doors"));
    placeCheckpoints(b, cfg.checkpoints);
    if (has("portals")) placePortals(b, range(cfg.portalPairs, "portals"), rng.fork("portals"));
    if (has("swirls")) placeSwirls(b, range(cfg.swirls, "swirls"), rng.fork("swirls"));
    placeStars(b, cfg.stars, rng.fork("stars"));
    placeLanterns(b, range(cfg.lanterns, "lanterns"), rng.fork("lanterns"));
    if (has("pits")) placePits(b, range(cfg.pits, "pits"), rng.fork("pits"));
    placeLandmarks(b, THEMES[theme], rng.fork("landmarks"));
  } catch (e) {
    if (e instanceof PlacementError) return { ok: false, reason: e.reason };
    throw e;
  }

  const world = { grid, ice: b.ice, occupant: b.occupant, portals: b.portals };
  const sol = solve(world, b.start, b.exit);
  if (!sol.solvable) return { ok: false, reason: "unsolvable" };
  if (!fallback) {
    if (b.keys.some((k) => !sol.reachable[k.cell])) return { ok: false, reason: "key-unreachable" };
    if (mustReach(b).some((c) => !sol.reachable[c])) return { ok: false, reason: "item-unreachable" };
    if (sol.deadStates > 0) return { ok: false, reason: "softlock" };
    if (has("doors") && b.doors.length === 0) return { ok: false, reason: "no-door-spot" };
    if (has("portals") && b.portals.length === 0) return { ok: false, reason: "no-portal-spot" };
    if (has("ice") && b.ponds.length === 0) return { ok: false, reason: "no-pond-spot" };
    if (has("swirls") && b.swirls.length === 0) return { ok: false, reason: "no-swirl-spot" };
    if (b.pits.length < cfg.pits[0]) return { ok: false, reason: "few-pits" };
    const [lo, hi] = cfg.effort;
    const effort = routeEffort(grid, b.ice, sol);
    if (effort < lo) return { ok: false, reason: "route-short" };
    if (effort > hi) return { ok: false, reason: "route-long" };
  }

  return {
    ok: true,
    game: assemble(b, {
      version: 1,
      level: input.level,
      seed: input.seed,
      theme,
      algorithm,
      types,
      attempt,
      fallback,
      braidOpened,
      solution: { moves: sol.moves, route: sol.route },
      statesExplored: sol.statesExplored,
    }),
  };
}

function assemble(
  b: Build,
  meta: {
    version: number;
    level: Level;
    seed: string;
    theme: ThemeId;
    algorithm: MazeAlgorithm;
    types: ObstacleType[];
    attempt: number;
    fallback: boolean;
    braidOpened: number;
    solution: Game["solution"];
    statesExplored: number;
  },
): Game {
  const g = b.grid;
  const total = g.width * g.height;
  let passages = 0;
  let junctions = 0;
  for (let c = 0; c < total; c++) {
    passages += degree(g, c);
    if (degree(g, c) >= 3) junctions++;
  }
  passages /= 2;
  const decisions = routeDecisions(g, b.ice, meta.solution.route);

  const stats: GameStats = {
    attempt: meta.attempt,
    fallback: meta.fallback,
    failures: {},
    deadEnds: deadEnds(g).length,
    junctions,
    loops: passages - (total - 1),
    braidOpened: meta.braidOpened,
    plainPath: b.mainPath.length - 1,
    solutionMoves: meta.solution.moves,
    solutionCells: meta.solution.route.length - 1,
    routeDecisions: decisions,
    effort: meta.solution.moves + DECISION_WEIGHT * decisions,
    pits: b.pits.length,
    doors: b.doors.length,
    portalPairs: b.portals.length,
    ponds: b.ponds.length,
    iceCells: b.ice.reduce((s, v) => s + v, 0),
    swirls: b.swirls.length,
    stars: b.stars.length,
    lanterns: b.lanterns.length,
    checkpoints: b.checkpoints.length,
    landmarks: b.landmarks.length,
    statesExplored: meta.statesExplored,
  };

  return {
    version: meta.version,
    level: meta.level,
    seed: meta.seed,
    theme: meta.theme,
    algorithm: meta.algorithm,
    obstacleTypes: meta.types,
    grid: g,
    ice: b.ice,
    occupant: b.occupant,
    start: b.start,
    exit: b.exit,
    checkpoints: b.checkpoints,
    pits: b.pits,
    doors: b.doors,
    keys: b.keys,
    portals: b.portals,
    ponds: b.ponds,
    swirls: b.swirls,
    stars: b.stars,
    lanterns: b.lanterns,
    landmarks: b.landmarks,
    solution: meta.solution,
    stats,
  };
}

/**
 * Stable digest of everything a player can see or touch. Two devices agree on
 * a game iff their fingerprints match (also handy to show in a debug corner).
 */
export function fingerprint(game: Game): string {
  const parts = [
    game.version,
    game.level,
    game.theme,
    game.grid.width,
    game.grid.height,
    Array.from(game.grid.open).join(""),
    Array.from(game.ice).join(""),
    game.occupant.map((o) => (o ? JSON.stringify(o) : "")).join(";"),
    game.swirls.map((s) => `${s.cell}${s.axes}${s.steps}`).join(","),
    game.portals.map((p) => `${p.a}-${p.b}-${p.symbol}`).join(","),
    game.landmarks.map((l) => `${l.cell}:${l.label}`).join(","),
    // v2+ only, so v1 fingerprints (golden) are untouched.
    ...(game.stations ? [game.stations.map((s) => `${s.cell}${s.kind}${s.direction}`).join(",")] : []),
    ...(game.streak ? [`streak${game.streak.index}`] : []),
  ].join("|");
  const h1 = hashString(parts).toString(16).padStart(8, "0");
  const h2 = hashString(`salt:${parts}`).toString(16).padStart(8, "0");
  return h1 + h2;
}
