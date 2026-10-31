import { describe, expect, it } from "vitest";
import { generateGame } from "@/src/engine";
import { duoPhrase, resultPhrase, startTip } from "@/lib/phrases";
import { createMessenger } from "../explorer/messages";

const game = generateGame({ seed: "COPY22", level: "medium" });
const state = { checkpointIndex: 0, pits: 1 } as never;

describe("game copy", () => {
  it("event lines rotate and never repeat back to back", () => {
    const say = createMessenger(game);
    let prev = "";
    for (let i = 0; i < 60; i++) {
      const line = say({ type: "checkpoint", index: 0 }, state)!;
      expect(line).not.toBe(prev);
      prev = line;
    }
  });

  it("event lines keep the legend's names", () => {
    const say = createMessenger(game);
    for (let i = 0; i < 10; i++) {
      expect(say({ type: "key", color: 1 }, state)).toMatch(/llave azul/i);
      expect(say({ type: "locked", color: 0, cell: 0 }, state)).toMatch(/puerta roja/i);
    }
  });

  it("both devices pick the same end-of-round line and tip for a game", () => {
    const o = { seed: "X-0", pits: 1, stars: 2, maxStars: 3, rating: 2, timed: true, pace: 1 };
    expect(resultPhrase(o)).toBe(resultPhrase({ ...o }));
    expect(startTip("X-0", "guide")).toBe(startTip("X-0", "guide"));
    expect(startTip("X-0", "guide")).not.toMatch(/^Explorador:/);
    expect(startTip("X-0", "explorer")).not.toMatch(/^Guía:/);
  });

  it("result lines react to what happened", () => {
    const base = { seed: "S", stars: 1, maxStars: 3, rating: 2, timed: true, pace: 1 };
    expect(resultPhrase({ ...base, pits: 5 })).toMatch(/5/);
    expect(resultPhrase({ ...base, pits: 0, stars: 3, rating: 3 })).toBeTruthy();
    expect(duoPhrase({ seed: "S", ratingSum: 9, pits: 0 })).toBeTruthy();
  });
});
