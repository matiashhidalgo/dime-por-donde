/**
 * Game codes: 8 characters that carry everything both devices need.
 *
 *   H SSSSSS C    shown as  HSSS-SSSC
 *   │ │      └ checksum (catches any single typo and any adjacent swap)
 *   │ └ 6-char seed  (29^6 ≈ 594 million games)
 *   └ header: generator version + mode (easy / medium / hard / duo)
 *
 * Alphabet: 29 symbols (a prime, which is what makes the checksum airtight).
 * Excluded: 0 O 1 I L (look alike), V (sounds like B in Spanish: "be/uve"),
 * N (sounds like M on a call: "eme/ene"). When someone types V or N we fold
 * them to B / M, and the checksum confirms the guess.
 */

export const CODE_ALPHABET = "23456789ABCDEFGHJKMPQRSTUWXYZ";
const BASE = CODE_ALPHABET.length; // 29
export const SEED_LENGTH = 6;
export const CODE_LENGTH = SEED_LENGTH + 2;

/** Bump only when the generator's output changes. Old versions must keep working. */
export const GENERATOR_VERSION = 1;
export const SUPPORTED_VERSIONS: readonly number[] = [1];

export const LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof LEVELS)[number];
export const CODE_MODES = ["easy", "medium", "hard", "duo"] as const;
export type CodeMode = (typeof CODE_MODES)[number];
const MAX_VERSION = Math.floor((BASE - 1) / CODE_MODES.length) + 1; // 7

const FOLDS: Record<string, string> = { V: "B", N: "M", Ñ: "M" };
const REJECTED_HINT: Record<string, string> = {
  "0": "No usamos el cero (0) ni la letra O.",
  O: "No usamos la letra O ni el cero (0).",
  "1": "No usamos el uno (1), la I ni la L.",
  I: "No usamos la I, el uno (1) ni la L.",
  L: "No usamos la L, la I ni el uno (1).",
};

export interface GameCode {
  /** Canonical 8-char code, no separators. */
  code: string;
  version: number;
  mode: CodeMode;
  seed: string;
}

export type CodeErrorKind = "empty" | "length" | "invalid-char" | "checksum" | "unsupported-version";

export type ParseResult =
  | { ok: true; value: GameCode; corrected: boolean }
  | { ok: false; error: CodeErrorKind; message: string };

const valueOf = (ch: string) => CODE_ALPHABET.indexOf(ch);

function checksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (i + 1) * valueOf(body[i]);
  return CODE_ALPHABET[sum % BASE];
}

export function encodeCode(input: { version?: number; mode: CodeMode; seed: string }): string {
  const version = input.version ?? GENERATOR_VERSION;
  if (version < 1 || version > MAX_VERSION) throw new Error(`version out of range: ${version}`);
  const modeIndex = CODE_MODES.indexOf(input.mode);
  if (modeIndex < 0) throw new Error(`unknown mode: ${input.mode}`);
  if (input.seed.length !== SEED_LENGTH || [...input.seed].some((c) => valueOf(c) < 0)) {
    throw new Error(`invalid seed: ${input.seed}`);
  }
  const header = CODE_ALPHABET[(version - 1) * CODE_MODES.length + modeIndex];
  const body = header + input.seed;
  return body + checksum(body);
}

/** Uppercases, strips spaces/dashes/dots and folds sound-alike letters. */
export function normalizeCodeInput(input: string): { text: string; corrected: boolean } {
  let corrected = false;
  let text = "";
  for (const raw of input.toUpperCase()) {
    if (/[\s\-_.·,]/.test(raw)) continue;
    const folded = FOLDS[raw];
    if (folded) corrected = true;
    text += folded ?? raw;
  }
  return { text, corrected };
}

export function parseCode(input: string): ParseResult {
  const { text, corrected } = normalizeCodeInput(input);
  if (text.length === 0) {
    return { ok: false, error: "empty", message: "Escribe el código que te dictaron." };
  }
  for (const ch of text) {
    if (valueOf(ch) < 0) {
      return {
        ok: false,
        error: "invalid-char",
        message: REJECTED_HINT[ch] ?? `El carácter "${ch}" no existe en los códigos.`,
      };
    }
  }
  if (text.length !== CODE_LENGTH) {
    return {
      ok: false,
      error: "length",
      message: `El código tiene ${CODE_LENGTH} caracteres y llevas ${text.length}.`,
    };
  }
  const body = text.slice(0, -1);
  if (checksum(body) !== text[text.length - 1]) {
    return {
      ok: false,
      error: "checksum",
      message: "Ese código no cuadra: seguro hay una letra cambiada. Pídele que lo repita despacito.",
    };
  }
  const header = valueOf(text[0]);
  const version = Math.floor(header / CODE_MODES.length) + 1;
  const mode = CODE_MODES[header % CODE_MODES.length];
  if (!SUPPORTED_VERSIONS.includes(version)) {
    return {
      ok: false,
      error: "unsupported-version",
      message: "Ese código es de otra versión del juego. Actualicen ambos la página.",
    };
  }
  return { ok: true, corrected, value: { code: text, version, mode, seed: text.slice(1, -1) } };
}

/** "ABCD2345" → "ABCD-2345" for display and dictation. */
export function formatCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/**
 * Makes a fresh code. Randomness comes from the caller (crypto in the UI),
 * keeping the engine free of global state. `isTaken` lets the UI skip codes
 * already in this device's history.
 */
export function createCode(options: {
  mode: CodeMode;
  random: () => number;
  isTaken?: (code: string) => boolean;
  version?: number;
  maxTries?: number;
}): string {
  const maxTries = options.maxTries ?? 1000;
  for (let i = 0; i < maxTries; i++) {
    let seed = "";
    for (let j = 0; j < SEED_LENGTH; j++) {
      seed += CODE_ALPHABET[Math.floor(options.random() * BASE) % BASE];
    }
    const code = encodeCode({ mode: options.mode, seed, version: options.version });
    if (!options.isTaken?.(code)) return code;
  }
  throw new Error("could not find an unplayed code");
}
