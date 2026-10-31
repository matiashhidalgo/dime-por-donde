"use client";

import { useSyncExternalStore } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { type SoundMode, audio } from "@/lib/audio";
import { cn } from "@/lib/utils";

const NEXT: Record<SoundMode, SoundMode> = { all: "sfx", sfx: "off", off: "all" };
const LABEL: Record<SoundMode, string> = {
  all: "Sonido: música y efectos. Toca para dejar solo efectos",
  sfx: "Sonido: solo efectos. Toca para silenciar",
  off: "Sonido apagado. Toca para encender música y efectos",
};
const SHORT: Record<SoundMode, string> = { all: "Música", sfx: "Efectos", off: "Silencio" };

export function useSoundMode(): SoundMode {
  return useSyncExternalStore(audio.subscribe, () => audio.mode, () => "all");
}

/** Cycles music+effects → effects only → silence. Remembered per device. */
export function SoundToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const mode = useSoundMode();
  const Icon = mode === "all" ? Music : mode === "sfx" ? Volume2 : VolumeX;
  return (
    <button
      onClick={() => {
        const next = NEXT[mode];
        audio.setMode(next);
        audio.unlock();
        audio.play("tap");
      }}
      aria-label={LABEL[mode]}
      title={LABEL[mode]}
      className={cn(
        "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border hover:bg-border/40",
        showLabel ? "px-3.5" : "w-11",
        mode === "off" && "text-muted",
        className,
      )}
    >
      <Icon size={19} />
      {showLabel && <span className="text-sm">{SHORT[mode]}</span>}
    </button>
  );
}
