import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlay, encodeCode, fingerprint, stepPlay } from "@/src/engine";
import { type LiveGame, clearLive, loadLive, otherRole, resumeSession, saveLive, sealOf, startSession } from "../session";

/**
 * Both devices build their game from the code alone. These tests play the two
 * sides: one creates, the other types what was dictated (any capitalization,
 * spaces, dashes, sound-alike letters) — they must end up with the same maze.
 */

const code = encodeCode({ mode: "duo", seed: "S22RXB" });

describe("same code → same game on the guide's and the explorer's device", () => {
  const guide = startSession(code, "guide", true, true);
  const typed = `  ${code.slice(0, 4).toLowerCase()} - ${code.slice(4).toLowerCase()} `;
  const explorer = startSession(typed, "explorer", false, false);

  it("normalizes what was typed to the same canonical code", () => {
    expect(explorer.code).toBe(guide.code);
    expect(explorer.mode).toBe("duo");
  });

  it("every round is the identical maze (fingerprint and seal)", () => {
    expect(explorer.games).toHaveLength(3);
    expect(explorer.games.map(fingerprint)).toEqual(guide.games.map(fingerprint));
    expect(sealOf(explorer.games)).toBe(sealOf(guide.games));
  });

  it("the explorer's moves are judged on that same maze", () => {
    const g = explorer.games[0];
    const a = stepPlay(g, createPlay(g, 0), 1, 0);
    const b = stepPlay(guide.games[0], createPlay(guide.games[0], 0), 1, 0);
    expect(a.outcome).toBe(b.outcome);
    expect(a.state.cell).toBe(b.state.cell);
  });

  it("sound-alike letters still land on the same game (V→B, N→M)", () => {
    const withB = encodeCode({ mode: "easy", seed: "B2M2B2" });
    const spoken = withB.replace(/B/g, "v").replace(/M/g, "n");
    expect(fingerprint(startSession(spoken, "guide", true, false).games[0])).toBe(fingerprint(startSession(withB, "explorer", true, true).games[0]));
  });

  it("rejects a mistyped code instead of building a different maze", () => {
    const wrong = code.slice(0, 3) + (code[3] === "2" ? "3" : "2") + code.slice(4);
    expect(() => startSession(wrong, "explorer", true, false)).toThrow(/no cuadra/);
  });

  it("roles swap", () => {
    expect(otherRole("guide")).toBe("explorer");
    expect(otherRole("explorer")).toBe("guide");
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
  const live: LiveGame = { code, role: "explorer", round: 1, timed: true, creator: false, startedAt: 1_000_000, rounds: [] };

  it("saves and restores the round in progress with its clock", () => {
    memorySession();
    saveLive(live);
    const back = loadLive(1_000_000 + 60_000);
    expect(back).toEqual(live);
    const s = resumeSession(back!);
    expect(s.round).toBe(1);
    expect(fingerprint(s.games[1])).toBe(fingerprint(startSession(code, "guide", true, true).games[1]));
    clearLive();
    expect(loadLive(1_000_000)).toBeNull();
  });

  it("ignores stale, broken or tampered saves", () => {
    const store = memorySession();
    saveLive(live);
    expect(loadLive(live.startedAt + 4 * 3600_000)).toBeNull(); // too old
    store["laberinto.live.v1"] = "{oops";
    expect(loadLive(live.startedAt)).toBeNull();
    saveLive({ ...live, round: 7 });
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
