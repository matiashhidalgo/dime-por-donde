"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Delete, Eye, EyeOff, Headphones, Play, Square } from "lucide-react";
import type { PianoShape, PianoTrial } from "@/src/engine";
import { audio } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Button } from "./ui";
import { useSoundMode } from "./sound-toggle";

/**
 * PIANO DE LA BRUJA, both halves (GAME_SPEC_V2.md anexo etapa 4). Whoever
 * listens hears the melody on their own device; whoever plays tries keys on
 * theirs. Nothing needs to travel through the call. With sound off (or no
 * WebAudio), both halves switch to the visual mode on their own: heights as
 * bars for the listener, a height meter on each key for the player.
 */

const SHAPES: Record<PianoShape, string> = {
  circle: "M0,-8 A8,8 0 1 1 0,8 A8,8 0 1 1 0,-8 Z",
  square: "M-7,-7 H7 V7 H-7 Z",
  triangle: "M0,-8.5 L8,6.5 H-8 Z",
  diamond: "M0,-9 L8,0 L0,9 L-8,0 Z",
  star: "M0,-9 L2.6,-3 L9,-2.8 L4,1.6 L5.6,8.4 L0,4.6 L-5.6,8.4 L-4,1.6 L-9,-2.8 L-2.6,-3 Z",
  drop: "M0,-9 C5,-3 7,1 7,3.5 A7,7 0 0 1 -7,3.5 C-7,1 -5,-3 0,-9 Z",
  moon: "M3,-8.5 A8.5,8.5 0 1 0 3,8.5 A6.5,6.5 0 1 1 3,-8.5 Z",
  cross: "M-3,-8 H3 V-3 H8 V3 H3 V8 H-3 V3 H-8 V-3 H-3 Z",
};
const SHAPE_WORD: Record<PianoShape, string> = {
  circle: "círculo",
  square: "cuadrado",
  triangle: "triángulo",
  diamond: "rombo",
  star: "estrella",
  drop: "gota",
  moon: "luna",
  cross: "cruz",
};
const LENGTH_WORD = (beats: number) => (beats < 1 ? "corta" : beats > 1 ? "larga" : "media");

/** Whether notes can sound on this device right now (follows the sound switch). */
export function useNotesAudible(): boolean {
  const mode = useSoundMode();
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(audio.canPlayNotes()), [mode]);
  return ok;
}

/** A key's mark: its shape filled with its color, outlined so it reads on any background. */
export function KeyMark({ shape, color, size = 28 }: { shape: PianoShape; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden>
      <path d={SHAPES[shape]} fill={color} stroke="#1d1a17" strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}

export const keyLabel = (t: PianoTrial, k: number) => `${SHAPE_WORD[t.keys[k].shape]}`;

export function HeadphonesNote() {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-accent/12 px-3 py-2 text-sm font-medium">
      <Headphones size={18} className="shrink-0" aria-hidden />
      Usa audífonos quien escucha: la melodía no tiene que pasar por la llamada.
    </p>
  );
}

function VisualToggle({ on, forced, onToggle }: { on: boolean; forced: boolean; onToggle: () => void }) {
  if (forced) return <p className="text-xs text-muted">Sin sonido en este dispositivo: va en modo visual.</p>;
  return (
    <button onClick={onToggle} aria-pressed={on} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-muted hover:bg-border/50">
      {on ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      {on ? "Quitar modo visual" : "Modo visual (sin costo)"}
    </button>
  );
}

// ── Listener ────────────────────────────────────────────────────────────────

/** The listener's half: replay as often as you like, or see it as bars. */
export function PianoListen({ trial, reduce }: { trial: PianoTrial; reduce: boolean }) {
  const audible = useNotesAudible();
  const [visual, setVisual] = useState(false);
  const showBars = visual || !audible;
  const [playing, setPlaying] = useState(-1);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(
    () => () => {
      clear();
      audio.stopMelody();
    },
    [],
  );

  const play = () => {
    clear();
    const notes = trial.melody.map((k, i) => ({ midi: trial.keys[k].midi, beats: trial.durations[i] }));
    const length = audio.playMelody(notes, trial.beat, trial.timbre);
    if (length === 0) {
      setVisual(true);
      return;
    }
    // Light the bar that is sounding (the bars only show in visual mode).
    let at = 80;
    trial.durations.forEach((b, i) => {
      timers.current.push(window.setTimeout(() => setPlaying(i), at));
      at += b * trial.beat * 1000;
    });
    timers.current.push(window.setTimeout(() => setPlaying(-1), at + 200));
  };
  const stop = () => {
    clear();
    setPlaying(-1);
    audio.stopMelody();
  };

  return (
    <div className="grid gap-3">
      <HeadphonesNote />
      <p className="text-sm">
        La bruja tocó {trial.melody.length} notas. Cuéntale a tu compañero cómo van: cuál sube, cuál baja, cuál es la más aguda, cuáles son largas.
        Su teclado tiene {trial.keys.length} teclas en un orden que ni la bruja recuerda.
      </p>
      {audible && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={play}>
            <Play size={18} aria-hidden /> Escuchar la melodía
          </Button>
          <Button variant="secondary" onClick={stop} aria-label="Parar">
            <Square size={16} aria-hidden />
          </Button>
        </div>
      )}
      {showBars && <MelodyBars trial={trial} playing={playing} reduce={reduce} />}
      <VisualToggle on={visual} forced={!audible} onToggle={() => setVisual((v) => !v)} />
    </div>
  );
}

/** Height = pitch (rank on the keyboard), width = length. */
function MelodyBars({ trial, playing, reduce }: { trial: PianoTrial; playing: number; reduce: boolean }) {
  const ranks = trial.melody.map((k) => trial.keys[k].rank);
  const total = trial.durations.reduce((a, b) => a + b, 0);
  const levels = trial.keys.length;
  const W = 300;
  const H = 140;
  let x = 0;
  const label = ranks.map((r, i) => `nota ${i + 1}: altura ${r + 1} de ${levels}, ${LENGTH_WORD(trial.durations[i])}`).join("; ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl bg-background/70" role="img" aria-label={`La melodía en barras. ${label}`}>
      {Array.from({ length: levels }, (_, l) => (
        <line key={l} x1={0} x2={W} y1={H - 8 - ((l + 1) * (H - 16)) / levels} y2={H - 8 - ((l + 1) * (H - 16)) / levels} stroke="currentColor" strokeOpacity={0.08} />
      ))}
      {ranks.map((r, i) => {
        const w = (trial.durations[i] / total) * (W - 8);
        const h = ((r + 1) * (H - 16)) / levels;
        const bx = 4 + x;
        x += w;
        return (
          <rect
            key={i}
            x={bx + 2}
            y={H - 8 - h}
            width={Math.max(4, w - 4)}
            height={h}
            rx={4}
            fill={playing === i ? "var(--accent)" : "currentColor"}
            fillOpacity={playing === i ? 1 : 0.7}
            style={reduce ? undefined : { transition: "fill 120ms" }}
          />
        );
      })}
    </svg>
  );
}

// ── Player ──────────────────────────────────────────────────────────────────

/** Drafts survive closing the sheet (per tab, per station). */
const drafts = new Map<string, (number | null)[]>();

export interface PianoAttempt {
  answer: number[];
  right: number;
}

/**
 * The player's half: tap keys to hear them; to write, pick a slot and tap a
 * key (the slot then moves on). «Comprobar» only when every slot is full.
 */
export function PianoPlay({
  trial,
  draftKey,
  history,
  onCheck,
  footer,
}: {
  trial: PianoTrial;
  draftKey: string;
  history: readonly PianoAttempt[];
  onCheck: (answer: number[]) => void;
  footer?: React.ReactNode;
}) {
  const audible = useNotesAudible();
  const [visual, setVisual] = useState(false);
  const showMeters = visual || !audible;
  const L = trial.melody.length;
  const [slots, setSlots] = useState<(number | null)[]>(() => drafts.get(draftKey) ?? Array(L).fill(null));
  // No slot picked at first: trying keys never writes by accident.
  const [cursor, setCursor] = useState<number | null>(null);
  const [lit, setLit] = useState<{ key: number; n: number } | null>(null);
  // Keys heard at least once show their height in visual mode (finding them is still the job).
  const [heard, setHeard] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    drafts.set(draftKey, slots);
  }, [draftKey, slots]);
  useEffect(() => {
    if (!lit) return;
    const t = window.setTimeout(() => setLit(null), 900);
    return () => window.clearTimeout(t);
  }, [lit]);

  const press = (k: number) => {
    audio.playKey(trial.keys[k].midi, trial.timbre);
    setLit((l) => ({ key: k, n: (l?.n ?? 0) + 1 }));
    setHeard((h) => (h.has(k) ? h : new Set(h).add(k)));
    if (cursor === null) return;
    const next = slots.map((s, i) => (i === cursor ? k : s));
    setSlots(next);
    // On to the next slot, filled or not (rewriting a melody is the usual case).
    setCursor(cursor + 1 < L ? cursor + 1 : null);
  };
  const full = slots.every((s) => s !== null);
  const listenMine = () => {
    const notes = slots.flatMap((k, i) => (k === null ? [] : [{ midi: trial.keys[k].midi, beats: trial.durations[i] }]));
    if (notes.length > 0) audio.playMelody(notes, trial.beat, trial.timbre);
  };

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Toca las teclas para oírlas. Para escribir, elige una casilla y luego la tecla. Son {L} notas; tu compañero te cuenta cómo suenan.
      </p>
      <div className="flex items-center justify-center gap-1.5" role="group" aria-label="Tu melodía">
        {slots.map((s, i) => (
          <button
            key={i}
            onClick={() => {
              audio.play("tap");
              setCursor(i);
            }}
            onDoubleClick={() => setSlots((x) => x.map((v, j) => (j === i ? null : v)))}
            aria-pressed={cursor === i}
            aria-label={`Casilla ${i + 1}: ${s === null ? "vacía" : keyLabel(trial, s)}${cursor === i ? ", elegida" : ""}`}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-colors",
              cursor === i ? "border-foreground bg-accent/15" : s === null ? "border-dashed border-border" : "border-transparent bg-background",
            )}
          >
            {s !== null && <KeyMark shape={trial.keys[s].shape} color={trial.keys[s].color} size={30} />}
          </button>
        ))}
        <button
          onClick={() => {
            setSlots(Array(L).fill(null));
            setCursor(0);
          }}
          aria-label="Vaciar la melodía"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-border/50"
        >
          <Delete size={20} aria-hidden />
        </button>
      </div>

      <div className={cn("grid gap-2", trial.keys.length > 6 ? "grid-cols-4" : "grid-cols-3")} role="group" aria-label="Teclado">
        {trial.keys.map((key, k) => {
          const on = lit?.key === k;
          const level = (key.rank + 1) / trial.keys.length;
          return (
            <button
              key={k}
              onClick={() => press(k)}
              aria-label={`Tecla ${keyLabel(trial, k)}${showMeters && heard.has(k) ? `, altura ${key.rank + 1} de ${trial.keys.length}` : ""}${cursor !== null ? `: escribir en la casilla ${cursor + 1}` : ""}`}
              className={cn(
                "relative flex h-16 items-center justify-center overflow-hidden rounded-2xl border-2 transition-transform active:scale-95",
                on ? "border-foreground" : "border-black/10",
              )}
              style={{ background: `${key.color}33` }}
            >
              <KeyMark shape={key.shape} color={key.color} size={34} />
              {showMeters && heard.has(k) && (
                <span className="absolute bottom-1 right-1.5 top-1 w-1.5 overflow-hidden rounded-full bg-black/10" aria-hidden>
                  <span className="absolute bottom-0 left-0 right-0 rounded-full bg-foreground" style={{ height: `${level * 100}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <VisualToggle on={visual} forced={!audible} onToggle={() => setVisual((v) => !v)} />

      <div className="flex gap-2">
        {audible && (
          <Button variant="secondary" className="flex-1" onClick={listenMine} disabled={slots.every((s) => s === null)}>
            <Play size={16} aria-hidden /> Oír la mía
          </Button>
        )}
        <Button className="flex-1" disabled={!full} onClick={() => full && onCheck(slots as number[])}>
          <Check size={18} aria-hidden /> Comprobar
        </Button>
      </div>
      {footer}
      {history.length > 0 && (
        <ol className="grid gap-1.5" aria-label="Intentos anteriores">
          {[...history].reverse().map((h, i) => (
            <li key={history.length - i} className="flex items-center justify-between gap-2 rounded-2xl bg-background/70 px-3 py-1.5">
              <span className="flex gap-1">
                {h.answer.map((k, j) => (
                  <KeyMark key={j} shape={trial.keys[k].shape} color={trial.keys[k].color} size={22} />
                ))}
              </span>
              <span className="text-sm font-semibold tabular-nums" aria-label={`${h.right} de ${L} notas en su sitio`}>
                {h.right}/{L} en su sitio
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
