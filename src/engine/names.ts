import { THEMES } from "./themes";
import { type Game, KEY_COLORS, type Occupant, PORTAL_SYMBOLS } from "./types";

/**
 * The words both players say out loud. The guide's legend/chips and the
 * explorer's labels read from here, so "llave azul" is never "llave celeste"
 * on the other screen.
 */

export const keyName = (color: number) => `llave ${KEY_COLORS[color].colorName}`;
export const doorName = (color: number) => `puerta ${KEY_COLORS[color].colorName}`;
export const portalName = (symbol: number) => `portal ${PORTAL_SYMBOLS[symbol].shapeName} ${PORTAL_SYMBOLS[symbol].colorName}`;

/** Name of what stands on a cell, as the explorer may say it (no portal destinations). */
export function occupantName(game: Game, o: Occupant): string {
  switch (o.type) {
    case "start": return "entrada";
    case "exit": return "salida";
    case "checkpoint": return "bandera";
    case "pit": return THEMES[game.theme].labels.pit;
    case "door": return `${doorName(o.color)} (${KEY_COLORS[o.color].shapeName})`;
    case "key": return `${keyName(o.color)} (${KEY_COLORS[o.color].shapeName})`;
    case "portal": return portalName(game.portals[o.pair].symbol);
    case "swirl": return game.swirls[o.index].axes === "xy" ? "remolino (invierte todo)" : "remolino (izq ↔ der)";
    case "star": return "estrella";
    case "lantern": return "farol";
  }
}
