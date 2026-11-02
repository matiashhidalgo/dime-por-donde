"use client";

import { Compass, Lightbulb, Map as MapIcon, ShieldCheck } from "lucide-react";
import { ROLE_NAME } from "@/lib/history";
import { startTip } from "@/lib/phrases";
import { CodeDisplay } from "../code-display";
import { type Session, describeGame, otherRole, sealOf } from "../session";
import { Button, Card, Screen, TopBar } from "../ui";

/**
 * Code to dictate + a seal both players compare out loud. Then each one taps
 * «Empezar» whenever ready: no countdown, nothing to synchronize (v2).
 */
export function LobbyScreen({ session, onBack, onReady }: { session: Session; onBack: () => void; onReady: () => void }) {
  const game = session.game;
  const RoleIcon = session.role === "guide" ? MapIcon : Compass;
  return (
    <Screen>
      <TopBar title={session.creator ? "Díctale el código" : "Todo listo"} onBack={onBack} />

      <Card className="text-center">
        <p className="mb-4 text-sm text-muted">
          {session.creator ? "Léelo despacio. Tu pareja lo escribe en «Tengo un código»." : "Este es el código de su partida."}
        </p>
        <CodeDisplay code={session.code} size={session.creator ? "lg" : "md"} />
      </Card>

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-accent-2" />
          <div>
            <p className="text-sm text-muted">Sello de la partida. Léanlo en voz alta: debe ser idéntico en las dos pantallas. Si no coincide, recarguen la página en los dos.</p>
            <p className="mt-1 font-display text-2xl">{sealOf(game)}</p>
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
              Eres {ROLE_NAME[session.role].toLowerCase()}
            </p>
            <p className="text-sm text-muted">
              Tu pareja: {ROLE_NAME[otherRole(session.role)].toLowerCase()} · {describeGame(game)}
            </p>
          </div>
        </div>
        {session.streak && (
          <p className="mt-4 rounded-2xl bg-accent/10 p-3 text-sm">
            <b>Racha.</b> Mapas seguidos con los mismos corazones, hasta que se acaben. Cambian de rol en cada mapa: al terminar, la pantalla del explorador
            muestra una clave de relevo para la otra.
          </p>
        )}
        <p className="mt-4 rounded-2xl bg-background/70 p-3 text-sm">
          {game.stations
            ? "Hay 3 estaciones con una prueba cada una. La salida solo se abre con los 3 sellos."
            : "Código de antes de las estaciones: sin sellos, solo lleguen a la salida."}
        </p>
        <p className="mt-2 flex gap-2 rounded-2xl bg-background/70 p-3 text-sm">
          <Lightbulb size={18} className="mt-px shrink-0 text-amber-500" />
          {startTip(session.code, session.role)}
        </p>
      </Card>

      <Button size="lg" className="mt-6 w-full" onClick={onReady}>
        Empezar
      </Button>
      <p className="mt-3 text-center text-sm text-muted">Cada quien toca «Empezar» cuando esté listo. No hace falta contar hasta 3.</p>
    </Screen>
  );
}
