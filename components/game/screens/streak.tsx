"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass, Flag, Heart, HeartCrack, Home, KeyRound, LifeBuoy, Map as MapIcon, Repeat, ShieldCheck, Trophy } from "lucide-react";
import { RELAY_KEY_LENGTH, type RelayState, TUNING, decodeRelay, encodeRelay, formatRelayKey, normalizeCodeInput } from "@/src/engine";
import { audio, buzz } from "@/lib/audio";
import { type HistoryEntry, ROLE_NAME, bestStreak, newEntryId, saveEntry, saveStreak } from "@/lib/history";
import { emergencyPhrase, relayPhrase, streakEndPhrase } from "@/lib/phrases";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { type Session, type StreakInfo, sealOf } from "../session";
import { Button, Card, Screen } from "../ui";
import { EmergencyHatch, ENDING_TITLE, type Ending, type ExpeditionEnd } from "./result";

/**
 * Racha screens (GAME_SPEC_V2.md anexo etapa 3). The explorer's device is the
 * referee: when a map ends it shows the relay key (index, hearts, result,
 * totals, checksum) and the other device types it in. That device is the one
 * that explores next — roles swap on every map — so it needs the hearts.
 */

const mapLine = (ending: Ending, seed: string, index: number, seals: number) =>
  ending === "escaped" ? emergencyPhrase(`${seed}#${index}`, seals) : ending === "won" ? `Mapa ${index + 1}, superado. Que no se les suba.` : `El mapa ${index + 1} se los tragó.`;

/** One map of the streak in this device's history (v1 deploys read it as an ordinary round). */
function useMapEntry(session: Session, end: ExpeditionEnd, resumed: boolean) {
  const [id] = useState(newEntryId);
  const [date] = useState(() => new Date().toISOString());
  const save = (patch: Partial<HistoryEntry>) => {
    if (resumed) return;
    const m = end.measured;
    saveEntry({
      id,
      code: session.code,
      mode: session.mode,
      level: session.game.level,
      round: session.streak!.index + 1,
      streakIndex: session.streak!.index,
      role: session.role,
      date,
      result: end.ending === "lost" ? "lost" : "won",
      ending: end.ending,
      timeMs: end.timeMs,
      pits: m?.pits ?? 0,
      hearts: m?.hearts,
      seals: m?.seals,
      stars: m?.stars ?? 0,
      rating: 0,
      ...patch,
    });
  };
  return save;
}

export function StreakResultScreen({
  session,
  end,
  relay,
  resumed = false,
  onAccept,
}: {
  session: Session;
  end: ExpeditionEnd;
  /** The explorer's device: the key it shows. Absent on the guide's device, which types it. */
  relay?: RelayState;
  resumed?: boolean;
  /** The relay state both devices go on with. */
  onAccept: (r: RelayState) => void;
}) {
  const st = session.streak!;
  const reduce = usePrefersReducedMotion();
  const save = useMapEntry(session, end, resumed);
  useEffect(() => {
    save({});
    track(`streak_map_${end.ending}`, { role: session.role, index: st.index });
    // Saved once; the guide's entry is completed when the key arrives.
  }, []);

  const seals = end.measured?.seals ?? (relay ? relay.seals - st.seals : end.ending === "won" ? 3 : 1);
  return (
    <Screen>
      <div className="pt-6 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">{ENDING_TITLE[end.ending]}</p>
        <p className="mt-1 text-xs text-muted">
          Racha · mapa {st.index + 1} · jugaste como {ROLE_NAME[session.role].toLowerCase()}
        </p>
        <div className="mt-4 flex justify-center" aria-hidden>
          {end.ending === "escaped" ? (
            <EmergencyHatch reduce={reduce} />
          ) : end.ending === "won" ? (
            <Trophy size={64} className="text-[#a5700f]" />
          ) : (
            <HeartCrack size={64} className="text-muted" />
          )}
        </div>
        <p className="mx-auto mt-3 max-w-sm text-balance font-display text-xl italic">{mapLine(end.ending, session.code, st.index, seals)}</p>
      </div>

      {relay ? (
        <RelayShow streakCode={session.code} relay={relay} onAccept={onAccept} />
      ) : (
        <RelayEntry
          session={session}
          guess={end.ending}
          onAccept={(r) => {
            save({ result: r.result === "lost" ? "lost" : "won", ending: r.result, hearts: r.hearts, seals: r.seals - st.seals });
            onAccept(r);
          }}
        />
      )}
    </Screen>
  );
}

/** The explorer's device: the key in groups of three, to read aloud. */
function RelayShow({ streakCode, relay, onAccept }: { streakCode: string; relay: RelayState; onAccept: (r: RelayState) => void }) {
  const code = useMemo(() => encodeRelay(streakCode, relay), [streakCode, relay]);
  const groups = formatRelayKey(code).split("-");
  return (
    <>
      <Card className="mt-6 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-medium">
          <KeyRound size={18} /> Clave de relevo
        </p>
        <p className="mt-1 text-sm text-muted">Díctasela a tu pareja de a tres letras. Con ella, su pantalla sabe cómo siguen.</p>
        <p className="mt-4 flex justify-center gap-2 font-mono text-3xl font-semibold tracking-[0.12em] sm:gap-3 sm:text-4xl sm:tracking-[0.18em]" aria-label={`Clave ${code.split("").join(" ")}`}>
          {groups.map((g, i) => (
            <span key={i} className="rounded-2xl bg-background px-2.5 py-2 sm:px-3">
              {g}
            </span>
          ))}
        </p>
        <StreakTally hearts={relay.hearts} seals={relay.seals} heartsLost={relay.heartsLost} className="mt-4" />
      </Card>
      <Button
        size="lg"
        className="mt-6 w-full"
        onClick={() => {
          audio.play(relay.result === "lost" ? "streakEnd" : "relay");
          onAccept(relay);
        }}
      >
        {relay.result === "lost" ? (
          <>
            <Flag size={20} /> Ver cómo les fue
          </>
        ) : (
          <>
            <Repeat size={20} /> Ya la anotó: siguiente mapa
          </>
        )}
      </Button>
    </>
  );
}

/** The other device: type the key, or go on by honor. */
function RelayEntry({ session, guess, onAccept }: { session: Session; guess: Ending; onAccept: (r: RelayState) => void }) {
  const st = session.streak!;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [honor, setHonor] = useState(false);
  const submit = () => {
    const r = decodeRelay(session.code, st.index, text);
    if (!r.ok) {
      setError(r.message);
      audio.play("bzzt");
      buzz([40, 30, 60]);
      return;
    }
    audio.play(r.value.result === "lost" ? "streakEnd" : "relay");
    buzz([30, 40, 30]);
    onAccept(r.value);
  };
  return (
    <>
      <Card className="mt-6">
        <label htmlFor="relay-key" className="flex items-center gap-2 text-sm font-medium">
          <KeyRound size={18} /> Clave de relevo
        </label>
        <p className="mt-1 text-sm text-muted">Pídele a tu pareja la clave que ve en su pantalla. Son {RELAY_KEY_LENGTH} letras, de a tres.</p>
        <div className="mt-3 flex gap-2">
          <input
            id="relay-key"
            value={text}
            onChange={(e) => {
              const raw = normalizeCodeInput(e.target.value).text.slice(0, RELAY_KEY_LENGTH);
              setText(raw.replace(/(.{3})(?=.)/g, "$1-"));
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABC-DEF-GHK"
            aria-invalid={!!error}
            aria-describedby="relay-help"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 font-mono text-lg uppercase tracking-[0.14em] outline-none focus:ring-2 focus:ring-accent sm:text-xl"
          />
          <Button onClick={submit} disabled={text.length === 0}>
            Seguir
          </Button>
        </div>
        <p id="relay-help" aria-live="polite" className={cn("mt-2 min-h-5 text-sm", error ? "font-medium text-[#b23a3a] dark:text-[#ff8c8c]" : "text-muted")}>
          {error ?? "Las letras confundibles (0/O, 1/I) no existen: si dudas, es la letra."}
        </p>
      </Card>

      {!honor ? (
        <Button variant="ghost" className="mt-4 w-full text-muted" onClick={() => setHonor(true)}>
          No tengo la clave
        </Button>
      ) : (
        <HonorFallback st={st} guess={guess} onAccept={onAccept} />
      )}
    </>
  );
}

/**
 * Without the key (their screen closed, the call dropped…): the pair says how
 * many hearts are left and goes on by honor. Totals are a best guess.
 */
function HonorFallback({ st, guess, onAccept }: { st: StreakInfo; guess: Ending; onAccept: (r: RelayState) => void }) {
  const escapeHearts = TUNING.streak.heartsAfterEscape;
  const [hearts, setHearts] = useState(guess === "escaped" ? escapeHearts : Math.min(st.hearts, TUNING.hearts));
  const [seals, setSeals] = useState(guess === "won" ? 3 : 1);
  const go = () => {
    const lost = guess === "lost";
    const h = lost ? 0 : hearts;
    audio.play(lost ? "streakEnd" : "relay");
    onAccept({
      index: st.index,
      hearts: h,
      result: guess,
      escapes: Math.min(15, st.escapes + (guess === "escaped" ? 1 : 0)),
      seals: Math.min(255, st.seals + (lost ? 0 : seals)),
      heartsLost: Math.min(127, st.heartsLost + Math.max(0, st.hearts - h)),
    });
  };
  return (
    <Card className="mt-4">
      <p className="flex items-center gap-2 font-medium">
        <ShieldCheck size={18} /> Por honor
      </p>
      <p className="mt-1 text-sm text-muted">Sin clave, la racha sigue con lo que ustedes digan. Nadie está mirando… salvo ustedes dos.</p>
      {guess === "lost" ? (
        <p className="mt-3 text-sm">Dijiste que quedaron atrapados: la racha termina aquí.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm">¿Con cuántos corazones siguen?</span>
            <Stepper label="corazones" value={hearts} min={1} max={guess === "escaped" ? escapeHearts : TUNING.hearts} onChange={setHearts} />
          </div>
          {guess === "escaped" && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm">¿Cuántos sellos alcanzaron?</span>
              <Stepper label="sellos" value={seals} min={1} max={2} onChange={setSeals} />
            </div>
          )}
        </>
      )}
      <Button className="mt-5 w-full" onClick={go}>
        {guess === "lost" ? "Terminar la racha" : "Seguir por honor"}
      </Button>
    </Card>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        aria-label={`Menos ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40 disabled:opacity-35"
      >
        −
      </button>
      <span className="w-6 text-center font-display text-2xl tabular-nums" aria-live="polite" aria-label={`${value} ${label}`}>
        {value}
      </span>
      <button
        aria-label={`Más ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-border/40 disabled:opacity-35"
      >
        +
      </button>
    </div>
  );
}

function StreakTally({ hearts, seals, heartsLost, className }: { hearts: number; seals: number; heartsLost: number; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm", className)}>
      {hearts > 0 && <HeartRow value={hearts} />}
      <span className="text-muted">
        {seals === 1 ? "1 sello" : `${seals} sellos`} en la racha · {heartsLost === 1 ? "1 corazón perdido" : `${heartsLost} corazones perdidos`}
      </span>
    </div>
  );
}

function HeartRow({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={value === 1 ? "1 corazón" : `${value} corazones`}>
      {Array.from({ length: TUNING.hearts }, (_, i) => (
        <Heart key={i} size={18} strokeWidth={2.2} className={i < value ? "fill-[#c2414b] text-[#c2414b]" : "text-muted opacity-60"} />
      ))}
    </span>
  );
}

/**
 * Between two maps: who explores now (always the other one), the hearts they
 * carry, and the seal of the next map to compare out loud.
 */
export function NextMapScreen({ session, lastResult, onStart, onHome }: { session: Session; lastResult: "won" | "escaped"; onStart: () => void; onHome: () => void }) {
  const st = session.streak!;
  const explorer = session.role === "explorer";
  const Icon = explorer ? Compass : MapIcon;
  return (
    <Screen>
      <div className="pt-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Racha · mapa {st.index + 1}</p>
        <span className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/15 text-accent">
          <Icon size={40} />
        </span>
        <h1 className="mt-4 font-display text-3xl">Ahora tú eres {explorer ? "el Explorador" : "la Guía"}</h1>
        <p className="mx-auto mt-3 max-w-sm text-balance text-muted">{relayPhrase(session.code, st.index, lastResult)}</p>
      </div>

      <Card className="mt-6">
        <StreakTally hearts={st.hearts} seals={st.seals} heartsLost={st.heartsLost} />
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-background/70 p-3">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-accent-2" />
          <div>
            <p className="text-sm text-muted">Sello del mapa {st.index + 1}: debe coincidir en las dos pantallas.</p>
            <p className="mt-1 font-display text-2xl">{sealOf(session.game)}</p>
          </div>
        </div>
        {st.escapes > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <LifeBuoy size={16} className="shrink-0" />
            {st.escapes === 1 ? "Ya usaron 1 salida de emergencia" : `Ya usaron ${st.escapes} salidas de emergencia`}: la vela se encoge más rápido.
          </p>
        )}
      </Card>

      <Button size="lg" className="mt-6 w-full" onClick={onStart}>
        Empezar el mapa {st.index + 1}
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-muted" onClick={onHome}>
        <Home size={18} /> Dejar la racha aquí
      </Button>
    </Screen>
  );
}

export interface StreakSummary {
  maps: number;
  seals: number;
  heartsLost: number;
  escapes: number;
}

export const summaryOf = (r: RelayState): StreakSummary => ({ maps: r.index, seals: r.seals, heartsLost: r.heartsLost, escapes: r.escapes });

export function StreakEndScreen({ code, summary, onAgain, onHome }: { code: string; summary: StreakSummary; onAgain: () => void; onHome: () => void }) {
  // One record per streak code: two tabs (or a replay) of the same Racha don't count twice.
  const id = code;
  const best = useMemo(() => bestStreak(id), [id]);
  useEffect(() => {
    saveStreak({ id, code, date: new Date().toISOString(), ...summary, end: "lost" });
    track("streak_end", { maps: summary.maps });
  }, [id, code, summary]);
  const record = summary.maps > 0 && summary.maps > best;
  return (
    <Screen>
      <div className="pt-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Fin de la racha</p>
        <p className="mt-4 font-display text-7xl tabular-nums">{summary.maps}</p>
        <p className="text-muted">{summary.maps === 1 ? "mapa superado" : "mapas superados"}</p>
        {record && (
          <p className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-[#f2b84b]/25 px-3 py-1 text-sm font-medium text-[#6b4a0c] dark:text-[#ffe08a]">
            <Trophy size={16} /> Nuevo récord en este dispositivo
          </p>
        )}
        <p className="mx-auto mt-4 max-w-sm text-balance font-display text-xl italic">{streakEndPhrase(code, summary.maps)}</p>
      </div>
      <Card className="mt-6 p-0 sm:p-0">
        <div className="grid grid-cols-3 divide-x divide-border text-center">
          <Tally label="Sellos" value={summary.seals} />
          <Tally label="Corazones perdidos" value={summary.heartsLost} />
          <Tally label="Huidas" value={summary.escapes} />
        </div>
      </Card>
      {!record && best > 0 && <p className="mt-3 text-center text-sm text-muted">Su mejor racha aquí: {best === 1 ? "1 mapa" : `${best} mapas`}.</p>}
      <div className="mt-6 grid gap-3">
        <Button size="lg" onClick={onAgain}>
          <Repeat size={20} /> Otra racha
        </Button>
        <Button variant="secondary" onClick={onHome}>
          <Home size={18} /> Volver al inicio
        </Button>
      </div>
    </Screen>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-1 py-4">
      <p className="text-[11px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}
