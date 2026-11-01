import { describe, expect, it } from "vitest";
import { encodeCode } from "../code";
import { fingerprint, gamesForCode, generateGame } from "../generate";
import { auditGame } from "../audit";

/**
 * Golden fingerprints: generator v1 is frozen. If this test fails, a change
 * altered existing mazes — old codes would stop matching between devices.
 * Ship that change as generator v2 instead of updating these values.
 */
describe("generator v1 is frozen", () => {
  const golden = ["easy", "medium", "hard"].flatMap((mode) =>
    ["AB23CD", "ZZZZZZ", "K7XQ2M"].map((seed) => encodeCode({ mode: mode as "easy", seed, version: 1 })),
  );
  it("golden codes keep their exact maze", () => {
    expect(Object.fromEntries(golden.map((c) => [c, fingerprint(gamesForCode(c)[0])]))).toMatchInlineSnapshot(`
      {
        "2AB23CDD": "084192d8d081f6bc",
        "2K7XQ2M4": "18064edb6e3a0faf",
        "2ZZZZZZ4": "6160e29504c0d431",
        "3AB23CDE": "cbc4d5978997777b",
        "3K7XQ2M5": "4cbc0fb1ca320f5d",
        "3ZZZZZZ5": "2d5f5f3370fd5827",
        "4AB23CDF": "af34d6c248e45abe",
        "4K7XQ2M6": "63dcac3798fcd1fb",
        "4ZZZZZZ6": "04e0ef7ebf3a75fa",
      }
    `);
  });
});

describe("gamesForCode", () => {
  it("accepts messy input and returns one game for single modes", () => {
    const code = encodeCode({ mode: "medium", seed: "H4PPY2" });
    const games = gamesForCode(` ${code.toLowerCase().slice(0, 4)}-${code.slice(4)} `);
    expect(games).toHaveLength(1);
    expect(games[0].level).toBe("medium");
  });

  it("v1 duo mode → three rounds, rising difficulty, three different themes (in v2 that header is a Racha)", () => {
    for (const seed of ["DUDU22", "XYZ234", "MMMMMM"]) {
      const rounds = gamesForCode(encodeCode({ mode: "duo", seed, version: 1 }));
      expect(rounds.map((g) => g.level)).toEqual(["easy", "medium", "hard"]);
      expect(new Set(rounds.map((g) => g.theme)).size).toBe(3);
      for (const g of rounds) expect(auditGame(g).problems).toEqual([]);
    }
  });

  it("theme never changes between retries of the same seed", () => {
    const a = generateGame({ seed: "TEMA22", level: "hard" });
    const b = generateGame({ seed: "TEMA22", level: "hard" });
    expect(a.theme).toBe(b.theme);
  });

  it("rejects invalid codes with the parser's message", () => {
    expect(() => gamesForCode("ABCD")).toThrow(/8 caracteres/);
  });
});
