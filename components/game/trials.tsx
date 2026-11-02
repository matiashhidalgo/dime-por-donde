"use client";

import { useEffect, useRef } from "react";
import type { Clue, Light, LockFeedback } from "@/src/engine";
import { cn } from "@/lib/utils";

/**
 * Pieces both screens use for stations and trials. Every shape here is a
 * single SVG path in [-1, 1] units from the engine (emblems, figures, glyphs),
 * so both devices draw exactly the same picture. No names anywhere: things are
 * told apart by shape, and states by shape + color + an aria label.
 */

export const SEAL_GOLD = "#f2b84b";

/** Station titles, the same on both screens (names of trials, never of answers). */
export const TRIAL_TITLES = { figures: "Figuras raras", lock: "Cerradura", piano: "Piano de la bruja", tangram: "Tangram a ciegas" } as const;
export const SEAL_EDGE = "#a5700f";

/**
 * Replays the «wrong» shake on its element each time `count` goes up, without
 * remounting (so typed text and error messages survive).
 */
export function useShake<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || count === 0) return;
    el.classList.remove("wrong-shake");
    void el.offsetWidth; // restart the animation
    el.classList.add("wrong-shake");
  }, [count]);
  return ref;
}

/** A station's medallion. Won seals turn gold with a ring of rays. */
export function Medallion({ d, sealed, size = 40, className }: { d: string; sealed: boolean; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-1.5 -1.5 3 3" aria-hidden className={className}>
      {sealed &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <line key={i} x1={Math.cos(a) * 1.18} y1={Math.sin(a) * 1.18} x2={Math.cos(a) * 1.45} y2={Math.sin(a) * 1.45} stroke={SEAL_GOLD} strokeWidth={0.12} strokeLinecap="round" />;
        })}
      <circle r={1.08} fill={sealed ? SEAL_GOLD : "var(--card)"} stroke={sealed ? SEAL_EDGE : "currentColor"} strokeWidth={0.12} strokeDasharray={sealed ? undefined : "0.28 0.16"} />
      <path d={d} transform="scale(0.72)" fill={sealed ? "#5a3a08" : "currentColor"} />
    </svg>
  );
}

/** A bare shape (figure or glyph) filling its box. */
export function Shape({
  d,
  size,
  color = "currentColor",
  className,
  label,
  outline = false,
}: {
  d: string;
  size: number;
  color?: string;
  className?: string;
  label?: string;
  /** Drawn as a line instead of filled (the guide's antidotes). */
  outline?: boolean;
}) {
  return (
    <svg width={size} height={size} viewBox="-1.05 -1.05 2.1 2.1" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={d} fill={outline ? "none" : color} stroke={outline ? color : undefined} strokeWidth={outline ? 0.07 : undefined} strokeLinejoin="round" />
    </svg>
  );
}

const LIGHT_LABEL: Record<Light, string> = { hit: "en su lugar", near: "está, en otro lugar", miss: "no está" };

/** Lock feedback light: filled with a tick / half-filled ring / empty with a dash. */
export function LightIcon({ light, size = 18 }: { light: Light; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" role="img" aria-label={LIGHT_LABEL[light]}>
      {light === "hit" && (
        <>
          <circle r={8.5} fill="#2f9c5a" stroke="#14532d" strokeWidth={1.4} />
          <path d="M-4,0 L-1,3.5 L4.5,-3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {light === "near" && (
        <>
          <circle r={8.5} fill="none" stroke="#c98a12" strokeWidth={2.2} />
          <path d="M0,-8.5 A8.5,8.5 0 0 1 0,8.5 Z" fill="#f2b84b" />
        </>
      )}
      {light === "miss" && (
        <>
          <circle r={8.5} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.6} />
          <line x1={-4} y1={0} x2={4} y2={0} stroke="currentColor" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** What the lock answered, in its mode: one light per slot, or only the two counts. */
export function Feedback({ fb, mode }: { fb: LockFeedback; mode: "slots" | "counts" }) {
  if (mode === "slots") {
    return (
      <span className="flex gap-1">
        {fb.lights.map((l, i) => (
          <LightIcon key={i} light={l} />
        ))}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm font-semibold tabular-nums" aria-label={`${fb.hits} en su lugar, ${fb.near} en otro lugar`}>
      <span className="flex items-center gap-1"><LightIcon light="hit" size={16} />{fb.hits}</span>
      <span className="flex items-center gap-1"><LightIcon light="near" size={16} />{fb.near}</span>
    </span>
  );
}

function Slots({ n, filled, size = 12 }: { n: number; filled: (i: number) => "on" | "off" | "x"; size?: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const f = filled(i);
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 12 12">
            <rect x={1} y={1} width={10} height={10} rx={2} fill={f === "on" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.3} strokeOpacity={f === "x" ? 0.35 : 1} />
            {f === "x" && <path d="M3.5,3.5 L8.5,8.5 M8.5,3.5 L3.5,8.5" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.2} />}
          </svg>
        );
      })}
    </span>
  );
}

/** Words for screen readers only; the pictogram itself has no text. */
function clueLabel(c: Clue, slots: number): string {
  switch (c.type) {
    case "pos":
      return `Este símbolo está, y solo puede ir en los espacios ${c.positions.map((p) => p + 1).join(", ")} de ${slots}`;
    case "absent":
      return "Este símbolo no está";
    case "adj":
      return "Estos dos símbolos van juntos, uno al lado del otro";
    case "order":
      return "Los dos están, y el primero aparece antes que el segundo";
    case "count":
      return `De estos símbolos hay exactamente ${c.k} en total`;
  }
}

/**
 * One clue as a pictogram. The grammar is fixed on purpose (it's the
 * interface's language, not the answer): slots row = where it may go, slash =
 * absent, chain = side by side, arrow = comes before, filled boxes = how many.
 */
export function CluePictogram({ clue, glyphs, slots, color, paper }: { clue: Clue; glyphs: string[]; slots: number; color: string; paper: string }) {
  // Glyphs sit on a swatch of map paper so the ink reads in dark mode too.
  const g = (i: number, size = 30) => (
    <span className="inline-flex rounded-lg p-0.5" style={{ background: paper }}>
      <Shape d={glyphs[i]} size={size} color={color} />
    </span>
  );
  return (
    <div role="img" aria-label={clueLabel(clue, slots)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 px-3 py-2">
      {clue.type === "pos" && (
        <>
          {g(clue.glyph)}
          <Slots n={slots} size={14} filled={(i) => (clue.positions.includes(i) ? "on" : "x")} />
        </>
      )}
      {clue.type === "absent" && (
        <span className="relative">
          {g(clue.glyph)}
          <svg width={34} height={34} viewBox="0 0 34 34" className="absolute inset-0" aria-hidden>
            <circle cx={17} cy={17} r={15} fill="none" stroke="#c0392b" strokeWidth={2.5} />
            <line x1={7} y1={27} x2={27} y2={7} stroke="#c0392b" strokeWidth={2.5} />
          </svg>
        </span>
      )}
      {clue.type === "adj" && (
        <>
          {g(clue.a)}
          <svg width={22} height={14} viewBox="0 0 22 14" aria-hidden>
            <rect x={1} y={3} width={11} height={8} rx={4} fill="none" stroke="currentColor" strokeWidth={2} />
            <rect x={10} y={3} width={11} height={8} rx={4} fill="none" stroke="currentColor" strokeWidth={2} />
          </svg>
          {g(clue.b)}
        </>
      )}
      {clue.type === "order" && (
        <>
          {g(clue.a)}
          <svg width={26} height={14} viewBox="0 0 26 14" aria-hidden>
            <path d="M2,7 H22 M16,2 L23,7 L16,12" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {g(clue.b)}
        </>
      )}
      {clue.type === "count" && (
        <>
          <span className="flex items-center gap-0.5 rounded-xl border border-dashed border-current px-1.5 py-0.5">
            {clue.glyphs.map((x) => (
              <span key={x}>{g(x, 24)}</span>
            ))}
          </span>
          <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
            <path d="M2,4.5 H12 M2,9.5 H12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <Slots n={slots} size={14} filled={(i) => (i < clue.k ? "on" : "off")} />
        </>
      )}
    </div>
  );
}

/** How to read the pictograms (shown once on the guide's lock sheet). */
export function ClueGrammar({ className }: { className?: string }) {
  return (
    <ul className={cn("grid gap-1 text-xs text-muted", className)}>
      <li>Fila de casillas: el símbolo está y solo puede ir en las casillas rellenas.</li>
      <li>Símbolo tachado: no está.</li>
      <li>Eslabones: esos dos van pegados, en cualquier orden.</li>
      <li>Flecha: los dos están y el primero aparece antes.</li>
      <li>Grupo = casillas rellenas: cuántos de ese grupo hay en total.</li>
    </ul>
  );
}
