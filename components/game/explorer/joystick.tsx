"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import type { Dir } from "@/src/engine";
import { buzz } from "@/lib/audio";
import { JOYSTICK, type Hand, clampKnob, joystickDir } from "@/lib/joystick";
import { cn } from "@/lib/utils";

/**
 * The on-screen joystick (replaces the 4-button pad). A round base and a knob
 * that follows the thumb inside a radius and springs back on release. The
 * maze is a grid, so the output is one of four directions (lib/joystick.ts:
 * dead zone + sector hysteresis); holding the knob out keeps walking, and
 * changing direction without lifting works.
 *
 * It owns its pointer (capture + its own `pointerId`), so another finger can
 * tap «Esperar» at the same time, and it stops propagation so the canvas'
 * swipe never starts from it. Only `transform`/`opacity` animate; with
 * reduced motion the knob just snaps back.
 *
 * Size: `--joy` (set by the parent, ≈ 120–168 px) is the base's diameter; the
 * touch zone is 1 rem bigger on every side.
 */

export const JOY_SIZE = "clamp(7.5rem, 34vmin, 10.5rem)";
/** The touch zone's extra margin around the base. */
const ZONE_PAD = "1rem";

/** The rim arc that lights up with a direction (±36° around it, viewBox 100): visible even under the knob. */
function rimArc(dir: Dir): string {
  const mid = (dir * 90 - 90) * (Math.PI / 180);
  const half = (36 * Math.PI) / 180;
  const pt = (a: number) => `${(50 + 46.5 * Math.cos(a)).toFixed(2)} ${(50 + 46.5 * Math.sin(a)).toFixed(2)}`;
  return `M ${pt(mid - half)} A 46.5 46.5 0 0 1 ${pt(mid + half)}`;
}

/** Where each arrow sits on the ring (viewBox 100, base radius 50). */
const ARROWS: { dir: Dir; d: string }[] = [
  { dir: 0, d: "M41 20 L50 11 L59 20" },
  { dir: 1, d: "M80 41 L89 50 L80 59" },
  { dir: 2, d: "M41 80 L50 89 L59 80" },
  { dir: 3, d: "M20 41 L11 50 L20 59" },
];

interface Props {
  hand: Hand;
  reduce: boolean;
  /** Direction changed: release `prev` (if any), press `next` (if any). */
  onDirection: (prev: Dir | null, next: Dir | null) => void;
  onToggleHand: () => void;
}

export function Joystick({ hand, reduce, onDirection, onToggleHand }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Dir | null>(null);
  const [touching, setTouching] = useState(false);
  /** Live gesture state, outside React: pointer moves come at 60+ Hz. */
  const g = useRef<{ id: number | null; dir: Dir | null; cx: number; cy: number; r: number }>({ id: null, dir: null, cx: 0, cy: 0, r: 1 });
  const cb = useRef(onDirection);
  cb.current = onDirection;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  const moveKnob = (x: number, y: number, spring: boolean) => {
    const k = knobRef.current;
    if (!k) return;
    k.style.transition = spring && !reduceRef.current ? "transform 380ms cubic-bezier(0.22, 1.7, 0.36, 1)" : "none";
    k.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  };

  const setDir = (next: Dir | null) => {
    const prev = g.current.dir;
    if (next === prev) return;
    g.current.dir = next;
    setActive(next);
    cb.current(prev, next);
    if (next !== null) buzz(10); // a short tick whenever the direction changes
  };

  const update = (e: React.PointerEvent) => {
    const s = g.current;
    const dx = e.clientX - s.cx;
    const dy = e.clientY - s.cy;
    const k = clampKnob(dx, dy, s.r * JOYSTICK.travel);
    moveKnob(k.x, k.y, false);
    setDir(joystickDir(dx, dy, s.r, s.dir));
  };

  const finish = useCallback(() => {
    const s = g.current;
    if (s.id === null) return;
    s.id = null;
    if (s.dir !== null) {
      const prev = s.dir;
      s.dir = null;
      cb.current(prev, null);
    }
    setActive(null);
    setTouching(false);
    moveKnob(0, 0, true);
  }, []);

  // Let go of everything if the view goes away or the app loses focus
  // (a lifted finger never sends pointerup while the tab is hidden).
  useEffect(() => {
    const hidden = () => document.visibilityState === "hidden" && finish();
    window.addEventListener("blur", finish);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", finish);
      document.removeEventListener("visibilitychange", hidden);
      finish();
    };
  }, [finish]);

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // never reach the canvas' swipe
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = g.current;
    if (s.id !== null) return; // already driven by another finger
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    s.id = e.pointerId;
    s.cx = r.left + r.width / 2;
    s.cy = r.top + r.height / 2;
    s.r = r.width / 2;
    s.dir = null;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Not every browser lets a synthetic or already-gone pointer be captured.
    }
    setTouching(true);
    update(e);
  };
  const onMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (g.current.id !== e.pointerId) return;
    update(e);
  };
  const onUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (g.current.id !== e.pointerId) return;
    finish();
  };

  const side = hand === "left" ? "left" : "right";
  const inset = `max(0.25rem, env(safe-area-inset-${side}))`;
  const lit = "color-mix(in srgb, var(--accent) 45%, #fff)";

  return (
    <div
      className={cn("pointer-events-none absolute z-10 flex flex-col gap-1 select-none [-webkit-touch-callout:none]", hand === "left" ? "items-start" : "items-end")}
      style={{ [side]: inset, bottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={onToggleHand}
        aria-label={`Joystick con la mano ${hand === "right" ? "derecha" : "izquierda"}. Tocar para cambiar a la ${hand === "right" ? "izquierda" : "derecha"}`}
        className="pointer-events-auto mx-3 flex h-11 items-center gap-1.5 rounded-full bg-black/45 px-3 text-xs font-medium text-white/90 backdrop-blur-sm active:bg-black/70"
      >
        <ArrowRightLeft size={14} aria-hidden />
        Mano {hand === "right" ? "derecha" : "izquierda"}
      </button>

      <div
        role="group"
        aria-label="Joystick: arrastra el pomo hacia donde quieras caminar. Mantenlo para seguir caminando"
        data-testid="joystick"
        className="pointer-events-auto touch-none select-none [-webkit-touch-callout:none]"
        style={{ padding: ZONE_PAD, touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      >
        <div
          ref={baseRef}
          data-testid="joystick-base"
          className="relative rounded-full"
          style={{
            width: JOY_SIZE,
            height: JOY_SIZE,
            background: "radial-gradient(circle at 50% 36%, rgba(255,246,232,0.22) 0%, rgba(70,60,80,0.58) 58%, rgba(34,28,40,0.74) 100%)",
            border: "1.5px solid rgba(255,246,232,0.30)",
            boxShadow: "0 14px 30px -10px rgba(0,0,0,0.6), inset 0 2px 10px rgba(255,255,255,0.14), inset 0 -10px 18px rgba(0,0,0,0.28)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          {/* A darker well under the knob, and the four arrows: faint, lit in the accent when active. */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="50" cy="50" r="26" fill="rgba(0,0,0,0.20)" />
            {ARROWS.map((a) => (
              <path key={a.dir} d={a.d} fill="none" stroke="rgba(255,246,232,0.40)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            {ARROWS.map((a) => (
              <path
                key={`arc${a.dir}`}
                d={rimArc(a.dir)}
                fill="none"
                stroke={lit}
                strokeWidth="3.2"
                strokeLinecap="round"
                style={{ opacity: active === a.dir ? 0.95 : 0, transition: reduce ? "none" : "opacity 110ms ease-out", filter: "drop-shadow(0 0 3px var(--accent))" }}
              />
            ))}
            {ARROWS.map((a) => (
              <path
                key={a.dir}
                d={a.d}
                data-lit={active === a.dir}
                fill="none"
                stroke={lit}
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: active === a.dir ? 1 : 0, transition: reduce ? "none" : "opacity 110ms ease-out", filter: "drop-shadow(0 0 3px var(--accent))" }}
              />
            ))}
          </svg>

          {/* Knob: the outer layer travels with the finger (spring on release), the inner one grows when touched. */}
          <div ref={knobRef} className="absolute inset-0 flex items-center justify-center will-change-transform" style={{ transform: "translate3d(0,0,0)" }}>
            <div
              data-testid="joystick-knob"
              className="relative rounded-full"
              style={{
                width: "40%",
                height: "40%",
                transform: touching ? "scale(1.1)" : "scale(1)",
                transition: reduce ? "none" : "transform 140ms ease-out",
                background: "radial-gradient(circle at 36% 28%, #fffaf0 0%, #f4dcc0 36%, #cf9e7e 100%)",
                boxShadow: "0 8px 14px -3px rgba(0,0,0,0.55), inset 0 -5px 9px rgba(120,60,30,0.38), inset 0 2px 3px rgba(255,255,255,0.95)",
              }}
            >
              {/* gloss */}
              <span className="absolute left-[18%] top-[12%] h-[30%] w-[44%] rounded-full" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.85), rgba(255,255,255,0))" }} />
              {/* accent rim while a direction is held */}
              <span
                className="absolute -inset-[3px] rounded-full"
                style={{
                  opacity: active !== null ? 1 : 0,
                  transition: reduce ? "none" : "opacity 110ms ease-out",
                  boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 45%, #fff), 0 0 14px 2px color-mix(in srgb, var(--accent) 70%, transparent)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
