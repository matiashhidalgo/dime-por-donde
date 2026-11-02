import { CODE_ALPHABET, normalizeCodeInput } from "./code";
import { createRng } from "./rng";

/**
 * Seal keys dictated by voice (GAME_SPEC_V2.md §4, anexo etapa 2). When the
 * guide solves a trial on THEIR device, it shows a 6-character key the
 * explorer types to open the seal. The guide's mistakes travel inside the
 * key: there is one key per number of guide failures f (0..9), and the
 * explorer's device charges f when it recognizes which one was typed.
 *
 *   ABC-DEF   5 characters from `seed|station|f` + 1 weighted checksum
 *
 * Same alphabet as game codes (no 0/O/1/I/L/V/N; V→B and N→M are folded).
 * The checksum catches any single wrong character and any adjacent swap.
 */

export const SEAL_CODE_LENGTH = 6;
export const MAX_GUIDE_FAILS = 9;
const BASE = CODE_ALPHABET.length;

function checksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
  return CODE_ALPHABET[sum % BASE];
}

const keyCache = new Map<string, string[][]>();

/** All keys of one game, `[station][f]`, distinct from each other. */
export function sealKeys(gameSeed: string, stations: number): string[][] {
  const cacheKey = `${gameSeed}|${stations}`;
  const hit = keyCache.get(cacheKey);
  if (hit) return hit;
  const used = new Set<string>();
  const out: string[][] = [];
  for (let s = 0; s < stations; s++) {
    const row: string[] = [];
    for (let f = 0; f <= MAX_GUIDE_FAILS; f++) {
      for (let salt = 0; ; salt++) {
        const rng = createRng(`${gameSeed}|v2|seal|${s}|${f}|${salt}`);
        let body = "";
        for (let i = 0; i < SEAL_CODE_LENGTH - 1; i++) body += CODE_ALPHABET[rng.int(BASE)];
        const key = body + checksum(body);
        if (!used.has(key)) {
          used.add(key);
          row.push(key);
          break;
        }
      }
    }
    out.push(row);
  }
  if (keyCache.size > 32) keyCache.clear();
  keyCache.set(cacheKey, out);
  return out;
}

/** The key the guide dictates for station `station` after `fails` mistakes. */
export function sealKey(gameSeed: string, stations: number, station: number, fails: number): string {
  return sealKeys(gameSeed, stations)[station][Math.min(MAX_GUIDE_FAILS, Math.max(0, fails))];
}

export const formatSealKey = (k: string) => `${k.slice(0, 3)}-${k.slice(3)}`;

export type SealKeyError = "empty" | "length" | "invalid-char" | "checksum" | "mismatch";

export type SealKeyCheck = { ok: true; fails: number } | { ok: false; error: SealKeyError; message: string };

/** Reads what the explorer typed for `station`. Only "empty"/"length" are free to retry. */
export function checkSealKey(gameSeed: string, stations: number, station: number, input: string): SealKeyCheck {
  const { text } = normalizeCodeInput(input);
  if (!text) return { ok: false, error: "empty", message: "Escribe la clave que te dicta tu guía." };
  const bad = [...text].find((c) => !CODE_ALPHABET.includes(c));
  if (bad) return { ok: false, error: "invalid-char", message: `La «${bad}» no existe en las claves. Pídele que te la deletree.` };
  if (text.length !== SEAL_CODE_LENGTH) {
    return { ok: false, error: "length", message: `La clave tiene ${SEAL_CODE_LENGTH} caracteres y llevas ${text.length}.` };
  }
  if (checksum(text.slice(0, -1)) !== text[SEAL_CODE_LENGTH - 1]) {
    return { ok: false, error: "checksum", message: "Esa clave no cuadra: hay una letra cambiada. Que te la repita despacito." };
  }
  const f = sealKeys(gameSeed, stations)[station].indexOf(text);
  if (f < 0) return { ok: false, error: "mismatch", message: "Esa clave no abre este sello. ¿Será de otra estación?" };
  return { ok: true, fails: f };
}

/** Whether a failed check should cost something (typos of length are free). */
export const sealKeyCosts = (e: SealKeyError) => e === "invalid-char" || e === "checksum" || e === "mismatch";
