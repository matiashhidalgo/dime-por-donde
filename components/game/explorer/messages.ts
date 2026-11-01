import { DIFFICULTIES, type Game, type PlayEvent, type PlayState } from "@/src/engine";
import { lines as shared } from "@/lib/lines";

/**
 * What the explorer reads after each event: warm, teasing lines that rotate
 * so the same one never shows twice in a row. No object names, ever (v2): the
 * pair invents its own words for what they see, so lines point at the screen
 * («cuéntale cómo es») instead of naming things.
 */
/** Short names of the curses, the same on the chip and in the guide's panel. */
export const CURSE_NAME = { turn: "Giro", blind: "Ceguera", hungry: "Hambre", masked: "Máscara", mirror: "Espejo" } as const;

/**
 * Curse lines are an opener that says what the curse DOES (so the pair knows
 * how to cope) and a tail with a wink: 2 × 4 = 8 distinct lines per kind.
 */
const CURSE_OPEN: Record<keyof typeof CURSE_NAME, string[]> = {
  turn: ["¡Maldición de giro! Tus controles dan un cuarto de vuelta.", "Maldición: lo que era arriba ahora apunta a otro lado."],
  blind: ["¡Maldición de ceguera! Solo ves lo que tienes al lado.", "Maldición: la niebla se te pegó a la nariz."],
  hungry: ["¡Maldición de hambre! La vela se come el doble por paso.", "Maldición: la llama tiene antojo y se come dos por paso."],
  masked: ["¡Maldición de máscara! Ya no ves tus corazones, ni tu luz, ni tus sellos.", "Maldición: tus cosas se esconden. Vas a ciegas… de números."],
  mirror: ["¡Maldición de espejo! Tu mundo está al revés, izquierda con derecha.", "Maldición: ahora vives en el espejo."],
};
const CURSE_TAIL = ["Tu guía te puede curar.", "Se pasa sola, pero cuesta pasos.", "Respira y camina con cuidado.", "Pídele ayuda a tu guía: tiene la cura."];

const LOCKED = [
  "Cerrada. Falta su llave.",
  "No se deja. Pregúntale a tu guía dónde está la llave que le toca.",
  "Ni con cariño se abre. Busquen la llave del mismo color y forma.",
  "Puerta con carácter: sin llave, no pasa nadie.",
  "Empujar más fuerte no sirve. Falta su llave.",
  "Esta puerta tiene dueño: una llave igual a su dibujo.",
  "Cerrada con candado y con orgullo. Llave, por favor.",
  "Tocaste y no abrió. Su llave anda por ahí.",
];
const KEY = [
  "¡Una llave! Cuéntale a tu guía cómo es.",
  "Llave en el bolsillo. Ojo: si caes, se queda allá abajo.",
  "¡Llave! Descríbela: tu guía sabe qué puerta abre.",
  "Cling. Una llave más pesada que tu conciencia. ¿Cómo es?",
  "Ya tienes una llave. Ahora, ¿cuál puerta?",
  "¡Llave conseguida! No te caigas con ella.",
  "Tintineo de llave. Díganle a su guía qué viste.",
  "Un tesoro pequeño y útil: una llave. Cuídala de los pozos.",
];
const PORTAL = [
  "¡Zas! Apareciste del otro lado. ¿Qué ves ahora?",
  "Cruzaste un portal. Describe cómo era y qué tienes cerca.",
  "Portal. Tu guía tiene que adivinar cuál fue: cuéntale.",
  "Pum, otro sitio. Mira alrededor y cuéntale.",
  "Atajo mágico: ahora estás en otra parte. ¿Dónde?",
  "Pasaste por un portal sin pedir permiso. ¿Cómo era?",
  "¡Teletransporte! Tu guía te va a querer ubicar.",
  "Un pestañeo y ya estás allá. Describe el lugar.",
];
const FELL_OPEN = [
  "¡Caíste!",
  "¡Plaf!",
  "Ese pozo no estaba en tus planes.",
  "¡Aaaay! Pozo.",
  "Ups. El suelo ya no estaba.",
  "Resbalón sin retorno.",
  "El laberinto te tragó.",
  "Bajada exprés.",
];
const FELL_TAIL = [
  "Despertaste en otro lado del laberinto.",
  "Describe dónde estás: tu guía tiene que encontrarte.",
  "Ahora hay que volver a ubicarte.",
  "Aparecerás lejos de aquí.",
  "Tu guía tiene que encontrarte otra vez.",
  "Mira bien y cuéntale qué ves.",
];
const TRIAL_HURT = [
  "Tanto error ya dolió: perdiste un corazón.",
  "La estación se cobró un corazón.",
  "Los fallos se acumulan y el corazón paga.",
  "Se acabó la paciencia de la estación: un corazón menos.",
  "Demasiados bzzt. Un corazón menos.",
  "Equivocarse tiene precio: otro corazón.",
  "La prueba cobró su propina: un corazón.",
  "Un corazón se fue con el último error.",
];
const DARK_HURT = [
  "Demasiado tiempo a oscuras: perdiste un corazón. La vela se volvió a encender, a medias.",
  "Te tropezaste en la oscuridad. La vela revive… por ahora.",
  "A tientas se paga caro: un corazón. La vela vuelve, flaquita.",
  "Sin luz no hay paciencia que aguante: un corazón menos.",
  "La oscuridad cobró. La vela se reencendió a media luz.",
  "Tanto tantear y te llevaste un golpe. Corazón menos, vela a medias.",
  "El laberinto aprovecha la oscuridad. Perdiste un corazón.",
  "Se te acabó el margen a oscuras. Vela de vuelta, corazón de menos.",
];
const DIM2 = [
  "La vela baja. Ya ves menos lejos.",
  "La llama se encoge. Pídele a tu guía la luz más cercana.",
  "Menos luz: el mundo se achica un poquito.",
  "La vela flaquea. Piensen en un farol o una vela del camino.",
  "Se ve menos que antes. Ojo con la luz.",
  "La llama se cansa. ¿Hay algo de luz cerca?",
  "Visión recortada. La vela necesita refuerzos.",
  "El resplandor retrocede un paso.",
];
const DIM1 = [
  "Queda poquita luz. Busquen una vela o un farol, ya.",
  "La vela tiembla. Esto se va a poner oscuro.",
  "Casi sin llama: solo ves a un paso.",
  "Luz en las últimas. ¡Consigan fuego!",
  "Tu mundo mide ahora una casilla. Urge luz.",
  "La vela hace lo que puede, que es poco.",
  "Penumbra total a la vista. Rápido a por luz.",
  "Un hilito de llama. No lo desperdicien.",
];
const DARKNESS = [
  "Se apagó la vela. Unos pasos más a oscuras y te cuesta un corazón.",
  "Oscuridad total. Tu guía es lo único que tienes.",
  "Plof. Sin luz. Tienes unos pasos antes de que duela.",
  "Negro absoluto. Hablen mucho y caminen poco.",
  "La llama se rindió. Busquen luz antes de que cobre.",
  "Apagón. Solo ves tu propia casilla.",
  "A oscuras: que la voz de tu guía sea tu linterna.",
  "Sin vela. El reloj de los pasos corre.",
];
const CANDLE = [
  "Una vela: un poco de luz.",
  "Vela encendida. Algo es algo.",
  "Fueguito nuevo: la llama sube un poco.",
  "Una vela del camino. Gracias, anónimo.",
  "Ahora ves un poco más lejos.",
  "Se encendió una vela: media llama de regalo.",
  "Luz extra, de las pequeñas pero agradecidas.",
  "Calorcito: la vela se recarga a medias.",
];
const LANTERN = [
  "¡Un farol! La vela vuelve a brillar por completo.",
  "¡Luz! Aprovecha para describir todo lo que ves.",
  "Farol a tope: llama completa otra vez.",
  "¡Qué lujo, un farol! Ves todo lo que se puede ver.",
  "Luz completa. Aprovechen para avanzar sin miedo.",
  "El farol les devuelve el mundo entero.",
  "¡Brilla! Esta luz se merece una pausa para respirar.",
  "Farol encendido: la vela se llenó hasta arriba.",
];
const SWIRL_XY = [
  "¡Remolino! Todo invertido y más niebla.",
  "Todo da vueltas: arriba es abajo, izquierda es derecha, y ves menos.",
  "Remolino doble: nada está donde lo dejaste.",
  "Mareo total: los cuatro controles al revés.",
  "El mundo se puso de cabeza, ¡y con niebla!",
  "Arriba es abajo y abajo es arriba. Buena suerte.",
  "Controles patas arriba. Pasos cortos y cabeza fría.",
  "Remolino. Piensa lo contrario de lo que apuntas.",
];
const SWIRL_X = [
  "¡Remolino! Izquierda y derecha invertidas, y más niebla.",
  "Mareo de remolino: tu izquierda es tu derecha. Guía, ¡ojo!",
  "Izquierda y derecha cambiaron de lugar.",
  "Remolino: lo que era derecha ahora es izquierda.",
  "Los lados se intercambiaron. Arriba y abajo siguen igual.",
  "Un giro y los lados se mezclaron. Con calma.",
  "Remolino en marcha: los lados van al revés.",
  "Te cambiaron la izquierda por la derecha. Y viceversa.",
];
const UNSWIRL = [
  "Controles normales otra vez.",
  "Se te pasó el mareo: todo normal.",
  "Ya puedes confiar en tu izquierda otra vez.",
  "Se acabó el remolino. Todo en su sitio.",
  "El mundo volvió a su lugar. Respira.",
  "Fin del mareo: controles de siempre.",
  "Los lados volvieron a la normalidad.",
  "Por fin: arriba es arriba otra vez.",
];
const CURED = [
  "¡Curado! Y de propina, un poco de luz.",
  "Maldición deshecha. Su guía tiene manos de curandera.",
  "Listo: la maldición se fue con la cola entre las patas.",
  "¡Cura exitosa! La vela lo agradece.",
  "Hechizo roto. Guía, te luciste.",
  "Se acabó la maldición y sobró un poquito de luz.",
  "Curación impecable. Siguen en carrera.",
  "Adiós, maldición. No te extrañaremos.",
];
const CURSE_OFF = [
  "La maldición se cansó y se fue sola.",
  "Se te pasó el hechizo. Todo normal otra vez.",
  "Fin de la maldición. Ni las gracias dio.",
  "El hechizo caducó. Tan bien que iba…",
  "La maldición se agotó sola. Qué alivio.",
  "Todo vuelve a la normalidad. Hasta la próxima.",
  "Se esfumó el embrujo. Respiren.",
  "El mal rato pasó solo.",
];
const EMERGENCY = [
  "¡Salida de emergencia! No fue elegante, pero salieron.",
  "Se escurrieron por la puerta de atrás. Cuenta como escapar… más o menos.",
  "Escape por la rendija. Salieron con lo puesto.",
  "A veces lo sabio es salir corriendo. Salieron.",
  "Puerta de servicio abierta: afuera, aunque sea a medias.",
  "Fuga de emergencia: nadie dijo que fuera bonito.",
  "Salieron antes de que todo se apagara.",
  "No era el plan, pero funcionó. Fuera.",
];
const STAR_ALL = (m: number) => [
  `¡Las ${m} estrellas! Colección completa.`,
  `¡${m} de ${m}! Brillan más que ustedes dos.`,
  `Estrellas completas (${m}). Qué manera de coleccionar.`,
  `¡Todas! ${m} de ${m}. El cielo les queda chico.`,
  `Cosecha total de estrellas: ${m}.`,
  `${m} de ${m}: ni una se les escapó.`,
  `Colección redonda: ${m} estrellas.`,
  `¡Bravo! Las ${m} están en el bolsillo.`,
];
const STAR = (n: number, m: number) => [
  `Estrella ${n} de ${m}.`,
  `¡Estrella! Llevas ${n} de ${m}.`,
  `${n} de ${m}. Tu guía sabe dónde están las otras.`,
  `Otra estrella: ${n} de ${m}.`,
  `Brillo nuevo: ${n} de ${m}.`,
  `${n} de ${m}, y la guía sabe de las demás.`,
  `¡Clic de estrella! ${n}/${m}.`,
  `Van ${n} estrellas de ${m}.`,
];
const STATION_DONE = [
  "Este sello ya es tuyo.",
  "Aquí ya ganaron. Sigan con las otras.",
  "Estación resuelta. Hay otras esperando.",
  "Esta ya la tienen. Adelante.",
  "Sello en mano: nada que hacer aquí.",
  "Ya pasaron por aquí. A buscar la siguiente.",
  "Trabajo hecho. A por la próxima estación.",
  "Mismo lugar, mismo sello. Siguiente.",
];
const EXIT_SEALED = (missing: string) => [
  `La salida no se abre: ${missing}.`,
  `Cerrada a cal y canto: ${missing}.`,
  `La salida ni se inmuta. Tu guía sabe dónde están las estaciones: ${missing}.`,
  `Sin los sellos no hay salida: ${missing}.`,
  `Puerta sellada, ${missing}. Vuelvan a las estaciones.`,
  `Todavía no: ${missing}.`,
  `La salida pide sellos y ${missing}.`,
  `Cerrado por falta de sellos: ${missing}.`,
];
const FAIL_PAID = [
  "Bzzt. Eso costó un poco de vela.",
  "No era. La vela lo resiente.",
  "Fallo con factura: menos luz.",
  "Bzzt con costo: la llama baja un poco.",
  "Error pagado en luz. Con calma.",
  "No era, y la vela lo notó.",
  "Fallaron y se llevó su cuota de vela.",
  "Bzzt: la llama paga la equivocación.",
];
const FAIL_FREE = [
  "Bzzt. Ese fue gratis, el siguiente quién sabe.",
  "No era, pero no costó nada. Todavía.",
  "Fallo de práctica: gratis.",
  "Bzzt de cortesía: sin costo, por ahora.",
  "Ese error corrió por la casa.",
  "Fallo sin factura. Aprovéchenlo.",
  "No era, pero no pasa nada. Aún.",
  "Error gratis: úsenlo para entender.",
];
const SEAL = (n: number) => [
  `¡Sello ${n} de 3! La vela se reaviva.`,
  `¡Sello! Van ${n} de 3. Más luz para el camino.`,
  `¡Clac! Sello ${n} de 3.`,
  `Sello ${n} de 3 en el bolsillo. Y la vela, como nueva.`,
  `¡Lo lograron! ${n} de 3 sellos.`,
  `Otra estación resuelta: ${n} de 3.`,
  `¡Bien jugado! Van ${n} sellos de 3.`,
  `Sello conseguido (${n}/3). La llama se llena.`,
];
const SEAL_3 = [
  "¡Tercer sello! La salida se abrió.",
  "¡Los tres sellos! Ahora sí: a la salida.",
  "Tres de tres. La salida los espera.",
  "Sellos completos: la puerta se abre.",
  "¡Lo lograron! Rumbo a la salida.",
  "Colección de sellos completa. A salir.",
  "Tercer sello y puerta libre.",
  "¡Todos los sellos! La salida ya los escucha.",
];
const HEAL = [
  "Y te devolvió un corazón.",
  "Y de regalo, un corazón.",
  "Y, de paso, un corazón de vuelta.",
  "Y te sanó un corazón.",
  "Incluye corazón gratis.",
  "Y el corazón se recupera un poco.",
  "Y la vida sube un corazón.",
  "Con premio: un corazón.",
];
const ARRIVED = [
  "¡Salida! Avísale a tu guía.",
  "¡Escaparon! Grítale a tu guía.",
  "¡Lo lograron! Cuéntenlo en voz alta.",
  "¡Afuera! Qué manera de trabajar en equipo.",
  "Salida alcanzada. ¡A celebrar!",
  "Fin del laberinto: ustedes ganaron.",
  "¡Por fin aire fresco! Díganselo a la guía.",
  "¡Libres! Choquen esos cinco, aunque sea por voz.",
];
const DEFEAT = [
  "Sin corazones. Se acabó la expedición…",
  "Y ahí se apagó todo. Se acabó la expedición.",
  "Sin corazones: la aventura termina aquí.",
  "El laberinto ganó esta vez.",
  "Se acabaron los corazones. Fin.",
  "Se terminó el viaje. Ya habrá revancha.",
  "No quedan corazones. Hasta aquí llegamos.",
  "La expedición se detiene. Respiren y cuenten lo vivido.",
];

const SHADOW_TOUCH_OPEN = [
  "¡Algo frío te rozó!",
  "¡Te alcanzó la Sombra!",
  "Un escalofrío por la espalda: era ella.",
  "¡Contacto! Ese frío no era del laberinto.",
  "Se te cruzó la Sombra y no pidió permiso.",
  "¡Brrr! Te tocó un pedazo de oscuridad.",
  "Chocaste con la Sombra de frente.",
  "Algo sin nombre pasó por donde estabas.",
  "¡Ay! La Sombra no sabe lo que es el espacio personal.",
];

const SHADOW_TOUCH_TAIL = [
  "La vela tembló y perdiste un corazón.",
  "Perdiste un corazón y un poco de luz.",
  "Te cuesta un corazón y media llama.",
  "La luz se encogió y el corazón también.",
  "Un corazón menos y la vela hecha un flan.",
  "Se llevó un corazón y algo de vela de recuerdo.",
  "Tu vela sufrió y tu corazón ni se diga.",
];

const SHADOW_STUN = [
  "¡La luz la dejó tiesa! Unos pasos de respiro.",
  "El farol la encandiló: se quedó quieta un rato.",
  "¡Flash! La Sombra se congeló. Aprovechen.",
  "La Sombra parpadeó y se quedó clavada. Camina rápido.",
  "Con tanta luz no se puede ni moverse: ya tienes ventaja.",
  "La Sombra odia las luces fuertes. Y tú acabas de encender una.",
  "Se quedó atontada. No lo desperdicien.",
  "El farol la paró en seco. Ahora, ¡a pasar!",
  "Se le apagaron los ojos un momento. Tu guía dirá por dónde.",
];

export type Messenger = (e: PlayEvent, s: PlayState) => string | null;

export function createMessenger(game: Game): Messenger {
  const pick = (kind: string, pool: readonly string[]): string => shared.pick(kind, pool);
  const maxStars = DIFFICULTIES[game.level].stars;
  const hearts = (n: number) => (n === 1 ? "Te queda 1 corazón" : `Te quedan ${n} corazones`);
  let sealLine = "";

  return (e, s) => {
    switch (e.type) {
      case "locked":
        return pick("locked", LOCKED);
      case "key":
        return pick("key", KEY);
      case "teleported":
        return pick("portal", PORTAL);
      case "fell": {
        if (s.lost) return null; // the defeat line covers it
        const keys = e.keysLost ? " Tus llaves se quedaron allá abajo." : "";
        return `${shared.combo("fell", FELL_OPEN, FELL_TAIL)}${keys} ${hearts(s.hearts)}.`;
      }
      case "hurt":
        if (e.cause === "pit" || e.cause === "shadow" || s.lost) return null;
        if (e.cause === "trial") return `${pick("trial-hurt", TRIAL_HURT)} ${hearts(s.hearts)}.`;
        return `${pick("dark-hurt", DARK_HURT)} ${hearts(s.hearts)}.`;
      case "shadowTouch":
        if (s.lost) return null; // the defeat line covers it
        return shared.combo("shadow-touch", SHADOW_TOUCH_OPEN, [`${hearts(s.hearts)}.`, ...SHADOW_TOUCH_TAIL.map((t) => `${t} ${hearts(s.hearts)}.`)]);
      case "shadowStunned":
        return shared.pick("shadow-stun", SHADOW_STUN);
      case "dimmed":
        return e.radius >= 2 ? pick("dim2", DIM2) : pick("dim1", DIM1);
      case "darkness":
        return pick("dark", DARKNESS);
      case "candle":
        return pick("candle", CANDLE);
      case "lantern":
        return pick("lantern", LANTERN);
      case "swirl":
        return e.axes === "xy" ? pick("swirl-xy", SWIRL_XY) : pick("swirl-x", SWIRL_X);
      case "curse":
        return shared.combo(`curse-${e.kind}`, CURSE_OPEN[e.kind], CURSE_TAIL);
      case "uncurse":
        return e.cured ? pick("cured", CURED) : pick("curse-off", CURSE_OFF);
      case "emergencyExit":
        return pick("emergency", EMERGENCY);
      case "unswirl":
        return pick("unswirl", UNSWIRL);
      case "star":
        return e.count === maxStars ? pick("star-all", STAR_ALL(maxStars)) : pick("star", STAR(e.count, maxStars));
      case "station":
        return e.sealed ? pick("station-done", STATION_DONE) : null; // the overlay takes over
      case "exitSealed": {
        if (e.emergency) return null; // the emergency dialog takes over
        const missing = e.missing === 1 ? "falta 1 sello" : `faltan ${e.missing} sellos`;
        return pick("exit-sealed", EXIT_SEALED(missing));
      }
      case "trialFail":
        return e.paid ? pick("fail-paid", FAIL_PAID) : pick("fail-free", FAIL_FREE);
      case "seal":
        return (sealLine = e.count === 3 ? pick("seal-3", SEAL_3) : pick("seal", SEAL(e.count)));
      case "heal":
        // Comes right after its seal: one toast for both.
        return `${sealLine} ${pick("heal", HEAL)}`.trim();
      case "arrived":
        return pick("arrived", ARRIVED);
      case "defeat":
        return pick("defeat", DEFEAT);
      default:
        return null;
    }
  };
}

/** Every pool of lines, for the variety audit (tests count them). */
export const MESSAGE_POOLS = {
  locked: LOCKED, key: KEY, portal: PORTAL, "dark-hurt": DARK_HURT, "trial-hurt": TRIAL_HURT, dim2: DIM2, dim1: DIM1, darkness: DARKNESS, candle: CANDLE, lantern: LANTERN,
  "swirl-xy": SWIRL_XY, "swirl-x": SWIRL_X, unswirl: UNSWIRL, cured: CURED, "curse-off": CURSE_OFF, emergency: EMERGENCY, "station-done": STATION_DONE,
  "fail-paid": FAIL_PAID, "fail-free": FAIL_FREE, "seal-3": SEAL_3, heal: HEAL, arrived: ARRIVED, defeat: DEFEAT, "shadow-stun": SHADOW_STUN,
} as const;
