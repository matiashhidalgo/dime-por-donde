/**
 * localStorage that never throws. Private windows, blocked cookies or a full
 * quota just fall back to memory for this tab — the game keeps working.
 */

const memory = new Map<string, string>();
let persistent: boolean | null = null;

function ls(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    if (persistent === null) {
      const probe = "__laberinto_probe__";
      s.setItem(probe, "1");
      s.removeItem(probe);
      persistent = true;
    }
    return s;
  } catch {
    persistent = false;
    return null;
  }
}

/** False when saves only live until the tab closes. */
export function storageIsPersistent(): boolean {
  ls();
  return persistent === true;
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = ls()?.getItem(key) ?? memory.get(key) ?? null;
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    ls()?.setItem(key, raw);
  } catch {
    // Quota or privacy mode: the in-memory copy still serves this session.
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  try {
    ls()?.removeItem(key);
  } catch {
    // ignore
  }
}
