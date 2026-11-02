import { type Part, type Poly, type Pt, circle, fitStanding, lerp, rect, toPath } from "./geometry";
import { type Rng, createRng } from "./rng";
import type { Game } from "./types";

/**
 * Procedural silhouettes (GAME_SPEC_V2.md §2, §7): no names, no fixed
 * catalogue. Landmarks and station emblems are drawn from here, seeded per
 * game, so the pair has to put words to them («la cosa con tres picos»).
 *
 * 8 families × a count-like parameter keep siblings apart; mirror and skew
 * add continuous variety. Silhouettes stand on y = 1 inside the 2×2 box.
 */

export interface Silhouette {
  d: string;
  family: Family;
}

export const FAMILIES = ["spikes", "stack", "tree", "blob", "arch", "ring", "cluster", "crown"] as const;
export type Family = (typeof FAMILIES)[number];

/** Per family, the count-like parameter that keeps two siblings apart. */
const COUNTS: Record<Family, readonly number[]> = {
  spikes: [3, 4, 5, 6, 7, 8],
  stack: [2, 3, 4],
  tree: [1, 2, 3],
  blob: [2, 3, 4, 5],
  arch: [1, 2],
  ring: [1, 2, 3],
  cluster: [2, 3, 4],
  crown: [2, 3, 4, 5],
};

/**
 * `n` silhouettes from one seeded stream: every family appears before any
 * repeats, and a repeat takes a count its sibling didn't. `families` narrows
 * the pool (station emblems use distinct families).
 */
export function silhouettes(seed: string, n: number, families: readonly Family[] = FAMILIES): Silhouette[] {
  const rng = createRng(seed);
  const order: Family[] = [];
  while (order.length < n) order.push(...rng.shuffle(families));
  const usedCounts = new Map<Family, number[]>();
  return order.slice(0, n).map((family) => {
    const taken = usedCounts.get(family) ?? [];
    const free = COUNTS[family].filter((c) => !taken.includes(c));
    const count = rng.pick(free.length ? free : COUNTS[family]);
    usedCounts.set(family, [...taken, count]);
    const parts = build(family, count, rng);
    const mirror = rng.chance(0.5) ? -1 : 1;
    const skew = (rng.next() - 0.5) * 0.3;
    const placed = parts.map((p) => ({ ...p, poly: p.poly.map(([x, y]) => [mirror * (x + skew * (1 - y) * 0.5), y] as Pt) }));
    return { family, d: toPath(fitStanding(placed)) };
  });
}

const landmarkCache = new WeakMap<Game, Silhouette[]>();

/** Silhouettes for every landmark of `game`, in `game.landmarks` order. */
export function landmarkShapes(game: Game): Silhouette[] {
  const hit = landmarkCache.get(game);
  if (hit) return hit;
  const shapes = silhouettes(`${game.seed}:v${game.version}:landmarks`, game.landmarks.length);
  landmarkCache.set(game, shapes);
  return shapes;
}

// ── Families ─────────────────────────────────────────────────────────────────

const range = (rng: Rng, a: number, b: number) => lerp(a, b, rng.next());
const solid = (poly: Poly): Part => ({ poly });
const hole = (poly: Poly): Part => ({ poly, hole: true });

function build(family: Family, count: number, rng: Rng): Part[] {
  switch (family) {
    case "spikes": {
      // A burst on a short stem.
      const inner = range(rng, 0.3, 0.55);
      const rot = rng.next() * Math.PI;
      const cy = -0.1;
      const star: Pt[] = [];
      for (let i = 0; i < count * 2; i++) {
        const r = i % 2 === 0 ? 0.85 : 0.85 * inner;
        const a = rot + (Math.PI * i) / count;
        star.push([Math.cos(a) * r, cy + Math.sin(a) * r * 0.9]);
      }
      return [solid(star), solid(rect(-0.1, 0.5, 0.2, 0.5))];
    }
    case "stack": {
      // Blocks piled up, narrowing or widening, a little off-center.
      const out: Part[] = [];
      const h = 1.9 / count;
      let w = range(rng, 1.3, 1.8);
      const shrink = rng.chance(0.75) ? range(rng, 0.6, 0.85) : range(rng, 1.05, 1.2);
      let x = 0;
      for (let i = 0; i < count; i++) {
        const y = 1 - (i + 1) * h;
        out.push(solid(rect(x - w / 2, y + 0.02, w, h - 0.04)));
        x += range(rng, -0.12, 0.12);
        w = Math.min(1.9, w * shrink);
      }
      return out;
    }
    case "tree": {
      // Trunk and crowns: round puffs or pointy tiers.
      const pointy = rng.chance(0.5);
      const out: Part[] = [solid(rect(-0.11, 0.3, 0.22, 0.7))];
      for (let i = 0; i < count; i++) {
        const y = 0.35 - i * (1.2 / count);
        const w = 0.95 - i * (0.5 / count);
        if (pointy) out.push(solid([[-w, y], [w, y], [0, y - 1.25 / count - 0.25]]));
        else out.push(solid(circle(range(rng, -0.25, 0.25) * (count > 1 ? 1 : 0), y - 0.25, (w * 0.75) / Math.max(1, count * 0.65), 18)));
      }
      return out;
    }
    case "blob": {
      // A lumpy rock with `count` bulges.
      const amp = range(rng, 0.12, 0.22);
      const ph = rng.next() * Math.PI * 2;
      const pts: Pt[] = [];
      for (let i = 0; i < 36; i++) {
        const a = (Math.PI * 2 * i) / 36;
        const r = 0.72 + amp * Math.sin(count * a + ph);
        pts.push([Math.cos(a) * r, Math.min(1, 0.25 + Math.sin(a) * r * 0.85)]);
      }
      return [solid(pts)];
    }
    case "arch": {
      // A gate with one or two openings; round or pointed.
      const w = range(rng, 1.3, 1.85);
      const top = range(rng, -0.95, -0.55);
      const out: Part[] = [solid(rect(-w / 2, top, w, 1 - top))];
      const pointed = rng.chance(0.5);
      for (let i = 0; i < count; i++) {
        const hw = (w * 0.7) / count;
        const cx = -w / 2 + (w / count) * (i + 0.5);
        out.push(hole(opening(cx, hw, 1, top + 0.3, pointed)));
      }
      return out;
    }
    case "ring": {
      // A round stone with holes through it.
      const out: Part[] = [solid(circle(0, 0.1, 0.85, 28))];
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + rng.next() * 0.6;
        const off = count === 1 ? range(rng, 0, 0.25) : 0.38;
        out.push(hole(circle(Math.cos(a) * off, 0.1 + Math.sin(a) * off, count === 1 ? 0.32 : 0.2, 14)));
      }
      return out;
    }
    case "cluster": {
      // Several pebbles of mixed size and shape along the ground.
      const out: Part[] = [];
      const kinds = ["circle", "triangle", "square"] as const;
      for (let i = 0; i < count; i++) {
        const r = range(rng, 0.22, 0.42) * (i === 0 ? 1.25 : 1);
        const cx = -0.8 + (1.6 / Math.max(1, count - 1)) * i * (count > 1 ? 1 : 0.5);
        const s = rng.pick(kinds);
        if (s === "circle") out.push(solid(circle(cx, 1 - r, r, 14)));
        else if (s === "square") out.push(solid(rect(cx - r, 1 - 2 * r, 2 * r, 2 * r)));
        else out.push(solid([[cx - r, 1], [cx + r, 1], [cx, 1 - 2.2 * r]]));
      }
      return out;
    }
    case "crown": {
      // A wall with teeth on top.
      const w = range(rng, 1.4, 1.9);
      const base = range(rng, -0.1, 0.25);
      const tooth = range(rng, 0.45, 0.8);
      const pts: Pt[] = [[-w / 2, 1], [w / 2, 1], [w / 2, base]];
      const step = w / (count * 2 - 1);
      for (let i = count * 2 - 2; i >= 0; i--) {
        const x0 = -w / 2 + step * i;
        if (i % 2 === 0) pts.push([x0 + step, base - tooth], [x0, base - tooth]);
        else pts.push([x0 + step, base], [x0, base]);
      }
      return [solid(pts)];
    }
  }
}

function opening(cx: number, w: number, bottom: number, top: number, pointed: boolean): Poly {
  const pts: Pt[] = [[cx - w / 2, bottom]];
  const spring = top + w * 0.5;
  if (pointed) pts.push([cx - w / 2, spring], [cx, top], [cx + w / 2, spring]);
  else for (let i = 0; i <= 10; i++) pts.push([cx - (w / 2) * Math.cos((Math.PI * i) / 10), spring - (w / 2) * Math.sin((Math.PI * i) / 10)]);
  pts.push([cx + w / 2, bottom]);
  return pts;
}
