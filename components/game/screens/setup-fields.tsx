"use client";

import { Compass, Map as MapIcon } from "lucide-react";
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
