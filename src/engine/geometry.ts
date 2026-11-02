/**
 * Tiny 2D toolkit for the procedural pictures (landmarks, station emblems,
 * weird figures, lock glyphs). Everything lives in a 2×2 box (x, y in −1..1,
 * y down) and ends up as ONE SVG path string filled with the nonzero rule:
 * the guide's SVG uses it as-is and the explorer's canvas wraps it in a
 * Path2D, so both screens draw exactly the same shape.
 */

export type Pt = readonly [number, number];
export type Poly = Pt[];

/** A polygon of a picture: solid, or a hole cut out of the solid parts. */
export interface Part {
  poly: Poly;
  hole?: boolean;
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function rect(x: number, y: number, w: number, h: number): Poly {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

export function circle(cx: number, cy: number, r: number, n: number, ry = r): Poly {
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * ry] as Pt;
  });
}

/** Regular polygon, first vertex at angle `rot`. */
export function ngon(cx: number, cy: number, r: number, sides: number, rot = -Math.PI / 2): Poly {
  return Array.from({ length: sides }, (_, i) => {
    const a = rot + (Math.PI * 2 * i) / sides;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
}

/** Signed area (positive = clockwise on screen, y down). */
export const area = (p: readonly Pt[]) =>
  p.reduce((s, [x, y], i) => s + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0) / 2;

export function mapParts(parts: Part[], f: (p: Pt) => Pt): Part[] {
  return parts.map((part) => ({ ...part, poly: part.poly.map(f) }));
}

/** Rotates by quarter turns and/or mirrors around the box center. */
export function orient(parts: Part[], quarterTurns: number, mirror: boolean): Part[] {
  const q = ((quarterTurns % 4) + 4) % 4;
  return mapParts(parts, ([x0, y]) => {
    let x = mirror ? -x0 : x0;
    let yy = y;
    for (let i = 0; i < q; i++) [x, yy] = [-yy, x];
    return [x, yy];
  });
}

/** Shrinks parts that poke out of the 2×2 box, keeping them standing on y = 1. */
export function fitStanding(parts: Part[]): Part[] {
  let maxX = 0;
  let minY = 1;
  for (const { poly } of parts) for (const [x, y] of poly) (maxX = Math.max(maxX, Math.abs(x))), (minY = Math.min(minY, y));
  const k = Math.min(1, 1 / maxX, 2 / (1 - minY));
  return k === 1 ? parts : mapParts(parts, ([x, y]) => [x * k, 1 - (1 - y) * k]);
}

/** Scales parts around the center so they fit inside radius `r` (default 0.95). */
export function fitCentered(parts: Part[], r = 0.95): Part[] {
  let m = 0;
  for (const { poly } of parts) for (const [x, y] of poly) m = Math.max(m, Math.abs(x), Math.abs(y));
  const k = m > r ? r / m : 1;
  return k === 1 ? parts : mapParts(parts, ([x, y]) => [x * k, y * k]);
}

/**
 * One SVG path for the whole picture. Solid parts wind one way and holes the
 * other, whatever order they were built in, so nonzero fill cuts the holes.
 */
export function toPath(parts: Part[]): string {
  const f = (v: number) => (Math.round(v * 1000) / 1000).toString();
  return parts
    .map(({ poly, hole }) => {
      const q = (area(poly) > 0) === !!hole ? poly.slice().reverse() : poly;
      return `M${q.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;
    })
    .join("");
}
