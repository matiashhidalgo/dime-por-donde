/**
 * Global anti-memorization audit: `npm run audit:variety [N] [--write]`.
 *
 * Runs the diversity checks of GAME_SPEC_V2.md §7 over EVERY trial family
 * (figuras, cerradura, piano, tangram, curas: sigilo y eco, La Sombra) plus the
 * things a pair could learn by heart across games (llaves de sello, emblemas,
 * juegos de glifos), estimates the size of each instance space, and prints a
 * report. With `--write` it saves it as docs/AUDIT.md. Deterministic: same N →
 * same report. The vitest suites (antimemo*.test.ts, shadow-antimemo.test.ts)
 * assert the same properties at 5,000 seeds; this is the readable summary.
 *
 * Per family it reports:
 *  - collisions: share of instances identical to an earlier one (target < 0.1 %);
 *  - uniformity: chi-square of where the answer sits, as a fraction of the
 *    p = 0.001 critical value (target < 1);
 *  - the best trivial classifier (first/last/biggest/…): hit rate minus chance
 *    (target below a small margin that shrinks with N);
 *  - the estimated instance space, analytic (log10) with its reasoning.
 */
import { writeFileSync } from "node:fs";
import { echoCure, sigilCure } from "../src/engine/curses";
import { figureRaster, figuresTrial, rasterArea } from "../src/engine/figures";
import { generateGame } from "../src/engine/generate";
import { glyphSet } from "../src/engine/glyphs";
import { lapTicks } from "../src/engine/shadow";
import { withShadow } from "../src/engine/shadowaudit";
import { clueHolds, lockTrial } from "../src/engine/lock";
import { pianoTrial } from "../src/engine/piano";
import { sealKeys } from "../src/engine/sealcode";
import { stationEmblems } from "../src/engine/stations";
import { canonicalKey, tangramTrial } from "../src/engine/tangram";
import { TUNING } from "../src/engine/tuning";
import type { Game } from "../src/engine/types";

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 2000);
const WRITE = process.argv.includes("--write");
const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)} %`;
const keyOf = (i: number) => `AUD${i}|v2|station|${i % 3}`;

const chiCrit = (df: number, z = 3.09) => df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
const chiSquare = (counts: number[]) => {
  const total = counts.reduce((a, b) => a + b, 0);
  const e = total / counts.length;
  return counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
};
const argBy = (xs: number[], better: (a: number, b: number) => boolean) => xs.reduce((best, x, i) => (better(x, xs[best]) ? i : best), 0);

interface Sample {
  id: string;
  /** Number of options the answer was drawn from, and which one is right. */
  options: number;
  answer: number;
  /** Predictions of trivial classifiers. */
  guesses: Record<string, number>;
}

interface Row {
  name: string;
  what: string;
  n: number;
  collisions: number;
  chi: number | null;
  best: { name: string; lift: number } | null;
  space: string;
  note: string;
  ok: boolean;
}

/** Margin on the lift over chance that noise alone can produce at this N (about 3 standard errors, at least 2.5 points). */
const margin = (chance: number, n: number) => Math.max(0.025, 3.3 * Math.sqrt((chance * (1 - chance)) / n));

function audit(name: string, what: string, samples: Sample[], space: string, note = ""): Row {
  const ids = new Set(samples.map((s) => s.id));
  const collisions = 1 - ids.size / samples.length;
  // Uniformity of the answer position, per number of options.
  const byOptions = new Map<number, number[]>();
  for (const s of samples) {
    const c = byOptions.get(s.options) ?? new Array(s.options).fill(0);
    c[s.answer]++;
    byOptions.set(s.options, c);
  }
  let chi = 0;
  let df = 0;
  for (const c of byOptions.values()) {
    if (c.reduce((a, b) => a + b, 0) < 30) continue;
    chi += chiSquare(c);
    df += c.length - 1;
  }
  const chance = samples.reduce((a, s) => a + 1 / s.options, 0) / samples.length;
  let best: Row["best"] = null;
  for (const g of Object.keys(samples[0]?.guesses ?? {})) {
    const hit = samples.filter((s) => s.guesses[g] === s.answer).length / samples.length;
    const lift = hit - chance;
    if (!best || lift > best.lift) best = { name: g, lift };
  }
  const chiRatio = df > 0 ? chi / chiCrit(df) : null;
  const ok = collisions < 0.001 && (chiRatio === null || chiRatio < 1) && (best === null || best.lift < margin(chance, samples.length));
  return { name, what, n: samples.length, collisions, chi: chiRatio, best, space, note, ok };
}

// ── Families ────────────────────────────────────────────────────────────────

const rows: Row[] = [];

{
  const trials = Array.from({ length: N }, (_, i) => figuresTrial(keyOf(i), i % 2 ? "A" : "B"));
  const samples = trials.map((t): Sample => {
    const r = t.params.map((p) => figureRaster(p));
    const area = r.map(rasterArea);
    const cx = r.map((m) => {
      let sx = 0, sy = 0, c = 0;
      const n = Math.sqrt(m.length);
      m.forEach((v, k) => {
        if (v) { sx += k % n; sy += Math.floor(k / n); c++; }
      });
      return Math.hypot(sx / c - n / 2, sy / c - n / 2);
    });
    return {
      id: `${t.candidates.join("|")}#${t.correct}#${t.turn}${t.mirror}`,
      options: t.candidates.length,
      answer: t.correct,
      guesses: { primera: 0, última: t.candidates.length - 1, "la más grande": argBy(area, (a, b) => a > b), "la más chica": argBy(area, (a, b) => a < b), "la más central": argBy(cx, (a, b) => a < b) },
    };
  });
  rows.push(
    audit(
      "Figuras raras",
      "elegir entre 9–12 figuras parecidas",
      samples,
      "≈10^15",
      "14 parámetros continuos (≈8 niveles distinguibles cada uno ⇒ 8^14 ≈ 4·10^12 por figura) × giro/espejo (8) × parecido (3) × agujeros (2) × N (4) ≈ 10^15, sin contar las vecinas",
    ),
  );
}

{
  const trials = Array.from({ length: N }, (_, i) => lockTrial(keyOf(i)));
  const samples = trials.map((t): Sample => {
    const mentions = new Array(t.glyphCount).fill(0);
    for (const c of t.clues) {
      const gl = "glyph" in c ? [c.glyph as number] : "glyphs" in c ? (c.glyphs as number[]) : "pair" in c ? (c.pair as number[]) : [];
      for (const g of gl) mentions[g]++;
    }
    void clueHolds;
    return {
      id: `${t.glyphs.join("|")}#${t.secret.join()}#${t.clues.length}`,
      options: t.glyphCount,
      answer: t.secret[0],
      guesses: { "primer glifo de la paleta": 0, "último glifo": t.glyphCount - 1, "el más mencionado en pistas": argBy(mentions, (a, b) => a > b) },
    };
  });
  rows.push(
    audit(
      "Cerradura de deducción",
      "primer espacio del secreto sobre 6–8 glifos",
      samples,
      "≈10^40",
      "glifos: (6 bases × 5 marcas × 4 apéndices × orientaciones × continuos ≳ 10^3)^(6–8) ≳ 10^18–10^24 por set; secretos 6^4…8^5 (10^3–3·10^4); pistas: tipos × parámetros (≳ 10^3). Producto ≳ 10^30",
    ),
  );
}

{
  const trials = Array.from({ length: N }, (_, i) => pianoTrial(keyOf(i), i % 2 ? "A" : "B"));
  const samples = trials.map((t): Sample => ({
    id: `${t.scale}|${t.tonic}|${t.timbre}|${t.beat}|${t.keys.map((k) => k.midi).join()}|${t.melody.join()}|${t.durations.join()}`,
    options: t.keys.length,
    answer: t.melody[0],
    guesses: {
      "primera tecla": 0,
      "última tecla": t.keys.length - 1,
      "la más grave": t.keys.findIndex((k) => k.rank === 0),
      "la más aguda": t.keys.findIndex((k) => k.rank === t.keys.length - 1),
    },
  }));
  rows.push(
    audit(
      "Piano de la bruja",
      "primera nota de la melodía sobre 6–8 teclas",
      samples,
      "≈10^13",
      "9 escalas × 13 tónicas × 5 timbres × 5 tempos (≈3·10^3) × orden de teclas (K! − 2: 720–40.320) × melodías filtradas (~10^2–10^4) × ritmos (4^L)",
    ),
  );
}

{
  const trials = Array.from({ length: N }, (_, i) => tangramTrial(keyOf(i), i % 2 ? "A" : "B"));
  const withDecoy = trials.filter((t) => t.decoy);
  const sil = new Set<string>();
  const samples = trials.map((t): Sample => {
    const key = canonicalKey(t.silhouette);
    sil.add(key);
    const decoy = Math.max(0, t.pieces.findIndex((p) => p.decoy));
    const size = t.pieces.map((p) => p.cells.length);
    return {
      id: `${key}#${t.pieces.map((p) => canonicalKey(p.cells)).join("/")}#${t.offset.join()}#${t.turn}`,
      options: t.pieces.length,
      answer: decoy,
      guesses: { primera: 0, última: t.pieces.length - 1, "la más grande": argBy(size, (a, b) => a > b), "la más chica": argBy(size, (a, b) => a < b) },
    };
  });
  // Only trials with a decoy have an answer to guess; the rest still count for collisions.
  const decoyRows = audit(
    "Tangram a ciegas",
    "cuál pieza es el señuelo (en los mapas que lo tienen)",
    samples.filter((_, i) => trials[i].decoy),
    "≈10^9",
    "siluetas libres de 15–23 celdas (≈10^3–10^7 por área; más teselaciones por silueta) × giro (4) × posición en el marco × orden de la bandeja × señuelo",
  );
  const all = new Set(samples.map((s) => s.id));
  decoyRows.collisions = 1 - all.size / samples.length;
  decoyRows.n = samples.length;
  decoyRows.note += `. Siluetas repetidas (forma canónica): ${((1 - sil.size / samples.length) * 100).toFixed(2)} %; mapas con señuelo: ${((withDecoy.length / samples.length) * 100).toFixed(0)} %`;
  decoyRows.ok = decoyRows.collisions < 0.001 && (decoyRows.best === null || decoyRows.best.lift < margin(0.25, decoyRows.n));
  rows.push(decoyRows);
}

{
  const samples = Array.from({ length: N }, (_, i): Sample => {
    const t = sigilCure(`AUD${i}`, i % 4);
    const r = t.params.map((p) => figureRaster(p));
    const area = r.map(rasterArea);
    return {
      id: `${t.candidates.join("|")}#${t.correct}`,
      options: t.candidates.length,
      answer: t.correct,
      guesses: { primera: 0, última: t.candidates.length - 1, "la más grande": argBy(area, (a, b) => a > b), "la más chica": argBy(area, (a, b) => a < b) },
    };
  });
  rows.push(audit("Cura: sigilo y antídoto", "elegir el antídoto entre 6", samples, "≈10^14", "la familia de figuras (≈10^12 por figura) × giro/espejo × 6 posiciones × parecido"));
}

{
  const samples = Array.from({ length: N }, (_, i): Sample => {
    const e = echoCure(`AUD${i}`, i % 4);
    return {
      id: `${e.glyphs.join("|")}#${e.sequence.join()}#${e.keyboard.join()}#${e.beatMs}`,
      options: e.glyphs.length,
      answer: e.sequence[0],
      guesses: { "la primera tecla": e.keyboard[0], "la última tecla": e.keyboard[e.keyboard.length - 1], "el glifo 0": 0 },
    };
  });
  rows.push(audit("Cura: eco", "primer glifo de la secuencia sobre 5–6", samples, "≈10^22", "sets de glifos (≳ 10^3)^(5–6) × secuencias 5^3…6^4 × orden del teclado (5!–6!) × ritmo"));
}

// La Sombra: a pool of real maps, each draw with its own seed string, through the very same withShadow.
{
  const POOL = 60;
  const bare = Array.from({ length: POOL }, (_, i) => {
    const { shadow: _s, shadowSkip: _k, ...rest } = generateGame({ seed: `aud${i}`, level: "hard", version: 2 });
    return rest as Game;
  });
  const games = Array.from({ length: N }, (_, i) => withShadow({ ...bare[i % POOL], seed: `${bare[i % POOL].seed}~d${i}` })).filter((g) => g.shadow);
  const samples = games.map((g): Sample => {
    const sh = g.shadow!;
    const q = Math.min(3, Math.floor((sh.phase / lapTicks(sh)) * 4));
    return {
      id: `${g.seed.split("~")[0]}|${sh.route.join(",")}|${sh.shape}|${sh.slow}|${sh.phase}|${sh.hunter}|${sh.bodies}`,
      options: 4,
      answer: q,
      guesses: {
        "fase = 0": 0,
        "fase en el último cuarto": 3,
        "fase según el largo (por mitades)": sh.route.length > 26 ? 2 : 1,
        "fase según el tipo": sh.shape === "loop" ? 1 : 2,
        "fase según la velocidad": sh.slow === 1 ? 1 : 2,
      },
    };
  });
  const r = audit(
    "La Sombra",
    "cuarto del ciclo en que arranca (de 4)",
    samples,
    "≈10^9 por mapa",
    `por mapa: rutas de 12–40 casillas (≈10^3–10^4 por laberinto) × ida y vuelta/bucle × velocidad (2) × fase (≈10–160) × cazador (2) ⇒ ≳ 10^7 por laberinto; el laberinto aporta otro ≳ 10^9 (6^8 semillas). Tienen Sombra ${((games.length / N) * 100).toFixed(0)} % de los mapas; cazador ${((games.filter((g) => g.shadow!.hunter).length / Math.max(1, games.length)) * 100).toFixed(0)} %, rápida ${((games.filter((g) => g.shadow!.slow === 1).length / Math.max(1, games.length)) * 100).toFixed(0)} %. Probabilidad base ${TUNING.shadow.chance.base}`,
  );
  rows.push(r);
}

// Things that must never repeat across games: seal keys, emblems, glyph sets.
{
  const keys = new Set<string>();
  const first = new Set<string>();
  let total = 0;
  for (let i = 0; i < N; i++) {
    sealKeys(`AUDK${i}`, 3).forEach((per, st) => {
      per.forEach((k, f) => {
        keys.add(k);
        total++;
        if (f === 0 && st >= 0) first.add(`${st}:${k}`);
      });
    });
  }
  const dupAll = 1 - keys.size / total;
  rows.push({
    name: "Claves de sello",
    what: `${total} claves (3 estaciones × 10 fallos × ${N} partidas)`,
    n: total,
    collisions: dupAll,
    chi: null,
    best: null,
    space: "29^5 ≈ 2·10^7 por clave",
    note: "Cruzar partidas cuesta ~N²/2·29⁻⁵ choques: que dos partidas compartan una clave NO la hace útil (cada clave solo abre su estación, y una clave ajena abre algo en ≈0,04 % de los casos)",
    ok: dupAll < 0.002,
  });
  const emblems = new Set<string>();
  const triples = new Set<string>();
  const sets = new Set<string>();
  for (let i = 0; i < Math.min(N, 600); i++) {
    const g = { seed: `AUDE${i}` } as Game;
    stationEmblems(g).forEach((e) => emblems.add(e.d));
    triples.add(
      stationEmblems(g)
        .map((e) => e.d)
        .join("|"),
    );
    sets.add(glyphSet(`AUDG${i}`, 6).paths.join("|"));
  }
  const m = Math.min(N, 600);
  rows.push({
    name: "Emblemas de estación",
    what: `${m} trios de emblemas (un emblema suelto puede repetirse: ${pct(1 - emblems.size / (m * 3))})`,
    n: m,
    collisions: 1 - triples.size / m,
    chi: null,
    best: null,
    space: "≈10^8 por emblema, ≈10^20 por trío",
    note: "8 familias × cuenta × espejo × inclinación continua; un trío son 3 familias distintas. Lo que identifica a la partida es el trío",
    ok: 1 - triples.size / m < 0.001 && 1 - emblems.size / (m * 3) < 0.01,
  });
  rows.push({ name: "Sets de glifos", what: `${m} sets de 6`, n: m, collisions: 1 - sets.size / m, chi: null, best: null, space: "≈10^20", note: "6 bases × 5 marcas × 4 apéndices × orientación × proporciones continuas, 6 glifos distintos por 2+ partes", ok: 1 - sets.size / m < 0.001 });
}

// ── Report ───────────────────────────────────────────────────────────────────

const lines: string[] = [];
lines.push("# Auditoría anti-memorización global", "");
lines.push(`Generado con \`npm run audit:variety ${N} --write\`. Mismas semillas, mismo informe. Los tests de vitest repiten estas pruebas con 5.000 semillas (\`antimemo*.test.ts\`, \`shadow-antimemo.test.ts\`, \`longuse.test.ts\`).`, "");
lines.push(`Muestra: **${N}** instancias por familia. Umbrales: colisiones < 0,1 %; uniformidad (χ² / crítico p = 0,001) < 1; mejor clasificador trivial: aciertos − azar < ~3 errores estándar (mín. 2,5 pts).`, "");
lines.push("| Prueba | Qué se mide | Colisiones | Uniformidad | Mejor clasificador trivial (aciertos − azar) | Espacio estimado | Veredicto |");
lines.push("|---|---|---|---|---|---|---|");
for (const r of rows) {
  lines.push(
    `| ${r.name} | ${r.what} | ${pct(r.collisions)} | ${r.chi === null ? "—" : r.chi.toFixed(2)} | ${r.best ? `${r.best.name}: ${r.best.lift >= 0 ? "+" : ""}${(r.best.lift * 100).toFixed(1)} pts` : "—"} | ${r.space} | ${r.ok ? "pasa" : "REVISAR"} |`,
  );
}
lines.push("", "## Cómo se estimó el espacio de instancias", "");
for (const r of rows) lines.push(`- **${r.name}** (${r.space}): ${r.note || "ver tabla"}`);
lines.push(
  "",
  "## Pregunta obligatoria: ¿qué recordaría alguien tras 50 partidas que le ahorre pensar?",
  "",
  "| Prueba | Respuesta |",
  "|---|---|",
  "| Figuras raras | Nada de la respuesta: figura y vecinas nuevas, posición correcta uniforme, giro/espejo sorteados. Mejora el vocabulario para describir (habilidad). |",
  "| Cerradura | Nada de la respuesta: glifos, secreto y pistas cambian; las dos paletas tienen órdenes distintos. Se aprende a deducir y a describir pictogramas (la gramática de pistas es la interfaz). |",
  "| Piano | Nada: el mapeo tecla→nota es nuevo cada vez y nunca ordenado; cada posición de la melodía es uniforme. Mejora el oído y el vocabulario de contorno. |",
  "| Tangram | Nada: siluetas y piezas generadas; el señuelo no se delata por tamaño ni posición; la silueta llega girada y desplazada. Mejora describir formas. |",
  "| Curas (sigilo y eco) | Nada: sigilos y glifos nuevos; la tecla nunca está en el orden de la secuencia. Se aprende qué hace cada maldición (interfaz). |",
  "| La Sombra | Que existe y que se mueve con los pasos (interfaz). Su ronda, velocidad, fase, mutador y hasta su cara son nuevos en cada partida; la fase es uniforme y ninguna característica simple la predice. Lo que mejora es leer el latido y calcular tiempos con la guía (habilidad). |",
  "| Claves dictadas | Nada: dependen de semilla + estación + fallos; dentro de una partida las 30 son distintas y entre partidas casi nunca coinciden (y aunque coincidan, solo abren su estación). |",
  "",
  "## Qué NO cubre esta auditoría",
  "",
  "- Parejas reales: no se puede medir aburrimiento. `PLAYTEST.md` tiene las preguntas de rejugabilidad.",
  "- Los textos (frases por evento): se auditan aparte con `components/game/__tests__/variety.test.ts` y `lib/__tests__/lines.test.ts`.",
  "- Las 8 familias de siluetas y las 5 maldiciones son vocabulario fijo de mecánica a propósito: son la interfaz, no la respuesta.",
  "",
);
const out = lines.join("\n");
console.log(out);
if (WRITE) {
  writeFileSync(new URL("../docs/AUDIT.md", import.meta.url), out);
  console.log("\n→ docs/AUDIT.md escrito");
}
if (rows.some((r) => !r.ok)) {
  console.error("\nAlguna familia necesita revisión.");
  process.exit(1);
}
