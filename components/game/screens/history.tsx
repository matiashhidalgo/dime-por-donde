"use client";

import { useEffect, useState } from "react";
import { Compass, Flame, Flag, LifeBuoy, Map as MapIcon, RotateCcw, Skull } from "lucide-react";
import { formatCode } from "@/src/engine";
import { formatTime } from "@/lib/hooks";
import { type HistoryEntry, type StreakRecord, loadHistory, loadStreaks } from "@/lib/history";
import { storageIsPersistent } from "@/lib/storage";
import { LEGACY_MODE_NAME } from "../session";
import { Button, Card, Screen, Stars, TopBar } from "../ui";

export function HistoryScreen({ onBack, onReplay }: { onBack: () => void; onReplay: (code: string) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [streaks, setStreaks] = useState<StreakRecord[]>([]);
  useEffect(() => {
    setEntries(loadHistory());
    setStreaks(loadStreaks());
    setPersistent(storageIsPersistent());
  }, []);

  return (
    <Screen>
      <TopBar title="Historial" onBack={onBack} />
      {!persistent && (
        <p className="mb-4 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Este navegador no deja guardar datos (¿modo privado?). El historial se borra al cerrar la pestaña.
        </p>
      )}
      {entries && entries.length === 0 && (
        <Card className="text-center">
          <p className="font-display text-xl">Todavía no hay partidas</p>
          <p className="mt-2 text-sm text-muted">Cuando terminen una, aparece aquí con sus corazones y sus estrellas.</p>
        </Card>
      )}
      {streaks.length > 0 && (
        <section className="mb-6" aria-labelledby="streaks-title">
          <h2 id="streaks-title" className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-widest text-muted">
            <Flame size={15} /> Rachas
          </h2>
          <ul className="space-y-2">
            {streaks.slice(0, 10).map((r) => (
              <li key={r.id}>
                <Card className="flex items-center justify-between gap-3 p-4 sm:p-4">
                  <div className="min-w-0">
                    <p className="font-display text-2xl tabular-nums">
                      {r.maps} <span className="text-base text-muted">{r.maps === 1 ? "mapa" : "mapas"}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {r.seals} sellos · {r.heartsLost} ♥ perdidos{r.escapes > 0 && ` · ${r.escapes === 1 ? "1 huida" : `${r.escapes} huidas`}`}
                      {r.end === "abandoned" && " · la dejaron"}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-muted">
                    <span className="block font-mono text-sm tracking-widest">{formatCode(r.code)}</span>
                    {new Date(r.date).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="space-y-3">
        {entries?.map((e) => (
          <li key={e.id}>
            <Card className="p-4 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-semibold tracking-widest">{formatCode(e.code)}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {e.streakIndex !== undefined ? `Racha · mapa ${e.streakIndex + 1}` : e.mode === "hard" ? "Expedición" : `${LEGACY_MODE_NAME[e.mode]} (v1)`}
                    {e.mode === "duo" && e.streakIndex === undefined && ` · ronda ${e.round}`} ·{" "}
                    {new Date(e.date).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {e.ending === "escaped" ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                    <LifeBuoy size={12} /> Emergencia
                  </span>
                ) : e.result === "won" ? (
                  e.streakIndex !== undefined ? (
                    <span className="rounded-full bg-[#2f6e4a]/12 px-2 py-0.5 text-xs text-[#2f6e4a] dark:text-[#8fd6a8]">Superado</span>
                  ) : (
                    <Stars value={e.rating} size={18} />
                  )
                ) : e.result === "lost" ? (
                  <span className="flex items-center gap-1 rounded-full bg-[#9b2d3a]/10 px-2 py-0.5 text-xs text-[#9b2d3a] dark:text-[#f0a0aa]">
                    <Skull size={12} /> Atrapados
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-border/60 px-2 py-0.5 text-xs text-muted">
                    <Flag size={12} /> Abandonada
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    {e.role === "guide" ? <MapIcon size={15} /> : <Compass size={15} />}
                    {e.role === "guide" ? "Guía" : "Explorador"}
                  </span>
                  {e.result !== "abandoned" && (
                    <span className="tabular-nums text-muted">
                      {e.hearts !== undefined && `${e.hearts} ♥ · `}
                      {e.stars}★ · {e.pits} pozos{e.timeMs !== null && ` · ${formatTime(e.timeMs)}`}
                    </span>
                  )}
                </p>
                <Button variant="secondary" className="min-h-10 px-3 text-sm" onClick={() => onReplay(e.code)}>
                  <RotateCcw size={15} /> Rejugar
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
