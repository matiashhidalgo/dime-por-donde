"use client";

import { Compass, Lightbulb, Map as MapIcon, ShieldCheck } from "lucide-react";
import { DIFFICULTIES } from "@/src/engine";
import { ROLE_NAME } from "@/lib/history";
import { startTip } from "@/lib/phrases";
import { CodeDisplay } from "../code-display";
import { type Session, MODE_NAME, describeGame, otherRole, sealOf } from "../session";
import { Button, Card, Screen, TopBar } from "../ui";

/** Code to dictate + a seal both players compare out loud before starting. */
export function LobbyScreen({ session, onBack, onReady }: { session: Session; onBack: () => void; onReady: () => void }) {
  const game = session.games[session.round];
  const RoleIcon = session.role === "guide" ? MapIcon : Compass;
  return (
    <Screen>
      <TopBar title={session.creator ? "Díctale el código" : "Todo listo"} onBack={onBack} />

      <Card className="text-center">
        <p className="mb-4 text-sm text-muted">
          {session.creator ? "Léelo despacio. Tu pareja lo escribe en «Tengo un código»." : "Este es el código de su partida."}
        </p>
        <CodeDisplay code={session.code} size={session.creator ? "lg" : "md"} />
        <p className="mt-4 text-sm font-medium">{MODE_NAME[session.mode]}</p>
      </Card>

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-accent-2" />
          <div>
            <p className="text-sm text-muted">Sello de la partida. Léanlo en voz alta: debe ser idéntico en las dos pantallas.</p>
            <p className="mt-1 font-display text-2xl">{sealOf(session.games)}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <RoleIcon size={22} />
          </span>
          <div>
            <p className="font-medium">
              Eres {ROLE_NAME[session.role].toLowerCase()} {session.mode === "duo" && `en la ronda ${session.round + 1}`}
            </p>
            <p className="text-sm text-muted">
              Tu pareja: {ROLE_NAME[otherRole(session.role)].toLowerCase()} · {describeGame(game)}
              {session.role === "explorer" && ` · visión ${DIFFICULTIES[game.level].vision} pasos`}
            </p>
          </div>
        </div>
        <p className="mt-4 flex gap-2 rounded-2xl bg-background/70 p-3 text-sm">
          <Lightbulb size={18} className="mt-px shrink-0 text-amber-500" />
          {startTip(`${session.code}-${session.round}`, session.role)}
        </p>
      </Card>

      <Button size="lg" className="mt-6 w-full" onClick={onReady}>
        Estamos listos
      </Button>
    </Screen>
  );
}
