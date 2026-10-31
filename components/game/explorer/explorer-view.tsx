"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, Flag, Gamepad2, LampDesk, Star, X } from "lucide-react";
import { DIFFICULTIES, type Dir, type Game, KEY_COLORS, type PlayEvent, type PlayState, solve, starCount } from "@/src/engine";
import { audio, buzz } from "@/lib/audio";
import { formatTime, useElapsed, usePrefersReducedMotion } from "@/lib/hooks";
import { readJSON, writeJSON } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ShapeGlyph } from "../guide/map-art";
import { SoundToggle } from "../sound-toggle";
import { ExplorerController, type HudState } from "./controller";
import { createMessenger } from "./messages";

/**
 * The explorer's screen: Canvas 2.5D maze in fog + a quiet HTML HUD.
 * Input: arrows/WASD (hold to keep walking), swipe (swipe-and-hold walks),
 * and an optional on-screen pad.
 */

export interface ExplorerOutcome {
  timeMs: number;
  pits: number;
  stars: number;
}

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 0, KeyW: 0,
  ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2,
  ArrowLeft: 3, KeyA: 3,
};
const PAD_KEY = "laberinto.dpad.v1";
const SWIPE_PX = 22;

export function ExplorerView({
  game,
  title,
  startedAt,
  timed,
  onArrived,
  onQuit,
}: {
  game: Game;
  title: string;
  startedAt: number;
  timed: boolean;
  onArrived: (o: ExplorerOutcome) => void;
  onQuit: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<ExplorerController | null>(null);
  const reduce = usePrefersReducedMotion();
  const [hud, setHud] = useState<HudState | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number; tone: "info" | "bad" | "good" } | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [penaltyFlash, setPenaltyFlash] = useState(0);
  const [pad, setPad] = useState(false);
  const [hint, setHint] = useState(true);
  const elapsed = useElapsed(startedAt, stoppedAt);
  const arrivedAt = useRef<number | null>(null);
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  // Pad default: on for touch screens; remembered once toggled.
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setPad(readJSON<boolean>(PAD_KEY, coarse));
  }, []);
  const togglePad = () => {
    setPad((p) => {
      writeJSON(PAD_KEY, !p);
      return !p;
    });
  };

  useEffect(() => {
    audio.startMusic(game.theme);
    return () => audio.stopMusic();
  }, [game.theme]);

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 5000);
    return () => window.clearTimeout(t);
  }, []);

  // Controller lifecycle.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const css = getComputedStyle(document.documentElement);
    const fonts = {
      ui: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
      display: css.getPropertyValue("--font-display").trim() || "Georgia, serif",
    };
    let toastId = 0;
    const message = createMessenger(game);
    const ctrl = new ExplorerController({
      game,
      canvas,
      reducedMotion: reduce,
      fonts,
      onHud: setHud,
      onEvent: (e: PlayEvent, s: PlayState) => {
        if (e.type === "arrived") {
          arrivedAt.current = Date.now();
          setStoppedAt(arrivedAt.current);
          buzz([40, 60, 40, 60, 120]);
        }
        if (e.type === "fell") {
          setPenaltyFlash((n) => n + 1);
          buzz(220);
        }
        if (e.type === "key" || e.type === "star") buzz(30);
        if (e.type === "locked" || e.type === "checkpoint" || e.type === "teleported" || e.type === "swirl") buzz(18);
        const text = message(e, s);
        if (text) {
          const tone = e.type === "fell" || e.type === "locked" ? "bad" : e.type === "key" || e.type === "star" || e.type === "arrived" ? "good" : "info";
          setToast({ text, id: ++toastId, tone });
        }
      },
      onArrive: (s) => {
        const at = arrivedAt.current ?? Date.now();
        onArrivedRef.current({ timeMs: at - startedAt, pits: s.pits, stars: starCount(s) });
      },
    });
    ctrlRef.current = ctrl;
    if (process.env.NODE_ENV !== "production") {
      // Dev-only handles for playtesting and perf checks from the console.
      const w = window as unknown as { __explorer?: ExplorerController; __explorerSolution?: Dir[] };
      w.__explorer = ctrl;
      w.__explorerSolution = solve(game, game.start, game.exit).dirs;
    }

    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      ctrl.resize(r.width, r.height);
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, [game, reduce, startedAt]);

  // Keyboard: press starts a move, holding keeps walking.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const d = KEYMAP[e.code];
      if (d === undefined || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (e.repeat) return;
      setHint(false);
      ctrlRef.current?.press(d, true);
    };
    const up = (e: KeyboardEvent) => {
      const d = KEYMAP[e.code];
      if (d !== undefined) ctrlRef.current?.release(d);
    };
    const blur = () => ctrlRef.current?.release();
    // Switching apps mid-swipe never sends pointerup: drop held directions.
    const hidden = () => document.visibilityState === "hidden" && blur();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Toasts fade on their own.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast((c) => (c?.id === toast.id ? null : c)), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Swipe (and swipe-and-hold) on the play area.
  const swipe = useRef<{ id: number; x: number; y: number; dir: Dir | null } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const prev = swipe.current;
    if (prev && prev.id === e.pointerId) return;
    // A finger lifted while the tab was hidden never sent pointerup: start over.
    if (prev?.dir != null) ctrlRef.current?.release(prev.dir);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < SWIPE_PX) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    s.x = e.clientX;
    s.y = e.clientY;
    if (d === s.dir) return;
    if (s.dir !== null) ctrlRef.current?.release(s.dir);
    s.dir = d;
    setHint(false);
    ctrlRef.current?.press(d, true);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    if (s.dir !== null) ctrlRef.current?.release(s.dir);
    swipe.current = null;
  };

  const penalty = hud ? hud.pits * 10_000 : 0;
  const shownTime = elapsed + penalty;
  const maxStars = DIFFICULTIES[game.level].stars;
  const doorColors = [...new Set(game.doors.map((d) => d.color))].sort();
  const lanternLeft = hud && hud.lanternUntil > Date.now() ? Math.ceil((hud.lanternUntil - Date.now()) / 1000) : 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="relative z-10 flex items-center gap-2 border-b border-border bg-card/90 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur sm:px-4">
        <button onClick={onQuit} aria-label="Salir de la partida" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted">Explorador · describe lo que ves</p>
        </div>
        <div className="relative">
          <div
            className={cn("rounded-xl px-3 py-1.5 font-mono text-lg tabular-nums", timed ? "bg-background" : "text-sm text-muted")}
            aria-label={timed ? `Tiempo ${formatTime(shownTime)}` : "Sin tiempo"}
          >
            {timed ? formatTime(shownTime) : "sin tiempo"}
          </div>
          {timed && penaltyFlash > 0 && (
            <span key={penaltyFlash} className="penalty-pop pointer-events-none absolute -bottom-5 right-1 text-xs font-semibold text-accent">
              +10 s
            </span>
          )}
        </div>
        <button
          onClick={togglePad}
          aria-pressed={pad}
          aria-label="Mostrar cruceta en pantalla"
          className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border", pad ? "bg-foreground text-background" : "hover:bg-border/40")}
        >
          <Gamepad2 size={20} />
        </button>
        <SoundToggle />
      </header>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Tu alrededor en el laberinto. Muévete con las flechas, WASD, deslizando o con la cruceta."
        />

        {/* Status chips */}
        {hud && (
          <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-1.5 sm:inset-x-4 sm:top-3">
            <Chip label={`Estrellas ${hud.stars} de ${maxStars}`}>
              {Array.from({ length: maxStars }, (_, i) => (
                <Star key={i} size={16} className={i < hud.stars ? "fill-[#f2b84b] text-[#a5700f]" : "text-white/45"} />
              ))}
            </Chip>
            {doorColors.length > 0 && (
              <Chip label={`Llaves: ${doorColors.map((c) => `${KEY_COLORS[c].colorName} ${hud.keys & (1 << c) ? "sí" : "no"}`).join(", ")}`}>
                <span className="text-xs text-white/75">Llaves</span>
                {doorColors.map((c) => {
                  const k = KEY_COLORS[c];
                  const has = (hud.keys & (1 << c)) !== 0;
                  return (
                    <svg key={c} width={18} height={18} viewBox="-10 -10 20 20" aria-hidden>
                      <ShapeGlyph shape={k.shape} cx={0} cy={0} r={8} fill={has ? k.hex : "transparent"} stroke={has ? "#fff" : "rgba(255,255,255,0.5)"} sw={1.6} />
                    </svg>
                  );
                })}
              </Chip>
            )}
            <Chip label={hud.checkpointIndex < 0 ? "Si caes vuelves a la entrada" : "Si caes vuelves a la última bandera"}>
              <Flag size={15} className={hud.checkpointIndex < 0 ? "text-white/60" : "text-[#7fd49b]"} />
              <span className="text-xs">{hud.checkpointIndex < 0 ? "Entrada" : "Bandera"}</span>
            </Chip>
            {lanternLeft > 0 && (
              <Chip label={`Farol encendido, ${lanternLeft} segundos`} className="bg-[#7a5a12]/85">
                <LampDesk size={15} className="text-[#ffd166]" />
                <LanternCountdown until={hud.lanternUntil} />
              </Chip>
            )}
            {hud.invert && (
              <Chip label={`Controles invertidos ${hud.invert.left} pasos`} className="bg-[#5b2fa0]/90">
                <ArrowLeftRight size={15} />
                <span className="text-xs font-semibold">{hud.invert.axes === "xy" ? "Todo invertido" : "Izq ↔ der"} · {hud.invert.left}</span>
              </Chip>
            )}
          </div>
        )}

        {/* Event toast */}
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-4 sm:top-16">
          {toast && (
            <p
              key={toast.id}
              className={cn(
                "toast-in max-w-md rounded-2xl px-4 py-2 text-center text-sm font-medium text-white shadow-lg",
                toast.tone === "bad" ? "bg-[#9b2d3a]/92" : toast.tone === "good" ? "bg-[#2f6e4a]/92" : "bg-[#28232e]/88",
              )}
            >
              {toast.text}
            </p>
          )}
        </div>

        {hint && (
          <p className="pointer-events-none absolute inset-x-0 top-40 mx-auto w-fit rounded-full bg-black/55 px-4 py-2 text-center text-sm text-white">
            {pad ? "Desliza o usa la cruceta · mantén para caminar" : "Flechas o WASD · mantén para caminar"}
          </p>
        )}

        {/* Nearby, for describing */}
        {hud && hud.nearby.length > 0 && (
          <div className={cn("pointer-events-none absolute bottom-3 left-2 right-2 flex sm:left-4", pad ? "justify-start pr-44" : "justify-center")}>
            <p className="max-w-full truncate rounded-full bg-black/60 px-3.5 py-2 text-sm text-white">
              <span className="text-white/65">Cerca: </span>
              {hud.nearby.join(" · ")}
            </p>
          </div>
        )}

        {pad && <DPad ctrl={ctrlRef} />}
      </div>
    </div>
  );
}

function Chip({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    // Not a live region: the toast already announces events, and the lantern
    // countdown would otherwise be read out every second.
    <div role="img" aria-label={label} className={cn("flex h-8 items-center gap-1 rounded-full bg-black/55 px-2.5 text-white backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}

function LanternCountdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return <span className="text-xs tabular-nums">{Math.max(0, Math.ceil((until - now) / 1000))} s</span>;
}

function DPad({ ctrl }: { ctrl: React.RefObject<ExplorerController | null> }) {
  const btn = (dir: Dir, label: string, icon: React.ReactNode, pos: string) => (
    <button
      aria-label={label}
      className={cn("absolute flex h-14 w-14 items-center justify-center rounded-2xl bg-black/45 text-white shadow-md backdrop-blur-sm active:bg-black/70", pos)}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        ctrl.current?.press(dir, true);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        ctrl.current?.release(dir);
      }}
      onPointerCancel={() => ctrl.current?.release(dir)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon}
    </button>
  );
  return (
    <div className="absolute bottom-3 right-3 h-[10.5rem] w-[10.5rem]" onPointerDown={(e) => e.stopPropagation()}>
      {btn(0, "Arriba", <ArrowUp size={24} />, "left-[3.5rem] top-0")}
      {btn(3, "Izquierda", <ArrowLeft size={24} />, "left-0 top-[3.5rem]")}
      {btn(1, "Derecha", <ArrowRight size={24} />, "right-0 top-[3.5rem]")}
      {btn(2, "Abajo", <ArrowDown size={24} />, "bottom-0 left-[3.5rem]")}
    </div>
  );
}

