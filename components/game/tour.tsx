"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, Ghost, Heart, KeyRound, MessagesSquare } from "lucide-react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";
import { markHint } from "@/lib/hints";

/**
 * «Cómo se juega»: four short cards, skippable, shown on the first visit and
 * again from the button on the home screen. Little text, warm, no object names.
 */

const CARDS = [
  {
    icon: MessagesSquare,
    title: "Dos pantallas, una sola cabeza",
    text: "Una persona explora entre la niebla; la otra tiene el mapa. Nadie comparte pantalla: lo único que los conecta es la voz.",
  },
  {
    icon: Compass,
    title: "Describan, no nombren",
    text: "Nada tiene nombre. Inventen sus propias palabras para lo que ven: «la cosa con tres picos» vale perfectamente.",
  },
  {
    icon: Heart,
    title: "Corazones, vela y algo que ronda",
    text: "Tienen 3 corazones compartidos. La vela se gasta al caminar y los pozos duelen. A veces algo ronda: si oyes un latido, ¡avisa!",
  },
  {
    icon: KeyRound,
    title: "Sellos y claves habladas",
    text: "Tres estaciones guardan sellos con pruebas de a dos. Cuando una persona acierta, le dicta una clave a la otra. Con los tres sellos, se abre la salida.",
  },
] as const;

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const card = CARDS[i];
  const Icon = card.icon;
  const last = i === CARDS.length - 1;
  const opener = useRef<Element | null>(null);

  const finish = () => {
    markHint("tour");
    onClose();
  };

  useEffect(() => {
    opener.current = document.activeElement;
    document.getElementById("tour-primary")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((n) => Math.min(CARDS.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Cómo se juega · {i + 1} de {CARDS.length}</p>
        <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Icon size={28} aria-hidden />
        </div>
        <h2 id="tour-title" className="mt-4 font-display text-2xl leading-tight">{card.title}</h2>
        <p className="mt-2 text-muted" aria-live="polite">{card.text}</p>
        <div className="mt-5 flex justify-center gap-2" aria-hidden>
          {CARDS.map((_, n) => (
            <span key={n} className={cn("h-2 rounded-full transition-all", n === i ? "w-6 bg-accent" : "w-2 bg-border")} />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
          <Button variant="ghost" onClick={finish} className="text-muted">
            {last ? "Cerrar" : "Saltar"}
          </Button>
          <Button id="tour-primary" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? (
              <>
                <Ghost size={18} aria-hidden /> ¡A jugar!
              </>
            ) : (
              "Siguiente"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
