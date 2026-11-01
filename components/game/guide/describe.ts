import { type Game, type Occupant, cellLabel } from "@/src/engine";

/** What each symbol does, never what it is called in a story (v2: no object names). */
const MECHANIC: Record<Occupant["type"], string> = {
  start: "entrada",
  exit: "salida",
  checkpoint: "vela",
  pit: "pozo",
  door: "puerta",
  key: "llave",
  portal: "portal",
  swirl: "remolino",
  star: "estrella",
  lantern: "farol",
};

/** The tapped cell for the guide: coordinate + mechanic ("F7 · portal → K12"). */
export function describeCell(game: Game, c: number): string {
  const parts: string[] = [];
  const o = game.occupant[c];
  if (o) {
    let name = MECHANIC[o.type];
    // The guide also knows where each portal leads.
    if (o.type === "portal") {
      const p = game.portals[o.pair];
      name += ` → ${cellLabel(game.grid, o.end === 0 ? p.b : p.a)}`;
    }
    parts.push(name);
  }
  if (game.ice[c]) parts.push("hielo");
  if (game.landmarks.some((l) => l.cell === c)) parts.push("punto de referencia");
  if (game.stations?.some((st) => st.cell === c)) parts.push("estación: una prueba guarda un sello");
  if (c === game.exit && game.stations) parts.push("se abre con los 3 sellos");
  return [cellLabel(game.grid, c), ...parts].join(" · ");
}
