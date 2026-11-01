"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History } from "lucide-react";
import { CODE_LENGTH, parseCode } from "@/src/engine";
import { type Role, ROLE_NAME, lastPlayed } from "@/lib/history";
import { cn } from "@/lib/utils";
import { LEGACY_MODE_NAME } from "../session";
import { Button, Card, Screen, TopBar } from "../ui";
import { RoleField } from "./setup-fields";

/** Formats raw typing as "ABCD-EFGH" while keeping the caret natural. */
function pretty(raw: string): string {
  const t = raw.toUpperCase().replace(/[^0-9A-ZÑ]/g, "").slice(0, CODE_LENGTH);
  return t.length > 4 ? `${t.slice(0, 4)}-${t.slice(4)}` : t;
}

export function JoinScreen({
  prefill,
  replay,
  onBack,
  onJoin,
}: {
  prefill?: string;
  replay?: boolean;
  onBack: () => void;
  onJoin: (code: string, role: Role) => void;
}) {
  const [text, setText] = useState(pretty(prefill ?? ""));
  const [role, setRole] = useState<Role>("explorer");

  const raw = text.replace(/-/g, "");
  const parsed = useMemo(() => (raw ? parseCode(raw) : null), [raw]);
  const complete = raw.length >= CODE_LENGTH;
  // Show errors as soon as they're certain: bad characters immediately, the rest once all 8 are in.
  const error = parsed && !parsed.ok && (complete || parsed.error === "invalid-char") ? parsed.message : null;
  const valid = parsed?.ok ? parsed.value : null;
  const played = valid ? lastPlayed(valid.code) : null;

  return (
    <Screen>
      <TopBar title={replay ? "Rejugar" : "Unirme"} onBack={onBack} />
      <Card>
        <label htmlFor="code" className="text-sm font-medium text-muted">
          Código que te dictaron
        </label>
        <input
          id="code"
          value={text}
          onChange={(e) => setText(pretty(e.target.value))}
          placeholder="ABCD-2345"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={!!error}
          aria-describedby="code-help"
          className={cn(
            "mt-2 w-full rounded-2xl border-2 bg-background px-4 py-3 text-center font-mono text-3xl font-semibold tracking-[0.25em] uppercase outline-none transition-colors placeholder:text-muted/40",
            error ? "border-red-500" : valid ? "border-accent-2" : "border-border focus:border-accent",
          )}
        />
        <div id="code-help" aria-live="polite" className="mt-3 min-h-6 text-sm">
          {error && (
            <p className="flex items-start gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle size={18} className="mt-px shrink-0" /> {error}
            </p>
          )}
          {valid && (
            <p className="flex items-start gap-2 text-accent-2">
              <CheckCircle2 size={18} className="mt-px shrink-0" />
              Código válido
              {valid.mode !== "hard" && ` · código anterior (${LEGACY_MODE_NAME[valid.mode]}), se juega con las reglas nuevas`}
              {parsed?.ok && parsed.corrected && " (corregí V→B / N→M)"}
            </p>
          )}
          {valid && valid.version === 1 && (
            <p className="mt-2 rounded-xl bg-background/70 p-3 text-muted">
              Es un código de antes de las estaciones: esta partida no tiene sellos, solo lleguen a la salida.
            </p>
          )}
          {!error && !valid && <p className="text-muted">8 caracteres. No importan mayúsculas ni guiones.</p>}
        </div>
        {played && !replay && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <History size={18} className="mt-px shrink-0" />
            Ya jugaste este código el {new Date(played.date).toLocaleDateString("es", { day: "numeric", month: "long" })} como{" "}
            {ROLE_NAME[played.role].toLowerCase()}. Puedes jugarlo otra vez, pero ya conoces el camino.
          </p>
        )}
      </Card>

      <Card className="mt-4 space-y-6">
        <RoleField value={role} onChange={setRole} />
      </Card>

      <Button size="lg" className="mt-6 w-full" disabled={!valid} onClick={() => valid && onJoin(valid.code, role)}>
        Entrar
      </Button>
    </Screen>
  );
}
