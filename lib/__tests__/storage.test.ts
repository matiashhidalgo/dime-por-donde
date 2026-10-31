import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The game must keep working when localStorage is blocked (private mode,
 * cookies off), full, or holding garbage. storage.ts caches whether storage
 * works, so every case loads a fresh copy of the modules.
 */

type Store = Record<string, string>;

function fakeStorage(store: Store, opts: { quotaFull?: boolean } = {}): Storage {
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      if (opts.quotaFull && !k.startsWith("__")) throw new DOMException("full", "QuotaExceededError");
      store[k] = String(v);
    },
    removeItem: (k) => void delete store[k],
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
    key: (i) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

async function load(win: object) {
  vi.resetModules();
  vi.stubGlobal("window", win);
  const storage = await import("../storage");
  const history = await import("../history");
  return { ...storage, ...history };
}

const entry = (id: string, code = "54UXRW9T") => ({
  id,
  code,
  mode: "easy" as const,
  level: "easy" as const,
  round: 1,
  role: "guide" as const,
  date: "2026-10-31T00:00:00.000Z",
  result: "won" as const,
  timeMs: 1000,
  pits: 0,
  stars: 1,
  rating: 3,
});

afterEach(() => vi.unstubAllGlobals());

describe("storage that never throws", () => {
  it("works normally when localStorage works", async () => {
    const store: Store = {};
    const s = await load({ localStorage: fakeStorage(store) });
    s.writeJSON("k", { a: 1 });
    expect(s.readJSON("k", null)).toEqual({ a: 1 });
    expect(JSON.parse(store.k)).toEqual({ a: 1 });
    expect(s.storageIsPersistent()).toBe(true);
  });

  it("blocked storage (getter throws): falls back to memory for this tab", async () => {
    const win = {};
    Object.defineProperty(win, "localStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    const s = await load(win);
    expect(s.readJSON("k", "fallback")).toBe("fallback");
    s.writeJSON("k", 42);
    expect(s.readJSON("k", 0)).toBe(42);
    expect(s.storageIsPersistent()).toBe(false);
    // History still works for the session.
    s.saveEntry(entry("a"));
    expect(s.loadHistory().map((e) => e.id)).toEqual(["a"]);
    expect(s.playedCodes().has("54UXRW9T")).toBe(true);
  });

  it("full storage (setItem throws): keeps going in memory", async () => {
    const s = await load({ localStorage: fakeStorage({}, { quotaFull: true }) });
    expect(() => s.saveEntry(entry("a"))).not.toThrow();
    expect(s.loadHistory()).toHaveLength(1);
  });

  it("garbage in storage: history comes back empty instead of crashing", async () => {
    const s1 = await load({ localStorage: fakeStorage({ "laberinto.history.v1": "{not json" }) });
    expect(s1.loadHistory()).toEqual([]);
    const s2 = await load({ localStorage: fakeStorage({ "laberinto.history.v1": '{"a":1}' }) });
    expect(s2.loadHistory()).toEqual([]);
  });

  it("history replaces by id, newest first, and remembers the last play of a code", async () => {
    const s = await load({ localStorage: fakeStorage({}) });
    s.saveEntry(entry("a", "AAAA2222"));
    s.saveEntry(entry("b", "BBBB2222"));
    s.saveEntry({ ...entry("a", "AAAA2222"), stars: 3 });
    expect(s.loadHistory().map((e) => e.id)).toEqual(["a", "b"]);
    expect(s.lastPlayed("AAAA2222")?.stars).toBe(3);
    expect(s.lastPlayed("ZZZZ2222")).toBeNull();
  });

  it("on the server (no window) it just returns fallbacks", async () => {
    vi.resetModules();
    const s = await import("../storage");
    expect(s.readJSON("k", "x")).toBe("x");
    expect(() => s.writeJSON("k", 1)).not.toThrow();
  });
});
