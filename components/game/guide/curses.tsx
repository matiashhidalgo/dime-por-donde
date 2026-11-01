"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Delete, Minus, Plus, X } from "lucide-react";
import { type Game, MAX_GUIDE_FAILS, THEMES, cureKey, drawCurse, echoCure, formatCureKey, sigilCure } from "@/src/engine";
import { audio, buzz } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Button } from "../ui";
import { Shape, useShake } from "../trials";
import { CurseIcon } from "../explorer/cure-overlay";

/**
 * The guide's «Maldiciones» panel (GAME_SPEC_V2.md anexo etapa 3). The guide
 * never learns that a curse fell: the explorer says so, and how many notches
 * they see. The counter picks curse k = notches − 1; its cure (sigil or echo)
 * comes from the seed, so a wrong count shows the wrong puzzle — which the
 * pair notices by talking. Like the stations, this is the guide's notebook,
 * kept per tab.
 */

interface CureNote {
  /** Sigil: antidotes crossed out. */
  crossed: number[];
  /** Echo: wrong sequences tried. */
  misses: number;
  solved: boolean;
}

interface CurseBook {
  k: number;
  notes: Record<number, CureNote>;
}

const KEY = "laberinto.guide-curses.v1";
const MAX_NOTCHES = 12;
const blank = (): CureNote => ({ crossed: [], misses: 0, solved: false });

function load(game: Game): CurseBook {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { k: 0, notes: {} };
    const saved = JSON.parse(raw) as { seed: string; book: CurseBook };
    if (saved.seed !== game.seed || typeof saved.book?.k !== "number") return { k: 0, notes: {} };
    return { k: Math.max(0, Math.min(MAX_NOTCHES - 1, saved.book.k)), notes: saved.book.notes ?? {} };
  } catch {
    return { k: 0, notes: {} };
  }
}

export function useGuideCurses(game: Game) {
  const [book, setBook] = useState<CurseBook>(() => load(game));
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ seed: game.seed, book }));
    } catch {
      // private mode / quota: the notebook just won't survive a reload
    }
  }, [game.seed, book]);
  const setK = useCallback((k: number) => setBook((b) => ({ ...b, k: Math.max(0, Math.min(MAX_NOTCHES - 1, k)) })), []);
  const update = useCallback((k: number, f: (n: CureNote) => CureNote) => setBook((b) => ({ ...b, notes: { ...b.notes, [k]: f(b.notes[k] ?? blank()) } })), []);
  return { book, setK, update };
}

export function CurseSheet({ game, onClose }: { game: Game; onClose: () => void }) {
  const { book, setK, update } = useGuideCurses(game);
  const k = book.k;
  const note = book.notes[k] ?? blank();
  const cure = useMemo(() => drawCurse(game.seed, k).cure, [game.seed, k]);
  const fails = Math.min(MAX_GUIDE_FAILS, cure === "sigil" ? note.crossed.length : note.misses);
  const key = note.solved ? formatCureKey(cureKey(game.seed, k, fails)) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="curses-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5b2fa0]/15 text-[#5b2fa0] dark:text-[#c5a8ff]">
            <CurseIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="curses-title" className="font-display text-xl leading-tight">Maldiciones</h2>
            <p className="truncate text-xs text-muted">Si le cayó una, aquí está la cura</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
            <X size={22} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-background/70 p-3">
            <div>
              <p className="text-sm font-medium">¿Cuántas muescas ve?</p>
              <p className="text-xs text-muted">Pregúntaselo: cada maldición trae las suyas.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Una muesca menos"
                disabled={k === 0}
                onClick={() => setK(k - 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40 disabled:opacity-35"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-display text-3xl tabular-nums" aria-live="polite" aria-label={`${k + 1} muescas`}>
                {k + 1}
              </span>
              <button
                aria-label="Una muesca más"
                disabled={k >= MAX_NOTCHES - 1}
                onClick={() => setK(k + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40 disabled:opacity-35"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            {key ? (
              <CureKey cureKey={key} fails={fails} />
            ) : cure === "sigil" ? (
              <SigilPick key={k} game={game} k={k} note={note} onUpdate={(f) => update(k, f)} />
            ) : (
              <EchoPad key={k} game={game} k={k} misses={note.misses} onUpdate={(f) => update(k, f)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CureKey({ cureKey, fails }: { cureKey: string; fails: number }) {
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <p className="text-sm">¡Esa es la cura! Díctale esta clave:</p>
      <p className="mt-3 rounded-2xl bg-background px-5 py-3 font-mono text-4xl font-semibold tracking-[0.25em]" aria-label={`Clave ${cureKey.split("").join(" ")}`}>
        {cureKey}
      </p>
      <p className="mt-3 text-xs text-muted">
        {fails === 0 ? "A la primera: la cura alumbra de más." : fails === 1 ? "La clave lleva tu error: alumbra un poco menos." : `La clave lleva tus ${fails} errores: alumbra menos.`}
      </p>
    </div>
  );
}

/** «Sigilo y antídoto»: six antidotes drawn as outlines; one fits the sigil they describe. */
function SigilPick({ game, k, note, onUpdate }: { game: Game; k: number; note: CureNote; onUpdate: (f: (n: CureNote) => CureNote) => void }) {
  const t = useMemo(() => sigilCure(game.seed, k), [game.seed, k]);
  const pal = THEMES[game.theme].palette;
  const [pick, setPick] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const shakeRef = useShake<HTMLDivElement>(shake);
  const confirm = () => {
    if (pick === null) return;
    if (pick === t.correct) {
      audio.play("cure");
      buzz([30, 40, 80]);
      onUpdate((n) => ({ ...n, solved: true }));
    } else {
      audio.play("bzzt");
      buzz([40, 30, 60]);
      setShake((n) => n + 1);
      onUpdate((n) => ({ ...n, crossed: [...n.crossed, pick] }));
    }
    setPick(null);
  };
  return (
    <div ref={shakeRef}>
      <p className="text-sm">
        Le cayó un sigilo. Que te lo describa y elige su antídoto: tienen la misma forma. <span className="text-muted">Puede que lo vea girado o en espejo.</span>
      </p>
      <p className="mt-1 text-xs text-muted">Cada error viaja en la clave: la cura alumbra menos.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {t.candidates.map((d, i) => {
          const out = note.crossed.includes(i);
          return (
            <button
              key={i}
              disabled={out}
              aria-pressed={pick === i}
              aria-label={out ? "Antídoto descartado" : `Antídoto ${i + 1}`}
              onClick={() => {
                audio.play("tap");
                setPick(i);
              }}
              className={cn("relative flex aspect-square items-center justify-center rounded-2xl border-2", pick === i ? "border-foreground" : "border-transparent", out && "opacity-35")}
              style={{ background: pal.paper }}
            >
              <Shape d={d} size={72} color={pal.ink} outline />
              {out && <X className="absolute text-[#c0392b]" size={48} strokeWidth={2.5} aria-hidden />}
            </button>
          );
        })}
      </div>
      <Button className="mt-4 w-full" disabled={pick === null} onClick={confirm}>
        <Check size={18} /> Este encaja
      </Button>
    </div>
  );
}

/** «Eco»: they dictate the sequence; tap it here (the keyboard is in another order than their screen). */
function EchoPad({ game, k, misses, onUpdate }: { game: Game; k: number; misses: number; onUpdate: (f: (n: CureNote) => CureNote) => void }) {
  const echo = useMemo(() => echoCure(game.seed, k), [game.seed, k]);
  const pal = THEMES[game.theme].palette;
  const [slots, setSlots] = useState<number[]>([]);
  const [shake, setShake] = useState(0);
  const shakeRef = useShake<HTMLDivElement>(shake);
  const n = echo.sequence.length;
  const tap = (g: number) => {
    if (slots.length >= n) return;
    audio.play("click");
    const next = [...slots, g];
    setSlots(next);
    if (next.length < n) return;
    if (next.every((x, i) => x === echo.sequence[i])) {
      audio.play("cure");
      buzz([30, 40, 80]);
      onUpdate((note) => ({ ...note, solved: true }));
    } else {
      audio.play("bzzt");
      buzz([40, 30, 60]);
      setShake((s) => s + 1);
      onUpdate((note) => ({ ...note, misses: note.misses + 1 }));
      window.setTimeout(() => setSlots([]), 450);
    }
  };
  return (
    <div ref={shakeRef}>
      <p className="text-sm">
        Le cayó un eco: ve {n} símbolos encenderse en orden{echo.repeats ? " (alguno puede repetirse)" : ""}. Que te los describa y tócalos igual.
      </p>
      <p className="mt-1 text-xs text-muted">{misses === 0 ? "Cada secuencia mal tocada viaja en la clave." : misses === 1 ? "Llevas 1 intento fallido: viaja en la clave." : `Llevas ${misses} intentos fallidos: viajan en la clave.`}</p>
      <div className="mt-3 flex items-center justify-center gap-2" aria-label="Tu secuencia">
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border"
            style={slots[i] !== undefined ? { background: pal.paper, borderStyle: "solid" } : undefined}
            aria-label={slots[i] === undefined ? `Casilla ${i + 1} vacía` : `Casilla ${i + 1} llena`}
          >
            {slots[i] !== undefined && <Shape d={echo.glyphs[slots[i]]} size={40} color={pal.ink} />}
          </span>
        ))}
        <button
          onClick={() => setSlots((s) => s.slice(0, -1))}
          disabled={slots.length === 0 || slots.length >= n}
          aria-label="Borrar el último"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-border/50 disabled:opacity-30"
        >
          <Delete size={20} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Símbolos">
        {echo.keyboard.map((g, i) => (
          <button
            key={g}
            onClick={() => tap(g)}
            disabled={slots.length >= n}
            aria-label={`Símbolo ${i + 1}`}
            className="flex aspect-square items-center justify-center rounded-2xl transition-transform active:scale-95 disabled:opacity-50"
            style={{ background: pal.paper }}
          >
            <Shape d={echo.glyphs[g]} size={52} color={pal.ink} />
          </button>
        ))}
      </div>
    </div>
  );
}
