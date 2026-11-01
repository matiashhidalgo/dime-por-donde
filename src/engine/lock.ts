import { glyphSet } from "./glyphs";
import { type Rng, createRng } from "./rng";

/**
 * CERRADURA DE DEDUCCIÓN (GAME_SPEC_V2.md §4, anexo etapa 2).
 *
 * The explorer tries combinations of procedural glyphs; the lock answers per
 * slot (hit / wrong place / absent) or, as a mutator, only with two counts.
 * The guide holds 3–5 pictogram clues that are TRUE (built from the secret),
 * never enough alone (≥ 8 combinations left) and enough together with the
 * feedback: the reference solver — "always try something consistent with
 * everything you know" — must open it in ≤ 6 tries, or the clues are redrawn.
 *
 * The secret is drawn once, uniformly over every valid combination, before
 * any clue retry, so rejections can't bias it.
 */

export type LockFeedbackMode = "slots" | "counts";
export type Light = "hit" | "near" | "miss";

export interface LockFeedback {
  /** Per slot of the guess. Only shown in "slots" mode. */
  lights: Light[];
  hits: number;
  near: number;
}

export const CLUE_TYPES = ["pos", "absent", "adj", "order", "count"] as const;
export type ClueType = (typeof CLUE_TYPES)[number];

export type Clue =
  /** The glyph is in the combination, and only within these slots. */
  | { type: "pos"; glyph: number; positions: number[] }
  /** The glyph is not in the combination. */
  | { type: "absent"; glyph: number }
  /** The two glyphs sit side by side somewhere (either order). */
  | { type: "adj"; a: number; b: number }
  /** Both appear and the first `a` comes before the first `b`. */
  | { type: "order"; a: number; b: number }
  /** Exactly k slots hold one of these glyphs. */
  | { type: "count"; glyphs: number[]; k: number };

export interface LockTrial {
  slots: number;
  glyphCount: number;
  repeats: boolean;
  feedback: LockFeedbackMode;
  /** Glyph paths; a glyph's identity is its index here. */
  glyphs: string[];
  secret: number[];
  clues: Clue[];
  /** Palette order on each device: different, so "the third one" means nothing. */
  explorerOrder: number[];
  guideOrder: number[];
  /** Combinations compatible with the clues alone. */
  ambiguity: number;
  /** Tries the reference solver needed for this instance. */
  solverTries: number;
}

export const LOCK_MAX_SOLVER_TRIES = 6;
export const LOCK_MIN_AMBIGUITY = 8;
/** Clues stop once this few combinations are left (counts-only feedback needs a tighter start). */
const MAX_LEFT: Record<LockFeedbackMode, number> = { slots: 48, counts: 18 };

// ── Rules ────────────────────────────────────────────────────────────────────

export function scoreGuess(secret: readonly number[], guess: readonly number[]): LockFeedback {
  const n = secret.length;
  const lights: Light[] = new Array(n).fill("miss");
  const left = new Map<number, number>();
  let hits = 0;
  for (let i = 0; i < n; i++) {
    if (guess[i] === secret[i]) {
      lights[i] = "hit";
      hits++;
    } else left.set(secret[i], (left.get(secret[i]) ?? 0) + 1);
  }
  let near = 0;
  for (let i = 0; i < n; i++) {
    if (lights[i] === "hit") continue;
    const k = left.get(guess[i]) ?? 0;
    if (k > 0) {
      lights[i] = "near";
      left.set(guess[i], k - 1);
      near++;
    }
  }
  return { lights, hits, near };
}

export function sameFeedback(a: LockFeedback, b: LockFeedback, mode: LockFeedbackMode): boolean {
  if (mode === "counts") return a.hits === b.hits && a.near === b.near;
  return a.lights.every((l, i) => l === b.lights[i]);
}

export function clueHolds(clue: Clue, combo: readonly number[]): boolean {
  switch (clue.type) {
    case "pos": {
      let seen = false;
      for (let i = 0; i < combo.length; i++) {
        if (combo[i] !== clue.glyph) continue;
        if (!clue.positions.includes(i)) return false;
        seen = true;
      }
      return seen;
    }
    case "absent":
      return !combo.includes(clue.glyph);
    case "adj":
      for (let i = 0; i + 1 < combo.length; i++) {
        if ((combo[i] === clue.a && combo[i + 1] === clue.b) || (combo[i] === clue.b && combo[i + 1] === clue.a)) return true;
      }
      return false;
    case "order": {
      const ia = combo.indexOf(clue.a);
      const ib = combo.indexOf(clue.b);
      return ia >= 0 && ib >= 0 && ia < ib;
    }
    case "count":
      return combo.filter((g) => clue.glyphs.includes(g)).length === clue.k;
  }
}

const comboCache = new Map<string, number[][]>();

/** Every valid combination, in a fixed order. */
export function allCombos(glyphCount: number, slots: number, repeats: boolean): number[][] {
  const key = `${glyphCount}|${slots}|${repeats}`;
  const hit = comboCache.get(key);
  if (hit) return hit;
  const out: number[][] = [];
  const cur: number[] = [];
  const rec = () => {
    if (cur.length === slots) {
      out.push(cur.slice());
      return;
    }
    for (let g = 0; g < glyphCount; g++) {
      if (!repeats && cur.includes(g)) continue;
      cur.push(g);
      rec();
      cur.pop();
    }
  };
  rec();
  comboCache.set(key, out);
  return out;
}

const sameCombo = (a: readonly number[], b: readonly number[]) => a.every((g, i) => g === b[i]);

/**
 * The reference solver: try a random combination consistent with everything
 * seen so far, until the lock opens. Returns the number of tries.
 */
export function solveLock(
  candidates: readonly (readonly number[])[],
  secret: readonly number[],
  mode: LockFeedbackMode,
  rng: Rng,
  cap = 40,
): number {
  let left = candidates.slice();
  for (let tries = 1; tries <= cap; tries++) {
    const guess = left[rng.int(left.length)];
    if (sameCombo(guess, secret)) return tries;
    const fb = scoreGuess(secret, guess);
    left = left.filter((c) => sameFeedback(scoreGuess(c, guess), fb, mode));
  }
  return cap + 1;
}

// ── Instance ─────────────────────────────────────────────────────────────────

const trialCache = new Map<string, LockTrial>();

export function lockTrial(key: string): LockTrial {
  const hit = trialCache.get(key);
  if (hit) return hit;
  const top = createRng(`${key}|lock`);
  const slots = top.pick([4, 5]);
  const glyphCount = top.range(6, 8);
  const repeats = top.chance(0.4);
  const feedback: LockFeedbackMode = top.chance(0.3) ? "counts" : "slots";
  const { paths } = glyphSet(key, glyphCount);
  const ids = paths.map((_, i) => i);
  const explorerOrder = top.shuffle(ids);
  let guideOrder = top.shuffle(ids);
  while (guideOrder.every((g, i) => g === explorerOrder[i])) guideOrder = top.shuffle(ids);
  const all = allCombos(glyphCount, slots, repeats);
  const secret = all[top.int(all.length)];

  let best: { clues: Clue[]; left: number; tries: number } | null = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = createRng(`${key}|lock|${attempt}`);
    const picked = pickClues(secret, all, rng, glyphCount, slots, MAX_LEFT[feedback]);
    if (!picked) continue;
    const tries = solveLock(picked.left, secret, feedback, rng.fork("solver"));
    if (!best || tries < best.tries) best = { clues: picked.clues, left: picked.left.length, tries };
    if (tries <= LOCK_MAX_SOLVER_TRIES) break;
  }
  if (!best) throw new Error(`lock ${key}: no clue set`);
  const trial: LockTrial = {
    slots,
    glyphCount,
    repeats,
    feedback,
    glyphs: paths,
    secret,
    clues: best.clues,
    explorerOrder,
    guideOrder,
    ambiguity: best.left,
    solverTries: best.tries,
  };
  if (trialCache.size > 64) trialCache.clear();
  trialCache.set(key, trial);
  return trial;
}

function pickClues(
  secret: readonly number[],
  all: readonly number[][],
  rng: Rng,
  glyphCount: number,
  slots: number,
  maxLeft: number,
): { clues: Clue[]; left: number[][] } | null {
  const types = rng.shuffle(CLUE_TYPES);
  let left = all as number[][];
  const clues: Clue[] = [];
  for (let i = 0; i < 40 && clues.length < 5; i++) {
    const clue = makeClue(types[i % types.length], secret, rng, glyphCount, slots);
    if (!clue || clues.some((c) => JSON.stringify(c) === JSON.stringify(clue))) continue;
    const next = left.filter((c) => clueHolds(clue, c));
    if (next.length < LOCK_MIN_AMBIGUITY || next.length === left.length) continue;
    clues.push(clue);
    left = next;
    if (clues.length >= 3 && left.length <= maxLeft) break;
  }
  if (clues.length < 3 || left.length > maxLeft) return null;
  // Show them in a random order, not the order they were found in.
  return { clues: rng.shuffle(clues), left };
}

function makeClue(type: ClueType, secret: readonly number[], rng: Rng, glyphCount: number, slots: number): Clue | null {
  const present = [...new Set(secret)];
  const absent = Array.from({ length: glyphCount }, (_, g) => g).filter((g) => !present.includes(g));
  switch (type) {
    case "pos": {
      const glyph = rng.pick(present);
      const occ = secret.flatMap((g, i) => (g === glyph ? [i] : []));
      const others = rng.shuffle(Array.from({ length: slots }, (_, i) => i).filter((i) => !occ.includes(i)));
      const extra = Math.min(others.length - 1, [0, 1, 1, 1, 2, 2][rng.int(6)]);
      const positions = [...occ, ...others.slice(0, Math.max(0, extra))].sort((a, b) => a - b);
      if (positions.length >= slots) return null;
      return { type: "pos", glyph, positions };
    }
    case "absent":
      return absent.length ? { type: "absent", glyph: rng.pick(absent) } : null;
    case "adj": {
      const pairs = [];
      for (let i = 0; i + 1 < slots; i++) if (secret[i] !== secret[i + 1]) pairs.push(i);
      if (!pairs.length) return null;
      const i = rng.pick(pairs);
      return rng.chance(0.5) ? { type: "adj", a: secret[i], b: secret[i + 1] } : { type: "adj", a: secret[i + 1], b: secret[i] };
    }
    case "order": {
      const once = present.filter((g) => secret.filter((x) => x === g).length === 1);
      if (once.length < 2) return null;
      const [x, y] = rng.shuffle(once);
      return secret.indexOf(x) < secret.indexOf(y) ? { type: "order", a: x, b: y } : { type: "order", a: y, b: x };
    }
    case "count": {
      const size = rng.range(2, 3);
      const glyphs = rng.shuffle(Array.from({ length: glyphCount }, (_, g) => g)).slice(0, size).sort((a, b) => a - b);
      return { type: "count", glyphs, k: secret.filter((g) => glyphs.includes(g)).length };
    }
  }
}
