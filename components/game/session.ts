import {
  CODE_ALPHABET,
  type CodeMode,
  type Game,
  DIFFICULTIES,
  THEMES,
  fingerprint,
  formatCode,
  gamesForCode,
  parseCode,
} from "@/src/engine";
import type { Level } from "@/src/engine";
import type { Role } from "@/lib/history";

/** One finished round, kept in memory for the duo summary. */
export interface RoundRecord {
  round: number;
  role: Role;
  level: Level;
  timeMs: number | null;
  pits: number;
  stars: number;
  rating: number;
}

/** Everything one device knows about the match being played. */
export interface Session {
  code: string;
  mode: CodeMode;
  games: Game[];
  /** 0-based round (duo has 3). */
  round: number;
  /** Role in the CURRENT round. */
  role: Role;
  timed: boolean;
  creator: boolean;
}

export function startSession(code: string, role: Role, timed: boolean, creator: boolean): Session {
  const parsed = parseCode(code);
  if (!parsed.ok) throw new Error(parsed.message);
  return {
    code: parsed.value.code,
    mode: parsed.value.mode,
    games: gamesForCode(parsed.value),
    round: 0,
    role,
    timed,
    creator,
  };
}

export const otherRole = (r: Role): Role => (r === "guide" ? "explorer" : "guide");

export const MODE_NAME: Record<CodeMode, string> = {
  easy: "Fácil",
  medium: "Medio",
  hard: "Difícil",
  duo: "Dúo de 3 rondas",
};

/**
 * A short phrase both players read aloud to confirm they have the same maze:
 * theme + 4 characters of the game fingerprint ("Bosque · 7F3K"), written in
 * the code alphabet so there's no 0/O or 1/I to mishear.
 */
export function sealOf(games: Game[]): string {
  const g = games[0];
  let n = parseInt(fingerprint(g).slice(0, 8), 16);
  let tag = "";
  for (let i = 0; i < 4; i++) {
    tag += CODE_ALPHABET[n % CODE_ALPHABET.length];
    n = Math.floor(n / CODE_ALPHABET.length);
  }
  return `${THEMES[g.theme].name} · ${tag}`;
}

export function describeGame(g: Game): string {
  const d = DIFFICULTIES[g.level];
  return `${d.name} · ${g.grid.width}×${g.grid.height} · ${THEMES[g.theme].name}`;
}

export { formatCode };

/**
 * The round in progress, kept per tab (sessionStorage) so an accidental reload
 * can pick it back up with the same clock. The explorer's position is not
 * kept: they restart from the entrance.
 */
export interface LiveGame {
  code: string;
  role: Role;
  round: number;
  timed: boolean;
  creator: boolean;
  startedAt: number;
  rounds: RoundRecord[];
}

const LIVE_KEY = "laberinto.live.v1";
const LIVE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export function saveLive(live: LiveGame): void {
  try {
    sessionStorage.setItem(LIVE_KEY, JSON.stringify(live));
  } catch {
    // private mode / quota: resuming is a nicety
  }
}

export function clearLive(): void {
  try {
    sessionStorage.removeItem(LIVE_KEY);
  } catch {
    // ignore
  }
}

export function loadLive(now = Date.now()): LiveGame | null {
  try {
    const raw = sessionStorage.getItem(LIVE_KEY);
    if (!raw) return null;
    const l = JSON.parse(raw) as LiveGame;
    const ok =
      typeof l.code === "string" &&
      (l.role === "guide" || l.role === "explorer") &&
      Number.isInteger(l.round) &&
      typeof l.startedAt === "number" &&
      now - l.startedAt < LIVE_MAX_AGE_MS &&
      parseCode(l.code).ok;
    if (!ok) return null;
    const games = gamesForCode(l.code);
    if (l.round < 0 || l.round >= games.length) return null;
    return { ...l, rounds: Array.isArray(l.rounds) ? l.rounds : [] };
  } catch {
    return null;
  }
}

/** Rebuilds the session a saved round belongs to. */
export function resumeSession(live: LiveGame): Session {
  return { ...startSession(live.code, live.role, live.timed, live.creator), round: live.round };
}
