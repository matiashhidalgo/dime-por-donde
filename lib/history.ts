import type { CodeMode, Level } from "@/src/engine";
import { readJSON, writeJSON } from "./storage";

/** One finished (or abandoned) round, as this device saw it. */
export interface HistoryEntry {
  id: string;
  code: string;
  mode: CodeMode;
  level: Level;
  /** 1-based; always 1 outside duo mode. */
  round: number;
  role: Role;
  /** ISO date. */
  date: string;
  result: "won" | "abandoned";
  /** null in "sin tiempo" mode or when abandoned. */
  timeMs: number | null;
  pits: number;
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

export const ROLE_NAME: Record<Role, string> = { explorer: "Explorador", guide: "Guía" };
