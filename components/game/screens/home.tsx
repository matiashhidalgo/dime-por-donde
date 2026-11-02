"use client";

import { useEffect, useState } from "react";
import { BookOpen, Compass, Flame, History, KeyRound, Map as MapIcon, RotateCcw, Sparkles } from "lucide-react";
import { hintSeen } from "@/lib/hints";
import { Tour } from "../tour";
import { bestStreak } from "@/lib/history";
import { DecorMaze } from "../decor-maze";
import { SoundToggle } from "../sound-toggle";
import { Button, Card, Screen } from "../ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE } from "@/lib/site";
import { TUNING } from "@/src/engine";

export interface ResumeOffer {
  label: string;
  onResume: () => void;
  onDiscard: () => void;
}

export function HomeScreen({
  onCreate,
  onJoin,
  onHistory,
  resume,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onHistory: () => void;
  resume?: ResumeOffer | null;
}) {
  const [best, setBest] = useState(0);
  const [tour, setTour] = useState(false);
  useEffect(() => {
    setBest(bestStreak());
    // First visit on this device: the four cards, once (they can skip; it won't come back by itself).
    if (!hintSeen("tour") && !resume) setTour(true);
  }, [resume]);
  return (
    <Screen>
      <header className="flex min-h-12 items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Un juego para dos</span>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>

      <section className="pt-4 text-center">
        <Card className="mx-auto mb-7 max-w-xs p-3 sm:p-4">
          <DecorMaze className="h-auto w-full text-foreground" />
        </Card>
        <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-tight sm:text-5xl">{SITE.name}</h1>
        <p className="mx-auto mt-4 max-w-sm text-balance text-muted">
          Una persona explora entre la niebla. La otra tiene el mapa. Solo se tienen a sí mismos… y una videollamada.
        </p>
      </section>

      {resume && (
        <Card className="mt-8 border-accent/40">
          <p className="font-medium">Tenías una partida en curso</p>
          <p className="mt-0.5 text-sm text-muted">{resume.label}</p>
          <p className="mt-2 text-sm text-muted">Si eras explorador, vuelves a la entrada del mapa con los corazones con que lo empezaron.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={resume.onDiscard}>
              Descartar
            </Button>
            <Button onClick={resume.onResume}>
              <RotateCcw size={18} /> Continuar
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-8 grid gap-3">
        <Button size="lg" onClick={onCreate}>
          <Sparkles size={20} /> Crear partida
        </Button>
        <Button size="lg" variant="secondary" onClick={onJoin}>
          <KeyRound size={20} /> Tengo un código
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => setTour(true)} className="text-muted">
            <BookOpen size={18} /> Cómo se juega
          </Button>
          <Button variant="ghost" onClick={onHistory} className="text-muted">
            <History size={18} /> Historial
          </Button>
        </div>
      </div>
      {best > 0 && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
          <Flame size={16} /> Su mejor racha: {best === 1 ? "1 mapa" : `${best} mapas`}
        </p>
      )}

      <Card className="mt-8">
        <h2 className="font-display text-xl">En tres pasos</h2>
        <ol className="mt-3 space-y-3 text-sm">
          <li className="flex gap-3">
            <Step n={1} />
            <span>Una persona crea la partida y le dicta el código a la otra. Cada quien en su propio dispositivo.</span>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <span className="flex-1">
              Elijan roles: <Compass size={14} className="inline align-[-2px]" /> <b>Explorador</b> ve solo lo que tiene cerca;{" "}
              <MapIcon size={14} className="inline align-[-2px]" /> <b>Guía</b> ve el mapa completo, con trampas, pero no sabe dónde está el explorador.
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={3} />
            <span>
              Hablen hasta escapar. Tienen {TUNING.hearts} corazones compartidos: los pozos y quedarse a oscuras cuestan uno. La vela del explorador se gasta al
              caminar; los faroles y las velas del camino la recargan. Bonus: recojan las estrellas.
            </span>
          </li>
        </ol>
      </Card>
      {tour && <Tour onClose={() => setTour(false)} />}
    </Screen>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
      {n}
    </span>
  );
}
