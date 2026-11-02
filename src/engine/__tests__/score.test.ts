import { describe, expect, it } from "vitest";
import { generateGame } from "../generate";
import { rateBreakdown, rateExpedition } from "../score";

describe("expedition rating", () => {
  const game = generateGame({ seed: "SCORE2", level: "hard" });

  it("one point per heart kept", () => {
    expect(rateExpedition(game, { escaped: true, hearts: 3, stars: 0 })).toBe(3);
    expect(rateExpedition(game, { escaped: true, hearts: 2, stars: 0 })).toBe(2);
    expect(rateExpedition(game, { escaped: true, hearts: 1, stars: 2 })).toBe(1);
  });
  it("every star on the map adds one, up to 3", () => {
    expect(rateExpedition(game, { escaped: true, hearts: 1, stars: 3 })).toBe(2);
    expect(rateExpedition(game, { escaped: true, hearts: 3, stars: 3 })).toBe(3);
  });
  it("losing is 0, whatever was collected", () => {
    expect(rateExpedition(game, { escaped: false, hearts: 0, stars: 3 })).toBe(0);
    expect(rateExpedition(game, { escaped: false, hearts: 2, stars: 3 })).toBe(0);
  });
  it("escaping with a miscounted 0 hearts still counts as 1", () => {
    expect(rateExpedition(game, { escaped: true, hearts: 0, stars: 0 })).toBe(1);
  });
  it("the breakdown says why", () => {
    expect(rateBreakdown(game, { escaped: true, hearts: 2, stars: 3 })).toEqual({ rating: 3, escaped: true, hearts: 2, allStars: true });
  });
  it("time is not an input at all", () => {
    expect(Object.keys(rateBreakdown(game, { escaped: true, hearts: 3, stars: 0 }))).not.toContain("onTime");
  });
});
