import { describe, expect, it } from "vitest";
import { generateGame } from "../generate";
import { PAR, parSeconds, rateBreakdown, rateRound, starDetour } from "../score";

describe("rating", () => {
  const game = generateGame({ seed: "SCORE2", level: "medium" });
  const par = parSeconds(game) * 1000;

  it("perfect round → 3 stars", () => {
    expect(rateRound(game, { timeMs: par, pits: 0, stars: 3 })).toBe(3);
  });
  it("slow and clumsy → 1 star, never 0", () => {
    expect(rateRound(game, { timeMs: par * 3, pits: 9, stars: 0 })).toBe(1);
  });
  it("collecting every star wins one back", () => {
    expect(rateRound(game, { timeMs: par * 3, pits: 0, stars: 3 })).toBe(3);
    expect(rateRound(game, { timeMs: par * 3, pits: 0, stars: 2 })).toBe(2);
  });
  it("untimed rounds aren't judged on time", () => {
    expect(rateRound(game, { timeMs: null, pits: 0, stars: 0 })).toBe(3);
  });
  it("the breakdown says why", () => {
    expect(rateBreakdown(game, { timeMs: par * 2, pits: 0, stars: 1 })).toEqual({ rating: 2, onTime: false, fewPits: true, allStars: false });
    expect(rateBreakdown(game, { timeMs: null, pits: 0, stars: 1 }).onTime).toBeNull();
  });
});

describe("par time", () => {
  it("is a talking pace: start + walk (route and stars) + a pause per junction", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      for (let i = 0; i < 20; i++) {
        const g = generateGame({ seed: `PAR${i}`, level });
        const raw = PAR.start + PAR.perMove * (g.stats.solutionMoves + starDetour(g)) + PAR.perDecision * g.stats.routeDecisions;
        expect(parSeconds(g)).toBe(Math.round(raw / 5) * 5);
        expect(starDetour(g)).toBeGreaterThan(0); // stars always sit off the route
      }
    }
  });
});
