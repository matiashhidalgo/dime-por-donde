import { describe, expect, it } from "vitest";
import { generateGame } from "../generate";
import { createRng } from "../rng";
import { PROFILES, simulatePair } from "../simulate";

/**
 * Balance guard (GAME_SPEC_V2.md §3, anexo): a competent pair escapes most of
 * the time, a scatterbrained one mostly doesn't, and better play always wins
 * more. Full report: `npm run calibrate`.
 */
describe("balance with simulated pairs (200 Difícil v2 maps: stations and trials)", () => {
  const games = Array.from({ length: 200 }, (_, i) => generateGame({ seed: `bal${i}`, level: "hard" }));
  const winRate = (name: string) => {
    const p = PROFILES.find((x) => x.name === name)!;
    return games.filter((g, i) => simulatePair(g, p, createRng(`bal:${name}:${i}`)).won).length / games.length;
  };
  const rates = Object.fromEntries(PROFILES.map((p) => [p.name, winRate(p.name)]));

  it("competent pairs usually escape", () => expect(rates.competente).toBeGreaterThanOrEqual(0.7));
  it("losing is a real possibility even for them", () => expect(rates.competente).toBeLessThanOrEqual(0.9));
  it("a normal pair wins about half the time", () => {
    expect(rates.normal).toBeGreaterThanOrEqual(0.4);
    expect(rates.normal).toBeLessThanOrEqual(0.65);
  });
  it("a scatterbrained pair mostly loses", () => expect(rates.despistada).toBeLessThanOrEqual(0.4));
  it("better play wins more", () => {
    expect(rates.competente).toBeGreaterThan(rates.normal);
    expect(rates.normal).toBeGreaterThan(rates.despistada);
  });
  it("is deterministic", () => {
    const p = PROFILES[1];
    expect(simulatePair(games[3], p, createRng("x"))).toEqual(simulatePair(games[3], p, createRng("x")));
  });
});
