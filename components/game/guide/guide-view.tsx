"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BookOpen,
  DoorOpen,
  Flag,
  Hand,
  Highlighter,
  HeartCrack,
  LifeBuoy,
  LocateFixed,
  MapPin,
  Minus,
  PenLine,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import { type Game, THEMES, cellLabel, columnLabel } from "@/src/engine";
import type { Ending } from "../screens/result";
import { SEAL_GOLD } from "../trials";
import { StationSheet, StationsBar, useGuideStations } from "./stations";
import { CurseSheet } from "./curses";
import { CurseIcon } from "../explorer/cure-overlay";
import { audio, buzz } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Button } from "../ui";
import { describeCell } from "./describe";
import { Legend } from "./legend";
import { FirstHint } from "../hint";
import { FullscreenButton, InstallHelp, useInstallHelp } from "../fullscreen";
import { SoundToggle } from "../sound-toggle";
import { CELL, MARK_COLOR, MapArt, PIN_COLOR } from "./map-art";

/**
 * The guide's screen: full map with pan / zoom / pinch, sticky coordinate
 * rulers, local notes (pin, marks, pencil) with undo, and "Terminar", where
 * the guide says how it ended (no clock in v2: the guide only hears it).
 */

type Tool = "pan" | "pin" | "mark" | "draw";
interface View { s: number; tx: number; ty: number }
interface Notes { marks: number[]; strokes: number[][]; pin: number | null }
const EMPTY: Notes = { marks: [], strokes: [], pin: null };
const RULER = 22;

type Gesture =
  | { kind: "pan"; x0: number; y0: number; view0: View; moved: boolean }
  | { kind: "pinch"; d0: number; wx: number; wy: number; s0: number }
  | { kind: "draw"; points: number[] }
  | { kind: "mark"; adding: boolean; last: { x: number; y: number } }
  | { kind: "pin" }
  | null;

export function GuideView({
  game,
  title,
  startedAt,
  onEnd,
  onQuit,
}: {
  game: Game;
  title: string;
  startedAt: number;
  /** The explorer said how it ended: all seals, the emergency exit, or out of hearts. */
  onEnd: (ending: Ending, ms: number) => void;
  onQuit: () => void;
}) {
  const g = game.grid;
  const worldW = g.width * CELL;
  const worldH = g.height * CELL;
  const pal = THEMES[game.theme].palette;

  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [animate, setAnimate] = useState(false);
  const [installHelp, closeInstallHelp] = useInstallHelp();
  const viewRef = useRef<View | null>(null);
  viewRef.current = view;

  const [tool, setTool] = useState<Tool>("pan");
  const [notes, setNotes] = useState<Notes>(EMPTY);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const [past, setPast] = useState<Notes[]>([]);
  const [draft, setDraft] = useState<number[] | null>(null);
  const [pinDrag, setPinDrag] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [focusPulse, setFocusPulse] = useState<number | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const { stations: stationNotes, update: updateStation } = useGuideStations(game);
  const [openStation, setOpenStation] = useState<number | null>(null);
  const [cursesOpen, setCursesOpen] = useState(false);
  // Phones start with the stations folded: unfolded, they cover the map.
  const [stationsOpen, setStationsOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setStationsOpen(true);
  }, []);

  // ── Layout & fitting ──
  const fitView = useCallback((w: number, h: number): View => {
    const pad = 18;
    const s = Math.min((w - RULER - pad * 2) / worldW, (h - RULER - pad * 2) / worldH);
    return { s, tx: RULER + (w - RULER - worldW * s) / 2, ty: RULER + (h - RULER - worldH * s) / 2 };
  }, [worldW, worldH]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      setView((v) => v ?? fitView(r.width, r.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  const limits = useCallback(() => {
    const fit = fitView(size.w, size.h).s;
    return { min: fit * 0.8, max: Math.max(fit * 2.5, 2.4) };
  }, [fitView, size]);

  const clampView = useCallback(
    (v: View): View => {
      const { min, max } = limits();
      const s = Math.min(max, Math.max(min, v.s));
      const keep = 60; // never let the map leave the screen entirely
      const tx = Math.min(size.w - keep, Math.max(keep - worldW * s, v.tx));
      const ty = Math.min(size.h - keep, Math.max(keep - worldH * s, v.ty));
      return { s, tx, ty };
    },
    [limits, size, worldW, worldH],
  );

  const zoomAt = useCallback(
    (factor: number, px: number, py: number, smooth = false) => {
      const v = viewRef.current;
      if (!v) return;
      const wx = (px - v.tx) / v.s;
      const wy = (py - v.ty) / v.s;
      const { min, max } = limits();
      const s = Math.min(max, Math.max(min, v.s * factor));
      setAnimate(smooth);
      setView(clampView({ s, tx: px - wx * s, ty: py - wy * s }));
    },
    [clampView, limits],
  );

  const focusCell = useCallback(
    (c: number) => {
      const v = viewRef.current;
      if (!v) return;
      const s = Math.max(v.s, Math.min(limits().max, 64 / CELL));
      const wx = (c % g.width) * CELL + CELL / 2;
      const wy = Math.floor(c / g.width) * CELL + CELL / 2;
      setAnimate(true);
      setView(clampView({ s, tx: (size.w + RULER) / 2 - wx * s, ty: (size.h + RULER) / 2 - wy * s }));
      setSelected(c);
      setFocusPulse(c);
      setLegendOpen(false);
      window.setTimeout(() => setFocusPulse(null), 1800);
    },
    [clampView, limits, g.width, size],
  );

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ── Notes with undo ──
  const commit = useCallback((next: Notes) => {
    setPast((p) => [...p.slice(-60), notesRef.current]);
    setNotes(next);
  }, []);
  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      setNotes(p[p.length - 1]);
      return p.slice(0, -1);
    });
  };

  // ── Pointer handling ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>(null);

  const local = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toWorld = (p: { x: number; y: number }) => {
    const v = viewRef.current!;
    return { x: (p.x - v.tx) / v.s, y: (p.y - v.ty) / v.s };
  };
  const cellOf = (w: { x: number; y: number }) => {
    if (w.x < 0 || w.y < 0 || w.x >= worldW || w.y >= worldH) return -1;
    return Math.floor(w.y / CELL) * g.width + Math.floor(w.x / CELL);
  };

  const paintMark = (c: number, adding: boolean) => {
    if (c < 0) return;
    setNotes((n) => {
      const has = n.marks.includes(c);
      if (adding === has) return n;
      return { ...n, marks: adding ? [...n.marks, c] : n.marks.filter((m) => m !== c) };
    });
  };

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const v = viewRef.current!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Abandon whatever one finger had started.
    const cur = gesture.current;
    if (cur?.kind === "draw") setDraft(null);
    if (cur?.kind === "mark" || cur?.kind === "pin") undo();
    setPinDrag(null);
    gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, wx: (mx - v.tx) / v.s, wy: (my - v.ty) / v.s, s0: v.s };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!viewRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    setAnimate(false);
    if (pointers.current.size === 2) return startPinch();
    if (pointers.current.size > 2) return;

    const onPin = (e.target as Element).closest?.("[data-pin]");
    const w = toWorld(p);
    if (onPin) {
      commit(notesRef.current);
      gesture.current = { kind: "pin" };
      setPinDrag(w);
      return;
    }
    const useTool = e.pointerType === "mouse" && e.button !== 0 ? "pan" : tool;
    if (useTool === "pan") {
      gesture.current = { kind: "pan", x0: p.x, y0: p.y, view0: viewRef.current, moved: false };
    } else if (useTool === "draw") {
      gesture.current = { kind: "draw", points: [w.x, w.y] };
      setDraft([w.x, w.y]);
    } else if (useTool === "mark") {
      const c = cellOf(w);
      const adding = !notesRef.current.marks.includes(c);
      commit(notesRef.current);
      gesture.current = { kind: "mark", adding, last: w };
      paintMark(c, adding);
    } else if (useTool === "pin") {
      const c = cellOf(w);
      if (c >= 0) {
        commit({ ...notesRef.current, pin: c });
        audio.play("pin");
        gesture.current = { kind: "pin" };
        setPinDrag(w);
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const gs = gesture.current;
    if (!gs) return;
    if (gs.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const { min, max } = limits();
      const s = Math.min(max, Math.max(min, (gs.s0 * d) / gs.d0));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      setView(clampView({ s, tx: mx - gs.wx * s, ty: my - gs.wy * s }));
    } else if (gs.kind === "pan") {
      const dx = p.x - gs.x0;
      const dy = p.y - gs.y0;
      if (Math.abs(dx) + Math.abs(dy) > 6) gs.moved = true;
      if (gs.moved) setView(clampView({ ...gs.view0, tx: gs.view0.tx + dx, ty: gs.view0.ty + dy }));
    } else if (gs.kind === "draw") {
      const w = toWorld(p);
      const n = gs.points.length;
      if (Math.hypot(w.x - gs.points[n - 2], w.y - gs.points[n - 1]) > 3) {
        gs.points.push(w.x, w.y);
        setDraft([...gs.points]);
      }
    } else if (gs.kind === "mark") {
      // Fast drags skip cells between events: walk the segment so none are missed.
      const w = toWorld(p);
      const steps = Math.ceil(Math.hypot(w.x - gs.last.x, w.y - gs.last.y) / (CELL / 3));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        paintMark(cellOf({ x: gs.last.x + (w.x - gs.last.x) * t, y: gs.last.y + (w.y - gs.last.y) * t }), gs.adding);
      }
      gs.last = w;
    } else if (gs.kind === "pin") {
      setPinDrag(toWorld(p));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = pointers.current.get(e.pointerId)!;
    pointers.current.delete(e.pointerId);
    const gs = gesture.current;
    if (gs?.kind === "pinch") {
      // Lifting one finger of a pinch: do nothing until all fingers are up.
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    if (gs?.kind === "pan" && !gs.moved) {
      const c = cellOf(toWorld(p));
      setSelected((s) => (c < 0 || s === c ? null : c));
    } else if (gs?.kind === "draw") {
      if (gs.points.length >= 4) commit({ ...notesRef.current, strokes: [...notesRef.current.strokes, gs.points] });
      setDraft(null);
    } else if (gs?.kind === "pin") {
      const c = cellOf(toWorld(p));
      if (c >= 0) setNotes((n) => ({ ...n, pin: c }));
      setPinDrag(null);
    }
    gesture.current = null;
  };

  // ── End: the explorer says how it went; the guide confirms it here ──
  const finish = (ending: Ending) => {
    buzz(ending === "lost" ? [120, 80, 200] : [30, 60, 30]);
    audio.play(ending === "won" ? "win" : ending === "escaped" ? "emergency" : "defeat");
    onEnd(ending, Date.now() - startedAt);
  };
  useEffect(() => {
    if (!ending) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEnding(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ending]);

  // Same soft ambience as the explorer hears, for the same theme.
  useEffect(() => {
    audio.startMusic(game.theme);
    return () => audio.stopMusic();
  }, [game.theme]);

  // Keyboard: Ctrl/Cmd+Z undo, +/- zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "+" || e.key === "=") zoomAt(1.3, size.w / 2, size.h / 2, true);
      else if (e.key === "-") zoomAt(1 / 1.3, size.w / 2, size.h / 2, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomAt, size]);

  const cellPx = view ? view.s * CELL : 0;
  const pinCell = notes.pin;
  const pinPos = pinDrag ?? (pinCell !== null ? { x: (pinCell % g.width) * CELL + CELL / 2, y: Math.floor(pinCell / g.width) * CELL + CELL / 2 } : null);
  const inv = view ? 1 / view.s : 1; // keeps UI glyphs a constant screen size

  const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "pan", label: "Mover", icon: <Hand size={20} /> },
    { id: "pin", label: "Alfiler", icon: <MapPin size={20} /> },
    { id: "mark", label: "Marcar", icon: <Highlighter size={20} /> },
    { id: "draw", label: "Dibujar", icon: <PenLine size={20} /> },
  ];

  return (
    <main className="game-shell flex flex-col bg-background">
      {/* HUD */}
      <header className="flex items-center gap-2 border-b border-border bg-card/90 pb-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <button onClick={onQuit} aria-label="Salir de la partida" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted">Guía · el inicio es la E</p>
        </div>
        <button
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          aria-label="Leyenda del mapa"
          className="flex h-11 items-center gap-1.5 rounded-full border border-border px-3 text-sm hover:bg-border/40 lg:hidden"
        >
          <BookOpen size={18} /> <span className="hidden sm:inline">Leyenda</span>
        </button>
        <FullscreenButton />
        <SoundToggle />
      </header>

      {/* The notch and the home bar stay outside the map (landscape too). */}
      <div className="relative flex min-h-0 flex-1 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {/* Map */}
        <div
          ref={boxRef}
          className={cn("relative min-w-0 flex-1 touch-none select-none overflow-hidden", tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")}
          style={{ background: `color-mix(in srgb, ${pal.paper} 55%, var(--background))` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {view && (
            <svg className="absolute inset-0 h-full w-full" role="img" aria-label="Mapa del laberinto">
              <g style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`, transformOrigin: "0 0", transition: animate ? "transform 320ms cubic-bezier(.2,.8,.2,1)" : "none" }}>
                <MapArt game={game} />
                {game.stations?.map((st, i) =>
                  stationNotes[i]?.marked ? (
                    <circle key={`seal${i}`} cx={(st.cell % g.width) * CELL + CELL / 2} cy={Math.floor(st.cell / g.width) * CELL + CELL / 2} r={CELL * 0.5} fill="none" stroke={SEAL_GOLD} strokeWidth={4} />
                  ) : null,
                )}

                {/* Notes */}
                {notes.marks.map((c) => (
                  <rect
                    key={`m${c}`}
                    x={(c % g.width) * CELL + 2}
                    y={Math.floor(c / g.width) * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    rx={4}
                    fill={MARK_COLOR}
                    fillOpacity={0.3}
                    stroke={MARK_COLOR}
                    strokeOpacity={0.7}
                    strokeWidth={1.5}
                  />
                ))}
                {[...notes.strokes, ...(draft ? [draft] : [])].map((pts, i) => (
                  <polyline key={`s${i}`} points={pts.join(" ")} fill="none" stroke={MARK_COLOR} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
                ))}
                {selected !== null && (
                  <rect
                    x={(selected % g.width) * CELL + 1}
                    y={Math.floor(selected / g.width) * CELL + 1}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx={5}
                    fill="none"
                    stroke={PIN_COLOR}
                    strokeWidth={3 * Math.max(1, inv * 0.6)}
                  />
                )}
                {focusPulse !== null && (
                  <circle cx={(focusPulse % g.width) * CELL + CELL / 2} cy={Math.floor(focusPulse / g.width) * CELL + CELL / 2} r={CELL} fill="none" stroke={PIN_COLOR} strokeWidth={3}>
                    <animate attributeName="r" from={CELL * 0.4} to={CELL * 1.4} dur="0.9s" repeatCount="2" />
                    <animate attributeName="opacity" from="1" to="0" dur="0.9s" repeatCount="2" />
                  </circle>
                )}
                {pinPos && (
                  <g data-pin transform={`translate(${pinPos.x},${pinPos.y}) scale(${Math.max(0.7, Math.min(1.6, inv * 1.1))})`} style={{ cursor: "grab" }}>
                    <circle r={22} fill="transparent" />
                    <circle r={13} fill={PIN_COLOR} fillOpacity={0.18} />
                    <path d="M0,4 C-9,-6 -10,-12 -10,-17 A10,10 0 1 1 10,-17 C10,-12 9,-6 0,4Z" fill={PIN_COLOR} stroke="#fff" strokeWidth={2} />
                    <text y={-13} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">?</text>
                  </g>
                )}
              </g>
            </svg>
          )}

          {/* Sticky coordinate rulers */}
          {view && (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 border-b border-border/70 bg-card/85 backdrop-blur-sm" style={{ height: RULER }}>
                {Array.from({ length: g.width }, (_, i) => {
                  const x = view.tx + (i + 0.5) * cellPx;
                  if (x < RULER || x > size.w) return null;
                  if (cellPx < 13 && i % 2 === 1) return null;
                  return (
                    <span key={i} className="absolute top-0 -translate-x-1/2 font-mono text-[11px] leading-[22px] text-muted" style={{ left: x }}>
                      {columnLabel(i)}
                    </span>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 border-r border-border/70 bg-card/85 backdrop-blur-sm" style={{ width: RULER }}>
                {Array.from({ length: g.height }, (_, i) => {
                  const y = view.ty + (i + 0.5) * cellPx;
                  if (y < RULER || y > size.h) return null;
                  if (cellPx < 13 && i % 2 === 1) return null;
                  return (
                    <span key={i} className="absolute left-0 w-full -translate-y-1/2 text-center font-mono text-[10px] text-muted" style={{ top: y }}>
                      {i + 1}
                    </span>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute left-0 top-0 bg-card" style={{ width: RULER, height: RULER }} />
            </>
          )}

          {game.shadow && (
            <div className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-md" onPointerDown={(e) => e.stopPropagation()}>
              <FirstHint id="shadow-guide" />
            </div>
          )}

          {/* Floating zoom controls */}
          <div className="absolute right-3 top-[calc(22px+0.75rem)] flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <RoundBtn label="Acercar" onClick={() => zoomAt(1.4, size.w / 2, size.h / 2, true)}><Plus size={20} /></RoundBtn>
            <RoundBtn label="Alejar" onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2, true)}><Minus size={20} /></RoundBtn>
            <RoundBtn label="Ver todo el mapa" onClick={() => { setAnimate(true); setView(fitView(size.w, size.h)); }}><LocateFixed size={20} /></RoundBtn>
          </div>

          {/* Stations: the three emblems */}
          {game.stations && (
            <div className="absolute left-[calc(22px+0.5rem)] top-[calc(22px+0.5rem)] flex max-h-[calc(100%-22px-1rem)] flex-col items-start gap-2 overflow-y-auto">
              <StationsBar game={game} notes={stationNotes} open={stationsOpen} onToggle={() => setStationsOpen((o) => !o)} onOpen={setOpenStation} />
              {game.version >= 2 && (
                <button
                  onClick={() => {
                    audio.play("tap");
                    setCursesOpen(true);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-haspopup="dialog"
                  className="flex min-h-11 items-center gap-1.5 rounded-full bg-card/95 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted shadow-md ring-1 ring-border hover:bg-card"
                >
                  <CurseIcon size={16} />
                  Maldiciones
                </button>
              )}
            </div>
          )}

          {/* What's on the tapped cell */}
          {selected !== null && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
              <p className="max-w-full truncate rounded-full bg-card/95 px-4 py-2 text-sm shadow-lg ring-1 ring-border">
                <span className="font-mono font-semibold">{cellLabel(g, selected)}</span>
                {describeCell(game, selected).slice(cellLabel(g, selected).length)}
              </p>
            </div>
          )}
        </div>

        {/* Legend: side panel on desktop, sheet on mobile */}
        <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:block">
          <Legend game={game} onFocus={focusCell} onClearNotes={() => commit(EMPTY)} />
        </aside>
        {legendOpen && (
          <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25 lg:hidden" onClick={() => setLegendOpen(false)}>
            <div className="max-h-[75%] rounded-t-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <Legend game={game} onFocus={focusCell} onClearNotes={() => commit(EMPTY)} onClose={() => setLegendOpen(false)} />
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <footer className="flex items-center gap-1.5 border-t border-border bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:gap-2 sm:px-4">
        <div role="radiogroup" aria-label="Herramienta" className="flex gap-0.5 sm:gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tool === t.id}
              aria-label={t.label}
              onClick={() => setTool(t.id)}
              className={cn(
                "flex h-12 w-11 flex-col items-center justify-center rounded-xl text-[10px] leading-none transition-colors sm:w-16",
                tool === t.id ? "bg-foreground text-background" : "hover:bg-border/50",
              )}
            >
              {t.icon}
              <span className="mt-1 hidden sm:block">{t.label}</span>
            </button>
          ))}
          <button
            aria-label="Deshacer"
            onClick={undo}
            disabled={past.length === 0}
            className="flex h-12 w-11 flex-col items-center justify-center rounded-xl text-[10px] leading-none hover:bg-border/50 disabled:opacity-30 sm:w-16"
          >
            <Undo2 size={20} />
            <span className="mt-1 hidden sm:block">Deshacer</span>
          </button>
        </div>
        <button
          onClick={() => {
            audio.play("tap");
            setEnding(true);
          }}
          aria-haspopup="dialog"
          className="ml-auto flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-3 font-semibold text-accent-ink sm:max-w-56 sm:flex-none sm:px-5"
        >
          <Flag size={20} className="shrink-0" />
          <span className="truncate">Terminar</span>
        </button>
      </footer>

      {openStation !== null && game.stations && (
        <StationSheet
          game={game}
          station={game.stations[openStation]}
          note={stationNotes[openStation]}
          update={(f) => updateStation(openStation, f)}
          onFocus={(c) => {
            setOpenStation(null);
            focusCell(c);
          }}
          onClose={() => setOpenStation(null)}
        />
      )}

      {cursesOpen && <CurseSheet game={game} onClose={() => setCursesOpen(false)} />}

      {installHelp && <InstallHelp onClose={closeInstallHelp} />}

      {ending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setEnding(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="end-title" className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="end-title" className="font-display text-2xl">¿Cómo terminó?</h2>
            <p className="mt-2 text-sm text-muted">Pregúntale a tu pareja qué ve en su pantalla.</p>
            <div className="mt-6 grid gap-3">
              <Button size="lg" onClick={() => finish("won")} autoFocus>
                <DoorOpen size={20} /> {game.stations ? "Escaparon con los 3 sellos" : "Escaparon"}
              </Button>
              {game.stations && (
                <Button size="lg" variant="secondary" onClick={() => finish("escaped")}>
                  <LifeBuoy size={20} /> Salida de emergencia
                </Button>
              )}
              <Button size="lg" variant="secondary" onClick={() => finish("lost")}>
                <HeartCrack size={20} /> Atrapados: sin corazones
              </Button>
              <Button variant="ghost" onClick={() => setEnding(false)}>
                Seguir jugando
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function RoundBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-card/95 shadow-md ring-1 ring-border hover:bg-card"
    >
      {children}
    </button>
  );
}
