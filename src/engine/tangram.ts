import { type Rng, createRng } from "./rng";

/**
 * TANGRAM A CIEGAS (GAME_SPEC_V2.md anexo etapa 4). One player sees a target
 * silhouette (filled, no grid); the other has its pieces, scattered and
 * turned, and rebuilds it on a snapping board from the description.
 *
 * Generation: a compact grid region is grown at random and split into
 * connected pieces by random region growing, so a solution exists by
 * construction. The silhouette is that region, turned and placed at random.
 * Validation is by shape: whatever the pieces on the board cover must equal
 * the silhouette up to translation and turn (any alternative tiling counts).
 *
 * Anti-shortcut rules: no catalog of shapes; pieces never arrive in their
 * solution turn more often than chance; the decoy is drawn like any other
 * piece and shuffled in.
 */

export type Cell = readonly [number, number];
export type Cells = readonly Cell[];

export const TANGRAM_BOARD = 8;
const BOX = 7;
const MAX_PIECE = 6;
/** More tilings than this and the silhouette stops making anyone think. */
export const TANGRAM_MAX_TILINGS = 24;

export type Concavity = "few" | "many";
const REFLEX: Record<Concavity, [number, number]> = { few: [4, 6], many: [7, 10] };
const AREA: Record<number, [number, number]> = { 3: [15, 18], 4: [17, 21], 5: [19, 23] };

export interface TangramPiece {
  /** Cells in the piece's own (native) orientation, normalized. */
  cells: Cells;
  /** Turn it shows up with in the tray (quarter turns, clockwise). */
  trayTurn: number;
  decoy: boolean;
}

export interface TangramTrial {
  /** A: the explorer sees the silhouette, the guide assembles (and dictates a key). B: the reverse. */
  direction: "A" | "B";
  /** Pieces in tray order. */
  pieces: TangramPiece[];
  /** Whether pieces can be turned (if not, they already come in the right turn). */
  turns: boolean;
  decoy: boolean;
  concavity: Concavity;
  /** The silhouette as shown (turned, normalized). */
  silhouette: Cells;
  /** Quarter turns applied to the silhouette (= the solution turn of every piece). */
  turn: number;
  /** Where the silhouette sits inside its TANGRAM_BOARD-wide display frame. */
  offset: [number, number];
  area: number;
  /** Concave corners of the silhouette (corners = 2 × reflex + 4). */
  reflex: number;
  /** One solution: for each non-decoy piece, its turn and board position (silhouette at 0,0). */
  solution: { piece: number; turn: number; x: number; y: number }[];
}

export interface Placement {
  piece: number;
  turn: number;
  x: number;
  y: number;
}

// ── Cell geometry ────────────────────────────────────────────────────────────

const keyOf = (c: Cell) => `${c[0]},${c[1]}`;

export function normalize(cells: Cells): Cell[] {
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of cells) {
    mx = Math.min(mx, x);
    my = Math.min(my, y);
  }
  return cells.map(([x, y]) => [x - mx, y - my] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Quarter turns clockwise (screen coordinates, y down), normalized. */
export function turnCells(cells: Cells, turn: number): Cell[] {
  let out: Cell[] = cells.map((c) => [c[0], c[1]]);
  for (let i = 0; i < ((turn % 4) + 4) % 4; i++) out = out.map(([x, y]) => [-y, x]);
  return normalize(out);
}

const mirrorCells = (cells: Cells) => normalize(cells.map(([x, y]) => [-x, y]));
export const shapeKey = (cells: Cells) => normalize(cells).map(keyOf).join(";");

/** Same shape under turns (and mirrors when `mirror`). */
export function canonicalKey(cells: Cells, mirror = false): string {
  const keys: string[] = [];
  for (const base of mirror ? [cells, mirrorCells(cells)] : [cells]) for (let q = 0; q < 4; q++) keys.push(shapeKey(turnCells(base, q)));
  return keys.sort()[0];
}

function bounds(cells: Cells) {
  let w = 0;
  let h = 0;
  for (const [x, y] of cells) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return { w, h };
}

/**
 * Corner census of a normalized shape: convex/reflex corners and diagonal
 * pinches (two cells touching only at a corner), from the 2×2 window around
 * every lattice vertex.
 */
export function corners(cells: Cells): { convex: number; reflex: number; pinches: number } {
  const set = new Set(cells.map(keyOf));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  const { w, h } = bounds(cells);
  let convex = 0;
  let reflex = 0;
  let pinches = 0;
  for (let vy = 0; vy <= h; vy++) {
    for (let vx = 0; vx <= w; vx++) {
      const a = has(vx - 1, vy - 1);
      const b = has(vx, vy - 1);
      const c = has(vx - 1, vy);
      const d = has(vx, vy);
      const n = +a + +b + +c + +d;
      if (n === 1) convex++;
      else if (n === 3) reflex++;
      else if (n === 2 && a === d) pinches++;
    }
  }
  return { convex, reflex, pinches };
}

/** Empty cells enclosed by the shape. */
export function hasHoles(cells: Cells): boolean {
  const set = new Set(cells.map(keyOf));
  const { w, h } = bounds(cells);
  const seen = new Set<string>();
  const queue: Cell[] = [[-1, -1]];
  seen.add("-1,-1");
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx < -1 || ny < -1 || nx > w || ny > h || seen.has(k) || set.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen.size + set.size < (w + 2) * (h + 2);
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * The outline of a shape as an SVG path (one closed loop per boundary), in
 * cell units: no internal lines, so a silhouette shows no grid.
 */
export function outlinePath(cells: Cells, unit = 1, dx = 0, dy = 0): string {
  const set = new Set(cells.map(keyOf));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  // Directed boundary edges, clockwise around filled cells: from → to.
  const next = new Map<string, Cell[]>();
  const add = (a: Cell, b: Cell) => {
    const k = keyOf(a);
    next.set(k, [...(next.get(k) ?? []), b]);
  };
  for (const [x, y] of cells) {
    if (!has(x, y - 1)) add([x, y], [x + 1, y]);
    if (!has(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
    if (!has(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
    if (!has(x - 1, y)) add([x, y + 1], [x, y]);
  }
  let d = "";
  while (next.size > 0) {
    const startKey = next.keys().next().value as string;
    const [sx, sy] = startKey.split(",").map(Number);
    const loop: Cell[] = [[sx, sy]];
    let at: Cell = [sx, sy];
    for (;;) {
      const k = keyOf(at);
      const outs = next.get(k);
      if (!outs || outs.length === 0) break;
      const to = outs.shift()!;
      if (outs.length === 0) next.delete(k);
      if (to[0] === sx && to[1] === sy) break;
      loop.push(to);
      at = to;
    }
    // Drop collinear points.
    const pts = loop.filter((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length];
      const b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    d += pts.map((p, i) => `${i ? "L" : "M"}${dx + p[0] * unit} ${dy + p[1] * unit}`).join("") + "Z";
  }
  return d;
}

// ── Generation ───────────────────────────────────────────────────────────────

/**
 * Random region: growth that prefers frontier cells touching FEW cells of the
 * region, so shapes come out branchy and varied (plain Eden growth makes
 * round blobs that repeat across seeds).
 */
function growRegion(rng: Rng, area: number): Cell[] {
  const inBox = (x: number, y: number) => x >= 0 && y >= 0 && x < BOX && y < BOX;
  const set = new Set<string>();
  const cells: Cell[] = [];
  const addCell = (c: Cell) => {
    set.add(keyOf(c));
    cells.push(c);
  };
  addCell([3, 3]);
  while (cells.length < area) {
    const frontier = new Map<string, { c: Cell; n: number }>();
    for (const [x, y] of cells) {
      for (const [dx, dy] of NEIGHBORS) {
        const c: Cell = [x + dx, y + dy];
        const k = keyOf(c);
        if (!inBox(c[0], c[1]) || set.has(k)) continue;
        const f = frontier.get(k);
        if (f) f.n++;
        else frontier.set(k, { c, n: 1 });
      }
    }
    const list = [...frontier.values()].sort((a, b) => a.c[1] - b.c[1] || a.c[0] - b.c[0]);
    addCell(list[rng.weighted(list.map((f) => 1 / f.n))].c);
  }
  return normalize(cells);
}

/** Splits `region` into `count` connected pieces of 2..MAX_PIECE cells, or null. */
function splitRegion(rng: Rng, region: Cells, count: number): Cell[][] | null {
  const index = new Map(region.map((c, i) => [keyOf(c), i]));
  const owner = new Array<number>(region.length).fill(-1);
  const nbrs = region.map(([x, y]) => NEIGHBORS.map(([dx, dy]) => index.get(`${x + dx},${y + dy}`)).filter((i): i is number => i !== undefined));
  // Seeds spread out: each next one weighted by squared distance to the others.
  const seeds = [rng.int(region.length)];
  while (seeds.length < count) {
    const w = region.map(([x, y], i) => (seeds.includes(i) ? 0 : Math.min(...seeds.map((s) => Math.abs(region[s][0] - x) + Math.abs(region[s][1] - y))) ** 2));
    seeds.push(rng.weighted(w));
  }
  const sizes = seeds.map(() => 1);
  seeds.forEach((s, p) => (owner[s] = p));
  let left = region.length - count;
  while (left > 0) {
    const open = sizes.map((n, p) => p).filter((p) => sizes[p] < MAX_PIECE && owner.some((o, i) => o === p && nbrs[i].some((j) => owner[j] === -1)));
    if (open.length === 0) return null;
    // Smaller pieces grow first more often, so sizes stay balanced.
    const p = open[rng.weighted(open.map((q) => 1 / sizes[q]))];
    const frontier = region.map((_, i) => i).filter((i) => owner[i] === -1 && nbrs[i].some((j) => owner[j] === p));
    owner[rng.pick(frontier)] = p;
    sizes[p]++;
    left--;
  }
  if (sizes.some((n) => n < 2)) return null;
  return seeds.map((_, p) => region.filter((_, i) => owner[i] === p));
}

/**
 * One candidate: a region of `area` cells with a reflex-corner count in
 * `range`, no holes or pinches, filling ≤ 80 % of its box, split into
 * `count` pieces that are all different (turns and mirrors included).
 */
function cutRegion(rng: Rng, area: number, count: number, range: [number, number]) {
  const region = growRegion(rng, area);
  const { w, h } = bounds(region);
  const cs = corners(region);
  if (cs.pinches > 0 || hasHoles(region) || region.length / (w * h) > 0.8) return null;
  if (cs.reflex < range[0] || cs.reflex > range[1]) return null;
  const split = splitRegion(rng, region, count);
  if (!split || split.some((p) => corners(p).pinches > 0)) return null;
  const canon = split.map((p) => canonicalKey(p, true));
  if (new Set(canon).size !== canon.length) return null;
  return { region, split, reflex: cs.reflex };
}

const cache = new Map<string, TangramTrial>();

export function tangramTrial(key: string, direction: "A" | "B"): TangramTrial {
  const id = `${key}|${direction}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const rng = createRng(`${key}|tangram`);
  const count = rng.range(3, 5);
  const [aMin, aMax] = AREA[count];
  const turns = rng.chance(0.7);
  const decoy = rng.chance(0.4);
  const concavity: Concavity = rng.pick(["few", "many"] as const);
  const [rMin, rMax] = REFLEX[concavity];

  let region: Cell[] = [];
  let parts: Cell[][] = [];
  let reflex = 0;
  let decoyCells: Cell[] | null = null;
  for (let attempt = 0; ; attempt++) {
    // Never loop forever: after many misses accept any reflex count ≥ 2.
    const range: [number, number] = attempt > 400 ? [2, Infinity] : [rMin, rMax];
    const cut = cutRegion(rng, rng.range(aMin, aMax), count, range);
    if (!cut) continue;
    let extra: Cell[] | null = null;
    if (decoy) {
      // A piece of another region cut exactly the same way (same size, same
      // filters), so neither its size nor its shape tells it apart.
      const taken = new Set(cut.split.map((p) => canonicalKey(p, true)));
      for (let tries = 0; tries < 30 && !extra; tries++) {
        const other = cutRegion(rng, cut.region.length, count, range);
        const fits = (other?.split ?? []).filter((p) => !taken.has(canonicalKey(p, true)));
        if (fits.length > 0) extra = normalize(rng.pick(fits));
      }
      if (!extra) continue;
    }
    const pool = extra ? [...cut.split, extra] : cut.split;
    if (countTilings(cut.region, pool, 0, turns, TANGRAM_MAX_TILINGS + 1) > TANGRAM_MAX_TILINGS) continue;
    region = cut.region;
    parts = cut.split;
    decoyCells = extra;
    reflex = cut.reflex;
    break;
  }

  const all: { cells: Cell[]; decoy: boolean; solveAt?: Cell }[] = parts.map((p) => {
    let mx = Infinity;
    let my = Infinity;
    for (const [x, y] of p) {
      mx = Math.min(mx, x);
      my = Math.min(my, y);
    }
    return { cells: normalize(p), decoy: false, solveAt: [mx, my] as Cell };
  });
  if (decoyCells) all.push({ cells: decoyCells, decoy: true });

  const turn = rng.int(4);
  const silhouette = turnCells(region, turn);
  const { w, h } = bounds(silhouette);
  const offset: [number, number] = [rng.int(TANGRAM_BOARD - w + 1), rng.int(TANGRAM_BOARD - h + 1)];
  const order = rng.shuffle(all.map((_, i) => i));
  const pieces: TangramPiece[] = order.map((i) => ({ cells: all[i].cells, trayTurn: turns ? rng.int(4) : turn, decoy: all[i].decoy }));

  // The construction's solution, in silhouette coordinates.
  const regionBounds = bounds(region);
  const solution = order
    .map((i, piece) => ({ i, piece }))
    .filter(({ i }) => !all[i].decoy)
    .map(({ i, piece }) => {
      const [ax, ay] = all[i].solveAt!;
      // Place the native piece at (ax, ay) in the region, then turn the region.
      const placed = all[i].cells.map(([x, y]) => [x + ax, y + ay] as Cell);
      const turned = rotateInBox(placed, regionBounds.w, regionBounds.h, turn);
      let mx = Infinity;
      let my = Infinity;
      for (const [x, y] of turned) {
        mx = Math.min(mx, x);
        my = Math.min(my, y);
      }
      return { piece, turn, x: mx, y: my };
    });

  const trial: TangramTrial = {
    direction,
    pieces,
    turns,
    decoy,
    concavity,
    silhouette,
    turn,
    offset,
    area: region.length,
    reflex,
    solution,
  };
  if (cache.size > 64) cache.clear();
  cache.set(id, trial);
  return trial;
}

/** Turns cells inside a w×h box the same way `turnCells` turns the whole box (keeps relative positions). */
function rotateInBox(cells: Cells, w: number, h: number, turn: number): Cell[] {
  let out: Cell[] = cells.map((c) => [c[0], c[1]]);
  let bw = w;
  let bh = h;
  for (let i = 0; i < turn % 4; i++) {
    out = out.map(([x, y]) => [bh - 1 - y, x]);
    [bw, bh] = [bh, bw];
  }
  return out;
}

// ── Play ─────────────────────────────────────────────────────────────────────

/** Board cells a placement covers. */
export function placedCells(t: TangramTrial, p: Placement): Cell[] {
  return turnCells(t.pieces[p.piece].cells, p.turn).map(([x, y]) => [x + p.x, y + p.y] as Cell);
}

export type TangramCheck = { ready: false; reason: "empty" | "overlap" | "outside" | "turn" } | { ready: true; fits: boolean };

/**
 * What «Comprobar» would say about these placements. Not ready (free, nothing
 * charged) while the board is empty, pieces overlap or stick out. Ready: fits
 * when the covered cells equal the silhouette up to translation and turn.
 */
export function checkTangram(t: TangramTrial, placements: readonly Placement[]): TangramCheck {
  if (placements.length === 0) return { ready: false, reason: "empty" };
  if (new Set(placements.map((p) => p.piece)).size !== placements.length) return { ready: false, reason: "overlap" };
  const covered = new Set<string>();
  for (const p of placements) {
    if (p.piece < 0 || p.piece >= t.pieces.length) return { ready: false, reason: "outside" };
    if (!t.turns && ((p.turn % 4) + 4) % 4 !== t.pieces[p.piece].trayTurn) return { ready: false, reason: "turn" };
    for (const c of placedCells(t, p)) {
      if (c[0] < 0 || c[1] < 0 || c[0] >= TANGRAM_BOARD || c[1] >= TANGRAM_BOARD) return { ready: false, reason: "outside" };
      const k = keyOf(c);
      if (covered.has(k)) return { ready: false, reason: "overlap" };
      covered.add(k);
    }
  }
  const shape = [...covered].map((k) => k.split(",").map(Number) as unknown as Cell);
  return { ready: true, fits: canonicalKey(shape) === canonicalKey(t.silhouette) };
}

export const tangramSolved = (t: TangramTrial, placements: readonly Placement[]) => {
  const c = checkTangram(t, placements);
  return c.ready && c.fits;
};

/**
 * Exact-cover count of the ways the pieces (a subset, when there's a decoy)
 * tile `target`, up to `cap`. `turns` lets pieces turn; otherwise each is
 * used only in turn `fixedTurn`. Placements of congruent turns count once.
 */
export function countTilings(target: Cells, pieces: readonly Cells[], fixedTurn: number, turns: boolean, cap = Infinity): number {
  const index = new Map(target.map((c, i) => [keyOf(c), i]));
  const orients = pieces.map((p) => {
    const seen = new Set<string>();
    const out: Cell[][] = [];
    for (const q of turns ? [0, 1, 2, 3] : [fixedTurn]) {
      const c = turnCells(p, q);
      const k = shapeKey(c);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c);
      }
    }
    return out;
  });
  const filled = new Array<boolean>(target.length).fill(false);
  const used = new Array<boolean>(pieces.length).fill(false);
  let count = 0;
  const go = (left: number) => {
    if (count >= cap) return;
    if (left === 0) {
      count++;
      return;
    }
    const first = filled.indexOf(false);
    const [fx, fy] = target[first];
    for (let p = 0; p < pieces.length; p++) {
      if (used[p]) continue;
      for (const o of orients[p]) {
        // Anchor the orientation's first cell (top-left in reading order) on `first`.
        const [ox, oy] = o[0];
        const cells: number[] = [];
        let ok = true;
        for (const [x, y] of o) {
          const i = index.get(`${x - ox + fx},${y - oy + fy}`);
          if (i === undefined || filled[i] || cells.includes(i)) {
            ok = false;
            break;
          }
          cells.push(i);
        }
        if (!ok) continue;
        used[p] = true;
        for (const i of cells) filled[i] = true;
        go(left - cells.length);
        for (const i of cells) filled[i] = false;
        used[p] = false;
      }
    }
  };
  go(target.length);
  return count;
}
