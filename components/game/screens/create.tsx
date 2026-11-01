"use client";

import { useState } from "react";
import { Flame, Mountain } from "lucide-react";
import type { Role } from "@/lib/history";
import { cn } from "@/lib/utils";
import { Button, Card, Screen, TopBar } from "../ui";
import { RoleField } from "./setup-fields";

export interface CreateChoice {
  role: Role;
  /** «Racha»: maps in a row until the hearts run out, roles swapping each map. */
  streak: boolean;
}

/** v2: one Difícil expedition («Partida única») or a «Racha»; and your role (on the first map, for a Racha). */
export function CreateScreen({
  initial,
  onBack,
  onCreate,
}: {
  initial: CreateChoice;
  onBack: () => void;
  onCreate: (c: CreateChoice) => void;
}) {
  const [choice, setChoice] = useState(initial);
  const kinds = [
    { streak: false, icon: Mountain, title: "Partida única", text: "Un mapa, tres sellos y la salida." },
    { streak: true, icon: Flame, title: "Racha", text: "Mapa tras mapa con los mismos corazones. Cambian de rol en cada uno." },
  ];
  return (
    <Screen>
      <TopBar title="Nueva expedición" onBack={onBack} />
      <Card className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">¿Qué juegan?</legend>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {kinds.map((k) => {
              const on = choice.streak === k.streak;
              const Icon = k.icon;
              return (
                <button
                  key={k.title}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setChoice((c) => ({ ...c, streak: k.streak }))}
                  className={cn(
                    "flex min-h-11 items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors",
                    on ? "border-foreground bg-foreground/5" : "border-border hover:bg-border/30",
                  )}
                >
                  <Icon size={22} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-medium">{k.title}</span>
                    <span className="block text-sm text-muted">{k.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <RoleField value={choice.role} onChange={(role) => setChoice((c) => ({ ...c, role }))} />
      </Card>
      <Button size="lg" className="mt-6 w-full" onClick={() => onCreate(choice)}>
        Crear código
      </Button>
      <p className="mt-3 text-center text-sm text-muted">
        Tu pareja va a necesitar el rol contrario{choice.streak ? " en el primer mapa" : ""}.
      </p>
    </Screen>
  );
}
