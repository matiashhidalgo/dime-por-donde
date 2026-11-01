import { checkCureKey } from "./curses";
import { figuresTrial } from "./figures";
import { lockTrial, scoreGuess } from "./lock";
import { pianoInPlace, pianoTrial } from "./piano";
import { type PlayEvent, type PlayState, type TrialProgress, exitOpen, hurt, refill, sealCount, visionRadius } from "./play";
import { checkSealKey, sealKeyCosts } from "./sealcode";
import { figureHardness } from "./streak";
import { type Placement, checkTangram, tangramTrial } from "./tangram";
import { TUNING } from "./tuning";
import type { Game, Station } from "./types";

/** The figures instance of a station (streak maps make them more alike). */
export const stationFigures = (game: Game, st: Station) => figuresTrial(st.key, st.direction, figureHardness(game));
export const stationPiano = (st: Station) => pianoTrial(st.key, st.direction);
export const stationTangram = (st: Station) => tangramTrial(st.key, st.direction);

/** Whether the guide plays this station on their device and dictates a seal key. */
export const guideActs = (st: Station) => st.kind !== "lock" && st.direction === "A";

/** Wrong complete answers that cost nothing at this station (lock: `lockFreeTries`, figures: none). */
export function freeTries(s: PlayState, st: Station): number {
  if (st.kind === "lock") return s.rules.lockFreeTries;
  if (st.kind === "piano") return TUNING.trials.pianoFreeTries;
  if (st.kind === "tangram") return TUNING.trials.tangramFreeTries;
  return 0;
}

/**
 * Trial actions on the explorer's device (GAME_SPEC_V2.md anexo etapa 2).
 * Like `stepPlay`, each returns a fresh state plus events, or null when the
 * action doesn't apply (not standing on that station, seal already won, game
 * over). The explorer's device is the referee: guide mistakes reach it inside
 * the dictated key and are charged here.
 *
 * Costs: a "paid" failure takes `trials.failLight` of candle; every
 * `trials.heartEvery`-th paid failure at the same station also takes a heart.
 * Rewards: each seal relights the candle; every `rules.healEvery`-th seal
 * gives a lost heart back. Free tries come from the state's rules (fewer on
 * later streak maps).
 */

export interface TrialResult {
  state: PlayState;
  events: PlayEvent[];
}

/** The station the explorer is standing on and can still play, or null. */
export function activeStation(game: Game, s: PlayState, index: number): Station | null {
  const st = game.stations?.[index];
  if (!st || s.cell !== st.cell || s.lost || s.arrived || s.seals & (1 << index)) return null;
  return st;
}

/** Direction B: the explorer picks candidate `pick` among the figures. */
export function chooseFigure(game: Game, prev: PlayState, index: number, pick: number): TrialResult | null {
  const st = activeStation(game, prev, index);
  if (!st || st.kind !== "figures" || st.direction !== "B") return null;
  const trial = stationFigures(game, st);
  if (pick < 0 || pick >= trial.candidates.length || prev.trials[index].wrong.includes(pick)) return null;
  const { s, events, t } = begin(prev, index);
  if (pick === trial.correct) {
    seal(game, s, index, events);
  } else {
    t.wrong = [...t.wrong, pick];
    fail(s, t, index, true, events);
  }
  return { state: s, events };
}

/** The explorer presses «Probar» on the lock. */
export function tryLock(game: Game, prev: PlayState, index: number, guess: readonly number[]): TrialResult | null {
  const st = activeStation(game, prev, index);
  if (!st || st.kind !== "lock") return null;
  const trial = lockTrial(st.key);
  if (guess.length !== trial.slots || guess.some((g) => !Number.isInteger(g) || g < 0 || g >= trial.glyphCount)) return null;
  if (!trial.repeats && new Set(guess).size !== guess.length) return null;
  const { s, events, t } = begin(prev, index);
  const feedback = scoreGuess(trial.secret, guess);
  t.guesses = [...t.guesses, { guess: [...guess], feedback }];
  if (feedback.hits === trial.slots) {
    seal(game, s, index, events);
  } else {
    fail(s, t, index, t.fails >= s.rules.lockFreeTries, events);
  }
  return { state: s, events };
}

/**
 * Piano, direction B: the explorer checks the melody they built (display-order
 * key indices). Wrong: the reply is how many notes sit in place.
 */
export function checkMelody(game: Game, prev: PlayState, index: number, answer: readonly number[]): (TrialResult & { right: number }) | null {
  const st = activeStation(game, prev, index);
  if (!st || st.kind !== "piano" || st.direction !== "B") return null;
  const trial = stationPiano(st);
  if (answer.length !== trial.melody.length || answer.some((k) => !Number.isInteger(k) || k < 0 || k >= trial.keys.length)) return null;
  const { s, events, t } = begin(prev, index);
  const right = pianoInPlace(trial, answer);
  t.melodies = [...t.melodies, { answer: [...answer], right }];
  if (right === trial.melody.length) seal(game, s, index, events);
  else fail(s, t, index, t.fails >= freeTries(s, st), events);
  return { state: s, events, right };
}

/**
 * Tangram, direction B: the explorer checks the pieces on their board. An
 * empty board, overlaps or pieces sticking out return null (nothing to check,
 * nothing charged).
 */
export function checkTangramAt(game: Game, prev: PlayState, index: number, placements: readonly Placement[]): TrialResult | null {
  const st = activeStation(game, prev, index);
  if (!st || st.kind !== "tangram" || st.direction !== "B") return null;
  const check = checkTangram(stationTangram(st), placements);
  if (!check.ready) return null;
  const { s, events, t } = begin(prev, index);
  if (check.fits) seal(game, s, index, events);
  else fail(s, t, index, t.fails >= freeTries(s, st), events);
  return { state: s, events };
}

export type SealKeyResult =
  | (TrialResult & { ok: true; guideFails: number })
  | (TrialResult & { ok: false; message: string; costly: boolean });

/**
 * Direction A (any station the guide plays): the explorer types the key the
 * guide dictates. Typing slips (empty, too short/long) change nothing; a key
 * that can't be right counts as a failure (the first `trials.keyFreeTries`
 * are free). A right key opens the seal and charges the guide's own mistakes,
 * which it carries, past the station's free tries — the same price as if the
 * explorer had made them.
 */
export function enterSealKey(game: Game, prev: PlayState, index: number, input: string): SealKeyResult | null {
  const st = activeStation(game, prev, index);
  if (!st || !guideActs(st)) return null;
  const check = checkSealKey(game.seed, game.stations!.length, index, input);
  if (!check.ok && !sealKeyCosts(check.error)) {
    return { ok: false, state: prev, events: [], message: check.message, costly: false };
  }
  const { s, events, t } = begin(prev, index);
  if (!check.ok) {
    t.keyErrors++;
    fail(s, t, index, t.keyErrors > s.rules.keyFreeTries, events);
    return { ok: false, state: s, events, message: check.message, costly: true };
  }
  const free = freeTries(s, st);
  for (let i = 0; i < check.fails && !s.lost; i++) fail(s, t, index, i >= free, events);
  if (!s.lost) seal(game, s, index, events);
  return { ok: true, state: s, events, guideFails: check.fails };
}

export type CureResult = (TrialResult & { ok: true; guideFails: number }) | (TrialResult & { ok: false; message: string });

/**
 * The explorer types the cure key for the curse in force. A wrong key costs
 * nothing (the curse keeps running, which is cost enough). A right one lifts
 * it and relights a little candle, less for every guide mistake it carries.
 */
export function enterCureKey(game: Game, prev: PlayState, input: string): CureResult | null {
  const c = prev.curse;
  if (!c || prev.lost || prev.arrived) return null;
  const check = checkCureKey(game.seed, c.k, input);
  if (!check.ok) return { ok: false, state: prev, events: [], message: check.message };
  const s: PlayState = { ...prev, curse: null, cured: prev.cured + 1 };
  const events: PlayEvent[] = [{ type: "uncurse", k: c.k, cured: true }];
  const reward = Math.max(0, TUNING.curse.cureRefill - check.fails * TUNING.curse.cureFailLight);
  if (reward > 0) refill(s, reward);
  return { ok: true, state: s, events, guideFails: check.fails };
}

// ── Internals ────────────────────────────────────────────────────────────────

function begin(prev: PlayState, index: number) {
  const t: TrialProgress = { ...prev.trials[index] };
  const trials = prev.trials.slice();
  trials[index] = t;
  const s: PlayState = { ...prev, trials };
  return { s, t, events: [] as PlayEvent[] };
}

function fail(s: PlayState, t: TrialProgress, index: number, paid: boolean, events: PlayEvent[]): void {
  t.fails++;
  events.push({ type: "trialFail", index, paid });
  if (!paid) return;
  t.paid++;
  const radiusBefore = visionRadius(s);
  const wasLit = s.light > 0;
  s.light = Math.max(0, s.light - Math.round(s.rules.maxLight * TUNING.trials.failLight));
  if (wasLit && s.light === 0) {
    s.dark = 0;
    events.push({ type: "darkness" });
  } else {
    const radius = visionRadius(s);
    if (radius < radiusBefore && radius > 0) events.push({ type: "dimmed", radius });
  }
  if (t.paid % TUNING.trials.heartEvery === 0) hurt(s, "trial", events);
}

function seal(game: Game, s: PlayState, index: number, events: PlayEvent[]): void {
  s.seals |= 1 << index;
  const count = sealCount(s);
  events.push({ type: "seal", index, count });
  refill(s, TUNING.seal.candleRefill);
  if (count % s.rules.healEvery === 0 && s.hearts < TUNING.hearts) {
    s.hearts++;
    events.push({ type: "heal", hearts: s.hearts });
  }
  if (exitOpen(game, s)) events.push({ type: "exitOpen" });
}
