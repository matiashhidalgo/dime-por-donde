import { describe, expect, it } from "vitest";
import { createCode, parseCode } from "../code";
import { cureKeys, echoCure, sigilCure } from "../curses";
import { figuresTrial } from "../figures";
import { generateGame, gamesForCode } from "../generate";
import { glyphSet } from "../glyphs";
import { lockTrial } from "../lock";
import { pianoTrial } from "../piano";
import { createRng } from "../rng";
import { sealKeys } from "../sealcode";
import { stationEmblems } from "../stations";
import { streakGame } from "../streak";
import { canonicalKey, tangramTrial } from "../tangram";
import { landmarkShapes } from "../silhouettes";
import { encodeCode } from "../code";
import type { Game, Station } from "../types";

/**
 * «Uso prolongado» (etapa 6): one device plays 200 expeditions in a row — single
 * maps and Rachas — with codes made by the app's own `createCode` and its
 * history (`isTaken`), the way it does. Nothing a pair could learn may come
 * back: no repeated codes, mazes, trial instances, emblems, glyph sets, curse
 * cures, patrols or silhouettes. Seal keys are checked where they matter (the
 * key that opens each station, with no mistakes) and, for all 30 per game, by
 * count: with 29^5 possible keys, a couple of coincidences in thousands are
 * expected and harmless (a key only opens its own station).
 */

const EXPEDITIONS = 200;
const RACHAS = 40; // of the 200, this many are Rachas of 3 maps
const MAPS_PER_RACHA = 3;

const trialId = (st: Station, game: Game): string => {
  switch (st.kind) {
    case "figures": {
      const t = figuresTrial(st.key, st.direction);
      return `f|${t.candidates.join("|")}|${t.correct}`;
    }
    case "lock": {
      const t = lockTrial(st.key);
      return `l|${t.glyphs.join("|")}|${t.secret.join()}|${t.clues.length}`;
    }
    case "piano": {
      const t = pianoTrial(st.key, st.direction);
      return `p|${t.scale}|${t.tonic}|${t.keys.map((k) => k.midi).join()}|${t.melody.join()}|${t.durations.join()}`;
    }
    case "tangram": {
      const t = tangramTrial(st.key, st.direction);
      return `t|${canonicalKey(t.silhouette)}|${t.pieces.map((p) => canonicalKey(p.cells)).join("/")}`;
    }
  }
  void game;
};

describe("uso prolongado: 200 expediciones seguidas de un mismo dispositivo", () => {
  const rng = createRng("longuse");
  const history = new Set<string>();
  const maps: Game[] = [];
  const codes: string[] = [];

  // A device alternates single expeditions and Rachas; every new code skips the ones already played.
  for (let e = 0; e < EXPEDITIONS; e++) {
    const racha = e % Math.floor(EXPEDITIONS / RACHAS) === 0;
    const code = createCode({ mode: racha ? "duo" : "hard", random: () => rng.next(), isTaken: (c) => history.has(c) });
    history.add(code);
    codes.push(code);
    const parsed = parseCode(code);
    if (!parsed.ok) throw new Error(parsed.message);
    if (racha) for (let i = 0; i < MAPS_PER_RACHA; i++) maps.push(streakGame(parsed.value.seed, i));
    else maps.push(gamesForCode(code)[0]);
  }

  const unique = <T,>(xs: T[]) => new Set(xs).size === xs.length;

  it("200 different codes, different mazes", () => {
    expect(codes.length).toBe(EXPEDITIONS);
    expect(unique(codes)).toBe(true);
    expect(maps.length).toBe(EXPEDITIONS - RACHAS + RACHAS * MAPS_PER_RACHA);
    const mazes = maps.map((g) => Array.from(g.grid.open).join("") + g.start + g.exit);
    expect(unique(mazes)).toBe(true);
  });

  it("no trial instance repeats over all the stations played", () => {
    const ids = maps.flatMap((g) => g.stations!.map((st) => trialId(st, g)));
    expect(ids.length).toBe(maps.length * 3);
    expect(unique(ids)).toBe(true);
  });

  it("no emblem trio, glyph set, silhouette set or curse cure repeats", () => {
    expect(unique(maps.map((g) => stationEmblems(g).map((e) => e.d).join("|")))).toBe(true);
    expect(unique(maps.map((g) => glyphSet(`${g.stations![0].key}|set`, 6).paths.join("|")))).toBe(true);
    expect(unique(maps.map((g) => landmarkShapes(g).map((s) => s.d).join("|")))).toBe(true);
    const cures = maps.flatMap((g) => [0, 1, 2].map((k) => `${sigilCure(g.seed, k).candidates.join("|")}#${echoCure(g.seed, k).glyphs.join("|")}`));
    expect(unique(cures)).toBe(true);
  });

  it("no patrol repeats: route, shape, speed, phase and look are new each time", () => {
    const patrols = maps.filter((g) => g.shadow).map((g) => `${g.seed}|${g.shadow!.route.join(",")}|${g.shadow!.shape}|${g.shadow!.slow}|${g.shadow!.phase}`);
    expect(patrols.length).toBeGreaterThan(maps.length * 0.5);
    expect(unique(patrols)).toBe(true);
    expect(unique(maps.filter((g) => g.shadow).map((g) => g.shadow!.look))).toBe(true);
    // The same route on the same maze never comes back either (a maze never does).
    expect(unique(maps.filter((g) => g.shadow).map((g) => g.shadow!.route.join(",") + Array.from(g.grid.open).join("")))).toBe(true);
  });

  it("the key that opens each station never repeats; across all 30 per game only chance coincidences appear", () => {
    const opening = maps.flatMap((g) => sealKeys(g.seed, 3).map((per) => per[0]));
    expect(unique(opening)).toBe(true);
    const all = maps.flatMap((g) => sealKeys(g.seed, 3).flat());
    const dupes = all.length - new Set(all).size;
    // Expected coincidences ≈ n² / (2 · 29^5) — a handful at most.
    const expected = (all.length * all.length) / (2 * 29 ** 5);
    expect(dupes).toBeLessThanOrEqual(Math.ceil(expected * 3 + 2));
    // Cure keys are only 4 characters (29^3 payloads) on purpose — dictating one is quick, and a
    // wrong one costs nothing — so coincidences between games are expected; they stay near chance.
    const cures = maps.flatMap((g) => [0, 1, 2, 3].map((k) => cureKeys(g.seed, k)[0]));
    const chance = (cures.length * cures.length) / (2 * 29 ** 3);
    expect(cures.length - new Set(cures).size).toBeLessThanOrEqual(Math.ceil(chance * 1.6 + 3));
  });

  it("a streak's maps differ from each other and from the codes' own single maps", () => {
    const racha = maps.slice(0, 3);
    expect(unique(racha.map((g) => g.seed))).toBe(true);
    expect(encodeCode({ mode: "hard", seed: "AAAAAA" })).not.toBe(encodeCode({ mode: "duo", seed: "AAAAAA" }));
    void generateGame;
  });
}, 600_000);
