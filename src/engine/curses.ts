import { CODE_ALPHABET, normalizeCodeInput } from "./code";
import { type FiguresTrial, sigilTrial } from "./figures";
import { glyphSet } from "./glyphs";
import type { Dir } from "./grid";
import { createRng } from "./rng";
import { invertDir } from "./rules";
import { MAX_GUIDE_FAILS } from "./sealcode";
import { TUNING } from "./tuning";

/**
 * Curses (GAME_SPEC_V2.md §5, anexo etapa 3). In v2 a swirl lays curse
 * number k of the game: its kind, length and cure are drawn from
 * `seed|curse|k`, so nobody can learn «the third swirl rotates left».
 *
 * The cure is a micro-trial only the guide can solve from the explorer's
 * description, on the guide's own device, which then shows a short key:
 *
 *  - sigil: the explorer sees a procedural sigil with k + 1 notches; the
 *    guide picks it among 6 look-alike antidotes (figures machinery).
 *  - echo: the explorer watches 3–4 glyphs blink in order; the guide taps
 *    the same sequence on a keyboard of those glyphs, in another order.
 *
 * Keys carry the guide's mistakes like seal keys do (one key per f = 0..9):
 *   ABC + 1 weighted checksum, same alphabet as game codes.
 */

export const CURSE_KINDS = ["turn", "blind", "hungry", "masked", "mirror"] as const;
export type CurseKind = (typeof CURSE_KINDS)[number];
export type CureKind = "sigil" | "echo";

export interface Curse {
  /** Curse number in this game (0-based): the sigil/echo shows k + 1 notches. */
  k: number;
  kind: CurseKind;
  /** Moves left before it lifts on its own. */
  left: number;
  /** «turn» only: +1 = controls turned clockwise, −1 = counter-clockwise. */
  turn: 1 | -1;
  cure: CureKind;
}

/** Curse number `k` of a game: deterministic from the game seed. */
export function drawCurse(gameSeed: string, k: number): Curse {
  const rng = createRng(`${gameSeed}|curse|${k}`);
  const w = TUNING.curse.weights;
  const kind = CURSE_KINDS[rng.weighted(CURSE_KINDS.map((c) => w[c]))];
  const [lo, hi] = TUNING.curse.steps;
  return { k, kind, left: rng.range(lo, hi), turn: rng.chance(0.5) ? 1 : -1, cure: rng.chance(0.5) ? "sigil" : "echo" };
}

/** Where a pressed direction actually goes under a curse. */
export function cursedDir(input: Dir, c: Curse | null): Dir {
  if (!c) return input;
  if (c.kind === "turn") return ((input + c.turn + 4) % 4) as Dir;
  if (c.kind === "mirror") return invertDir(input, "x");
  return input;
}

/** What to press to go `intended` under a curse (the inverse of cursedDir). */
export function inputForCursed(intended: Dir, c: Curse | null): Dir {
  if (!c) return intended;
  if (c.kind === "turn") return ((intended - c.turn + 4) % 4) as Dir;
  if (c.kind === "mirror") return invertDir(intended, "x");
  return intended;
}

// ── Cures ────────────────────────────────────────────────────────────────────

const cureSeed = (gameSeed: string, k: number) => `${gameSeed}|cure|${k}`;

/** «Sigilo y antídoto» for curse k: 6 candidates, the explorer's sigil is `target`. */
export function sigilCure(gameSeed: string, k: number): FiguresTrial {
  return sigilTrial(cureSeed(gameSeed, k));
}

export interface EchoCure {
  /** Glyph paths of this curse's set (5 or 6). */
  glyphs: string[];
  /** The sequence the explorer sees blink, as glyph indices. */
  sequence: number[];
  /** Keyboard order on the guide's device (never the identity). */
  keyboard: number[];
  repeats: boolean;
  /** Milliseconds each glyph stays lit. */
  beatMs: number;
}

const echoCache = new Map<string, EchoCure>();

/** «Eco» for curse k. The sequence is uniform per slot over the set. */
export function echoCure(gameSeed: string, k: number): EchoCure {
  const seed = cureSeed(gameSeed, k);
  const hit = echoCache.get(seed);
  if (hit) return hit;
  const rng = createRng(`${seed}|echo`);
  const size = rng.range(5, 6);
  const length = rng.range(3, 4);
  const repeats = rng.chance(0.5);
  const beatMs = rng.pick([650, 800, 950]);
  const { paths } = glyphSet(`${seed}|echo`, size);
  const sequence: number[] = [];
  while (sequence.length < length) {
    const g = rng.int(size);
    if (!repeats && sequence.includes(g)) continue;
    sequence.push(g);
  }
  let keyboard = rng.shuffle(paths.map((_, i) => i));
  if (keyboard.every((g, i) => g === i)) keyboard = [...keyboard.slice(1), keyboard[0]];
  const echo: EchoCure = { glyphs: paths, sequence, keyboard, repeats, beatMs };
  if (echoCache.size > 64) echoCache.clear();
  echoCache.set(seed, echo);
  return echo;
}

// ── Cure keys ────────────────────────────────────────────────────────────────

export const CURE_KEY_LENGTH = 4;
const BASE = CODE_ALPHABET.length;

function checksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
  return CODE_ALPHABET[sum % BASE];
}

const keyCache = new Map<string, string[]>();

/**
 * Keys for curse k, one per guide mistakes f = 0..9. Distinct from each
 * other and from every key of the curses before k in the same game.
 */
export function cureKeys(gameSeed: string, k: number): string[] {
  const id = `${gameSeed}|${k}`;
  const hit = keyCache.get(id);
  if (hit) return hit;
  const used = new Set<string>(usedBefore(gameSeed, k));
  const row: string[] = [];
  for (let f = 0; f <= MAX_GUIDE_FAILS; f++) {
    for (let salt = 0; ; salt++) {
      const rng = createRng(`${cureSeed(gameSeed, k)}|key|${f}|${salt}`);
      let body = "";
      for (let i = 0; i < CURE_KEY_LENGTH - 1; i++) body += CODE_ALPHABET[rng.int(BASE)];
      const key = body + checksum(body);
      if (!used.has(key) && !row.includes(key)) {
        row.push(key);
        break;
      }
    }
  }
  if (keyCache.size > 256) keyCache.clear();
  keyCache.set(id, row);
  return row;
}

function usedBefore(gameSeed: string, k: number): string[] {
  const out: string[] = [];
  for (let j = 0; j < k; j++) out.push(...cureKeys(gameSeed, j));
  return out;
}

/** The key the guide dictates for curse k after `fails` mistakes. */
export const cureKey = (gameSeed: string, k: number, fails: number) =>
  cureKeys(gameSeed, k)[Math.min(MAX_GUIDE_FAILS, Math.max(0, fails))];

export const formatCureKey = (key: string) => `${key.slice(0, 2)}-${key.slice(2)}`;

export type CureKeyCheck = { ok: true; fails: number } | { ok: false; message: string };

/** Reads what the explorer typed against curse k. Wrong keys are free: the curse keeps running. */
export function checkCureKey(gameSeed: string, k: number, input: string): CureKeyCheck {
  const { text } = normalizeCodeInput(input);
  if (!text) return { ok: false, message: "Escribe la clave que te dicta tu guía." };
  const bad = [...text].find((c) => !CODE_ALPHABET.includes(c));
  if (bad) return { ok: false, message: `La «${bad}» no existe en las claves. Que te la deletree.` };
  if (text.length !== CURE_KEY_LENGTH) return { ok: false, message: `La clave tiene ${CURE_KEY_LENGTH} caracteres y llevas ${text.length}.` };
  if (checksum(text.slice(0, -1)) !== text[CURE_KEY_LENGTH - 1]) return { ok: false, message: "Esa clave no cuadra: hay una letra cambiada." };
  const f = cureKeys(gameSeed, k).indexOf(text);
  if (f >= 0) return { ok: true, fails: f };
  for (let j = 0; j < k; j++) {
    if (cureKeys(gameSeed, j).includes(text)) return { ok: false, message: "Esa clave cura una maldición vieja, no esta. Cuéntenle las muescas." };
  }
  return { ok: false, message: "Esa clave no cura esta maldición. ¿Tu guía abrió la correcta?" };
}
