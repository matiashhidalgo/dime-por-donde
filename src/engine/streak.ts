import { CODE_ALPHABET, type GameCode, normalizeCodeInput } from "./code";
import { generateGame } from "./generate";
import { DIRS, bfs, isOpen, neighbor } from "./grid";
import { createRng, hashString } from "./rng";
import { solve } from "./solver";
import { withStations } from "./stations";
import { THEME_IDS, type ThemeId } from "./themes";
import { TUNING } from "./tuning";
import type { Game } from "./types";

/**
 * Racha (GAME_SPEC_V2.md §6, anexo etapa 3): expeditions chained under ONE
 * game code. Map i is derived from the code and i alone, so both devices
 * build the next map without dictating anything. Roles swap on every map.
 *
 * What changes hands between maps is the explorer's state (hearts, totals):
 * the explorer's device shows a RELAY KEY when a map ends, and the next
 * explorer (the guide until now) types it.
 */

/** In v2 the header slot that v1 used for «Dúo» means «Racha». */
export const isStreakCode = (info: Pick<GameCode, "version" | "mode">) => info.version >= 2 && info.mode === "duo";

export const MAX_STREAK_MAPS = 64;

/** The role a device plays on map i, given its role on map 0. Always swaps. */
export const streakRole = <R extends string>(first: R, other: R, index: number): R => (index % 2 === 0 ? first : other);

// ── Maps ─────────────────────────────────────────────────────────────────────

const themeCache = new Map<string, ThemeId>();

/** Theme of map i: drawn per map, never the one the map before used. */
export function streakTheme(seed: string, index: number): ThemeId {
  const id = `${seed}|${index}`;
  const hit = themeCache.get(id);
  if (hit) return hit;
  const prev = index > 0 ? streakTheme(seed, index - 1) : null;
  const rng = createRng(`${seed}|streak|theme|${index}`);
  const theme = rng.pick(THEME_IDS.filter((t) => t !== prev));
  if (themeCache.size > 512) themeCache.clear();
  themeCache.set(id, theme);
  return theme;
}

/** Pit change on map i (MAP level: both devices use it). Negative = pits removed. */
export const pitDeltaFor = (index: number) => {
  const { atStart, perMap, cap } = TUNING.streak.pits;
  return Math.min(cap, Math.round(atStart + index * perMap));
};

/** Never thin a map below this many pits. */
const MIN_PITS = 6;

/** Figures hardness on map i (0–2, MAP level). */
export function figureHardness(game: Game): number {
  const i = game.streak?.index;
  if (i === undefined) return 0;
  const { figuresHarderFrom: a, figuresHardestFrom: b } = TUNING.streak;
  return b > 0 && i >= b ? 2 : a > 0 && i >= a ? 1 : 0;
}

const mapCache = new Map<string, Game>();

/**
 * Map i of the streak `seed`: generator v1 on `seed#r{i}` with the streak
 * theme, extra pits off the route, then the v2 stations (whose audit re-proves
 * no soft-lock with the new pits). A map that can't host them moves on to the
 * next seed variant, like v2 does.
 */
export function streakGame(seed: string, index: number): Game {
  const id = `${seed}|${index}`;
  const hit = mapCache.get(id);
  if (hit) return hit;
  const theme = streakTheme(seed, index);
  for (let variant = 0; ; variant++) {
    const mapSeed = `${seed}#r${index}${variant === 0 ? "" : `~${variant}`}`;
    const base = generateGame({ seed: mapSeed, level: "hard", version: 1, theme });
    const delta = pitDeltaFor(index);
    const pitted = delta < 0 ? withFewerPits(base, -delta, `${mapSeed}|streak|pits`) : withExtraPits(base, delta, `${mapSeed}|streak|pits`);
    const game = withStations({ ...pitted, version: 2, streak: { index } });
    if (game) {
      if (mapCache.size > 8) mapCache.clear();
      mapCache.set(id, game);
      return game;
    }
  }
}

/**
 * Removes `count` pits (never below MIN_PITS), drawn uniformly. Taking a pit
 * away only opens floor, so it can't break solvability; the stations audit
 * runs afterwards anyway.
 */
export function withFewerPits(base: Game, count: number, key: string): Game {
  const n = Math.max(0, Math.min(count, base.pits.length - MIN_PITS));
  if (n === 0) return base;
  const gone = new Set(createRng(key).shuffle(base.pits).slice(0, n));
  const occupant = base.occupant.map((o, c) => (gone.has(c) ? null : o));
  return resolved(base, occupant, base.pits.filter((c) => !gone.has(c)));
}

/** The map with its pits changed, re-solved (a removed pit can open a shortcut). */
function resolved(base: Game, occupant: Game["occupant"], pits: number[]): Game {
  const sol = solve({ grid: base.grid, ice: base.ice, occupant, portals: base.portals }, base.start, base.exit);
  return {
    ...base,
    occupant,
    pits,
    solution: { moves: sol.moves, route: sol.route },
    stats: { ...base.stats, pits: pits.length, solutionMoves: sol.moves, solutionCells: sol.route.length - 1 },
  };
}

/**
 * Adds up to `count` pits beside (never on) the solver's route. Each one must
 * leave the exit solvable without soft-locks and every item reachable;
 * otherwise it's skipped. Deterministic from `key`.
 */
export function withExtraPits(base: Game, count: number, key: string): Game {
  if (count <= 0) return base;
  const occupant = base.occupant.slice();
  const pits = base.pits.slice();
  const onRoute = new Set(base.solution.route);
  const fromStart = bfs(base.grid, base.start);
  const landmarkCells = new Set(base.landmarks.map((l) => l.cell));
  const guarded = new Set(["start", "exit", "checkpoint", "door", "portal", "pit", "key"]);
  const nearRoute = (c: number) => DIRS.some((d) => isOpen(base.grid, c, d) && onRoute.has(neighbor(base.grid, c, d)));
  const items = () =>
    occupant.flatMap((o, c) => (o && (o.type === "key" || o.type === "lantern" || o.type === "star" || o.type === "checkpoint") ? [c] : []));

  let cands: number[] = [];
  for (let c = 0; c < occupant.length; c++) {
    if (occupant[c] || base.ice[c] || onRoute.has(c) || landmarkCells.has(c) || fromStart[c] < 3) continue;
    const ns = DIRS.filter((d) => isOpen(base.grid, c, d)).map((d) => neighbor(base.grid, c, d));
    if (ns.some((n) => base.ice[n] || guarded.has(occupant[n]?.type ?? ""))) continue;
    cands.push(c);
  }
  const rng = createRng(key);
  // Pits next to the route are the ones that bite; the rest mostly guard detours.
  const weight = (c: number) => (nearRoute(c) ? 3 : 1);
  let added = 0;
  for (let budget = count * 8; added < count && cands.length > 0 && budget > 0; budget--) {
    const total = cands.reduce((s, c) => s + weight(c), 0);
    let r = rng.next() * total;
    let pick = cands[cands.length - 1];
    for (const c of cands) {
      r -= weight(c);
      if (r <= 0) {
        pick = c;
        break;
      }
    }
    cands = cands.filter((x) => x !== pick);
    if (DIRS.some((d) => isOpen(base.grid, pick, d) && occupant[neighbor(base.grid, pick, d)]?.type === "pit")) continue;
    occupant[pick] = { type: "pit" };
    const sol = solve({ grid: base.grid, ice: base.ice, occupant, portals: base.portals }, base.start, base.exit);
    if (sol.solvable && sol.deadStates === 0 && items().every((c) => sol.reachable[c])) {
      pits.push(pick);
      added++;
    } else {
      occupant[pick] = null;
    }
  }
  return resolved(base, occupant, pits);
}

// ── Relay key ────────────────────────────────────────────────────────────────

export type MapResult = "won" | "escaped" | "lost";
const RESULTS: readonly MapResult[] = ["won", "escaped", "lost"];

/** What travels from one explorer to the next. */
export interface RelayState {
  /** Map that just ended (0-based). */
  index: number;
  /** Hearts the next map starts with (0 = the streak is over). */
  hearts: number;
  result: MapResult;
  /** Emergency exits so far (raises the PLAY level). */
  escapes: number;
  /** Seals won over the whole streak. */
  seals: number;
  /** Hearts lost over the whole streak. */
  heartsLost: number;
}

export const RELAY_KEY_LENGTH = 9;
const BASE = CODE_ALPHABET.length;
const PAYLOAD = 6;
const SPACE = BASE ** PAYLOAD; // 594,823,321 > 2^29
const FIELDS = [
  ["index", 64],
  ["hearts", 4],
  ["result", 3],
  ["escapes", 16],
  ["seals", 256],
  ["heartsLost", 128],
] as const;

const mask = (code: string) => hashString(`${code}|relay|mask`) % SPACE;
const sign = (code: string, index: number, value: number) => hashString(`${code}|relay|${index}|${value}`) % (BASE * BASE);

function checksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
  return CODE_ALPHABET[sum % BASE];
}

function digits(n: number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out = CODE_ALPHABET[n % BASE] + out;
    n = Math.floor(n / BASE);
  }
  return out;
}

const undigits = (s: string) => [...s].reduce((n, ch) => n * BASE + CODE_ALPHABET.indexOf(ch), 0);

function pack(r: RelayState): number {
  const vals: Record<string, number> = { ...r, result: RESULTS.indexOf(r.result) };
  let n = 0;
  for (const [name, size] of FIELDS) n = n * size + Math.max(0, Math.min(size - 1, Math.floor(vals[name])));
  return n;
}

function unpack(n: number): RelayState | null {
  const vals: Record<string, number> = {};
  for (const [name, size] of [...FIELDS].reverse()) {
    vals[name] = n % size;
    n = Math.floor(n / size);
  }
  if (n !== 0 || vals.result >= RESULTS.length || vals.hearts > TUNING.hearts) return null;
  return {
    index: vals.index,
    hearts: vals.hearts,
    result: RESULTS[vals.result],
    escapes: vals.escapes,
    seals: vals.seals,
    heartsLost: vals.heartsLost,
  };
}

/** The relay key for `state`, bound to this streak's game code. */
export function encodeRelay(code: string, state: RelayState): string {
  const value = pack(state);
  const body = digits((value + mask(code)) % SPACE, PAYLOAD) + digits(sign(code, state.index, value), 2);
  return body + checksum(body);
}

export const formatRelayKey = (k: string) => `${k.slice(0, 3)}-${k.slice(3, 6)}-${k.slice(6)}`;

export type RelayCheck = { ok: true; value: RelayState } | { ok: false; error: "input" | "checksum" | "other-map" | "other-streak"; message: string };

/** Reads a typed relay key for the map that just ended (`expectedIndex`). */
export function decodeRelay(code: string, expectedIndex: number, input: string): RelayCheck {
  const { text } = normalizeCodeInput(input);
  if (!text) return { ok: false, error: "input", message: "Escribe la clave de relevo que te dicta tu compañero." };
  const bad = [...text].find((c) => !CODE_ALPHABET.includes(c));
  if (bad) return { ok: false, error: "input", message: `La «${bad}» no existe en las claves. Que te la deletree.` };
  if (text.length !== RELAY_KEY_LENGTH) {
    return { ok: false, error: "input", message: `La clave de relevo tiene ${RELAY_KEY_LENGTH} caracteres y llevas ${text.length}.` };
  }
  if (checksum(text.slice(0, -1)) !== text[RELAY_KEY_LENGTH - 1]) {
    return { ok: false, error: "checksum", message: "Esa clave no cuadra: hay una letra cambiada. Que te la repita de a tres." };
  }
  const value = (undigits(text.slice(0, PAYLOAD)) - mask(code) + SPACE) % SPACE;
  const state = unpack(value);
  if (!state || sign(code, state.index, value) !== undigits(text.slice(PAYLOAD, PAYLOAD + 2))) {
    return { ok: false, error: "other-streak", message: "Esa clave es de otra racha. ¿Están jugando con el mismo código?" };
  }
  if (state.index !== expectedIndex) {
    return {
      ok: false,
      error: "other-map",
      message: `Esa clave es del mapa ${state.index + 1}, y acaban de terminar el ${expectedIndex + 1}. Pídele la más nueva.`,
    };
  }
  return { ok: true, value: state };
}
