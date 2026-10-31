"use client";

import { useState } from "react";
import type { CodeMode } from "@/src/engine";
import type { Role } from "@/lib/history";
import { Button, Card, ChoiceGroup, Screen, TopBar } from "../ui";
import { RoleField, TimedField } from "./setup-fields";

export interface CreateChoice {
  mode: CodeMode;
  role: Role;
  timed: boolean;
}

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
  const set = (patch: Partial<CreateChoice>) => setChoice((c) => ({ ...c, ...patch }));
  return (
    <Screen>
      <TopBar title="Nueva partida" onBack={onBack} />
      <Card className="space-y-6">
        <ChoiceGroup
          label="Dificultad"
          value={choice.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: "easy", title: "Fácil", hint: "12×12 · para calentar" },
            { value: "medium", title: "Medio", hint: "18×18 · ya en serio" },
            { value: "hard", title: "Difícil", hint: "26×26 · sin piedad" },
            { value: "duo", title: "Dúo", hint: "3 rondas, cambian roles" },
          ]}
        />
        <RoleField value={choice.role} onChange={(role) => set({ role })} />
        <TimedField value={choice.timed} onChange={(timed) => set({ timed })} />
      </Card>
      <Button size="lg" className="mt-6 w-full" onClick={() => onCreate(choice)}>
        Crear código
      </Button>
      <p className="mt-3 text-center text-sm text-muted">
        Tu pareja va a necesitar el rol contrario. El cronómetro lo elige cada quien.
      </p>
    </Screen>
  );
}
