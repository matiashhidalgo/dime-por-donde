import { describe, expect, it } from "vitest";
import { invertDir, resolveMove } from "../rules";
import { makeWorld } from "./helpers";

const E = 1 as const;
const W = 3 as const;
const N = 0 as const;
const S = 2 as const;

describe("walls and doors", () => {
  it("walls block without moving", () => {
    const t = makeWorld(3, 1);
    t.run(0, 0, E, 1);
    expect(resolveMove(t.world, t.at(1, 0), E, 0)).toMatchObject({ outcome: "blocked", to: t.at(1, 0) });
    expect(resolveMove(t.world, t.at(0, 0), E, 0)).toMatchObject({ outcome: "moved", to: t.at(1, 0) });
  });

  it("a locked door blocks until its key is held", () => {
    const t = makeWorld(3, 1);
    t.run(0, 0, E, 2);
    t.put(t.at(1, 0), { type: "door", color: 2 });
    expect(resolveMove(t.world, t.at(0, 0), E, 0)).toMatchObject({ outcome: "locked", lockedColor: 2, to: t.at(0, 0) });
    expect(resolveMove(t.world, t.at(0, 0), E, 0b011)).toMatchObject({ outcome: "locked" });
    expect(resolveMove(t.world, t.at(0, 0), E, 0b100)).toMatchObject({ outcome: "moved", to: t.at(1, 0) });
  });
});

describe("ice", () => {
  it("slides across the ice and stops on the first normal cell", () => {
    const t = makeWorld(6, 1);
    t.run(0, 0, E, 5);
    t.ice(t.at(1, 0), t.at(2, 0), t.at(3, 0));
    const r = resolveMove(t.world, t.at(0, 0), E, 0);
    expect(r).toMatchObject({ outcome: "moved", to: t.at(4, 0), slid: true });
    expect(r.trail).toEqual([1, 2, 3, 4]);
  });

  it("stops on ice when it hits a wall", () => {
    const t = makeWorld(4, 1);
    t.run(0, 0, E, 2);
    t.ice(t.at(1, 0), t.at(2, 0));
    expect(resolveMove(t.world, t.at(0, 0), E, 0)).toMatchObject({ to: t.at(2, 0), slid: true });
  });

  it("stops before a locked door", () => {
    const t = makeWorld(4, 1);
    t.run(0, 0, E, 3);
    t.ice(t.at(1, 0), t.at(2, 0));
    t.put(t.at(3, 0), { type: "door", color: 0 });
    expect(resolveMove(t.world, t.at(0, 0), E, 0)).toMatchObject({ to: t.at(2, 0) });
    expect(resolveMove(t.world, t.at(0, 0), E, 1)).toMatchObject({ to: t.at(3, 0) });
  });

  it("sliding into a pit is a fall", () => {
    const t = makeWorld(4, 1);
    t.run(0, 0, E, 3);
    t.ice(t.at(1, 0), t.at(2, 0));
    t.put(t.at(3, 0), { type: "pit" });
    expect(resolveMove(t.world, t.at(0, 0), E, 0)).toMatchObject({ outcome: "fell", to: t.at(3, 0) });
  });

  it("moving off ice sideways onto ice keeps sliding the new way", () => {
    // 2x3 open pond: from top-left going down slides to the bottom.
    const t = makeWorld(2, 3);
    t.run(0, 0, S, 2);
    t.run(1, 0, S, 2);
    t.run(0, 0, E, 1);
    t.ice(t.at(0, 0), t.at(0, 1), t.at(0, 2));
    expect(resolveMove(t.world, t.at(0, 0), S, 0)).toMatchObject({ to: t.at(0, 2) });
  });
});

describe("portals", () => {
  it("teleports to the partner and stops there; stepping back in returns", () => {
    const t = makeWorld(5, 2);
    t.run(0, 0, E, 4);
    t.run(0, 1, E, 4);
    t.portal(t.at(1, 0), t.at(4, 1));
    const go = resolveMove(t.world, t.at(0, 0), E, 0);
    expect(go).toMatchObject({ outcome: "teleported", to: t.at(4, 1), portal: 0 });
    expect(go.trail).toEqual([t.at(1, 0)]);
    const off = resolveMove(t.world, t.at(4, 1), W, 0);
    expect(off).toMatchObject({ outcome: "moved", to: t.at(3, 1) });
    const back = resolveMove(t.world, t.at(3, 1), E, 0);
    expect(back).toMatchObject({ outcome: "teleported", to: t.at(1, 0) });
  });
});

describe("swirls", () => {
  it("inverts left/right, and up/down too on xy", () => {
    expect(invertDir(E, "x")).toBe(W);
    expect(invertDir(W, "x")).toBe(E);
    expect(invertDir(N, "x")).toBe(N);
    expect(invertDir(N, "xy")).toBe(S);
    expect(invertDir(S, "xy")).toBe(N);
    expect(invertDir(E, null)).toBe(E);
  });
});
