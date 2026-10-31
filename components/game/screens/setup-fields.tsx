"use client";

import { Compass, Map as MapIcon, Timer, TimerOff } from "lucide-react";
import type { Role } from "@/lib/history";
import { ChoiceGroup } from "../ui";

export function RoleField({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <ChoiceGroup
      label="Tu rol"
      value={value}
      onChange={onChange}
      options={[
        { value: "explorer", title: "Explorador", hint: "Caminas entre la niebla", icon: <Compass size={18} /> },
        { value: "guide", title: "Guía", hint: "Tienes el mapa completo", icon: <MapIcon size={18} /> },
      ]}
    />
  );
}

export function TimedField({ value, onChange }: { value: boolean; onChange: (t: boolean) => void }) {
  return (
    <ChoiceGroup
      label="Cronómetro"
      value={value ? "timed" : "free"}
      onChange={(v) => onChange(v === "timed")}
      options={[
        { value: "timed", title: "Con tiempo", hint: "Para los competitivos", icon: <Timer size={18} /> },
        { value: "free", title: "Sin tiempo", hint: "Paseo tranquilo", icon: <TimerOff size={18} /> },
      ]}
    />
  );
}
