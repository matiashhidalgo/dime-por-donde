import {
  CODE_ALPHABET,
  type CodeMode,
  type Game,
  DIFFICULTIES,
  THEMES,
  fingerprint,
  formatCode,
  gamesForCode,
  type RelayState,
  TUNING,
  hashString,
  isStreakCode,
  parseCode,
  streakGame,
  streakRole,
} from "@/src/engine";
import type { Role } from "@/lib/history";

/** Everything one device knows about the expedition being played. */
export interface Session {
  code: string;
  /** The code's mode. New codes are always "hard"; older ones still play (v2 rules). */
  mode: CodeMode;
  game: Game;
  role: Role;
  creator: boolean;
  /** Racha codes only: where this device is in the streak. */
  streak?: StreakInfo;
}

/**
 * A Racha as one device knows it (GAME_SPEC_V2.md anexo etapa 3). The
 * explorer's device measures each map; the other device learns the numbers
 * from the relay key (or the honor fallback).
 */
export interface StreakInfo {
  /** Map being played or about to be (0-based). */
  index: number;
  /** This device's role on map 0: roles swap on every map, always. */
  firstRole: Role;
  /** Hearts the current map starts with. */
  hearts: number;
  /** Emergency exits so far (each one raises the PLAY level). */
  escapes: number;
  /** Seals won over the whole streak, before the current map. */
  seals: number;
  /** Hearts lost over the whole streak, before the current map. */
  heartsLost: number;
}

export const newStreak = (firstRole: Role): StreakInfo => ({ index: 0, firstRole, hearts: TUNING.hearts, escapes: 0, seals: 0, heartsLost: 0 });

/** This device's role on the streak's current map. */
export const streakRoleOf = (st: StreakInfo): Role => streakRole(st.firstRole, otherRole(st.firstRole), st.index);

/** What the explorer's device starts the map with: hearts carried in and the PLAY level. */
export const streakPlay = (st: StreakInfo) => ({ hearts: st.hearts, level: st.index + st.escapes * TUNING.streak.escapeBump });

/**
 * The relay state the explorer's device reports when map `st.index` ends.
 * After an emergency exit the streak goes on with `heartsAfterEscape`.
 */
export function relayFor(st: StreakInfo, o: { result: RelayState["result"]; hearts: number; seals: number; hurts: number }): RelayState {
  const hearts = o.result === "lost" ? 0 : o.result === "escaped" ? Math.max(1, Math.min(o.hearts, TUNING.streak.heartsAfterEscape)) : o.hearts;
  return {
    index: st.index,
    hearts,
    result: o.result,
    escapes: Math.min(15, st.escapes + (o.result === "escaped" ? 1 : 0)),
    seals: Math.min(255, st.seals + o.seals),
    heartsLost: Math.min(127, st.heartsLost + o.hurts),
  };
}

/** The streak after map `r.index`, pointing at the next one. */
export const advanceStreak = (st: StreakInfo, r: RelayState): StreakInfo => ({
  ...st,
  index: r.index + 1,
  hearts: r.hearts,
  escapes: r.escapes,
  seals: r.seals,
  heartsLost: r.heartsLost,
});

/**
 * Builds the expedition from a code. v2 plays one Difícil map: codes made
 * before v2 still work — an easy/medium code plays its own map with the new
 * rules, and an old duo code plays its last (hard) round.
 */
export function startSession(code: string, role: Role, creator: boolean, streak?: StreakInfo): Session {
  const parsed = parseCode(code);
  if (!parsed.ok) throw new Error(parsed.message);
  if (isStreakCode(parsed.value)) {
    const st = streak ?? newStreak(role);
    return { code: parsed.value.code, mode: parsed.value.mode, game: streakGame(parsed.value.seed, st.index), role: streakRoleOf(st), creator, streak: st };
  }
  const games = gamesForCode(parsed.value);
  return { code: parsed.value.code, mode: parsed.value.mode, game: games[games.length - 1], role, creator };
}

export const otherRole = (r: Role): Role => (r === "guide" ? "explorer" : "guide");

/** Only shown for codes made before v2 («código anterior»). */
export const LEGACY_MODE_NAME: Record<CodeMode, string> = {
  easy: "Fácil",
  medium: "Medio",
  hard: "Difícil",
  duo: "Dúo",
};

/**
 * Bump whenever the rules change for codes an older deploy also accepts. A v1
 * code builds the same maze on every deploy, but the rules around it changed;
 * mixing this into the seal makes an old and a new device read different
 * seals, so the pair notices before playing.
 *  3: Racha, curses, graded endings. 4: piano and tangram join the stations
 *  (the same v2 code can draw different trials than under 3). 5: La Sombra (the
 *  same v2 code now also draws a patrol, plus the «esperar» action and the touch
 *  rules; a device still on 4 plays the same maze and stations without it, and
 *  reads a different seal). v1 codes get no Sombra, but their seal changes too.
 */
export const RULES_VERSION = 5;

/**
 * A short phrase both players read aloud to confirm they have the same maze
 * and rules: theme + 4 characters from the game fingerprint and
 * RULES_VERSION ("Bosque · 7F3K"), written in the code alphabet so there's
 * no 0/O or 1/I to mishear.
 */
export function sealOf(g: Game): string {
  let n = hashString(`${fingerprint(g)}|reglas${RULES_VERSION}`);
  let tag = "";
  for (let i = 0; i < 4; i++) {
    tag += CODE_ALPHABET[n % CODE_ALPHABET.length];
    n = Math.floor(n / CODE_ALPHABET.length);
  }
  return `${THEMES[g.theme].name} · ${tag}`;
}

export function describeGame(g: Game): string {
  if (g.streak) return `Racha · mapa ${g.streak.index + 1} · ${THEMES[g.theme].name}`;
  const d = DIFFICULTIES[g.level];
  return `${d.name} · ${g.grid.width}×${g.grid.height} · ${THEMES[g.theme].name}`;
}

export { formatCode };

/**
 * The expedition in progress, kept per tab (sessionStorage) so an accidental
 * reload can pick it back up. The explorer's position is not kept: they
 * restart from the entrance with full hearts (a reload is not a strategy:
 * the guide sees it as a fresh start too).
 */
export interface LiveGame {
  code: string;
  role: Role;
  creator: boolean;
  startedAt: number;
  /** Racha: the streak as this device knows it, and where between maps it was. */
  streak?: StreakInfo;
  /**
   * "play" = mid-map; "relay" = the explorer showing the key (`relay` is what
   * it encodes) or the guide about to type it (`guess` = what the guide
   * confirmed); "next" = the transition screen of map `streak.index`.
   */
  phase?: "play" | "relay" | "next";
  relay?: RelayState;
  guess?: RelayState["result"];
}

const LIVE_KEY = "laberinto.live.v2";
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
      typeof l.startedAt === "number" &&
      now - l.startedAt < LIVE_MAX_AGE_MS &&
      parseCode(l.code).ok;
    if (!ok) return null;
    const live: LiveGame = { code: l.code, role: l.role, creator: !!l.creator, startedAt: l.startedAt };
    const st = l.streak;
    if (st && typeof st === "object" && [st.index, st.hearts, st.escapes, st.seals, st.heartsLost].every((n) => Number.isInteger(n) && n >= 0) && (st.firstRole === "guide" || st.firstRole === "explorer")) {
      live.streak = { index: st.index, firstRole: st.firstRole, hearts: st.hearts, escapes: st.escapes, seals: st.seals, heartsLost: st.heartsLost };
      live.phase = l.phase === "relay" || l.phase === "next" ? l.phase : "play";
      if (l.relay && typeof l.relay === "object") live.relay = l.relay;
      if (l.guess === "won" || l.guess === "escaped" || l.guess === "lost") live.guess = l.guess;
    }
    return live;
  } catch {
    return null;
  }
}

/** Rebuilds the session a saved expedition belongs to. */
export function resumeSession(live: LiveGame): Session {
  return startSession(live.code, live.role, live.creator, live.streak);
}
