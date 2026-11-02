"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, RotateCw, Undo2 } from "lucide-react";
import { type Placement, TANGRAM_BOARD, type TangramTrial, checkTangram, outlinePath, placedCells, turnCells } from "@/src/engine";
import { audio } from "@/lib/audio";
import { Button } from "./ui";

/**
 * TANGRAM A CIEGAS, both halves (GAME_SPEC_V2.md anexo etapa 4). One side
 * sees the silhouette (no grid); the other drags and turns the pieces on a
 * snapping board. Keyboard: 1–6 picks a piece, arrows move it, R turns it,
 * Supr sends it back to the tray.
 */

/** Piece colors; the shapes themselves are what tells pieces apart. */
const PIECE_COLORS = ["#e07a5f", "#3d9970", "#4f7cc4", "#d4a020", "#9a6bc0", "#2aa3a3"];

/** The silhouette, filled, no grid, where the generator put it in its frame. */
export function TangramSilhouette({ trial, ink, paper }: { trial: TangramTrial; ink: string; paper: string }) {
  const d = outlinePath(trial.silhouette, 1, trial.offset[0], trial.offset[1]);
  const pieces = trial.pieces.length - (trial.decoy ? 1 : 0);
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Tu compañero tiene {trial.pieces.length} piezas{trial.decoy ? ", y una sobra" : ""}. Descríbele esta silueta hasta que la arme: anchos, entrantes, dientes, dónde está cada cosa.
        {!trial.turns && " Esta vez sus piezas ya vienen bien giradas."}
      </p>
      <div className="mx-auto w-full max-w-[320px] rounded-3xl p-3" style={{ background: paper }}>
        <svg viewBox={`-0.3 -0.3 ${TANGRAM_BOARD + 0.6} ${TANGRAM_BOARD + 0.6}`} className="block w-full" role="img" aria-label={`La silueta: ${trial.area} cuadritos de superficie, hecha con ${pieces} piezas`}>
          <path d={d} fill={ink} stroke={ink} strokeWidth={0.06} strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-xs text-muted">No hay cuadrícula a propósito: cuenten «cuadritos» midiendo con la arista más corta.</p>
    </div>
  );
}

type Spot = { x: number; y: number; turn: number };
/** Per tab, per station: the board survives closing the sheet. */
const drafts = new Map<string, { board: Map<number, Spot>; turns: number[] }>();

function shapeOf(trial: TangramTrial, piece: number, turn: number) {
  const cells = turnCells(trial.pieces[piece].cells, turn);
  let w = 0;
  let h = 0;
  for (const [x, y] of cells) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return { cells, w, h };
}

/**
 * The assembler's half. Tap a tray piece to put it on the board (selected);
 * drag it to move (it snaps to the grid), tap it again or press «Girar» to
 * turn it; drag it off the board to send it back.
 */
export function TangramBoard({
  trial,
  draftKey,
  fails,
  onCheck,
  footer,
}: {
  trial: TangramTrial;
  draftKey: string;
  /** Wrong checks so far (shown, not counted here). */
  fails: number;
  onCheck: (placements: Placement[]) => void;
  footer?: React.ReactNode;
}) {
  const [board, setBoard] = useState<Map<number, Spot>>(() => new Map(drafts.get(draftKey)?.board ?? []));
  const [turns, setTurns] = useState<number[]>(() => drafts.get(draftKey)?.turns ?? trial.pieces.map((p) => p.trayTurn));
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ piece: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    drafts.set(draftKey, { board, turns });
  }, [draftKey, board, turns]);

  const placements: Placement[] = useMemo(() => [...board].map(([piece, s]) => ({ piece, ...s })), [board]);
  const check = useMemo(() => checkTangram(trial, placements), [trial, placements]);
  const clashes = useMemo(() => {
    const seen = new Map<string, number>();
    const out = new Set<string>();
    for (const p of placements) {
      for (const [x, y] of placedCells(trial, p)) {
        const k = `${x},${y}`;
        if (seen.has(k) || x < 0 || y < 0 || x >= TANGRAM_BOARD || y >= TANGRAM_BOARD) out.add(k);
        seen.set(k, p.piece);
      }
    }
    return out;
  }, [trial, placements]);

  const clampSpot = (piece: number, s: Spot): Spot => {
    const { w, h } = shapeOf(trial, piece, s.turn);
    return { ...s, x: Math.max(0, Math.min(TANGRAM_BOARD - w, s.x)), y: Math.max(0, Math.min(TANGRAM_BOARD - h, s.y)) };
  };
  const put = (piece: number, s: Spot | null) =>
    setBoard((b) => {
      const n = new Map(b);
      if (s) n.set(piece, s);
      else n.delete(piece);
      return n;
    });

  /** First spot (reading order) where the piece fits without overlapping. */
  const freeSpot = (piece: number, turn: number): Spot => {
    const { cells, w, h } = shapeOf(trial, piece, turn);
    const taken = new Set(placements.filter((p) => p.piece !== piece).flatMap((p) => placedCells(trial, p).map(([x, y]) => `${x},${y}`)));
    for (let y = 0; y + h <= TANGRAM_BOARD; y++) {
      for (let x = 0; x + w <= TANGRAM_BOARD; x++) {
        if (cells.every(([cx, cy]) => !taken.has(`${cx + x},${cy + y}`))) return { x, y, turn };
      }
    }
    return { x: 0, y: 0, turn };
  };

  const fromTray = (piece: number) => {
    audio.play("lift");
    put(piece, freeSpot(piece, turns[piece]));
    setSelected(piece);
  };
  const toTray = (piece: number) => {
    const s = board.get(piece);
    if (s) setTurns((t) => t.map((v, i) => (i === piece ? s.turn : v)));
    put(piece, null);
    if (selected === piece) setSelected(null);
    audio.play("tap");
  };
  /** Changes a placed piece from its latest spot (safe under key repeat). */
  const move = (piece: number, f: (s: Spot) => Spot) =>
    setBoard((b) => {
      const s = b.get(piece);
      if (!s) return b;
      const n = new Map(b);
      n.set(piece, clampSpot(piece, f(s)));
      return n;
    });
  const turnPiece = (piece: number) => {
    if (!trial.turns || !board.has(piece)) return;
    move(piece, (s) => {
      const before = shapeOf(trial, piece, s.turn);
      const turn = (s.turn + 1) % 4;
      const after = shapeOf(trial, piece, turn);
      // Turn around its middle; clampSpot keeps it on the board.
      return { turn, x: s.x + Math.round((before.w - after.w) / 2), y: s.y + Math.round((before.h - after.h) / 2) };
    });
    audio.play("turn");
  };
  const nudge = (piece: number, dx: number, dy: number) => {
    if (!board.has(piece)) return;
    move(piece, (s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
    audio.play("click");
  };

  // ── pointer ──
  const toCells = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * TANGRAM_BOARD, y: ((e.clientY - r.top) / r.height) * TANGRAM_BOARD };
  };
  const onPieceDown = (e: React.PointerEvent, piece: number) => {
    e.stopPropagation();
    const s = board.get(piece)!;
    const p = toCells(e);
    svgRef.current!.setPointerCapture(e.pointerId);
    setDrag({ piece, x: s.x, y: s.y, dx: p.x - s.x, dy: p.y - s.y, moved: false });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toCells(e);
    const x = p.x - drag.dx;
    const y = p.y - drag.dy;
    const s = board.get(drag.piece)!;
    const moved = drag.moved || Math.abs(x - s.x) > 0.25 || Math.abs(y - s.y) > 0.25;
    setDrag({ ...drag, x, y, moved });
  };
  const onUp = () => {
    if (!drag) return;
    const { piece, x, y, moved } = drag;
    setDrag(null);
    const s = board.get(piece)!;
    if (!moved) {
      if (selected === piece) turnPiece(piece);
      else {
        audio.play("tap");
        setSelected(piece);
      }
      return;
    }
    const { w, h } = shapeOf(trial, piece, s.turn);
    // Dragged mostly off the board: back to the tray.
    if (x + w / 2 < -0.3 || y + h / 2 < -0.3 || x + w / 2 > TANGRAM_BOARD + 0.3 || y + h / 2 > TANGRAM_BOARD + 0.3) {
      toTray(piece);
      return;
    }
    put(piece, clampSpot(piece, { ...s, x: Math.round(x), y: Math.round(y) }));
    setSelected(piece);
    audio.play("snap");
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = Number(e.key);
    if (n >= 1 && n <= trial.pieces.length) {
      e.preventDefault();
      if (board.has(n - 1)) setSelected(n - 1);
      else fromTray(n - 1);
      return;
    }
    if (selected === null || !board.has(selected)) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      nudge(selected, ...moves[e.key]);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      turnPiece(selected);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      toTray(selected);
    }
  };

  const reason = !check.ready
    ? check.reason === "overlap"
      ? "Hay piezas encimadas."
      : check.reason === "outside"
        ? "Algo se sale del tablero."
        : check.reason === "empty"
          ? "Pon piezas en el tablero."
          : ""
    : null;
  const tray = trial.pieces.map((_, i) => i).filter((i) => !board.has(i));
  const sel = selected !== null && board.has(selected) ? selected : null;

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Arma la silueta que te describen.{trial.decoy ? " Ojo: una pieza sobra." : ""}
        {trial.turns ? " Toca una pieza puesta para elegirla, otra vez para girarla; arrástrala para moverla." : " Esta vez no se giran: solo muévelas."}
      </p>
      <div className="mx-auto w-full max-w-[320px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${TANGRAM_BOARD} ${TANGRAM_BOARD}`}
          className="block w-full touch-none select-none rounded-2xl bg-background outline-none ring-accent focus-visible:ring-2"
          tabIndex={0}
          role="application"
          aria-label={`Tablero de ${TANGRAM_BOARD} por ${TANGRAM_BOARD}. Teclas: del 1 al ${trial.pieces.length} para elegir pieza, flechas para moverla, R para girarla, Suprimir para devolverla.`}
          onKeyDown={onKey}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerDown={() => setSelected(null)}
        >
          {Array.from({ length: TANGRAM_BOARD + 1 }, (_, i) => (
            <g key={i} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.03}>
              <line x1={i} y1={0} x2={i} y2={TANGRAM_BOARD} />
              <line x1={0} y1={i} x2={TANGRAM_BOARD} y2={i} />
            </g>
          ))}
          {placements.map((p) => {
            const dragging = drag?.piece === p.piece;
            const x = dragging ? drag.x : p.x;
            const y = dragging ? drag.y : p.y;
            const cells = turnCells(trial.pieces[p.piece].cells, p.turn);
            const color = PIECE_COLORS[p.piece % PIECE_COLORS.length];
            return (
              <g key={p.piece} onPointerDown={(e) => onPieceDown(e, p.piece)} className="cursor-grab" style={{ opacity: dragging ? 0.85 : 1 }}>
                {cells.map(([cx, cy]) => (
                  <rect key={`${cx},${cy}`} x={x + cx} y={y + cy} width={1} height={1} fill={color} fillOpacity={0.85} />
                ))}
                <path d={outlinePath(cells, 1, x, y)} fill="none" stroke={sel === p.piece ? "var(--foreground)" : "#1d1a17"} strokeWidth={sel === p.piece ? 0.14 : 0.06} strokeLinejoin="round" />
              </g>
            );
          })}
          {[...clashes].map((k) => {
            const [x, y] = k.split(",").map(Number);
            return <path key={k} d={`M${x + 0.2} ${y + 0.2}L${x + 0.8} ${y + 0.8}M${x + 0.8} ${y + 0.2}L${x + 0.2} ${y + 0.8}`} stroke="#c0392b" strokeWidth={0.12} strokeLinecap="round" />;
          })}
        </svg>
      </div>

      {sel !== null && (
        <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Mover la pieza elegida">
          {trial.turns && (
            <Button variant="secondary" onClick={() => turnPiece(sel)}>
              <RotateCw size={18} aria-hidden /> Girar
            </Button>
          )}
          <ArrowButton label="Izquierda" onClick={() => nudge(sel, -1, 0)} icon={<ArrowLeft size={18} />} />
          <ArrowButton label="Arriba" onClick={() => nudge(sel, 0, -1)} icon={<ArrowUp size={18} />} />
          <ArrowButton label="Abajo" onClick={() => nudge(sel, 0, 1)} icon={<ArrowDown size={18} />} />
          <ArrowButton label="Derecha" onClick={() => nudge(sel, 1, 0)} icon={<ArrowRight size={18} />} />
          <Button variant="ghost" onClick={() => toTray(sel)} aria-label="Devolver a la bandeja">
            <Undo2 size={18} aria-hidden />
          </Button>
        </div>
      )}

      {tray.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-2" role="group" aria-label="Bandeja">
          {tray.map((i) => {
            const { cells, w, h } = shapeOf(trial, i, turns[i]);
            const side = Math.max(w, h);
            return (
              <button
                key={i}
                onClick={() => fromTray(i)}
                aria-label={`Pieza ${i + 1} de la bandeja (${cells.length} cuadritos): ponerla en el tablero`}
                className="flex h-16 w-16 items-center justify-center rounded-xl hover:bg-border/40 active:scale-95"
              >
                <svg viewBox={`${(w - side) / 2 - 0.2} ${(h - side) / 2 - 0.2} ${side + 0.4} ${side + 0.4}`} width={52} height={52} aria-hidden>
                  {cells.map(([cx, cy]) => (
                    <rect key={`${cx},${cy}`} x={cx} y={cy} width={1} height={1} fill={PIECE_COLORS[i % PIECE_COLORS.length]} fillOpacity={0.85} />
                  ))}
                  <path d={outlinePath(cells)} fill="none" stroke="#1d1a17" strokeWidth={0.08} />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      <Button disabled={!check.ready} onClick={() => check.ready && onCheck(placements)}>
        <Check size={18} aria-hidden /> Comprobar
      </Button>
      <p className="min-h-5 text-center text-xs text-muted" aria-live="polite">
        {reason ?? (fails > 0 ? `${fails === 1 ? "Un intento no encajó" : `${fails} intentos no encajaron`}. Pregunten por los entrantes.` : "Cuando creas que está, comprueba.")}
      </p>
      {footer}
    </div>
  );
}

function ArrowButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40 active:scale-95">
      {icon}
    </button>
  );
}
