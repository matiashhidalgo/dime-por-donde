import { KEY_COLORS, PORTAL_SYMBOLS, THEMES } from "@/src/engine";

/**
 * v2 rule (GAME_SPEC_V2.md §2): nothing on screen names an object. The pair
 * invents the words. Generic mechanic words (llave, puerta, pozo, farol…) are
 * fine; v1's names — landmark kinds and variants, key/portal colors and
 * shapes, themed pit and ice names — are not.
 */
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FORBIDDEN = [
  ...Object.values(THEMES).flatMap((t) => [
    ...t.landmarks.flatMap((l) => [l.name, ...l.variants]),
    ...Object.values(t.labels).filter((w) => w !== "pozo"),
  ]),
  ...KEY_COLORS.flatMap((c) => [c.colorName, c.shapeName]),
  ...PORTAL_SYMBOLS.flatMap((p) => [p.colorName, p.shapeName]),
];
export const NAMES = new RegExp(`(^|[^\\p{L}])(${[...new Set(FORBIDDEN)].map(esc).join("|")})(?![\\p{L}])`, "iu");
