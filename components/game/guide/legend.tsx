"use client";

import type { ReactNode } from "react";
import { Eraser, X } from "lucide-react";
import { type Game, KEY_COLORS, PORTAL_SYMBOLS, THEMES, cellLabel } from "@/src/engine";
import { CELL, Glyph, MARK_COLOR, PIN_COLOR, ShapeGlyph } from "./map-art";

/** Legend + lookups for THIS map. Landmarks and pairs are tappable to jump there. */
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
            <Item icon={icon(<><rect x={-R} y={-R} width={R * 2} height={R * 2.2} rx={R} fill={ink} /><text y={6} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">S</text></>)} label="Salida" />
            <Item icon={icon(Glyph.flag(0, 0, R * 1.1, ink))} label="Bandera (reaparece aquí)" />
            <Item icon={icon(Glyph.pit(0, 0, R, ink))} label={cap(theme.labels.pit)} />
            {game.ponds.length > 0 && (
              <Item icon={icon(<rect x={-R * 1.4} y={-R * 1.4} width={R * 2.8} height={R * 2.8} fill="url(#ice-hatch)" stroke="#9ccbe4" />)} label={`${cap(theme.labels.ice)}: resbalas hasta chocar`} />
            )}
            {game.swirls.length > 0 && (
              <Item icon={icon(Glyph.swirl(0, 0, R, false))} label="Remolino: invierte izq/der" />
            )}
            {game.swirls.some((s) => s.axes === "xy") && (
              <Item icon={icon(Glyph.swirl(0, 0, R * 0.85, true))} label="Remolino doble: invierte todo" />
            )}
            <Item icon={icon(Glyph.star(0, 0, R * 1.1))} label="Estrella" />
            <Item icon={icon(Glyph.lantern(0, 0, R))} label="Farol: más visión" />
            <Item icon={icon(Glyph.landmark(0, 0, CELL * 0.2, ink))} label="Punto de referencia" />
          </ul>
        </section>

        {game.doors.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Llaves y puertas</h3>
            <ul className="space-y-1">
              {game.doors.map((d) => {
                const k = KEY_COLORS[d.color];
                const key = game.keys.find((x) => x.color === d.color)!;
                return (
                  <li key={d.color} className="flex items-center gap-2">
                    {icon(<ShapeGlyph shape={k.shape} cx={0} cy={0} r={R * 1.1} fill={k.hex} />)}
                    <span className="flex-1">
                      {cap(k.colorName)} · {k.shapeName}
                    </span>
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
              {game.portals.map((p, i) => {
                const s = PORTAL_SYMBOLS[p.symbol];
                return (
                  <li key={i} className="flex items-center gap-2">
                    {icon(Glyph.portal(0, 0, R * 1.2, p.symbol))}
                    <span className="flex-1">
                      {cap(s.shapeName)} {s.colorName}
                    </span>
                    <Jump onClick={() => onFocus(p.a)}>{L(p.a)}</Jump>
                    <span aria-hidden>↔</span>
                    <Jump onClick={() => onFocus(p.b)}>{L(p.b)}</Jump>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Puntos de referencia</h3>
          <ul className="grid gap-0.5">
            {game.landmarks.map((l) => (
              <li key={l.cell}>
                <button
                  onClick={() => onFocus(l.cell)}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-left hover:bg-border/40"
                >
                  <span className="font-display italic">{l.label}</span>
                  <span className="font-mono text-xs text-muted">{L(l.cell)}</span>
                </button>
              </li>
            ))}
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
