/**
 * Pure logic of the on-screen joystick: a finger vector → one of the grid's
 * four directions (or none). No DOM here, so it is easy to test.
 *
 * The maze is a grid, so the analog stick is read as a D-pad with two
 * protections against flicker:
 *  - a dead zone (enter at 25 % of the base radius, leave at 18 %), so a thumb
 *    resting near the center doesn't walk;
 *  - sector hysteresis: while the stick points along an axis it keeps that
 *    axis until the other one clearly wins, so wobbling around a diagonal
 *    doesn't toggle between two directions.
 */

import type { Dir } from "@/src/engine";

export const JOYSTICK = {
  /** Dead zone, as a share of the base radius. */
  deadZone: 0.25,
  /** Once moving, the stick has to fall under this share of the radius to stop. */
  releaseZone: 0.18,
  /** To change axis the new axis must beat the current one by this factor. */
  axisSwitch: 1.4,
  /** How far the knob may travel from the center, as a share of the base radius. */
  travel: 0.48,
} as const;

/**
 * Direction for a finger offset (dx, dy) from the stick's center, in pixels
 * (y grows downward, as on screen). `radius` is the base's radius. `prev` is
 * the direction currently held, for hysteresis.
 * 0 = up, 1 = right, 2 = down, 3 = left (the engine's `Dir`).
 */
export function joystickDir(dx: number, dy: number, radius: number, prev: Dir | null): Dir | null {
  if (!(radius > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const dist = Math.hypot(dx, dy);
  const zone = (prev === null ? JOYSTICK.deadZone : JOYSTICK.releaseZone) * radius;
  if (dist < zone) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const horizontal = (d: Dir) => d === 1 || d === 3;
  const fromX: Dir = dx >= 0 ? 1 : 3;
  const fromY: Dir = dy >= 0 ? 2 : 0;
  if (prev === null) return ax > ay ? fromX : fromY;
  // Keep the current axis until the other one clearly wins.
  return horizontal(prev) ? (ay > ax * JOYSTICK.axisSwitch ? fromY : fromX) : ax > ay * JOYSTICK.axisSwitch ? fromX : fromY;
}

/** The knob's offset: the finger's, held inside `max` pixels of the center. */
export function clampKnob(dx: number, dy: number, max: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (!(d > max) || d === 0) return { x: dx, y: dy };
  const k = max / d;
  return { x: dx * k, y: dy * k };
}

export type Hand = "left" | "right";

export interface JoystickPrefs {
  /** Show the stick on screen. */
  show: boolean;
  /** Which hand drives it: the stick sits on that side, «Esperar» on the other. */
  hand: Hand;
}

/**
 * Saved settings → safe values. `saved` is whatever was stored (anything);
 * `legacyPad` is the old D-pad toggle (`laberinto.dpad.v1`): it only decides
 * `show` when no new setting exists, and anything unreadable is ignored.
 */
export function readJoystickPrefs(saved: unknown, legacyPad: unknown, coarse: boolean): JoystickPrefs {
  const o = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  const hand: Hand = o.hand === "left" ? "left" : "right";
  const show = typeof o.show === "boolean" ? o.show : typeof legacyPad === "boolean" ? legacyPad : coarse;
  return { show, hand };
}
