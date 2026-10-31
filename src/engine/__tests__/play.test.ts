import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "../difficulty";
import { generateGame } from "../generate";
import type { Dir } from "../grid";
import { PIT_KNOWN, SEEN, VISITED, createPlay, penaltyMs, starCount, stepPlay, visibility } from "../play";
import { invertDir } from "../rules";
import { solve } from "../solver";
import type { Game, Swirl } from "../types";
import { makeWorld } from "./helpers";

const N = 0 as const;
const E = 1 as const;
const S = 2 as const;
const W = 3 as const;

/** A hand-built world dressed up as an easy Game (vision 4, lantern +2 for 20 s). */
function makeGame(t: ReturnType<typeof makeWorld>, start: number, exit: number, extra: { swirls?: Swirl[] } = {}): Game {
  t.put(start, { type: "start" });
  t.put(exit, { type: "exit" });
  return {
    ...t.world,
    version: 1,
    level: "easy",
    seed: "test",
    theme: "forest",
    algorithm: "backtracker",
    obstacleTypes: [],
    start,
    exit,
    checkpoints: [],
    pits: [],
    doors: [],
    keys: [],
    ponds: [],
    swirls: extra.swirls ?? [],
    stars: [],
    lanterns: [],
    landmarks: [],
    solution: { moves: 0, route: [] },
    stats: {} as Game["stats"],
  } as Game;
}

/** A straight 1-row corridor with everything open. */
function corridor(len: number) {
  const t = makeWorld(len, 1);
  t.run(0, 0, E, len - 1);
  return t;
}

const walk = (game: Game, dirs: Dir[], now = 0) => {
  let s = createPlay(game, now);
  const events = [];
  for (const d of dirs) {
    const r = stepPlay(game, s, d, now);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
};

describe("walking and arriving", () => {
  it("walls block and don't count as moves", () => {
    const t = corridor(3);
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const r = stepPlay(g, createPlay(g), N, 0);
    expect(r.outcome).toBe("blocked");
    expect(r.events).toEqual([{ type: "blocked" }]);
    expect(r.state.moves).toBe(0);
  });

  it("reaching the exit ends the round and further input does nothing", () => {
    const t = corridor(3);
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const { s, events } = walk(g, [E, E]);
    expect(s.arrived).toBe(true);
    expect(events).toContainEqual({ type: "arrived" });
    expect(stepPlay(g, s, W, 0).state.cell).toBe(t.at(2, 0));
  });

  it("marks visited cells", () => {
    const t = corridor(4);
    const g = makeGame(t, t.at(0, 0), t.at(3, 0));
    const { s } = walk(g, [E]);
    expect(s.memo[t.at(1, 0)] & VISITED).toBeTruthy();
    expect(s.memo[t.at(2, 0)] & VISITED).toBeFalsy();
  });
});

describe("sight", () => {
  it("counts real steps and never sees through walls", () => {
    // Two rows: top row open, bottom row open, connected only at the far right.
    const t = makeWorld(5, 2);
    t.run(0, 0, E, 4);
    t.run(0, 1, E, 4);
    t.run(4, 0, S, 1);
    const g = makeGame(t, t.at(0, 0), t.at(4, 0));
    const d = visibility(g, t.at(0, 0), 4, 0);
    expect(d[t.at(4, 0)]).toBe(4);
    expect(d[t.at(0, 1)]).toBe(-1); // right below, but behind a wall
    expect(visibility(g, t.at(0, 0), 3, 0)[t.at(4, 0)]).toBe(-1);
  });

  it("sees a locked door but not past it", () => {
    const t = corridor(5);
    t.put(t.at(2, 0), { type: "door", color: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(4, 0));
    const d = visibility(g, t.at(0, 0), 4, 0);
    expect(d[t.at(2, 0)]).toBe(2);
    expect(d[t.at(3, 0)]).toBe(-1);
    expect(visibility(g, t.at(0, 0), 4, 1)[t.at(3, 0)]).toBe(3);
  });

  it("remembers what was seen", () => {
    const t = corridor(8);
    const g = makeGame(t, t.at(0, 0), t.at(7, 0));
    const s = createPlay(g);
    expect(s.memo[t.at(4, 0)] & SEEN).toBeTruthy(); // vision 4 on easy
    expect(s.memo[t.at(5, 0)] & SEEN).toBeFalsy();
  });
});

describe("pits and checkpoints", () => {
  it("a fall sends you to the start, counts, and costs 10 s", () => {
    const t = corridor(4);
    t.put(t.at(2, 0), { type: "pit" });
    const g = makeGame(t, t.at(0, 0), t.at(3, 0));
    const { s, events } = walk(g, [E, E]);
    expect(events).toContainEqual({ type: "fell", pit: t.at(2, 0), respawn: t.at(0, 0) });
    expect(s.cell).toBe(t.at(0, 0));
    expect(s.pits).toBe(1);
    expect(penaltyMs(s)).toBe(10_000);
    expect(s.memo[t.at(2, 0)] & PIT_KNOWN).toBeTruthy();
  });

  it("a flag becomes the respawn point", () => {
    const t = corridor(5);
    t.put(t.at(1, 0), { type: "checkpoint", index: 0 });
    t.put(t.at(3, 0), { type: "pit" });
    const g = makeGame(t, t.at(0, 0), t.at(4, 0));
    const { s, events } = walk(g, [E, E, E]);
    expect(events).toContainEqual({ type: "checkpoint", index: 0 });
    expect(s.cell).toBe(t.at(1, 0));
    expect(s.checkpointIndex).toBe(0);
  });
});

describe("keys and doors", () => {
  it("a door blocks without moving until you pick up its key", () => {
    const t = corridor(5);
    t.put(t.at(1, 0), { type: "key", color: 1 });
    t.put(t.at(3, 0), { type: "door", color: 1 });
    const g = makeGame(t, t.at(2, 0), t.at(4, 0));
    let s = createPlay(g);
    const locked = stepPlay(g, s, E, 0);
    expect(locked.outcome).toBe("locked");
    expect(locked.events).toEqual([{ type: "locked", color: 1, cell: t.at(3, 0) }]);
    expect(locked.state.moves).toBe(0);
    const got = stepPlay(g, s, W, 0);
    expect(got.events).toContainEqual({ type: "key", color: 1 });
    s = got.state;
    expect(s.keys).toBe(0b10);
    s = stepPlay(g, s, E, 0).state;
    s = stepPlay(g, s, E, 0).state;
    expect(s.cell).toBe(t.at(3, 0));
    expect(stepPlay(g, s, E, 0).state.arrived).toBe(true);
  });
});

describe("portals and ice", () => {
  it("a portal drops you on its partner", () => {
    const t = makeWorld(3, 3);
    t.run(0, 0, E, 1);
    t.run(2, 2, W, 1);
    t.run(1, 2, N, 0);
    t.portal(t.at(1, 0), t.at(2, 2));
    const g = makeGame(t, t.at(0, 0), t.at(1, 2));
    const r = stepPlay(g, createPlay(g), E, 0);
    expect(r.outcome).toBe("teleported");
    expect(r.state.cell).toBe(t.at(2, 2));
    expect(r.trail).toEqual([t.at(1, 0), t.at(2, 2)]);
    expect(r.events).toContainEqual({ type: "teleported", pair: 0, from: t.at(1, 0), to: t.at(2, 2) });
    expect(stepPlay(g, r.state, W, 0).state.arrived).toBe(true);
  });

  it("ice slides you across in one input", () => {
    const t = corridor(6);
    t.ice(t.at(1, 0), t.at(2, 0), t.at(3, 0));
    const g = makeGame(t, t.at(0, 0), t.at(5, 0));
    const r = stepPlay(g, createPlay(g), E, 0);
    expect(r.state.cell).toBe(t.at(4, 0));
    expect(r.trail).toHaveLength(4);
    expect(r.events).toContainEqual({ type: "slid", cells: 4 });
    expect(r.state.moves).toBe(1);
  });
});

describe("swirls", () => {
  it("invert left/right for N moves, then wear off", () => {
    const t = corridor(6);
    t.put(t.at(1, 0), { type: "swirl", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(5, 0), { swirls: [{ cell: t.at(1, 0), axes: "x", steps: 2 }] });
    let r = stepPlay(g, createPlay(g), E, 0);
    expect(r.events).toContainEqual({ type: "swirl", axes: "x", steps: 2 });
    expect(r.state.invert).toEqual({ axes: "x", left: 2 });
    r = stepPlay(g, r.state, W, 0); // pressing left goes right
    expect(r.dir).toBe(E);
    expect(r.state.cell).toBe(t.at(2, 0));
    r = stepPlay(g, r.state, W, 0);
    expect(r.state.cell).toBe(t.at(3, 0));
    expect(r.events).toContainEqual({ type: "unswirl" });
    r = stepPlay(g, r.state, W, 0); // back to normal
    expect(r.state.cell).toBe(t.at(2, 0));
  });

  it("blocked inputs don't use up inversion steps", () => {
    const t = corridor(4);
    t.put(t.at(1, 0), { type: "swirl", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(3, 0), { swirls: [{ cell: t.at(1, 0), axes: "xy", steps: 3 }] });
    let s = stepPlay(g, createPlay(g), E, 0).state;
    s = stepPlay(g, s, S, 0).state; // inverted to north → wall
    expect(s.invert?.left).toBe(3);
  });
});

describe("stars and lanterns", () => {
  it("stars count once each", () => {
    const t = corridor(4);
    t.put(t.at(1, 0), { type: "star", index: 0 });
    t.put(t.at(2, 0), { type: "star", index: 2 });
    const g = makeGame(t, t.at(0, 0), t.at(3, 0));
    const { s, events } = walk(g, [E, E, W, E]);
    expect(starCount(s)).toBe(2);
    expect(events.filter((e) => e.type === "star")).toHaveLength(2);
  });

  it("a lantern widens sight until it runs out", () => {
    const t = corridor(9);
    t.put(t.at(1, 0), { type: "lantern", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(8, 0));
    const r = stepPlay(g, createPlay(g, 1000), E, 1000);
    expect(r.events).toContainEqual({ type: "lantern", index: 0, until: 1000 + DIFFICULTIES.easy.lanternSeconds * 1000 });
    expect(r.state.memo[t.at(7, 0)] & SEEN).toBeTruthy(); // 1 + 4 + 2
    // Used up: walking back over it later does nothing.
    const again = stepPlay(g, stepPlay(g, r.state, W, 30_000).state, E, 30_000);
    expect(again.events.some((e) => e.type === "lantern")).toBe(false);
  });
});

describe("generated games are playable end to end", () => {
  for (const level of ["easy", "medium", "hard"] as const) {
    it(`following the solver reaches the exit (${level}, 150 seeds)`, () => {
      for (let i = 0; i < 150; i++) {
        const game = generateGame({ seed: `play-${i}`, level });
        const sol = solve(game, game.start, game.exit);
        let s = createPlay(game);
        for (const d of sol.dirs) {
          // Swirls are self-inverse: press the inverted key to walk `d`.
          const r = stepPlay(game, s, invertDir(d, s.invert?.axes ?? null), 0);
          expect(r.dir).toBe(d);
          expect(r.outcome).not.toBe("fell");
          s = r.state;
        }
        expect(s.arrived, `${level} play-${i}`).toBe(true);
        expect(s.moves).toBe(game.solution.moves);
      }
    });
  }
});
