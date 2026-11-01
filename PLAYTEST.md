# Primera sesión de prueba (pareja)

Objetivo: saber si la tensión (corazones y vela), el sonido y la dificultad se sienten bien **jugando de verdad por videollamada**. Una hora alcanza.

## Preparación (5 min)

- Un celular y una compu, cada quien en su lugar, en videollamada (WhatsApp, FaceTime o Meet).
- Abran el sitio en los dos. En el celular: volumen al 50–70 %, sin modo silencio (en iPhone el switch lateral silencia el juego).
- Alguien tiene a la mano una hoja o una nota para anotar (plantilla abajo).

## Orden sugerido

Hay un solo nivel (Difícil). Jueguen 2 expediciones de **Partida única** con códigos nuevos, intercambiando roles («Intercambiar roles y jugar otra»). Celular = explorador en la primera. Después, una **Racha** hasta que se acabe (los roles cambian solos).

## Qué observar

- **¿Escaparon?** Apunten cuántas expediciones ganaron y con cuántos corazones. La simulación espera que una pareja que se entiende gane ~8 de 10, una normal ~1 de 2 y una distraída ~1 de 8.
- **La vela.** ¿Se dieron cuenta a tiempo de que se apagaba? ¿Buscar faroles y velas se sintió como una decisión o como un trámite?
- **Los pozos.** ¿Caer lejos y sin llaves se sintió como un golpe justo o como un castigo desproporcionado? ¿La guía logró volver a encontrar al explorador?
- **Sin nombres.** ¿Lograron ponerle nombre a las figuras? ¿Alguna se confundía con otra?
- **Estaciones.** ¿La guía supo qué estación abrir por el emblema? ¿Dictar la clave fue claro o tedioso? En la cerradura, ¿las pistas en dibujo se entendieron sin explicación? ¿Alguna prueba se sintió de azar en vez de comunicación? En el piano, ¿usaron audífonos o el modo visual? ¿Describir subidas, bajadas y largas alcanzó? En el tangram, ¿lograron describir la silueta sin cuadrícula? ¿Arrastrar y girar fue cómodo en el celular? ¿Notaron la pieza que sobraba?
- **Final.** ¿La derrota dio risa o frustración? ¿Les dieron ganas de la revancha? ¿Usaron la salida de emergencia, o prefirieron arriesgarse por el tercer sello?
- **Maldiciones.** ¿Notaron que les cayó una? ¿Contar las muescas funcionó, o la guía abrió la equivocada? ¿Curar valió la pena o esperaron a que se pasara sola?
- **Racha.** ¿Cuántos mapas duraron? (La simulación espera ~7 en una pareja que se entiende y ~3 en una normal.) ¿Dictar la clave de relevo fue claro? ¿Alguna vez usaron «No tengo la clave»?
- **Sonido en la llamada.** ¿La música tapa la voz? ¿Hay eco (el micrófono del celular repite el sonido de la compu)? Prueben Música → Efectos → Silencio con el botón de sonido.
- **Chistes y mensajes.** ¿Alguno se repite demasiado, molesta o no se entiende?
- **Celular.**
  - iOS Safari: ¿suena al primer toque? ¿La pantalla se mantiene encendida durante la partida?
  - Android Chrome: ¿vibra al chocar con una pared, caer o perder un corazón?
  - En los dos: ¿se ve completo en vertical y en horizontal? ¿La cruceta y el deslizar responden bien?

## Plantilla para anotar

```
Expedición | Explorador (dispositivo) | ¿Escaparon? | Corazones | Sellos | Caídas | Apagones | Estrellas | Tiempo (dato)
1          | celular                  | sí          | 2         | 3/3    | 1      | 0        | 2/3       | 14:20
...

Sonido: música ok / tapa la voz / eco en ___
iOS: audio al primer toque sí/no · pantalla encendida sí/no
Android: vibración sí/no
Figuras que se confundían: ___
Prueba más difícil (figuras / cerradura / piano / tangram, y quién la hizo): ___
Piano: audífonos sí/no · modo visual sí/no   Tangram: minutos ___   Fallos con costo: ___
Mensajes que sobran o confunden: ___
Lo mejor: ___      Lo peor: ___
```

## Qué constante ajustar según lo que vean

| Si notan… | Cambien | Dónde |
|---|---|---|
| Ganan siempre sin perder corazones | Bajar `candle.max` (100) o `darkGrace` (8) | `src/engine/tuning.ts` |
| Pierden casi siempre, aunque se comunican bien | Subir `candle.max` o `candleRefill` (0.5) | `src/engine/tuning.ts` |
| La oscuridad no da miedo (se recupera muy rápido) | Bajar `relight` (0.5) | `src/engine/tuning.ts` |
| Caer en un pozo se siente demasiado cruel | Subir `pit.farFraction` (0.35; 1 = cae en cualquier parte) | `src/engine/tuning.ts` |
| Las maldiciones duran poco o demasiado | `curse.steps` (14–22) | `src/engine/tuning.ts` |
| Curar no vale la pena | Subir `curse.cureRefill` (0.2) | `src/engine/tuning.ts` |
| Las rachas duran demasiado o muy poco | `streak.pits.perMap` (2) y `streak.candleShrink` (0.1) | `src/engine/tuning.ts` |
| Pocos o demasiados corazones | `hearts` (3) | `src/engine/tuning.ts` |
| Las pruebas castigan demasiado o nada | `trials.failLight` (0.12), `heartEvery` (3), `lockFreeTries` (3), `keyFreeTries` (1), `pianoFreeTries` (1), `tangramFreeTries` (1) | `src/engine/tuning.ts` |
| Ganar un sello no se siente como alivio | `seal.candleRefill` (1) y `seal.healEvery` (1) | `src/engine/tuning.ts` |
| Música tapa la voz | Bajar `MUSIC` (0.24) | `lib/audio.ts` |
| Todo suena muy fuerte o muy bajo | `MASTER` (0.8) | `lib/audio.ts` |
| Caminar se siente lento o brusco | `WALK_MS` (125 ms por casilla) | `components/game/explorer/controller.ts` |
| El rastro de lo ya visto se ve poco | `memAlpha` (0.34 / 0.15 / 0) | `components/game/explorer/controller.ts` |
| Demasiados o muy pocos pozos | `pits` en `difficulty.ts` | **Cambia los laberintos**: requiere generador v2 (ver README) |

Después de cambiar algo: `npm test` y `npm run calibrate` para ver cómo cambian las victorias de las parejas simuladas.
