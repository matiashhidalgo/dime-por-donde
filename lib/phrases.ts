/**
 * Warm, teasing copy in neutral Spanish (tú). Picks are deterministic per
 * seed so both devices show the same line for the same game.
 */
import { hashString } from "@/src/engine";

const pick = <T,>(list: readonly T[], seed: string): T => list[hashString(seed) % list.length];

const TIPS = {
  both: [
    "Si se pierden, busquen un punto de referencia y empiecen de nuevo desde ahí.",
    "Hablen despacito. Nadie gana nada corriendo… salvo estrellas.",
    "Las puertas tienen color y forma: «la puerta azul, la del cuadrado».",
    "Antes de cada cruce, pausa: «¿qué ves?» ahorra más tiempo del que cuesta.",
  ],
  guide: [
    "Guía: describe con puntos de referencia, no con coordenadas. «Junto al hongo gigante» funciona mejor que «F7».",
    "Guía: los pozos solo los ves tú. Avisa antes, no después del «¡plaf!».",
    "Guía: un alfiler de «creo que estás aquí» en el mapa salva relaciones.",
    "Guía: tu izquierda es su izquierda. Arriba es arriba en las dos pantallas.",
    "Guía: cuando haya un remolino, recuerda que sus controles van al revés.",
  ],
  explorer: [
    "Explorador: di siempre qué ves al llegar a un cruce. Tu guía no sabe dónde estás.",
    "Explorador: los pozos no se ven. Confía… pero pregunta.",
    "Explorador: los nombres de abajo («Cerca: …») son exactamente los que ve tu guía en su mapa.",
    "Explorador: antes de deslizarte por el hielo, pregunta dónde termina.",
  ],
} as const;

/** One tip for this game and role; both lists mix in the shared ones. */
export function startTip(seed: string, role?: "guide" | "explorer"): string {
  return pick(role ? [...TIPS[role], ...TIPS.both] : [...TIPS.guide, ...TIPS.explorer, ...TIPS.both], `tip:${role ?? ""}:${seed}`);
}

export function resultPhrase(o: {
  seed: string;
  pits: number;
  stars: number;
  maxStars: number;
  rating: number;
  timed: boolean;
  /** recorded time / par, when timed. */
  pace?: number | null;
}): string {
  const p = (list: string[], key: string) => pick(list, `${key}:${o.seed}`);
  if (o.pits >= 4) {
    return p(
      [
        `Cayeron ${o.pits} veces en pozos: la guía debería revisar su mapa.`,
        `${o.pits} pozos. El explorador ya conoce el fondo de cada uno por su nombre.`,
        `${o.pits} caídas. Alguien dijo «a la izquierda» y quiso decir «a la derecha».`,
        `${o.pits} pozos visitados. Turismo subterráneo de primera.`,
      ],
      "pits",
    );
  }
  if (o.stars === o.maxStars && o.pits === 0) {
    return p(
      [
        "Todas las estrellas y ni un pozo. Esto ya es telepatía.",
        "Perfecto. Deberían dar clases de comunicación en pareja.",
        "Ni un tropiezo y todas las estrellas. ¿Seguros que no se están viendo las pantallas?",
      ],
      "perfect",
    );
  }
  if (o.pace != null && o.pace < 0.6) {
    return p(["Eso fue rapidísimo. ¿Ya habían jugado este laberinto?", "Velocidad luz. La guía dicta y el explorador vuela."], "fast");
  }
  if (o.pace != null && o.pace > 1.5) {
    return p(
      ["Sin prisa, pero sin pausa. Bueno, con varias pausas.", "Tardaron, pero llegaron juntos. Eso es lo que cuenta.", "Paseo largo por el laberinto. Al menos la vista era bonita."],
      "slow",
    );
  }
  if (o.stars === o.maxStars) return p(["Ni una estrella se les escapó. Coleccionistas de primera.", "Todas las estrellas. La guía tenía el mapa del tesoro."], "allstars");
  if (o.stars === 0) {
    return p(
      ["Cero estrellas. Fueron directo al grano, eso también es amor.", "Las estrellas siguen ahí, esperándolos para la revancha.", "Directo a la salida, sin desvíos. Eficiencia romántica."],
      "nostars",
    );
  }
  if (o.pits === 0) return p(["Ni un solo pozo. La guía tenía el mapa bien leído.", "Cero caídas. Ese explorador sí escucha."], "nopits");
  if (o.rating === 3) return p(["Tres estrellas. Equipo de lujo.", "Calificación perfecta. Se nota la química."], "three");
  return p(
    ["Llegaron, que es lo importante. Bueno, y las estrellas.", "Buen trabajo en equipo. Con un poco más de práctica, nadie los para.", "Hubo dudas, hubo caídas, pero llegaron de la mano."],
    "mid",
  );
}

/** Closing line after the three duo rounds. */
export function duoPhrase(o: { seed: string; ratingSum: number; pits: number }): string {
  const p = (list: string[], key: string) => pick(list, `duo-${key}:${o.seed}`);
  if (o.ratingSum >= 9) return p(["9 de 9. Ya pueden poner un consultorio de comunicación en pareja.", "Dúo perfecto: tres laberintos, cero excusas."], "top");
  if (o.ratingSum >= 7) return p(["Gran dúo. Se turnaron los roles y los dos brillaron.", "Tres laberintos y siguen hablándose. Excelente señal."], "good");
  if (o.pits >= 10) return p([`${o.pits} pozos entre los dos. La próxima, más «¿qué ves?» y menos «¡corre!».`], "pits");
  return p(["Tres laberintos, dos roles y una sola pareja. La revancha los espera.", "Lo importante es que nadie se quedó atrapado. Bueno, casi nadie."], "ok");
}

/** Spoken-alphabet hints for dictating codes. */
export const SPOKEN: Record<string, string> = {
  A: "A de árbol", B: "B de barco", C: "C de casa", D: "D de dado", E: "E de elefante", F: "F de foca",
  G: "G de gato", H: "H de helado", J: "J de jirafa", K: "K de kilo", M: "M de mamá", P: "P de papá",
  Q: "Q de queso", R: "R de ratón", S: "S de sol", T: "T de taza", U: "U de uva", W: "W de wafle",
  X: "X de xilófono", Y: "Y de yoyo", Z: "Z de zapato",
};
