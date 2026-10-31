import type { DifficultyConfig } from "./difficulty";
import {
  type Grid,
  DIRS,
  bfs,
  bfsMulti,
  carve,
  cellAt,
  cellX,
  cellY,
  degree,
  isOpen,
  manhattan,
  neighbor,
  pathFrom,
} from "./grid";
import type { Rng } from "./rng";
import { type SolveResult, routeEffort, solve } from "./solver";
import type { Theme } from "./themes";
import type { Door, Key, Landmark, Occupant, PortalPair, Rect, Swirl } from "./types";
import { KEY_COLORS, PORTAL_SYMBOLS } from "./types";

/**
 * Placement phases. Each one only puts things on free cells (one occupant per
 * cell, never on ice) and prefers spots that create conversation: keys in side
 * branches, portals at dead ends, pits next to the route the explorer wants.
 *
 * Anything that can change what's reachable (ponds, keys, portals, pits) is
 * validated piece by piece with the real solver and undone if it breaks the
 * game, so whole-attempt retries stay rare.
 */

export class PlacementError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

export interface Build {
  cfg: DifficultyConfig;
  grid: Grid;
  ice: Uint8Array;
  occupant: (Occupant | null)[];
  landmarkCell: Uint8Array;
  ponds: Rect[];
  start: number;
  exit: number;
  mainPath: number[];
  /** Index along the main path, -1 if off it. */
  pathIndex: Int32Array;
  /** Steps to the nearest main-path cell. */
  distToPath: Int32Array;
  distFromStart: Int32Array;
  doors: Door[];
  keys: Key[];
  portals: PortalPair[];
  swirls: Swirl[];
  checkpoints: number[];
  pits: number[];
  stars: number[];
  lanterns: number[];
  landmarks: Landmark[];
  /** Latest solver run on the current layout. */
  solved: SolveResult | null;
  solverCalls: number;
}

export function createBuild(cfg: DifficultyConfig, grid: Grid): Build {
  const n = grid.width * grid.height;
  return {
    cfg,
    grid,
    ice: new Uint8Array(n),
    occupant: new Array<Occupant | null>(n).fill(null),
    landmarkCell: new Uint8Array(n),
    ponds: [],
    start: -1,
    exit: -1,
    mainPath: [],
    pathIndex: new Int32Array(n).fill(-1),
    distToPath: new Int32Array(n),
    distFromStart: new Int32Array(n),
    doors: [],
    keys: [],
    portals: [],
    swirls: [],
    checkpoints: [],
    pits: [],
    stars: [],
    lanterns: [],
    landmarks: [],
    solved: null,
    solverCalls: 0,
  };
}

export function solveBuild(b: Build): SolveResult {
  b.solverCalls++;
  b.solved = solve(
    { grid: b.grid, ice: b.ice, occupant: b.occupant, portals: b.portals },
    b.start,
    b.exit,
  );
  return b.solved;
}

/** Cells that must stay reachable once placed. */
export function mustReach(b: Build): number[] {
  return [
    ...b.keys.map((k) => k.cell),
    ...b.portals.flatMap((p) => [p.a, p.b]),
    ...b.checkpoints,
    ...b.swirls.map((s) => s.cell),
    ...b.stars,
    ...b.lanterns,
  ];
}

/** Full health check: finishable, nothing stranded, no soft-locks. */
function healthy(b: Build, s: SolveResult): boolean {
  return s.solvable && s.deadStates === 0 && mustReach(b).every((c) => s.reachable[c]);
}

const cellCount = (b: Build) => b.grid.width * b.grid.height;
const isFree = (b: Build, c: number) => b.occupant[c] === null && !b.ice[c] && !b.landmarkCell[c];
const reachableNow = (b: Build, c: number) => !b.solved || b.solved.reachable[c] === 1;

function openNeighbors(g: Grid, c: number): number[] {
  const out: number[] = [];
  for (const d of DIRS) if (isOpen(g, c, d)) out.push(neighbor(g, c, d));
  return out;
}

const touchesIce = (b: Build, c: number) => openNeighbors(b.grid, c).some((n) => b.ice[n]);

function pickWeighted(rng: Rng, cands: readonly number[], weight: (c: number) => number): number {
  if (cands.length === 0) return -1;
  return cands[rng.weighted(cands.map(weight))];
}

function allCells(b: Build): number[] {
  return Array.from({ length: cellCount(b) }, (_, i) => i);
}

function farEnough(b: Build, c: number, others: readonly number[], min: number): boolean {
  return others.every((o) => manhattan(b.grid, c, o) >= min);
}

// ── Start, exit, main path ───────────────────────────────────────────────────

/** Start and exit near the two ends of the maze's longest walk. */
export function chooseEnds(b: Build, rng: Rng): void {
  const cands = allCells(b);
  const a = rng.pick(cands);
  const dA = bfs(b.grid, a);
  const maxA = Math.max(...dA);
  const s = rng.pick(cands.filter((c) => dA[c] >= maxA * 0.95));
  const dS = bfs(b.grid, s);
  const maxS = Math.max(...dS);
  const e = rng.pick(cands.filter((c) => dS[c] >= maxS * 0.9));
  [b.start, b.exit] = rng.chance(0.5) ? [s, e] : [e, s];
  b.occupant[b.start] = { type: "start" };
  b.occupant[b.exit] = { type: "exit" };
  computePaths(b);
}

/** Recomputes the plain shortest walk and distance maps (after topology changes). */
export function computePaths(b: Build): void {
  b.distFromStart = bfs(b.grid, b.start);
  b.mainPath = pathFrom(b.grid, b.distFromStart, b.exit);
  b.pathIndex.fill(-1);
  b.mainPath.forEach((c, i) => (b.pathIndex[c] = i));
  b.distToPath = bfsMulti(b.grid, b.mainPath);
}

// ── Ice ponds ────────────────────────────────────────────────────────────────

/**
 * Open rectangles of ice: every inner wall removed, so slides become a little
 * puzzle. Most ponds sit on the main route so they actually get crossed.
 */
export function carvePonds(b: Build, count: number, rng: Rng): void {
  const { width: W, height: H } = b.grid;
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const [w, h] = rng.pick(b.cfg.pondSizes);
      const x = rng.int(W - w + 1);
      const y = rng.int(H - h + 1);
      const overlaps = b.ponds.some(
        (p) => x < p.x + p.w + 1 && x + w + 1 > p.x && y < p.y + p.h + 1 && y + h + 1 > p.y,
      );
      if (overlaps) continue;
      const cells: number[] = [];
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) cells.push(cellAt(b.grid, xx, yy));
      // Keep start/exit (and their doorsteps) off the ice.
      const near = (c: number) => manhattan(b.grid, c, b.start) <= 1 || manhattan(b.grid, c, b.exit) <= 1;
      if (cells.some(near)) continue;
      if (tries < 20 && rng.chance(0.75) && !cells.some((c) => b.pathIndex[c] >= 0)) continue;

      const savedOpen = b.grid.open.slice();
      const prev = b.solved;
      for (const c of cells) {
        b.ice[c] = 1;
        if (cellX(b.grid, c) < x + w - 1) carve(b.grid, c, 1);
        if (cellY(b.grid, c) < y + h - 1) carve(b.grid, c, 2);
      }
      if (healthy(b, solveBuild(b))) {
        b.ponds.push({ x, y, w, h });
        computePaths(b);
        break;
      }
      b.grid.open.set(savedOpen);
      for (const c of cells) b.ice[c] = 0;
      b.solved = prev;
    }
  }
}

// ── Doors & keys ─────────────────────────────────────────────────────────────

export function placeDoorsAndKeys(b: Build, count: number, rng: Rng): void {
  const L = b.mainPath.length;
  const lo = Math.ceil(L * 0.2);
  const hi = Math.floor(L * 0.85);
  const ok = (c: number) => isFree(b, c) && degree(b.grid, c) === 2 && !touchesIce(b, c);
  const isCut = (c: number) => bfs(b.grid, b.start, (x) => x === c)[b.exit] < 0;

  const chosen: number[] = [];
  for (let k = 0; k < count; k++) {
    const segLo = Math.floor(lo + ((hi - lo) * k) / count);
    const segHi = Math.floor(lo + ((hi - lo) * (k + 1)) / count);
    const pool: number[] = [];
    for (let i = segLo; i < segHi; i++) {
      const c = b.mainPath[i];
      if (ok(c) && chosen.every((d) => Math.abs(b.pathIndex[d] - i) >= 4)) pool.push(c);
    }
    // A door that cuts the maze in two can't be walked around: prefer those.
    const cuts = pool.filter(isCut);
    const from = cuts.length > 0 ? cuts : pool;
    if (from.length === 0) continue;
    chosen.push(rng.pick(from));
  }
  chosen.sort((x, y) => b.pathIndex[x] - b.pathIndex[y]);
  const colors = rng.shuffle(KEY_COLORS.map((_, i) => i));
  chosen.forEach((cell, k) => {
    b.doors.push({ cell, color: colors[k] });
    b.occupant[cell] = { type: "door", color: colors[k] };
  });

  // Key k goes where you can get with keys 0..k-1 in hand. Prefer the area
  // door k-1 just opened, and side branches far from the main route.
  for (let k = 0; k < b.doors.length; k++) {
    const shut = (from: number) => (c: number) => b.doors.some((d, i) => i >= from && d.cell === c);
    const region = bfs(b.grid, b.start, shut(k));
    const prev = k > 0 ? bfs(b.grid, b.start, shut(k - 1)) : null;
    let cands = allCells(b).filter((c) => region[c] >= 3 && isFree(b, c));
    const fresh = prev ? cands.filter((c) => prev[c] < 0) : cands;
    if (fresh.length > 0 && rng.chance(0.8)) cands = fresh;
    const weight = (c: number) => 1 + (degree(b.grid, c) === 1 ? 4 : 0) + Math.min(b.distToPath[c], 6);
    let placed = false;
    for (let tries = 0; tries < 12 && cands.length > 0 && !placed; tries++) {
      const cell = pickWeighted(rng, cands, weight);
      cands = cands.filter((c) => c !== cell);
      const prev = b.solved;
      b.keys.push({ cell, color: b.doors[k].color });
      b.occupant[cell] = { type: "key", color: b.doors[k].color };
      if (solveBuild(b).reachable[cell]) {
        placed = true;
      } else {
        b.keys.pop();
        b.occupant[cell] = null;
        b.solved = prev;
      }
    }
    if (!placed) throw new PlacementError("key-unreachable");
  }
  if (b.doors.length > 0 && !healthy(b, solveBuild(b))) throw new PlacementError("doors-break-route");
}

// ── Checkpoints ──────────────────────────────────────────────────────────────

export function placeCheckpoints(b: Build, count: number): void {
  const L = b.mainPath.length;
  const spacing = Math.floor(L / (count + 1));
  for (let k = 1; k <= count; k++) {
    const target = Math.round((k * (L - 1)) / (count + 1));
    // Search outward from the ideal spot, at most half a spacing either way.
    for (let off = 0; off <= spacing; off++) {
      const i = target + (off % 2 === 0 ? off / 2 : -(off + 1) / 2);
      if (i <= 2 || i >= L - 2) continue;
      const c = b.mainPath[i];
      const nextToDoor = openNeighbors(b.grid, c).some((n) => b.occupant[n]?.type === "door");
      if (isFree(b, c) && reachableNow(b, c) && !nextToDoor) {
        b.checkpoints.push(c);
        b.occupant[c] = { type: "checkpoint", index: b.checkpoints.length - 1 };
        break;
      }
    }
  }
  if (b.checkpoints.length < count) throw new PlacementError("few-checkpoints");
}

// ── Portals ──────────────────────────────────────────────────────────────────

/**
 * Pairs prefer dead ends (so they never block a corridor). Half the tries look
 * for "lateral" pairs that link zones at the same progress along the route
 * (handy for stars and keys without gifting the exit); the rest allow real
 * shortcuts. A pair is rejected if it breaks anything or drops the route
 * effort below the level's minimum.
 */
export function placePortals(b: Build, pairs: number, rng: Rng): void {
  const span = b.mainPath.length - 1;
  const minEffort = b.cfg.effort[0];
  const toExit = bfs(b.grid, b.exit);
  const progress = (c: number) => b.distFromStart[c] - toExit[c];
  const symbols = rng.shuffle(PORTAL_SYMBOLS.map((_, i) => i));
  const weight = (c: number) => (degree(b.grid, c) === 1 ? 8 : 1);
  for (let p = 0; p < pairs; p++) {
    const used = b.portals.flatMap((q) => [q.a, q.b]);
    let candsA = allCells(b).filter(
      (c) =>
        isFree(b, c) &&
        reachableNow(b, c) &&
        b.pathIndex[c] < 0 &&
        degree(b.grid, c) <= 2 &&
        b.distFromStart[c] >= 3 &&
        openNeighbors(b.grid, c).every((n) => b.occupant[n] === null && !b.ice[n]) &&
        farEnough(b, c, used, 3),
    );
    for (let tries = 0; tries < 12 && candsA.length > 1; tries++) {
      const a = pickWeighted(rng, candsA, weight);
      candsA = candsA.filter((c) => c !== a);
      const dA = bfs(b.grid, a);
      const lateral = tries % 2 === 0;
      const candsB = candsA.filter(
        (c) =>
          dA[c] >= span * 0.35 &&
          farEnough(b, c, [a], 3) &&
          (!lateral || Math.abs(progress(c) - progress(a)) <= span * 0.3),
      );
      const pb = pickWeighted(rng, candsB, weight);
      if (pb < 0) continue;
      const prev = b.solved;
      const pair = b.portals.length;
      b.portals.push({ a, b: pb, symbol: symbols[pair] });
      b.occupant[a] = { type: "portal", pair, end: 0 };
      b.occupant[pb] = { type: "portal", pair, end: 1 };
      const s = solveBuild(b);
      if (healthy(b, s) && routeEffort(b.grid, b.ice, s) >= minEffort) break;
      b.portals.pop();
      b.occupant[a] = null;
      b.occupant[pb] = null;
      b.solved = prev;
    }
  }
}

// ── Swirls (inverted controls) ───────────────────────────────────────────────

export function placeSwirls(b: Build, count: number, rng: Rng): void {
  const L = b.mainPath.length;
  const minGap = Math.max(4, Math.floor(b.grid.width / 4));
  for (let k = 0; k < count; k++) {
    const cands = allCells(b).filter(
      (c) =>
        isFree(b, c) &&
        reachableNow(b, c) &&
        degree(b.grid, c) === 2 &&
        b.distFromStart[c] >= 4 &&
        (b.pathIndex[c] < 0 || b.pathIndex[c] < L - 3) &&
        farEnough(b, c, b.swirls.map((s) => s.cell), minGap),
    );
    const cell = pickWeighted(rng, cands, (c) => (b.pathIndex[c] >= 0 ? 4 : b.distToPath[c] <= 2 ? 2 : 1));
    if (cell < 0) break;
    b.swirls.push({
      cell,
      axes: rng.chance(b.cfg.swirlBothAxesChance) ? "xy" : "x",
      steps: rng.range(b.cfg.swirlSteps[0], b.cfg.swirlSteps[1]),
    });
    b.occupant[cell] = { type: "swirl", index: b.swirls.length - 1 };
  }
}

// ── Stars & lanterns ─────────────────────────────────────────────────────────

/** Stars hide off the main route, spread apart, ideally at the end of a detour. */
export function placeStars(b: Build, count: number, rng: Rng): void {
  const minGap = Math.max(3, Math.floor(b.grid.width / 3));
  for (let k = 0; k < count; k++) {
    let cell = -1;
    for (let gap = minGap; cell < 0 && gap >= 2; gap--) {
      const cands = allCells(b).filter(
        (c) => isFree(b, c) && reachableNow(b, c) && b.distToPath[c] >= 1 && farEnough(b, c, b.stars, gap),
      );
      cell = pickWeighted(rng, cands, (c) => 1 + 2 * Math.min(b.distToPath[c], 5) + (degree(b.grid, c) === 1 ? 3 : 0));
    }
    if (cell < 0) throw new PlacementError("star-no-room");
    b.stars.push(cell);
    b.occupant[cell] = { type: "star", index: k };
  }
}

/** Lanterns sit near the route (often at junctions), never right at the start. */
export function placeLanterns(b: Build, count: number, rng: Rng): void {
  const L = b.mainPath.length;
  const minGap = Math.max(3, Math.floor(b.grid.width / 3));
  for (let k = 0; k < count; k++) {
    const cands = allCells(b).filter(
      (c) =>
        isFree(b, c) &&
        reachableNow(b, c) &&
        b.distToPath[c] <= 3 &&
        (b.pathIndex[c] < 0 || b.pathIndex[c] > L * 0.15) &&
        farEnough(b, c, [b.start, ...b.lanterns], minGap),
    );
    const cell = pickWeighted(rng, cands, (c) => (degree(b.grid, c) >= 3 ? 3 : 1));
    if (cell < 0) break;
    b.lanterns.push(cell);
    b.occupant[cell] = { type: "lantern", index: k };
  }
}

// ── Pits ─────────────────────────────────────────────────────────────────────

/**
 * Pits go where the explorer is tempted to walk: on the main route when a
 * detour exists, or right beside it. Each pit is kept only if the game stays
 * healthy (solver-checked).
 */
export function placePits(b: Build, count: number, rng: Rng): void {
  const guarded = new Set(["start", "exit", "checkpoint", "door", "portal", "pit"]);
  let cands = allCells(b).filter((c) => {
    if (!isFree(b, c) || !reachableNow(b, c) || b.distFromStart[c] < 3) return false;
    return openNeighbors(b.grid, c).every((n) => !b.ice[n] && !guarded.has(b.occupant[n]?.type ?? ""));
  });
  const weight = (c: number) => {
    const base = b.pathIndex[c] >= 0 ? 6 : b.distToPath[c] <= 2 ? 3 : 1;
    return degree(b.grid, c) === 1 ? base * 0.5 : base;
  };
  let budget = count * 4;
  while (b.pits.length < count && cands.length > 0 && budget-- > 0) {
    const c = pickWeighted(rng, cands, weight);
    cands = cands.filter((x) => x !== c);
    if (openNeighbors(b.grid, c).some((n) => b.occupant[n]?.type === "pit")) continue;
    const prev = b.solved;
    b.occupant[c] = { type: "pit" };
    if (healthy(b, solveBuild(b))) {
      b.pits.push(c);
    } else {
      b.occupant[c] = null;
      b.solved = prev;
    }
  }
}

// ── Landmarks ────────────────────────────────────────────────────────────────

/** One landmark per zone; descriptors never repeat inside a game. */
export function placeLandmarks(b: Build, theme: Theme, rng: Rng): void {
  const { width: W, height: H } = b.grid;
  const zx = Math.max(2, Math.round(W / b.cfg.landmarkZone));
  const zy = Math.max(2, Math.round(H / b.cfg.landmarkZone));
  const kinds = rng.shuffle(theme.landmarks);
  const variantOffset = kinds.map((k) => rng.int(k.variants.length));
  const zones = rng.shuffle(Array.from({ length: zx * zy }, (_, i) => i));
  zones.forEach((zone, j) => {
    const kindIdx = j % kinds.length;
    const kind = kinds[kindIdx];
    const round = Math.floor(j / kinds.length);
    if (round >= kind.variants.length) return; // out of unique descriptors
    const x0 = Math.floor(((zone % zx) * W) / zx);
    const x1 = Math.floor((((zone % zx) + 1) * W) / zx);
    const y0 = Math.floor((Math.floor(zone / zx) * H) / zy);
    const y1 = Math.floor(((Math.floor(zone / zx) + 1) * H) / zy);
    const cx = (x0 + x1 - 1) / 2;
    const cy = (y0 + y1 - 1) / 2;
    const cands: number[] = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const c = cellAt(b.grid, x, y);
        if (isFree(b, c)) cands.push(c);
      }
    }
    // Junctions and dead ends are the spots people remember; centered reads better.
    const cell = pickWeighted(rng, cands, (c) => {
      const off = Math.abs(cellX(b.grid, c) - cx) + Math.abs(cellY(b.grid, c) - cy);
      return 1 + (degree(b.grid, c) !== 2 ? 2 : 0) + Math.max(0, 3 - off / 1.5);
    });
    if (cell < 0) return;
    b.landmarkCell[cell] = 1;
    b.landmarks.push({
      cell,
      zone,
      kind: kind.id,
      label: kind.variants[(variantOffset[kindIdx] + round) % kind.variants.length],
    });
  });
  b.landmarks.sort((p, q) => p.zone - q.zone);
}
