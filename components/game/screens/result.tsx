"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Compass, Home, Map as MapIcon, Minus, Plus, Repeat, X as XIcon } from "lucide-react";
import { motion } from "motion/react";
import { DIFFICULTIES, PIT_PENALTY_SECONDS, PIT_TOLERANCE, SLOW_FACTOR, parSeconds, rateBreakdown } from "@/src/engine";
import { formatTime, usePrefersReducedMotion } from "@/lib/hooks";
import { type HistoryEntry, ROLE_NAME, newEntryId, saveEntry } from "@/lib/history";
import { duoPhrase, resultPhrase } from "@/lib/phrases";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { type RoundRecord, type Session, otherRole } from "../session";
import { Button, Card, Screen, Stars } from "../ui";

/**
 * End of a round, the same layout for both roles. The explorer's game
 * measured pits and stars itself; the guide never sees them happen, so the
 * same numbers get small +/− buttons and a "pregúntale" hint.
 * After the last duo round, a summary of the three rounds follows.
 */
export function ResultScreen({
  session,
  timeMs,
  measured,
  previous,
  onNextRound,
  onSwapAndNew,
  onHome,
}: {
  session: Session;
  timeMs: number;
  /** Real counts from the explorer's game; absent for the guide. */
  measured?: { pits: number; stars: number };
  /** Earlier duo rounds, as this device recorded them. */
  previous: RoundRecord[];
  onNextRound: (record: RoundRecord) => void;
  onSwapAndNew: () => void;
  onHome: () => void;
}) {
  const game = session.games[session.round];
  const maxStars = DIFFICULTIES[game.level].stars;
  const reduce = usePrefersReducedMotion();
  const [pits, setPits] = useState(measured?.pits ?? 0);
  const [stars, setStars] = useState(measured?.stars ?? 0);
  const [id] = useState(newEntryId);
  const [date] = useState(() => new Date().toISOString());

  const recordedTime = session.timed ? timeMs + pits * PIT_PENALTY_SECONDS * 1000 : null;
  const par = parSeconds(game);
  const why = rateBreakdown(game, { timeMs: recordedTime, pits, stars });
  const rating = why.rating;
  const phrase = useMemo(
    () =>
      resultPhrase({
        seed: `${session.code}-${session.round}`,
        pits,
        stars,
        maxStars,
        rating,
        timed: session.timed,
        pace: recordedTime === null ? null : recordedTime / 1000 / par,
      }),
    [session.code, session.round, pits, stars, maxStars, rating, session.timed, recordedTime, par],
  );

  // Save immediately (so nothing is lost) and again whenever the numbers change.
  useEffect(() => {
    const entry: HistoryEntry = {
      id,
      code: session.code,
      mode: session.mode,
      level: game.level,
      round: session.round + 1,
      role: session.role,
      date,
      result: "won",
      timeMs: recordedTime,
      pits,
      stars,
      rating,
    };
    saveEntry(entry);
  }, [id, date, session, game.level, recordedTime, pits, stars, rating]);

  useEffect(() => {
    track("round_won", { level: game.level, role: session.role, timed: session.timed });
  }, [game.level, session.role, session.timed]);

  const record: RoundRecord = { round: session.round, role: session.role, level: game.level, timeMs: recordedTime, pits, stars, rating };
  const isDuo = session.mode === "duo";
  const moreRounds = isDuo && session.round < session.games.length - 1;
  const duoDone = isDuo && !moreRounds;
  const allRounds = duoDone ? [...previous.filter((r) => r.round < session.round), record] : [];

  return (
    <Screen>
      <div className="relative pt-6 text-center">
        {!reduce && <Confetti />}
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
          {isDuo ? `Ronda ${session.round + 1} de ${session.games.length} · ¡Llegaron!` : "¡Llegaron!"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {DIFFICULTIES[game.level].name} · jugaste como {ROLE_NAME[session.role].toLowerCase()}
        </p>

        <div className="mt-4" aria-live="polite">
          <RatingStars value={rating} reduce={reduce} />
          <p className="sr-only">Calificación: {rating} de 3</p>
        </div>

        <ul className="mt-3 flex flex-wrap justify-center gap-1.5 text-xs" aria-label="Por qué esta calificación">
          {why.onTime !== null && <Reason ok={why.onTime} text={why.onTime ? "A buen ritmo" : "Un poco lentos"} />}
          <Reason ok={why.fewPits} text={why.fewPits ? `Menos de ${PIT_TOLERANCE[game.level]} caídas` : "Muchas caídas"} />
          <Reason ok={why.allStars} bonus text={why.allStars ? "Todas las estrellas (+1)" : "Faltaron estrellas"} />
        </ul>

        {session.timed ? (
          <>
            <p className="mt-5 font-display text-6xl tabular-nums">{formatTime(recordedTime ?? 0)}</p>
            <p className="mt-1 text-sm text-muted">
              {pits > 0 && `incluye +${pits * PIT_PENALTY_SECONDS} s de pozos · `}
              referencia {formatTime(par * 1000)}, ritmo hasta {formatTime(par * SLOW_FACTOR * 1000)}
            </p>
          </>
        ) : (
          <p className="mt-5 font-display text-4xl">Sin reloj, sin prisa</p>
        )}
        <p className="mx-auto mt-4 flex min-h-[3.5rem] max-w-sm items-center justify-center text-balance font-display text-xl italic">{phrase}</p>
      </div>

      <Card className="mt-5 p-0 sm:p-0">
        <div className="grid grid-cols-2 divide-x divide-border text-center">
          <Stat label="Estrellas del mapa" value={stars} max={maxStars} onChange={measured ? undefined : setStars} star />
          <Stat label="Caídas en pozos" value={pits} max={99} onChange={measured ? undefined : setPits} />
        </div>
        {!measured && <p className="border-t border-border px-4 py-2.5 text-center text-sm text-muted">Pregúntale a tu pareja y anótalo aquí.</p>}
      </Card>

      {duoDone && <DuoSummary rounds={allRounds} seed={session.code} timed={session.timed} />}

      <div className="mt-6 grid gap-3">
        {moreRounds ? (
          <Button size="lg" onClick={() => onNextRound(record)}>
            Ronda {session.round + 2}: ahora eres {ROLE_NAME[otherRole(session.role)].toLowerCase()} <ArrowRight size={20} />
          </Button>
        ) : (
          <Button size="lg" onClick={onSwapAndNew}>
            <Repeat size={20} /> Intercambiar roles y jugar otra
          </Button>
        )}
        <Button variant="secondary" onClick={onHome}>
          <Home size={18} /> Volver al inicio
        </Button>
      </div>
    </Screen>
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

function Stat({ label, value, max, onChange, star = false }: { label: string; value: number; max: number; onChange?: (v: number) => void; star?: boolean }) {
  return (
    <div className="px-2 py-4">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <div className="mt-1 flex items-center justify-center gap-1">
        {onChange && (
          <button
            aria-label={`Menos ${label.toLowerCase()}`}
            onClick={() => onChange(Math.max(0, value - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40"
          >
            <Minus size={16} />
          </button>
        )}
        <p className="min-w-[4.5rem] font-display text-3xl tabular-nums" aria-live="polite">
          {value}
          {star && <span className="text-lg text-muted"> / {max}</span>}
        </p>
        {onChange && (
          <button
            aria-label={`Más ${label.toLowerCase()}`}
            onClick={() => onChange(Math.min(max, value + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function DuoSummary({ rounds, seed, timed }: { rounds: RoundRecord[]; seed: string; timed: boolean }) {
  const ratingSum = rounds.reduce((s, r) => s + r.rating, 0);
  const pits = rounds.reduce((s, r) => s + r.pits, 0);
  const stars = rounds.reduce((s, r) => s + r.stars, 0);
  const time = timed && rounds.every((r) => r.timeMs !== null) ? rounds.reduce((s, r) => s + (r.timeMs ?? 0), 0) : null;
  return (
    <Card className="mt-5">
      <h2 className="font-display text-2xl">Resumen del dúo</h2>
      <p className="mt-1 text-sm italic text-muted">{duoPhrase({ seed, ratingSum, pits })}</p>
      <ol className="mt-4 divide-y divide-border">
        {rounds.map((r) => {
          const RoleIcon = r.role === "explorer" ? Compass : MapIcon;
          return (
            <li key={r.round} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-16 shrink-0 font-medium">Ronda {r.round + 1}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-muted">
                <RoleIcon size={15} className="shrink-0" />
                <span className="truncate">
                  {DIFFICULTIES[r.level].name} · {ROLE_NAME[r.role].toLowerCase()}
                </span>
              </span>
              {r.timeMs !== null && <span className="tabular-nums">{formatTime(r.timeMs)}</span>}
              <Stars value={r.rating} size={15} />
            </li>
          );
        })}
      </ol>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-background/70 p-3 text-center">
        <Total label="Calificación" value={`${ratingSum} / ${rounds.length * 3}`} />
        <Total label="Estrellas" value={`${stars} / ${rounds.reduce((s, r) => s + DIFFICULTIES[r.level].stars, 0)}`} />
        <Total label={time !== null ? "Tiempo total" : "Caídas"} value={time !== null ? formatTime(time) : String(pits)} />
      </div>
      {time !== null && <p className="mt-2 text-center text-xs text-muted">{pits === 1 ? "1 caída" : `${pits} caídas`} en total</p>}
    </Card>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 font-display text-xl tabular-nums">{value}</p>
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
