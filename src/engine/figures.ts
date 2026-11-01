import { type Part, type Pt, circle, orient, toPath } from "./geometry";
import { type Rng, createRng } from "./rng";

/**
 * FIGURAS RARAS (GAME_SPEC_V2.md §4, anexo etapa 2). One player sees a weird
 * figure and describes it without names; the other has 9–12 look-alikes and
 * picks one.
 *
 * Anti-shortcut rule: the candidates are INDEPENDENT perturbations of a
 * family center that is never shown, and the correct one is drawn uniformly
 * AFTER the set exists. The candidates are exchangeable, so nothing that
 * looks only at the set (most central, biggest, first, last…) beats 1/N.
 *
 * A figure is a closed polar curve r(θ): k lobes (round or pointy), two low
 * harmonics for asymmetry, one notch, and 0–2 holes. Distances are measured
 * on a 32×32 raster (1 − IoU) and every pair of candidates must be similar
 * but distinguishable, even allowing for rotations and mirrors (the target
 * is sometimes shown turned).
 */

export interface FigureParams {
  lobes: number;
  /** Lobe shape exponent: < 1 puffy, > 1 pointy. */
  sharp: number;
  amp: number;
  phase: number;
  h2: number;
  p2: number;
  h3: number;
  p3: number;
  notchAt: number;
  notchDepth: number;
  holes: { at: number; dist: number; r: number }[];
}

export type Similarity = "low" | "mid" | "high";

export interface FiguresTrial {
  /** A: the explorer sees the target, the guide picks (and dictates a key). B: the reverse. */
  direction: "A" | "B";
  /** Candidate paths, in display order. */
  candidates: string[];
  correct: number;
  /** The target as the describer sees it (possibly turned or mirrored). */
  target: string;
  /** Quarter turns and mirror applied to the target. */
  turn: number;
  mirror: boolean;
  similarity: Similarity;
  holes: boolean;
  /** Raw parameters, display order (tests and the simulation only). */
  params: FigureParams[];
}

export const FIGURE_RASTER = 32;
/** Pairwise distance bounds (1 − IoU on the raster, best over the 8 turns/mirrors). */
export const FIGURE_DISTANCE = { min: 0.07, max: 0.42 } as const;
const NOISE: Record<Similarity, number> = { low: 1.25, mid: 1, high: 0.75 };
const CURVE_POINTS = 96;

export function figureRadius(p: FigureParams, theta: number): number {
  const lobe = ((1 + Math.cos(p.lobes * (theta - p.phase))) / 2) ** p.sharp; // 0..1
  let d = theta - p.notchAt;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const notch = p.notchDepth * Math.exp(-((d / 0.32) ** 2));
  const r = 0.5 + p.amp * (2 * lobe - 1) + p.h2 * Math.cos(2 * theta + p.p2) + p.h3 * Math.cos(3 * theta + p.p3) - notch;
  return Math.max(0.22, Math.min(0.95, r));
}

function holeCenter(h: { at: number; dist: number }): Pt {
  return [Math.cos(h.at) * h.dist, Math.sin(h.at) * h.dist];
}

export function figureParts(p: FigureParams): Part[] {
  const outline: Pt[] = [];
  for (let i = 0; i < CURVE_POINTS; i++) {
    const t = (Math.PI * 2 * i) / CURVE_POINTS;
    const r = figureRadius(p, t);
    outline.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  return [{ poly: outline }, ...p.holes.map((h) => ({ poly: circle(...holeCenter(h), h.r, 16), hole: true }))];
}

export const figurePath = (p: FigureParams, turn = 0, mirror = false) => toPath(orient(figureParts(p), turn, mirror));

/** 1 = inside, row-major, pixel centers on a symmetric grid (so turns map pixels to pixels). */
export function figureRaster(p: FigureParams, n = FIGURE_RASTER): Uint8Array {
  const out = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    const y = ((j + 0.5) / n) * 2 - 1;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1;
      const rr = Math.hypot(x, y);
      if (rr > 0.96 || rr > figureRadius(p, Math.atan2(y, x))) continue;
      let inHole = false;
      for (const h of p.holes) {
        const [hx, hy] = holeCenter(h);
        if ((x - hx) ** 2 + (y - hy) ** 2 < h.r * h.r) inHole = true;
      }
      if (!inHole) out[j * n + i] = 1;
    }
  }
  return out;
}

/** The raster turned by quarter turns / mirrored, same convention as `orient`. */
export function transformRaster(a: Uint8Array, turn: number, mirror: boolean, n = FIGURE_RASTER): Uint8Array {
  const out = new Uint8Array(n * n);
  const q = ((turn % 4) + 4) % 4;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let x = mirror ? n - 1 - i : i;
      let y = j;
      for (let k = 0; k < q; k++) [x, y] = [n - 1 - y, x];
      out[y * n + x] = a[j * n + i];
    }
  }
  return out;
}

export function rasterDistance(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    inter += a[i] & b[i];
    union += a[i] | b[i];
  }
  return union === 0 ? 0 : 1 - inter / union;
}

/** Distance allowing the chooser to turn or mirror one of them. */
export function turnedDistance(a: Uint8Array, b: Uint8Array): number {
  let best = 1;
  for (const mirror of [false, true]) for (let t = 0; t < 4; t++) best = Math.min(best, rasterDistance(transformRaster(a, t, mirror), b));
  return best;
}

export const rasterArea = (a: Uint8Array) => a.reduce((s, v) => s + v, 0);

/** 32×32 raster → 32 words (one per row), for fast popcount distances. */
function pack(a: Uint8Array): Uint32Array {
  const out = new Uint32Array(FIGURE_RASTER);
  for (let j = 0; j < FIGURE_RASTER; j++) {
    let w = 0;
    for (let i = 0; i < FIGURE_RASTER; i++) if (a[j * FIGURE_RASTER + i]) w |= 1 << i;
    out[j] = w >>> 0;
  }
  return out;
}

function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function packedDistance(a: Uint32Array, b: Uint32Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    inter += popcount(a[i] & b[i]);
    union += popcount(a[i] | b[i]);
  }
  return union === 0 ? 0 : 1 - inter / union;
}

/** The 8 turns/mirrors of a raster, packed. Index 0 is the raster itself. */
function packedTurns(a: Uint8Array): Uint32Array[] {
  const out: Uint32Array[] = [];
  for (const mirror of [false, true]) for (let t = 0; t < 4; t++) out.push(pack(transformRaster(a, t, mirror)));
  return out;
}

// ── Generation ───────────────────────────────────────────────────────────────

function familyCenter(rng: Rng, holes: boolean): FigureParams {
  const nHoles = holes ? rng.range(1, 2) : 0;
  const base: FigureParams = {
    lobes: rng.range(3, 7),
    sharp: rng.pick([0.45, 0.8, 1.6, 3]),
    amp: 0.1 + rng.next() * 0.16,
    phase: rng.next() * Math.PI * 2,
    h2: rng.next() * 0.09,
    p2: rng.next() * Math.PI * 2,
    h3: rng.next() * 0.07,
    p3: rng.next() * Math.PI * 2,
    notchAt: rng.next() * Math.PI * 2,
    notchDepth: 0.1 + rng.next() * 0.14,
    holes: [],
  };
  for (let i = 0; i < nHoles; i++) base.holes.push({ at: rng.next() * Math.PI * 2, dist: 0.1 + rng.next() * 0.18, r: 0.07 + rng.next() * 0.04 });
  return base;
}

const jitter = (rng: Rng, s: number) => (rng.next() * 2 - 1) * s;

/** One look-alike: every continuous parameter moves independently. */
function perturb(c: FigureParams, rng: Rng, k: number): FigureParams {
  const p: FigureParams = {
    ...c,
    amp: Math.max(0.06, c.amp + jitter(rng, 0.05 * k)),
    phase: c.phase + jitter(rng, ((0.5 * Math.PI) / c.lobes) * k),
    h2: Math.max(0, c.h2 + jitter(rng, 0.05 * k)),
    p2: c.p2 + jitter(rng, 1.4 * k),
    h3: Math.max(0, c.h3 + jitter(rng, 0.04 * k)),
    p3: c.p3 + jitter(rng, 1.4 * k),
    notchAt: c.notchAt + jitter(rng, 1.1 * k),
    notchDepth: Math.max(0.05, c.notchDepth + jitter(rng, 0.07 * k)),
    holes: c.holes.map((h) => ({ at: h.at + jitter(rng, 1.2 * k), dist: Math.max(0.05, Math.min(0.32, h.dist + jitter(rng, 0.1 * k))), r: h.r })),
  };
  // Holes must sit well inside the outline.
  p.holes = p.holes.map((h) => {
    const room = figureRadius(p, h.at) - h.r - 0.07;
    return { ...h, dist: Math.max(0, Math.min(h.dist, room)) };
  });
  return p;
}

const trialCache = new Map<string, FiguresTrial>();

/** Similarity draw per hardness (0 = uniform, the stage-2 draw; 1, 2 lean to «more alike»). */
const SIMILARITY_WEIGHTS: readonly (readonly number[])[] = [
  [1, 1, 1],
  [0.15, 0.4, 0.45],
  [0, 0.35, 0.65],
];
const SIMILARITIES = ["low", "mid", "high"] as const;

/**
 * The full instance for a station key. Deterministic: the same key gives the
 * same figures on both devices. `direction` comes from the station;
 * `hardness` (0–2) is the streak's map level for figures.
 */
export function figuresTrial(key: string, direction: "A" | "B", hardness = 0): FiguresTrial {
  return buildTrial(key, "figures", direction, [9, 12], hardness);
}

/**
 * A curse's «sigilo y antídoto» cure (anexo etapa 3): the same machinery
 * with 6 candidates. The explorer sees the target (turned/mirrored by the
 * same mutators); the guide sees the 6 antidotes.
 */
export function sigilTrial(key: string): FiguresTrial {
  return buildTrial(key, "sigil", "A", [6, 6], 0);
}

function buildTrial(key: string, label: string, direction: "A" | "B", counts: readonly [number, number], hardness: number): FiguresTrial {
  const cacheKey = `${key}|${label}|${direction}|${hardness}`;
  const hit = trialCache.get(cacheKey);
  if (hit) return hit;
  const top = createRng(`${key}|${label}`);
  const count = top.range(counts[0], counts[1]);
  const h = Math.max(0, Math.min(SIMILARITY_WEIGHTS.length - 1, Math.floor(hardness)));
  // Hardness 0 keeps the exact stage-2 draw (pick), so its audits still hold.
  const similarity = h === 0 ? top.pick(SIMILARITIES) : SIMILARITIES[top.weighted(SIMILARITY_WEIGHTS[h])];
  const holes = top.chance(0.5);
  const shown = top.next();
  const turn = shown < 0.45 ? 0 : shown < 0.8 ? top.range(1, 3) : top.range(0, 3);
  const mirror = shown >= 0.8;

  for (let attempt = 0; ; attempt++) {
    const rng = createRng(`${key}|${label}|${attempt}`);
    const center = familyCenter(rng, holes);
    const params = sampleSet(center, count, NOISE[similarity], rng, attempt >= 40);
    if (!params) continue;
    // Correct one drawn uniformly after the set exists; display order shuffled.
    const order = rng.shuffle(params.map((_, i) => i));
    const shuffled = order.map((i) => params[i]);
    const correct = rng.int(count);
    const trial: FiguresTrial = {
      direction,
      candidates: shuffled.map((p) => figurePath(p)),
      correct,
      target: figurePath(shuffled[correct], turn, mirror),
      turn,
      mirror,
      similarity,
      holes,
      params: shuffled,
    };
    if (trialCache.size > 64) trialCache.clear();
    trialCache.set(cacheKey, trial);
    return trial;
  }
}

/**
 * Rejection sampling: each new candidate must stay ≥ min from every accepted
 * one (allowing turns) and ≤ max from all of them. `lenient` drops the max
 * bound and widens the noise as a last resort so generation terminates.
 */
function sampleSet(center: FigureParams, count: number, noise: number, rng: Rng, lenient = false): FigureParams[] | null {
  const out: FigureParams[] = [];
  const turns: Uint32Array[][] = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const p = perturb(center, rng, lenient ? noise * 1.5 : noise);
    const mine = pack(figureRaster(p));
    let ok = true;
    for (const q of turns) {
      let best = 1;
      for (const t of q) best = Math.min(best, packedDistance(mine, t));
      if (best < FIGURE_DISTANCE.min || (!lenient && packedDistance(mine, q[0]) > FIGURE_DISTANCE.max)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.push(p);
    turns.push(packedTurns(figureRaster(p)));
  }
  return out.length === count ? out : null;
}
