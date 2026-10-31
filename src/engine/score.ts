import { DIFFICULTIES } from "./difficulty";
import { bfsMulti } from "./grid";
import { solve } from "./solver";
import type { Game } from "./types";

/**
 * 1–3 star rating, shared by both views so the pair agrees on it.
 *
 *   start at 3 ★
 *   −1 if slower than 1.5 × par (skipped in "sin tiempo")
 *   −1 if falls ≥ the level's pit tolerance
 *   +1 back (max 3) for collecting every star
 *   never below 1 ★ — they made it, after all.
 *
 * Par is a talking-pace estimate, not a speedrun: walking a cell while
 * narrating, plus a pause at every junction on the best route, plus the walk
 * out to every star and back (so hunting stars never costs the time point).
 * Calibrated with `scripts/calibrate.ts` — see GAME_SPEC.md (calibración v1).
 */

export const PAR = { start: 45, perMove: 2, perDecision: 14 } as const;
export const SLOW_FACTOR = 1.5;
export const PIT_TOLERANCE = { easy: 2, medium: 3, hard: 4 } as const;

export interface RoundOutcome {
  timeMs: number | null;
  pits: number;
  stars: number;
}

const parCache = new WeakMap<Game, number>();

/** Cells walked out and back to fetch every star from the best route. */
export function starDetour(game: Game): number {
  const route = solve(game, game.start, game.exit).route;
  const fromRoute = bfsMulti(game.grid, route);
  return game.stars.reduce((sum, s) => sum + 2 * Math.max(0, fromRoute[s]), 0);
}

export function parSeconds(game: Game): number {
  let par = parCache.get(game);
  if (par === undefined) {
    const raw =
      PAR.start + PAR.perMove * (game.stats.solutionMoves + starDetour(game)) + PAR.perDecision * game.stats.routeDecisions;
    par = Math.round(raw / 5) * 5;
    parCache.set(game, par);
  }
  return par;
}

export interface RatingBreakdown {
  rating: number;
  /** null in "sin tiempo". */
  onTime: boolean | null;
  fewPits: boolean;
  allStars: boolean;
}

export function rateBreakdown(game: Game, outcome: RoundOutcome): RatingBreakdown {
  const onTime = outcome.timeMs === null ? null : outcome.timeMs / 1000 <= parSeconds(game) * SLOW_FACTOR;
  const fewPits = outcome.pits < PIT_TOLERANCE[game.level];
  const allStars = outcome.stars >= DIFFICULTIES[game.level].stars;
  let rating = 3;
  if (onTime === false) rating--;
  if (!fewPits) rating--;
  if (allStars) rating++;
  return { rating: Math.max(1, Math.min(3, rating)), onTime, fewPits, allStars };
}

export function rateRound(game: Game, outcome: RoundOutcome): number {
  return rateBreakdown(game, outcome).rating;
}
