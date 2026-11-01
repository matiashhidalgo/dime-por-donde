import { describe, expect, it } from "vitest";
import { generateGame } from "../generate";
import { type Dir } from "../grid";
import { createPlay, stepPlay, waitPlay } from "../play";
import {
  type Shadow,
  advanceBody,
  distancesFrom,
  initBodies,
  lapTicks,
  patrolCell,
  routeIndexAt,
  shadowDistance,
  shadowLook,
  shadowWorld,
} from "../shadow";
import { auditShadow, fairLimit, withShadow } from "../shadowaudit";
import { streakGame } from "../streak";
import { TUNING } from "../tuning";
import type { Game } from "../types";
import { makeWorld } from "./helpers";

const E = 1 as const;
const W = 3 as const;

const patrol = (route: number[], extra: Partial<Shadow> = {}): Shadow => ({
  route,
  shape: "ping",
  slow: 1,
  phase: 0,
  hunter: false,
  bodies: 1,
  offset: 0,
  look: "t",
  attempt: 0,
  ...extra,
});

/** A straight corridor of `len` cells with a station-less v2 game around it. */
function corridorGame(len: number, shadow: Shadow | undefined, start = 0, exit = len - 1): Game {
  const t = makeWorld(len, 1);
  t.run(0, 0, E, len - 1);
  t.put(start, { type: "start" });
  t.put(exit, { type: "exit" });
  return {
    ...t.world,
    version: 2,
    level: "hard",
    seed: "corridor",
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
    swirls: [],
    stars: [],
    lanterns: [],
    landmarks: [],
    stations: [],
    shadow,
    solution: { moves: exit - start, route: [] },
    stats: {} as Game["stats"],
  } as Game;
}

describe("La Sombra: the patrol is a function of the clock", () => {
  it("a there-and-back walks the route and returns; a loop closes", () => {
    const ping = patrol([10, 11, 12, 13]);
    expect(lapTicks(ping)).toBe(6);
    expect(Array.from({ length: 8 }, (_, c) => patrolCell(ping, c))).toEqual([10, 11, 12, 13, 12, 11, 10, 11]);
    const loop = patrol([1, 2, 3, 4], { shape: "loop" });
    expect(lapTicks(loop)).toBe(4);
    expect(Array.from({ length: 6 }, (_, c) => patrolCell(loop, c))).toEqual([1, 2, 3, 4, 1, 2]);
  });

  it("slow = 2 moves a cell every other tick; negative clocks wrap", () => {
    const sh = patrol([0, 1, 2, 3], { slow: 2 });
    expect(lapTicks(sh)).toBe(12);
    expect([0, 1, 2, 3, 4, 5].map((c) => routeIndexAt(sh, c))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(routeIndexAt(sh, -1)).toBe(routeIndexAt(sh, 11));
  });

  it("phase decides where body 0 starts; body 1 is half a lap behind", () => {
    const sh = patrol([0, 1, 2, 3, 4, 5], { phase: 3, bodies: 2, offset: 5 });
    const [a, b] = initBodies(sh);
    expect(a.cell).toBe(patrolCell(sh, 3));
    expect(b.cell).toBe(patrolCell(sh, 8));
  });
});

describe("La Sombra: ticks and touches", () => {
  // 30-cell corridor. The Sombra paces 8..14; the explorer starts at 0.
  const game = () => corridorGame(30, patrol([8, 9, 10, 11, 12, 13, 14]));

  it("only steps that go somewhere tick; bumping into a wall does not", () => {
    const g = game();
    let s = createPlay(g);
    expect(s.ticks).toBe(0);
    s = stepPlay(g, s, W).state; // wall on the left of cell 0
    expect(s.ticks).toBe(0);
    s = stepPlay(g, s, E).state;
    expect(s.ticks).toBe(1);
    expect(s.shadow!.bodies[0].cell).toBe(9);
  });

  it("the same inputs always give the same round", () => {
    const g = game();
    const run = () => {
      let s = createPlay(g);
      for (const d of [E, E, E, E, E, W, W, E, E, E] as Dir[]) s = stepPlay(g, s, d).state;
      return JSON.stringify([s.cell, s.hearts, s.light, s.shadow]);
    };
    expect(run()).toBe(run());
  });

  it("a touch costs a heart and part of the candle, then the explorer is immune for a few ticks", () => {
    const g = game();
    let s = createPlay(g);
    const events: string[] = [];
    let touchedAt = -1;
    for (let i = 0; i < 25 && touchedAt < 0; i++) {
      const r = stepPlay(g, s, E);
      s = r.state;
      if (r.events.some((e) => e.type === "shadowTouch")) touchedAt = i;
      events.push(...r.events.map((e) => e.type));
    }
    expect(touchedAt).toBeGreaterThan(0);
    expect(s.hearts).toBe(TUNING.hearts - TUNING.shadow.hurt);
    expect(s.touches).toBe(1);
    expect(s.shadow!.immune).toBe(TUNING.shadow.immune);
    // Light: one per step plus the touch.
    expect(s.light).toBe(s.rules.maxLight - (touchedAt + 1) - Math.round(s.rules.maxLight * TUNING.shadow.lightLoss));
    // No chained hits while immune, even walking straight through the body.
    for (let i = 0; i < TUNING.shadow.immune; i++) {
      const r = stepPlay(g, s, E);
      expect(r.events.some((e) => e.type === "shadowTouch")).toBe(false);
      s = r.state;
    }
    expect(s.touches).toBe(1);
  });

  it("walking into it head-on cannot slip past (crossing swaps count)", () => {
    // Sombra at 5 moving toward the explorer at 4 → the explorer steps to 5 as it steps to 4.
    const g = corridorGame(30, patrol([2, 3, 4, 5, 6, 7], { phase: 3 }), 4, 29);
    const r = stepPlay(g, createPlay(g), E);
    expect(r.events.some((e) => e.type === "shadowTouch")).toBe(true);
  });

  it("waiting is a tick: the candle burns and the Sombra moves; no Sombra → nothing to wait for", () => {
    const g = game();
    const s0 = createPlay(g);
    const r = waitPlay(g, s0);
    expect(r.outcome).toBe("waited");
    expect(r.state.ticks).toBe(1);
    expect(r.state.light).toBe(s0.light - 1);
    expect(r.state.shadow!.bodies[0].cell).toBe(9);
    const none = corridorGame(30, undefined);
    expect(waitPlay(none, createPlay(none)).outcome).toBe("blocked");
  });

  it("the body walks away after a touch and goes back to its route", () => {
    const g = game();
    let s = createPlay(g);
    for (let i = 0; i < 25 && s.touches === 0; i++) s = stepPlay(g, s, E).state;
    expect(s.shadow!.bodies[0].mode).toBe("retreat");
    // The explorer backs off down the corridor; the body walks off, then comes home.
    for (let i = 0; i < 12; i++) s = stepPlay(g, s, W).state;
    expect(s.touches).toBe(1);
    expect(s.shadow!.bodies[0].mode).toBe("patrol");
    expect(g.shadow!.route).toContain(s.shadow!.bodies[0].cell);
  });

  it("a lantern stuns a Sombra that is close, and only then", () => {
    const g = corridorGame(30, patrol([8, 9, 10, 11, 12, 13, 14]));
    g.occupant[3] = { type: "lantern", index: 0 };
    g.lanterns = [3];
    let s = createPlay(g);
    const evs: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = stepPlay(g, s, E);
      s = r.state;
      evs.push(...r.events.map((e) => e.type));
    }
    expect(evs).toContain("shadowStunned"); // 8..14 is within 8 cells of cell 3
    expect(s.shadow!.bodies[0].stun).toBeGreaterThan(0);
    // Far away: nothing.
    const far = corridorGame(60, patrol([40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]));
    far.occupant[3] = { type: "lantern", index: 0 };
    far.lanterns = [3];
    let t = createPlay(far);
    const e2: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = stepPlay(far, t, E);
      t = r.state;
      e2.push(...r.events.map((e) => e.type));
    }
    expect(e2).not.toContain("shadowStunned");
  });

  it("trial actions never tick (they don't go through stepPlay): a state spread keeps the clock", () => {
    const g = game();
    const s = createPlay(g);
    const copy = { ...s };
    expect(copy.shadow).toBe(s.shadow);
  });
});

describe("La Sombra: the hunter", () => {
  const hunter = patrol([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], { hunter: true });

  it("turns toward an explorer within its radius, gives up, and goes home to its route", () => {
    const g = corridorGame(40, hunter);
    const w = shadowWorld(g);
    let b = initBodies(hunter)[0];
    // Explorer stands at 14, four cells from the body at 10: it breaks off its route toward them.
    b = advanceBody(w, hunter, b, 14);
    expect(b.mode).toBe("chase");
    expect(b.cell).toBe(11); // one cell closer to 14 than its start at 10
    // Explorer far away: it stops chasing and returns to the route.
    for (let i = 0; i < 20; i++) b = advanceBody(w, hunter, b, 39);
    expect(b.mode).toBe("patrol");
    expect(hunter.route).toContain(b.cell);
  });

  it("never enters the entrance, the exit or the stations, however hard it hunts", () => {
    const g = corridorGame(40, hunter, 5, 39);
    const w = shadowWorld(g);
    let b = initBodies(hunter)[0];
    for (let i = 0; i < 30; i++) {
      b = advanceBody(w, hunter, b, 5);
      expect(Math.abs(b.cell - 5)).toBeGreaterThan(1);
    }
  });

  it("a hunter's chase is deterministic given the explorer's walk", () => {
    const g = corridorGame(40, hunter);
    const w = shadowWorld(g);
    const run = () => {
      let b = initBodies(hunter)[0];
      for (const e of [14, 14, 15, 16, 17, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]) b = advanceBody(w, hunter, b, e);
      return JSON.stringify(b);
    };
    expect(run()).toBe(run());
  });
});

describe("La Sombra: fairness audit", () => {
  it("a patrol that fills the only corridor cannot be passed: the audit says so", () => {
    const g = corridorGame(30, patrol([8, 9, 10, 11, 12, 13, 14]));
    const a = auditShadow(g);
    expect(a.ok).toBe(false);
    expect(a.reason).toBe("unreachable");
  });

  it("a patrol in a side branch never gets in the way", () => {
    // A T-junction: the corridor 0..20 on row 0, and a spur down from cell 10.
    const t = makeWorld(21, 8);
    t.run(0, 0, E, 20);
    t.run(10, 0, 2, 7);
    t.put(0, { type: "start" });
    t.put(20, { type: "exit" });
    const spur = Array.from({ length: 6 }, (_, i) => t.at(10, i + 2));
    const g = {
      ...t.world,
      version: 2,
      level: "hard",
      seed: "spur",
      theme: "forest",
      algorithm: "backtracker",
      obstacleTypes: [],
      start: 0,
      exit: 20,
      checkpoints: [],
      pits: [],
      doors: [],
      keys: [],
      ponds: [],
      swirls: [],
      stars: [],
      lanterns: [],
      landmarks: [],
      stations: [],
      shadow: patrol(spur),
      solution: { moves: 20, route: [] },
      stats: {} as Game["stats"],
    } as unknown as Game;
    const a = auditShadow(g);
    expect(a.ok).toBe(true);
    expect(a.worstRatio).toBe(1);
  });

  it("the limit is ceil(1.5 × normal) plus the slack", () => {
    expect(fairLimit(20)).toBe(30 + TUNING.shadow.fairSlack);
    expect(fairLimit(7)).toBe(11 + TUNING.shadow.fairSlack);
  });
});

describe("La Sombra on generated maps", () => {
  const games = Array.from({ length: 40 }, (_, i) => generateGame({ seed: `sh${i}`, level: "hard", version: 2 }));

  it("v1 codes never have one; v2 maps have one about two times in three", () => {
    expect(generateGame({ seed: "sh0", level: "hard", version: 1 }).shadow).toBeUndefined();
    const share = games.filter((g) => g.shadow).length / games.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.85);
  });

  it("every map that has one passed the fairness audit; a retry is deterministic", () => {
    for (const g of games) {
      if (!g.shadow) continue;
      const a = auditShadow(g);
      expect(a.ok).toBe(true);
      expect(a.worstRatio).toBeLessThanOrEqual(TUNING.shadow.fairRatio + 0.5);
    }
    const again = generateGame({ seed: "sh3", level: "hard", version: 2 });
    expect(JSON.stringify(again.shadow)).toBe(JSON.stringify(games[3].shadow));
    // withShadow on the same staged map gives the same answer.
    const { shadow: _s, shadowSkip: _k, ...bare } = games.find((g) => g.shadow)!;
    expect(withShadow(bare as Game).shadow).toEqual(games.find((g) => g.shadow)!.shadow);
  });

  it("routes are 12–40 cells of plain floor through passages, away from the entrance, the exit and the stations", () => {
    for (const g of games) {
      const sh = g.shadow;
      if (!sh) continue;
      const w = shadowWorld(g);
      expect(sh.route.length).toBeGreaterThanOrEqual(TUNING.shadow.routeLength[0]);
      expect(sh.route.length).toBeLessThanOrEqual(TUNING.shadow.routeLength[1]);
      expect(new Set(sh.route).size).toBe(sh.route.length);
      for (const c of sh.route) expect(w.allowed[c]).toBe(1);
      const d = distancesFrom(w, sh.route[0]);
      sh.route.forEach((c, i) => {
        if (i > 0) expect(d[c]).toBeGreaterThanOrEqual(1);
      });
      for (let i = 1; i < sh.route.length; i++) expect(distancesFrom(w, sh.route[i - 1])[sh.route[i]]).toBe(1);
      if (sh.shape === "loop") expect(distancesFrom(w, sh.route[sh.route.length - 1])[sh.route[0]]).toBe(1);
      for (const c of [g.start, g.exit, ...g.stations!.map((s) => s.cell)]) {
        const cx = c % g.grid.width;
        const cy = Math.floor(c / g.grid.width);
        for (const r of sh.route) {
          expect(Math.max(Math.abs((r % g.grid.width) - cx), Math.abs(Math.floor(r / g.grid.width) - cy))).toBeGreaterThan(1);
        }
      }
    }
  });

  it("a nearby body is heard: distance by passages", () => {
    const g = games.find((x) => x.shadow)!;
    const s = createPlay(g);
    const d = shadowDistance(g, s.shadow, g.start);
    expect(d).toBeGreaterThan(0);
    expect(shadowDistance(g, null, g.start)).toBe(Infinity);
  });

  it("its look is a procedural silhouette with eyes, stable per game", () => {
    const g = games.find((x) => x.shadow)!;
    const a = shadowLook(g.shadow!);
    expect(a.d.length).toBeGreaterThan(10);
    expect(a.eyes.length).toBeGreaterThan(0);
    expect(shadowLook(g.shadow!)).toBe(a);
  });

  it("a streak raises the odds: later maps have one more often", () => {
    const early = Array.from({ length: 16 }, (_, i) => streakGame(`rs${i}`, 0)).filter((g) => g.shadow).length;
    const late = Array.from({ length: 16 }, (_, i) => streakGame(`rs${i}`, 10)).filter((g) => g.shadow).length;
    expect(late).toBeGreaterThan(early);
  });
});
