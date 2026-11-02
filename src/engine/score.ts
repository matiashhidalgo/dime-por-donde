import { DIFFICULTIES } from "./difficulty";
import type { Game } from "./types";

/**
 * Expedition rating (GAME_SPEC_V2.md §3): time no longer counts.
 *
 *   escaped → one point per heart kept (1–3), +1 for every star on the map,
 *             capped at 3
 *   lost    → 0
 *
 * Shared by both views so the pair agrees on it; the guide enters hearts and
 * stars as the explorer reads them out.
 */

export interface ExpeditionOutcome {
  escaped: boolean;
  hearts: number;
  stars: number;
}

export interface RatingBreakdown {
  rating: number;
  escaped: boolean;
  hearts: number;
  allStars: boolean;
}

export function rateBreakdown(game: Game, o: ExpeditionOutcome): RatingBreakdown {
  const allStars = o.stars >= DIFFICULTIES[game.level].stars;
  const hearts = Math.max(0, o.hearts);
  const rating = o.escaped ? Math.min(3, Math.max(1, hearts) + (allStars ? 1 : 0)) : 0;
  return { rating, escaped: o.escaped, hearts, allStars };
}

export const rateExpedition = (game: Game, o: ExpeditionOutcome) => rateBreakdown(game, o).rating;
