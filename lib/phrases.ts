/**
 * Warm, teasing copy in neutral Spanish (tú). A line is drawn from a shuffle
 * bag per kind (lib/lines.ts), so a device doesn't read the same one again
 * until it has read all of them, and it is MEMOIZED per game seed, so a
 * screen that re-renders keeps its line. The two devices of a pair may read
 * different lines for the same ending: nothing depends on it matching.
 */
import { lines } from "./lines";

const memo = new Map<string, string>();
const once = (id: string, make: () => string): string => {
  const hit = memo.get(id);
  if (hit !== undefined) return hit;
  if (memo.size > 400) memo.clear();
  const v = make();
  memo.set(id, v);
  return v;
};
/** One line from a bag of `list` (kind = the bag), kept for this seed. */
const pick = (list: readonly string[], kind: string, seed: string): string => once(`p|${kind}|${seed}`, () => lines.pick(kind, list));
/** Opener + tail from two bags, kept for this seed. */
const combo = (kind: string, openers: readonly string[], tails: readonly string[], seed: string): string => once(`c|${kind}|${seed}`, () => lines.combo(kind, openers, tails));

const TIPS = {
  both: [
    "Si se pierden, busquen algo que los dos reconozcan y empiecen de nuevo desde ahí.",
    "Hablen despacito. La vela no se gasta hablando, solo caminando.",
    "Nada tiene nombre: pónganselo ustedes. «La cosa con tres picos» vale.",
    "Antes de cada cruce, pausa: «¿qué ves?» ahorra más luz de la que cuesta.",
    "Si algo ronda, el latido avisa. Hablen más despacio y escuchen.",
    "Esperar también es una jugada: a veces dos pasos quietos valen más que diez corriendo.",
    "Las pruebas son de a dos: nadie las resuelve solo.",
  ],
  guide: [
    "Guía: describe con lo que el explorador puede ver, no con coordenadas.",
    "Guía: los pozos solo los ves tú. Avisa antes, no después del «¡plaf!».",
    "Guía: un alfiler de «creo que estás aquí» en el mapa salva relaciones.",
    "Guía: tu izquierda es su izquierda. Arriba es arriba en las dos pantallas.",
    "Guía: cuando haya un remolino, recuerda que sus controles van al revés.",
    "Guía: cuando su vela baje, llévalo a la luz más cercana antes que a la salida.",
    "Guía: la ronda de la Sombra está en tu mapa, pero no dónde está ahora. Pregunta qué oye.",
    "Guía: cuenta los puntos del trazo de la Sombra: cada uno son 4 casillas.",
  ],
  explorer: [
    "Explorador: di siempre qué ves al llegar a un cruce. Tu guía no sabe dónde estás.",
    "Explorador: los pozos no se ven. Confía… pero pregunta.",
    "Explorador: describe las formas que te rodean; tu guía las ve igual en su mapa.",
    "Explorador: antes de deslizarte por el hielo, pregunta dónde termina.",
    "Explorador: si la llama se achica, avísale a tu guía. Sin luz no ves ni tus pies.",
    "Explorador: si oyes un latido, avisa. Esperar un instante puede salvarte un corazón.",
    "Explorador: un farol encandila a la Sombra. Úsalo cuando la tengas cerca.",
  ],
} as const;

/** One tip for this game and role; both lists mix in the shared ones. */
export function startTip(seed: string, role?: "guide" | "explorer"): string {
  return pick(role ? [...TIPS[role], ...TIPS.both] : [...TIPS.guide, ...TIPS.explorer, ...TIPS.both], `tip:${role ?? ""}`, seed);
}

/**
 * Ending lines are an OPENER that reacts to what happened plus a TAIL with the
 * wink, picked by two independent hashes of the seed (both devices agree).
 * Every situation has openers × tails distinct sentences; a type of ending
 * (escaparon / salida de emergencia / atrapados / fin de racha) has ≥ 12 even
 * in its narrowest situation.
 */
const WIN_TAILS = [
  "Choquen esos cinco, aunque sea por voz.",
  "Hoy el laberinto pierde.",
  "Apunten esta partida en la libreta de las buenas.",
  "Y todo sin ver la pantalla del otro. Eso es confianza.",
  "Merecen un snack. En serio.",
  "Alguien en este equipo escucha muy bien.",
];
const LOSS_TAILS = [
  "La revancha está a un código de distancia.",
  "Nadie culpa a nadie. Bueno, un poquito.",
  "Lo bueno: ya se conocen las voces en la oscuridad.",
  "El laberinto manda saludos y pide la revancha.",
  "Se aprende más perdiendo. O eso dicen.",
  "Respiren, tomen agua y a probar otro mapa.",
];

export const ENDING_OPENERS = {
  "won-perfect": [
    "Todas las estrellas y ni un rasguño.",
    "Perfecto de principio a fin.",
    "Cero corazones perdidos y todas las estrellas.",
    "Una expedición de manual: intacta y brillante.",
  ],
  "won-close": [
    "Con un corazón y medio pie en el pozo.",
    "Salieron por un pelo: la vela temblaba y ustedes también.",
    "Último corazón, primera salida.",
    "Drama puro: escaparon con el corazón en la boca.",
  ],
  "won-intact": [
    "Ni un corazón perdido.",
    "Intactos: ese explorador sí escucha.",
    "La guía tenía el mapa bien leído y se nota.",
    "Salieron sin perder ni un corazón.",
  ],
  "won-stars": [
    "Ni una estrella se les escapó.",
    "Todas las estrellas: coleccionistas de primera.",
    "La guía tenía el mapa del tesoro.",
    "Las estrellas están completas.",
  ],
  "won-nostars": [
    "Cero estrellas: fueron directo a la salida.",
    "Las estrellas siguen ahí, esperando la revancha.",
    "Sin estrellas, pero con prisa elegante.",
    "Salida sin souvenirs.",
  ],
  "won-mid": [
    "Escaparon, que es lo importante.",
    "Buen trabajo en equipo.",
    "Hubo dudas, hubo caídas, pero salieron juntos.",
    "No fue perfecto, fue suyo.",
  ],
  "lost-pits": [
    "Demasiados pozos: el laberinto les manda saludos desde el fondo.",
    "Se cayeron tanto que ya los conocen allá abajo.",
    "Turismo subterráneo intensivo.",
    "Tres pozos o más: récord de profundidad.",
  ],
  "lost-stars": [
    "Todas las estrellas… y ni una salida.",
    "Coleccionaron todo menos la salida.",
    "Las estrellas completas no abren la puerta.",
    "Prioridades, amigos: las estrellas no escapan por ustedes.",
  ],
  "lost-dark": [
    "Se apagó la vela y con ella la expedición.",
    "La oscuridad les ganó esta vez.",
    "Sin corazones, pero con historias.",
    "Fin de la expedición.",
  ],
} as const;

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
  const k = () => o.seed;
  if (!o.escaped) {
    const kind = o.pits >= 3 ? "lost-pits" : o.stars === o.maxStars ? "lost-stars" : "lost-dark";
    return combo(kind, ENDING_OPENERS[kind], LOSS_TAILS, k());
  }
  const kind =
    o.hearts === o.maxHearts && o.stars === o.maxStars
      ? "won-perfect"
      : o.hearts === 1
        ? "won-close"
        : o.hearts === o.maxHearts
          ? "won-intact"
          : o.stars === o.maxStars
            ? "won-stars"
            : o.stars === 0
              ? "won-nostars"
              : "won-mid";
  return combo(kind, ENDING_OPENERS[kind], WIN_TAILS, k());
}

export const EMERGENCY_OPENERS = {
  two: [
    "Dos sellos y una puerta trasera.",
    "Salieron por la de servicio, pero con estilo.",
    "Dos de tres: el laberinto los deja salir.",
    "Casi heroico: faltó un sello.",
  ],
  one: [
    "Un sello y mucha prisa.",
    "Salieron por donde sale la basura.",
    "Con un sello y el corazón en la boca.",
    "Escapar es escapar, aunque sea a medias.",
  ],
} as const;
const EMERGENCY_TAILS = [
  "Faltó poco, mucho o todo, según a quién le pregunten.",
  "Nadie dijo que fuera bonito.",
  "Eso también cuenta como salir.",
  "La próxima vez, con los tres sellos.",
  "Afuera es afuera.",
  "Lo importante es que están contando el cuento.",
];

/** The emergency exit: they got out, sort of. */
export function emergencyPhrase(seed: string, seals: number): string {
  const kind = seals >= 2 ? "two" : "one";
  return combo(`emergency-${kind}`, EMERGENCY_OPENERS[kind], EMERGENCY_TAILS, seed);
}

const RELAY_OPENERS = {
  won: ["Cambio de mando.", "Nuevo mapa, mismas voces.", "Intercambien sillas, no pantallas.", "Lo que antes veías desde arriba, ahora lo pisas."],
  escaped: ["Se libraron por un pelo.", "Huida registrada.", "Un corazón y mucha fe.", "Salieron raspando."],
} as const;
const RELAY_TAILS = {
  won: ["Ahora le toca al otro sudar.", "Y respiren.", "El laberinto ya los está esperando.", "La vela es nueva; las excusas, las mismas.", "Suerte, la van a necesitar.", "A ver cuánto dura la racha."],
  escaped: ["El siguiente mapa ya se enteró y viene con ganas.", "El laberinto toma nota y sube la dificultad.", "A ver cuánto dura.", "Cuiden ese corazón como oro.", "Lo que viene es más duro.", "Cuenta como victoria, con asterisco."],
} as const;

/** A line for the screen between two maps of a Racha. */
export function relayPhrase(seed: string, index: number, result: "won" | "escaped"): string {
  return combo(`relay-${result}`, RELAY_OPENERS[result], RELAY_TAILS[result], `${index}:${seed}`);
}

const STREAK_OPENERS = {
  zero: ["Racha de cero.", "Ni un mapa.", "Se acabó antes de empezar.", "El laberinto ni calentó."],
  short: ["Pocos mapas y se acabó el aire.", "Calentamiento completo.", "Un comienzo corto.", "Se quedaron en la entrada, casi."],
  mid: ["Ya se entienden con media palabra.", "Respetable.", "Una racha digna.", "El laberinto empieza a preocuparse."],
  long: ["Esto ya es una relación seria con el laberinto.", "Que alguien les dé un trofeo.", "Racha de las que se cuentan.", "Se saben el laberinto de tanto hablarse."],
} as const;
const STREAK_TAILS = [
  "La próxima, más charla y menos prisa.",
  "Técnicamente, también es una racha.",
  "El laberinto les manda un abrazo.",
  "Apunten el récord y vayan por el siguiente.",
  "Hablen, respiren, repitan.",
  "El récord de la casa los espera.",
];

const MAP_WON_OPEN = ["superado", "resuelto", "fuera", "de su lista", "tachado"];
const MAP_WON_TAIL = ["Que no se les suba.", "Que no se les suba a la cabeza.", "El siguiente será más difícil.", "Un aplauso para la voz que guió.", "Sigan así.", "El laberinto no lo olvidará."];
const MAP_LOST_OPEN = ["se los tragó", "ganó esta vez", "los despidió con cariño", "los dejó sin corazones", "fue el último"];
const MAP_LOST_TAIL = ["Fue una buena racha.", "Se puede volver a empezar.", "Hay que contarlo: cuenten cuántos fueron.", "La próxima, más pasos pensados.", "Con humor se pierde mejor.", "A veces el laberinto gana."];

/** The line under the result of one map of a Racha (a win; a loss; escapes use emergencyPhrase). */
export function mapPhrase(seed: string, index: number, won: boolean): string {
  const n = index + 1;
  return won
    ? `Mapa ${n} ${pick(MAP_WON_OPEN, "map-won-open", `${seed}:${index}`)}. ${pick(MAP_WON_TAIL, "map-won-tail", `${seed}:${index}`)}`
    : `El mapa ${n} ${pick(MAP_LOST_OPEN, "map-lost-open", `${seed}:${index}`)}. ${pick(MAP_LOST_TAIL, "map-lost-tail", `${seed}:${index}`)}`;
}

/** The closing line of a whole Racha. */
export function streakEndPhrase(seed: string, maps: number): string {
  const kind = maps === 0 ? "zero" : maps <= 2 ? "short" : maps <= 5 ? "mid" : "long";
  const count = maps > 0 ? `${maps} ${maps === 1 ? "mapa" : "mapas"}. ` : "";
  return `${count}${combo(`streak-${kind}`, STREAK_OPENERS[kind], STREAK_TAILS, seed)}`;
}

/** Spoken-alphabet hints for dictating codes. */
export const SPOKEN: Record<string, string> = {
  A: "A de árbol", B: "B de barco", C: "C de casa", D: "D de dado", E: "E de elefante", F: "F de foca",
  G: "G de gato", H: "H de helado", J: "J de jirafa", K: "K de kilo", M: "M de mamá", P: "P de papá",
  Q: "Q de queso", R: "R de ratón", S: "S de sol", T: "T de taza", U: "U de uva", W: "W de wafle",
  X: "X de xilófono", Y: "Y de yoyo", Z: "Z de zapato",
};
