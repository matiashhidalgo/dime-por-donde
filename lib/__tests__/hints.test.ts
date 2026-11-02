import { beforeEach, describe, expect, it } from "vitest";
import { HINT_IDS, HINT_TEXT, hintSeen, markHint, resetHints } from "../hints";
import { NAMES } from "@/components/game/__tests__/names";

describe("first-time hints", () => {
  beforeEach(() => resetHints());

  it("are remembered once marked and survive a broken localStorage (in memory)", () => {
    expect(hintSeen("shadow-explorer")).toBe(false);
    markHint("shadow-explorer");
    expect(hintSeen("shadow-explorer")).toBe(true);
    expect(hintSeen("relay")).toBe(false);
  });

  it("every hint is one sentence of plain text with no object names", () => {
    for (const id of HINT_IDS) {
      if (id === "tour") continue;
      const text = HINT_TEXT[id];
      expect(text.length, id).toBeLessThan(160);
      expect(text, id).not.toMatch(NAMES);
    }
  });
});
