import { DIFFICULTIES, type Game, type PlayEvent, type PlayState } from "@/src/engine";

/**
 * What the explorer reads after each event: warm, teasing lines that rotate
 * so the same one never shows twice in a row. No object names, ever (v2): the
 * pair invents its own words for what they see, so lines point at the screen
 * («cuéntale cómo es») instead of naming things.
 */
/** Short names of the curses, the same on the chip and in the guide's panel. */
export const CURSE_NAME = { turn: "Giro", blind: "Ceguera", hungry: "Hambre", masked: "Máscara", mirror: "Espejo" } as const;

const CURSE_LINES: Record<keyof typeof CURSE_NAME, string[]> = {
  turn: ["¡Maldición de giro! Tus controles dan un cuarto de vuelta.", "Maldición: lo que era arriba ahora apunta a otro lado. Prueben con calma."],
  blind: ["¡Maldición de ceguera! Solo ves lo que tienes al lado.", "Maldición: la niebla se te pegó a la nariz. Tu guía ve por los dos."],
  hungry: ["¡Maldición de hambre! La vela se come el doble por paso.", "Maldición: la llama tiene antojo. Caminen poco y bien."],
  masked: ["¡Maldición de máscara! Ya no ves cuánta vida ni cuánta luz te queda.", "Maldición: tus cosas se esconden. Vas a ciegas… de números."],
  mirror: ["¡Maldición de espejo! Tu mundo está al revés, izquierda con derecha.", "Maldición: ahora vives en el espejo. Tu guía no."],
};

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
  const maxStars = DIFFICULTIES[game.level].stars;
  const hearts = (n: number) => (n === 1 ? "Te queda 1 corazón" : `Te quedan ${n} corazones`);
  let sealLine = "";

  return (e, s) => {
    switch (e.type) {
      case "locked":
        return pick("locked", [
          "Cerrada. Falta su llave.",
          "No se deja. Pregúntale a tu guía dónde está la llave que le toca.",
          "Ni con cariño se abre. Busquen la llave del mismo color y forma.",
        ]);
      case "key":
        return pick("key", [
          "¡Una llave! Cuéntale a tu guía cómo es.",
          "Llave en el bolsillo. Ojo: si caes, se queda allá abajo.",
          "¡Llave! Descríbela: tu guía sabe qué puerta abre.",
        ]);
      case "teleported":
        return pick("portal", [
          "¡Zas! Apareciste del otro lado. ¿Qué ves ahora?",
          "Cruzaste un portal. Describe cómo era y qué tienes cerca.",
          "Portal. Tu guía tiene que adivinar cuál fue: cuéntale.",
        ]);
      case "fell": {
        const keys = e.keysLost ? " Tus llaves se quedaron allá abajo." : "";
        if (s.lost) return null; // the defeat line covers it
        return pick("fell", [
          `¡Caíste! Despertaste en otro lado del laberinto.${keys} ${hearts(s.hearts)}.`,
          `¡Plaf! Y luego… otro lugar.${keys} Describe dónde estás. ${hearts(s.hearts)}.`,
          `Ese pozo no estaba en tus planes. Tu guía tiene que encontrarte otra vez.${keys}`,
        ]);
      }
      case "hurt":
        if (e.cause === "pit" || s.lost) return null;
        if (e.cause === "trial") {
          return pick("trial-hurt", [
            `Tanto error ya dolió: perdiste un corazón. ${hearts(s.hearts)}.`,
            `La estación se cobró un corazón. ${hearts(s.hearts)}. Respiren y vuelvan a intentar.`,
          ]);
        }
        return pick("dark-hurt", [
          `Demasiado tiempo a oscuras: perdiste un corazón. La vela se volvió a encender, a medias. ${hearts(s.hearts)}.`,
          `Te tropezaste en la oscuridad. ${hearts(s.hearts)}. La vela revive… por ahora.`,
        ]);
      case "dimmed":
        if (e.radius >= 2) return pick("dim2", ["La vela baja. Ya ves menos lejos.", "La llama se encoge. Pídele a tu guía la luz más cercana."]);
        return pick("dim1", ["Queda poquita luz. Busquen una vela o un farol, ya.", "La vela tiembla. Esto se va a poner oscuro."]);
      case "darkness":
        return pick("dark", ["Se apagó la vela. Unos pasos más a oscuras y te cuesta un corazón.", "Oscuridad total. Tu guía es lo único que tienes."]);
      case "candle":
        return pick("candle", ["Una vela: un poco más de luz.", "Vela encendida. Algo es algo."]);
      case "lantern":
        return pick("lantern", ["¡Un farol! La vela vuelve a brillar por completo.", "¡Luz! Aprovecha para describir todo lo que ves."]);
      case "swirl":
        return e.axes === "xy"
          ? pick("swirl-xy", ["¡Remolino! Todo invertido y más niebla.", "Todo da vueltas: arriba es abajo, izquierda es derecha, y ves menos."])
          : pick("swirl-x", ["¡Remolino! Izquierda y derecha invertidas, y más niebla.", "Mareo de remolino: tu izquierda es tu derecha. Guía, ¡ojo!"]);
      case "curse":
        return pick(`curse-${e.kind}`, CURSE_LINES[e.kind]);
      case "uncurse":
        return e.cured
          ? pick("cured", ["¡Curado! Y de propina, un poco más de luz.", "Maldición deshecha. Su guía tiene manos de curandera.", "Listo: la maldición se fue con la cola entre las patas."])
          : pick("curse-off", ["La maldición se cansó y se fue sola.", "Se te pasó el hechizo. Todo normal otra vez.", "Fin de la maldición. Ni las gracias dio."]);
      case "emergencyExit":
        return pick("emergency", [
          "¡Salida de emergencia! No fue elegante, pero salieron.",
          "Se escurrieron por la puerta de atrás. Cuenta como escapar… más o menos.",
        ]);
      case "unswirl":
        return pick("unswirl", ["Controles normales otra vez.", "Se te pasó el mareo: todo normal.", "Ya puedes confiar en tu izquierda otra vez."]);
      case "star":
        if (e.count === maxStars) return pick("star-all", [`¡Las ${maxStars} estrellas! Colección completa.`, `¡${maxStars} de ${maxStars}! Brillan más que ustedes dos.`]);
        return pick("star", [`Estrella ${e.count} de ${maxStars}.`, `¡Estrella! Llevas ${e.count} de ${maxStars}.`, `${e.count} de ${maxStars}. Tu guía sabe dónde están las otras.`]);
      case "station":
        if (e.sealed) return pick("station-done", ["Este sello ya es tuyo.", "Aquí ya ganaron. Sigan con las otras."]);
        return null; // the overlay takes over
      case "exitSealed": {
        if (e.emergency) return null; // the emergency dialog takes over
        const missing = e.missing === 1 ? "falta 1 sello" : `faltan ${e.missing} sellos`;
        return pick("exit-sealed", [
          `La salida no se abre: ${missing}.`,
          `Cerrada a cal y canto: ${missing}.`,
          `La salida ni se inmuta. Tu guía sabe dónde están las estaciones: ${missing}.`,
        ]);
      }
      case "trialFail":
        return e.paid
          ? pick("fail-paid", ["Bzzt. Eso costó un poco de vela.", "No era. La vela lo resiente.", "Fallo con factura: menos luz."])
          : pick("fail-free", ["Bzzt. Ese fue gratis, el siguiente quién sabe.", "No era, pero no costó nada. Todavía.", "Fallo de práctica: gratis."]);
      case "seal":
        if (e.count === 3) return (sealLine = pick("seal-3", ["¡Tercer sello! La salida se abrió.", "¡Los tres sellos! Ahora sí: a la salida."]));
        return (sealLine = pick("seal", [`¡Sello ${e.count} de 3! La vela se reaviva.`, `¡Sello! Van ${e.count} de 3. Más luz para el camino.`, `¡Clac! Sello ${e.count} de 3.`]));
      case "heal":
        // Comes right after its seal: one toast for both.
        return `${sealLine} ${pick("heal", ["Y te devolvió un corazón.", "Y de regalo, un corazón."])}`.trim();
      case "arrived":
        return pick("arrived", ["¡Salida! Avísale a tu guía.", "¡Escaparon! Grítale a tu guía."]);
      case "defeat":
        return pick("defeat", ["Sin corazones. Se acabó la expedición…", "Y ahí se apagó todo. Se acabó la expedición."]);
      default:
        return null;
    }
  };
}
