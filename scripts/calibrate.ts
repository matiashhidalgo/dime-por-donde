/**
 * Balance report for the v2 expedition rules: `npm run calibrate [seeds] [sweep]`.
 *
 * Plays N Difícil v2 maps (3 stations + trials) with three simulated pairs (src/engine/simulate.ts:
 * competent, normal, scatterbrained) and prints how often each escapes, the
 * hearts they keep, falls, burnouts and moves. With `sweep`, it also tries a
 * grid of candle settings so you can see what moving a knob in
 * src/engine/tuning.ts would do. With `streak`, it plays N streaks per pair
 * instead and prints how many maps each lasts. Deterministic: same seeds →
 * same report.
 */
import { PROFILES, TUNING, createRng, generateGame, simulatePair, simulateStreak } from "../src/engine";
import type { Game, PairProfile } from "../src/engine";

const N = Number(process.argv[2] ?? 300);
const SWEEP = process.argv.includes("sweep");
const STREAK = process.argv.includes("streak");

// * por partida con Sombra
const games: Game[] = STREAK ? [] : Array.from({ length: N }, (_, i) => generateGame({ seed: `cal${i}`, level: "hard" }));

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const pct = (x: number) => `${Math.round(100 * x)} %`.padStart(5);

function run(p: PairProfile) {
  const rows = games.map((g, i) => simulatePair(g, p, createRng(`sim:${p.name}:${i}`)));
  const wins = rows.filter((r) => r.won);
  const losses = rows.filter((r) => !r.won);
  return {
    win: wins.length / rows.length,
    heartsOnWin: wins.reduce((a, r) => a + r.hearts, 0) / Math.max(1, wins.length),
    flawless: wins.filter((r) => r.hearts === TUNING.hearts).length / rows.length,
    falls: rows.reduce((a, r) => a + r.falls, 0) / rows.length,
    burnouts: rows.reduce((a, r) => a + r.burnouts, 0) / rows.length,
    lossByDark: losses.filter((r) => r.burnouts > 0).length / Math.max(1, losses.length),
    moves: median(rows.map((r) => r.moves)),
    seals: rows.reduce((a, r) => a + r.seals, 0) / rows.length,
    trialPaid: rows.reduce((a, r) => a + r.trialPaid, 0) / rows.length,
    escaped: rows.filter((r) => r.escaped).length / rows.length,
    curses: rows.reduce((a, r) => a + r.curses, 0) / rows.length,
    shadowed: rows.filter((r) => r.shadowed).length / rows.length,
    touches: rows.reduce((a, r) => a + r.touches, 0) / Math.max(1, rows.filter((r) => r.shadowed).length),
    waits: rows.reduce((a, r) => a + r.waits, 0) / Math.max(1, rows.filter((r) => r.shadowed).length),
    winShadow: rows.filter((r) => r.shadowed && r.won).length / Math.max(1, rows.filter((r) => r.shadowed).length),
    winClear: rows.filter((r) => !r.shadowed && r.won).length / Math.max(1, rows.filter((r) => !r.shadowed).length),
    pianoSecs: median(rows.flatMap((r) => r.trialSecs.piano)),
    tangramSecs: median(rows.flatMap((r) => r.trialSecs.tangram)),
  };
}

function report(label: string) {
  console.log(`\n${label}`);
  console.log("pareja        gana  ♥ al ganar  sin daño  caídas  apagones  derrotas con apagón  movs (mediana)  sellos  fallos pagados  emergencia  maldiciones  piano s  tangram s  con Sombra  toques*  esperas*  gana c/S  gana s/S");
  for (const p of PROFILES) {
    const r = run(p);
    console.log(
      `${p.name.padEnd(12)} ${pct(r.win)}  ${r.heartsOnWin.toFixed(2).padStart(10)}  ${pct(r.flawless)}  ${r.falls.toFixed(2).padStart(6)}  ${r.burnouts.toFixed(2).padStart(8)}  ${pct(r.lossByDark).padStart(19)}  ${String(r.moves).padStart(14)}  ${r.seals.toFixed(2).padStart(6)}  ${r.trialPaid.toFixed(2).padStart(14)}  ${pct(r.escaped).padStart(10)}  ${r.curses.toFixed(2).padStart(11)}  ${String(r.pianoSecs).padStart(7)}  ${String(r.tangramSecs).padStart(9)}  ${pct(r.shadowed).padStart(10)}  ${r.touches.toFixed(2).padStart(7)}  ${r.waits.toFixed(1).padStart(8)}  ${pct(r.winShadow).padStart(8)}  ${pct(r.winClear).padStart(8)}`,
    );
  }
}

if (STREAK) {
  const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * f))];
  const st = TUNING.streak;
  console.log(
    `${N} rachas por pareja · pozos ${st.pits.atStart} al inicio, +${st.pits.perMap}/mapa (tope +${st.pits.cap}) · vela ×${st.candleStart} −${st.candleShrink}/nivel (piso ${st.candleFloor}) · huida +${st.escapeBump} niveles · ♥ cada ${st.healEvery} sellos`,
  );
  console.log("pareja        mapas (mediana)  p25  p75  media  sellos/racha  huidas/racha  ≥5 mapas");
  for (const p of PROFILES) {
    const rows = Array.from({ length: N }, (_, i) => simulateStreak(`rac${i}`, p, createRng(`streak:${p.name}:${i}`)));
    const maps = rows.map((r) => r.maps);
    const mean = (f: (r: (typeof rows)[0]) => number) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(2);
    console.log(
      `${p.name.padEnd(12)} ${String(median(maps)).padStart(16)}  ${String(q(maps, 0.25)).padStart(3)}  ${String(q(maps, 0.75)).padStart(3)}  ${mean((r) => r.maps).padStart(5)}  ${mean((r) => r.seals).padStart(12)}  ${mean((r) => r.escapes).padStart(12)}  ${pct(rows.filter((r) => r.maps >= 5).length / rows.length).padStart(8)}`,
    );
  }
  process.exit(0);
}

const candle = TUNING.candle as { -readonly [K in keyof typeof TUNING.candle]: (typeof TUNING.candle)[K] };
console.log(
  `${N} mapas Difícil v2 · corazones ${TUNING.hearts} · vela ${candle.max} · vela chica +${candle.candleRefill} · margen oscuro ${candle.darkGrace} · sello +${TUNING.seal.candleRefill} vela, ♥ cada ${TUNING.seal.healEvery} · fallo −${TUNING.trials.failLight} vela, ♥ cada ${TUNING.trials.heartEvery}`,
);
report("Configuración actual (src/engine/tuning.ts)");

if (SWEEP) {
  const base = { ...candle };
  for (const max of [60, 80, 100]) {
    for (const relight of [0.4, 0.6]) {
      for (const darkGrace of [6, 10]) {
        Object.assign(candle, { max, relight, darkGrace });
        report(`vela ${max} · reencendido ${relight} · margen oscuro ${darkGrace}`);
      }
    }
  }
  Object.assign(candle, base);
}
