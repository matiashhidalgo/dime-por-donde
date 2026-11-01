/**
 * Warm, teasing copy in neutral Spanish (tú). Picks are deterministic per
 * seed so both devices show the same line for the same game.
 */
import { hashString } from "@/src/engine";

const pick = <T,>(list: readonly T[], seed: string): T => list[hashString(seed) % list.length];

const TIPS = {
  both: [
    "Si se pierden, busquen algo que los dos reconozcan y empiecen de nuevo desde ahí.",
    "Hablen despacito. La vela no se gasta hablando, solo caminando.",
    "Nada tiene nombre: pónganselo ustedes. «La cosa con tres picos» vale.",
    "Antes de cada cruce, pausa: «¿qué ves?» ahorra más luz de la que cuesta.",
  ],
  guide: [
    "Guía: describe con lo que el explorador puede ver, no con coordenadas.",
    "Guía: los pozos solo los ves tú. Avisa antes, no después del «¡plaf!».",
    "Guía: un alfiler de «creo que estás aquí» en el mapa salva relaciones.",
    "Guía: tu izquierda es su izquierda. Arriba es arriba en las dos pantallas.",
    "Guía: cuando haya un remolino, recuerda que sus controles van al revés.",
    "Guía: cuando su vela baje, llévalo a la luz más cercana antes que a la salida.",
  ],
  explorer: [
    "Explorador: di siempre qué ves al llegar a un cruce. Tu guía no sabe dónde estás.",
    "Explorador: los pozos no se ven. Confía… pero pregunta.",
    "Explorador: describe las formas que te rodean; tu guía las ve igual en su mapa.",
    "Explorador: antes de deslizarte por el hielo, pregunta dónde termina.",
    "Explorador: si la llama se achica, avísale a tu guía. Sin luz no ves ni tus pies.",
  ],
} as const;

/** One tip for this game and role; both lists mix in the shared ones. */
export function startTip(seed: string, role?: "guide" | "explorer"): string {
  return pick(role ? [...TIPS[role], ...TIPS.both] : [...TIPS.guide, ...TIPS.explorer, ...TIPS.both], `tip:${role ?? ""}:${seed}`);
}

/** The closing line of an expedition, won or lost. */
export function resultPhrase(o: {
  seed: string;
  escaped: boolean;
  hearts: number;
  maxHearts: number;
  pits: number;
  stars: number;
  maxStars: number;
}): string {
  const p = (list: string[], key: string) => pick(list, `${key}:${o.seed}`);
  if (!o.escaped) {
    if (o.pits >= 3) {
      return p(
        [
          `${o.pits} pozos. El laberinto les manda saludos desde el fondo.`,
          "Se cayeron tanto que ya los conocen allá abajo. La próxima, más «¡alto!» y menos «¡sigue!».",
          "Turismo subterráneo intensivo. La revancha los espera arriba.",
        ],
        "lost-pits",
      );
    }
    if (o.stars === o.maxStars) {
      return p(["Todas las estrellas… y ni una salida. Prioridades, amigos.", "Coleccionaron todo menos la salida. Casi."], "lost-stars");
    }
    return p(
      [
        "Se apagó la vela y con ella la expedición. Nadie culpa a nadie. Bueno, un poquito.",
        "El laberinto ganó esta vez. Ya saben dónde no pisar.",
        "Sin corazones, pero con historias. La revancha está a un código de distancia.",
        "Fin de la expedición. Ahora ya se conocen las voces del otro en la oscuridad.",
      ],
      "lost",
    );
  }
  if (o.hearts === o.maxHearts && o.stars === o.maxStars) {
    return p(
      [
        "Todas las estrellas y ni un rasguño. Esto ya es telepatía.",
        "Perfecto. Deberían dar clases de comunicación en pareja.",
        "Ni un tropiezo y todas las estrellas. ¿Seguros que no se están viendo las pantallas?",
      ],
      "perfect",
    );
  }
  if (o.hearts === 1) {
    return p(
      ["Con un corazón y medio pie en el pozo. Salieron de milagro.", "Por un pelo. La vela temblaba y ustedes también.", "Último corazón, primera salida. Eso es drama."],
      "close",
    );
  }
  if (o.hearts === o.maxHearts) return p(["Ni un corazón perdido. La guía tenía el mapa bien leído.", "Intactos. Ese explorador sí escucha."], "intact");
  if (o.stars === o.maxStars) return p(["Ni una estrella se les escapó. Coleccionistas de primera.", "Todas las estrellas. La guía tenía el mapa del tesoro."], "allstars");
  if (o.stars === 0) {
    return p(
      ["Cero estrellas. Fueron directo a la salida, eso también es amor.", "Las estrellas siguen ahí, esperándolos para la revancha."],
      "nostars",
    );
  }
  return p(
    ["Escaparon, que es lo importante. Bueno, y las estrellas.", "Buen trabajo en equipo. Con un poco más de práctica, nadie los para.", "Hubo dudas, hubo caídas, pero salieron juntos."],
    "mid",
  );
}

/** The emergency exit: they got out, sort of. */
export function emergencyPhrase(seed: string, seals: number): string {
  return pick(
    seals >= 2
      ? [
          "Dos sellos y una puerta trasera. Casi heroico.",
          "Salieron por la de servicio, pero con estilo. Faltó uno.",
          "Dos de tres: el laberinto les deja salir… mirando al suelo.",
        ]
      : [
          "Un sello y mucha prisa. Escapar es escapar.",
          "Salieron por donde sale la basura. Pero salieron.",
          "Con un sello y el corazón en la boca. Nadie dijo que fuera bonito.",
        ],
    `emergency:${seals}:${seed}`,
  );
}

/** A line for the screen between two maps of a Racha. */
export function relayPhrase(seed: string, index: number, result: "won" | "escaped"): string {
  const list =
    result === "escaped"
      ? [
          "Se libraron por un pelo. El siguiente mapa ya se enteró y viene con ganas.",
          "Huida registrada. El laberinto toma nota y sube la dificultad.",
          "Un corazón y mucha fe. A ver cuánto dura.",
        ]
      : [
          "Cambio de mando. Ahora le toca al otro sudar.",
          "Intercambien sillas, no pantallas. Y respiren.",
          "Lo que antes veías desde arriba, ahora lo pisas. Suerte.",
          "Nuevo mapa, mismas voces. El laberinto ya los está esperando.",
          "La vela es nueva; las excusas, las mismas de siempre.",
        ];
  return pick(list, `relay:${index}:${seed}`);
}

/** The closing line of a whole Racha. */
export function streakEndPhrase(seed: string, maps: number): string {
  if (maps === 0) return pick(["Racha de cero. Técnicamente, también es una racha.", "Ni un mapa. El laberinto les manda un abrazo de consolación."], `streak0:${seed}`);
  if (maps <= 2) return pick([`${maps === 1 ? "Un mapa" : "Dos mapas"} y se acabó el aire. La próxima, más charla y menos prisa.`, "Calentamiento completo. La racha de verdad empieza la próxima vez."], `streak2:${seed}`);
  if (maps <= 5) return pick([`${maps} mapas seguidos. Ya se entienden con media palabra.`, `${maps} mapas. Respetable. El laberinto empieza a preocuparse.`], `streak5:${seed}`);
  return pick([`${maps} mapas. Esto ya es una relación seria con el laberinto.`, `${maps} mapas seguidos. Que alguien les dé un trofeo, o por lo menos agua.`], `streak9:${seed}`);
}

/** Spoken-alphabet hints for dictating codes. */
export const SPOKEN: Record<string, string> = {
  A: "A de árbol", B: "B de barco", C: "C de casa", D: "D de dado", E: "E de elefante", F: "F de foca",
  G: "G de gato", H: "H de helado", J: "J de jirafa", K: "K de kilo", M: "M de mamá", P: "P de papá",
  Q: "Q de queso", R: "R de ratón", S: "S de sol", T: "T de taza", U: "U de uva", W: "W de wafle",
  X: "X de xilófono", Y: "Y de yoyo", Z: "Z de zapato",
};
