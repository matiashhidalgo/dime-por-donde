"use client";

import type { ReactNode } from "react";
import { Eraser, X } from "lucide-react";
import { type Game, KEY_COLORS, THEMES, TUNING, cellLabel, stationEmblems } from "@/src/engine";
import { landmarkShapes } from "../landmark-shapes";
import { CELL, Glyph, MARK_COLOR, PIN_COLOR, SHADOW_COLOR, ShapeGlyph } from "./map-art";

/**
 * Legend + lookups for THIS map. Only what each symbol DOES (v2: no names for
 * objects or decoration — the pair makes up its own words). Landmarks and
 * pairs are tappable to jump there.
 */
export function Legend({
  game,
  onFocus,
  onClearNotes,
  onClose,
}: {
  game: Game;
  onFocus: (cell: number) => void;
  onClearNotes: () => void;
  onClose?: () => void;
}) {
  const theme = THEMES[game.theme];
  const ink = theme.palette.ink;
  const L = (c: number) => cellLabel(game.grid, c);
  // Icons sit on a little swatch of map paper so the ink reads in dark mode too.
  const icon = (node: ReactNode) => (
    <svg width={30} height={30} viewBox={`${-CELL / 2} ${-CELL / 2} ${CELL} ${CELL}`} aria-hidden className="shrink-0">
      <rect x={-CELL / 2} y={-CELL / 2} width={CELL} height={CELL} rx={8} fill={theme.palette.paper} />
      {node}
    </svg>
  );
  const R = CELL * 0.3;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-xl">Leyenda</h2>
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar leyenda" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-border/50">
            <X size={20} />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 text-sm">
        <section>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Item icon={icon(<><circle r={R * 1.2} fill="#3d9a5f" /><text y={5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">E</text></>)} label="Entrada" />
            <Item icon={icon(<><rect x={-R} y={-R} width={R * 2} height={R * 2.2} rx={R} fill={ink} /><text y={6} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">S</text></>)} label={game.stations ? "Salida: se abre con los 3 sellos" : "Salida"} />
            {game.stations && (
              <Item icon={icon(Glyph.station(0, 0, R * 1.3, stationEmblems(game)[0].d, ink, theme.palette.paper))} label="Estación: una prueba guarda un sello" />
            )}
            <Item icon={icon(Glyph.pit(0, 0, R, ink))} label="Pozo: −1 corazón, pierde llaves y cae lejos" />
            <Item icon={icon(Glyph.candle(0, R * 0.3, R * 1.1, ink))} label="Vela: un poco de luz (una vez)" />
            <Item icon={icon(Glyph.lantern(0, 0, R))} label="Farol: luz completa (una vez)" />
            {game.ponds.length > 0 && (
              <Item icon={icon(<rect x={-R * 1.4} y={-R * 1.4} width={R * 2.8} height={R * 2.8} fill="url(#ice-hatch)" stroke="#9ccbe4" />)} label="Hielo: resbalas hasta chocar" />
            )}
            {game.swirls.length > 0 && (
              <Item icon={icon(Glyph.swirl(0, 0, R, false))} label="Remolino: izq ↔ der y más niebla" />
            )}
            {game.swirls.some((s) => s.axes === "xy") && (
              <Item icon={icon(Glyph.swirl(0, 0, R * 0.85, true))} label="Remolino doble: todo al revés" />
            )}
            <Item icon={icon(Glyph.star(0, 0, R * 1.1))} label="Estrella" />
            {game.shadow && (
              <Item
                icon={icon(
                  <>
                    <path d={`M${-R * 1.3},0H${R * 1.3}`} stroke={SHADOW_COLOR} strokeWidth={2.6} strokeLinecap="round" />
                    <polygon points={`${R * 0.5},-5 ${R * 0.5},5 ${R * 1.1},0`} fill={SHADOW_COLOR} />
                    <circle cx={-R * 1.1} r={3.5} fill={SHADOW_COLOR} />
                  </>,
                )}
                label="Ronda de una Sombra: da un paso cuando el explorador da uno. Un punto cada 4 casillas"
              />
            )}
          </ul>
          <p className="mt-3 rounded-xl bg-background/70 p-3 text-xs leading-relaxed text-muted">
            {TUNING.hearts} corazones compartidos. La vela del explorador se gasta al caminar: tú no la ves, pregúntale. Sin corazones, se acaba la expedición.
            {game.shadow && " Tocar a la Sombra cuesta un corazón y algo de vela. No sabes dónde está ahora: cuéntense lo que el explorador ve y oye (su latido), y esperen si hace falta."}
          </p>
        </section>

        {game.doors.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Llaves y puertas (misma forma y color)</h3>
            <ul className="space-y-1">
              {game.doors.map((d, i) => {
                const k = KEY_COLORS[d.color];
                const key = game.keys.find((x) => x.color === d.color)!;
                return (
                  <li key={d.color} className="flex items-center gap-2">
                    {icon(<ShapeGlyph shape={k.shape} cx={0} cy={0} r={R * 1.1} fill={k.hex} />)}
                    <span className="sr-only">Par {i + 1}:</span>
                    <span className="flex-1" />
                    <Jump onClick={() => onFocus(key.cell)}>llave {L(key.cell)}</Jump>
                    <Jump onClick={() => onFocus(d.cell)}>puerta {L(d.cell)}</Jump>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {game.portals.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Portales (van y vuelven)</h3>
            <ul className="space-y-1">
              {game.portals.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  {icon(Glyph.portal(0, 0, R * 1.2, p.symbol))}
                  <span className="sr-only">Portal {i + 1}:</span>
                  <span className="flex-1" />
                  <Jump onClick={() => onFocus(p.a)}>{L(p.a)}</Jump>
                  <span aria-hidden>↔</span>
                  <Jump onClick={() => onFocus(p.b)}>{L(p.b)}</Jump>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Puntos de referencia</h3>
          <p className="mb-2 text-xs text-muted">Sin nombre: pónganles uno entre los dos.</p>
          <ul className="grid grid-cols-4 gap-1.5">
            {landmarkShapes(game).map((shape, i) => {
              const l = game.landmarks[i];
              return (
                <li key={l.cell}>
                  <button
                    onClick={() => onFocus(l.cell)}
                    aria-label={`Punto de referencia ${i + 1}, ${L(l.cell)}`}
                    className="flex w-full flex-col items-center rounded-xl py-1.5 hover:bg-border/40"
                  >
                    {icon(Glyph.landmark(0, 0, CELL * 0.38, shape.d, ink, theme.palette.paper))}
                    <span className="mt-0.5 font-mono text-[11px] text-muted">{L(l.cell)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Tus marcas (solo tú las ves)</h3>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-sm" style={{ background: MARK_COLOR, opacity: 0.45 }} /> Casilla marcada
            </li>
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2" style={{ borderColor: PIN_COLOR }} /> Alfiler «creo que estás aquí»
            </li>
          </ul>
          <button onClick={onClearNotes} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 hover:bg-border/40">
            <Eraser size={16} /> Borrar todas mis marcas
          </button>
        </section>
      </div>
    </div>
  );
}

function Item({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 leading-tight">
      {icon}
      <span>{label}</span>
    </li>
  );
}

function Jump({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="min-h-9 rounded-lg px-1.5 font-mono text-xs underline decoration-dotted underline-offset-2 hover:bg-border/40">
      {children}
    </button>
  );
}
