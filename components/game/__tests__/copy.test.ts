import { describe, expect, it } from "vitest";
import { KEY_COLORS, PORTAL_SYMBOLS, type PlayEvent, THEMES, TUNING, createPlay, generateGame } from "@/src/engine";
import { resultPhrase, startTip } from "@/lib/phrases";
import { describeCell } from "../guide/describe";
import { createMessenger } from "../explorer/messages";

const game = generateGame({ seed: "COPY22", level: "hard", version: 1 });
const state = { ...createPlay(game), hearts: 2, pits: 1 };

/** Every event the explorer can get a line for, with plausible payloads. */
const EVENTS: PlayEvent[] = [
  { type: "locked", color: 1, cell: 0 },
  { type: "key", color: 1 },
  { type: "teleported", pair: 0, from: 0, to: 1 },
  { type: "fell", pit: 0, landing: 1, keysLost: 1 },
  { type: "fell", pit: 0, landing: 1, keysLost: 0 },
  { type: "hurt", cause: "dark", hearts: 2 },
  { type: "dimmed", radius: 2 },
  { type: "dimmed", radius: 1 },
  { type: "darkness" },
  { type: "candle", index: 0 },
  { type: "lantern", index: 0 },
  { type: "swirl", axes: "x", steps: 6 },
  { type: "swirl", axes: "xy", steps: 6 },
  { type: "unswirl" },
  { type: "star", index: 0, count: 1 },
  { type: "star", index: 0, count: 3 },
  { type: "arrived" },
  { type: "defeat", cause: "pit" },
  { type: "hurt", cause: "trial", hearts: 1 },
  { type: "station", index: 0, sealed: true },
  { type: "exitSealed", missing: 2, emergency: false },
  { type: "exitSealed", missing: 1, emergency: false },
  { type: "trialFail", index: 0, paid: false },
  { type: "trialFail", index: 0, paid: true },
  { type: "seal", index: 0, count: 1 },
  { type: "heal", hearts: 2 },
  { type: "seal", index: 1, count: 3 },
];

/**
 * v2 rule (GAME_SPEC_V2.md §2): nothing on screen names an object. The pair
 * invents the words. Generic mechanic words (llave, puerta, pozo, farol…) are
 * fine; v1's names — landmark kinds and variants, key/portal colors and
 * shapes, themed pit and ice names — are not.
 */
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FORBIDDEN = [
  ...Object.values(THEMES).flatMap((t) => [
    ...t.landmarks.flatMap((l) => [l.name, ...l.variants]),
    ...Object.values(t.labels).filter((w) => w !== "pozo"),
  ]),
  ...KEY_COLORS.flatMap((c) => [c.colorName, c.shapeName]),
  ...PORTAL_SYMBOLS.flatMap((p) => [p.colorName, p.shapeName]),
];
const NAMES = new RegExp(`(^|[^\\p{L}])(${[...new Set(FORBIDDEN)].map(esc).join("|")})(?![\\p{L}])`, "iu");

describe("game copy", () => {
  it("event lines rotate and never repeat back to back", () => {
    const say = createMessenger(game);
    let prev = "";
    for (let i = 0; i < 60; i++) {
      const line = say({ type: "lantern", index: 0 }, state)!;
      expect(line).not.toBe(prev);
      prev = line;
    }
  });

  it("no event line names an object", () => {
    const say = createMessenger(game);
    for (let i = 0; i < 8; i++) {
      for (const e of EVENTS) {
        const line = say(e, state);
        if (line) expect(line, `${e.type}: ${line}`).not.toMatch(NAMES);
      }
    }
  });

  it("the forbidden-name check actually catches v1 names", () => {
    expect("llave azul").toMatch(NAMES);
    expect("junto al hongo gigante").toMatch(NAMES);
    expect("el portal con el rombo").toMatch(NAMES);
    expect("la cosa con tres picos").not.toMatch(NAMES);
  });

  it("the guide's tap descriptions name mechanics, not objects", () => {
    for (let seed = 0; seed < 12; seed++) {
      const g = generateGame({ seed: `names${seed}`, level: "hard", version: seed % 2 ? 1 : 2 });
      for (let cell = 0; cell < g.occupant.length; cell++) {
        const text = describeCell(g, cell);
        expect(text, text).not.toMatch(NAMES);
      }
    }
  });

  it("tips and end lines name nothing either", () => {
    for (let i = 0; i < 40; i++) {
      for (const role of ["guide", "explorer"] as const) expect(startTip(`T${i}`, role)).not.toMatch(NAMES);
      for (const escaped of [true, false]) {
        const line = resultPhrase({ seed: `R${i}`, escaped, hearts: escaped ? 1 + (i % 3) : 0, maxHearts: 3, pits: i % 5, stars: i % 4, maxStars: 3 });
        expect(line).not.toMatch(NAMES);
      }
    }
  });

  it("both devices pick the same end line and tip for a game", () => {
    const o = { seed: "X", escaped: true, hearts: 2, maxHearts: TUNING.hearts, pits: 1, stars: 2, maxStars: 3 };
    expect(resultPhrase(o)).toBe(resultPhrase({ ...o }));
    expect(startTip("X", "guide")).toBe(startTip("X", "guide"));
    expect(startTip("X", "guide")).not.toMatch(/^Explorador:/);
    expect(startTip("X", "explorer")).not.toMatch(/^Guía:/);
  });

  it("end lines react to what happened", () => {
    const base = { seed: "S", maxHearts: 3, maxStars: 3 };
    expect(resultPhrase({ ...base, escaped: false, hearts: 0, pits: 5, stars: 0 })).toMatch(/5|pozo|abajo|subterráneo/i);
    const perfect = resultPhrase({ ...base, escaped: true, hearts: 3, pits: 0, stars: 3 });
    const lost = resultPhrase({ ...base, escaped: false, hearts: 0, pits: 0, stars: 0 });
    expect(perfect).not.toBe(lost);
  });
});
