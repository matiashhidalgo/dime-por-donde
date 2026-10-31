import { DIFFICULTIES, type Game, type PlayEvent, type PlayState, THEMES, doorName, keyName, portalName } from "@/src/engine";

/**
 * What the explorer reads after each event. Always the same names as the
 * guide's legend (so they can repeat them out loud), wrapped in a few warm,
 * teasing lines that rotate so the same one never shows twice in a row.
 */
export type Messenger = (e: PlayEvent, s: PlayState) => string | null;

export function createMessenger(game: Game): Messenger {
  const last = new Map<string, number>();
  const pick = (kind: string, lines: string[]): string => {
    if (lines.length === 1) return lines[0];
    const prev = last.get(kind) ?? -1;
    let i = Math.floor(Math.random() * (lines.length - 1));
    if (i >= prev && prev >= 0) i++;
    last.set(kind, i);
    return lines[i];
  };
  const pit = THEMES[game.theme].labels.pit;
  const maxStars = DIFFICULTIES[game.level].stars;
  const lanternSecs = DIFFICULTIES[game.level].lanternSeconds;

  return (e, s) => {
    switch (e.type) {
      case "locked": {
        const door = cap(doorName(e.color));
        const key = keyName(e.color);
        return pick("locked", [
          `${door} cerrada: falta la ${key}.`,
          `${door} no se deja. Pregúntale a tu guía dónde está la ${key}.`,
          `${door}: ni con cariño se abre. Necesitas la ${key}.`,
        ]);
      }
      case "key": {
        const key = keyName(e.color);
        const door = doorName(e.color);
        return pick("key", [
          `¡${cap(key)}! Ya abre la ${door}.`,
          `${cap(key)} en el bolsillo. La ${door} ya no es problema.`,
          `¡Tienes la ${key}! Cuéntale a tu guía, que lo anote.`,
        ]);
      }
      case "teleported": {
        const name = portalName(game.portals[e.pair].symbol);
        return pick("portal", [
          `Cruzaste el ${name}.`,
          `¡Zas! ${cap(name)}. Dile a tu guía qué ves ahora.`,
          `${cap(name)}: apareciste del otro lado. ¿Algún punto de referencia?`,
        ]);
      }
      case "fell": {
        const back = s.checkpointIndex < 0 ? "la entrada" : "la bandera";
        if (s.pits === 3)
          return `Tercera vez en ${article(pit)}. Tal vez la guía deba hablar más despacito · +10 s`;
        if (s.pits >= 5) return pick("fell-many", [
          `${s.pits} caídas. Ya te saludan por tu nombre allá abajo · +10 s`,
          `Otra vez. Respira, describe y vuelvan a intentar · +10 s`,
        ]);
        return pick("fell", [
          `¡Caíste en ${article(pit)}! Vuelves a ${back} · +10 s`,
          `¡Plaf! ${cap(article(pit))}. De vuelta a ${back} · +10 s`,
          `Ese ${pit} no estaba en tus planes… pero en el mapa de tu guía sí · +10 s`,
        ]);
      }
      case "checkpoint":
        return pick("flag", [
          "Bandera: si caes, vuelves aquí.",
          "¡Bandera! Lo andado ya nadie te lo quita.",
          "Bandera tomada. Los pozos ya no te mandan tan lejos.",
        ]);
      case "swirl":
        return e.axes === "xy"
          ? pick("swirl-xy", [
              `¡Remolino! Todo invertido por ${e.steps} pasos.`,
              `Todo da vueltas: arriba es abajo e izquierda es derecha por ${e.steps} pasos.`,
            ])
          : pick("swirl-x", [
              `¡Remolino! Izquierda y derecha invertidas por ${e.steps} pasos.`,
              `Mareo de remolino: tu izquierda es tu derecha por ${e.steps} pasos. Guía, ¡ojo!`,
            ]);
      case "unswirl":
        return pick("unswirl", ["Controles normales otra vez.", "Se te pasó el mareo: todo normal.", "Ya puedes confiar en tu izquierda otra vez."]);
      case "star":
        if (e.count === maxStars) return pick("star-all", [`¡Las ${maxStars} estrellas! Colección completa.`, `¡${maxStars} de ${maxStars}! Brillan más que ustedes dos.`]);
        return pick("star", [`Estrella ${e.count} de ${maxStars}.`, `¡Estrella! Llevas ${e.count} de ${maxStars}.`, `${e.count} de ${maxStars}. Tu guía sabe dónde están las otras.`]);
      case "lantern":
        return pick("lantern", [
          `Farol: ves más lejos por ${lanternSecs} s.`,
          `¡Farol! ${lanternSecs} s de ver más lejos. Aprovecha para describir.`,
        ]);
      case "arrived":
        return pick("arrived", ["¡Salida! Avísale a tu guía.", "¡Llegaste! Grítale a tu guía que toque «¡Llegó!»."]);
      default:
        return null;
    }
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "un pozo", "una grieta", "un pozo de arena"… */
function article(noun: string): string {
  const feminine = /^(grieta|arena)/.test(noun) || (noun.endsWith("a") && !noun.startsWith("pozo"));
  return `${feminine ? "una" : "un"} ${noun}`;
}
