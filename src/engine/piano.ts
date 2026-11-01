import { createRng } from "./rng";

/**
 * PIANO DE LA BRUJA (GAME_SPEC_V2.md anexo etapa 4). One player hears a
 * generated melody (with headphones) and describes it; the other has a
 * keyboard of colored keys and rebuilds it. Nothing has to travel through the
 * call: each device plays only its own sounds.
 *
 * Anti-shortcut rules:
 *  - the keyboard is a permutation of the notes, never sorted low→high or
 *    high→low, and colors/shapes are drawn apart from pitch;
 *  - every melody position is uniform over the keys; the «interest» filter is
 *    symmetric under turning the melody upside down, so it can't favor the
 *    top or the bottom;
 *  - scale, tonic, timbre, rhythm, tempo and length are all drawn.
 */

export const PIANO_SCALES = {
  pentaMajor: [0, 2, 4, 7, 9],
  pentaMinor: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  whole: [0, 2, 4, 6, 8, 10],
} as const;
export type PianoScale = keyof typeof PIANO_SCALES;

export const PIANO_TIMBRES = ["bell", "flute", "pluck", "wood", "organ"] as const;
export type PianoTimbre = (typeof PIANO_TIMBRES)[number];

/** Key colors and shapes (both drawn per station; color is never the only signal). */
export const PIANO_COLORS = ["#d94f4f", "#e8903a", "#e3c341", "#5aa65a", "#3fa3b5", "#4b6fd1", "#8a5cc7", "#d65fa0"] as const;
export const PIANO_SHAPES = ["circle", "square", "triangle", "diamond", "star", "drop", "moon", "cross"] as const;
export type PianoShape = (typeof PIANO_SHAPES)[number];

const DURATIONS = [0.5, 1, 1.5, 2] as const;
const DURATION_WEIGHTS = [3, 4, 1.5, 1.5];
const TEMPOS = [0.3, 0.35, 0.4, 0.45, 0.5] as const;

export interface PianoKey {
  /** MIDI note. */
  midi: number;
  /** 0 = lowest key of this keyboard. */
  rank: number;
  color: string;
  shape: PianoShape;
}

export interface PianoTrial {
  /** A: the explorer listens, the guide plays (and dictates a key). B: the reverse. */
  direction: "A" | "B";
  scale: PianoScale;
  tonic: number;
  timbre: PianoTimbre;
  /** Keys in display order (left to right). */
  keys: PianoKey[];
  /** The melody as display-order key indices: this is the answer. */
  melody: number[];
  /** Duration of each note, in beats. */
  durations: number[];
  /** Seconds per beat. */
  beat: number;
  repeats: boolean;
}

/** Melody as keyboard ranks (0 = lowest), for the filter and the tests. */
export const melodyRanks = (t: PianoTrial) => t.melody.map((k) => t.keys[k].rank);

/**
 * Whether a melody (as ranks on a keyboard of `size`) is worth describing:
 * ≥ 3 different pitches, a range of ≥ 3 steps, at least one change of
 * direction, never the same note 3 times in a row. Every rule is symmetric
 * under rank → size − 1 − rank.
 */
export function interestingMelody(ranks: readonly number[]): boolean {
  if (new Set(ranks).size < 3) return false;
  if (Math.max(...ranks) - Math.min(...ranks) < 3) return false;
  let lastDir = 0;
  let turns = 0;
  let run = 1;
  for (let i = 1; i < ranks.length; i++) {
    const d = Math.sign(ranks[i] - ranks[i - 1]);
    run = d === 0 ? run + 1 : 1;
    if (run >= 3) return false;
    if (d !== 0) {
      if (lastDir !== 0 && d !== lastDir) turns++;
      lastDir = d;
    }
  }
  return turns >= 1;
}

/** U/D/S between consecutive notes: the shape a listener describes. */
export const contourOf = (ranks: readonly number[]) =>
  ranks
    .slice(1)
    .map((r, i) => (r > ranks[i] ? "U" : r < ranks[i] ? "D" : "S"))
    .join("");

const cache = new Map<string, PianoTrial>();

export function pianoTrial(key: string, direction: "A" | "B"): PianoTrial {
  const id = `${key}|${direction}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const rng = createRng(`${key}|piano`);
  const scale = rng.pick(Object.keys(PIANO_SCALES) as PianoScale[]);
  const tonic = rng.range(53, 65);
  const timbre = rng.pick(PIANO_TIMBRES);
  const size = rng.range(6, 8);
  const length = rng.range(4, 6);
  const repeats = rng.chance(0.5) || length > size;
  const beat = rng.pick(TEMPOS);

  const steps = PIANO_SCALES[scale];
  const notes = Array.from({ length: size }, (_, r) => tonic + 12 * Math.floor(r / steps.length) + steps[r % steps.length]);
  // Display position → rank. Never sorted either way.
  let order = rng.shuffle(notes.map((_, r) => r));
  while (order.every((r, i) => r === i) || order.every((r, i) => r === size - 1 - i)) order = rng.shuffle(order);
  const colors = rng.shuffle(PIANO_COLORS);
  const shapes = rng.shuffle(PIANO_SHAPES);
  const keys: PianoKey[] = order.map((rank, i) => ({ midi: notes[rank], rank, color: colors[i], shape: shapes[i] }));

  let ranks: number[] = [];
  for (let tries = 0; tries < 1000; tries++) {
    ranks = [];
    while (ranks.length < length) {
      const r = rng.int(size);
      if (!repeats && ranks.includes(r)) continue;
      ranks.push(r);
    }
    if (interestingMelody(ranks)) break;
  }
  const where = new Map(keys.map((k, i) => [k.rank, i]));
  const melody = ranks.map((r) => where.get(r)!);

  let durations: number[] = [];
  do durations = Array.from({ length }, () => DURATIONS[rng.weighted(DURATION_WEIGHTS)]);
  while (new Set(durations).size < 2);

  const trial: PianoTrial = { direction, scale, tonic, timbre, keys, melody, durations, beat, repeats };
  if (cache.size > 64) cache.clear();
  cache.set(id, trial);
  return trial;
}

/** How many notes of `answer` sit in their place (the «Comprobar» reply). Same pitch counts, whichever key. */
export function pianoInPlace(t: PianoTrial, answer: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < t.melody.length; i++) if (answer[i] !== undefined && t.keys[answer[i]]?.midi === t.keys[t.melody[i]].midi) n++;
  return n;
}

export const pianoSolved = (t: PianoTrial, answer: readonly number[]) =>
  answer.length === t.melody.length && pianoInPlace(t, answer) === t.melody.length;
