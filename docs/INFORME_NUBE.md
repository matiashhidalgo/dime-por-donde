# Informe de la entrega: etapa 5 (La Sombra) y etapa 6 (auditoría, onboarding y cierre)

Rama de trabajo: `v2-sombra-cierre` (desde `origin/v2`). Pull Request hacia `v2` (no hacia `main`). No se fusionó nada, no se desplegó, no se tocó Vercel ni la configuración del repositorio. Esta sesión no puede avisar al terminar: este informe y el PR son la única señal.

## 1. Qué se hizo, por etapa

### Etapa 5: La Sombra
- **Motor puro** (`src/engine/shadow.ts`, `shadowaudit.ts`, integración en `play.ts`, `generate.ts` y `streak.ts`). Ronda de 12–40 casillas por pasillos (bucle real o ida y vuelta), velocidad 1 o 2 ticks por casilla, fase inicial uniforme, mutador «cazador» (se desvía hacia el explorador a ≤ 4 casillas por pasillos, se rinde a los 8 ticks y vuelve a su ruta), segundo cuerpo en Rachas altas (nunca con cazador). Nunca pisa entrada, salida, estaciones ni las 8 casillas que las rodean. Todo avanza por **ticks del explorador** (un paso que avanza, o la nueva acción «Esperar»); los choques y las pruebas abiertas no cuentan.
- **Contacto:** −1 corazón, −15 % de vela, 3 ticks de inmunidad, la Sombra se retira 3 casillas y vuelve a su ruta. **Farol:** aturde 6 ticks a lo que esté a ≤ 8 casillas.
- **Equidad (obligatoria):** `auditShadow` hace una búsqueda en el espacio (casilla, llaves, estado de la Sombra) con «esperar» como acción y exige, desde la entrada, un camino sin contacto a cada estación y a la salida de longitud ≤ ⌈1,5 × la normal⌉ + 3. Reintento determinista `semilla|v2|shadow|n`; si ninguno pasa, el mapa queda sin Sombra. La misma función `advanceBody` mueve a la Sombra en la partida y en la auditoría.
- **Vistas:** explorador con silueta procedural con ojos solo dentro de su visión, latido WebAudio (más rápido, grave y fuerte con la cercanía por pasillos), pulso del HUD y de la viñeta, vibración, botón/teclas «Esperar»; guía con la **ronda** dibujada (flechas, punto cada 4 casillas) y sin la posición; leyenda de mecánica. Sin nombres.
- **Sonidos nuevos** (`lib/audio.ts`): `heartbeat(cercanía)`, `shadowHit`, `shadowStun`. **Textos** con humor (9 aperturas × 8 colas de contacto, 9 de aturdimiento, 6+ pistas).
- **Racha:** la probabilidad de aparición, la de velocidad 1 y la de cazador suben con el mapa (con tope) desde un arranque suave; desde el mapa 5, a veces dos cuerpos. Todo en `TUNING.shadow`.
- **`RULES_VERSION` 5** y la huella de partida (`fingerprint`, solo v2) incluyen la ronda, así que el sello cambia entre versiones.
- **Simulación** (`simulate.ts`): perfil de «esquiva» por pareja (0,8 / 0,55 / 0,3; ×0,6 contra un cazador) y esperas; `calibrate` informa toques, esperas y victorias con y sin Sombra.

### Etapa 6: auditoría, onboarding y cierre
1. **`npm run audit:variety`** → `docs/AUDIT.md` (7 familias de pruebas + claves, emblemas y glifos; colisiones, uniformidad, clasificadores triviales, espacio estimado, pregunta de los 50 juegos). Prueba de **uso prolongado** (`longuse.test.ts`): 200 expediciones seguidas con los códigos del propio `createCode` y su historial; 280 mapas, ninguna repetición.
2. **Variedad de textos:** bolsas de barajado (`lib/lines.ts`) y plantillas apertura × cola; ≥ 8 variantes por evento común y ≥ 12 por final (24 por situación); test de 50 partidas simuladas.
3. **Onboarding:** «Cómo se juega» en 4 tarjetas (saltable, recordada, accesible con teclado) y pista de una frase la primera vez de cada prueba, cura, Sombra (explorador y guía) y clave de relevo.
4. **QA** (sección 6): casos borde, limpieza tras varias partidas, accesibilidad con axe-core, rendimiento y capturas.
5. **Documentación:** README v2 completo, PLAYTEST v2, resumen consolidado y anexos de las etapas 5 y 6 en `GAME_SPEC_V2.md`, `docs/PUBLICAR.md`, este informe.

## 2. Resultados de tsc, tests y build

| Comprobación | Resultado |
|---|---|
| Línea base (rama `origin/v2`, antes de tocar nada) | `tsc` limpio · **235 tests** en verde · `build` OK (JavaScript inicial de `/`: 247 kB) |
| `npx tsc --noEmit` | sin errores |
| `npx vitest run` | **27 archivos, 286 tests en verde** (los 235 originales + 51 nuevos: `shadow` 24, `shadow-antimemo` 9, `longuse` 6, `variety` 7, `lines` 3, `hints` 2) · 6 min |
| `npm run build` | OK · `/`: 127 kB, **First Load JS 260 kB** |
| `npm run audit:variety 2000` | todas las familias pasan (`docs/AUDIT.md`) |
| axe-core sobre el build final (inicio, tour, unirse, lobby, explorador con Sombra, guía con ronda, a 375 px) | **0 violaciones** (eran 10 antes de las correcciones de la sección 5) |

Los tests nuevos tardan: `shadow-antimemo` ~3,5 min (5.000 sorteos con auditoría), `longuse` ~30 s. Las huellas golden del generador v1 no cambian (los tests de la etapa 1 siguen en verde sin tocarlas).

## 3. Calibración: antes y después

«Antes» es la etapa 4 sin Sombra, medida en este mismo entorno (`npm run calibrate 1000` y `npm run calibrate 300 streak` sobre el árbol de `origin/v2`). «Después» es la rama final. Detalle y diagnóstico en el anexo de la etapa 5 de `GAME_SPEC_V2.md`.

**Partida única (1.000 mapas Difícil v2)**

| Pareja | Gana antes → después | Sin daño | ♥ al ganar | Caídas | Con Sombra: toques / esperas | Gana con / sin Sombra |
|---|---|---|---|---|---|---|
| Competente | 83 % → **80 %** | 69 → 65 % | 2,77 → 2,74 | 0,83 → 0,81 | 0,32 / 0,4 | 78 % / 84 % |
| Normal | 52 % → **49 %** | 39 → 35 % | 2,61 → 2,58 | 1,68 → 1,60 | 0,38 / 0,2 | 46 % / 54 % |
| Despistada | 17 % → 16 % | 10 → 9 % | 2,30 → 2,28 | 2,10 → 1,96 | 0,40 / 0,1 | 16 % / 15 % |

**Racha (300 rachas por pareja)**

| Pareja | Mediana antes → después | p25–p75 | Media antes → después | ≥ 5 mapas |
|---|---|---|---|---|
| Competente | 7 → **6** | 5–9 → 4–7 | 6,75 → 5,72 | 76 → 69 % |
| Normal | 3 → **3** | 1–4 → 1–4 | 3,01 → 2,85 | 24 → 22 % |
| Despistada | 0 → 0 | 0–1 → 0–1 | 0,68 → 0,63 | 0 → 0 % |

- Metas: partida única competente ≈ 80–85 % (80), normal ≈ 50–55 % (49: 1 punto bajo, dentro del ruido de ±1,6 de 1.000 mapas); Racha competente ≈ 5–7 (6), normal ≈ 3–4 (3). La despistada no se tocó.
- **Único reajuste:** el arranque de la Racha. Con la probabilidad de la partida única en el mapa 0 (0,66) la mediana de la pareja normal bajó a **2** mapas. Ahora la Racha parte en 0,30 de Sombra (0,10 rápida, 0,05 cazadora) y sube 0,07 / 0,05 / 0,05 por mapa hasta los topes. Probados sin efecto práctico: `lightLoss` 0,10 y 0,08, `immune` 4, rampas más lentas.
- **Advertencia honesta:** el supuesto «la pareja esquiva con probabilidad p al oír el latido» es un modelo, no una medición. Si las parejas reales nunca esquivan (o siempre), los toques y las victorias cambian. `PLAYTEST.md` lo pide.

## 4. Anti-memorización de La Sombra

Pregunta de la sección 7 de la spec: **¿qué recordaría alguien tras 50 partidas que le ahorre pensar?** Que existe y se mueve con los pasos (interfaz). Nada de su ronda, velocidad, fase, mutador ni aspecto, que cambian por partida; nada de la fase, que no la predice ninguna característica simple. Se aprende a leer el latido y a contar casillas con la guía: habilidad.

Medido (3.000 sorteos reales de `withShadow` sobre 60 laberintos para las estadísticas, 5.000 en los tests):
- Con Sombra el **66,5 %** de los mapas; la auditoría **no dio por perdido ningún mapa** (0 de 3.000); el primer intento pasó en el 99,1 %.
- (a) Instancias idénticas en el mismo laberinto: **0 de ≈ 2.000** (< 0,1 %). Misma ruta con otra fase: 2,1 % (cuenta de cumpleaños por compartir laberintos en la muestra; un laberinto no se repite).
- (b) Fase uniforme sobre el ciclo (χ² < crítico p = 0,001).
- (c) Clasificadores triviales (largo, forma, velocidad, cazador, dónde empieza la ruta, período) ≤ azar + 5 puntos para la fase y para el cuadrante de la ruta.
- (d) Auditoría de equidad: **100 %** de los mapas con Sombra; peor razón camino seguro / normal 1,64 (el límite incluye una holgura de 3 ticks, así que las rutas cortas pueden pasar de 1,5).
- Largos de ruta: 29 valores distintos de 12 a 40; el más común (12) es el 9,8 %. Formas (salvo traslación) distintas en ≈ 97 %, ninguna toma ni el 1 %.
- Mutadores: velocidad 1 ≈ 30 %, cazador ≈ 22 %, bucle ≈ 31 %; en partida única, siempre un solo cuerpo.
- Uso prolongado: 200 expediciones seguidas (280 mapas), ninguna ronda repetida.
- Auditoría global: `docs/AUDIT.md` (todas las familias pasan con N = 2.000).

## 5. Hallazgos y bugs corregidos

Propios del código nuevo (encontrados al probarlo):
1. **Rutas de ida y vuelta sesgadas:** una caminata aleatoria se atascaba en callejones y el 15–18 % de las rutas medía 12 casillas. Pasó a búsqueda en profundidad con presupuesto (largos casi uniformes).
2. **Caché de distancias que se vaciaba** (límite 400 < casillas del mapa): la auditoría con cazador tardaba ~450 ms; con el límite en el tamaño del mapa y la caché compartida por laberinto, ~55 ms.
3. **La Racha era demasiado dura con la Sombra** (mediana de la pareja normal 2 en vez de 3): arranque suave (sección 3).
4. **`hurt` por la Sombra mostraba el mensaje de «oscuridad»** (habría salido «demasiado tiempo a oscuras» al ser tocado): el mensaje genérico se omite para la causa `shadow`.
5. **`waitPlay` compartía la memoria de casillas del estado anterior** (mutación de un estado «valor»): ahora copia (con test).
6. **Pistas de primera vez encima de los chips del HUD a 375 px** y transparentes sobre el mapa: reubicadas y con fondo opaco (verificado con capturas).

Preexistentes en la v2 (los encontró axe-core en el build de producción, 375 px, y se corrigieron porque son claramente erróneos):
7. **Contraste:** blanco sobre el acento `#d9634c` = 3,59:1 (botones primarios) y texto `#2a8a80` sobre la tarjeta = 4,0:1; ambos bajo 4,5:1 (AA). Colores ajustados un tono (`#c4503a` 4,61:1; `#217a71` 4,94:1).
8. **Botón de la leyenda sin nombre accesible** en pantallas pequeñas (el texto está oculto): `aria-label`.
9. **`aria-label` en un `div` sin rol** (código del lobby): `role="group"`.
10. **Sin regiones (landmarks)** en las vistas del explorador y de la guía: ahora `<main>`.

## 6. QA realizado (navegador real: Chromium headless con Playwright)

- **Capturas** a 375 px y 1280 px en `docs/capturas/`: inicio con el recorrido de 4 tarjetas, inicio, explorador con la Sombra al lado (silueta con ojos, contacto con aviso), explorador tras «Esperar», guía con la ronda y la pista, diálogo «Terminar», final de victoria y final de atrapados (16 imágenes). Hechas contra `next dev` con los atajos de desarrollo (`?dev=`, `__teleport`) para llegar a la escena; se tomaron **antes** del ajuste de contraste de la sección 5 (el coral de los botones se ve un tono más claro que en la versión final).
- **Casos borde** (build de producción servido en estático): código con una letra cambiada → mensaje claro; doble toque en «Empezar» y en «Salir»; recarga a mitad de partida → oferta de retomar → vuelve a la vista del explorador; segunda pestaña (el `sessionStorage` es por pestaña: no ve la partida de la otra); botón «atrás» del navegador en plena partida → diálogo «¿Salir de la expedición?», sin pérdida ni errores. Claves de relevo/sello/cura viejas o de otra partida y reanudar la Racha: cubiertas por los tests de motor (`streak.test.ts`, `sealcode`, `curses.test.ts`) y no repetidas a mano en el navegador.
- **Limpieza tras 10 partidas seguidas** (entrar, jugar con teclado, «Esperar», salir): oyentes de `window`/`document` estables (solo queda el `visibilitychange` del motor de audio, que es único), 0 `requestAnimationFrame` activos al salir, 1 `AudioContext` en toda la sesión, 0 errores de página. Memoria tras GC forzado: 7,0 → 8,5 MB en 10 partidas (≈ 0,15 MB por partida, aplanándose; no se identificó la causa, probablemente cachés de Next/React; lo que sí está acotado son las cachés propias).
- **Accesibilidad:** axe-core (reglas WCAG 2 A/AA y buenas prácticas) sobre inicio, tour, unirse, lobby, explorador y guía: 10 violaciones iniciales (sección 5, puntos 7–10) corregidas; **0** al re-ejecutarlo sobre el build final. Objetivos táctiles: «Esperar» mide 110×48 px; los botones del tour y de las pistas ≥ 44 px. `prefers-reduced-motion`: implementado (sin balanceo ni animación CSS del icono, pulso de la viñeta a la mitad, desplazamientos instantáneos) pero **no se probó en el navegador**; tampoco hubo teclado físico ni lector de pantalla reales.
- **Rendimiento:** JavaScript inicial 247 kB → 260 kB (+13 kB: Sombra, recorrido, textos). `withShadow` (sorteo + auditoría) media 25 ms por mapa, máx. ≈ 1,1 s (un cazador con muchos estados); en un teléfono lento ese máximo podría notarse al crear o unirse.

## 7. Decisiones propias y por qué

- **«Esperar» como acción propia.** Con solo pasos, en un callejón la paridad del tick decide si se puede esquivar; sin una acción de espera la auditoría «esperando si hace falta» no tendría correspondencia en el juego. Cuesta vela como un paso para que esperar no sea gratis.
- **Estado de la Sombra con reloj propio y retirada/retorno explícitos** (en vez de «posición = función de los pasos» pura): la cazadora y el aturdimiento rompen la función pura; con el reloj de patrulla y modos explícitos sigue siendo determinista dado el recorrido y auditable con la misma función.
- **Dos cuerpos comparten ruta** (media vuelta de diferencia) y nunca van con cazador: mantiene la auditoría en tiempo expandido barata (un solo reloj) y la ronda dibujada legible.
- **La auditoría no cubre las caídas por pozo** (el explorador reaparece en un punto lejano): se documenta; tocar a la Sombra cuesta un corazón pero nunca deja la partida sin salida.
- **Líneas de texto por bolsas de barajado, memorizadas por semilla** en vez de elegidas por hash de la semilla: con hash, en 50 partidas simuladas solo 34 finales eran distintos (≈ 1 de cada 3 repetido); con bolsas, una línea no vuelve hasta que han salido todas. Coste: los dos dispositivos de una pareja pueden leer finales distintos. Nada depende de que coincidan.
- **Colores del acento un tono más oscuro** (cambia la paleta global levemente) a cambio de pasar AA en los botones principales.
- **No se creó `docs/ESTADO_NUBE.md`:** el trabajo se terminó dentro de presupuesto; lo pendiente está en la sección 8.
- **Capturas dentro del repositorio** (4 MB) para que quien revise el PR vea el resultado sin correr nada.

## 8. Lo que NO se pudo verificar (dicho sin adornos)

- **Audio real.** El latido, el golpe y el aturdimiento están programados y se activan en el navegador, pero en el entorno no hay salida de audio: no se oyó ni una vez cómo suenan, ni su volumen contra la voz de una llamada, ni si el eco del micrófono los repite. (`PLAYTEST.md` lo pregunta.)
- **Dispositivos reales.** Solo Chromium headless con viewport de 375 px emulado. Nada en Safari/iOS (audio al primer toque, pantalla que se apaga, interruptor de silencio), ni en Android (vibración con el latido), ni en un teléfono lento (tiempos de generación, fluidez del Canvas).
- **Lectores de pantalla y teclado real.** axe-core no sustituye a una persona con VoiceOver/TalkBack.
- **Parejas humanas.** Toda la calibración es simulada. No se sabe si la Sombra se lee con el latido, si los puntos cada 4 casillas ayudan, si «Esperar» se usa, ni qué tan repetido se siente tras 25 partidas.
- **Vercel / vistas previas protegidas.** No se tocó ni se probó nada en Vercel; `docs/PUBLICAR.md` son instrucciones.
- **Una Racha de punta a punta por la interfaz** con dos dispositivos (relevo, claves viejas, reanudar entre mapas): solo por tests de motor y de sesión, no a mano en el navegador.
- **Memoria:** el crecimiento residual de ~0,15 MB por partida no se rastreó hasta su causa.

## 9. Cómo reproducir

```bash
git fetch origin v2-sombra-cierre && git checkout v2-sombra-cierre
npm ci
npx tsc --noEmit && npm test && npm run build
npm run calibrate 1000              # antes/después de la partida única
npm run calibrate 300 streak        # ~20 min
npm run audit:variety 2000 --write  # docs/AUDIT.md
```

Los «antes» se obtienen con `git archive origin/v2` en otra carpeta y los mismos comandos.
