import { describe, expect, it } from "vitest";
import { encodeCode } from "../code";
import { CURSE_KINDS, type Curse, cureKey, cursedDir, drawCurse, inputForCursed } from "../curses";
import { gamesForCode } from "../generate";
import { DIRS, type Dir, isOpen, neighbor } from "../grid";
import {
  type PlayState,
  candleRadius,
  createPlay,
  emergencyAvailable,
  stepPlay,
  takeEmergencyExit,
  visionRadius,
} from "../play";
import { solve } from "../solver";
import { enterCureKey } from "../trialplay";
import { TUNING } from "../tuning";
import type { Game } from "../types";

/** Curses and graded endings (GAME_SPEC_V2.md anexo etapa 3). */

const v2 = (seed: string) => gamesForCode(encodeCode({ mode: "hard", seed }))[0];
const v1 = (seed: string) => gamesForCode(encodeCode({ mode: "hard", seed, version: 1 }))[0];

/** A v2 game whose first swirl can be walked to without pits; returns it and the state standing next to it. */
function besideSwirl(): { game: Game; s: PlayState; into: Dir } {
  for (const seed of ["CURSE2", "CURSE3", "CURSE4", "CURSE5", "CURSE6", "CURSE7", "CURSE8", "CURSE9"]) {
    const game = v2(seed);
    if (game.swirls.length === 0) continue;
    const target = game.swirls[0].cell;
    const sol = solve(game, game.start, target);
    if (!sol.solvable || sol.dirs.length < 2) continue;
    let s = createPlay(game);
    for (const d of sol.dirs.slice(0, -1)) s = stepPlay(game, s, d).state;
    const into = sol.dirs[sol.dirs.length - 1];
    if (neighbor(game.grid, s.cell, into) !== target || game.ice[target]) continue;
    return { game, s, into };
  }
  throw new Error("no test game with a reachable swirl");
}

const cursed = (s: PlayState, c: Partial<Curse>): PlayState => ({
  ...s,
  curse: { k: 0, kind: "turn", left: 10, turn: 1, cure: "sigil", ...c },
});

describe("curses", () => {
  it("a v2 swirl lays curse number k (drawn from the seed), not an inversion", () => {
    const { game, s, into } = besideSwirl();
    const r = stepPlay(game, s, into);
    const ev = r.events.find((e) => e.type === "curse");
    expect(ev).toBeDefined();
    expect(r.state.invert).toBeNull();
    expect(r.state.curse).toEqual(drawCurse(game.seed, 0));
    expect(r.state.curses).toBe(1);
  });

  it("v1 codes keep the old swirl", () => {
    for (const seed of ["CURSE2", "CURSE3", "CURSE4", "CURSE5"]) {
      const game = v1(seed);
      if (game.swirls.length === 0) continue;
      const sol = solve(game, game.start, game.swirls[0].cell);
      if (!sol.solvable) continue;
      let s = createPlay(game);
      for (const d of sol.dirs) s = stepPlay(game, s, d).state;
      if (s.cell !== game.swirls[0].cell) continue;
      expect(s.curse).toBeNull();
      expect(s.invert).not.toBeNull();
      return;
    }
    throw new Error("no v1 game with a reachable swirl");
  });

  it("turn and mirror remap the controls, and inputForCursed undoes them", () => {
    for (const kind of ["turn", "mirror"] as const) {
      for (const turn of [1, -1] as const) {
        const c: Curse = { k: 0, kind, left: 5, turn, cure: "echo" };
        const mapped = DIRS.map((d) => cursedDir(d, c));
        expect(new Set(mapped).size).toBe(4);
        if (kind === "turn") expect(mapped.some((d, i) => d === i)).toBe(false);
        for (const d of DIRS) expect(cursedDir(inputForCursed(d, c), c)).toBe(d);
      }
    }
    for (const kind of ["blind", "hungry", "masked"] as const) {
      const c: Curse = { k: 0, kind, left: 5, turn: 1, cure: "echo" };
      for (const d of DIRS) expect(cursedDir(d, c)).toBe(d);
    }
  });

  it("blindness caps sight; hunger burns double", () => {
    const game = v2("CURSE2");
    const s = createPlay(game);
    expect(visionRadius(cursed(s, { kind: "blind" }))).toBe(TUNING.curse.blindRadius);
    expect(visionRadius(s)).toBe(candleRadius(s.light, s.rules.maxLight));
    const d = DIRS.find((x) => isOpen(game.grid, game.start, x) && !game.occupant[neighbor(game.grid, game.start, x)])!;
    const plain = stepPlay(game, s, d).state;
    const hungry = stepPlay(game, cursed(s, { kind: "hungry" }), d).state;
    expect(s.light - plain.light).toBe(1);
    expect(s.light - hungry.light).toBe(TUNING.curse.hungryBurn);
  });

  it("lifts on its own when its moves run out", () => {
    const game = v2("CURSE2");
    let s = cursed(createPlay(game), { kind: "masked", left: 3 });
    const events: string[] = [];
    for (let i = 0; i < 8 && s.curse; i++) {
      const d = DIRS.find((x) => isOpen(game.grid, s.cell, x) && game.occupant[neighbor(game.grid, s.cell, x)]?.type !== "pit")!;
      const r = stepPlay(game, s, d);
      s = r.state;
      events.push(...r.events.map((e) => e.type));
    }
    expect(s.curse).toBeNull();
    expect(events).toContain("uncurse");
  });

  it("a cure key lifts it and relights a little, less per guide mistake; wrong keys are free", () => {
    const game = v2("CURSE2");
    const base = { ...createPlay(game), light: 30 };
    const s = cursed(base, { k: 2 });
    const wrong = enterCureKey(game, s, cureKey(game.seed, 1, 0))!;
    expect(wrong.ok).toBe(false);
    expect(wrong.state).toBe(s);
    const clean = enterCureKey(game, s, cureKey(game.seed, 2, 0))!;
    const messy = enterCureKey(game, s, cureKey(game.seed, 2, 2))!;
    expect(clean.ok && messy.ok).toBe(true);
    expect(clean.state.curse).toBeNull();
    expect(clean.state.cured).toBe(1);
    expect(clean.state.light - 30).toBe(Math.round(s.rules.maxLight * TUNING.curse.cureRefill));
    expect(messy.state.light).toBeLessThan(clean.state.light);
    expect(messy.state.light).toBeGreaterThanOrEqual(30);
    expect(enterCureKey(game, base, cureKey(game.seed, 0, 0))).toBeNull();
  });

  it("every kind and both cures show up", () => {
    const kinds = new Set<string>();
    const cures = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const c = drawCurse(`K${i}`, i % 5);
      kinds.add(c.kind);
      cures.add(c.cure);
      expect(c.left).toBeGreaterThanOrEqual(TUNING.curse.steps[0]);
      expect(c.left).toBeLessThanOrEqual(TUNING.curse.steps[1]);
    }
    expect([...kinds].sort()).toEqual([...CURSE_KINDS].sort());
    expect(cures.size).toBe(2);
  });
});

describe("graded endings", () => {
  const game = v2("EXTS22");
  const exitNeighbor = (() => {
    for (const d of DIRS) {
      if (!isOpen(game.grid, game.exit, d)) continue;
      const n = neighbor(game.grid, game.exit, d);
      if (!game.occupant[n] && !game.ice[n]) return { cell: n, into: ((d + 2) % 4) as Dir };
    }
    throw new Error("exit has no plain neighbour");
  })();
  const at = (patch: Partial<PlayState>) => stepPlay(game, { ...createPlay(game), cell: exitNeighbor.cell, ...patch }, exitNeighbor.into);

  it("in danger with 1–2 seals, the sealed exit offers the emergency way out", () => {
    const r = at({ hearts: 1, seals: 0b001 });
    const ev = r.events.find((e) => e.type === "exitSealed");
    expect(ev && ev.type === "exitSealed" && ev.emergency).toBe(true);
    expect(r.state.arrived).toBe(false);
    expect(emergencyAvailable(game, r.state)).toBe(true);
    const out = takeEmergencyExit(game, r.state);
    expect(out.state.arrived && out.state.escaped).toBe(true);
    expect(out.events).toEqual([{ type: "emergencyExit", seals: 1 }]);
  });

  it("the candle out also counts as danger", () => {
    const r = at({ hearts: 3, light: 0, seals: 0b011 });
    expect(emergencyAvailable(game, r.state)).toBe(true);
  });

  it("not offered when safe, with no seals, or with all three (that's the real exit)", () => {
    expect(emergencyAvailable(game, at({ hearts: 3, seals: 0b001 }).state)).toBe(false);
    expect(emergencyAvailable(game, at({ hearts: 1, seals: 0 }).state)).toBe(false);
    const full = at({ hearts: 1, seals: 0b111 });
    expect(full.state.arrived && !full.state.escaped).toBe(true);
    expect(takeEmergencyExit(game, at({ hearts: 3, seals: 0b001 }).state).events).toEqual([]);
  });
});
