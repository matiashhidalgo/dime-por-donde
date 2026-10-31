"use client";

import { useEffect, useMemo, useState } from "react";
import { MazeSvg, ShapeMark } from "@/components/debug/maze-svg";
import {
  type CodeMode,
  type Game,
  DIFFICULTIES,
  KEY_COLORS,
  PORTAL_SYMBOLS,
  THEMES,
  auditGame,
  cellLabel,
  createCode,
  fingerprint,
  formatCode,
  gamesForCode,
  parseCode,
} from "@/src/engine";

const MODE_LABEL: Record<CodeMode, string> = { easy: "Fácil", medium: "Medio", hard: "Difícil", duo: "Dúo" };

function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

function readCodeFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("code") ?? "";
}

export default function DebugPage() {
  const [input, setInput] = useState("");
  const [round, setRound] = useState(0);
  const [opts, setOpts] = useState({ showRoute: true, showLandmarks: true, showCoords: true });

  useEffect(() => {
    setInput(readCodeFromUrl() || createCode({ mode: "medium", random: cryptoRandom }));
  }, []);

  const parsed = useMemo(() => (input ? parseCode(input) : null), [input]);
  const result = useMemo(() => {
    if (!parsed?.ok) return null;
    const t0 = performance.now();
    const games = gamesForCode(parsed.value);
    return { games, ms: performance.now() - t0 };
  }, [parsed]);

  useEffect(() => {
    if (!parsed?.ok) return;
    const url = new URL(window.location.href);
    url.searchParams.set("code", parsed.value.code);
    window.history.replaceState(null, "", url);
    setRound(0);
  }, [parsed]);

  const game = result?.games[Math.min(round, result.games.length - 1)];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Dime por dónde · motor v1</p>
          <h1 className="text-2xl font-bold tracking-tight">/debug</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODE_LABEL) as CodeMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setInput(createCode({ mode, random: cryptoRandom }))}
              className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-foreground hover:text-background"
            >
              Nuevo {MODE_LABEL[mode].toLowerCase()}
            </button>
          ))}
        </div>
      </header>

      <section className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-sm text-muted">Código</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoCapitalize="characters"
            className="w-40 rounded-lg border border-border bg-transparent px-3 py-1.5 font-mono text-lg tracking-widest uppercase"
          />
        </label>
        {parsed?.ok && (
          <span className="font-mono text-lg tracking-[0.25em]">{formatCode(parsed.value.code)}</span>
        )}
        {parsed && !parsed.ok && <span className="text-sm text-red-500">{parsed.message}</span>}
        {parsed?.ok && parsed.corrected && (
          <span className="text-sm text-amber-600">Corregí letras que suenan igual (V→B, N→M).</span>
        )}
      </section>

      {result && result.games.length > 1 && (
        <nav className="mb-4 flex gap-2">
          {result.games.map((g, i) => (
            <button
              key={i}
              onClick={() => setRound(i)}
              className={`rounded-full px-3 py-1 text-sm ${i === round ? "bg-foreground text-background" : "border border-border"}`}
            >
              Ronda {i + 1} · {DIFFICULTIES[g.level].name}
            </button>
          ))}
        </nav>
      )}

      {game && result && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["showRoute", "Ruta óptima"],
                  ["showLandmarks", "Puntos de referencia"],
                  ["showCoords", "Coordenadas"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <MazeSvg game={game} options={opts} />
            </div>
            <Legend />
          </div>
          <Sidebar game={game} ms={result.ms} />
        </div>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium tabular-nums">{v}</span>
    </div>
  );
}

function Sidebar({ game, ms }: { game: Game; ms: number }) {
  const audit = useMemo(() => auditGame(game), [game]);
  const s = game.stats;
  const cfg = DIFFICULTIES[game.level];
  const L = (c: number) => cellLabel(game.grid, c);
  const retries = Object.entries(s.failures);

  return (
    <aside className="space-y-5">
      <div
        className={`rounded-xl px-4 py-3 text-sm font-medium ${audit.ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-500/15 text-red-600"}`}
      >
        {audit.ok ? "Auditoría OK: resoluble, sin bloqueos, todo alcanzable" : `Auditoría: ${audit.problems.join(" · ")}`}
      </div>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Partida</h2>
        <Row k="Nivel" v={`${cfg.name} · ${game.grid.width}×${game.grid.height}`} />
        <Row k="Tema" v={THEMES[game.theme].name} />
        <Row k="Algoritmo" v={game.algorithm} />
        <Row k="Obstáculos" v={game.obstacleTypes.join(", ")} />
        <Row k="Visión / memoria" v={`${cfg.vision} pasos · ${cfg.memory}`} />
        <Row k="Huella" v={<code className="text-xs">{fingerprint(game)}</code>} />
        <Row k="Generación" v={`${ms.toFixed(1)} ms · intento ${s.attempt + 1}`} />
        {retries.length > 0 && <Row k="Reintentos" v={retries.map(([r, n]) => `${r}×${n}`).join(", ")} />}
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Ruta</h2>
        <Row k="Movimientos mínimos" v={s.solutionMoves} />
        <Row k="Casillas recorridas" v={s.solutionCells} />
        <Row k="Decisiones (cruces)" v={s.routeDecisions} />
        <Row k="Esfuerzo" v={`${s.effort} (rango ${cfg.effort[0]}–${cfg.effort[1]})`} />
        <Row k="Ruta sin obstáculos" v={s.plainPath} />
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Laberinto</h2>
        <Row k="Callejones sin salida" v={s.deadEnds} />
        <Row k="Cruces" v={s.junctions} />
        <Row k="Ciclos" v={`${s.loops} (braiding abrió ${s.braidOpened})`} />
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Elementos</h2>
        <Row k="Entrada → salida" v={`${L(game.start)} → ${L(game.exit)}`} />
        <Row k="Banderas" v={game.checkpoints.map(L).join(", ")} />
        <Row k="Pozos" v={s.pits} />
        {game.doors.map((d, i) => {
          const k = KEY_COLORS[d.color];
          const key = game.keys.find((x) => x.color === d.color)!;
          return <Row key={i} k={`Puerta ${k.colorName} (${k.shapeName})`} v={`${L(d.cell)} · llave en ${L(key.cell)}`} />;
        })}
        {game.portals.map((p, i) => {
          const sym = PORTAL_SYMBOLS[p.symbol];
          return <Row key={i} k={`Portal ${sym.shapeName} ${sym.colorName}`} v={`${L(p.a)} ↔ ${L(p.b)}`} />;
        })}
        {game.ponds.length > 0 && (
          <Row k="Hielo" v={`${game.ponds.length} zona(s), ${s.iceCells} casillas`} />
        )}
        {game.swirls.map((w, i) => (
          <Row key={i} k={`Remolino ${i + 1}`} v={`${L(w.cell)} · ${w.axes === "xy" ? "ambos ejes" : "izq/der"} · ${w.steps} pasos`} />
        ))}
        <Row k="Estrellas" v={game.stars.map(L).join(", ")} />
        <Row k="Faroles" v={game.lanterns.map(L).join(", ")} />
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Puntos de referencia</h2>
        <ol className="space-y-0.5 text-sm">
          {game.landmarks.map((l, i) => (
            <li key={i} className="flex justify-between">
              <span>
                <span className="text-muted">{i + 1}.</span> {l.label}
              </span>
              <span className="font-mono text-muted">{L(l.cell)}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function Legend() {
  const item = (icon: React.ReactNode, label: string) => (
    <span key={label} className="flex items-center gap-1.5">
      <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
        {icon}
      </svg>
      {label}
    </span>
  );
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
      {item(<circle cx={9} cy={9} r={7} fill="#3a9d5d" />, "Entrada (E)")}
      {item(<rect x={2} y={2} width={14} height={14} rx={3} fill="currentColor" />, "Salida (S)")}
      {item(<circle cx={9} cy={9} r={6} fill="#1f1b18" />, "Pozo")}
      {item(<rect x={1} y={1} width={16} height={16} fill="#bfe3f5" />, "Hielo")}
      {item(<polygon points="4,2 16,6 4,10" fill="#e9c46a" stroke="currentColor" />, "Bandera")}
      {item(<path d="M9,9 m0,-1 a2,2 0 1,1 -2,2 a4,4 0 1,1 4,4" fill="none" stroke="#8e5bd6" strokeWidth={1.6} />, "Remolino (punto = ambos ejes)")}
      {item(<rect x={5} y={3} width={8} height={11} rx={2} fill="#ffd166" />, "Farol")}
      {KEY_COLORS.map((k) =>
        item(<ShapeMark shape={k.shape} cx={9} cy={9} r={6} fill={k.hex} />, `Llave/puerta ${k.colorName}`),
      )}
      {PORTAL_SYMBOLS.map((p) => item(<ShapeMark shape={p.shape} cx={9} cy={9} r={6} fill={p.hex} />, `Portal ${p.colorName}`))}
    </div>
  );
}
