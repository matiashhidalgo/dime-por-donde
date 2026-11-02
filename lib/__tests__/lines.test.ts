import { describe, expect, it } from "vitest";
import { createRng } from "@/src/engine";
import { createPicker } from "../lines";

describe("lines: shuffle bags", () => {
  const pool = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("every window of n draws shows every line once; the next bag never starts with the last line", () => {
    const rng = createRng("bag");
    const p = createPicker(() => rng.next());
    const seen: string[] = [];
    for (let i = 0; i < pool.length * 40; i++) seen.push(p.pick("k", pool));
    for (let b = 0; b < 40; b++) expect(new Set(seen.slice(b * pool.length, (b + 1) * pool.length)).size).toBe(pool.length);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it("kinds are independent, one-line kinds just repeat", () => {
    const p = createPicker(() => 0.3);
    expect(p.pick("x", ["solo"])).toBe("solo");
    expect(p.pick("x", ["solo"])).toBe("solo");
    const a = p.pick("a", pool);
    const b = p.pick("b", pool);
    expect(typeof a + typeof b).toBe("stringstring");
  });

  it("combo multiplies the variety: openers × tails distinct sentences, no back-to-back repeats", () => {
    const rng = createRng("combo");
    const p = createPicker(() => rng.next());
    const openers = ["1", "2", "3", "4"];
    const tails = ["x", "y", "z", "w", "v"];
    const out = new Set<string>();
    let prev = "";
    for (let i = 0; i < 400; i++) {
      const line = p.combo("c", openers, tails);
      expect(line).not.toBe(prev);
      prev = line;
      out.add(line);
    }
    expect(out.size).toBe(openers.length * tails.length);
  });
});
