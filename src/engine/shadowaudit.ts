import { DIRS } from "./grid";
import { resolveMove } from "./rules";
import { type Body, type Shadow, advanceBody, cellLap, drawShadow, initBodies, lapTicks, patrolCell, shadowRolls, shadowWorld, touches } from "./shadow";
import { TUNING } from "./tuning";
import type { Game } from "./types";

/**
 * Fairness of La Sombra (anexo etapa 5): a search over states EXPANDED IN TIME
 * — (cell, keys held, the Sombra's own state) — where waiting is an action.
 * It must find, from the entrance, a path to every station and to the exit
 * that never touches a body and takes at most ceil(1.5 × the normal route)
 * (+ a little slack) ticks. The same `advanceBody` that runs the game steps the
 * Sombra here, hunters included. Pits are never walked into on the safe path.
 */

interface MoveTable {
  masks: number;
  /** [state * 4 + dir] → next state, or -1. */
  next: Int32Array;
  /** [state * 4 + dir] → cells crossed (trail, plus the partner portal on a teleport). */
  crossed: (number[] | null)[];
  keyAt: Uint8Array;
}

const tableCache = new WeakMap<object, MoveTable>();

function moveTable(game: Game): MoveTable {
  const hit = tableCache.get(game.occupant);
  if (hit) return hit;
  const cells = game.grid.width * game.grid.height;
  let bits = 0;
  for (const o of game.occupant) if (o?.type === "key" || o?.type === "door") bits = Math.max(bits, o.color + 1);
  const masks = 1 << bits;
  const keyAt = new Uint8Array(cells);
  game.occupant.forEach((o, c) => {
    if (o?.type === "key") keyAt[c] = 1 << o.color;
  });
  const next = new Int32Array(cells * masks * 4).fill(-1);
  const crossed: (number[] | null)[] = new Array(cells * masks * 4).fill(null);
  for (let c = 0; c < cells; c++)
    for (let m = 0; m < masks; m++)
      for (const d of DIRS) {
        const r = resolveMove(game, c, d, m);
        if (r.outcome !== "moved" && r.outcome !== "teleported") continue;
        let mask = m;
        const cr = [...r.trail];
        if (r.outcome === "teleported") cr.push(r.to);
        for (const x of cr) mask |= keyAt[x];
        const i = (c * masks + m) * 4 + d;
        next[i] = r.to * masks + mask;
        crossed[i] = cr;
      }
  const t = { masks, next, crossed, keyAt };
  tableCache.set(game.occupant, t);
  return t;
}

export interface TargetFairness {
  cell: number;
  /** Ticks of the normal route (no Sombra, no waiting). */
  normal: number;
  /** Ticks of the shortest safe path found (Infinity = none within the limit). */
  safe: number;
  limit: number;
}

export interface ShadowAudit {
  ok: boolean;
  reason?: "unreachable" | "too-long" | "no-shadow";
  targets: TargetFairness[];
  /** Joint states visited. */
  states: number;
  /** Worst safe/normal ratio over the targets. */
  worstRatio: number;
}

export const fairLimit = (normal: number): number => Math.ceil(TUNING.shadow.fairRatio * normal) + TUNING.shadow.fairSlack;

export function auditShadow(game: Game): ShadowAudit {
  const sh = game.shadow;
  if (!sh) return { ok: false, reason: "no-shadow", targets: [], states: 0, worstRatio: 0 };
  const mt = moveTable(game);
  const { masks, next, crossed, keyAt } = mt;
  const total = game.grid.width * game.grid.height * masks;
  const targetCells = [game.exit, ...(game.stations ?? []).map((s) => s.cell)];
  const startState = game.start * masks + keyAt[game.start];

  // Normal route: plain BFS over the same moves.
  const plain = new Int32Array(total).fill(-1);
  plain[startState] = 0;
  const q0 = [startState];
  for (let h = 0; h < q0.length; h++) {
    const s = q0[h];
    for (let d = 0; d < 4; d++) {
      const n = next[s * 4 + d];
      if (n >= 0 && plain[n] < 0) {
        plain[n] = plain[s] + 1;
        q0.push(n);
      }
    }
  }
  const normal = targetCells.map((c) => {
    let best = -1;
    for (let m = 0; m < masks; m++) {
      const v = plain[c * masks + m];
      if (v >= 0 && (best < 0 || v < best)) best = v;
    }
    return best;
  });
  const limits = normal.map((n) => (n < 0 ? -1 : fairLimit(n)));
  if (normal.some((n) => n < 0)) {
    return { ok: false, reason: "unreachable", targets: targetCells.map((cell, i) => ({ cell, normal: normal[i], safe: Infinity, limit: limits[i] })), states: 0, worstRatio: Infinity };
  }
  const maxTick = Math.max(...limits);
  const safe: number[] = targetCells.map(() => Infinity);
  let found = 0;
  const note = (state: number, t: number) => {
    const cell = Math.floor(state / masks);
    for (let i = 0; i < targetCells.length; i++) {
      if (targetCells[i] === cell && safe[i] === Infinity) {
        safe[i] = t;
        found++;
      }
    }
  };
  note(startState, 0);

  const P = lapTicks(sh);
  let states = 0;
  if (!sh.hunter) {
    // Patrol only: the Sombra's state is the clock, so it's a plain (state, clock) grid.
    const pos: number[][] = [];
    for (let c = 0; c < P; c++) pos.push(Array.from({ length: sh.bodies }, (_, i) => patrolCell(sh, c + i * sh.offset + sh.phase)));
    const visited = new Uint8Array(total * P);
    let qs = [startState];
    let qc = [0];
    visited[startState * P] = 1;
    for (let t = 0; t < maxTick && found < targetCells.length; t++) {
      const ns: number[] = [];
      const nc: number[] = [];
      for (let i = 0; i < qs.length; i++) {
        const s = qs[i];
        const clock = qc[i];
        const nclock = (clock + 1) % P;
        const before = pos[clock];
        const after = pos[nclock];
        const cell = Math.floor(s / masks);
        for (let d = -1; d < 4; d++) {
          let target: number;
          let cr: readonly number[];
          if (d < 0) {
            target = s;
            cr = [cell];
          } else {
            target = next[s * 4 + d];
            if (target < 0) continue;
            cr = crossed[s * 4 + d]!;
          }
          if (touches(before, after, cr)) continue;
          const key = target * P + nclock;
          if (visited[key]) continue;
          visited[key] = 1;
          ns.push(target);
          nc.push(nclock);
          states++;
          note(target, t + 1);
        }
      }
      qs = ns;
      qc = nc;
    }
  } else {
    // A hunter's state can leave the clock: carry whole bodies (mirrors the game's own step).
    const w = shadowWorld(game);
    const cellsN = game.grid.width * game.grid.height;
    const C = TUNING.shadow.chaseTicks;
    const offRoute = P + cellsN * (C + 1) * 2;
    const space = offRoute + cellsN * 2 + 1;
    const keyOf = (b: Body): number => {
      if (b.mode === "patrol") return ((b.clock % P) + P) % P;
      if (b.mode === "chase") return P + (b.cell * (C + 1) + b.left) * 2 + b.sub;
      return offRoute + b.cell * 2 + b.sub;
    };
    const visited = new Set<number>();
    const mark = (s: number, bodies: Body[]) => {
      const k = s * space + keyOf(bodies[0]);
      if (visited.has(k)) return false;
      visited.add(k);
      return true;
    };
    const first = initBodies(sh);
    mark(startState, first);
    let qs: { s: number; b: Body[] }[] = [{ s: startState, b: first }];
    for (let t = 0; t < maxTick && found < targetCells.length; t++) {
      const nq: { s: number; b: Body[] }[] = [];
      for (const { s, b } of qs) {
        const cell = Math.floor(s / masks);
        for (let d = -1; d < 4; d++) {
          let target: number;
          let cr: readonly number[];
          if (d < 0) {
            target = s;
            cr = [cell];
          } else {
            target = next[s * 4 + d];
            if (target < 0) continue;
            cr = crossed[s * 4 + d]!;
          }
          const explorer = Math.floor(target / masks);
          const nb = b.map((x) => advanceBody(w, sh, x, explorer));
          if (touches(b.map((x) => x.cell), nb.map((x) => x.cell), cr)) continue;
          if (!mark(target, nb)) continue;
          nq.push({ s: target, b: nb });
          states++;
          note(target, t + 1);
        }
      }
      qs = nq;
    }
  }

  const targets = targetCells.map((cell, i) => ({ cell, normal: normal[i], safe: safe[i], limit: limits[i] }));
  const worstRatio = Math.max(...targets.map((t) => (t.safe === Infinity ? Infinity : t.safe / Math.max(1, t.normal))));
  const unreachable = targets.some((t) => t.safe === Infinity);
  const ok = !unreachable && targets.every((t) => t.safe <= t.limit);
  return { ok, reason: ok ? undefined : unreachable ? "unreachable" : "too-long", targets, states, worstRatio };
}

/**
 * The map with its Sombra, or the map unchanged: the roll says whether it has
 * one, then seed attempts (`seed|v2|shadow|n`) run until one passes the audit.
 * Both devices walk the same attempts in the same order.
 */
export function withShadow(game: Game): Game {
  if (game.version < 2 || !game.stations) return game;
  if (!shadowRolls(game)) return { ...game, shadowSkip: "roll" };
  for (let attempt = 0; attempt < TUNING.shadow.attempts; attempt++) {
    const sh = drawShadow(game, `${game.seed}|v2|shadow|${attempt}`, attempt);
    if (!sh) continue;
    const candidate: Game = { ...game, shadow: sh };
    if (auditShadow(candidate).ok) return candidate;
  }
  return { ...game, shadowSkip: "audit" };
}

export { cellLap };
export type { Shadow };
