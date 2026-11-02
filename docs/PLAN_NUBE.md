# Plan de trabajo: etapa 5 (La Sombra) y etapa 6 (auditoría y cierre)

Rama de trabajo: `v2-sombra-cierre` (desde `origin/v2`). PR hacia `v2`.

## Decisiones de diseño (La Sombra)

**Modelo.** `src/engine/shadow.ts`, estado puro:

- `Shadow` (parte del `Game`, solo v2): ruta de 12–40 casillas por pasillos (`loop` = ciclo real por un bucle del laberinto, `ping` = ida y vuelta), velocidad (1 casilla por tick o por 2 ticks), fase inicial, mutador «cazador» y 1 o 2 cuerpos (el segundo comparte la ruta, desfasado media vuelta; nunca con cazador).
- Estado de ejecución (`ShadowRun`, dentro de `PlayState`): por cuerpo `reloj` de patrulla, casilla, modo (patrulla / persecución / retirada / vuelta), aturdimiento. Todo avanza solo con los **ticks del explorador** (movimiento que avanza + la nueva acción «Esperar»). Los choques no cuentan. Con una prueba abierta no hay ticks porque los overlays no llaman a `stepPlay`.
- Una sola función de avance (`advanceBody`) sirve a la partida y a la auditoría de equidad, así lo que se prueba es exactamente lo que se juega.

**Equidad (obligatoria).** `auditShadow(game)`: búsqueda de camino más corto en el espacio expandido en el tiempo (casilla, llaves, estado de la Sombra); `esperar` es una acción. Debe existir ruta segura desde la entrada a cada estación y a la salida de longitud ≤ ⌈1,5 × ruta normal⌉ + holgura. Si falla: reintento determinista (`semilla|v2|shadow|intento`). Tras agotar intentos, el mapa queda sin Sombra (cuenta en las estadísticas). La Sombra nunca pisa entrada, salida, estaciones ni sus vecinas, ni casillas con pozo, puerta, portal, hielo o remolino.

**Reglas nuevas** (`RULES_VERSION` 5): contacto = −1 corazón, la vela pierde una fracción, el explorador queda inmune unos ticks y la Sombra se retira; el farol aturde a la Sombra cercana. Constantes en `TUNING.shadow`.

**Racha.** Con el índice del mapa suben la probabilidad de aparición, la de velocidad 1 y la del modo cazador (con topes); desde cierto mapa puede haber dos cuerpos.

**Vistas.** Explorador: silueta oscura con ojos solo dentro de su visión, latido WebAudio por cercanía (distancia por pasillos), pulso del HUD y de la viñeta, vibración, sin sonido el pulso visual basta, reduced-motion respetado. Guía: la ruta con flechas y puntos cada 4 casillas, sin la posición. Sin nombres.

## Orden de trabajo

1. Línea base (tsc, tests, build, calibración antes).
2. Motor: `tuning.ts` (`shadow`), `shadow.ts`, integración en `play.ts`, generación (`withShadow` en generador v2 y Racha), auditoría, `waitPlay`.
3. Tests: unitarios, equidad, anti-memorización con 5.000 semillas.
4. Simulación y calibración (tablas antes/después).
5. UI: explorador (render, latido, HUD), guía (ruta), textos, sonidos, `RULES_VERSION` 5.
6. Etapa 6: auditoría global (`npm run audit:variety`, `docs/AUDIT.md`), uso prolongado, variedad de textos, onboarding, QA, documentación (README, PLAYTEST, resumen en la spec, `docs/PUBLICAR.md`), informe.

Cada paso termina en un commit pequeño. Si falta presupuesto, `docs/ESTADO_NUBE.md` dirá exactamente qué quedó.
