# Dime por dónde

Juego cooperativo para dos personas por videollamada. Una explora un laberinto entre la niebla; la otra tiene el mapa completo y la guía hablando. Cada quien juega en su propio dispositivo (compu o celular) y **no se comparte pantalla**: la llamada es solo para hablar.

Sin cuentas, sin servidor y sin descargas. Las dos personas escriben el mismo código de 8 caracteres y el juego genera exactamente el mismo laberinto en ambos dispositivos. Todo lo que se ve y se oye en las pruebas se **genera por partida**: no hay nada que memorizar, solo habilidad (y mucha charla).

> Fuente de verdad del diseño: [`GAME_SPEC_V2.md`](GAME_SPEC_V2.md) (resumen al inicio, reglas y un anexo por etapa con cada decisión y calibración). [`GAME_SPEC.md`](GAME_SPEC.md) es la v1.
> Primera partida en pareja: [`PLAYTEST.md`](PLAYTEST.md). Auditoría de variedad: [`docs/AUDIT.md`](docs/AUDIT.md). Publicar y volver atrás: [`docs/PUBLICAR.md`](docs/PUBLICAR.md).

## Cómo se juega, paso a paso

1. **Llamada.** Empiecen una videollamada (solo audio basta). Cada quien abre el juego en su dispositivo. La primera vez, el inicio muestra «Cómo se juega» en 4 tarjetas (saltable; el botón sigue ahí).
2. **Crear y unirse.**
   - Una persona toca **Crear partida**, elige **Partida única** o **Racha** y su rol. Hay un solo nivel (Difícil) y no hay cronómetro.
   - Le **dicta el código** a la otra (hay una ayuda para dictar: «A de árbol, B de barco…»). No hay letras confusas: sin 0/O, 1/I/L, V ni N.
   - La otra persona toca **Tengo un código**, lo escribe (mayúsculas, espacios y guiones no importan) y elige el **rol contrario**.
   - Lean en voz alta el **sello** («Bosque · 7F3K»): si coincide, tienen el mismo laberinto **y las mismas reglas**. Si no, recarguen la página en los dos (y comprueben que abrieron la misma dirección).
3. **Empezar.** Cada quien toca **Empezar** cuando esté listo; no hay cuenta regresiva.
4. **Nada tiene nombre.** El explorador describe formas, colores y siluetas; la guía las ve igual en su mapa. Inventen sus propias palabras («la cosa con tres picos»).
5. **Tensión.** Tienen **3 corazones compartidos**.
   - La **vela** del explorador se gasta al caminar (y al esperar) y con ella se achica lo que ve (3 → 2 → 1 → oscuridad). Si se apaga y siguen unos pasos a oscuras, pierden un corazón. Faroles (luz completa) y velas del camino (media) la recargan, una vez cada uno.
   - Los **pozos** (solo los ve la guía) cuestan un corazón, las llaves que llevaban, y los dejan lejos. La guía tiene que reubicarlos con lo que le cuenten.
   - Sin corazones, se acaba la expedición.
6. **Estaciones y sellos.** La salida está sellada: hay **3 estaciones** con un emblema (lo ven los dos), cada una guarda un sello detrás de una prueba. Cada mapa sortea 3 de las 4 pruebas, y quién hace qué. Al pisar una estación, el explorador ve su prueba; la guía abre la estación con el mismo emblema en su panel «Estaciones».
   - **Figuras raras:** una figura entre 9 y 12 parecidas. A veces describe el explorador y la guía elige y **dicta una clave** de 6 letras; a veces al revés. Puede verse girada o en espejo.
   - **Cerradura de deducción:** el explorador arma una combinación de símbolos y la cerradura le contesta con luces; la guía tiene pistas en pictogramas. Los primeros intentos son gratis.
   - **Piano de la bruja:** uno escucha una melodía de 4–6 notas (con audífonos: no tiene que pasar por la llamada) y el otro la toca en un teclado de colores y formas en orden revuelto. Hay modo visual sin costo, y se activa solo si no hay sonido.
   - **Tangram a ciegas:** uno ve una silueta sin cuadrícula y el otro la arma con 3–5 piezas (a veces sobra una). Se arrastra y se gira; también con teclado.
   - Si arma o toca la guía, al acertar le **dicta una clave** que lleva sus errores. Los fallos con costo gastan vela y, cada 3 en una estación, un corazón. Cada sello reaviva la vela y devuelve un corazón. Con los 3 sellos, la salida se abre.
7. **Claves dictadas.** Todo lo que viaja entre dispositivos viaja por voz: el código de partida (8), las claves de sello (6, «ABC-DEF»), de cura (4) y de relevo (9). Llevan una letra de verificación: si oyen mal una, el juego dice «una letra cambiada» sin cobrar nada de más (la primera clave equivocada de cada estación es gratis).
8. **Maldiciones.** Pisar un remolino maldice al explorador unos pasos: controles girados, espejo, ceguera, hambre de vela o máscara (no ve sus corazones ni su vela). Se pasa sola, o la guía la cura desde su panel **Maldiciones**: el explorador le dice cuántas muescas ve y le describe un sigilo o una secuencia de símbolos; la guía la resuelve y le dicta una clave de 4 letras.
9. **La Sombra.** En 2 de cada 3 mapas algo ronda por el laberinto.
   - **Se mueve cuando tú te mueves:** un paso tuyo, un paso suyo (o uno cada dos pasos, según el mapa). Si te quedas quieto con **Esperar** (botón, Espacio o E), también cuenta: la vela se gasta, pero la ronda sigue.
   - **Explorador:** la ves como una silueta oscura con ojos solo dentro de tu luz; la niebla la esconde. Oyes un **latido** (más rápido y grave cuanto más cerca por pasillos) y lo ves en el icono de arriba; con el sonido apagado, ese pulso basta. Tocarla cuesta **un corazón y algo de vela** y te da unos pasos de inmunidad. Un **farol** la aturde si está cerca. Algunas (cazadoras) se desvían hacia ti si te acercas, y se rinden pronto.
   - **Guía:** en tu mapa ves su **ronda** (un trazo con flechas y un punto cada 4 casillas para contar), pero **no dónde está ahora**. Pregúntale al explorador qué ve y oye.
   - Siempre hay una forma segura de llegar a cada estación y a la salida (el generador lo demuestra antes de dejarla en el mapa; ver `docs/AUDIT.md` y el anexo de la etapa 5).
10. **Terminar.** Tres finales: **escaparon** (3 sellos y salida), **salida de emergencia** (con 1 o 2 sellos, solo si les queda 1 corazón o la vela apagada; el juego pide confirmar) y **atrapados** (sin corazones). La guía toca **Terminar** y elige cuál. Victoria con calificación de 1 a 3 (un punto por corazón que conservaron, +1 por todas las estrellas, máximo 3). El tiempo se muestra solo como dato.
11. **Racha.** Mapa tras mapa con los mismos corazones, hasta quedarse sin ninguno. Los roles se intercambian solos en cada mapa. Al terminar un mapa, la pantalla del explorador muestra una **clave de relevo** de 9 letras («ABC-DEF-GHK»): la otra persona la escribe y su pantalla sabe con cuántos corazones siguen. Cada mapa trae más pozos, menos vela y más Sombras (con más probabilidad, más rápidas, a veces cazadoras o de dos cuerpos). Una salida de emergencia deja seguir con 1 corazón, pero endurece lo que viene. Al acabarse, queda el récord en el historial.

**Obstáculos:** pozos, llaves y puertas de color y forma, portales en pares, hielo que te desliza, remolinos que maldicen (en códigos v1 invierten los controles), estrellas opcionales, faroles y velas.

Los códigos de antes de la v2 (Fácil, Medio, Dúo) siguen funcionando con las reglas nuevas (sin estaciones ni Sombra: basta con llegar a la salida; un código Dúo juega su ronda difícil).

## Correrlo en local

Requisitos: Node 20 o superior.

```bash
npm ci
npm run dev          # http://localhost:3000
```

Para probar con dos dispositivos en la misma red Wi-Fi: `npm run dev -- -H 0.0.0.0` y abre `http://<IP-de-tu-compu>:3000` en el celular.

Otros comandos:

```bash
npm test                 # unos 6 min: motor, 6.000 laberintos, 5.000 pruebas por tipo (anti-memorización), la Sombra, uso prolongado, textos, flujos de dos dispositivos
npm run typecheck
npm run build            # export estático en out/
npm start                # sirve out/ como lo haría el hosting
npm run calibrate        # parejas simuladas: % de victorias, corazones, caídas, apagones, toques de la Sombra (añade un número, "sweep" o "streak")
npm run audit:variety    # auditoría anti-memorización de TODAS las pruebas → imprime el informe; con --write lo guarda en docs/AUDIT.md
npm run brand            # regenera public/og.png y el ícono de iPhone
```

Solo en desarrollo: `/?dev=CÓDIGO&role=explorer|guide` entra directo a jugar (con `window.__explorer`, `__teleport(celda)`, `__explorerRoute(celda)` en la consola) y `/debug/` muestra cualquier laberinto completo. El primero no existe en el build de producción.

## Recalibrar y auditar

1. Jueguen y anoten cómo terminaron ([`PLAYTEST.md`](PLAYTEST.md)).
2. `npm run calibrate [N] [sweep|streak]` juega N mapas Difícil v2 (o, con `streak`, N rachas por pareja) con tres parejas simuladas (competente, normal, despistada; `src/engine/simulate.ts`) y muestra victorias, corazones, caídas, apagones, movimientos y, desde la etapa 5, cuántas partidas tienen Sombra, cuántos toques y esperas, y cómo les va con y sin ella. Con `sweep` prueba una rejilla de ajustes de la vela. Para probar un ajuste de la Sombra sin editar archivos: `SHADOW='{"lightLoss":0.1}' npm run calibrate 400`. **Ojo:** 300 rachas tardan ~20 min por la auditoría de cada mapa.
3. Metas de la simulación: partida única, competente ≈ 80–85 %, normal ≈ 50–55 %; Racha (mediana de mapas), competente ≈ 5–7, normal ≈ 3–4. La despistada (una pareja que casi no se escucha) queda a propósito en ~15 % / 0 mapas hasta medir con parejas reales.
4. Cambien la constante, vuelvan a correr `npm run calibrate` y `npm test` (debe seguir en verde).
5. Si cambian una regla que un despliegue anterior también acepta, **suban `RULES_VERSION`** (`components/game/session.ts`, hoy 5): el sello cambia y las parejas con versiones mezcladas se enteran antes de jugar.
6. `npm run audit:variety 5000 --write` repite la auditoría de variedad con la misma muestra que los tests y actualiza `docs/AUDIT.md`.

### Constantes (`src/engine/tuning.ts`; cambian cómo se SIENTE, nunca el laberinto)

| Constante | Valor | Qué hace |
|---|---|---|
| `hearts` | 3 | Corazones compartidos |
| `candle.max` | 100 | Pasos que dura la vela llena |
| `candle.levels` | ≥ 50 % → 3, ≥ 25 % → 2, resto → 1 | Radio de visión según la luz |
| `candle.darkGrace` / `relight` | 8 / 0,5 | Pasos a oscuras antes de perder un corazón; luz con la que revive la vela |
| `candle.lanternRefill` / `candleRefill` | 1 / 0,5 | Recarga del farol y de la vela del camino |
| `pit.farFraction` / `pit.exitMargin` | 0,35 / 8 | Qué tan lejos cae uno; distancia mínima a la salida |
| `trials.failLight` / `heartEvery` | 0,12 / 3 | Vela por fallo con costo; cada cuántos fallos con costo se pierde un corazón |
| `trials.lockFreeTries` / `keyFreeTries` | 3 / 1 | Intentos gratis en la cerradura y claves equivocadas gratis por estación |
| `trials.pianoFreeTries` / `tangramFreeTries` | 1 / 1 | Intentos gratis en el piano y el tangram |
| `seal.candleRefill` / `healEvery` | 1 / 1 | Vela al ganar un sello; cada cuántos sellos se recupera un corazón |
| `swirl.stepsFactor` / `fog` | 1,5 / 1 | Solo códigos v1: duración del remolino y niebla extra |
| `curse.steps` | 14–22 | Duración de una maldición (pasos) |
| `curse.weights` | 1 cada una | Cuánto sale cada tipo (giro, ceguera, hambre, máscara, espejo) |
| `curse.blindRadius` / `hungryBurn` | 1 / 2 | Visión con ceguera; vela por paso con hambre |
| `curse.cureRefill` / `cureFailLight` | 0,2 / 0,05 | Vela que da curarla y lo que resta cada error de la guía |
| `emergency.hearts` | 1 | Con cuántos corazones (o menos) se ofrece la salida de emergencia |
| `streak.pits` | −12, +2 por mapa, tope +6 | Pozos que se quitan o agregan en cada mapa de la racha |
| `streak.candleStart` / `candleShrink` / `candleFloor` | 1,5 / 0,1 / 0,65 | Tamaño de la vela por nivel |
| `streak.figuresHarderFrom` / `HardestFrom` | 2 / 5 | Desde qué mapa las figuras se parecen más |
| `streak.lockFreeEvery` / `keyFreeUntil` | 2 / 3 | Intentos gratis menos cada 2 niveles; desde qué nivel no hay clave gratis |
| `streak.escapeBump` / `heartsAfterEscape` / `healEvery` | 2 / 1 / 1 | Cuánto endurece una huida; corazones tras ella; sellos por corazón sanado |
| **`shadow.chance`** | base 0,66 · start 0,30 · +0,07/mapa · tope 0,92 | Probabilidad de que un mapa tenga Sombra (partida única / Racha) |
| `shadow.fast` | 0,30 · 0,10 · +0,05 · 0,7 | Probabilidad de que se mueva una casilla por tick (si no, una cada 2 ticks) |
| `shadow.hunter` | 0,22 · 0,05 · +0,05 · 0,6 | Probabilidad del mutador «cazador» |
| `shadow.routeLength` / `loopShare` | 12–40 / 0,4 | Largo de la ronda; cuánto intenta ser bucle |
| `shadow.hunterRadius` / `chaseTicks` | 4 / 8 | A qué distancia por pasillos se desvía; cuánto persigue |
| `shadow.twoBodiesFrom` / `twoBodiesChance` | mapa 5 / 0,5 | Desde cuándo puede haber dos cuerpos en una Racha |
| `shadow.hurt` / `lightLoss` | 1 / 0,15 | Corazones y fracción de vela que cuesta un toque |
| `shadow.immune` / `retreat` | 3 / 3 | Ticks de inmunidad tras un toque; casillas que se retira la Sombra |
| `shadow.lanternRange` / `lanternStun` | 8 / 6 | Alcance del farol y ticks que aturde |
| `shadow.hearRange` | 9 | Casillas desde las que se oye el latido (solo presentación) |
| `shadow.fairRatio` / `fairSlack` / `attempts` | 1,5 / 3 / 40 | Auditoría de equidad: longitud máxima de la ruta segura y reintentos |

Otras perillas fuera de `tuning.ts`: memoria del explorador (`memory` en `src/engine/difficulty.ts`), volumen (`MUSIC`, `MASTER` en `lib/audio.ts`), velocidad al caminar (`WALK_MS` en `components/game/explorer/controller.ts`). La cantidad de pozos, el tamaño, las puertas… están en `difficulty.ts` pero **cambian los laberintos**: el generador v1 está congelado por un test de huellas («golden»); un cambio así se publica como una versión nueva del generador.

## Accesibilidad y rendimiento

- Objetivos táctiles ≥ 44 px; foco visible y teclado en las pantallas y diálogos (Esc cierra; flechas/WASD; Espacio o E para esperar); `aria-label` genéricos (sin nombres de objetos); estado de la vela, los corazones y la cercanía de la Sombra legibles para lectores de pantalla.
- `prefers-reduced-motion`: sin balanceo ni pulsos animados (los puntos del HUD siguen diciendo la cercanía), animaciones cortas, sin sacudidas.
- Sin sonido, todo el juego se entiende (la Sombra tiene pulso visual; el piano, modo visual). El sonido es WebAudio sintetizado, sin archivos, y se pausa con la pestaña oculta.
- JavaScript inicial ≈ 260 kB (v2 sin Sombra: 247 kB). Sin crecimiento sostenido de oyentes, temporizadores ni contextos de audio tras varias partidas seguidas (ver informe).

## Nombre

El nombre visible es **Dime por dónde**. Se cambia en un solo lugar: `lib/site.ts` (título, inicio, metadatos y tarjeta para compartir). Después corre `npm run brand` para regenerar la imagen para compartir y actualiza el título de este README.

## Estructura

```
src/engine/          motor puro (sin DOM, sin Math.random): códigos, generadores, reglas, pruebas, Sombra, solucionador, simulación
components/game/     pantallas, vista del explorador (Canvas 2D) y de la guía (SVG), pistas de primera vez, recorrido «Cómo se juega»
lib/                 audio (WebAudio), almacenamiento a prueba de fallos, historial, textos (bolsas sin repetición), pistas
scripts/             calibración, auditoría de variedad y render de imágenes de marca
docs/                AUDIT.md, PUBLICAR.md, INFORME_NUBE.md, PLAN_NUBE.md, capturas/
app/                 Next.js (export estático); /debug/ visor de desarrollo
```
