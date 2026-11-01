import { type Part, type Pt, circle, fitCentered, mapParts, ngon, rect, toPath } from "./geometry";
import { type Rng, createRng } from "./rng";

/**
 * Lock glyphs (GAME_SPEC_V2.md §4, anexo etapa 2): composed from parts —
 * base, inner mark, appendage, orientation — plus continuous proportions, so
 * a set never repeats between games. Any two glyphs of one set differ in at
 * least 2 parts. No names: the pair christens them.
 */

export const GLYPH_BASES = ["tri", "quad", "penta", "hexa", "drop", "half"] as const;
export const GLYPH_MARKS = ["none", "dot", "bar", "ring", "dots"] as const;
export const GLYPH_LIMBS = ["none", "spike", "stub", "hook"] as const;

export interface GlyphSpec {
  base: (typeof GLYPH_BASES)[number];
  mark: (typeof GLYPH_MARKS)[number];
  limb: (typeof GLYPH_LIMBS)[number];
  /** Orientation in eighths of a turn. */
  turn: number;
  /** Continuous variety: width/height ratio and vertex wobble seed. */
  aspect: number;
  wobble: number;
}

/** Parts that differ between two glyphs (orientation counts when it reads differently). */
export function glyphDifference(a: GlyphSpec, b: GlyphSpec): number {
  return (a.base !== b.base ? 1 : 0) + (a.mark !== b.mark ? 1 : 0) + (a.limb !== b.limb ? 1 : 0) + (a.turn !== b.turn ? 1 : 0);
}

export function glyphSet(seed: string, count: number): { specs: GlyphSpec[]; paths: string[] } {
  const rng = createRng(`${seed}|glyphs`);
  const specs: GlyphSpec[] = [];
  for (let tries = 0; specs.length < count; tries++) {
    const g = randomGlyph(rng);
    // Relax only if a set somehow can't fill (never happens with these pools).
    const need = tries < 2000 ? 2 : 1;
    if (specs.every((o) => glyphDifference(o, g) >= need)) specs.push(g);
  }
  return { specs, paths: specs.map(glyphPath) };
}

function randomGlyph(rng: Rng): GlyphSpec {
  return {
    base: rng.pick(GLYPH_BASES),
    mark: rng.pick(GLYPH_MARKS),
    limb: rng.pick(GLYPH_LIMBS),
    turn: rng.int(8),
    aspect: 0.82 + rng.next() * 0.36,
    wobble: rng.next(),
  };
}

export function glyphPath(g: GlyphSpec): string {
  const wob = createRng(`wobble:${g.wobble}`);
  const parts: Part[] = [];
  const body = baseOutline(g.base).map(([x, y]) => [x * g.aspect + (wob.next() - 0.5) * 0.08, y / g.aspect + (wob.next() - 0.5) * 0.08] as Pt);
  parts.push({ poly: body });
  switch (g.limb) {
    case "spike":
      parts.push({ poly: [[-0.16, -0.3], [0.16, -0.3], [0, -1.05]] });
      break;
    case "stub":
      parts.push({ poly: rect(-0.13, -0.95, 0.26, 0.65) });
      break;
    case "hook":
      parts.push({ poly: [[-0.12, -0.3], [-0.12, -1], [0.5, -1], [0.5, -0.62], [0.36, -0.62], [0.36, -0.82], [0.12, -0.82], [0.12, -0.3]] });
      break;
  }
  switch (g.mark) {
    case "dot":
      parts.push({ poly: circle(0, 0.05, 0.14, 14), hole: true });
      break;
    case "bar":
      parts.push({ poly: rect(-0.28, -0.04, 0.56, 0.16), hole: true });
      break;
    case "ring":
      parts.push({ poly: circle(0, 0.05, 0.24, 18), hole: true }, { poly: circle(0, 0.05, 0.11, 14) });
      break;
    case "dots":
      parts.push({ poly: circle(-0.16, 0.05, 0.09, 12), hole: true }, { poly: circle(0.16, 0.05, 0.09, 12), hole: true });
      break;
  }
  const a = (g.turn * Math.PI) / 4;
  const turned = mapParts(parts, ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  return toPath(fitCentered(turned, 0.92));
}

function baseOutline(base: GlyphSpec["base"]): Pt[] {
  switch (base) {
    case "tri":
      return ngon(0, 0.08, 0.66, 3);
    case "quad":
      return ngon(0, 0, 0.6, 4, -Math.PI / 4);
    case "penta":
      return ngon(0, 0.03, 0.62, 5);
    case "hexa":
      return ngon(0, 0, 0.6, 6, 0);
    case "drop": {
      const pts: Pt[] = [];
      for (let i = 0; i < 24; i++) {
        const t = (Math.PI * 2 * i) / 24;
        const r = 0.55 * (1 - 0.35 * Math.sin(t));
        pts.push([Math.cos(t) * r * 0.9, Math.sin(t) * r + 0.06]);
      }
      return pts;
    }
    case "half": {
      const pts: Pt[] = [[-0.62, 0.22]];
      for (let i = 0; i <= 14; i++) {
        const t = Math.PI + (Math.PI * i) / 14;
        pts.push([Math.cos(t) * 0.62, 0.22 + Math.sin(t) * 0.62]);
      }
      pts.push([0.62, 0.42], [-0.62, 0.42]);
      return pts;
    }
  }
}
