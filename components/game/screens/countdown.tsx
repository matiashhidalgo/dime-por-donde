"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lightbulb, Repeat } from "lucide-react";
import { audio, buzz } from "@/lib/audio";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { SoundToggle } from "../sound-toggle";
import { Button, Screen, TopBar } from "../ui";

/**
 * Start ritual. No sync between devices: both say "¡ya!" out loud and tap at
 * the same time; each screen counts 3-2-1 on its own.
 */
export function CountdownScreen({
  label,
  swapTo,
  tip,
  onBack,
  onGo,
}: {
  label: string;
  /** Set between duo rounds: the role this device switches to. */
  swapTo?: string;
  tip?: string;
  onBack: () => void;
  onGo: (startedAt: number) => void;
}) {
  const [n, setN] = useState<number | null>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    if (n === null) return;
    audio.play(n === 0 ? "go" : "tick");
    if (n === 0) {
      const t = window.setTimeout(() => onGo(Date.now()), 550);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setN(n - 1), 900);
    return () => window.clearTimeout(t);
  }, [n, onGo]);

  const start = () => {
    buzz(30);
    audio.unlock();
    setN(3);
  };

  return (
    <Screen className="flex flex-col">
      <TopBar onBack={n === null ? onBack : undefined} right={<SoundToggle />} />
      <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
        {n === null ? (
          <>
            {swapTo && (
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-2/15 px-4 py-1.5 text-sm font-semibold text-accent-2">
                <Repeat size={16} /> Cambio de roles: ahora eres {swapTo}
              </p>
            )}
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">{label}</p>
            <h1 className="mt-3 max-w-xs font-display text-4xl leading-tight">
              Digan <span className="text-accent">«¡ya!»</span> a la vez y toquen empezar
            </h1>
            <p className="mt-4 max-w-xs text-muted">Cada pantalla cuenta por su cuenta: si lo hacen juntos, sus cronómetros van parejos.</p>
            {tip && (
              <p className="mt-5 flex max-w-sm gap-2 rounded-2xl bg-card/80 p-3 text-left text-sm">
                <Lightbulb size={18} className="mt-px shrink-0 text-amber-500" />
                {tip}
              </p>
            )}
            <Button size="lg" className="mt-10 h-20 w-56 rounded-full text-2xl" onClick={start}>
              Empezar
            </Button>
          </>
        ) : (
          <div className="relative flex h-56 w-56 items-center justify-center" aria-live="assertive">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={n}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute font-display text-[9rem] leading-none text-accent"
              >
                {n === 0 ? "¡Ya!" : n}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>
    </Screen>
  );
}
