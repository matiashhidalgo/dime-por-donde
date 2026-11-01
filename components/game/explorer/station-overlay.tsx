"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Delete, X } from "lucide-react";
import {
  type Game,
  type PlayState,
  SEAL_CODE_LENGTH,
  type Station,
  THEMES,
  type TrialResult,
  checkMelody,
  checkTangramAt,
  chooseFigure,
  enterSealKey,
  freeTries,
  lockTrial,
  normalizeCodeInput,
  stationFigures,
  stationEmblems,
  stationPiano,
  stationTangram,
  tryLock,
} from "@/src/engine";
import { audio, buzz } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Button } from "../ui";
import { PianoListen, PianoPlay } from "../piano";
import { TangramBoard, TangramSilhouette } from "../tangram";
import { Feedback, Medallion, SEAL_GOLD, Shape, TRIAL_TITLES, useShake } from "../trials";
import { FirstHint } from "../hint";

/**
 * The explorer's side of a station (GAME_SPEC_V2.md anexo etapa 2). Opens on
 * its own when they step on one; they can leave and come back, and what they
 * already tried stays (it lives in PlayState). Every action goes through the
 * engine and back to the controller, so costs, sounds and the HUD stay in one
 * place.
 */

export function StationOverlay({
  game,
  station,
  state,
  reduce,
  onResult,
  onClose,
}: {
  game: Game;
  station: Station;
  state: PlayState;
  reduce: boolean;
  onResult: (r: TrialResult) => void;
  onClose: () => void;
}) {
  const emblem = stationEmblems(game)[station.index].d;
  const sealed = (state.seals & (1 << station.index)) !== 0;
  const [shake, setShake] = useState(0);
  const shakeRef = useShake<HTMLDivElement>(shake);
  const act = (r: TrialResult | null) => {
    if (!r) return;
    if (r.events.some((e) => e.type === "trialFail")) {
      setShake((n) => n + 1);
      buzz([40, 30, 60]);
    }
    if (r.events.some((e) => e.type === "seal")) buzz([30, 40, 30, 40, 120]);
    onResult(r);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-title"
        className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Medallion d={emblem} sealed={sealed} size={40} className="shrink-0 text-foreground" />
          <div className="min-w-0 flex-1">
            <h2 id="station-title" className="font-display text-xl leading-tight">{TRIAL_TITLES[station.kind]}</h2>
            <p className="truncate text-xs text-muted">Estación · el emblema es el mismo que ve tu guía</p>
          </div>
          <button onClick={onClose} aria-label="Volver al laberinto" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
            <X size={22} />
          </button>
        </header>

        <div ref={shakeRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {!sealed && <FirstHint id={`trial-${station.kind}`} className="mb-3" />}
          {sealed ? (
            <SealWon emblem={emblem} count={state.seals} reduce={reduce} onClose={onClose} />
          ) : station.kind === "lock" ? (
            <LockPanel game={game} station={station} state={state} onAct={act} />
          ) : station.kind === "piano" ? (
            station.direction === "B" ? (
              <PianoPlay
                trial={stationPiano(station)}
                draftKey={`x|${station.key}`}
                history={state.trials[station.index].melodies}
                onCheck={(answer) => act(checkMelody(game, state, station.index, answer))}
                footer={<FreeTries used={state.trials[station.index].fails} free={freeTries(state, station)} />}
              />
            ) : (
              <>
                <PianoListen trial={stationPiano(station)} reduce={reduce} />
                <SealKeyEntry game={game} station={station} state={state} onAct={act} intro="Cuando tu guía la arme bien, te dictará una clave." />
              </>
            )
          ) : station.kind === "tangram" ? (
            station.direction === "B" ? (
              <TangramBoard
                trial={stationTangram(station)}
                draftKey={`x|${station.key}`}
                fails={state.trials[station.index].fails}
                onCheck={(placements) => act(checkTangramAt(game, state, station.index, placements))}
                footer={<FreeTries used={state.trials[station.index].fails} free={freeTries(state, station)} />}
              />
            ) : (
              <>
                <TangramSilhouette trial={stationTangram(station)} ink={THEMES[game.theme].palette.ink} paper={THEMES[game.theme].palette.paper} />
                <SealKeyEntry game={game} station={station} state={state} onAct={act} intro="Cuando tu guía la arme, te dictará una clave." />
              </>
            )
          ) : station.direction === "B" ? (
            <PickFigure game={game} station={station} state={state} onAct={act} />
          ) : (
            <DescribeFigure game={game} station={station} state={state} onAct={act} />
          )}
        </div>
      </div>
    </div>
  );
}

function SealWon({ emblem, count, reduce, onClose }: { emblem: string; count: number; reduce: boolean; onClose: () => void }) {
  let n = 0;
  for (let m = count; m; m &= m - 1) n++;
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="relative">
        <Medallion d={emblem} sealed size={120} className="seal-pop text-foreground" />
        {!reduce &&
          Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="seal-spark absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full"
              style={{ background: i % 2 ? SEAL_GOLD : "#fff6d1", ["--a" as string]: `${i * 30}deg` }}
            />
          ))}
      </div>
      <p className="mt-4 font-display text-2xl">¡Sello conseguido!</p>
      <p className="mt-1 text-sm text-muted">
        {n === 3 ? "Los tres. La salida ya se abrió: díganse adiós a este laberinto." : `Llevan ${n} de 3. La vela se reavivó.`}
      </p>
      {/* No autoFocus: the Enter that opened the seal would press it right away. */}
      <Button className="mt-5" onClick={onClose}>
        Volver al laberinto
      </Button>
    </div>
  );
}

function FreeTries({ used, free }: { used: number; free: number }) {
  const left = Math.max(0, free - used);
  return (
    <p className="text-xs text-muted">
      {left > 0 ? `${left === 1 ? "Queda 1 intento gratis" : `Quedan ${left} intentos gratis`}; después, cada fallo cuesta vela.` : "Cada fallo cuesta vela; varios seguidos, un corazón."}
    </p>
  );
}

// ── FIGURAS RARAS, direction B: the guide describes, the explorer picks ─────

function PickFigure({ game, station, state, onAct }: { game: Game; station: Station; state: PlayState; onAct: (r: TrialResult | null) => void }) {
  const t = useMemo(() => stationFigures(game, station), [game, station]);
  const pal = THEMES[game.theme].palette;
  const wrong = state.trials[station.index].wrong;
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => setPick(null), [wrong.length]);
  return (
    <div>
      <p className="text-sm">
        Tu guía tiene una de estas figuras. Pídele que te la describa y elige. <span className="text-muted">Ojo: puede que la vea girada o en espejo.</span>
      </p>
      <p className="mt-1 text-xs text-muted">Cada error cuesta vela al instante.</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {t.candidates.map((d, i) => {
          const out = wrong.includes(i);
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
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-2xl border-2 transition-transform active:scale-95",
                pick === i ? "border-foreground" : "border-transparent",
                out && "opacity-35",
              )}
              style={{ background: pal.paper }}
            >
              <Shape d={d} size={60} color={pal.ink} />
              {out && <X className="absolute text-[#c0392b]" size={44} strokeWidth={2.5} aria-hidden />}
            </button>
          );
        })}
      </div>
      <Button className="mt-4 w-full" disabled={pick === null} onClick={() => pick !== null && onAct(chooseFigure(game, state, station.index, pick))}>
        <Check size={18} /> Es esta
      </Button>
    </div>
  );
}

// ── FIGURAS RARAS, direction A: the explorer describes, the guide picks ─────

function DescribeFigure({ game, station, state, onAct }: { game: Game; station: Station; state: PlayState; onAct: (r: TrialResult | null) => void }) {
  const t = useMemo(() => stationFigures(game, station), [game, station]);
  const pal = THEMES[game.theme].palette;
  return (
    <div>
      <p className="text-sm">Descríbele esta figura a tu guía. Entre varias parecidas, tendrá que encontrarla y te dictará una clave.</p>
      <div className="mt-3 flex justify-center rounded-3xl p-3" style={{ background: pal.paper }}>
        <Shape d={t.target} size={176} color={pal.ink} label="La figura que tienes que describir" />
      </div>
      <SealKeyEntry game={game} station={station} state={state} onAct={onAct} />
    </div>
  );
}

/** Direction A: the key the guide dictates once they solved it on their side. */
function SealKeyEntry({ game, station, state, onAct, intro }: { game: Game; station: Station; state: PlayState; onAct: (r: TrialResult | null) => void; intro?: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keyErrors = state.trials[station.index].keyErrors;
  const submit = () => {
    const r = enterSealKey(game, state, station.index, text);
    if (!r) return;
    if (!r.ok) setError(r.message);
    else setError(null);
    onAct(r);
  };
  return (
    <div className="mt-4">
      {intro && <p className="mb-2 text-sm text-muted">{intro}</p>}
      <label htmlFor="seal-key" className="block text-sm font-medium">Clave del sello</label>
      <div className="mt-1 flex gap-2">
        <input
          id="seal-key"
          value={text}
          onChange={(e) => {
            const raw = normalizeCodeInput(e.target.value).text.slice(0, SEAL_CODE_LENGTH);
            setText(raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          placeholder="ABC-DEF"
          aria-invalid={!!error}
          aria-describedby="seal-key-help"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 font-mono text-xl tracking-[0.2em] uppercase outline-none focus:ring-2 focus:ring-accent"
        />
        <Button onClick={submit} disabled={text.length === 0}>
          Abrir
        </Button>
      </div>
      <p id="seal-key-help" aria-live="polite" className={cn("mt-2 min-h-5 text-sm", error ? "font-medium text-[#b23a3a] dark:text-[#ff8c8c]" : "text-muted")}>
        {error ?? "Si tu guía se equivocó antes de dar con ella, la clave lo sabe y aquí se cobra."}
      </p>
      <FreeTries used={keyErrors} free={state.rules.keyFreeTries} />
    </div>
  );
}

// ── CERRADURA DE DEDUCCIÓN ──────────────────────────────────────────────────

function LockPanel({ game, station, state, onAct }: { game: Game; station: Station; state: PlayState; onAct: (r: TrialResult | null) => void }) {
  const t = useMemo(() => lockTrial(station.key), [station.key]);
  const pal = THEMES[game.theme].palette;
  const progress = state.trials[station.index];
  const [slots, setSlots] = useState<(number | null)[]>(() => Array(t.slots).fill(null));
  useEffect(() => setSlots(Array(t.slots).fill(null)), [progress.guesses.length, t.slots]);
  const full = slots.every((s) => s !== null);
  const place = (gl: number) => {
    const at = slots.indexOf(null);
    if (at < 0 || (!t.repeats && slots.includes(gl))) return;
    audio.play("click");
    setSlots((s) => s.map((x, i) => (i === at ? gl : x)));
  };
  const glyph = (gl: number, size: number) => <Shape d={t.glyphs[gl]} size={size} color={pal.ink} />;
  return (
    <div>
      <p className="text-sm">
        Arma la combinación de {t.slots} símbolos{t.repeats ? " (se pueden repetir)" : " (sin repetir)"}. Tu guía tiene pistas; la cerradura te contesta{" "}
        {t.feedback === "slots" ? "con una luz por casilla" : "solo con dos cuentas"}.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <Legendlet light="hit" text="en su lugar" />
        <Legendlet light="near" text="está, en otro lugar" />
        {t.feedback === "slots" && <Legendlet light="miss" text="no está" />}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2" aria-label="Combinación">
        {slots.map((s, i) => (
          <button
            key={i}
            onClick={() => s !== null && setSlots((x) => x.map((v, j) => (j === i ? null : v)))}
            aria-label={s === null ? `Casilla ${i + 1} vacía` : `Quitar símbolo de la casilla ${i + 1}`}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border"
            style={s !== null ? { background: pal.paper, borderStyle: "solid" } : undefined}
          >
            {s !== null && glyph(s, 40)}
          </button>
        ))}
        <button
          onClick={() => setSlots(Array(t.slots).fill(null))}
          aria-label="Vaciar combinación"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-border/50"
        >
          <Delete size={20} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Símbolos">
        {t.explorerOrder.map((gl) => {
          const used = !t.repeats && slots.includes(gl);
          return (
            <button
              key={gl}
              onClick={() => place(gl)}
              disabled={used || full}
              aria-label={`Símbolo ${t.explorerOrder.indexOf(gl) + 1}`}
              className="flex aspect-square items-center justify-center rounded-2xl transition-transform active:scale-95 disabled:opacity-35"
              style={{ background: pal.paper }}
            >
              {glyph(gl, 44)}
            </button>
          );
        })}
      </div>

      <Button className="mt-4 w-full" disabled={!full} onClick={() => onAct(tryLock(game, state, station.index, slots as number[]))}>
        Probar
      </Button>
      <div className="mt-2">
        <FreeTries used={progress.fails} free={state.rules.lockFreeTries} />
      </div>

      {progress.guesses.length > 0 && (
        <ol className="mt-4 grid gap-1.5" aria-label="Intentos anteriores">
          {[...progress.guesses].reverse().map((g, i) => (
            <li key={progress.guesses.length - i} className="flex items-center justify-between gap-2 rounded-2xl bg-background/70 px-3 py-1.5">
              <span className="flex gap-1">
                {g.guess.map((gl, j) => (
                  <span key={j} className="rounded-lg p-0.5" style={{ background: pal.paper }}>
                    {glyph(gl, 26)}
                  </span>
                ))}
              </span>
              <Feedback fb={g.feedback} mode={t.feedback} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Legendlet({ light, text }: { light: "hit" | "near" | "miss"; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <Feedback fb={{ lights: [light], hits: 0, near: 0 }} mode="slots" />
      {text}
    </span>
  );
}
