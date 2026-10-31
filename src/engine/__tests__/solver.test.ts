import { describe, expect, it } from "vitest";
import { solve } from "../solver";
import { makeWorld } from "./helpers";

const E = 1 as const;
const S = 2 as const;

describe("solver", () => {
  it("finds the plain shortest route", () => {
    const t = makeWorld(5, 1);
    t.run(0, 0, E, 4);
    const s = solve(t.world, t.at(0, 0), t.at(4, 0));
    expect(s).toMatchObject({ solvable: true, moves: 4, deadStates: 0 });
    expect(s.route).toEqual([0, 1, 2, 3, 4]);
  });

  it("detours for the key, then opens the door", () => {
    // Row 0: start → door → exit. Key hangs below the start.
    const t = makeWorld(3, 3);
    t.run(0, 0, E, 2);
    t.run(0, 0, S, 2);
    t.put(t.at(1, 0), { type: "door", color: 1 });
    t.put(t.at(0, 2), { type: "key", color: 1 });
    const s = solve(t.world, t.at(0, 0), t.at(2, 0));
    expect(s).toMatchObject({ solvable: true, moves: 6 });
  });

  it("reports a key locked behind its own door as unsolvable", () => {
    const t = makeWorld(4, 1);
    t.run(0, 0, E, 3);
    t.put(t.at(1, 0), { type: "door", color: 0 });
    t.put(t.at(2, 0), { type: "key", color: 0 });
    const s = solve(t.world, t.at(0, 0), t.at(3, 0));
    expect(s.solvable).toBe(false);
    expect(s.reachable[t.at(2, 0)]).toBe(0);
  });

  it("handles key colors above the door count (regression: mask overflow)", () => {
    const t = makeWorld(3, 2);
    t.run(0, 0, E, 2);
    t.run(0, 0, S, 1);
    t.put(t.at(1, 0), { type: "door", color: 2 });
    t.put(t.at(0, 1), { type: "key", color: 2 });
    const s = solve(t.world, t.at(0, 0), t.at(2, 0));
    expect(s).toMatchObject({ solvable: true, moves: 4 });
  });

  it("uses a portal shortcut and records the teleport in the route", () => {
    const t = makeWorld(8, 2);
    t.run(0, 0, E, 7);
    t.run(7, 0, S, 1);
    t.run(0, 1, E, 7);
    t.portal(t.at(1, 1), t.at(6, 0));
    // Walking: 0,0 → 7,0 → 7,1 → 0,1 would be long. Portal from (1,1)? Start at (0,1), exit (7,0).
    const s = solve(t.world, t.at(0, 1), t.at(7, 0));
    expect(s.moves).toBe(2); // step into portal → land at (6,0) → step east
    expect(s.route).toEqual([t.at(0, 1), t.at(1, 1), t.at(6, 0), t.at(7, 0)]);
  });

  it("never routes through a pit", () => {
    const t = makeWorld(3, 2);
    t.run(0, 0, E, 2);
    t.run(0, 1, E, 2);
    t.run(0, 0, S, 1);
    t.run(2, 0, S, 1);
    t.put(t.at(1, 0), { type: "pit" });
    const s = solve(t.world, t.at(0, 0), t.at(2, 0));
    expect(s.moves).toBe(4);
    expect(s.route).not.toContain(t.at(1, 0));
  });

  it("detects soft-locks: an ice strip you can't stop on to get back", () => {
    // Row 0: (0,0) normal, (1..3,0) ice. Start (1,1) below the strip, exit (1,2).
    // Going up onto the strip and sliding away strands you on (0,0)/(3,0).
    const t = makeWorld(4, 3);
    t.run(0, 0, E, 3);
    t.run(1, 0, S, 2);
    t.ice(t.at(1, 0), t.at(2, 0), t.at(3, 0));
    const s = solve(t.world, t.at(1, 1), t.at(1, 2));
    expect(s.solvable).toBe(true);
    expect(s.moves).toBe(1);
    expect(s.deadStates).toBe(2);
  });
});
