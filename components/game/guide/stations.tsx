"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, LocateFixed, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  type Game,
  MAX_GUIDE_FAILS,
  type Station,
  THEMES,
  TUNING,
  cellLabel,
  formatSealKey,
  lockTrial,
  pianoInPlace,
  sealKey,
  stationEmblems,
  stationFigures,
  stationPiano,
  stationTangram,
  tangramSolved,
} from "@/src/engine";
import { audio, buzz } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Button } from "../ui";
import { type PianoAttempt, PianoListen, PianoPlay } from "../piano";
import { TangramBoard, TangramSilhouette } from "../tangram";
import { ClueGrammar, CluePictogram, Medallion, Shape, TRIAL_TITLES, useShake } from "../trials";
import { FirstHint } from "../hint";

/**
 * The guide's side of the stations (GAME_SPEC_V2.md anexo etapa 2). The two
 * devices never talk: what the guide does here (figures crossed out, the key
 * found, which seals they believe are won) is the guide's own notebook, kept
 * per tab in sessionStorage. Opening the wrong station gives no warning —
 * finding out which one the explorer is standing at is part of the game.
 * At the piano and the tangram (direction A) the guide checks on their own
 * device; the misses travel inside the key, like crossed-out figures.
 */

export interface GuideStation {
  /** Wrong figures picked (direction A): they travel inside the key. */
  crossed: number[];
  /** Wrong complete answers at the piano or the tangram (direction A). */
  misses: number;
  /** The piano melodies the guide checked, with the reply. */
  melodies: PianoAttempt[];
  solved: boolean;
  /** The guide's own mark: «este sello ya lo ganamos». */
  marked: boolean;
}

const KEY = "laberinto.guide-stations.v2";

function load(game: Game): GuideStation[] {
  const fresh: GuideStation[] = (game.stations ?? []).map(() => ({ crossed: [], misses: 0, melodies: [], solved: false, marked: false }));
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as { seed: string; stations: GuideStation[] };
    if (saved.seed !== game.seed || saved.stations?.length !== fresh.length) return fresh;
    return saved.stations.map((s) => ({
      crossed: Array.isArray(s.crossed) ? s.crossed : [],
      misses: Number.isInteger(s.misses) && s.misses > 0 ? s.misses : 0,
      melodies: Array.isArray(s.melodies) ? s.melodies : [],
      solved: !!s.solved,
      marked: !!s.marked,
    }));
  } catch {
    return fresh;
  }
}

export function useGuideStations(game: Game) {
  const [stations, setStations] = useState<GuideStation[]>(() => load(game));
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ seed: game.seed, stations }));
    } catch {
      // private mode / quota: the notebook just won't survive a reload
    }
  }, [game.seed, stations]);
  const update = useCallback((i: number, f: (s: GuideStation) => GuideStation) => {
    setStations((all) => all.map((s, j) => (j === i ? f(s) : s)));
  }, []);
  return { stations, update };
}

/**
 * «Estaciones»: the three emblems, floating on the map. Folds into a small
 * pill (on phones it starts folded, so it doesn't cover the map).
 */
export function StationsBar({
  game,
  notes,
  open,
  onToggle,
  onOpen,
}: {
  game: Game;
  notes: GuideStation[];
  open: boolean;
  onToggle: () => void;
  onOpen: (i: number) => void;
}) {
  const emblems = stationEmblems(game);
  const won = notes.filter((n) => n.marked).length;
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-card/95 p-1.5 shadow-md ring-1 ring-border" onPointerDown={(e) => e.stopPropagation()}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`Estaciones: ${won} de ${emblems.length} sellos marcados. ${open ? "Plegar" : "Desplegar"}`}
        className="flex min-h-9 items-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-widest text-muted hover:bg-border/50"
      >
        Estaciones <span className="tabular-nums normal-case">{won}/{emblems.length}</span>
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && emblems.map((e, i) => (
        <button
          key={i}
          onClick={() => {
            audio.play("tap");
            onOpen(i);
          }}
          aria-label={`Estación ${i + 1}${notes[i]?.marked ? ", sello ganado" : ""}`}
          className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-border/50"
        >
          <Medallion d={e.d} sealed={!!notes[i]?.marked} size={42} className="text-foreground" />
        </button>
      ))}
    </div>
  );
}

export function StationSheet({
  game,
  station,
  note,
  update,
  onFocus,
  onClose,
}: {
  game: Game;
  station: Station;
  note: GuideStation;
  update: (f: (s: GuideStation) => GuideStation) => void;
  onFocus: (cell: number) => void;
  onClose: () => void;
}) {
  const emblem = stationEmblems(game)[station.index].d;
  const reduce = useReducedMotion() ?? false;
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
        aria-labelledby="gstation-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Medallion d={emblem} sealed={note.marked} size={40} className="shrink-0 text-foreground" />
          <div className="min-w-0 flex-1">
            <h2 id="gstation-title" className="font-display text-xl leading-tight">{TRIAL_TITLES[station.kind]}</h2>
            <button onClick={() => onFocus(station.cell)} className="flex items-center gap-1 text-xs text-muted underline decoration-dotted underline-offset-2">
              <LocateFixed size={12} /> En el mapa: {cellLabel(game.grid, station.cell)}
            </button>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
            <X size={22} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <FirstHint id={`trial-${station.kind}`} className="mb-3" />
          {station.kind === "lock" ? (
            <GuideLock game={game} station={station} />
          ) : station.kind === "piano" ? (
            station.direction === "A" ? (
              <GuidePiano game={game} station={station} note={note} update={update} />
            ) : (
              <PianoListen trial={stationPiano(station)} reduce={reduce} />
            )
          ) : station.kind === "tangram" ? (
            station.direction === "A" ? (
              <GuideTangram game={game} station={station} note={note} update={update} />
            ) : (
              <TangramSilhouette trial={stationTangram(station)} ink={THEMES[game.theme].palette.ink} paper={THEMES[game.theme].palette.paper} />
            )
          ) : station.direction === "A" ? (
            <GuidePick game={game} station={station} note={note} update={update} />
          ) : (
            <GuideDescribe game={game} station={station} />
          )}
        </div>
        <footer className="border-t border-border px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            onClick={() => update((s) => ({ ...s, marked: !s.marked }))}
            aria-pressed={note.marked}
            className={cn(
              "flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-medium",
              note.marked ? "border-[#a5700f] bg-[#f2b84b]/25" : "border-border hover:bg-border/40",
            )}
          >
            {note.marked ? <Check size={18} /> : null}
            {note.marked ? "Sello ganado (toca para desmarcar)" : "Marcar: este sello ya lo ganamos"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Direction A: the explorer describes; the guide finds it and reads out the key. */
function GuidePick({ game, station, note, update }: { game: Game; station: Station; note: GuideStation; update: (f: (s: GuideStation) => GuideStation) => void }) {
  const t = useMemo(() => stationFigures(game, station), [game, station]);
  const pal = THEMES[game.theme].palette;
  const [pick, setPick] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const shakeRef = useShake<HTMLDivElement>(shake);
  const fails = Math.min(MAX_GUIDE_FAILS, note.crossed.length);
  const key = note.solved;

  const confirm = () => {
    if (pick === null) return;
    if (pick === t.correct) {
      audio.play("seal");
      buzz([30, 40, 80]);
      update((s) => ({ ...s, solved: true }));
    } else {
      audio.play("bzzt");
      buzz([40, 30, 60]);
      setShake((n) => n + 1);
      update((s) => ({ ...s, crossed: [...s.crossed, pick] }));
    }
    setPick(null);
  };

  if (key) return <DictateKey game={game} station={station} fails={fails} lead="¡Esa era!" free={0} />;
  return (
    <div ref={shakeRef}>
      <p className="text-sm">Tu explorador tiene una de estas figuras frente a él. Que te la describa y elige. <span className="text-muted">Puede que la vea girada o en espejo.</span></p>
      <p className="mt-1 text-xs text-muted">Cada error viaja en la clave y le cuesta vela al abrir.</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {t.candidates.map((d, i) => {
          const out = note.crossed.includes(i);
          return (
            <button
              key={i}
              disabled={out}
              aria-pressed={pick === i}
              aria-label={out ? "Figura descartada" : `Figura ${i + 1}`}
              onClick={() => {
                audio.play("tap");
                setPick(i);
              }}
              className={cn("relative flex aspect-square items-center justify-center rounded-2xl border-2", pick === i ? "border-foreground" : "border-transparent", out && "opacity-35")}
              style={{ background: pal.paper }}
            >
              <Shape d={d} size={60} color={pal.ink} />
              {out && <X className="absolute text-[#c0392b]" size={44} strokeWidth={2.5} aria-hidden />}
            </button>
          );
        })}
      </div>
      <Button className="mt-4 w-full" disabled={pick === null} onClick={confirm}>
        <Check size={18} /> Es esta
      </Button>
    </div>
  );
}

/** Direction B: the guide describes; the explorer picks on their own screen. */
function GuideDescribe({ game, station }: { game: Game; station: Station }) {
  const t = useMemo(() => stationFigures(game, station), [game, station]);
  const pal = THEMES[game.theme].palette;
  return (
    <div>
      <p className="text-sm">Descríbele esta figura. Él tiene {t.candidates.length} parecidas y elige en su pantalla; cada error le cuesta vela al instante.</p>
      <div className="mt-3 flex justify-center rounded-3xl p-3" style={{ background: pal.paper }}>
        <Shape d={t.target} size={176} color={pal.ink} label="La figura que tienes que describir" />
      </div>
      <p className="mt-3 text-xs text-muted">Pistas que sirven: cuántas puntas, si hay agujeros, dónde está la muesca, qué lado es más gordo.</p>
    </div>
  );
}

/** The lock: the guide holds the clues; the lights are on the explorer's side. */
function GuideLock({ game, station }: { game: Game; station: Station }) {
  const t = useMemo(() => lockTrial(station.key), [station.key]);
  const pal = THEMES[game.theme].palette;
  return (
    <div>
      <p className="text-sm">
        Su cerradura pide {t.slots} símbolos{t.repeats ? " (pueden repetirse)" : " (sin repetir)"} y le contesta {t.feedback === "slots" ? "con una luz por casilla" : "solo con dos cuentas"}. Estas pistas solo las ves tú: juntas no bastan, pero con lo que le conteste la cerradura, sí.
      </p>
      <div className="mt-3 grid gap-2">
        {t.clues.map((c, i) => (
          <CluePictogram key={i} clue={c} glyphs={t.glyphs} slots={t.slots} color={pal.ink} paper={pal.paper} />
        ))}
      </div>
      <details className="mt-3 rounded-2xl border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Cómo leer las pistas</summary>
        <ClueGrammar className="mt-2" />
      </details>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted">Los símbolos (en otro orden que en su pantalla)</p>
      <div className="mt-2 grid grid-cols-8 gap-1">
        {t.guideOrder.map((g) => (
          <span key={g} className="flex aspect-square items-center justify-center rounded-xl" style={{ background: pal.paper }}>
            <Shape d={t.glyphs[g]} size={30} color={pal.ink} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The key the guide reads out once they solved it; it carries their misses. */
function DictateKey({ game, station, fails, lead, free }: { game: Game; station: Station; fails: number; lead: string; free: number }) {
  const key = formatSealKey(sealKey(game.seed, game.stations!.length, station.index, Math.min(MAX_GUIDE_FAILS, fails)));
  const paid = Math.max(0, fails - free);
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <p className="text-sm">{lead} Díctale esta clave, letra por letra:</p>
      <p className="seal-pop mt-3 rounded-2xl bg-background px-5 py-3 font-mono text-3xl font-semibold tracking-[0.2em] sm:text-4xl sm:tracking-[0.25em]" aria-label={`Clave ${key.split("").join(" ")}`}>
        {key}
      </p>
      <p className="mt-3 text-xs text-muted">
        {fails === 0
          ? "A la primera: la clave va limpia."
          : paid === 0
            ? "La clave lleva tus tropiezos, pero entran en los intentos gratis."
            : paid === 1
              ? "La clave lleva un error que cuesta: su vela lo paga al abrir."
              : `La clave lleva ${paid} errores que cuestan: su vela los paga al abrir.`}
      </p>
    </div>
  );
}

/** Piano, direction A: the explorer listens; the guide plays, checks, and dictates the key. */
function GuidePiano({ game, station, note, update }: { game: Game; station: Station; note: GuideStation; update: (f: (s: GuideStation) => GuideStation) => void }) {
  const t = useMemo(() => stationPiano(station), [station]);
  const [shake, setShake] = useState(0);
  const shakeRef = useShake<HTMLDivElement>(shake);
  if (note.solved) return <DictateKey game={game} station={station} fails={note.misses} lead="¡La bruja aplaude!" free={TUNING.trials.pianoFreeTries} />;
  const check = (answer: number[]) => {
    const right = pianoInPlace(t, answer);
    if (right === t.melody.length) {
      audio.play("seal");
      buzz([30, 40, 80]);
      update((s) => ({ ...s, solved: true, melodies: [...s.melodies, { answer, right }] }));
    } else {
      audio.play("bzzt");
      buzz([40, 30, 60]);
      setShake((n) => n + 1);
      update((s) => ({ ...s, misses: s.misses + 1, melodies: [...s.melodies, { answer, right }] }));
    }
  };
  return (
    <div ref={shakeRef}>
      <PianoPlay
        trial={t}
        draftKey={`g|${station.key}`}
        history={note.melodies}
        onCheck={check}
        footer={<MissNote misses={note.misses} free={TUNING.trials.pianoFreeTries} />}
      />
    </div>
  );
}

/** Tangram, direction A: the explorer sees the silhouette; the guide assembles. */
function GuideTangram({ game, station, note, update }: { game: Game; station: Station; note: GuideStation; update: (f: (s: GuideStation) => GuideStation) => void }) {
  const t = useMemo(() => stationTangram(station), [station]);
  const [shake, setShake] = useState(0);
  const shakeRef = useShake<HTMLDivElement>(shake);
  if (note.solved) return <DictateKey game={game} station={station} fails={note.misses} lead="¡Encaja!" free={TUNING.trials.tangramFreeTries} />;
  return (
    <div ref={shakeRef}>
      <TangramBoard
        trial={t}
        draftKey={`g|${station.key}`}
        fails={note.misses}
        onCheck={(placements) => {
          if (tangramSolved(t, placements)) {
            audio.play("seal");
            buzz([30, 40, 80]);
            update((s) => ({ ...s, solved: true }));
          } else {
            audio.play("bzzt");
            buzz([40, 30, 60]);
            setShake((n) => n + 1);
            update((s) => ({ ...s, misses: s.misses + 1 }));
          }
        }}
        footer={<MissNote misses={note.misses} free={TUNING.trials.tangramFreeTries} />}
      />
    </div>
  );
}

function MissNote({ misses, free }: { misses: number; free: number }) {
  const left = Math.max(0, free - misses);
  return (
    <p className="text-xs text-muted">
      {left > 0 ? `${left === 1 ? "Te queda 1 intento gratis" : `Te quedan ${left} intentos gratis`}; después, cada error viaja en la clave y le cuesta vela.` : "Cada error viaja en la clave y le cuesta vela al abrir."}
    </p>
  );
}
