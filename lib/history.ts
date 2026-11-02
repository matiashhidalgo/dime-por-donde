import type { CodeMode, Level } from "@/src/engine";
import { readJSON, writeJSON } from "./storage";

/** One finished (or abandoned) expedition, as this device saw it. */
export interface HistoryEntry {
  id: string;
  code: string;
  mode: CodeMode;
  level: Level;
  /** 1-based round of a pre-v2 duo code; always 1 in v2. */
  round: number;
  role: Role;
  /** ISO date. */
  date: string;
  /** "lost" = ran out of hearts (v2). An emergency exit is "won" + ending "escaped" (v1 deploys read this list). */
  result: "won" | "lost" | "abandoned";
  /** Stage 3+: the graded ending. */
  ending?: "won" | "escaped" | "lost";
  /** Stage 3+: seals won (v2 maps). */
  seals?: number;
  /** Racha maps: which map of the streak (0-based). */
  streakIndex?: number;
  /** Informative only in v2; null when abandoned (or a pre-v2 untimed round). */
  timeMs: number | null;
  pits: number;
  /** Hearts left at the end (v2 entries only). */
  hearts?: number;
  stars: number;
  rating: number;
}

export type Role = "explorer" | "guide";

const KEY = "laberinto.history.v1";
const MAX_ENTRIES = 200;

export function loadHistory(): HistoryEntry[] {
  const list = readJSON<HistoryEntry[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

/** Inserts or replaces (by id), newest first. */
export function saveEntry(entry: HistoryEntry): void {
  const rest = loadHistory().filter((e) => e.id !== entry.id);
  writeJSON(KEY, [entry, ...rest].slice(0, MAX_ENTRIES));
}

export function lastPlayed(code: string): HistoryEntry | null {
  return loadHistory().find((e) => e.code === code) ?? null;
}

export function playedCodes(): Set<string> {
  return new Set(loadHistory().map((e) => e.code));
}

export function newEntryId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** A whole Racha, kept apart from the expeditions so v1 deploys never see it. */
export interface StreakRecord {
  /** The streak code: one record per Racha. */
  id: string;
  code: string;
  /** ISO date of the end. */
  date: string;
  /** Maps completed (won or escaped). */
  maps: number;
  seals: number;
  heartsLost: number;
  escapes: number;
  /** "lost" = out of hearts; "abandoned" = they left mid-streak. */
  end: "lost" | "abandoned";
}

const STREAK_KEY = "laberinto.streaks.v1";

export function loadStreaks(): StreakRecord[] {
  const list = readJSON<StreakRecord[]>(STREAK_KEY, []);
  return Array.isArray(list) ? list.filter((r) => r && typeof r.maps === "number") : [];
}

export function saveStreak(record: StreakRecord): void {
  const rest = loadStreaks().filter((r) => r.id !== record.id);
  writeJSON(STREAK_KEY, [record, ...rest].slice(0, MAX_ENTRIES));
}

/** Most maps in one Racha on this device (0 if none yet). */
export const bestStreak = (except?: string): number => loadStreaks().reduce((m, r) => (r.id === except ? m : Math.max(m, r.maps)), 0);

export const ROLE_NAME: Record<Role, string> = { explorer: "Explorador", guide: "Guía" };
