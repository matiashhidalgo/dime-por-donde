import { readJSON, writeJSON } from "./storage";

/**
 * «La primera vez»: which one-sentence hints this device has already shown, and
 * whether the 4-card tour was seen. localStorage through lib/storage (try/catch
 * inside), so a blocked or full store just means the hints come back next time.
 */

const KEY = "laberinto.hints.v1";

export const HINT_IDS = [
  "tour",
  "trial-figures",
  "trial-lock",
  "trial-piano",
  "trial-tangram",
  "cure",
  "shadow-explorer",
  "shadow-guide",
  "relay",
] as const;
export type HintId = (typeof HINT_IDS)[number];

function read(): Partial<Record<HintId, true>> {
  const v = readJSON<unknown>(KEY, {});
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<Record<HintId, true>>) : {};
}

export const hintSeen = (id: HintId): boolean => read()[id] === true;

export function markHint(id: HintId): void {
  const seen = read();
  if (seen[id]) return;
  writeJSON(KEY, { ...seen, [id]: true });
}

/** Forget everything (the «Cómo se juega» button uses markHint only; this is for tests and a future reset). */
export function resetHints(): void {
  writeJSON(KEY, {});
}

/** One sentence per hint: warm, a little funny, no object names. */
export const HINT_TEXT: Record<Exclude<HintId, "tour">, string> = {
  "trial-figures": "Una persona describe la figura y la otra elige entre las parecidas. Digan qué ven, no cómo se llama.",
  "trial-lock": "Prueben combinaciones: las luces dicen qué tan cerca están. Las pistas en dibujo las tiene el otro dispositivo.",
  "trial-piano": "Quien escucha cuenta la melodía (¿sube? ¿baja? ¿se queda?) y quien toca prueba teclas hasta que suene igual.",
  "trial-tangram": "Quien ve la silueta la describe en cuadritos y quien tiene las piezas las encaja. A veces sobra una.",
  cure: "Una maldición se cura con una prueba que resuelve solo la guía, con lo que el explorador le cuente.",
  "shadow-explorer": "Algo ronda por aquí: si el latido se acelera, avísale a tu guía. «Esperar» te deja quieto un instante.",
  "shadow-guide": "El trazo con flechas es la ronda de la Sombra, no dónde está ahora. Pregunta qué oye y qué ve el explorador.",
  relay: "Esta clave de nueve letras le cuenta a la otra persona cómo siguen. Díctenla despacio, de tres en tres.",
};
