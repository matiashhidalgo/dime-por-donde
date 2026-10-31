"use client";

import { useEffect, useState } from "react";
import { Compass, Flag, Map as MapIcon, RotateCcw } from "lucide-react";
import { formatCode } from "@/src/engine";
import { formatTime } from "@/lib/hooks";
import { type HistoryEntry, loadHistory } from "@/lib/history";
import { storageIsPersistent } from "@/lib/storage";
import { MODE_NAME } from "../session";
import { Button, Card, Screen, Stars, TopBar } from "../ui";

export function HistoryScreen({ onBack, onReplay }: { onBack: () => void; onReplay: (code: string) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    setEntries(loadHistory());
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
          <p className="mt-2 text-sm text-muted">Cuando terminen una, aparece aquí con su tiempo y sus estrellas.</p>
        </Card>
      )}
      <ul className="space-y-3">
        {entries?.map((e) => (
          <li key={e.id}>
            <Card className="p-4 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-semibold tracking-widest">{formatCode(e.code)}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {MODE_NAME[e.mode]}
                    {e.mode === "duo" && ` · ronda ${e.round}`} ·{" "}
                    {new Date(e.date).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {e.result === "won" ? (
                  <Stars value={e.rating} size={18} />
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
                  {e.result === "won" && (
                    <span className="tabular-nums text-muted">
                      {e.timeMs !== null ? formatTime(e.timeMs) : "sin tiempo"} · {e.stars}★ · {e.pits} pozos
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
