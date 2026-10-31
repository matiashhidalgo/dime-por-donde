# Dime por dónde

Juego cooperativo para dos personas por videollamada. Una explora un laberinto entre la niebla; la otra tiene el mapa completo y la guía hablando. Cada quien juega en su propio dispositivo (compu o celular) y **no se comparte pantalla**: la llamada es solo para hablar.

Sin cuentas, sin servidor y sin descargas. Las dos personas escriben el mismo código de 8 caracteres y el juego genera exactamente el mismo laberinto en ambos dispositivos.

> Fuente de verdad del diseño: [`GAME_SPEC.md`](GAME_SPEC.md) (reglas y anexos con cada decisión y calibración).
> Primera partida en pareja: [`PLAYTEST.md`](PLAYTEST.md).

## Cómo se juega

1. **Llamada.** Empiecen una videollamada (solo audio basta). Cada quien abre el juego en su dispositivo.
2. **Crear y unirse.**
   - Una persona toca **Crear partida**, elige dificultad (Fácil, Medio, Difícil o **Dúo**: tres rondas que van subiendo), su rol y si quiere cronómetro.
   - Le **dicta el código** a la otra (hay una ayuda para dictar: «A de árbol, B de barco…»). No hay letras confusas: sin 0/O, 1/I/L, V ni N.
   - La otra persona toca **Tengo un código**, lo escribe (mayúsculas, espacios y guiones no importan) y elige el **rol contrario**.
   - Lean en voz alta el **sello** («Hielo · S22R»): si coincide, tienen el mismo laberinto.
3. **Roles.**
   - **Explorador:** ve solo lo que tiene cerca, entre niebla. Se mueve con flechas/WASD, deslizando el dedo o con la cruceta. Describe lo que ve: los nombres de abajo («Cerca: hongo gigante») son los mismos del mapa de la guía.
   - **Guía:** ve el mapa completo con trampas, llaves, portales y estrellas, pero **no sabe dónde está el explorador**. Puede poner un alfiler de «creo que estás aquí», marcar casillas y dibujar (solo en su pantalla).
4. **Ritual 3-2-1.** Los dos dicen «¡ya!» a la vez y tocan **Empezar**: cada pantalla cuenta 3-2-1 por su cuenta, así sus cronómetros van parejos sin necesidad de internet.
5. **Llegar.** Cuando el explorador llega a la salida, avisa. La guía toca **¡Llegó!** dos veces para parar su reloj.
6. **Resultado.** Tiempo, caídas, estrellas y una calificación de 1 a 3. La guía anota estrellas y caídas preguntándole al explorador. Después: **Intercambiar roles y jugar otra**.

**Obstáculos:** pozos (solo los ve la guía; caer te regresa a la última bandera y suma 10 s), llaves y puertas de color y forma, portales en pares, hielo que te desliza, remolinos que invierten los controles, estrellas opcionales y faroles que amplían la vista unos segundos.

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
npm test             # ~1 min: motor, 6.000 laberintos, flujos de dos dispositivos, storage roto
npm run typecheck
npm run build        # export estático en out/
npm start            # sirve out/ como lo haría el hosting
npm run calibrate    # estadísticas de dificultad (400 semillas por nivel)
npm run brand        # regenera public/og.png y el ícono de iPhone
```

Solo en desarrollo: `/?dev=CÓDIGO&role=explorer|guide` entra directo a jugar y `/debug/` muestra cualquier laberinto completo. El primero no existe en el build de producción.

## Recalibrar la dificultad

1. Jueguen y anoten tiempos reales (ver [`PLAYTEST.md`](PLAYTEST.md)).
2. `npm run calibrate` imprime, por nivel, movimientos, cruces, pozos junto a la ruta, desvío por estrellas, el tiempo de referencia (par) y una estimación de juego hablando.
3. Ajusten:
   - **Tiempo de referencia:** `PAR` y `SLOW_FACTOR` en `src/engine/score.ts`.
   - **Visión, memoria y farol:** `src/engine/difficulty.ts` (`vision`, `memory`, `lanternSeconds`, `lanternBonus`). Estos no cambian los laberintos.
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
