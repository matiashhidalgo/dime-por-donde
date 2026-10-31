import { type Game, THEMES, cellLabel, occupantName } from "@/src/engine";

/** What the guide reads out loud about a cell ("F7 · llave azul (cuadrado)"). */
export function describeCell(game: Game, c: number): string {
  const theme = THEMES[game.theme];
  const parts: string[] = [];
  const o = game.occupant[c];
  if (o) {
    let name = occupantName(game, o);
    // The guide also knows where each portal leads.
    if (o.type === "portal") {
      const p = game.portals[o.pair];
      name += ` → ${cellLabel(game.grid, o.end === 0 ? p.b : p.a)}`;
    }
    parts.push(name);
  }
  if (game.ice[c]) parts.push(theme.labels.ice);
  const lm = game.landmarks.find((l) => l.cell === c);
  if (lm) parts.push(lm.label);
  return [cellLabel(game.grid, c), ...parts].join(" · ");
}
