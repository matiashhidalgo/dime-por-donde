import type { Level } from "./code";
import type { ObstacleType } from "./difficulty";
import type { Grid } from "./grid";
import type { MazeAlgorithm } from "./maze";
import type { ThemeId } from "./themes";

/** Shapes double as color names so nothing depends on color alone. */
export type Shape = "circle" | "square" | "triangle" | "diamond" | "hexagon";

export interface Symbolic {
  id: string;
  /** Color name as said out loud (feminine/neutral for "llave"/"puerta"). */
  colorName: string;
  shape: Shape;
  shapeName: string;
  hex: string;
}

/** Key/door colors. Index = bit in the key mask. */
export const KEY_COLORS: readonly Symbolic[] = [
  { id: "red", colorName: "roja", shape: "circle", shapeName: "círculo", hex: "#d1495b" },
  { id: "blue", colorName: "azul", shape: "square", shapeName: "cuadrado", hex: "#3d6fd8" },
  { id: "yellow", colorName: "amarilla", shape: "triangle", shapeName: "triángulo", hex: "#e2a72e" },
];

/** Portal symbols: no color shared with keys, so "azul" always means a key. */
export const PORTAL_SYMBOLS: readonly Symbolic[] = [
  { id: "teal", colorName: "turquesa", shape: "triangle", shapeName: "triángulo", hex: "#1f9e9a" },
  { id: "orange", colorName: "naranja", shape: "circle", shapeName: "círculo", hex: "#f08a3c" },
  { id: "pink", colorName: "rosa", shape: "diamond", shapeName: "rombo", hex: "#d6589f" },
];

export type Occupant =
  | { type: "start" }
  | { type: "exit" }
  | { type: "checkpoint"; index: number }
  | { type: "pit" }
  | { type: "door"; color: number }
  | { type: "key"; color: number }
  | { type: "portal"; pair: number; end: 0 | 1 }
  | { type: "swirl"; index: number }
  | { type: "star"; index: number }
  | { type: "lantern"; index: number };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Door {
  cell: number;
  color: number;
}
export interface Key {
  cell: number;
  color: number;
}
export interface PortalPair {
  a: number;
  b: number;
  symbol: number;
}
export interface Swirl {
  cell: number;
  /** "x" swaps left/right only; "xy" also swaps up/down. */
  axes: "x" | "xy";
  steps: number;
}
export interface Landmark {
  cell: number;
  zone: number;
  kind: string;
  label: string;
}

/** The subset of a game the movement rules need. */
export interface World {
  grid: Grid;
  ice: Uint8Array;
  occupant: readonly (Occupant | null)[];
  portals: readonly PortalPair[];
}

export interface Solution {
  /** Minimum number of player inputs from start to exit. */
  moves: number;
  /** Every cell crossed in order, slides and teleports included. */
  route: number[];
}

export interface GameStats {
  attempt: number;
  fallback: boolean;
  failures: Record<string, number>;
  deadEnds: number;
  junctions: number;
  /** Extra passages beyond a spanning tree = independent loops. */
  loops: number;
  braidOpened: number;
  /** Shortest walk ignoring all obstacles (cells). */
  plainPath: number;
  solutionMoves: number;
  solutionCells: number;
  /** Junctions the explorer crosses on the best route = decisions to talk through. */
  routeDecisions: number;
  /** moves + DECISION_WEIGHT × decisions — the number the level range checks. */
  effort: number;
  pits: number;
  doors: number;
  portalPairs: number;
  ponds: number;
  iceCells: number;
  swirls: number;
  stars: number;
  lanterns: number;
  checkpoints: number;
  landmarks: number;
  statesExplored: number;
}

export type TrialKind = "figures" | "lock" | "piano" | "tangram";

/**
 * A v2 station: a seal behind a cooperative trial. Everything about the trial
 * (figures, glyphs, clues, keys) derives from `key`, so it differs per game.
 */
export interface Station {
  index: number;
  cell: number;
  kind: TrialKind;
  /**
   * Who acts. A: the explorer has the information (sees, hears) and the guide
   * acts on their own device, then dictates a seal key. B: the reverse; the
   * explorer's answer opens the seal directly. The lock is always "A" and
   * ignores it (its lights live on the explorer's side).
   */
  direction: "A" | "B";
  key: string;
}

export interface Game {
  version: number;
  level: Level;
  seed: string;
  theme: ThemeId;
  algorithm: MazeAlgorithm;
  obstacleTypes: ObstacleType[];
  grid: Grid;
  ice: Uint8Array;
  occupant: (Occupant | null)[];
  start: number;
  exit: number;
  checkpoints: number[];
  pits: number[];
  doors: Door[];
  keys: Key[];
  portals: PortalPair[];
  ponds: Rect[];
  swirls: Swirl[];
  stars: number[];
  lanterns: number[];
  landmarks: Landmark[];
  /** v2+: the 3 sealed stations (absent on v1 games: just reach the exit). */
  stations?: Station[];
  /** Streak maps only: which map of the streak this is (its MAP level). */
  streak?: { index: number };
  solution: Solution;
  stats: GameStats;
}
