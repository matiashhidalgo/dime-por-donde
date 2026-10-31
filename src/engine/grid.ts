/**
 * Grid primitives. A cell is a number: index = y * width + x.
 * Walls live between cells; each cell stores a bitmask of OPEN sides.
 * Up is up and left is left in every view: y grows downward, x rightward.
 */

export type Dir = 0 | 1 | 2 | 3; // N E S W
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const BIT = [1, 2, 4, 8] as const;
export const OPPOSITE: readonly Dir[] = [2, 3, 0, 1];
export const DIR_NAMES = ["arriba", "derecha", "abajo", "izquierda"] as const;

export interface Grid {
  width: number;
  height: number;
  /** Open-side bitmask per cell (BIT[dir] set = passage open that way). */
  open: Uint8Array;
}

export function createGrid(width: number, height: number): Grid {
  return { width, height, open: new Uint8Array(width * height) };
}

export const cellX = (g: Grid, c: number) => c % g.width;
export const cellY = (g: Grid, c: number) => Math.floor(c / g.width);
export const cellAt = (g: Grid, x: number, y: number) => y * g.width + x;

/** Neighbor index in a direction, or -1 when off the board. */
export function neighbor(g: Grid, c: number, d: Dir): number {
  const x = (c % g.width) + DX[d];
  const y = Math.floor(c / g.width) + DY[d];
  if (x < 0 || y < 0 || x >= g.width || y >= g.height) return -1;
  return y * g.width + x;
}

export const isOpen = (g: Grid, c: number, d: Dir) => (g.open[c] & BIT[d]) !== 0;

export function carve(g: Grid, c: number, d: Dir): void {
  const n = neighbor(g, c, d);
  if (n < 0) throw new Error("carve off board");
  g.open[c] |= BIT[d];
  g.open[n] |= BIT[OPPOSITE[d]];
}

export function degree(g: Grid, c: number): number {
  const m = g.open[c];
  return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
}

/** Column letter(s) + 1-based row: (0,0) → "A1". Columns past Z become AA, AB… */
export function cellLabel(g: Grid, c: number): string {
  return `${columnLabel(cellX(g, c))}${cellY(g, c) + 1}`;
}

export function columnLabel(x: number): string {
  let s = "";
  let n = x;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Plain BFS over open passages. `blocked(c)` cells are never entered.
 * Returns distances (-1 = unreachable).
 */
export function bfs(g: Grid, from: number, blocked?: (c: number) => boolean): Int32Array {
  const dist = new Int32Array(g.width * g.height).fill(-1);
  const queue = new Int32Array(g.width * g.height);
  let head = 0;
  let tail = 0;
  dist[from] = 0;
  queue[tail++] = from;
  while (head < tail) {
    const c = queue[head++];
    for (const d of DIRS) {
      if (!isOpen(g, c, d)) continue;
      const n = neighbor(g, c, d);
      if (dist[n] >= 0 || blocked?.(n)) continue;
      dist[n] = dist[c] + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

/** BFS distance to the nearest of several sources (e.g. "how far from the main path"). */
export function bfsMulti(g: Grid, sources: readonly number[]): Int32Array {
  const dist = new Int32Array(g.width * g.height).fill(-1);
  const queue = new Int32Array(g.width * g.height);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    if (dist[s] >= 0) continue;
    dist[s] = 0;
    queue[tail++] = s;
  }
  while (head < tail) {
    const c = queue[head++];
    for (const d of DIRS) {
      if (!isOpen(g, c, d)) continue;
      const n = neighbor(g, c, d);
      if (dist[n] >= 0) continue;
      dist[n] = dist[c] + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

/** Shortest walk from `from` to `to` (inclusive) using a distance map from `from`. */
export function pathFrom(g: Grid, dist: Int32Array, to: number): number[] {
  if (dist[to] < 0) return [];
  const path = [to];
  let c = to;
  while (dist[c] > 0) {
    for (const d of DIRS) {
      if (!isOpen(g, c, d)) continue;
      const n = neighbor(g, c, d);
      if (dist[n] === dist[c] - 1) {
        c = n;
        break;
      }
    }
    path.push(c);
  }
  return path.reverse();
}

export function manhattan(g: Grid, a: number, b: number): number {
  return Math.abs(cellX(g, a) - cellX(g, b)) + Math.abs(cellY(g, a) - cellY(g, b));
}
