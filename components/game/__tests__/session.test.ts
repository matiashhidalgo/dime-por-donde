import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_ALPHABET, THEMES, createPlay, encodeCode, fingerprint, gamesForCode, parseCode, stepPlay } from "@/src/engine";
import { type LiveGame, clearLive, loadLive, otherRole, resumeSession, saveLive, sealOf, startSession } from "../session";

/**
 * Both devices build their game from the code alone. These tests play the two
 * sides: one creates, the other types what was dictated (any capitalization,
 * spaces, dashes, sound-alike letters) — they must end up with the same maze.
 */

const code = encodeCode({ mode: "hard", seed: "S22RXB" });

describe("same code → same game on the guide's and the explorer's device", () => {
  const guide = startSession(code, "guide", true);
  const typed = `  ${code.slice(0, 4).toLowerCase()} - ${code.slice(4).toLowerCase()} `;
  const explorer = startSession(typed, "explorer", false);

  it("normalizes what was typed to the same canonical code", () => {
    expect(explorer.code).toBe(guide.code);
    expect(explorer.mode).toBe("hard");
    expect(explorer.game.level).toBe("hard");
  });

  it("is the identical maze (fingerprint and seal)", () => {
    expect(fingerprint(explorer.game)).toBe(fingerprint(guide.game));
    expect(sealOf(explorer.game)).toBe(sealOf(guide.game));
  });

  it("the explorer's moves are judged on that same maze", () => {
    const g = explorer.game;
    const a = stepPlay(g, createPlay(g), 1);
    const b = stepPlay(guide.game, createPlay(guide.game), 1);
    expect(a.outcome).toBe(b.outcome);
    expect(a.state).toEqual(b.state);
  });

  it("sound-alike letters still land on the same game (V→B, N→M)", () => {
    const withB = encodeCode({ mode: "hard", seed: "B2M2B2" });
    const spoken = withB.replace(/B/g, "v").replace(/M/g, "n");
    expect(fingerprint(startSession(spoken, "guide", false).game)).toBe(fingerprint(startSession(withB, "explorer", true).game));
  });

  it("rejects a mistyped code instead of building a different maze", () => {
    const wrong = code.slice(0, 3) + (code[3] === "2" ? "3" : "2") + code.slice(4);
    expect(() => startSession(wrong, "explorer", false)).toThrow(/no cuadra/);
  });

  it("roles swap", () => {
    expect(otherRole("guide")).toBe("explorer");
    expect(otherRole("explorer")).toBe("guide");
  });
});

describe("codes made before v2 still play", () => {
  it("an easy/medium code plays its own map, with the v2 rules", () => {
    for (const mode of ["easy", "medium"] as const) {
      const old = encodeCode({ mode, seed: "KRB222", version: 1 });
      const s = startSession(old, "explorer", false);
      expect(s.mode).toBe(mode);
      const parsed = parseCode(old);
      if (!parsed.ok) throw new Error(parsed.message);
      expect(fingerprint(s.game)).toBe(fingerprint(gamesForCode(parsed.value)[0]));
      expect(createPlay(s.game).hearts).toBe(3);
    }
  });

  it("an old duo code plays its last (Difícil) round", () => {
    const duo = encodeCode({ mode: "duo", seed: "DWB222" });
    const s = startSession(duo, "guide", false);
    expect(s.mode).toBe("duo");
    expect(s.game.level).toBe("hard");
  });
});

describe("resuming after a reload", () => {
  afterEach(() => vi.unstubAllGlobals());

  const memorySession = () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
    });
    return store;
  };
  const live: LiveGame = { code, role: "explorer", creator: false, startedAt: 1_000_000 };

  it("saves and restores the expedition in progress", () => {
    memorySession();
    saveLive(live);
    const back = loadLive(1_000_000 + 60_000);
    expect(back).toEqual(live);
    const s = resumeSession(back!);
    expect(fingerprint(s.game)).toBe(fingerprint(startSession(code, "guide", true).game));
    clearLive();
    expect(loadLive(1_000_000)).toBeNull();
  });

  it("ignores stale, broken or tampered saves", () => {
    const store = memorySession();
    saveLive(live);
    expect(loadLive(live.startedAt + 4 * 3600_000)).toBeNull(); // too old
    store["laberinto.live.v2"] = "{oops";
    expect(loadLive(live.startedAt)).toBeNull();
    saveLive({ ...live, role: "pirate" as never });
    expect(loadLive(live.startedAt)).toBeNull();
    saveLive({ ...live, code: "AAAA-AAAA" });
    expect(loadLive(live.startedAt)).toBeNull();
  });

  it("never throws when sessionStorage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => saveLive(live)).not.toThrow();
    expect(loadLive()).toBeNull();
    expect(() => clearLive()).not.toThrow();
  });
});

describe("seal across deploys (RULES_VERSION)", () => {
  /** The seal exactly as the deployed v1 (commit 7bfe68c) computed it. */
  const legacySeal = (g: ReturnType<typeof gamesForCode>[0]) => {
    let n = parseInt(fingerprint(g).slice(0, 8), 16);
    let tag = "";
    for (let i = 0; i < 4; i++) {
      tag += CODE_ALPHABET[n % CODE_ALPHABET.length];
      n = Math.floor(n / CODE_ALPHABET.length);
    }
    return `${THEMES[g.theme].name} · ${tag}`;
  };

  it("a v1 code reads a different seal than on the old deploy (same maze, new rules)", () => {
    for (let i = 0; i < 200; i++) {
      const g = gamesForCode(encodeCode({ version: 1, mode: "hard", seed: `S2R${CODE_ALPHABET[i % CODE_ALPHABET.length]}${CODE_ALPHABET[(i * 7) % CODE_ALPHABET.length]}${CODE_ALPHABET[(i * 13) % CODE_ALPHABET.length]}` }))[0];
      expect(sealOf(g)).not.toBe(legacySeal(g));
      expect(sealOf(g)).toMatch(/^.+ · [A-Z0-9]{4}$/);
    }
  });
});
