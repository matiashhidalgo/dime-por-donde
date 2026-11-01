# Dime por dónde

Juego cooperativo para dos personas por videollamada. Una explora un laberinto entre la niebla; la otra tiene el mapa completo y la guía hablando. Cada quien juega en su propio dispositivo (compu o celular) y **no se comparte pantalla**: la llamada es solo para hablar.

Sin cuentas, sin servidor y sin descargas. Las dos personas escriben el mismo código de 8 caracteres y el juego genera exactamente el mismo laberinto en ambos dispositivos.

> Fuente de verdad del diseño: [`GAME_SPEC_V2.md`](GAME_SPEC_V2.md) (reglas, anexos por etapa con cada decisión y calibración). [`GAME_SPEC.md`](GAME_SPEC.md) es la v1.
> Primera partida en pareja: [`PLAYTEST.md`](PLAYTEST.md).

## Cómo se juega

1. **Llamada.** Empiecen una videollamada (solo audio basta). Cada quien abre el juego en su dispositivo.
2. **Crear y unirse.**
   - Una persona toca **Crear partida**, elige **Partida única** o **Racha** y su rol. Hay un solo nivel (Difícil) y no hay cronómetro.
   - Le **dicta el código** a la otra (hay una ayuda para dictar: «A de árbol, B de barco…»). No hay letras confusas: sin 0/O, 1/I/L, V ni N.
   - La otra persona toca **Tengo un código**, lo escribe (mayúsculas, espacios y guiones no importan) y elige el **rol contrario**.
   - Lean en voz alta el **sello** («Hielo · S22R»): si coincide, tienen el mismo laberinto.
3. **Roles.**
   - **Explorador:** ve solo lo que alumbra su vela, entre niebla. Se mueve con flechas/WASD, deslizando el dedo o con la cruceta. Nada tiene nombre: describe las formas que ve y entre los dos les inventan uno.
   - **Guía:** ve el mapa completo con trampas, llaves, portales y estrellas, pero **no sabe dónde está el explorador**. Puede poner un alfiler de «creo que estás aquí», marcar casillas y dibujar (solo en su pantalla).
4. **Empezar.** Cada quien toca **Empezar** cuando esté listo; no hay cuenta regresiva.
5. **Tensión.** Tienen **3 corazones compartidos**. La vela del explorador se gasta al caminar y con ella se achica lo que ve; si se apaga y siguen unos pasos a oscuras, pierden un corazón. Faroles (luz completa) y velas del camino (media) la recargan, una vez cada uno. Caer en un pozo cuesta un corazón, las llaves que llevaban y los deja lejos, en otra parte del laberinto. Sin corazones, se acaba la expedición.
6. **Estaciones y sellos.** La salida está sellada: hay **3 estaciones** marcadas con un emblema (lo ven los dos) y cada una guarda un sello. Cada mapa trae 3 de las 4 pruebas, y quién hace qué se sortea. Al pisar una, el explorador ve su prueba; la guía abre la estación con el mismo emblema en su panel «Estaciones» (si abre otra, nadie le avisa).
   - **Figuras raras:** una figura entre 9 y 12 parecidas. A veces describe el explorador y la guía elige y le **dicta una clave** de 6 letras; a veces al revés. La figura puede verse girada o en espejo.
   - **Cerradura:** el explorador arma una combinación de símbolos y la cerradura le contesta con luces; la guía tiene pistas en pictogramas. Los primeros intentos son gratis.
   - **Piano de la bruja:** uno escucha una melodía de 4–6 notas (con audífonos: no tiene que pasar por la llamada) y el otro la toca en un teclado de colores y formas en orden revuelto. Hay modo visual en barras, sin costo, y se activa solo si el dispositivo no tiene sonido.
   - **Tangram a ciegas:** uno ve una silueta sin cuadrícula y el otro la arma con 3–5 piezas (a veces sobra una). Las piezas se arrastran y se giran; también con teclado (1–5, flechas, R).
   - Si arma o toca la guía, al acertar le **dicta una clave** que lleva sus errores. En piano y tangram el primer error es gratis.
   - Los fallos con costo gastan vela y, cada 3 en una misma estación, un corazón. Cada sello reaviva la vela y devuelve un corazón. Con los 3 sellos, la salida se abre.
7. **Maldiciones.** Pisar un remolino maldice al explorador por unos pasos: controles girados, espejo, ceguera, hambre de vela o máscara (no ve sus corazones ni su vela). Se pasa sola, o la guía la cura desde su panel **Maldiciones**: el explorador le dice cuántas muescas ve y le describe un sigilo o una secuencia de símbolos que parpadea; la guía la resuelve y le dicta una clave de 4 letras.
8. **Terminar.** Tres finales: **escaparon** (3 sellos y salida), **salida de emergencia** (con 1 o 2 sellos, solo si les queda 1 corazón o la vela apagada; el juego pide confirmar) y **atrapados** (sin corazones). La guía toca **Terminar** y elige cuál.
9. **Racha.** Mapa tras mapa con los mismos corazones, hasta quedarse sin ninguno. Los roles se intercambian solos en cada mapa. Al terminar un mapa, la pantalla del explorador muestra una **clave de relevo** de 9 letras («ABC-DEF-GHK»): la otra persona la escribe y su pantalla sabe con cuántos corazones siguen. Cada mapa tiene menos vela y más pozos; una salida de emergencia deja seguir con 1 corazón, pero endurece lo que viene.
10. **Resultado.** Victoria con calificación de 1 a 3 (un punto por corazón que conservaron, +1 por todas las estrellas, máximo 3) o derrota con sus estadísticas. El tiempo se muestra solo como dato. La guía anota corazones, estrellas y caídas preguntándole al explorador. Después: **Intercambiar roles y jugar otra**.

**Obstáculos:** pozos (solo los ve la guía), llaves y puertas de color y forma, portales en pares, hielo que te desliza, remolinos que maldicen (en códigos v1, invierten los controles), estrellas opcionales, faroles y velas.

Los códigos creados antes de la v2 (Fácil, Medio, Dúo) siguen funcionando con las reglas nuevas; un código Dúo juega su ronda difícil. Los códigos v1 no tienen estaciones: basta con llegar a la salida.

## Correrlo en local

Requisitos: Node 20 o superior.

```bash
cd laberinto
npm install
npm run dev          # http://localhost:3000
```

Para probar con dos dispositivos en la misma red Wi-Fi: `npm run dev -- -H 0.0.0.0` y abre `http://<IP-de-tu-compu>:3000` en el celular.

Otros comandos:

```bash
npm test             # ~1,5 min: motor, 6.000 laberintos, 5.000 pruebas por tipo (anti-memorización), flujos de dos dispositivos, storage roto
npm run typecheck
npm run build        # export estático en out/
npm start            # sirve out/ como lo haría el hosting
npm run calibrate    # parejas simuladas en 300 mapas: % de victorias, corazones, caídas, apagones (añade un número y "sweep")
npm run brand        # regenera public/og.png y el ícono de iPhone
```

Solo en desarrollo: `/?dev=CÓDIGO&role=explorer|guide` entra directo a jugar y `/debug/` muestra cualquier laberinto completo. El primero no existe en el build de producción.

## Recalibrar la dificultad

1. Jueguen y anoten cómo terminaron (ver [`PLAYTEST.md`](PLAYTEST.md)).
2. `npm run calibrate [N] [sweep|streak]` juega N mapas Difícil (o, con `streak`, N rachas por pareja) con tres parejas simuladas (competente, normal, despistada; `src/engine/simulate.ts`) y muestra el % de victorias, corazones al ganar, caídas, apagones y movimientos. Con `sweep` prueba una rejilla de ajustes de la vela.
3. Ajusten:
   - **Reglas de tensión** (no cambian los laberintos): `src/engine/tuning.ts`.

     | Constante | Valor | Qué hace |
     |---|---|---|
     | `hearts` | 3 | Corazones compartidos |
     | `candle.max` | 100 | Movimientos que dura la vela llena |
     | `candle.levels` | ≥50 % → 3, ≥25 % → 2, resto → 1 | Radio de visión según la luz |
     | `candle.darkGrace` | 8 | Pasos a oscuras antes de perder un corazón |
     | `candle.relight` | 0.5 | Luz con la que revive la vela tras apagarse |
     | `candle.lanternRefill` / `candleRefill` | 1 / 0.5 | Recarga del farol y de la vela del camino |
     | `pit.farFraction` / `pit.exitMargin` | 0.35 / 8 | Qué tan lejos cae uno y distancia mínima a la salida |
     | `swirl.stepsFactor` / `swirl.fog` | 1.5 / 1 | Duración del remolino y niebla extra |
     | `trials.failLight` / `trials.heartEvery` | 0.12 / 3 | Vela por fallo con costo; cada cuántos fallos con costo se pierde un corazón |
     | `trials.lockFreeTries` / `trials.keyFreeTries` | 3 / 1 | Intentos gratis en la cerradura y claves equivocadas gratis por estación |
     | `trials.pianoFreeTries` / `trials.tangramFreeTries` | 1 / 1 | Intentos gratis en el piano y en el tangram |
     | `seal.candleRefill` / `seal.healEvery` | 1 / 1 | Vela al ganar un sello; cada cuántos sellos se recupera un corazón |
     | `curse.steps` / `curse.cureRefill` / `curse.cureFailLight` | 14–22 / 0.2 / 0.05 | Duración de una maldición; vela que da curarla y cuánto resta cada error de la guía |
     | `emergency.hearts` | 1 | Con cuántos corazones (o menos) se ofrece la salida de emergencia |
     | `streak.pits` | −12, +2 por mapa, tope +6 | Pozos que se quitan o agregan en cada mapa de la racha |
     | `streak.candleStart` / `candleShrink` / `candleFloor` | 1.5 / 0.1 / 0.65 | Tamaño de la vela por nivel de la racha |
     | `streak.escapeBump` / `heartsAfterEscape` | 2 / 1 | Cuánto endurece una huida y con cuántos corazones siguen |
   - **Memoria del explorador:** `memory` en `src/engine/difficulty.ts`.
   - **Cantidad de pozos, tamaño, puertas, portales, remolinos (`swirlSteps`), esfuerzo aceptado:** también en `difficulty.ts`, pero **cambian los laberintos**. El generador v1 está congelado por un test de huellas («golden»); un cambio así se publica como v2 (`GENERATOR_VERSION` y `SUPPORTED_VERSIONS` en `src/engine/code.ts`) y v1 se conserva para los códigos viejos.
4. `npm test` debe seguir en verde.

## Nombre

El nombre visible es **Dime por dónde**. Se cambia en un solo lugar: `lib/site.ts` (título, inicio, metadatos y tarjeta para compartir). Después corre `npm run brand` para regenerar la imagen para compartir y actualiza el título de este README.

## Estructura

```
src/engine/          motor puro (sin DOM, sin Math.random): códigos, generador, reglas, solver, juego, puntuación
components/game/     pantallas, vista del explorador (Canvas 2D) y de la guía (SVG)
lib/                 audio (WebAudio), storage a prueba de fallos, historial, textos, nombre del sitio
scripts/             calibración y render de imágenes de marca
app/                 Next.js (export estático); /debug/ visor de desarrollo
```
