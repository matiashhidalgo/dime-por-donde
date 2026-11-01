"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, EyeOff, Flame, FlipHorizontal2, Gamepad2, Ghost, Heart, Hourglass, LifeBuoy, RotateCw, Star, VenetianMask, X } from "lucide-react";
import {
  DIFFICULTIES,
  type Dir,
  type Game,
  type CurseKind,
  KEY_COLORS,
  type PlayEvent,
  type PlayState,
  TUNING,
  emergencyAvailable,
  sealCount,
  solve,
  starCount,
  stationEmblems,
  takeEmergencyExit,
} from "@/src/engine";
import { audio, buzz } from "@/lib/audio";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { readJSON, writeJSON } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ShapeGlyph } from "../guide/map-art";
import { SoundToggle } from "../sound-toggle";
import { Medallion } from "../trials";
import { Button } from "../ui";
import { ExplorerController, type HudState } from "./controller";
import { CURSE_NAME, createMessenger } from "./messages";
import { CureOverlay, CurseIcon } from "./cure-overlay";
import type { Ending } from "../screens/result";
import { StationOverlay } from "./station-overlay";
import { FirstHint } from "../hint";

/**
 * The explorer's screen: Canvas 2.5D maze in fog + a quiet HTML HUD (hearts,
 * the candle's flame, stars, keys — shapes and colors, no names, no clock).
 * Input: arrows/WASD (hold to keep walking), swipe (swipe-and-hold walks),
 * and an optional on-screen pad.
 */

export interface ExplorerOutcome {
  ending: Ending;
  hearts: number;
  /** Hearts lost on this map (heals don't undo it). */
  hurts: number;
  pits: number;
  stars: number;
  /** v2: seals won (0 on v1 games). */
  seals: number;
  /** Informative only: time doesn't score in v2. */
  timeMs: number;
}

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 0, KeyW: 0,
  ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2,
  ArrowLeft: 3, KeyA: 3,
};
/** «Esperar» (only where La Sombra roams). */
const WAIT_KEYS = new Set(["Space", "KeyE"]);
const PAD_KEY = "laberinto.dpad.v1";
const SWIPE_PX = 22;

export function ExplorerView({
  game,
  title,
  startedAt,
  play,
  subtitle = "Explorador · describe lo que ves",
  onEnd,
  onQuit,
}: {
  game: Game;
  title: string;
  startedAt: number;
  /** Racha: hearts carried in and the PLAY level. */
  play?: { hearts: number; level: number };
  subtitle?: string;
  onEnd: (o: ExplorerOutcome) => void;
  onQuit: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<ExplorerController | null>(null);
  const reduce = usePrefersReducedMotion();
  const [hud, setHud] = useState<HudState | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number; tone: "info" | "bad" | "good" } | null>(null);
  const [pad, setPad] = useState(false);
  const [hint, setHint] = useState(true);
  /** Station whose overlay is open, or null. */
  const [trial, setTrial] = useState<number | null>(null);
  const [curing, setCuring] = useState(false);
  /** The sealed exit offered the emergency way out: ask first. */
  const [askExit, setAskExit] = useState(false);
  const endedAt = useRef<number | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

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
    let toastId = 0;
    const message = createMessenger(game);
    const ctrl = new ExplorerController({
      game,
      canvas,
      reducedMotion: reduce,
      onHud: setHud,
      onEvent: (e: PlayEvent, s: PlayState) => {
        if (e.type === "arrived" || e.type === "defeat") endedAt.current = Date.now();
        if (e.type === "defeat" || e.type === "arrived" || e.type === "emergencyExit") {
          setTrial(null);
          setCuring(false);
          setAskExit(false);
        }
        if (e.type === "uncurse") setCuring(false);
        if (e.type === "exitSealed" && e.emergency) {
          ctrl.release();
          setAskExit(true);
        }
        if (e.type === "station" && !e.sealed) {
          ctrl.release();
          setTrial(e.index);
        }
        if (e.type === "arrived") buzz([40, 60, 40, 60, 120]);
        if (e.type === "key" || e.type === "star" || e.type === "lantern") buzz(30);
        if (e.type === "locked" || e.type === "candle" || e.type === "teleported" || e.type === "swirl" || e.type === "darkness") buzz(18);
        if (e.type === "emergencyExit") buzz([40, 60, 40]);
        const text = message(e, s);
        if (text) {
          const bad =
            e.type === "fell" || e.type === "locked" || e.type === "hurt" || e.type === "shadowTouch" || e.type === "darkness" || e.type === "defeat" || e.type === "dimmed" || e.type === "trialFail";
          const good =
            e.type === "key" ||
            e.type === "star" ||
            e.type === "arrived" ||
            e.type === "lantern" ||
            e.type === "candle" ||
            e.type === "seal" ||
            e.type === "heal" ||
            e.type === "emergencyExit" ||
            e.type === "shadowStunned" ||
            (e.type === "uncurse" && e.cured);
          setToast({ text, id: ++toastId, tone: bad ? "bad" : good ? "good" : "info" });
        }
      },
      onEnd: (s) => {
        const at = endedAt.current ?? Date.now();
        const ending: Ending = !s.arrived ? "lost" : s.escaped ? "escaped" : "won";
        onEndRef.current({ ending, hearts: s.hearts, hurts: s.hurts, pits: s.pits, stars: starCount(s), seals: sealCount(s), timeMs: at - startedAt });
      },
      play,
    });
    ctrlRef.current = ctrl;
    if (process.env.NODE_ENV !== "production") {
      // Dev-only handles for playtesting and perf checks from the console.
      const w = window as unknown as { __explorer?: ExplorerController; __explorerSolution?: Dir[]; __explorerRoute?: (to: number) => Dir[] };
      w.__explorer = ctrl;
      (w as { __teleport?: (c: number) => void }).__teleport = (c) => ctrl.teleportDev(c);
      w.__explorerSolution = solve(game, game.start, game.exit).dirs;
      // Shortest route from where the explorer stands now, with the keys in hand.
      w.__explorerRoute = (to: number) => solve(game, ctrl.state.cell, to, ctrl.state.keys).dirs;
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
    // `play` is fixed for the life of this view (the parent remounts it per map).
  }, [game, reduce, startedAt]);

  // An open station, cure or question pauses the maze (the overlay has the keyboard).
  const overlay = trial !== null || curing || askExit;
  useEffect(() => {
    if (ctrlRef.current) ctrlRef.current.paused = overlay;
  }, [overlay]);

  const leaveNow = () => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    setAskExit(false);
    ctrl.applyTrial(takeEmergencyExit(game, ctrl.state));
  };

  // Keyboard: press starts a move, holding keeps walking.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (WAIT_KEYS.has(e.code) && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (!e.repeat) ctrlRef.current?.wait();
        return;
      }
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

  const maxStars = DIFFICULTIES[game.level].stars;
  const curse = hud?.state.curse ?? null;
  const masked = curse?.kind === "masked";
  const mirrored = curse?.kind === "mirror";
  const canLeave = !!hud && emergencyAvailable(game, hud.state);
  const emblems = game.stations ? stationEmblems(game) : [];
  const doorColors = [...new Set(game.doors.map((d) => d.color))].sort();

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="relative z-10 flex items-center gap-2 border-b border-border bg-card/90 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur sm:px-4">
        <button onClick={onQuit} aria-label="Salir de la partida" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted">{subtitle}</p>
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
          // «Espejo»: the explorer's world flips; the guide's map doesn't.
          className={cn("absolute inset-0 h-full w-full", mirrored && "-scale-x-100", !reduce && "transition-transform duration-500")}
          role="img"
          aria-label="Tu alrededor en el laberinto. Muévete con las flechas, WASD, deslizando o con la cruceta."
        />

        {/* Status chips */}
        {hud && (
          <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-1.5 sm:inset-x-4 sm:top-3">
            {masked ? (
              <Chip label="Máscara: no ves tus corazones, tu vela ni tus sellos" className="bg-[#2a1840]/90">
                <VenetianMask size={16} />
                <span className="text-xs font-semibold">? ? ?</span>
              </Chip>
            ) : (
              <>
                <Hearts hearts={hud.hearts} />
                <Candle light={hud.light} radius={hud.radius} reduce={reduce} />
              </>
            )}
            {hud.hasShadow && !masked && <ShadowChip heat={hud.heat} reduce={reduce} />}
            {emblems.length > 0 && !masked && (
              <Chip label={`Sellos: ${sealCount(hud.state)} de ${emblems.length}`} className={sealCount(hud.state) === emblems.length ? "bg-[#6b4a0c]/90" : undefined}>
                {emblems.map((em, i) => (
                  <Medallion key={i} d={em.d} sealed={(hud.seals & (1 << i)) !== 0} size={20} className="text-white/80" />
                ))}
              </Chip>
            )}
            <Chip label={`Estrellas ${hud.stars} de ${maxStars}`}>
              {Array.from({ length: maxStars }, (_, i) => (
                <Star key={i} size={16} className={i < hud.stars ? "fill-[#f2b84b] text-[#a5700f]" : "text-white/45"} />
              ))}
            </Chip>
            {doorColors.length > 0 && (
              <Chip label={`Llaves: tienes ${doorColors.filter((c) => hud.keys & (1 << c)).length} de ${doorColors.length}`}>
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
            {hud.invert && (
              <Chip label={hud.invert.axes === "xy" ? "Controles invertidos: todo al revés" : "Controles invertidos: izquierda y derecha"} className="bg-[#5b2fa0]/90">
                <ArrowLeftRight size={15} />
                <span className="text-xs font-semibold">{hud.invert.axes === "xy" ? "Todo invertido" : "Izq ↔ der"}</span>
              </Chip>
            )}
            {/* The curse: in the same row (it wraps on phones), but tappable: it opens the cure. */}
            {curse && !hud.lost && !hud.arrived && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  ctrlRef.current?.release();
                  setCuring(true);
                }}
                aria-haspopup="dialog"
                aria-label={`Maldición de ${CURSE_NAME[curse.kind].toLowerCase()}: se pasa en ${curse.left} pasos. Abrir la cura`}
                className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-full bg-[#5b2fa0]/92 pl-1.5 pr-1 text-white shadow-md"
              >
                <CurseKindIcon kind={curse.kind} />
                <span className="text-xs font-semibold">{CURSE_NAME[curse.kind]}</span>
                <span className="flex gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(6, Math.ceil(curse.left / 4)) }, (_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  ))}
                </span>
                <span className="ml-0.5 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">Curar</span>
              </button>
            )}
          </div>
        )}

        {/* Event toast */}
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-24 z-40 flex justify-center px-4 sm:top-16">
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
          <p className={cn("pointer-events-none absolute inset-x-0 mx-auto w-fit rounded-full bg-black/55 px-4 py-2 text-center text-sm text-white", hud?.hasShadow ? "top-[14rem] sm:top-40" : "top-40")}>
            {pad ? "Desliza o usa la cruceta · mantén para caminar" : "Flechas o WASD · mantén para caminar"}
          </p>
        )}

        {hud && canLeave && !askExit && trial === null && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-4" onPointerDown={(e) => e.stopPropagation()}>
            <button onClick={() => setAskExit(true)} className="flex h-12 items-center gap-2 rounded-full bg-[#7a1f2b]/92 px-5 font-medium text-white shadow-lg">
              <LifeBuoy size={20} /> Salida de emergencia
            </button>
          </div>
        )}

        {hud && hud.station >= 0 && trial === null && !hud.lost && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-4" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setTrial(hud.station)}
              className="flex h-12 items-center gap-2 rounded-full bg-[#28232e]/92 pl-2 pr-5 font-medium text-white shadow-lg"
            >
              <Medallion d={emblems[hud.station].d} sealed={false} size={34} className="text-white/85" />
              Abrir la estación
            </button>
          </div>
        )}

        {hud?.hasShadow && !overlay && !hud.lost && !hud.arrived && (
          <div className="absolute inset-x-3 top-[6.5rem] z-10 mx-auto max-w-md sm:top-16" onPointerDown={(e) => e.stopPropagation()}>
            <FirstHint id="shadow-explorer" />
          </div>
        )}

        {hud?.hasShadow && !overlay && !hud.lost && !hud.arrived && (
          <div className="absolute bottom-4 left-3 sm:left-4" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => ctrlRef.current?.wait()}
              aria-label="Esperar un instante en el mismo sitio (tecla Espacio o E)"
              className="flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-black/55 px-4 text-sm font-medium text-white shadow-lg backdrop-blur-sm active:bg-black/75"
            >
              <Hourglass size={20} aria-hidden /> Esperar
            </button>
          </div>
        )}

        {pad && !overlay && <DPad ctrl={ctrlRef} />}
      </div>

      {hud && curing && curse && (
        <CureOverlay
          game={game}
          curse={curse}
          state={hud.state}
          reduce={reduce}
          onResult={(r) => ctrlRef.current?.applyTrial(r)}
          onClose={() => setCuring(false)}
        />
      )}

      {hud && askExit && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 p-4 sm:items-center" onPointerDown={(e) => e.stopPropagation()}>
          <div role="dialog" aria-modal="true" aria-labelledby="exit-title" className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl">
            <h2 id="exit-title" className="flex items-center gap-2 font-display text-2xl">
              <LifeBuoy size={24} className="shrink-0" /> ¿Salida de emergencia?
            </h2>
            <p className="mt-2 text-sm">
              La salida sigue sellada, pero hay una rendija. Salen con {sealCount(hud.state) === 1 ? "1 sello" : `${sealCount(hud.state)} sellos`} de {emblems.length}.
            </p>
            <p className="mt-2 text-sm text-muted">
              {play
                ? `La racha sigue, con ${TUNING.streak.heartsAfterEscape === 1 ? "1 corazón" : `${TUNING.streak.heartsAfterEscape} corazones`}, y el próximo mapa se pone más bravo.`
                : "Cuenta como escape, pero sin estrellas de calificación."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setAskExit(false)} autoFocus>
                Seguir buscando
              </Button>
              <Button onClick={leaveNow}>Salir por aquí</Button>
            </div>
          </div>
        </div>
      )}

      {hud && trial !== null && game.stations && (
        <StationOverlay
          game={game}
          station={game.stations[trial]}
          state={hud.state}
          reduce={reduce}
          onResult={(r) => ctrlRef.current?.applyTrial(r)}
          onClose={() => setTrial(null)}
        />
      )}
    </div>
  );
}

const CURSE_ICONS: Record<CurseKind, typeof RotateCw> = {
  turn: RotateCw,
  blind: EyeOff,
  hungry: Flame,
  masked: VenetianMask,
  mirror: FlipHorizontal2,
};

function CurseKindIcon({ kind }: { kind: CurseKind }) {
  const Icon = CURSE_ICONS[kind];
  return (
    <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden>
      <CurseIcon size={22} />
      <Icon size={11} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#5b2fa0]" />
    </span>
  );
}

const HEAT_WORDS = ["no se oye nada", "se oye lejos", "se oye cerca", "se oye muy cerca"];

/**
 * La Sombra's presence as a pulse, never as a position or a name: three dots
 * fill as it gets near and the icon beats faster (CSS, off with reduced
 * motion — the dots still say it). Silent for people without sound.
 */
function ShadowChip({ heat, reduce }: { heat: number; reduce: boolean }) {
  const level = heat <= 0 ? 0 : heat < 0.34 ? 1 : heat < 0.67 ? 2 : 3;
  return (
    <Chip label={`La Sombra: ${HEAT_WORDS[level]}`} className={level === 3 ? "bg-[#2a1840]/92" : level > 0 ? "bg-[#1a1228]/85" : undefined}>
      <Ghost
        size={16}
        aria-hidden
        className={cn(level > 0 ? "text-[#d9ccff]" : "text-white/45", !reduce && level > 0 && "shadow-beat")}
        style={!reduce && level > 0 ? { animationDuration: `${Math.round(1300 - 870 * heat)}ms` } : undefined}
      />
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((r) => (
          <span key={r} className={cn("h-1.5 w-1.5 rounded-full", r <= level ? "bg-[#c5b6ff]" : "bg-white/25")} />
        ))}
      </span>
    </Chip>
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

/** Shared hearts: full ones filled red, lost ones as outlines (shape + fill, not color alone). */
function Hearts({ hearts }: { hearts: number }) {
  return (
    <Chip label={`Corazones: ${hearts} de ${TUNING.hearts}`} className={hearts <= 1 ? "bg-[#7a1f2b]/85" : undefined}>
      {Array.from({ length: TUNING.hearts }, (_, i) => (
        <Heart
          key={`${i}-${i < hearts}`}
          size={16}
          className={cn(i < hearts ? "fill-[#ef5466] text-[#ffd0d6]" : "text-white/45", i === hearts && "heart-lost")}
        />
      ))}
    </Chip>
  );
}

const CANDLE_WORDS = ["apagada", "casi apagada", "a media luz", "encendida"];

/**
 * The candle as a flame that shrinks and dims: deliberately no number or
 * countdown (GAME_SPEC_V2.md §3). Screen readers get a word for the level.
 */
function Candle({ light, radius, reduce }: { light: number; radius: number; reduce: boolean }) {
  const out = light <= 0;
  const h = 4 + 9 * Math.sqrt(light);
  const flame = light > 0.5 ? "#ffd166" : light > 0.25 ? "#ffb43d" : "#ff8a3d";
  return (
    <Chip label={`Vela ${CANDLE_WORDS[Math.max(0, Math.min(3, radius))]}`} className={out ? "bg-[#1a1720]/90" : light <= 0.25 ? "bg-[#5a3a12]/85" : undefined}>
      <svg width={18} height={22} viewBox="0 0 18 22" aria-hidden className={cn(!reduce && light > 0 && light <= 0.25 && "candle-gutter")}>
        <rect x={6} y={13} width={6} height={8} rx={1.5} fill={out ? "#8f8794" : "#f6ead2"} />
        <line x1={9} y1={13} x2={9} y2={11} stroke="#2b2520" strokeWidth={1.2} strokeLinecap="round" />
        {!out && <path d={`M9 ${11.5 - h} C ${9 - h * 0.45} ${11 - h * 0.45}, ${9 - h * 0.3} 11.5, 9 11.5 C ${9 + h * 0.3} 11.5, ${9 + h * 0.45} ${11 - h * 0.45}, 9 ${11.5 - h} Z`} fill={flame} />}
        {out && <path d="M9 9 q 2 -2 0 -4 q -2 -2 0 -4" stroke="#8f8794" strokeWidth={1.1} fill="none" strokeLinecap="round" />}
      </svg>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((r) => (
          <span key={r} className={cn("h-1.5 w-1.5 rounded-full", r <= radius ? "bg-[#ffd166]" : "bg-white/25")} />
        ))}
      </span>
    </Chip>
  );
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

