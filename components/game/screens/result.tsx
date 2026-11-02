"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Heart, Home, Minus, Plus, Repeat, X as XIcon } from "lucide-react";
import { motion } from "motion/react";
import { DIFFICULTIES, TUNING, rateBreakdown } from "@/src/engine";
import { formatTime, usePrefersReducedMotion } from "@/lib/hooks";
import { type HistoryEntry, ROLE_NAME, newEntryId, saveEntry } from "@/lib/history";
import { emergencyPhrase, resultPhrase } from "@/lib/phrases";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { Session } from "../session";
import { Button, Card, Screen, Stars } from "../ui";

/**
 * Graded endings (anexo etapa 3): «won» = the 3 seals and the exit (or just
 * the exit on a v1 code), «escaped» = the emergency exit with 1–2 seals,
 * «lost» = trapped, no hearts left.
 */
export type Ending = "won" | "escaped" | "lost";

export interface ExpeditionEnd {
  ending: Ending;
  /** Informative only: time doesn't count toward the rating (v2). */
  timeMs: number;
  /** Real counts from the explorer's game; absent for the guide, who enters them. */
  measured?: { hearts: number; pits: number; stars: number; seals: number; hurts: number };
}

/**
 * End of an expedition, the same layout for both roles: victory (rating from
 * hearts kept + all stars) or defeat (no hearts left, told with humor). The
 * guide never sees hearts, falls or stars happen, so they get +/− steppers
 * and a "pregúntale" hint; the explorer's numbers are measured.
 */
export function ResultScreen({
  session,
  end,
  onSwapAndNew,
  onHome,
}: {
  session: Session;
  end: ExpeditionEnd;
  onSwapAndNew: () => void;
  onHome: () => void;
}) {
  const { game } = session;
  const { measured } = end;
  const escaped = end.ending !== "lost";
  const emergency = end.ending === "escaped";
  const maxStars = DIFFICULTIES[game.level].stars;
  const maxHearts = TUNING.hearts;
  const reduce = usePrefersReducedMotion();
  const [hearts, setHearts] = useState(measured?.hearts ?? (escaped ? maxHearts : 0));
  const [pits, setPits] = useState(measured?.pits ?? 0);
  const [stars, setStars] = useState(measured?.stars ?? 0);
  const maxSeals = game.stations?.length ?? 0;
  const [seals, setSeals] = useState(measured?.seals ?? (end.ending === "won" ? maxSeals : emergency ? 1 : 0));
  const [id] = useState(newEntryId);
  const [date] = useState(() => new Date().toISOString());

  const why = rateBreakdown(game, { escaped, hearts, stars });
  // An emergency exit is its own ending: no rating stars, just the seals they got.
  const rating = emergency ? 0 : why.rating;
  const phrase = useMemo(
    () => (emergency ? emergencyPhrase(session.code, seals) : resultPhrase({ seed: session.code, escaped, hearts, maxHearts, pits, stars, maxStars })),
    [session.code, emergency, seals, escaped, hearts, maxHearts, pits, stars, maxStars],
  );

  // Save immediately (so nothing is lost) and again whenever the numbers change.
  useEffect(() => {
    const entry: HistoryEntry = {
      id,
      code: session.code,
      mode: session.mode,
      level: game.level,
      round: 1,
      role: session.role,
      date,
      // v1 deploys read this list too: an emergency exit is stored as "won" + ending.
      result: escaped ? "won" : "lost",
      ending: end.ending,
      seals,
      timeMs: end.timeMs,
      pits,
      hearts,
      stars,
      rating,
    };
    saveEntry(entry);
  }, [id, date, session, game.level, escaped, end.ending, seals, end.timeMs, pits, hearts, stars, rating]);

  useEffect(() => {
    track(end.ending === "won" ? "expedition_won" : end.ending === "escaped" ? "expedition_escaped" : "expedition_lost", { role: session.role });
  }, [end.ending, session.role]);

  const guide = !measured;

  return (
    <Screen>
      <div className="relative pt-6 text-center">
        {end.ending === "won" && !reduce && <Confetti />}
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">{ENDING_TITLE[end.ending]}</p>
        <p className="mt-1 text-xs text-muted">Jugaste como {ROLE_NAME[session.role].toLowerCase()}</p>

        {emergency ? (
          <div className="mt-5 flex flex-col items-center" aria-hidden>
            <EmergencyHatch reduce={reduce} />
          </div>
        ) : escaped ? (
          <>
            <div className="mt-4" aria-live="polite">
              <RatingStars value={rating} reduce={reduce} />
              <p className="sr-only">Calificación: {rating} de 3</p>
            </div>
            <ul className="mt-3 flex flex-wrap justify-center gap-1.5 text-xs" aria-label="Por qué esta calificación">
              <Reason ok={hearts === maxHearts} bonus text={hearts === 1 ? "Salieron con 1 corazón" : `Salieron con ${hearts} corazones`} />
              <Reason ok={why.allStars} bonus text={why.allStars ? "Todas las estrellas (+1)" : "Faltaron estrellas"} />
            </ul>
          </>
        ) : (
          <div className="mt-5 flex flex-col items-center" aria-hidden>
            <SpentCandle reduce={reduce} />
          </div>
        )}

        <p className="mx-auto mt-4 flex min-h-[3.5rem] max-w-sm items-center justify-center text-balance font-display text-xl italic">{phrase}</p>
      </div>

      <Card className="mt-5 p-0 sm:p-0">
        <div className={cn("grid divide-x divide-border text-center", maxSeals ? "grid-cols-4" : "grid-cols-3")}>
          <Stat
            label="Corazones"
            value={hearts}
            max={maxHearts}
            min={escaped ? 1 : 0}
            onChange={guide && escaped ? setHearts : undefined}
            render={(v) => <HeartRow value={v} max={maxHearts} />}
          />
          {maxSeals > 0 && (
            <Stat
              label="Sellos"
              value={seals}
              min={emergency ? 1 : 0}
              max={emergency ? maxSeals - 1 : maxSeals}
              onChange={guide && end.ending !== "won" ? setSeals : undefined}
              suffix={`/ ${maxSeals}`}
            />
          )}
          <Stat label="Estrellas" value={stars} max={maxStars} onChange={guide ? setStars : undefined} suffix={`/ ${maxStars}`} />
          <Stat label="Caídas" value={pits} max={99} onChange={guide ? setPits : undefined} />
        </div>
        {guide && <p className="border-t border-border px-4 py-2.5 text-center text-sm text-muted">Pregúntale a tu pareja y anótalo aquí.</p>}
      </Card>

      <p className="mt-3 text-center text-sm text-muted">
        Tiempo: <span className="tabular-nums">{formatTime(end.timeMs)}</span> · solo como dato, no cuenta para la calificación
      </p>

      <div className="mt-6 grid gap-3">
        <Button size="lg" onClick={onSwapAndNew}>
          <Repeat size={20} /> {end.ending === "won" ? "Intercambiar roles y jugar otra" : "Revancha con roles cambiados"}
        </Button>
        <Button variant="secondary" onClick={onHome}>
          <Home size={18} /> Volver al inicio
        </Button>
      </div>
    </Screen>
  );
}

export const ENDING_TITLE: Record<Ending, string> = {
  won: "¡Escaparon!",
  escaped: "Salida de emergencia",
  lost: "Atrapados",
};

/** A hatch in the floor, lid open, with a little trail of dust: the way out nobody brags about. */
export function EmergencyHatch({ reduce }: { reduce: boolean }) {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="text-muted">
      <rect x="18" y="58" width="60" height="26" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="26" y="64" width="44" height="14" rx="2" fill="currentColor" opacity="0.7" />
      <motion.g
        style={{ transformOrigin: "26px 58px" }}
        initial={reduce ? false : { rotate: 0 }}
        animate={{ rotate: -62 }}
        transition={{ type: "spring", bounce: 0.4, duration: 0.9 }}
      >
        <rect x="26" y="52" width="44" height="6" rx="2" fill="currentColor" opacity="0.6" />
      </motion.g>
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={58 + i * 9}
          cy={50 - i * 8}
          r={3 - i * 0.6}
          fill="currentColor"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 0.45, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.5 + i * 0.15 }}
        />
      ))}
    </svg>
  );
}

/** Filled hearts for the ones kept, outlines for the lost ones (shape + color). */
function HeartRow({ value, max }: { value: number; max: number }) {
  return (
    <span className="flex items-center justify-center gap-0.5" role="img" aria-label={`${value} de ${max} corazones`}>
      {Array.from({ length: max }, (_, i) => (
        <Heart
          key={i}
          size={20}
          strokeWidth={2.2}
          className={i < value ? "fill-[#c2414b] text-[#c2414b]" : "text-muted opacity-60"}
        />
      ))}
    </span>
  );
}

/** A candle that just went out: a stub, a wick and a curl of smoke. */
function SpentCandle({ reduce }: { reduce: boolean }) {
  return (
    <svg width="72" height="96" viewBox="0 0 72 96" className="text-muted">
      <motion.path
        d="M36 40c-6-6 6-10 0-16s6-10 0-16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.55 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      <line x1="36" y1="44" x2="36" y2="52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="24" y="52" width="24" height="34" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="14" y="86" width="44" height="6" rx="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function RatingStars({ value, reduce }: { value: number; reduce: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Calificación</span>
      <div className="mt-1 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={`${i}-${i < value}`}
            initial={reduce ? false : { scale: 0.3, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.55, delay: reduce ? 0 : 0.15 + i * 0.16 }}
          >
            <Stars value={i < value ? 1 : 0} max={1} size={54} />
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function Reason({ ok, text, bonus = false }: { ok: boolean; text: string; bonus?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-1",
        ok ? "bg-[#2f6e4a]/12 text-[#2f6e4a] dark:text-[#8fd6a8]" : bonus ? "bg-border/40 text-muted" : "bg-[#9b2d3a]/10 text-[#9b2d3a] dark:text-[#f0a0aa]",
      )}
    >
      {ok ? <Check size={13} /> : bonus ? <Minus size={13} /> : <XIcon size={13} />}
      {text}
    </li>
  );
}

function Stat({
  label,
  value,
  max,
  min = 0,
  onChange,
  suffix,
  render,
}: {
  label: string;
  value: number;
  max: number;
  min?: number;
  onChange?: (v: number) => void;
  suffix?: string;
  render?: (v: number) => React.ReactNode;
}) {
  return (
    <div className="px-1 py-4">
      <p className="text-[11px] uppercase tracking-widest text-muted">{label}</p>
      <div className="mt-1 flex min-h-11 items-center justify-center" aria-live="polite">
        {render ? (
          render(value)
        ) : (
          <p className="font-display text-3xl tabular-nums">
            {value}
            {suffix && <span className="text-lg text-muted"> {suffix}</span>}
          </p>
        )}
      </div>
      {onChange && (
        <div className="mt-1 flex justify-center gap-2">
          <button
            aria-label={`Menos ${label.toLowerCase()}`}
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40 disabled:opacity-35"
          >
            <Minus size={16} />
          </button>
          <button
            aria-label={`Más ${label.toLowerCase()}`}
            disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40 disabled:opacity-35"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/** A short, light paper-confetti burst behind the header (skipped with reduced motion). */
function Confetti() {
  const colors = ["#e07a5f", "#f2b84b", "#3d9a5f", "#3d6fd8", "#d6589f", "#2a8a80"];
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-0 overflow-visible" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => {
        const x = ((i * 47) % 100) - 50;
        const drift = ((i * 29) % 40) - 20;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-0 block h-2.5 w-1.5 rounded-[2px]"
            style={{ backgroundColor: colors[i % colors.length] }}
            initial={{ x: 0, y: 40, opacity: 0, rotate: 0 }}
            animate={{ x: `${x * 3.2 + drift}px`, y: [40, -30 - (i % 5) * 14, 240 + (i % 4) * 40], opacity: [0, 1, 1, 0], rotate: (i % 2 ? 1 : -1) * (180 + i * 20) }}
            transition={{ duration: 1.8 + (i % 5) * 0.15, ease: "easeOut", delay: (i % 6) * 0.04 }}
          />
        );
      })}
    </div>
  );
}
