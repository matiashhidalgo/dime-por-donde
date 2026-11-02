import { cureKey, inputForCursed } from "./curses";
import { DIRS, type Dir, bfs, degree, isOpen, neighbor } from "./grid";
import { allCombos, clueHolds, lockTrial, sameFeedback, scoreGuess } from "./lock";
import { PIT_KNOWN, type PlayState, createPlay, emergencyAvailable, sealCount, stepPlay, takeEmergencyExit, waitPlay } from "./play";
import type { Rng } from "./rng";
import { invertDir } from "./rules";
import { sealKey } from "./sealcode";
import { solve } from "./solver";
import { MAX_STREAK_MAPS, streakGame } from "./streak";
import {
  checkMelody,
  checkTangramAt,
  chooseFigure,
  enterCureKey,
  enterSealKey,
  guideActs,
  stationFigures,
  stationPiano,
  stationTangram,
  tryLock,
} from "./trialplay";
import { TUNING } from "./tuning";
import type { Game, Station } from "./types";

/**
 * A simulated pair for balancing (scripts/calibrate.ts, tests). Not used by
 * the app. The "explorer" follows the solver's route the way a guide would
 * dictate it, and the pair fails in the ways real pairs do:
 *
 *  - pitSlip: next to an unknown pit, the guide forgets to warn and the
 *    explorer steps in (chance per pit, per time they stand beside it).
 *  - wrongTurn: at a junction they take a wrong branch and walk 1..wander
 *    steps before noticing (and may hit a pit there too).
 *  - When the candle drops below `refillAt`, the guide steers to the nearest
 *    unused lantern/candle within `detour` steps.
 *  - v2: they head for the nearest station without a seal, then the exit.
 *    At a station they play the real trial through the same functions as the
 *    app: a figure description goes wrong with `figMiss` per pick, a dictated
 *    key is misheard with `keyTypo`, and at the lock each try is "sloppy"
 *    (ignores the lights so far, only the clues) with `lockSloppy`. At the
 *    piano and the tangram each complete answer is wrong with `pianoMiss` /
 *    `tangramMiss`, falling by `TRIAL_LEARN` after every miss (the reply and
 *    the talk that follows help); whoever plays, the misses cost the same.
 *    Their seconds per answer (`pianoSecs`, `tangramSecs`) only feed the
 *    reported trial times: the candle burns by moves, not by the clock.
 *  - v2 curses: turned or mirrored controls add `curseConfusion` to wrong
 *    turns, blindness adds it to pit slips; after `cureAfter` moves the pair
 *    cures it (the guide errs like with figures, `figMiss`).
 *  - La Sombra (anexo etapa 5): the pair can't see it, but they hear the
 *    heartbeat and the guide knows the route. Before a step that would touch it,
 *    they notice with chance `shadowDodge` (less against a hunter) and wait a
 *    tick instead, up to MAX_WAITS in a row; otherwise they walk into it. Steps
 *    taken while lost (wrong branches) get no such care.
 *  - In danger (≤ 1 heart) with a seal or two, they make for the exit and
 *    take the emergency way out.
 */

export interface PairProfile {
  name: string;
  pitSlip: number;
  wrongTurn: number;
  wander: number;
  refillAt: number;
  detour: number;
  figMiss: number;
  keyTypo: number;
  lockSloppy: number;
  curseConfusion: number;
  cureAfter: number;
  pianoMiss: number;
  tangramMiss: number;
  /** Chance of noticing (and waiting out) a step that would touch La Sombra. */
  shadowDodge: number;
  /** Modeled seconds per complete answer (describe, try keys or pieces, check). */
  pianoSecs: number;
  tangramSecs: number;
}

/** Longest run of waits to let La Sombra pass. */
export const MAX_WAITS = 6;
/** A hunter is harder to dodge: it comes toward you. */
export const HUNTER_DODGE = 0.6;

/** After each wrong answer at the piano or the tangram, the next one misses this much less often. */
export const TRIAL_LEARN = 0.6;

export const PROFILES: readonly PairProfile[] = [
  { name: "competente", pitSlip: 0.1, wrongTurn: 0.15, wander: 4, refillAt: 0.5, detour: 10, figMiss: 0.15, keyTypo: 0.05, lockSloppy: 0.1, curseConfusion: 0.1, cureAfter: 4, pianoMiss: 0.35, tangramMiss: 0.25, shadowDodge: 0.8, pianoSecs: 40, tangramSecs: 50 },
  { name: "normal", pitSlip: 0.2, wrongTurn: 0.25, wander: 6, refillAt: 0.4, detour: 8, figMiss: 0.3, keyTypo: 0.1, lockSloppy: 0.3, curseConfusion: 0.2, cureAfter: 7, pianoMiss: 0.55, tangramMiss: 0.4, shadowDodge: 0.55, pianoSecs: 50, tangramSecs: 65 },
  { name: "despistada", pitSlip: 0.35, wrongTurn: 0.4, wander: 8, refillAt: 0.3, detour: 6, figMiss: 0.5, keyTypo: 0.2, lockSloppy: 0.5, curseConfusion: 0.3, cureAfter: 12, pianoMiss: 0.7, tangramMiss: 0.6, shadowDodge: 0.3, pianoSecs: 60, tangramSecs: 80 },
];

export interface SimResult {
  won: boolean;
  /** Left through the emergency exit (counts as won). */
  escaped: boolean;
  curses: number;
  hearts: number;
  moves: number;
  falls: number;
  burnouts: number;
  stars: number;
  seals: number;
  /** Trial failures that cost light (and sometimes a heart). */
  trialPaid: number;
  /** Times La Sombra touched the explorer, and ticks spent waiting for it to pass. */
  touches: number;
  waits: number;
  /** The map had a Sombra. */
  shadowed: boolean;
  /** Modeled seconds spent at piano and tangram stations (answers × seconds per answer). */
  trialSecs: { piano: number[]; tangram: number[] };
}

const MOVE_CAP = 3000;

export function simulatePair(game: Game, p: PairProfile, rng: Rng, opts: { hearts?: number; level?: number } = {}): SimResult {
  let s = createPlay(game, opts);
  let burnouts = 0;
  let plan: Dir[] = [];
  let target = -1;
  let cursedFor = 0;
  let waits = 0;
  let waitsRow = 0;

  // The pair knows what the curse does once it bites: they press what goes where they mean.
  const step = (d: Dir) => {
    const r = stepPlay(game, s, invertDir(inputForCursed(d, s.curse), s.invert?.axes ?? null));
    s = r.state;
    if (r.events.some((e) => e.type === "burnout")) burnouts++;
    if (s.curse) {
      cursedFor++;
      if (cursedFor >= p.cureAfter) cure();
    } else cursedFor = 0;
    return r;
  };
  const wouldTouch = (d: Dir) =>
    stepPlay(game, s, invertDir(inputForCursed(d, s.curse), s.invert?.axes ?? null)).events.some((e) => e.type === "shadowTouch");
  const cure = () => {
    let fails = 0;
    while (fails < 9 && rng.chance(p.figMiss)) fails++;
    const res = enterCureKey(game, s, cureKey(game.seed, s.curse!.k, fails));
    if (res) s = res.state;
    cursedFor = 0;
  };
  const confused = () => (s.curse?.kind === "turn" || s.curse?.kind === "mirror" ? p.curseConfusion : 0);
  const blinded = () => (s.curse?.kind === "blind" ? p.curseConfusion : 0);
  const fleeing = () => !!game.stations && s.hearts <= TUNING.emergency.hearts && sealCount(s) >= 1;

  // The guide plans the stations in the order the route passes them.
  const along = (c: number) => {
    const d = bfs(game.grid, c);
    return game.solution.route.reduce((best, r, i) => (d[r] >= 0 && d[r] < d[game.solution.route[best]] ? i : best), 0);
  };
  const order = [...(game.stations ?? [])].sort((a, b) => along(a.cell) - along(b.cell));
  const goal = () => (fleeing() ? game.exit : (order.find((st) => !(s.seals & (1 << st.index)))?.cell ?? game.exit));

  const trialSecs: SimResult["trialSecs"] = { piano: [], tangram: [] };
  const atStation = () => {
    const st = game.stations?.find((x) => x.cell === s.cell && !(s.seals & (1 << x.index)));
    if (!st) return false;
    const before = s.trials[st.index].fails;
    s = playTrial(game, s, st, p, rng);
    if (st.kind === "piano" || st.kind === "tangram") {
      const answers = s.trials[st.index].fails - before - s.trials[st.index].keyErrors + 1;
      trialSecs[st.kind].push(answers * (st.kind === "piano" ? p.pianoSecs : p.tangramSecs));
    }
    return true;
  };

  const replan = () => {
    target = goal();
    if (s.light / s.rules.maxLight < p.refillAt) {
      const dist = bfs(game.grid, s.cell);
      let best = -1;
      const consider = (c: number) => {
        if (dist[c] >= 0 && dist[c] <= p.detour && (best < 0 || dist[c] < dist[best])) best = c;
      };
      game.lanterns.forEach((c, i) => !(s.lanterns & (1 << i)) && consider(c));
      game.checkpoints.forEach((c, i) => !(s.candles & (1 << i)) && consider(c));
      if (best >= 0) target = best;
    }
    let sol = solve(game, s.cell, target, s.keys);
    if (!sol.solvable && s.light / s.rules.maxLight < p.refillAt) {
      target = goal();
      sol = solve(game, s.cell, target, s.keys);
    }
    plan = sol.solvable ? sol.dirs.slice() : [];
  };

  replan();
  while (!s.arrived && !s.lost && s.moves < MOVE_CAP) {
    if (emergencyAvailable(game, s)) {
      s = takeEmergencyExit(game, s).state;
      break;
    }
    if (atStation()) {
      replan();
      continue;
    }
    if (plan.length === 0) {
      replan();
      if (plan.length === 0) break;
    }
    // The guide forgets to warn about a pit right beside them.
    const pit = unknownPitBeside(game, s, rng, p.pitSlip + blinded());
    if (pit !== null) {
      step(pit);
      replan();
      continue;
    }
    const d = plan[0];
    // A wrong branch at a junction.
    if (degree(game.grid, s.cell) >= 3 && rng.chance(p.wrongTurn + confused())) {
      const wrong = DIRS.filter((x) => x !== d && isOpen(game.grid, s.cell, x));
      if (wrong.length > 0) {
        let dir = rng.pick(wrong);
        const len = 1 + rng.int(p.wander);
        for (let i = 0; i < len && !s.lost && !s.arrived; i++) {
          const r = step(dir);
          if (r.outcome !== "moved") break;
          const onward = DIRS.filter((x) => x !== (dir + 2) % 4 && isOpen(game.grid, s.cell, x));
          if (onward.length === 0) break;
          dir = rng.pick(onward);
        }
        replan();
        continue;
      }
    }
    if (game.shadow && s.shadow && waitsRow < MAX_WAITS && wouldTouch(d) && rng.chance(p.shadowDodge * (game.shadow.hunter ? HUNTER_DODGE : 1))) {
      s = waitPlay(game, s).state;
      waits++;
      waitsRow++;
      continue;
    }
    waitsRow = 0;
    const r = step(d);
    plan.shift();
    if (r.outcome !== "moved" && r.outcome !== "teleported") replan();
    else if (s.cell === target && target !== game.exit) replan();
  }
  let stars = 0;
  for (let m = s.stars; m; m &= m - 1) stars++;
  const trialPaid = s.trials.reduce((a, t) => a + t.paid, 0);
  return {
    won: s.arrived,
    escaped: s.escaped,
    curses: s.curses,
    hearts: s.hearts,
    moves: s.moves,
    falls: s.pits,
    burnouts,
    stars,
    seals: sealCount(s),
    trialPaid,
    touches: s.touches,
    waits,
    shadowed: !!game.shadow,
    trialSecs,
  };
}

export interface StreakSimResult {
  /** Maps finished (won or escaped) before the hearts ran out. */
  maps: number;
  seals: number;
  escapes: number;
}

/** A whole streak: hearts carry over, escapes raise the play level, until 0 hearts (or `cap` maps). */
export function simulateStreak(seed: string, p: PairProfile, rng: Rng, cap = 30): StreakSimResult {
  let hearts: number = TUNING.hearts;
  let escapes = 0;
  let seals = 0;
  for (let i = 0; i < Math.min(cap, MAX_STREAK_MAPS); i++) {
    const game = streakGame(seed, i);
    const r = simulatePair(game, p, rng, { hearts, level: i + escapes * TUNING.streak.escapeBump });
    seals += r.seals;
    if (!r.won) return { maps: i, seals, escapes };
    if (r.escaped) {
      escapes++;
      hearts = TUNING.streak.heartsAfterEscape;
    } else hearts = r.hearts;
  }
  return { maps: Math.min(cap, MAX_STREAK_MAPS), seals, escapes };
}

/** The pair plays the trial at `st` until the seal opens or the expedition ends. */
function playTrial(game: Game, start: PlayState, st: Station, p: PairProfile, rng: Rng): PlayState {
  let s = start;
  const won = () => s.lost || !!(s.seals & (1 << st.index));
  if (st.kind === "lock") {
    const t = lockTrial(st.key);
    const fromClues = allCombos(t.glyphCount, t.slots, t.repeats).filter((c) => t.clues.every((k) => clueHolds(k, c)));
    let known = fromClues;
    for (let i = 0; i < 40 && !won(); i++) {
      const pool = rng.chance(p.lockSloppy) ? fromClues : known;
      const guess = pool[rng.int(pool.length)];
      s = tryLock(game, s, st.index, guess)!.state;
      const fb = scoreGuess(t.secret, guess);
      known = known.filter((c) => sameFeedback(scoreGuess(c, guess), fb, t.feedback));
    }
  } else if (st.kind === "piano" || st.kind === "tangram") {
    // How many wrong answers before the right one.
    let miss = st.kind === "piano" ? p.pianoMiss : p.tangramMiss;
    let misses = 0;
    while (misses < 9 && rng.chance(miss)) {
      misses++;
      miss *= TRIAL_LEARN;
    }
    if (guideActs(st)) {
      s = typeKey(game, s, st, misses, p, rng);
    } else if (st.kind === "piano") {
      const t = stationPiano(st);
      const wrong = t.melody.map((k, i) => (i === 0 ? (k + 1) % t.keys.length : k));
      for (let i = 0; i < misses && !won(); i++) s = checkMelody(game, s, st.index, wrong)!.state;
      if (!won()) s = checkMelody(game, s, st.index, t.melody)!.state;
    } else {
      const t = stationTangram(st);
      const wrong = [t.solution[0]];
      for (let i = 0; i < misses && !won(); i++) s = checkTangramAt(game, s, st.index, wrong)!.state;
      if (!won()) s = checkTangramAt(game, s, st.index, t.solution)!.state;
    }
  } else if (st.direction === "B") {
    const t = stationFigures(game, st);
    while (!won()) {
      const wrong = t.candidates.map((_, i) => i).filter((i) => i !== t.correct && !s.trials[st.index].wrong.includes(i));
      const pick = wrong.length > 0 && rng.chance(p.figMiss) ? rng.pick(wrong) : t.correct;
      s = chooseFigure(game, s, st.index, pick)!.state;
    }
  } else {
    let guideFails = 0;
    while (guideFails < 9 && rng.chance(p.figMiss)) guideFails++;
    s = typeKey(game, s, st, guideFails, p, rng);
  }
  return s;
}

/** The guide dictates the key carrying `guideFails`; the explorer may mishear it. */
function typeKey(game: Game, start: PlayState, st: Station, guideFails: number, p: PairProfile, rng: Rng): PlayState {
  let s = start;
  const won = () => s.lost || !!(s.seals & (1 << st.index));
  const key = sealKey(game.seed, game.stations!.length, st.index, guideFails);
  while (!won() && rng.chance(p.keyTypo)) {
    const at = rng.int(key.length - 1);
    const typo = key.slice(0, at) + (key[at] === "A" ? "B" : "A") + key.slice(at + 1);
    s = enterSealKey(game, s, st.index, typo)!.state;
  }
  if (!won()) s = enterSealKey(game, s, st.index, key)!.state;
  return s;
}

function unknownPitBeside(game: Game, s: PlayState, rng: Rng, chance: number): Dir | null {
  for (const d of DIRS) {
    if (!isOpen(game.grid, s.cell, d)) continue;
    const n = neighbor(game.grid, s.cell, d);
    if (game.occupant[n]?.type === "pit" && !(s.memo[n] & PIT_KNOWN) && rng.chance(chance)) return d;
  }
  return null;
}
