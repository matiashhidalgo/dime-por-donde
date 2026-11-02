import { describe, expect, it } from "vitest";
import { JOYSTICK, clampKnob, joystickDir, readJoystickPrefs } from "../joystick";

const R = 100;

describe("joystickDir: dead zone", () => {
  it("rest and small offsets give no direction", () => {
    expect(joystickDir(0, 0, R, null)).toBeNull();
    expect(joystickDir(24, 0, R, null)).toBeNull();
    expect(joystickDir(0, -24, R, null)).toBeNull();
    expect(joystickDir(17, 17, R, null)).toBeNull(); // hypot ≈ 24
  });
  it("crossing 25 % of the radius starts a direction", () => {
    expect(joystickDir(26, 0, R, null)).toBe(1);
    expect(joystickDir(0, -26, R, null)).toBe(0);
  });
  it("has hysteresis: a held direction survives between 18 % and 25 %", () => {
    expect(joystickDir(21, 0, R, 1)).toBe(1);
    expect(joystickDir(21, 0, R, null)).toBeNull();
    expect(joystickDir(17, 0, R, 1)).toBeNull();
  });
  it("garbage input is no direction", () => {
    expect(joystickDir(NaN, 50, R, null)).toBeNull();
    expect(joystickDir(50, 50, 0, null)).toBeNull();
    expect(joystickDir(Infinity, 0, R, null)).toBeNull();
  });
});

describe("joystickDir: dominant axis", () => {
  it("maps the four axes (screen coordinates: y grows down)", () => {
    expect(joystickDir(0, -60, R, null)).toBe(0);
    expect(joystickDir(60, 0, R, null)).toBe(1);
    expect(joystickDir(0, 60, R, null)).toBe(2);
    expect(joystickDir(-60, 0, R, null)).toBe(3);
  });
  it("picks the stronger axis in a fresh push", () => {
    expect(joystickDir(50, -30, R, null)).toBe(1);
    expect(joystickDir(30, -50, R, null)).toBe(0);
    expect(joystickDir(-30, 50, R, null)).toBe(2);
    expect(joystickDir(-50, 30, R, null)).toBe(3);
  });
});

describe("joystickDir: sector hysteresis (no flicker on diagonals)", () => {
  it("keeps the axis while the other doesn't beat it by the margin", () => {
    // Just past the exact diagonal toward y: still right while coming from right.
    expect(joystickDir(50, -55, R, 1)).toBe(1);
    expect(joystickDir(50, -68, R, 1)).toBe(1);
    // And the other way round.
    expect(joystickDir(55, -50, R, 0)).toBe(0);
    expect(joystickDir(68, -50, R, 0)).toBe(0);
  });
  it("switches once the other axis clearly wins", () => {
    expect(joystickDir(50, -72, R, 1)).toBe(0);
    expect(joystickDir(72, -50, R, 0)).toBe(1);
  });
  it("a wobble around the diagonal never toggles", () => {
    let prev: ReturnType<typeof joystickDir> = joystickDir(60, -40, R, null); // right
    let changes = 0;
    for (let i = 0; i < 200; i++) {
      const a = Math.PI / 4 + Math.sin(i / 3) * 0.14; // ±8° around 45° (the band is ±9.5°)
      const d = joystickDir(Math.cos(a) * 70, -Math.sin(a) * 70, R, prev);
      if (d !== prev) changes++;
      prev = d;
    }
    expect(changes).toBeLessThanOrEqual(1);
  });
  it("changing direction without letting go: right → up → left → down", () => {
    let d = joystickDir(60, 0, R, null);
    expect(d).toBe(1);
    d = joystickDir(10, -70, R, d);
    expect(d).toBe(0);
    d = joystickDir(-70, -10, R, d);
    expect(d).toBe(3);
    d = joystickDir(-5, 70, R, d);
    expect(d).toBe(2);
  });
  it("reverses along the same axis through the dead zone", () => {
    let d = joystickDir(60, 0, R, null);
    d = joystickDir(0, 0, R, d);
    expect(d).toBeNull();
    d = joystickDir(-60, 0, R, d);
    expect(d).toBe(3);
  });
  it("sliding straight from right to left keeps the axis and flips the sign", () => {
    expect(joystickDir(-40, 10, R, 1)).toBe(3);
  });
  it("letting go (back to the center) is no direction", () => {
    expect(joystickDir(0, 0, R, 2)).toBeNull();
  });
});

describe("clampKnob", () => {
  it("leaves short offsets alone and caps long ones on the circle", () => {
    expect(clampKnob(10, -5, 40)).toEqual({ x: 10, y: -5 });
    const c = clampKnob(300, 400, 50);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(50);
    expect(c.x / c.y).toBeCloseTo(0.75);
    expect(clampKnob(0, 0, 40)).toEqual({ x: 0, y: 0 });
  });
  it("travel is farther than the dead zone, so a direction is always reachable", () => {
    expect(JOYSTICK.travel).toBeGreaterThan(JOYSTICK.deadZone);
  });
});

describe("readJoystickPrefs: saved settings and the old D-pad toggle", () => {
  it("defaults: shown on touch screens, off elsewhere; right hand", () => {
    expect(readJoystickPrefs(undefined, undefined, true)).toEqual({ show: true, hand: "right" });
    expect(readJoystickPrefs(undefined, undefined, false)).toEqual({ show: false, hand: "right" });
  });
  it("the old D-pad toggle only decides `show` when there's no new setting", () => {
    expect(readJoystickPrefs(undefined, true, false)).toEqual({ show: true, hand: "right" });
    expect(readJoystickPrefs(undefined, false, true)).toEqual({ show: false, hand: "right" });
    expect(readJoystickPrefs({ show: true, hand: "left" }, false, false)).toEqual({ show: true, hand: "left" });
  });
  it("garbage is ignored without breaking", () => {
    expect(readJoystickPrefs("x", 7, true)).toEqual({ show: true, hand: "right" });
    expect(readJoystickPrefs({ show: "yes", hand: "up" }, null, false)).toEqual({ show: false, hand: "right" });
    expect(readJoystickPrefs(null, { a: 1 }, true)).toEqual({ show: true, hand: "right" });
  });
});
