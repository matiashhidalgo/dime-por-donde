# Primera sesión de prueba (pareja)

Objetivo: saber si los tiempos, el sonido y la dificultad se sienten bien **jugando de verdad por videollamada**. Una hora alcanza.

## Preparación (5 min)

- Un celular y una compu, cada quien en su lugar, en videollamada (WhatsApp, FaceTime o Meet).
- Abran el sitio en los dos. En el celular: volumen al 50–70 %, sin modo silencio (en iPhone el switch lateral silencia el juego).
- Alguien tiene a la mano una hoja o una nota para anotar (plantilla abajo).

## Orden sugerido

1. **Fácil**, cronómetro activado. Celular = explorador.
2. **Fácil** otra vez, intercambiando roles (botón «Intercambiar roles y jugar otra»).
3. **Medio**, cada quien en el rol que prefiera.
4. **Difícil** una vez (aunque no lleguen: anoten en qué minuto se rindieron).
5. **Dúo** completo, si queda energía.

## Qué observar

- **Tiempo real vs. referencia.** La pantalla de resultado dice «Referencia: X». ¿Terminaron muy por debajo (fácil de más) o muy por encima (frustrante)?
- **Tiempo por cruce.** En 2 o 3 cruces, cronometren a ojo cuánto tardan en ponerse de acuerdo («¿izquierda o derecha?»). El cálculo supone ~14 s por cruce.
- **Sonido en la llamada.** ¿La música tapa la voz? ¿Hay eco (el micrófono del celular repite el sonido de la compu)? Prueben Música → Efectos → Silencio con el botón de sonido.
- **Pozos en Difícil.** ¿Cuántas caídas? ¿Se sienten injustas o divertidas?
- **Chistes y mensajes.** ¿Alguno se repite demasiado, molesta o no se entiende?
- **Duración.** ¿Cuántas partidas jugaron antes de cansarse?
- **Celular.**
  - iOS Safari: ¿suena al primer toque? ¿La pantalla se mantiene encendida durante la partida?
  - Android Chrome: ¿vibra al chocar con una pared o caer?
  - En los dos: ¿se ve completo en vertical y en horizontal? ¿La cruceta y el deslizar responden bien?

## Plantilla para anotar

```
Partida | Nivel | Explorador (dispositivo) | Tiempo | Referencia | Caídas | Estrellas | ¿Llegaron?
1       | Fácil | celular                  | 3:40   | 4:05       | 1      | 2/3       | sí
...

Cruces cronometrados (s): 12, 20, 9
Sonido: música ok / tapa la voz / eco en ___
iOS: audio al primer toque sí/no · pantalla encendida sí/no
Android: vibración sí/no
Mensajes que sobran o confunden: ___
Lo mejor: ___      Lo peor: ___
```

## Qué constante ajustar según lo que vean

| Si notan… | Cambien | Dónde |
|---|---|---|
| Siempre muy por debajo de la referencia (3 estrellas fáciles) | Bajar `perDecision` (14) o `start` (45) | `PAR` en `src/engine/score.ts` |
| Siempre muy por encima (1 estrella aunque jugaron bien) | Subir `perDecision` o `perMove` (2) | `PAR` en `src/engine/score.ts` |
| La calificación castiga demasiado lo lento | Subir `SLOW_FACTOR` (1.5) | `src/engine/score.ts` |
| Las caídas bajan la calificación muy pronto | Subir `PIT_TOLERANCE` (fácil 2, medio 3, difícil 4) | `src/engine/score.ts` |
| La penalización por caída se siente excesiva | `PIT_PENALTY_SECONDS` (10) | `src/engine/difficulty.ts` |
| El farol dura poco o demasiado | `lanternSeconds` (20 / 18 / 15) | `src/engine/difficulty.ts`, en cada nivel |
| El explorador ve muy poco o demasiado | `vision` (4 / 3 / 3) | `src/engine/difficulty.ts` |
| Música tapa la voz | Bajar `MUSIC` (0.24) | `lib/audio.ts` |
| Todo suena muy fuerte o muy bajo | `MASTER` (0.8) | `lib/audio.ts` |
| Caminar se siente lento o brusco | `WALK_MS` (125 ms por casilla) | `components/game/explorer/controller.ts` |
| El rastro de lo ya visto se ve poco | `memAlpha` (0.34 / 0.15 / 0) | `components/game/explorer/controller.ts` |
| Demasiados o muy pocos pozos | `pits` en `difficulty.ts` | **Cambia los laberintos**: requiere generador v2 (ver README) |

Después de cambiar algo: `npm test` y `npm run calibrate` para ver la nueva referencia por nivel.
