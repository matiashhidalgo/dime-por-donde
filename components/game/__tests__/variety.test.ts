import { describe, expect, it } from "vitest";
import { type PlayEvent, createPlay, createRng, generateGame } from "@/src/engine";
import { ENDING_OPENERS, EMERGENCY_OPENERS, emergencyPhrase, mapPhrase, relayPhrase, resultPhrase, startTip, streakEndPhrase } from "@/lib/phrases";
import { MESSAGE_POOLS, createMessenger } from "../explorer/messages";
import { NAMES } from "./names";

/**
 * Variety of the microtexts (etapa 6): at least 8 variants per common event,
 * at least 12 per kind of ending, and over 50 simulated games nothing wears
 * out — no line twice in a row, no line hogging the screen, no object names.
 */

const game = generateGame({ seed: "VAR222", level: "hard", version: 1 });
const state = { ...createPlay(game), hearts: 2 };

/** One representative event per common kind. */
const COMMON: { name: string; event: PlayEvent }[] = [
  { name: "locked", event: { type: "locked", color: 1, cell: 0 } },
  { name: "key", event: { type: "key", color: 1 } },
  { name: "teleported", event: { type: "teleported", pair: 0, from: 0, to: 1 } },
  { name: "fell", event: { type: "fell", pit: 0, landing: 1, keysLost: 1 } },
  { name: "hurt-dark", event: { type: "hurt", cause: "dark", hearts: 2 } },
  { name: "hurt-trial", event: { type: "hurt", cause: "trial", hearts: 2 } },
  { name: "dim2", event: { type: "dimmed", radius: 2 } },
  { name: "dim1", event: { type: "dimmed", radius: 1 } },
  { name: "darkness", event: { type: "darkness" } },
  { name: "candle", event: { type: "candle", index: 0 } },
  { name: "lantern", event: { type: "lantern", index: 0 } },
  { name: "swirl-x", event: { type: "swirl", axes: "x", steps: 6 } },
  { name: "swirl-xy", event: { type: "swirl", axes: "xy", steps: 6 } },
  { name: "unswirl", event: { type: "unswirl" } },
  { name: "curse-turn", event: { type: "curse", k: 0, kind: "turn", steps: 18 } },
  { name: "curse-blind", event: { type: "curse", k: 0, kind: "blind", steps: 18 } },
  { name: "curse-hungry", event: { type: "curse", k: 0, kind: "hungry", steps: 18 } },
  { name: "curse-masked", event: { type: "curse", k: 0, kind: "masked", steps: 18 } },
  { name: "curse-mirror", event: { type: "curse", k: 0, kind: "mirror", steps: 18 } },
  { name: "cured", event: { type: "uncurse", k: 0, cured: true } },
  { name: "curse-off", event: { type: "uncurse", k: 0, cured: false } },
  { name: "emergency", event: { type: "emergencyExit", seals: 2 } },
  { name: "star", event: { type: "star", index: 0, count: 1 } },
  { name: "star-all", event: { type: "star", index: 0, count: 3 } },
  { name: "station-done", event: { type: "station", index: 0, sealed: true } },
  { name: "exit-sealed", event: { type: "exitSealed", missing: 2, emergency: false } },
  { name: "fail-paid", event: { type: "trialFail", index: 0, paid: true } },
  { name: "fail-free", event: { type: "trialFail", index: 0, paid: false } },
  { name: "seal", event: { type: "seal", index: 0, count: 1 } },
  { name: "seal-3", event: { type: "seal", index: 0, count: 3 } },
  { name: "arrived", event: { type: "arrived" } },
  { name: "defeat", event: { type: "defeat", cause: "dark" } },
  { name: "shadow-touch", event: { type: "shadowTouch", hearts: 2 } },
  { name: "shadow-stun", event: { type: "shadowStunned", count: 1 } },
];

describe("variety: explorer lines", () => {
  it("every common event has at least 8 distinct lines", () => {
    const say = createMessenger(game);
    for (const { name, event } of COMMON) {
      const seen = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const line = say(event, state);
        if (line) seen.add(line);
      }
      expect(seen.size, `${name}: ${seen.size} lines`).toBeGreaterThanOrEqual(8);
    }
  });

  it("the plain pools hold at least 8 unique lines and name nothing", () => {
    for (const [name, pool] of Object.entries(MESSAGE_POOLS)) {
      expect(new Set(pool).size, name).toBe(pool.length);
      expect(pool.length, name).toBeGreaterThanOrEqual(8);
      for (const line of pool) expect(line, `${name}: ${line}`).not.toMatch(NAMES);
    }
  });

  it("over 50 simulated games no event repeats back to back and no line hogs the screen", () => {
    const rng = createRng("variety");
    const counts = new Map<string, Map<string, number>>();
    const last = new Map<string, string>();
    for (let g = 0; g < 50; g++) {
      const say = createMessenger(game);
      for (let i = 0; i < 12; i++) {
        const { name, event } = COMMON[rng.int(COMMON.length)];
        const line = say(event, state);
        if (!line) continue;
        expect(line, `${name} repeated back to back`).not.toBe(last.get(name));
        last.set(name, line);
        const m = counts.get(name) ?? new Map();
        m.set(line, (m.get(line) ?? 0) + 1);
        counts.set(name, m);
      }
    }
    for (const [name, m] of counts) {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      if (total < 24) continue;
      // With ≥ 8 lines rotating in bags, no line takes more than ~2.5× its fair share.
      const fair = total / Math.max(8, m.size);
      for (const [line, n] of m) expect(n, `${name}: "${line}" ×${n} of ${total}`).toBeLessThanOrEqual(Math.ceil(fair * 2.5) + 1);
    }
  });
});

describe("variety: ending lines", () => {
  const seeds = Array.from({ length: 3000 }, (_, i) => `V${i}`);
  const names = (lines: string[]) => lines.forEach((l) => expect(l, l).not.toMatch(NAMES));

  it("each kind of ending has at least 12 distinct lines (victoria, salida de emergencia, atrapados, fin de racha)", () => {
    const won = new Set<string>();
    const lost = new Set<string>();
    const emergency = new Set<string>();
    const streakEnd = new Set<string>();
    for (const seed of seeds) {
      for (const [hearts, stars, pits] of [[3, 3, 0], [1, 1, 0], [3, 1, 0], [2, 3, 0], [2, 0, 1], [2, 1, 1]] as const) {
        won.add(resultPhrase({ seed, escaped: true, hearts, maxHearts: 3, pits, stars, maxStars: 3 }));
      }
      for (const [stars, pits] of [[0, 0], [3, 0], [1, 4]] as const) lost.add(resultPhrase({ seed, escaped: false, hearts: 0, maxHearts: 3, pits, stars, maxStars: 3 }));
      emergency.add(emergencyPhrase(seed, 1));
      emergency.add(emergencyPhrase(seed, 2));
      for (const maps of [0, 1, 3, 8]) streakEnd.add(streakEndPhrase(seed, maps));
    }
    for (const [kind, set] of [["victoria", won], ["atrapados", lost], ["emergencia", emergency], ["fin de racha", streakEnd]] as const) {
      expect(set.size, kind).toBeGreaterThanOrEqual(12);
      names([...set]);
    }
    // And each situation on its own reaches 12 as well (4 openers × 6 tails = 24).
    for (const [situation, openers] of Object.entries({ ...ENDING_OPENERS, ...EMERGENCY_OPENERS })) expect(openers.length * 6, situation).toBeGreaterThanOrEqual(12);
  });

  it("relay and per-map lines vary too", () => {
    const relay = new Set(seeds.map((s) => relayPhrase(s, 1, "won")));
    const escaped = new Set(seeds.map((s) => relayPhrase(s, 1, "escaped")));
    const mapWon = new Set(seeds.map((s) => mapPhrase(s, 2, true)));
    const mapLost = new Set(seeds.map((s) => mapPhrase(s, 2, false)));
    for (const set of [relay, escaped, mapWon, mapLost]) {
      expect(set.size).toBeGreaterThanOrEqual(12);
      names([...set]);
    }
  });

  it("50 simulated games: the same device rarely reads the same ending twice", () => {
    const rng = createRng("endings");
    const lines: string[] = [];
    for (let g = 0; g < 50; g++) {
      const seed = `G${rng.int(1e9)}`;
      const won = rng.chance(0.5);
      lines.push(
        won
          ? resultPhrase({ seed, escaped: true, hearts: 1 + rng.int(3), maxHearts: 3, pits: rng.int(3), stars: rng.int(4), maxStars: 3 })
          : resultPhrase({ seed, escaped: false, hearts: 0, maxHearts: 3, pits: rng.int(5), stars: rng.int(4), maxStars: 3 }),
      );
    }
    expect(new Set(lines).size).toBeGreaterThanOrEqual(42);
    const worst = Math.max(...[...new Set(lines)].map((l) => lines.filter((x) => x === l).length));
    expect(worst).toBeLessThanOrEqual(3);
  });

  it("tips: at least 8 per role, no object names", () => {
    for (const role of ["guide", "explorer"] as const) {
      const tips = new Set(seeds.map((s) => startTip(s, role)));
      expect(tips.size).toBeGreaterThanOrEqual(8);
      names([...tips]);
    }
  });
});
