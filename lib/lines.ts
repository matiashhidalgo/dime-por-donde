/**
 * Picks microtexts without repeating: a «shuffle bag» per kind of event. Every
 * line of a kind is shown once before any shows twice (and the first of a new
 * bag never equals the last of the old one), so the 9th time something happens
 * it still reads differently from the 8th. Combinatorial lines (an opener plus
 * a tail) multiply the variety without writing every sentence.
 *
 * The bags live for the page session, across expeditions. `rand` is injectable
 * for tests; the game uses Math.random (presentation only: the rules never
 * read it).
 */

export interface Picker {
  pick(kind: string, lines: readonly string[]): string;
  /** An opener and a tail from two independent bags: n × m distinct sentences. */
  combo(kind: string, openers: readonly string[], tails: readonly string[]): string;
}

export function createPicker(rand: () => number = Math.random): Picker {
  const bags = new Map<string, { left: number[]; last: number }>();
  const draw = (kind: string, size: number): number => {
    if (size <= 1) return 0;
    let bag = bags.get(kind);
    if (!bag) bags.set(kind, (bag = { left: [], last: -1 }));
    if (bag.left.length === 0) {
      const order = Array.from({ length: size }, (_, i) => i);
      for (let i = size - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      // The bag is read from the end: keep its first draw different from the last one served.
      if (order[order.length - 1] === bag.last) [order[0], order[order.length - 1]] = [order[order.length - 1], order[0]];
      bag.left = order;
    }
    const i = bag.left.pop()!;
    bag.last = i;
    return i;
  };
  return {
    pick: (kind, lines) => lines[draw(kind, lines.length)],
    combo: (kind, openers, tails) => `${openers[draw(`${kind}:a`, openers.length)]} ${tails[draw(`${kind}:b`, tails.length)]}`,
  };
}

/** The picker the app shares. */
export const lines: Picker = createPicker();
