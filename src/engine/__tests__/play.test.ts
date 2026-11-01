import { describe, expect, it } from "vitest";
import { generateGame } from "../generate";
import { type Dir, bfs, isOpen, neighbor, DIRS } from "../grid";
import {
  PIT_KNOWN,
  SEEN,
  VISITED,
  type PlayState,
  candleRadius,
  createPlay,
  landingFor,
  landingZone,
  starCount,
  stepPlay,
  visibility,
  visionRadius,
} from "../play";
import { invertDir } from "../rules";
import { solve } from "../solver";
import { TUNING } from "../tuning";
import type { Game, Swirl } from "../types";
import { makeWorld } from "./helpers";

const N = 0 as const;
const E = 1 as const;
const S = 2 as const;
const W = 3 as const;
const MAX = TUNING.candle.max;

/** A hand-built world dressed up as a Game. */
function makeGame(t: ReturnType<typeof makeWorld>, start: number, exit: number, extra: { swirls?: Swirl[]; seed?: string } = {}): Game {
  t.put(start, { type: "start" });
  t.put(exit, { type: "exit" });
  return {
    ...t.world,
    version: 1,
    level: "hard",
    seed: extra.seed ?? "test",
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

const walk = (game: Game, dirs: Dir[], from?: PlayState) => {
  let s = from ?? createPlay(game);
  const events = [];
  for (const d of dirs) {
    const r = stepPlay(game, s, d);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
};

/** Back and forth in a corridor: `n` moves without going anywhere new. */
const pace = (n: number): Dir[] => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? E : W));

describe("walking and arriving", () => {
  it("walls block and don't count as moves or burn light", () => {
    const t = corridor(3);
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const r = stepPlay(g, createPlay(g), N);
    expect(r.outcome).toBe("blocked");
    expect(r.events).toEqual([{ type: "blocked" }]);
    expect(r.state.moves).toBe(0);
    expect(r.state.light).toBe(MAX);
  });

  it("reaching the exit ends the expedition and further input does nothing", () => {
    const t = corridor(3);
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const { s, events } = walk(g, [E, E]);
    expect(s.arrived).toBe(true);
    expect(events).toContainEqual({ type: "arrived" });
    expect(stepPlay(g, s, W).state.cell).toBe(t.at(2, 0));
  });

  it("marks visited cells", () => {
    const t = corridor(4);
    const g = makeGame(t, t.at(0, 0), t.at(3, 0));
    const { s } = walk(g, [E]);
    expect(s.memo[t.at(1, 0)] & VISITED).toBeTruthy();
    expect(s.memo[t.at(2, 0)] & VISITED).toBeFalsy();
  });

  it("starts with every heart and a full candle", () => {
    const t = corridor(3);
    const s = createPlay(makeGame(t, t.at(0, 0), t.at(2, 0)));
    expect(s.hearts).toBe(TUNING.hearts);
    expect(s.light).toBe(MAX);
    expect(visionRadius(s)).toBe(3);
  });
});

describe("sight", () => {
  it("counts real steps and never sees through walls", () => {
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

  it("remembers what was seen with a full candle (3 steps)", () => {
    const t = corridor(8);
    const g = makeGame(t, t.at(0, 0), t.at(7, 0));
    const s = createPlay(g);
    expect(s.memo[t.at(3, 0)] & SEEN).toBeTruthy();
    expect(s.memo[t.at(4, 0)] & SEEN).toBeFalsy();
  });
});

describe("the candle", () => {
  it("shrinks sight 3 → 2 → 1 → dark as it burns", () => {
    expect(candleRadius(MAX)).toBe(3);
    expect(candleRadius(Math.ceil(MAX * 0.5))).toBe(3);
    expect(candleRadius(Math.ceil(MAX * 0.5) - 1)).toBe(2);
    expect(candleRadius(Math.ceil(MAX * 0.25) - 1)).toBe(1);
    expect(candleRadius(1)).toBe(1);
    expect(candleRadius(0)).toBe(0);
  });

  it("burns one unit per move and says when the light drops a level", () => {
    const t = corridor(3);
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const { s, events } = walk(g, pace(Math.floor(MAX / 2) + 1));
    expect(s.light).toBe(MAX - Math.floor(MAX / 2) - 1);
    expect(events).toContainEqual({ type: "dimmed", radius: 2 });
  });

  it("in total darkness you only see your own cell", () => {
    const t = corridor(3);
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const { s, events } = walk(g, pace(MAX));
    expect(s.light).toBe(0);
    expect(visionRadius(s)).toBe(0);
    expect(events).toContainEqual({ type: "darkness" });
    expect(events.filter((e) => e.type === "darkness")).toHaveLength(1);
  });

  it("too long in the dark costs a heart and relights it partway", () => {
    const t = corridor(3);
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const grace = walk(g, pace(MAX + TUNING.candle.darkGrace));
    expect(grace.s.hearts).toBe(TUNING.hearts); // still within the grace
    const { s, events } = walk(g, pace(1), grace.s);
    expect(events).toContainEqual({ type: "burnout" });
    expect(events).toContainEqual({ type: "hurt", cause: "dark", hearts: TUNING.hearts - 1 });
    expect(s.light).toBe(Math.round(MAX * TUNING.candle.relight));
    expect(s.dark).toBe(0);
  });

  it("a lantern fills it once; a route candle tops it up once", () => {
    const t = corridor(5);
    t.put(t.at(1, 0), { type: "lantern", index: 0 });
    t.put(t.at(3, 0), { type: "checkpoint", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(4, 0));
    const low = { ...createPlay(g), light: 5 };
    let r = stepPlay(g, low, E);
    expect(r.events).toContainEqual({ type: "lantern", index: 0 });
    expect(r.state.light).toBe(MAX);
    // Used up: walking back over it later does nothing.
    const back = walk(g, [W, E], { ...r.state, light: 5 });
    expect(back.events.some((e) => e.type === "lantern")).toBe(false);
    expect(back.s.light).toBe(3);
    r = stepPlay(g, stepPlay(g, back.s, E).state, E);
    expect(r.events).toContainEqual({ type: "candle", index: 0 });
    expect(r.state.light).toBe(1 + Math.round(MAX * TUNING.candle.candleRefill));
  });

  it("stepping onto a lantern while in the dark saves you", () => {
    const t = corridor(3);
    t.put(t.at(1, 0), { type: "lantern", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(2, 0));
    const dark = { ...createPlay(g), light: 0, dark: TUNING.candle.darkGrace };
    const r = stepPlay(g, dark, E);
    expect(r.state.hearts).toBe(TUNING.hearts);
    expect(r.state.dark).toBe(0);
    expect(r.state.light).toBe(MAX);
  });
});

describe("pits", () => {
  /** A 24×3 comb: long top corridor, teeth going down — room to land far away. */
  function comb() {
    const t = makeWorld(24, 3);
    t.run(0, 0, E, 23);
    for (let x = 0; x < 24; x += 2) t.run(x, 0, S, 2);
    return t;
  }

  it("costs a heart and the keys, and drops you far away", () => {
    const t = comb();
    t.put(t.at(1, 0), { type: "key", color: 0 });
    t.put(t.at(3, 0), { type: "pit" });
    const g = makeGame(t, t.at(0, 0), t.at(23, 0));
    const { s, events } = walk(g, [E, E, E]);
    const fell = events.find((e) => e.type === "fell");
    expect(fell).toMatchObject({ type: "fell", pit: t.at(3, 0), keysLost: 1 });
    expect(events).toContainEqual({ type: "hurt", cause: "pit", hearts: TUNING.hearts - 1 });
    expect(s.keys).toBe(0);
    expect(s.pits).toBe(1);
    expect(s.cell).toBe(fell!.type === "fell" ? fell!.landing : -1);
    expect(s.memo[t.at(3, 0)] & PIT_KNOWN).toBeTruthy();
    // Far: at least as far from the pit as most of the floor.
    const dist = bfs(g.grid, t.at(3, 0));
    const zone = Array.from(landingZone(g));
    const fartherOrEqual = zone.filter((c) => dist[c] <= dist[s.cell]).length / zone.length;
    expect(fartherOrEqual).toBeGreaterThanOrEqual(1 - TUNING.pit.farFraction - 0.01);
  });

  it("landing spots are deterministic and never repeat", () => {
    const t = comb();
    t.put(t.at(5, 0), { type: "pit" });
    const g = makeGame(t, t.at(0, 0), t.at(23, 0), { seed: "LAND" });
    const used: number[] = [];
    for (let i = 0; i < 4; i++) {
      const c = landingFor(g, t.at(5, 0), i, used);
      expect(used).not.toContain(c);
      expect(landingFor(g, t.at(5, 0), i, used)).toBe(c); // same on every device
      used.push(c);
    }
  });

  it("zero hearts ends the expedition and freezes input", () => {
    const t = comb();
    t.put(t.at(1, 0), { type: "pit" });
    const g = makeGame(t, t.at(0, 0), t.at(23, 0));
    const last = { ...createPlay(g), hearts: 1 };
    const r = stepPlay(g, last, E);
    expect(r.state.hearts).toBe(0);
    expect(r.state.lost).toBe(true);
    expect(r.events).toContainEqual({ type: "defeat", cause: "pit" });
    expect(stepPlay(g, r.state, E).state).toBe(r.state);
  });

  it("generated maps: landing floor is plain, away from pits and the exit, and keyless-solvable", () => {
    for (let i = 0; i < 40; i++) {
      const game = generateGame({ seed: `land-${i}`, level: "hard" });
      const zone = Array.from(landingZone(game));
      expect(zone.length, `land-${i}`).toBeGreaterThan(40);
      const toExit = bfs(game.grid, game.exit);
      for (const c of zone) {
        expect(game.occupant[c]).toBeNull();
        expect(game.ice[c]).toBe(0);
        expect(toExit[c]).toBeGreaterThanOrEqual(TUNING.pit.exitMargin);
        for (const d of DIRS) if (isOpen(game.grid, c, d)) expect(game.occupant[neighbor(game.grid, c, d)]?.type).not.toBe("pit");
      }
      // A few seeded samples really can finish from there with no keys.
      for (let k = 0; k < 3; k++) {
        const c = landingFor(game, game.pits[k % game.pits.length], k, []);
        expect(solve(game, c, game.exit).solvable, `land-${i} → ${c}`).toBe(true);
      }
    }
  });
});

describe("keys and doors", () => {
  it("a door blocks without moving until you pick up its key", () => {
    const t = corridor(5);
    t.put(t.at(1, 0), { type: "key", color: 1 });
    t.put(t.at(3, 0), { type: "door", color: 1 });
    const g = makeGame(t, t.at(2, 0), t.at(4, 0));
    let s = createPlay(g);
    const locked = stepPlay(g, s, E);
    expect(locked.outcome).toBe("locked");
    expect(locked.events).toEqual([{ type: "locked", color: 1, cell: t.at(3, 0) }]);
    expect(locked.state.moves).toBe(0);
    const got = stepPlay(g, s, W);
    expect(got.events).toContainEqual({ type: "key", color: 1 });
    s = got.state;
    expect(s.keys).toBe(0b10);
    s = stepPlay(g, s, E).state;
    s = stepPlay(g, s, E).state;
    expect(s.cell).toBe(t.at(3, 0));
    expect(stepPlay(g, s, E).state.arrived).toBe(true);
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
    const r = stepPlay(g, createPlay(g), E);
    expect(r.outcome).toBe("teleported");
    expect(r.state.cell).toBe(t.at(2, 2));
    expect(r.trail).toEqual([t.at(1, 0), t.at(2, 2)]);
    expect(r.events).toContainEqual({ type: "teleported", pair: 0, from: t.at(1, 0), to: t.at(2, 2) });
    expect(stepPlay(g, r.state, W).state.arrived).toBe(true);
  });

  it("ice slides you across in one input (one unit of light)", () => {
    const t = corridor(6);
    t.ice(t.at(1, 0), t.at(2, 0), t.at(3, 0));
    const g = makeGame(t, t.at(0, 0), t.at(5, 0));
    const r = stepPlay(g, createPlay(g), E);
    expect(r.state.cell).toBe(t.at(4, 0));
    expect(r.trail).toHaveLength(4);
    expect(r.events).toContainEqual({ type: "slid", cells: 4 });
    expect(r.state.moves).toBe(1);
    expect(r.state.light).toBe(MAX - 1);
  });
});

describe("swirls", () => {
  it("invert left/right for steps × factor moves, then wear off", () => {
    const t = corridor(8);
    t.put(t.at(1, 0), { type: "swirl", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(7, 0), { swirls: [{ cell: t.at(1, 0), axes: "x", steps: 2 }] });
    const steps = Math.round(2 * TUNING.swirl.stepsFactor);
    let r = stepPlay(g, createPlay(g), E);
    expect(r.events).toContainEqual({ type: "swirl", axes: "x", steps });
    expect(r.state.invert).toEqual({ axes: "x", left: steps });
    for (let i = 0; i < steps; i++) {
      r = stepPlay(g, r.state, W); // pressing left goes right
      expect(r.dir).toBe(E);
    }
    expect(r.events).toContainEqual({ type: "unswirl" });
    const cell = r.state.cell;
    r = stepPlay(g, r.state, W); // back to normal
    expect(r.state.cell).toBe(cell - 1);
  });

  it("thickens the fog while it lasts", () => {
    const t = corridor(6);
    t.put(t.at(1, 0), { type: "swirl", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(5, 0), { swirls: [{ cell: t.at(1, 0), axes: "xy", steps: 4 }] });
    const r = stepPlay(g, createPlay(g), E);
    expect(visionRadius(r.state)).toBe(3 - TUNING.swirl.fog);
    expect(visionRadius({ ...r.state, light: 1 })).toBe(1); // never blind while the candle burns
  });

  it("blocked inputs don't use up inversion steps", () => {
    const t = corridor(4);
    t.put(t.at(1, 0), { type: "swirl", index: 0 });
    const g = makeGame(t, t.at(0, 0), t.at(3, 0), { swirls: [{ cell: t.at(1, 0), axes: "xy", steps: 3 }] });
    let s = stepPlay(g, createPlay(g), E).state;
    const left = s.invert!.left;
    s = stepPlay(g, s, S).state; // inverted to north → wall
    expect(s.invert?.left).toBe(left);
  });
});

describe("stars", () => {
  it("count once each", () => {
    const t = corridor(4);
    t.put(t.at(1, 0), { type: "star", index: 0 });
    t.put(t.at(2, 0), { type: "star", index: 2 });
    const g = makeGame(t, t.at(0, 0), t.at(3, 0));
    const { s, events } = walk(g, [E, E, W, E]);
    expect(starCount(s)).toBe(2);
    expect(events.filter((e) => e.type === "star")).toHaveLength(2);
  });
});

describe("generated games are playable end to end", () => {
  for (const level of ["easy", "medium", "hard"] as const) {
    it(`following the solver reaches the exit (${level}, 150 seeds)`, () => {
      for (let i = 0; i < 150; i++) {
        const game = generateGame({ seed: `play-${i}`, level, version: 1 });
        const sol = solve(game, game.start, game.exit);
        let s = createPlay(game);
        for (const d of sol.dirs) {
          // Swirls are self-inverse: press the inverted key to walk `d`.
          // Light is topped up: this checks movement, not the candle budget.
          const r = stepPlay(game, { ...s, light: MAX }, invertDir(d, s.invert?.axes ?? null));
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
