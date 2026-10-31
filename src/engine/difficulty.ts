import type { Level } from "./code";
import type { MazeAlgorithm } from "./maze";

/**
 * Every tunable number lives here. Values marked (calibrar) are first guesses
 * to adjust after real play sessions — see GAME_SPEC.md anexo.
 */

export const OBSTACLE_TYPES = ["pits", "doors", "portals", "ice", "swirls"] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

export type Range = readonly [min: number, max: number];

export interface DifficultyConfig {
  level: Level;
  name: string;
  width: number;
  height: number;
  /** Explorer sight in real steps through open corridors. */
  vision: number;
  /** How visited cells look once out of sight. */
  memory: "full" | "dim" | "none";
  /** Algorithm weights: [backtracker, prim, mixed]. */
  algorithmWeights: Readonly<Record<MazeAlgorithm, number>>;
  /** Fraction of dead ends opened into loops. */
  braid: Range;
  /** How many obstacle types this level uses (pits always included). */
  obstacleTypeCount: Range;
  pits: Range;
  doors: Range;
  portalPairs: Range;
  icePonds: Range;
  /** Pond sizes to choose from: [w, h]. */
  pondSizes: readonly (readonly [number, number])[];
  swirls: Range;
  swirlSteps: Range;
  /** Chance a swirl inverts both axes instead of only left/right. */
  swirlBothAxesChance: number;
  stars: number;
  lanterns: Range;
  lanternBonus: number;
  lanternSeconds: number;
  checkpoints: number;
  /** Landmark zone size (cells); zones = round(width/size) × round(height/size). */
  landmarkZone: number;
  /**
   * Accepted route effort = moves + 2 × decisions (junctions on the best route).
   * Moves alone would reject every Prim maze: short routes, but a choice at
   * almost every cell, and choices are what the pair has to talk through (calibrar).
   */
  effort: Range;
}

export const PIT_PENALTY_SECONDS = 10;
/** Weight of one route decision vs one move in the effort score. */
export const DECISION_WEIGHT = 2;

export const DIFFICULTIES: Record<Level, DifficultyConfig> = {
  easy: {
    level: "easy",
    name: "Fácil",
    width: 12,
    height: 12,
    vision: 4,
    memory: "full",
    algorithmWeights: { backtracker: 3, prim: 2, mixed: 3 },
    braid: [0.15, 0.3],
    obstacleTypeCount: [2, 2],
    pits: [3, 5],
    doors: [1, 1],
    portalPairs: [1, 1],
    icePonds: [1, 1],
    pondSizes: [[3, 3], [3, 2], [2, 3]],
    swirls: [1, 2],
    swirlSteps: [6, 8],
    swirlBothAxesChance: 0,
    stars: 3,
    lanterns: [1, 1],
    lanternBonus: 2,
    lanternSeconds: 20,
    checkpoints: 2,
    landmarkZone: 4,
    effort: [40, 130],
  },
  medium: {
    level: "medium",
    name: "Medio",
    width: 18,
    height: 18,
    vision: 3,
    memory: "dim",
    algorithmWeights: { backtracker: 3, prim: 3, mixed: 3 },
    braid: [0.2, 0.35],
    obstacleTypeCount: [3, 4],
    pits: [7, 10],
    doors: [1, 2],
    portalPairs: [1, 2],
    icePonds: [1, 2],
    pondSizes: [[3, 3], [4, 3], [3, 4]],
    swirls: [2, 3],
    swirlSteps: [8, 10],
    swirlBothAxesChance: 0.3,
    stars: 3,
    lanterns: [2, 2],
    lanternBonus: 2,
    lanternSeconds: 18,
    checkpoints: 3,
    landmarkZone: 5,
    effort: [60, 210],
  },
  hard: {
    level: "hard",
    name: "Difícil",
    width: 26,
    height: 26,
    vision: 3,
    memory: "none",
    algorithmWeights: { backtracker: 3, prim: 3, mixed: 3 },
    braid: [0.25, 0.4],
    obstacleTypeCount: [4, 5],
    pits: [16, 22],
    doors: [2, 3],
    portalPairs: [2, 3],
    icePonds: [2, 3],
    pondSizes: [[3, 3], [4, 3], [3, 4], [4, 4]],
    swirls: [3, 4],
    swirlSteps: [10, 12],
    swirlBothAxesChance: 0.5,
    stars: 3,
    lanterns: [3, 3],
    lanternBonus: 2,
    lanternSeconds: 15,
    checkpoints: 4,
    landmarkZone: 6,
    effort: [90, 340],
  },
};
