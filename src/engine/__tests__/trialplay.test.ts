import { describe, expect, it } from "vitest";
import { figuresTrial } from "../figures";
import { generateGame } from "../generate";
import { lockTrial } from "../lock";
import { pianoTrial } from "../piano";
import { type PlayState, createPlay, exitOpen, sealCount, stepPlay } from "../play";
import { invertDir } from "../rules";
import { formatSealKey, sealKey } from "../sealcode";
import { solve } from "../solver";
import { TRIAL_KINDS, auditStations } from "../stations";
import { checkTangram, placedCells, tangramTrial } from "../tangram";
import { checkMelody, checkTangramAt, chooseFigure, enterSealKey, tryLock } from "../trialplay";
import { TUNING } from "../tuning";
import type { Game, Station, TrialKind } from "../types";

const MAX = TUNING.candle.max;
const COST = Math.round(MAX * TUNING.trials.failLight);

/**
 * A real v2 map with the trial kinds and directions set by hand (each trial
 * only depends on its station's key and direction), so one game can hold
 * figures A, figures B and the lock even though maps draw 3 different kinds.
 */
const base = generateGame({ seed: "seal0", level: "hard" });
const withKinds = (specs: [TrialKind, "A" | "B"][]): Game => ({
  ...base,
  stations: base.stations!.map((s, i) => ({ ...s, kind: specs[i][0], direction: specs[i][1] })),
});
const game = withKinds([
  ["figures", "A"],
  ["figures", "B"],
  ["lock", "A"],
]);
const station = (pred: (s: Station) => boolean) => game.stations!.find(pred)!;
const figA = station((s) => s.kind === "figures" && s.direction === "A");
const figB = station((s) => s.kind === "figures" && s.direction === "B");
const lock = station((s) => s.kind === "lock");
const at = (st: Station, over: Partial<PlayState> = {}): PlayState => ({ ...createPlay(game), cell: st.cell, ...over });

/** A wrong combination for the lock (not the secret, valid under its repeat rule). */
function wrongGuess(t: ReturnType<typeof lockTrial>, n: number): number[] {
  const g = t.secret.slice();
  for (let k = 0; ; k++) {
    const a = (n + k) % t.slots;
    const b = (a + 1) % t.slots;
    const cand = g.slice();
    [cand[a], cand[b]] = [cand[b], cand[a]];
    if (cand.join() !== t.secret.join()) return cand;
    // All the same around there: swap in an unused glyph.
    const free = Array.from({ length: t.glyphCount }, (_, x) => x).find((x) => !t.secret.includes(x))!;
    cand[a] = free;
    return cand;
  }
}

describe("v2 games", () => {
  it("have 3 stations that pass the soft-lock audit, with 3 different trial kinds", () => {
    for (let i = 0; i < 60; i++) {
      const g = generateGame({ seed: `v2-${i}`, level: "hard" });
      expect(g.version).toBe(2);
      expect(g.stations).toHaveLength(3);
      expect(auditStations(g).ok, `v2-${i}`).toBe(true);
      const kinds = new Set(g.stations!.map((s) => s.kind));
      expect(kinds.size).toBe(3);
      for (const k of kinds) expect(TRIAL_KINDS).toContain(k);
      for (const st of g.stations!) if (st.kind === "lock") expect(st.direction).toBe("A");
      const cells = g.stations!.map((s) => s.cell);
      expect(new Set(cells).size).toBe(3);
      for (const c of cells) {
        expect(g.occupant[c]).toBeNull();
        expect(c).not.toBe(g.start);
        expect(c).not.toBe(g.exit);
      }
    }
  });

  it("v1 games have no stations: the exit is open from the start", () => {
    const g = generateGame({ seed: "v1open", level: "hard", version: 1 });
    expect(g.stations).toBeUndefined();
    expect(exitOpen(g, createPlay(g))).toBe(true);
  });
});

describe("the sealed exit", () => {
  it("doesn't end the game without the 3 seals, and does with them", () => {
    const sol = solve(game, game.start, game.exit);
    const walk = (s: PlayState) => {
      for (const d of sol.dirs) s = stepPlay(game, { ...s, light: MAX }, invertDir(d, s.invert?.axes ?? null)).state;
      return s;
    };
    const sealed = walk(createPlay(game));
    expect(sealed.arrived).toBe(false);
    expect(sealed.cell).toBe(game.exit);
    const open = walk({ ...createPlay(game), seals: 0b111 });
    expect(open.arrived).toBe(true);
  });

  it("says how many seals are missing when you step on it", () => {
    const sol = solve(game, game.start, game.exit);
    let s = { ...createPlay(game), seals: 0b001 };
    const events = [];
    for (const d of sol.dirs) {
      const r = stepPlay(game, { ...s, light: MAX }, invertDir(d, s.invert?.axes ?? null));
      events.push(...r.events);
      s = r.state;
    }
    expect(events).toContainEqual({ type: "exitSealed", missing: 2, emergency: false });
  });

  it("stepping on a station announces it", () => {
    const sol = solve(game, game.start, lock.cell);
    let s = createPlay(game);
    let last: ReturnType<typeof stepPlay>["events"] = [];
    for (const d of sol.dirs) {
      const r = stepPlay(game, { ...s, light: MAX }, invertDir(d, s.invert?.axes ?? null));
      last = r.events;
      s = r.state;
    }
    expect(last).toContainEqual({ type: "station", index: lock.index, sealed: false });
  });
});

describe("FIGURAS RARAS, direction B (the explorer picks)", () => {
  const t = figuresTrial(figB.key, "B");
  const wrong = (t.correct + 1) % t.candidates.length;

  it("a hit opens the seal and relights the candle", () => {
    const r = chooseFigure(game, at(figB, { light: 10 }), figB.index, t.correct)!;
    expect(r.state.seals).toBe(1 << figB.index);
    expect(r.state.light).toBe(Math.min(MAX, 10 + Math.round(MAX * TUNING.seal.candleRefill)));
    expect(r.events).toContainEqual({ type: "seal", index: figB.index, count: 1 });
  });

  it("a miss costs right away and stays crossed out", () => {
    const r = chooseFigure(game, at(figB), figB.index, wrong)!;
    expect(r.state.seals).toBe(0);
    expect(r.state.light).toBe(MAX - COST);
    expect(r.state.trials[figB.index]).toMatchObject({ fails: 1, paid: 1, wrong: [wrong] });
    expect(chooseFigure(game, r.state, figB.index, wrong)).toBeNull();
  });

  it("only works standing on that station, and only once", () => {
    expect(chooseFigure(game, createPlay(game), figB.index, t.correct)).toBeNull();
    expect(chooseFigure(game, at(figB), figA.index, t.correct)).toBeNull();
    const won = chooseFigure(game, at(figB), figB.index, t.correct)!.state;
    expect(chooseFigure(game, won, figB.index, t.correct)).toBeNull();
  });
});

describe("CERRADURA DE DEDUCCIÓN", () => {
  const t = lockTrial(lock.key);

  it("the first tries are free, then each failure costs light and every Nth a heart", () => {
    let s = at(lock);
    for (let i = 0; i < TUNING.trials.lockFreeTries; i++) {
      const r = tryLock(game, s, lock.index, wrongGuess(t, i))!;
      expect(r.events).toContainEqual({ type: "trialFail", index: lock.index, paid: false });
      s = r.state;
    }
    expect(s.light).toBe(MAX);
    expect(s.hearts).toBe(TUNING.hearts);
    for (let i = 1; i <= TUNING.trials.heartEvery; i++) {
      s = tryLock(game, s, lock.index, wrongGuess(t, i))!.state;
      expect(s.light).toBe(MAX - i * COST);
    }
    expect(s.hearts).toBe(TUNING.hearts - 1);
    expect(s.trials[lock.index].guesses).toHaveLength(TUNING.trials.lockFreeTries + TUNING.trials.heartEvery);
  });

  it("answers with the lights and opens on the secret", () => {
    const r1 = tryLock(game, at(lock), lock.index, wrongGuess(t, 0))!;
    const fb = r1.state.trials[lock.index].guesses[0].feedback;
    expect(fb.hits).toBeLessThan(t.slots);
    const r2 = tryLock(game, r1.state, lock.index, t.secret)!;
    expect(r2.state.seals).toBe(1 << lock.index);
  });

  it("rejects malformed combinations without counting them", () => {
    expect(tryLock(game, at(lock), lock.index, t.secret.slice(1))).toBeNull();
    expect(tryLock(game, at(lock), lock.index, t.secret.map(() => t.glyphCount))).toBeNull();
  });

  it("failures can end the expedition", () => {
    let s = at(lock, { hearts: 1, trials: createPlay(game).trials.map((x, i) => (i === lock.index ? { ...x, fails: 9, paid: TUNING.trials.heartEvery - 1 } : x)) });
    s = tryLock(game, s, lock.index, wrongGuess(t, 0))!.state;
    expect(s.lost).toBe(true);
    expect(tryLock(game, s, lock.index, t.secret)).toBeNull();
  });
});

describe("FIGURAS RARAS, direction A (dictated key)", () => {
  const n = game.stations!.length;

  it("typing slips change nothing", () => {
    const s = at(figA);
    for (const input of ["", "AB", "ABCDEFG"]) {
      const r = enterSealKey(game, s, figA.index, input)!;
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
    }
  });

  it("a key that can't be right counts: the first is free, then it costs", () => {
    const key = sealKey(game.seed, n, figA.index, 0);
    const typo = key.slice(0, 2) + (key[2] === "A" ? "B" : "A") + key.slice(3);
    let r = enterSealKey(game, at(figA), figA.index, typo)!;
    expect(r.ok === false && r.costly).toBe(true);
    expect(r.state.light).toBe(MAX);
    r = enterSealKey(game, r.state, figA.index, sealKey(game.seed, n, lock.index, 0))!;
    expect(r.ok === false && r.message).toMatch(/otra estación/);
    expect(r.state.light).toBe(MAX - COST);
  });

  it("the right key opens the seal and charges the guide's mistakes it carries", () => {
    const key = formatSealKey(sealKey(game.seed, n, figA.index, 2)).toLowerCase();
    const r = enterSealKey(game, at(figA, { light: 50 }), figA.index, key)!;
    expect(r.ok && r.guideFails).toBe(2);
    expect(r.state.seals).toBe(1 << figA.index);
    expect(r.state.trials[figA.index]).toMatchObject({ fails: 2, paid: 2 });
    expect(r.state.light).toBe(Math.min(MAX, 50 - 2 * COST + Math.round(MAX * TUNING.seal.candleRefill)));
  });
});

describe("rewards", () => {
  it(`every ${TUNING.seal.healEvery === 1 ? "" : `${TUNING.seal.healEvery}th `}seal gives a lost heart back; the last one opens the exit`, () => {
    const heartsAfter = (k: number) => Math.min(TUNING.hearts, 1 + Math.floor(k / TUNING.seal.healEvery));
    let s = at(figB, { hearts: 1 });
    s = chooseFigure(game, s, figB.index, figuresTrial(figB.key, "B").correct)!.state;
    expect(s.hearts).toBe(heartsAfter(1));
    s = { ...s, cell: lock.cell };
    const r = tryLock(game, s, lock.index, lockTrial(lock.key).secret)!;
    expect(r.state.hearts).toBe(heartsAfter(2));
    if (heartsAfter(2) > heartsAfter(1)) expect(r.events).toContainEqual({ type: "heal", hearts: heartsAfter(2) });
    s = { ...r.state, cell: figA.cell };
    const last = enterSealKey(game, s, figA.index, sealKey(game.seed, game.stations!.length, figA.index, 0))!;
    expect(last.state.hearts).toBe(heartsAfter(3));
    expect(sealCount(last.state)).toBe(3);
    expect(last.events).toContainEqual({ type: "exitOpen" });
  });

  it("never heals above the maximum", () => {
    const r = chooseFigure(game, at(figB), figB.index, figuresTrial(figB.key, "B").correct)!;
    expect(r.state.hearts).toBe(TUNING.hearts);
    expect(r.events.some((e) => e.type === "heal")).toBe(false);
  });
});

describe("a whole expedition", () => {
  it("walk to every station, win each seal, then leave through the exit", () => {
    let s = createPlay(game);
    const walkTo = (target: number) => {
      const sol = solve(game, s.cell, target, s.keys);
      expect(sol.solvable).toBe(true);
      for (const d of sol.dirs) s = stepPlay(game, { ...s, light: MAX }, invertDir(d, s.invert?.axes ?? null)).state;
    };
    for (const st of game.stations!) {
      walkTo(st.cell);
      expect(s.cell).toBe(st.cell);
      if (st.kind === "lock") s = tryLock(game, s, st.index, lockTrial(st.key).secret)!.state;
      else if (st.direction === "B") s = chooseFigure(game, s, st.index, figuresTrial(st.key, "B").correct)!.state;
      else s = enterSealKey(game, s, st.index, sealKey(game.seed, 3, st.index, 0))!.state;
    }
    expect(sealCount(s)).toBe(3);
    walkTo(game.exit);
    expect(s.arrived).toBe(true);
  });
});

describe("trial kinds and directions across maps", () => {
  const games = Array.from({ length: 400 }, (_, i) => generateGame({ seed: `mix${i}`, level: i % 2 ? "hard" : "medium" }));

  it("each kind shows up in about 3 of 4 maps; both directions show up for every kind but the lock", () => {
    for (const kind of TRIAL_KINDS) {
      const share = games.filter((g) => g.stations!.some((s) => s.kind === kind)).length / games.length;
      expect(share, kind).toBeGreaterThan(0.65);
      expect(share, kind).toBeLessThan(0.85);
    }
    for (const kind of ["figures", "piano", "tangram"] as const) {
      const dirs = games.flatMap((g) => g.stations!.filter((s) => s.kind === kind).map((s) => s.direction));
      const a = dirs.filter((d) => d === "A").length / dirs.length;
      expect(a, kind).toBeGreaterThan(0.4);
      expect(a, kind).toBeLessThan(0.6);
    }
  });

  it("the guide acts somewhere in most maps (never all three on one side when there's no lock)", () => {
    for (const g of games) {
      const open = g.stations!.filter((s) => s.kind !== "lock");
      if (open.length === 3) expect(new Set(open.map((s) => s.direction)).size).toBe(2);
    }
  });
});

const pt = withKinds([
  ["piano", "A"],
  ["piano", "B"],
  ["tangram", "B"],
]);
const pianoA = pt.stations![0];
const pianoB = pt.stations![1];
const tanB = pt.stations![2];
const ta = withKinds([
  ["tangram", "A"],
  ["lock", "A"],
  ["figures", "B"],
]);
const tanA = ta.stations![0];
const atIn = (g: Game, st: Station, over: Partial<PlayState> = {}): PlayState => ({ ...createPlay(g), cell: st.cell, ...over });

describe("PIANO DE LA BRUJA, direction B (the explorer plays)", () => {
  const t = pianoTrial(pianoB.key, "B");
  const wrong = t.melody.map((k, i) => (i === 1 ? (k + 1) % t.keys.length : k));

  it("the reply counts the notes in place; the first wrong melody is free, then each costs", () => {
    let r = checkMelody(pt, atIn(pt, pianoB), pianoB.index, wrong)!;
    expect(r.right).toBe(t.melody.length - 1);
    expect(r.events).toContainEqual({ type: "trialFail", index: pianoB.index, paid: false });
    expect(r.state.light).toBe(MAX);
    r = checkMelody(pt, r.state, pianoB.index, wrong)!;
    expect(r.state.light).toBe(MAX - COST);
    expect(r.state.trials[pianoB.index].melodies).toHaveLength(2);
    r = checkMelody(pt, r.state, pianoB.index, t.melody)!;
    expect(r.state.seals).toBe(1 << pianoB.index);
  });

  it("incomplete or impossible melodies aren't checked (nothing charged)", () => {
    expect(checkMelody(pt, atIn(pt, pianoB), pianoB.index, t.melody.slice(1))).toBeNull();
    expect(checkMelody(pt, atIn(pt, pianoB), pianoB.index, t.melody.map(() => t.keys.length))).toBeNull();
    expect(checkMelody(pt, atIn(pt, pianoA), pianoA.index, t.melody)).toBeNull();
  });
});

describe("TANGRAM A CIEGAS, direction B (the explorer assembles)", () => {
  const t = tangramTrial(tanB.key, "B");

  it("the construction's solution fits and opens the seal", () => {
    const r = checkTangramAt(pt, atIn(pt, tanB), tanB.index, t.solution)!;
    expect(r.state.seals).toBe(1 << tanB.index);
  });

  it("a translated solution fits too; an empty or overlapping board isn't checked", () => {
    const moved = t.solution.map((p) => ({ ...p, x: p.x + t.offset[0], y: p.y + t.offset[1] }));
    expect(checkTangramAt(pt, atIn(pt, tanB), tanB.index, moved)!.state.seals).toBe(1 << tanB.index);
    expect(checkTangramAt(pt, atIn(pt, tanB), tanB.index, [])).toBeNull();
    expect(checkTangramAt(pt, atIn(pt, tanB), tanB.index, [t.solution[0], t.solution[0]])).toBeNull();
    // Piece b dropped so its first cell lands on piece a's first cell.
    const [a, b] = t.solution;
    const ca = placedCells(t, a)[0];
    const cb = placedCells(t, { ...b, x: 0, y: 0 })[0];
    const piled = { ...b, x: ca[0] - cb[0], y: ca[1] - cb[1] };
    expect(checkTangram(t, [a, piled])).toEqual({ ready: false, reason: piled.x < 0 || piled.y < 0 ? "outside" : "overlap" });
    expect(checkTangramAt(pt, atIn(pt, tanB), tanB.index, [a, piled])).toBeNull();
  });

  it("a wrong shape: the first is free, then each costs", () => {
    let s = atIn(pt, tanB);
    s = checkTangramAt(pt, s, tanB.index, [t.solution[0]])!.state;
    expect(s.light).toBe(MAX);
    s = checkTangramAt(pt, s, tanB.index, [t.solution[0]])!.state;
    expect(s.light).toBe(MAX - COST);
    expect(s.trials[tanB.index].fails).toBe(2);
  });
});

describe("piano and tangram, direction A (the guide plays and dictates a key)", () => {
  it("the key opens the seal; the guide's mistakes past the free ones are charged", () => {
    for (const [g, st] of [
      [pt, pianoA],
      [ta, tanA],
    ] as const) {
      const free = st.kind === "piano" ? TUNING.trials.pianoFreeTries : TUNING.trials.tangramFreeTries;
      const r = enterSealKey(g, atIn(g, st, { light: 50 }), st.index, sealKey(g.seed, 3, st.index, 3))!;
      expect(r.ok && r.guideFails).toBe(3);
      expect(r.state.seals).toBe(1 << st.index);
      expect(r.state.trials[st.index]).toMatchObject({ fails: 3, paid: 3 - free });
    }
  });

  it("the explorer can't play the guide's side", () => {
    expect(checkMelody(pt, atIn(pt, pianoA), pianoA.index, pianoTrial(pianoA.key, "A").melody)).toBeNull();
    expect(checkTangramAt(ta, atIn(ta, tanA), tanA.index, tangramTrial(tanA.key, "A").solution)).toBeNull();
  });
});
