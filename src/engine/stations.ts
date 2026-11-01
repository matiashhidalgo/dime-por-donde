import { DIRS, bfs, isOpen, neighbor } from "./grid";
import { landingZone } from "./play";
import { canReach, forwardFrom, stateGraph } from "./reach";
import { createRng } from "./rng";
import { type Family, FAMILIES, type Silhouette, silhouettes } from "./silhouettes";
import type { Game, Station, TrialKind } from "./types";

/**
 * Generator v2 (GAME_SPEC_V2.md §1, anexo etapa 2): the frozen v1 map plus 3
 * stations, each guarding a seal behind a trial. Stations draw from their own
 * RNG stream (`seed|v2|stations|attempt`), so v1 output never changes.
 *
 * Audit, per attempt (deterministic retries with relaxed spacing):
 *  - from EVERY reachable (cell, keys) state — falls' landing spots included —
 *    the 3 stations and the exit must stay reachable (no soft-lock);
 *  - the landing zone (now "can still reach every station and the exit
 *    without keys") keeps enough room.
 */

export const STATION_COUNT = 3;
/** Stations sit at most this many steps off the solver's route (first tier). */
const NEAR = 3;
/** `near`: max walking steps off the solver's route (a detour, not a second expedition). */
const SPACING = [
  { ends: 7, gap: 9, near: NEAR },
  { ends: 7, gap: 9, near: NEAR * 2 },
  { ends: 6, gap: 7, near: Infinity },
  { ends: 5, gap: 5, near: Infinity },
  { ends: 3, gap: 3, near: Infinity },
] as const;
const ATTEMPTS_PER_SPACING = 12;
const MIN_LANDING = 8;

export function stationsOf(game: Game): Station[] {
  return game.stations ?? [];
}

/**
 * Adds the stations to a v1-built game, or null when the map can't host them
 * safely (e.g. the exit sits in a one-way pocket: fine in v1, where reaching
 * it ends the game, a soft-lock once the exit needs seals).
 */
export function withStations(base: Game): Game | null {
  const fromStart = bfs(base.grid, base.start);
  const fromExit = bfs(base.grid, base.exit);
  const offRoute = multiBfs(base, base.solution.route);
  const landmarkCells = new Set(base.landmarks.map((l) => l.cell));
  const candidates: number[] = [];
  for (let c = 0; c < base.occupant.length; c++) {
    if (base.occupant[c] || base.ice[c] || landmarkCells.has(c)) continue;
    if (fromStart[c] < 0 || fromExit[c] < 0) continue;
    let besidePit = false;
    for (const d of DIRS) if (isOpen(base.grid, c, d) && base.occupant[neighbor(base.grid, c, d)]?.type === "pit") besidePit = true;
    if (!besidePit) candidates.push(c);
  }

  const dists = new Map<number, Int32Array | number[]>();
  const distFrom = (c: number) => {
    if (!dists.has(c)) dists.set(c, bfs(base.grid, c));
    return dists.get(c)!;
  };
  let attempt = 0;
  for (const spacing of SPACING) {
    for (let k = 0; k < ATTEMPTS_PER_SPACING; k++, attempt++) {
      const rng = createRng(`${base.seed}|v2|stations|${attempt}`);
      const cells: number[] = [];
      for (const c of rng.shuffle(candidates)) {
        if (fromStart[c] < spacing.ends || fromExit[c] < spacing.ends || offRoute[c] > spacing.near) continue;
        if (cells.some((o) => distFrom(o)[c] < spacing.gap)) continue;
        cells.push(c);
        if (cells.length === STATION_COUNT) break;
      }
      if (cells.length < STATION_COUNT) continue;
      const game: Game = { ...base, stations: describeStations(base.seed, cells) };
      if (auditStations(game).ok) return game;
    }
  }
  return null;
}

/** Walking distance from the nearest of `from` (-1 = unreachable → Infinity). */
function multiBfs(game: Game, from: readonly number[]): number[] {
  const dist: number[] = new Array(game.occupant.length).fill(Infinity);
  const queue = [...new Set(from)];
  for (const c of queue) dist[c] = 0;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    for (const d of DIRS) {
      if (!isOpen(game.grid, c, d)) continue;
      const n = neighbor(game.grid, c, d);
      if (dist[n] !== Infinity) continue;
      dist[n] = dist[c] + 1;
      queue.push(n);
    }
  }
  return dist;
}

export const TRIAL_KINDS: readonly TrialKind[] = ["figures", "lock", "piano", "tangram"];

/**
 * Kinds and directions (anexo etapa 4): 3 different kinds out of 4, uniform.
 * The stations that aren't the lock take their directions from a shuffled
 * [A, B, either], so both players usually get to act.
 */
function describeStations(seed: string, cells: number[]): Station[] {
  const rng = createRng(`${seed}|v2|station-kinds`);
  const kinds = rng.shuffle(TRIAL_KINDS).slice(0, cells.length);
  const dirs = rng.shuffle(["A", "B", rng.pick(["A", "B"] as const)] as const);
  let nextDir = 0;
  return cells.map((cell, index) => ({
    index,
    cell,
    kind: kinds[index],
    direction: kinds[index] === "lock" ? "A" : dirs[nextDir++ % 3],
    key: `${seed}|v2|station|${index}`,
  }));
}

export interface StationAudit {
  ok: boolean;
  reason?: string;
  /** Reachable states checked. */
  states: number;
  landing: number;
}

export function auditStations(game: Game): StationAudit {
  const g = stateGraph(game);
  const stations = stationsOf(game);
  const zone = landingZone(game);
  if (zone.length < MIN_LANDING) return { ok: false, reason: "landing-zone", states: 0, landing: zone.length };
  const startMask = g.keyAt[game.start];
  const roots = [game.start * g.masks + startMask];
  if (game.pits.length > 0) for (const z of zone) roots.push(z * g.masks);
  const reached = forwardFrom(g, roots);
  const targets = [game.exit, ...stations.map((s) => s.cell)].map((t) => canReach(g, t));
  let states = 0;
  for (let s = 0; s < reached.length; s++) {
    if (!reached[s]) continue;
    states++;
    if (!targets.every((ok) => ok[s])) return { ok: false, reason: "softlock", states, landing: zone.length };
  }
  return { ok: true, states, landing: zone.length };
}

// ── Emblems ──────────────────────────────────────────────────────────────────

const emblemCache = new WeakMap<Game, Silhouette[]>();

/**
 * One silhouette per station, from three different families, seeded per game.
 * The same path is drawn on the guide's map, in the explorer's world and in
 * the seals HUD, so «la del emblema con tres picos» means the same station.
 */
export function stationEmblems(game: Game): Silhouette[] {
  const hit = emblemCache.get(game);
  if (hit) return hit;
  const rng = createRng(`${game.seed}|v2|emblem-families`);
  const families = rng.shuffle(FAMILIES).slice(0, STATION_COUNT) as Family[];
  const out = families.map((f, i) => silhouettes(`${game.seed}|v2|emblem|${i}`, 1, [f])[0]);
  emblemCache.set(game, out);
  return out;
}
