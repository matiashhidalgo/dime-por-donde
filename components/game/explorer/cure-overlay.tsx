"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import {
  CURE_KEY_LENGTH,
  type Curse,
  type Game,
  type PlayState,
  THEMES,
  type TrialResult,
  echoCure,
  enterCureKey,
  normalizeCodeInput,
  sigilCure,
} from "@/src/engine";
import { buzz } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Button } from "../ui";
import { Shape, useShake } from "../trials";
import { CURSE_NAME } from "./messages";
import { FirstHint } from "../hint";

/**
 * The explorer's side of a cure (GAME_SPEC_V2.md anexo etapa 3). What they
 * see (a sigil, or glyphs blinking in order) comes from the game seed and the
 * curse number k; the notches say k + 1 so the guide can pick the same curse
 * on their counter. The guide solves it on their device and dictates a key;
 * wrong keys are free, the key carries the guide's mistakes.
 */
export function CureOverlay({
  game,
  curse,
  state,
  reduce,
  onResult,
  onClose,
}: {
  game: Game;
  curse: Curse;
  state: PlayState;
  reduce: boolean;
  onResult: (r: TrialResult) => void;
  onClose: () => void;
}) {
  const pal = THEMES[game.theme].palette;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const shakeRef = useShake<HTMLDivElement>(shake);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const r = enterCureKey(game, state, text);
    if (!r) return;
    if (!r.ok) {
      setError(r.message);
      setShake((n) => n + 1);
      buzz([40, 30, 60]);
      return;
    }
    buzz([30, 40, 30, 40, 120]);
    onResult(r);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-labelledby="cure-title" className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5b2fa0]/15 text-[#5b2fa0] dark:text-[#c5a8ff]">
            <CurseIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="cure-title" className="font-display text-xl leading-tight">Maldición de {CURSE_NAME[curse.kind].toLowerCase()}</h2>
            <p className="truncate text-xs text-muted">Se pasa sola en {curse.left === 1 ? "1 paso" : `${curse.left} pasos`}… o la curan antes</p>
          </div>
          <button onClick={onClose} aria-label="Volver al laberinto" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
            <X size={22} />
          </button>
        </header>

        <div ref={shakeRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <FirstHint id="cure" className="mb-3" />
          {curse.cure === "sigil" ? <SigilView game={game} k={curse.k} paper={pal.paper} ink={pal.ink} /> : <EchoView game={game} k={curse.k} paper={pal.paper} ink={pal.ink} reduce={reduce} />}

          <label htmlFor="cure-key" className="mt-5 block text-sm font-medium">Clave de la cura</label>
          <div className="mt-1 flex gap-2">
            <input
              id="cure-key"
              value={text}
              onChange={(e) => {
                const raw = normalizeCodeInput(e.target.value).text.slice(0, CURE_KEY_LENGTH);
                setText(raw.length > 2 ? `${raw.slice(0, 2)}-${raw.slice(2)}` : raw);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="AB-CD"
              aria-invalid={!!error}
              aria-describedby="cure-key-help"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 font-mono text-xl uppercase tracking-[0.2em] outline-none focus:ring-2 focus:ring-accent"
            />
            <Button onClick={submit} disabled={text.length === 0}>
              Curar
            </Button>
          </div>
          <p id="cure-key-help" aria-live="polite" className={cn("mt-2 min-h-5 text-sm", error ? "font-medium text-[#b23a3a] dark:text-[#ff8c8c]" : "text-muted")}>
            {error ?? "Probar claves es gratis. Si tu guía se equivocó antes, la cura alumbra un poco menos."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** k + 1 notches: the guide sets the same number on their counter. */
function Notches({ k }: { k: number }) {
  const n = k + 1;
  return (
    <div className="mt-3 flex flex-col items-center gap-1" role="img" aria-label={n === 1 ? "1 muesca" : `${n} muescas`}>
      <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="h-5 w-1.5 rounded-full bg-foreground/80" />
        ))}
      </div>
      <span className="text-xs text-muted">Muescas: díselas a tu guía</span>
    </div>
  );
}

function SigilView({ game, k, paper, ink }: { game: Game; k: number; paper: string; ink: string }) {
  const t = useMemo(() => sigilCure(game.seed, k), [game.seed, k]);
  return (
    <div>
      <p className="text-sm">Descríbele este sigilo a tu guía. Tiene seis antídotos parecidos y uno solo encaja.</p>
      <div className="mt-3 flex justify-center rounded-3xl p-3" style={{ background: paper }}>
        <Shape d={t.target} size={168} color={ink} label="El sigilo de la maldición" />
      </div>
      <Notches k={k} />
    </div>
  );
}

/**
 * The glyphs light up one at a time, in order. «Ver otra vez» replays it
 * (as often as they like: remembering it is not the point, telling it is).
 */
function EchoView({ game, k, paper, ink, reduce }: { game: Game; k: number; paper: string; ink: string; reduce: boolean }) {
  const echo = useMemo(() => echoCure(game.seed, k), [game.seed, k]);
  const [run, setRun] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  useEffect(() => {
    let i = 0;
    let timer = 0;
    const gap = Math.round(echo.beatMs * 0.35);
    const tick = () => {
      if (i >= echo.sequence.length) {
        setLit(null);
        return;
      }
      setLit(i);
      timer = window.setTimeout(() => {
        setLit(null);
        i++;
        timer = window.setTimeout(tick, gap);
      }, echo.beatMs);
    };
    timer = window.setTimeout(tick, 500);
    return () => window.clearTimeout(timer);
  }, [echo, run]);

  return (
    <div>
      <p className="text-sm">
        Mira la secuencia y cuéntasela a tu guía, en orden: son {echo.sequence.length} símbolos{echo.repeats ? " y alguno puede repetirse" : ""}.
      </p>
      <div className="mt-3 flex h-48 items-center justify-center rounded-3xl" style={{ background: paper }} aria-live="polite">
        {lit !== null ? (
          <Shape
            key={`${run}-${lit}`}
            d={echo.glyphs[echo.sequence[lit]]}
            size={132}
            color={ink}
            className={cn(!reduce && "seal-pop")}
            label={`Símbolo ${lit + 1} de ${echo.sequence.length}`}
          />
        ) : (
          <span className="text-sm" style={{ color: ink, opacity: 0.55 }}>
            …
          </span>
        )}
      </div>
      <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
        {echo.sequence.map((_, i) => (
          <span key={i} className={cn("h-2 w-6 rounded-full", lit === i ? "bg-foreground" : "bg-border")} />
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <Button variant="secondary" onClick={() => setRun((n) => n + 1)}>
          <RotateCcw size={16} /> Ver otra vez
        </Button>
      </div>
      <Notches k={k} />
    </div>
  );
}

/** A small knot: the curse badge (shape, not just the purple). */
export function CurseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 3c4 0 7 3 7 7 0 3-2 5-5 5-2 0-3-1.5-3-3s1-2.5 2.5-2.5" />
      <path d="M12 21c-4 0-7-3-7-7" />
      <path d="M5 14l-2 2M5 14l2 2" />
    </svg>
  );
}
