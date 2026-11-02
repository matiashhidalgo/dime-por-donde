import { describe, expect, it } from "vitest";
import { auditGame } from "../audit";
import { CODE_ALPHABET, encodeCode, parseCode } from "../code";
import { fingerprint, gamesForCode } from "../generate";
import { createPlay, playRules } from "../play";
import { auditStations } from "../stations";
import {
  MAX_STREAK_MAPS,
  type RelayState,
  decodeRelay,
  encodeRelay,
  isStreakCode,
  pitDeltaFor,
  streakGame,
  streakRole,
  streakTheme,
} from "../streak";
import { TUNING } from "../tuning";
import { createRng } from "../rng";

/** Racha (GAME_SPEC_V2.md §6, anexo etapa 3). */

const code = encodeCode({ mode: "duo", seed: "S22RXB" });
const seed = "S22RXB";

describe("streak codes", () => {
  it("in v2 the duo header means Racha; v1 duo codes stay duo", () => {
    const v2 = parseCode(code);
    expect(v2.ok && isStreakCode(v2.value)).toBe(true);
    const v1 = parseCode(encodeCode({ mode: "duo", seed, version: 1 }));
    expect(v1.ok && isStreakCode(v1.value)).toBe(false);
    const single = parseCode(encodeCode({ mode: "hard", seed }));
    expect(single.ok && isStreakCode(single.value)).toBe(false);
  });

  it("gamesForCode refuses a streak code (its maps come from streakGame)", () => {
    expect(() => gamesForCode(code)).toThrow();
  });

  it("roles swap on every map, always", () => {
    const roles = Array.from({ length: 6 }, (_, i) => streakRole("guide", "explorer", i));
    expect(roles).toEqual(["guide", "explorer", "guide", "explorer", "guide", "explorer"]);
  });
});

describe("streak maps", () => {
  const maps = Array.from({ length: 8 }, (_, i) => streakGame(seed, i));

  it("are deterministic: both devices build the same map i", () => {
    for (let i = 0; i < 4; i++) {
      // Fresh build (cache bypass): another seed fills the small cache in between.
      for (let j = 0; j < 9; j++) streakGame("FILL22", j);
      expect(fingerprint(streakGame(seed, i))).toBe(fingerprint(maps[i]));
    }
  });

  it("never repeat the theme of the map before", () => {
    for (let s = 0; s < 40; s++) {
      for (let i = 1; i < 12; i++) expect(streakTheme(`T${s}`, i)).not.toBe(streakTheme(`T${s}`, i - 1));
    }
  });

  it("carry their index, 3 stations, and differ from each other", () => {
    expect(new Set(maps.map(fingerprint)).size).toBe(maps.length);
    maps.forEach((g, i) => {
      expect(g.streak?.index).toBe(i);
      expect(g.stations).toHaveLength(3);
      expect(g.version).toBe(2);
    });
  });

  it("start with fewer pits and climb (map level)", () => {
    expect(pitDeltaFor(0)).toBeLessThan(0);
    expect(pitDeltaFor(MAX_STREAK_MAPS - 1)).toBe(TUNING.streak.pits.cap);
    for (let i = 1; i < 20; i++) expect(pitDeltaFor(i)).toBeGreaterThanOrEqual(pitDeltaFor(i - 1));
    const avg = (from: number, to: number) => {
      let n = 0;
      for (let s = 0; s < 6; s++) for (let i = from; i < to; i++) n += streakGame(`P${s}`, i).pits.length;
      return n / (6 * (to - from));
    };
    expect(avg(0, 2)).toBeLessThan(avg(10, 12));
  });

  it("pass the audits: solvable, no soft-locks with the changed pits, stations reachable from every state", () => {
    for (let s = 0; s < 12; s++) {
      for (const i of [0, 3, 7, 12]) {
        const g = streakGame(`AU${s}`, i);
        // The pit count leaves the single-game range on purpose.
        const problems = auditGame(g).problems.filter((p) => !/ pits \(expected/.test(p));
        expect(problems, `${s}/${i}`).toEqual([]);
        expect(auditStations(g).ok, `${s}/${i}`).toBe(true);
      }
    }
  });

  it("play rules: candle starts generous and shrinks to a floor; free tries thin out", () => {
    const at = (level: number) => playRules({ streak: true, level });
    expect(at(0).maxLight).toBe(Math.round(TUNING.candle.max * TUNING.streak.candleStart));
    expect(at(40).maxLight).toBe(Math.round(TUNING.candle.max * TUNING.streak.candleFloor));
    for (let l = 1; l < 20; l++) expect(at(l).maxLight).toBeLessThanOrEqual(at(l - 1).maxLight);
    expect(at(40).lockFreeTries).toBe(1);
    expect(at(40).keyFreeTries).toBe(0);
    expect(playRules()).toEqual(playRules({ streak: false, level: 9 }));
  });

  it("hearts carry into the next map", () => {
    expect(createPlay(maps[1], { hearts: 1 }).hearts).toBe(1);
    expect(createPlay(maps[1], { hearts: 2, level: 3 }).light).toBe(playRules({ streak: true, level: 3 }).maxLight);
  });
});

describe("relay key", () => {
  const rng = createRng("relay-tests");
  const randomState = (): RelayState => ({
    index: rng.int(64),
    hearts: rng.int(4),
    result: rng.pick(["won", "escaped", "lost"] as const),
    escapes: rng.int(16),
    seals: rng.int(256),
    heartsLost: rng.int(128),
  });
  const seeds = createRng("relay-codes");
  const codes = Array.from({ length: 50 }, () => encodeCode({ mode: "duo", seed: Array.from({ length: 6 }, () => seeds.pick([...CODE_ALPHABET])).join("") }));

  it("round-trips every field, grouped by 3 with any spacing or case", () => {
    for (let n = 0; n < 2000; n++) {
      const c = codes[n % codes.length];
      const st = randomState();
      const key = encodeRelay(c, st);
      expect(key).toMatch(new RegExp(`^[${CODE_ALPHABET}]{9}$`));
      const typed = `${key.slice(0, 3).toLowerCase()} - ${key.slice(3, 6)}-${key.slice(6)}`;
      const back = decodeRelay(c, st.index, typed);
      expect(back).toEqual({ ok: true, value: st });
    }
  });

  it("catches every single wrong character and adjacent swap as a typo", () => {
    const st: RelayState = { index: 4, hearts: 2, result: "won", escapes: 1, seals: 13, heartsLost: 5 };
    const key = encodeRelay(code, st);
    for (let i = 0; i < key.length; i++) {
      for (const ch of CODE_ALPHABET) {
        if (ch === key[i]) continue;
        const bad = key.slice(0, i) + ch + key.slice(i + 1);
        expect(decodeRelay(code, 4, bad).ok).toBe(false);
      }
      if (i < key.length - 1 && key[i] !== key[i + 1]) {
        const swapped = key.slice(0, i) + key[i + 1] + key[i] + key.slice(i + 2);
        const r = decodeRelay(code, 4, swapped);
        expect(r.ok === false && r.error).toBe("checksum");
      }
    }
  });

  it("says when the key is from another map of this streak", () => {
    const key = encodeRelay(code, { index: 2, hearts: 3, result: "won", escapes: 0, seals: 9, heartsLost: 0 });
    const r = decodeRelay(code, 3, key);
    expect(r.ok === false && r.error).toBe("other-map");
  });

  it("rejects keys from other streaks (≤ 0.5 % slip through)", () => {
    let slipped = 0;
    let n = 0;
    for (let i = 0; i < codes.length; i++) {
      for (let j = 0; j < 40; j++) {
        const st = randomState();
        const r = decodeRelay(codes[(i + 1) % codes.length], st.index, encodeRelay(codes[i], st));
        n++;
        if (r.ok) slipped++;
        else expect(["other-streak", "other-map"]).toContain(r.error);
      }
    }
    expect(slipped / n).toBeLessThan(0.005);
  });

  it("the same state gives different keys in different streaks", () => {
    const st: RelayState = { index: 0, hearts: 3, result: "won", escapes: 0, seals: 3, heartsLost: 0 };
    expect(new Set(codes.map((c) => encodeRelay(c, st))).size).toBe(codes.length);
  });
});
