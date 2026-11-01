import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_MODES,
  GENERATOR_VERSION,
  createCode,
  encodeCode,
  formatCode,
  parseCode,
} from "../code";
import { createRng } from "../rng";

const randomSeed = (rng: ReturnType<typeof createRng>) =>
  Array.from({ length: 6 }, () => rng.pick([...CODE_ALPHABET])).join("");

function sampleCodes(n: number): string[] {
  const rng = createRng("codes");
  return Array.from({ length: n }, (_, i) => encodeCode({ mode: CODE_MODES[i % 4], seed: randomSeed(rng) }));
}

describe("alphabet", () => {
  it("has 29 unique, unambiguous symbols", () => {
    expect(CODE_ALPHABET).toHaveLength(29);
    expect(new Set(CODE_ALPHABET).size).toBe(29);
    for (const bad of "01OILVN") expect(CODE_ALPHABET).not.toContain(bad);
  });
});

describe("encode / parse", () => {
  it("round-trips mode, version and seed", () => {
    const rng = createRng("roundtrip");
    for (const mode of CODE_MODES) {
      for (let i = 0; i < 200; i++) {
        const seed = randomSeed(rng);
        const code = encodeCode({ mode, seed });
        expect(code).toHaveLength(CODE_LENGTH);
        const parsed = parseCode(code);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value).toEqual({ code, version: GENERATOR_VERSION, mode, seed });
      }
    }
  });

  it("forgives formatting: lowercase, dashes, spaces", () => {
    const code = encodeCode({ mode: "medium", seed: "K7XQ2M" });
    const messy = ` ${formatCode(code).toLowerCase().replace("-", " - ")} `;
    const parsed = parseCode(messy);
    expect(parsed.ok && parsed.value.code).toBe(code);
  });

  it("folds sound-alike letters (V→B, N→M) and says so", () => {
    const code = encodeCode({ mode: "hard", seed: "BMBM23" });
    const parsed = parseCode(code.replace(/B/g, "V").replace(/M/g, "N"));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.code).toBe(code);
      expect(parsed.corrected).toBe(true);
    }
  });

  it("catches EVERY single-character typo", () => {
    for (const code of sampleCodes(60)) {
      for (let i = 0; i < code.length; i++) {
        for (const ch of CODE_ALPHABET) {
          if (ch === code[i]) continue;
          const typo = code.slice(0, i) + ch + code.slice(i + 1);
          expect(parseCode(typo).ok, `${code} → ${typo}`).toBe(false);
        }
      }
    }
  });

  it("catches EVERY adjacent swap", () => {
    for (const code of sampleCodes(300)) {
      for (let i = 0; i < code.length - 1; i++) {
        if (code[i] === code[i + 1]) continue;
        const swapped = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
        expect(parseCode(swapped).ok, `${code} → ${swapped}`).toBe(false);
      }
    }
  });

  it("explains each kind of error in Spanish", () => {
    const empty = parseCode("  ");
    expect(!empty.ok && empty.error).toBe("empty");
    const zero = parseCode("AB0D");
    expect(!zero.ok && zero.error).toBe("invalid-char");
    expect(!zero.ok && zero.message).toMatch(/cero/);
    const ell = parseCode("ABL");
    expect(!ell.ok && ell.message).toMatch(/L/);
    const short = parseCode("ABCD");
    expect(!short.ok && short.error).toBe("length");
    expect(!short.ok && short.message).toMatch(/8 caracteres y llevas 4/);
  });

  it("rejects codes from a future generator version", () => {
    // Header index = (version - 1) × 4 + mode: the first version after this one, easy.
    const body = CODE_ALPHABET[GENERATOR_VERSION * 4] + "ABCDEF";
    let sum = 0;
    for (let i = 0; i < body.length; i++) sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
    const parsed = parseCode(body + CODE_ALPHABET[sum % 29]);
    expect(!parsed.ok && parsed.error).toBe("unsupported-version");
  });

  it("formats as two groups of four", () => {
    expect(formatCode("ABCD2345")).toBe("ABCD-2345");
  });
});

describe("createCode", () => {
  it("never hands out a code already played", () => {
    const rng = createRng("fresh");
    const played = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const code = createCode({ mode: "easy", random: rng.next, isTaken: (c) => played.has(c) });
      expect(played.has(code)).toBe(false);
      expect(parseCode(code).ok).toBe(true);
      played.add(code);
    }
  });

  it("gives up loudly instead of looping forever", () => {
    expect(() => createCode({ mode: "easy", random: () => 0, isTaken: () => true, maxTries: 5 })).toThrow();
  });
});
