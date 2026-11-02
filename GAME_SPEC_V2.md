# Dime por dónde v2: expedición cooperativa

> Fuente de verdad de las etapas 1 a 6 del rediseño. `GAME_SPEC.md` sigue describiendo v1 (motor, generador v1 congelado y sus anexos); donde ambas difieran, manda esta.

## Resumen consolidado (v2 final: etapas 1 a 6)

**Qué es.** Juego web cooperativo asimétrico para dos personas en videollamada, sin backend (Next.js estático + TypeScript). Un **Explorador** ve su vela entre la niebla; una **Guía** ve el mapa completo pero no sabe dónde está el explorador. Se sincronizan **solo por voz**: el código de partida de 8 caracteres, el sello «Bosque · 7F3K», las claves de sello (6), de cura (4) y de relevo (9) se dictan.

**Una expedición.** Un laberinto Difícil con **3 estaciones** (3 pruebas distintas de 4: figuras raras, cerradura de deducción, piano de la bruja, tangram a ciegas) que guardan **3 sellos**; con los tres se abre la salida. **3 corazones compartidos**; la **vela** se gasta con los pasos y achica la visión (3 → 2 → 1 → oscuridad; a oscuras, un margen y luego un corazón). El **pozo** cuesta un corazón y las llaves y deja lejos. Pisar un **remolino** lanza una **maldición** (giro, ceguera, hambre, máscara, espejo) que se cura con una microprueba que resuelve la guía. **La Sombra** (etapa 5): una patrulla que da un paso por cada paso del explorador, con su ronda dibujada en el mapa de la guía pero no su posición; el explorador oye su latido; tocarla cuesta un corazón y vela; el farol la aturde; «Esperar» es una acción. Sin cronómetro ni nombres de objetos.

**Finales.** Victoria (3 sellos y salida), **salida de emergencia** (1 o 2 sellos, solo en peligro) y **atrapados** (0 corazones). **Racha**: mapas encadenados con corazones que se arrastran, roles que se intercambian, escalada con tope y **clave de relevo**.

**Rejugabilidad (prioridad 1).** Todo lo que se ve u oye en una prueba, y la Sombra misma, se **genera por semilla** (§7). Auditorías: `npm run audit:variety` → `docs/AUDIT.md`; tests con 5.000 semillas por prueba; prueba de «uso prolongado» (200 expediciones seguidas); variedad de textos (≥ 8 variantes por evento, ≥ 12 por final).

**Reglas técnicas.** Lógica pura en `src/engine`; constantes de balance en `src/engine/tuning.ts`; el generador v1 y sus huellas golden no se tocan; los cambios de reglas suben `RULES_VERSION` (hoy **5**, en `components/game/session.ts`) y cambian el sello.

**Balance medido (simulación, `npm run calibrate`).** Partida única: competente 80 %, normal 49 %, despistada 16 %. Racha (mediana de mapas): competente 6, normal 3, despistada 0. Metas: ≈ 80–85 / 50–55 y 5–7 / 3–4; la despistada no se toca a propósito. Detalle y «antes/después» en el anexo de la etapa 5. **No hay datos de parejas reales**: `PLAYTEST.md` los pide.

**Dónde mirar.** Reglas: `src/engine/play.ts`, `shadow.ts`, `shadowaudit.ts`, `stations.ts`, `streak.ts`, `curses.ts`. Pruebas: `figures.ts`, `lock.ts`, `piano.ts`, `tangram.ts`. Constantes: `tuning.ts`. Cómo se juega, recalibrar y auditar: `README.md`. Publicar: `docs/PUBLICAR.md`. Informe de esta entrega: `docs/INFORME_NUBE.md`.


---

## 0. Prioridades (en este orden)
1. **Rejugabilidad:** tiene que seguir siendo divertido en la partida 100, no solo en las primeras. Toda decisión se evalúa contra la sección 7.
2. **Que ambos DESCIFREN y se comuniquen.** Nadie puede avanzar solo leyendo un texto o un manual largo.
3. **Tensión real:** se puede perder, con risa y frustración (errores graciosos, consecuencias que duelen).

Contexto: dos personas en videollamada, cada una en su dispositivo, sin compartir pantalla, sin backend. Roles: **Explorador** (ve su entorno con niebla) y **Guía** (ve el mapa, pero no sabe dónde está el explorador). La sincronización entre dispositivos es solo por VOZ (claves dictadas).

## 1. Estructura de una expedición
- Laberinto de dificultad Difícil. El explorador debe reunir 3 sellos (cada uno detrás de una prueba cooperativa, etapa 2) y salir. Hasta la etapa 2, el objetivo es llegar a la salida.
- Sin cronómetro visible ni cuenta regresiva. Cada uno toca «Empezar» cuando quiera, sin ritual de sincronización.
- Los roles se pueden intercambiar entre expediciones.

## 2. Cambios generales
- Un solo nivel: Difícil. Se elimina el selector de dificultad y el modo «Dúo de 3 rondas». Se elimina la opción «con o sin tiempo».
- La guía no tiene cronómetro. Se elimina la cuenta regresiva 3-2-1 y su ritual (y sus sonidos).
- **Sin nombres de objetos en NINGUNA vista:** ni etiquetas en el canvas, ni chips tipo «Cerca: …», ni toasts con nombres específicos, ni descripciones tipo «portal triángulo turquesa», ni nombres de puntos de referencia (hongo, estatua…). Solo íconos, colores y formas.
  - La leyenda de la guía puede conservar nombres genéricos de MECÁNICA (qué hace cada símbolo: pozo, puerta, portal, hielo…), pero no nombres de objetos ni de decoración.
  - Los puntos de referencia deben ser siluetas variadas y distintivas que den pie a que la pareja invente sus propias palabras.
  - Se conservan aria-labels genéricos por accesibilidad.
- El tiempo ya no puntúa. Puede mostrarse como dato informativo al final.

## 3. Tensión y consecuencias
- **Corazones compartidos: 3.** Es estado del explorador; la guía lo sabe porque él lo dice en voz alta.
- **Vela:** la luz se consume con los pasos (diegético, sin número ni cuenta regresiva).
  - El radio de visión baja progresivamente (3 → 2 → 1 → oscuridad total) y hay velas/faroles que recargan.
  - Si la luz se apaga del todo y pasa un pequeño margen sin recuperarla, se pierde un corazón y se reenciende a luz parcial (para que el fallo no sea infinito).
- **Pozo:** pierde un corazón, pierde las llaves que lleve y cae a un punto LEJANO del mapa (determinista a partir de semilla + número de caída, sin repetir destino, en zona alcanzable). La guía tiene que reubicarlo con sus descripciones. Sin penalización de segundos.
- **Remolino (controles invertidos):** más duro que ahora (más pasos y niebla extra). Las maldiciones completas llegan en la etapa 3.
- **Corazones en 0 = derrota:** pantalla «Se acabó la expedición» con humor y estadísticas.
- **Finales graduados** (completos desde la etapa 2): victoria completa, escape parcial, atrapados.
- Todas las constantes de balance viven en `src/engine/tuning.ts`, comentadas.

## 4. Pruebas cooperativas (etapas 2 a 4)
Cada expedición sortea 3 pruebas del catálogo. Cada prueba:
- dos mitades de información;
- casi sin texto;
- retroalimentación inmediata (chispa o «bzzt»);
- errores que cuestan (luz o corazón);
- 60-90 s de duración.

La sincronización entre dispositivos es por claves dictadas por voz: alfabeto sin caracteres ambiguos, con checksum, derivadas de semilla + estación + intento.

- **FIGURAS RARAS (etapa 2):**
  - Un jugador ve una figura abstracta generada proceduralmente y la describe SIN nombres; el otro tiene ~12 figuras parecidas y elige la correcta.
  - Los candidatos son vecinos perceptuales: parecidos pero distinguibles (medido con una métrica sobre los parámetros o una rasterización).
  - La dirección se alterna entre estaciones.
  - Si acierta quien recibe, obtiene una clave que dicta para abrir el sello.
- **CERRADURA DE DEDUCCIÓN (etapa 2):**
  - Puerta con 4-5 espacios y un set de 6-8 glifos generados por la partida.
  - El explorador prueba combinaciones y la puerta muestra luces por espacio (acierto, lugar equivocado, ausente).
  - La guía tiene pistas parciales generadas (adyacencia, posiciones posibles, conteos, orden relativo, exclusiones): insuficientes por sí solas y suficientes junto con la retroalimentación.
  - Hay unos intentos gratis y luego cada fallo cuesta.
- **PIANO DE LA BRUJA (etapa 4):** el juego genera una secuencia de notas que oye uno solo (con audífonos), y el otro tiene un teclado de colores; la describen o tararean.
- **TANGRAM A CIEGAS (etapa 4):** uno ve la silueta objetivo generada, el otro tiene las piezas movibles y rotables; la silueta se describe de palabra.
- **LA SOMBRA (etapa 5):** amenaza que avanza un paso por cada paso del explorador, con patrullas dibujadas en el mapa de la guía pero cuya posición actual ella no conoce; latido de proximidad en el explorador.

## 5. Maldiciones (etapa 3)
Los remolinos pasan a ser maldiciones (controles rotados, visión mínima, etc.). La cura NO es un ritual fijo escrito en un libro: es una microprueba generada (de la familia de las pruebas) que solo la guía puede resolver con la información que el explorador le describe.

## 6. Racha (etapa 3)
- Expediciones encadenadas donde los corazones se arrastran de un mapa al siguiente; termina cuando se acaban los corazones.
- Récord en el historial (cuántos mapas).
- Roles intercambiados entre mapas con un botón.
- Cada mapa siguiente es un poco más duro (más estaciones o menos luz).
- También habrá partida única, que es la opción por defecto.

## 7. PRINCIPIOS ANTI-MEMORIZACIÓN (obligatorios, se auditan en la etapa 6)
1. **Prohibido el contenido fijo aprendible:** nada de catálogos finitos de imágenes, palabras, secuencias, claves o respuestas. TODO lo que se ve u oye en una prueba (figuras, glifos, melodías, siluetas, pistas, claves) se GENERA a partir de la semilla de la partida + id de estación, con un espacio combinatorio enorme.
2. **Las reglas también cambian:** ninguna tabla de equivalencias fija (símbolo→significado) vale entre partidas. Si una prueba usa un mapeo, se sortea por partida y se descubre jugando.
3. **Habilidad, no conocimiento:** la prueba debe exigir inferir, describir o comparar en cada instancia. Pregunta de diseño obligatoria por cada prueba: «¿Qué recordaría alguien tras 50 partidas que le ahorre pensar?». Si hay respuesta, se rediseña.
4. **Variación estructural:** cada prueba lleva mutadores sorteados (tamaños, cantidades, tipos de pista, orientación, estilo visual) para que dos instancias no se sientan iguales.
5. **Sin atajos de patrón:** la respuesta correcta no puede tener regularidad predecible (tamaño, posición en la lista, color, orden de aparición).
6. Las claves dictadas nunca repiten de forma predecible entre partidas.
7. **Tests de diversidad por tipo de prueba, con 5.000 semillas:**
   - (a) colisión de instancias idénticas < 0,1 %;
   - (b) la respuesta correcta se distribuye uniformemente entre posiciones/candidatos;
   - (c) un clasificador trivial basado en una sola característica simple (tamaño, posición, color) no supera el azar por más de un margen pequeño;
   - (d) unicidad de solución donde aplique;
   - (e) dificultad dentro de rango.
8. Cada prueba documenta en el anexo: tamaño estimado de su espacio de instancias, mutadores y cómo evita la memorización.

## 8. Reglas técnicas
- Sin backend. Next.js estático, TypeScript. Lógica pura y testeable en `src/engine`.
- NO se modifica el generador v1 ni sus huellas golden.
  - Los cambios de generación (estaciones, etc.) irán en un generador v2 con versión en el código de partida.
  - La app crea solo partidas v2 (cuando existan).
  - Los códigos v1 siguen validando, y si mantenerlos jugables es barato, que sigan jugables; si no, mensaje claro.
- Constantes de balance en `src/engine/tuning.ts`.
- Rendimiento, accesibilidad, reduced-motion, sin emoji: igual que la spec v1.

## 9. Hoja de ruta
1. Spec v2 + cimientos de tensión (esta etapa).
2. Sellos, estaciones y pruebas Figuras raras + Cerradura de deducción.
3. Racha, maldiciones y finales graduados.
4. Piano de la bruja + Tangram a ciegas.
5. La Sombra.
6. Auditoría anti-memorización, balance, QA y despliegue.

---

## Anexo etapa 1: decisiones y calibración

Estado: reglas de tensión jugables de punta a punta. tsc, 137 tests y build verdes.

### Decisiones tomadas
- **Un solo nivel.** Los códigos nuevos son siempre Difícil del generador v1 (aún no hay generador v2: llega con las estaciones en la etapa 2).
- **Códigos anteriores a v2.** Siguen jugables con las reglas nuevas: un código Fácil o Medio juega su propio mapa; un código Dúo juega su última ronda (Difícil). La pantalla de unirse lo avisa: «código anterior (Dúo), se juega con las reglas nuevas».
- **Reglas por pasos, sin reloj.** `stepPlay(game, state, input)` ya no recibe la hora. Todo lo que pasa depende solo de los movimientos, así que es determinista y simulable.
- **Vela.**
  - Cada movimiento que avanza gasta 1 de luz; los choques contra paredes o puertas cerradas no gastan.
  - El movimiento que la apaga es gratis.
  - Después hay `darkGrace` pasos de margen a oscuras; el siguiente cuesta un corazón y la vela revive con `relight`.
  - La visión baja de 3 a 2 a 1 casillas según la luz; con la vela apagada, solo la casilla propia.
- **Banderas → velas del camino.** Los checkpoints v1 ahora son velas pequeñas: recargan `candleRefill`, una sola vez cada una. Los faroles recargan por completo, también una vez. Ya no hay «regresar a la última bandera».
- **Pozo duro.**
  - Cuesta 1 corazón y todas las llaves que llevaba: vuelven a su lugar y las puertas vuelven a pedirlas. También quita el remolino activo. El explorador cae lejos, en un punto determinista.
  - El punto de caída se sortea con `semilla:fall:n:pozo` entre el `farFraction` más lejano (en pasos) de la «zona segura».
  - La zona segura es el conjunto de casillas desde donde aún se puede terminar sin llaves: suelo simple, sin pozo al lado y a ≥ `exitMargin` de la salida. Se calcula con búsqueda inversa exacta sobre (casilla, llaves), así que **una caída nunca deja la partida sin salida**. Está probado en 40 mapas generados.
  - Nunca repite un punto de caída mientras queden otros.
- **Remolino más duro.** Dura `stepsFactor`× los pasos del mapa y mete niebla (−`fog` de visión, mínimo 1 con vela).
- **Derrota.** Con 0 corazones la partida se congela (ya no acepta movimientos) y muestra la pantalla de derrota.
- **Sin nombres.**
  - Se borró `names.ts`. Los puntos de referencia son **siluetas procedurales** sembradas por partida: 8 familias × parámetros, todas distintas dentro de un mapa y distintas entre mapas, idénticas en las dos pantallas.
  - La guía y la leyenda usan solo palabras de mecánica (llave, puerta, portal, pozo, vela, farol…) y coordenadas.
  - Un test busca en los mensajes, consejos, frases finales y descripciones de la guía todos los nombres v1 (variantes de objetos, colores, formas, nombres temáticos).
  - Los textos de variantes siguen dentro de `themes.ts` solo porque forman parte de la huella golden del generador v1; nunca se muestran.
- **Calificación.** Escaparon → un punto por corazón conservado + 1 por todas las estrellas, máximo 3. Derrota → 0. El tiempo se muestra solo como dato.
- **Fin en la guía.** El doble toque «¡Llegó!» se reemplazó por un diálogo «¿Cómo terminó?» (Escaparon / Se acabó: sin corazones / Seguir jugando). En el resultado, la guía ajusta corazones, estrellas y caídas con +/−.
- **Caída = corte de cámara.** Al caer, la cámara salta al punto de llegada y olvida lo visto alrededor: el explorador tiene que describir dónde está.
- **Recarga de página.** Ofrece retomar la expedición, pero el explorador vuelve a la entrada con los corazones completos. Por eso la clave de sesión subió a `laberinto.live.v2`.
- `/debug` (solo herramienta de desarrollo) todavía muestra colores y formas por nombre.

### Calibración (`npm run calibrate 1000`, 1.000 mapas Difícil)

Configuración final: vela 100, margen oscuro 8, reencendido 0.5, vela chica +0.5, farol +1, pozo `farFraction` 0.35, `exitMargin` 8, remolino ×1.5 con niebla 1.

| Pareja simulada | Gana | ♥ al ganar | Sin daño | Caídas | Apagones | Derrotas con apagón | Movs (mediana) |
|---|---|---|---|---|---|---|---|
| competente | 82 % | 2.29 | 36 % | 0.67 | 0.45 | 74 % | 131 |
| normal | 55 % | 1.96 | 11 % | 1.23 | 0.70 | 71 % | 154 |
| despistada | 26 % | 1.68 | 2 % | 1.56 | 1.00 | 77 % | 159 |

- Con vela 60 (primer intento) las victorias eran 60 / 31 / 11 %: demasiado castigador.
- La mayoría de las derrotas incluye al menos un apagón: la vela es la presión principal y los pozos, el golpe.
- Las parejas simuladas siguen la ruta del solucionador con errores (giros equivocados, pozos sin avisar, desvíos a la luz). No modelan el tiempo de hablar: falta calibrar con parejas reales (PLAYTEST.md).

---

## Anexo etapa 2: diseño de estaciones y pruebas (escrito antes de programar)

### Estaciones y sellos
- **Generador v2** (`version: 2` en el código de partida): construye el mapa con el generador v1 congelado y agrega 3 estaciones con un flujo de RNG propio (`semilla|v2|estaciones|intento`). Huellas golden de v1 intactas.
- **Colocación:**
  - En casillas normales: sin objeto, hielo, punto de referencia ni pozo al lado.
  - A ≥ 7 pasos de la entrada y de la salida y a ≥ 9 pasos entre sí; las distancias se relajan de forma determinista si no caben.
- **Auditoría** (si falla, reintento determinista):
  1. Recorrido completo de estados (casilla, llaves) desde la entrada, incluyendo como estados posibles todos los puntos de caída, sin que la salida sea terminal.
  2. Desde **cada** estado alcanzable deben poder alcanzarse las 3 estaciones y la salida (sin soft-lock).
  3. La zona de caída pasa a exigir que desde ella, sin llaves, se alcancen la salida y las 3 estaciones; las estaciones nunca son punto de caída.
- **Emblema por estación:** silueta procedural (misma maquinaria que los puntos de referencia, en `src/engine/silhouettes.ts`) dentro de un medallón.
  - Los 3 son de familias distintas, sembrados por partida.
  - Se ven igual en el mapa de la guía, en el mundo del explorador y en el HUD de sellos. Sin nombres.
- **Salida sellada:** sin los 3 sellos, pisar la salida no termina la partida («la salida no se abre»).

### Claves dictadas (sello por voz)
- **Formato:** 6 caracteres del alfabeto de los códigos (sin 0/O/1/I/L/V/N), dictados «ABC-DEF». Los 5 primeros salen de `semilla|v2|sello|estación|f`; el último es un checksum ponderado (atrapa una letra cambiada y dos letras invertidas).
- **f** = fallos de la guía (tope 9). El dispositivo del explorador prueba f = 0…9 contra su propia estación: si coincide, abre el sello y cobra f fallos.
- **Errores:**
  - checksum malo → «una letra cambiada»;
  - checksum bien pero sin coincidencia → «esa clave no abre este sello».
  - Las dos cuentan como fallo; la primera clave equivocada por estación es gratis (`keyFreeTries` 1) y las siguientes se pagan. Una clave vacía o incompleta no cuenta. *(Cambio al implementar: ver resultado de la etapa 2.)*
- **¿Qué se recordaría tras 50 partidas?** Nada: la clave depende de la semilla, la estación y f, y dentro de una partida las 30 claves posibles son distintas. Sistema de honor aceptado por la spec.

### Prueba 1: FIGURAS RARAS
- **Generación** (`src/engine/figures.ts`, geometría pura):
  - Una figura es una curva polar cerrada `r(θ)`: k lóbulos (3–7) con amplitud y «filo» (lóbulos redondos o picudos), dos armónicos bajos para asimetría, una muesca en un ángulo y de 0 a 2 agujeros internos.
  - **Familia:** un centro de parámetros sorteado (k, filo y cantidad de agujeros fijos dentro de la familia).
  - **Candidatas:** N (9–12) perturbaciones **independientes** del centro; amplitudes, fases, muesca y posición de agujeros varían. El centro **nunca** se muestra.
  - La correcta se sortea **uniformemente después** de generar el conjunto y la lista se baraja.
  - Como las candidatas son intercambiables, ningún clasificador que mire solo el conjunto (la más central, la más grande, la de más área, la primera, la última) puede superar 1/N salvo por ruido.
- **Métrica perceptual:** rasterizado 32×32 (1 − IoU). Toda pareja de candidatas debe quedar entre `dMin` (distinguibles) y `dMax` (parecidas); si no, se vuelve a muestrear de forma determinista.
- **Mutadores:**
  - dirección A (explorador describe, guía elige y dicta clave) o B (guía describe, explorador elige; acierto abre directo, fallo cuesta al instante);
  - N de 9 a 12;
  - nivel de parecido (ruido bajo, medio o alto);
  - la figura objetivo se muestra rotada 90/180/270° o espejada respecto de las candidatas (a veces sin cambio);
  - agujeros sí o no;
  - estilo visual por tema.
- **Espacio de instancias:** parámetros continuos (≈ 14 dimensiones) × mutadores discretos; prácticamente infinito, la colisión se mide en tests.
- **¿Qué se recordaría tras 50 partidas?** Nada de la respuesta:
  - la figura y sus vecinas son nuevas en cada partida;
  - la posición correcta es uniforme y no hay rasgo simple que la delate (tests de clasificadores triviales con 5.000 semillas);
  - la rotación o el espejo invalida describir con «arriba a la izquierda» fijo.
  Lo único que mejora con la práctica es el vocabulario descriptivo de la pareja, que es habilidad.

### Prueba 2: CERRADURA DE DEDUCCIÓN
- **Glifos** (`src/engine/glyphs.ts`): composición de partes.
  - **Partes:** base (polígono de 3 a 6 lados o gota), marca interna (punto, barra, anillo, dos puntos, ninguna), apéndice (pico, muñón, gancho, ninguno, en un lado) y orientación.
  - **Variación continua:** proporción, deformación de vértices y grosor.
  - Entre dos glifos del mismo set difieren al menos 2 partes.
  - Set de 6 a 8 glifos por estación, nuevo en cada partida. Sin nombres: la pareja los bautiza.
  - La paleta del explorador y la de la guía tienen **órdenes distintos** (no sirve decir «el tercero»).
- **Secreto:** 4 o 5 espacios, con o sin repetición, sorteado uniformemente entre todas las combinaciones válidas.
- **Retroalimentación** (al pulsar «Probar»): luces por espacio (acierto / lugar equivocado / ausente, con color + forma) o, como mutador, solo dos conteos.
- **Pistas de la guía:** 3–5 pictogramas sin texto; la gramática visual es fija porque es la interfaz, no la respuesta. Tipos:
  - **posiciones posibles:** glifo + fila de espacios marcados;
  - **exclusión:** glifo tachado;
  - **adyacencia:** dos glifos unidos;
  - **orden relativo:** glifo → glifo;
  - **conteo:** grupo de glifos = k.
- **Construcción de las pistas:** salen del secreto, así que siempre son verdaderas. Se agregan barajando tipos hasta que quedan entre 8 y un tope de combinaciones compatibles, y el solucionador de referencia («siempre prueba una combinación compatible con todo lo que sabe») termina en ≤ 6 intentos. Si no, se regenera (determinista).
- **Costos:** los primeros intentos fallidos son gratis (`tuning.trials.lockFreeTries`); después, cada fallo cuesta vela y cada tantos fallos pagados, un corazón.
- **Espacio de instancias:**
  - glifos ≈ (5 × 5 × 4 × 4 × orientaciones × continuos)^6–8 sets;
  - secretos de 6^4 = 1.296 a 8^5 = 32.768;
  - pistas: elección de tipos y parámetros.
- **¿Qué se recordaría tras 50 partidas?** Nada de la respuesta:
  - glifos, secreto y pistas cambian por partida y estación;
  - el secreto es uniforme por espacio (chi-cuadrado en tests);
  - cada tipo de pista aparece en una fracción razonable;
  - las pistas solas nunca bastan (≥ 8 combinaciones).
  Lo que se aprende es a deducir estilo Mastermind y a comunicar pictogramas, que es habilidad. La gramática de pictogramas es fija a propósito: es el idioma de la interfaz.

### Balance y recompensas
- Cada sello recarga la vela (`tuning.seal.candleRefill`) y cada `healEvery` sellos devuelve un corazón si falta alguno. *(Al implementar quedó en «cada sello»: ver resultado de la etapa 2.)*
- Un fallo pagado cuesta `tuning.trials.failLight` de vela y cada `heartEvery` fallos pagados en una estación, un corazón.
- La simulación agrega los desvíos a las estaciones y probabilidades de fallo por prueba y perfil de pareja.

---

## Resultado etapa 2 (medido, después de programar)

### Decisiones al implementar
- **Claves:** la primera clave equivocada por estación es gratis (`trials.keyFreeTries` 1). Un dictado con una letra mal oída es error de canal, no de comunicación; castigarlo desde el primero hacía que la clave se sintiera como trámite. Siguen sin ser ilimitadas.
- **Recompensa:** cada sello reaviva la vela por completo y devuelve un corazón (`seal.candleRefill` 1, `seal.healEvery` 1). Con «solo el 2.º sello cura», las parejas normales bajaban a ~45 %.
- **Colocación:** las estaciones quedan a ≤ 3 pasos de la ruta del solucionador (`NEAR`), relajándose a 6 y luego sin límite si no caben. Son desvíos cortos, no excursiones.
- **Costos de prueba** (`tuning.trials`): fallo con costo = −12 % de vela; cada 3 fallos con costo en la misma estación, −1 corazón (causa `trial`). Cerradura: 3 intentos gratis.
- **Mapa de la guía:** la salida v2 lleva 3 cuencas dibujadas; el panel «Estaciones» flota sobre el mapa. Lo que la guía tacha, resuelve o marca vive en `sessionStorage` (`laberinto.guide-stations.v1`) y sobrevive a recargar; los dos dispositivos siguen sin hablarse.

### Calibración (`npm run calibrate 1000`, 1.000 mapas v2)

| Pareja simulada | Gana | ♥ al ganar | Sin daño | Caídas | Apagones | Derrotas con apagón | Movs (mediana) | Sellos | Fallos con costo |
|---|---|---|---|---|---|---|---|---|---|
| competente | 82 % | 2.79 | 69 % | 0.85 | 0.31 | 73 % | 169 | 2.88 | 0.29 |
| normal | 53 % | 2.69 | 40 % | 1.66 | 0.57 | 68 % | 206 | 2.48 | 0.66 |
| despistada | 12 % | 2.67 | 9 % | 2.10 | 1.06 | 73 % | 214 | 1.50 | 1.23 |

- Competente (objetivo 70–85 %) y normal (45–60 %) quedan dentro. **Despistada queda en 12 %, bajo el objetivo de 20–35 %.**
- Diagnóstico: las pruebas casi no pesan (con pruebas perfectas las cifras son las mismas). Lo que hunde a la pareja despistada es caminar más: sus errores de movimiento se acumulan por paso. Sin estaciones, el mismo mapa da 22 %; en v1, 25 %.
- Probado sin éxito: corazones 4–6, vela hasta 300, revelar pozos al ganar un sello. Todo lo que sube a la despistada a 20 % sube a la competente sobre 89 %. Raleando pozos a 6/10 queda 93 / 67 / 21 %.
- Opciones abiertas (decisión de diseño, no de código):
  1. Aceptar la brecha: la despistada modela una pareja que casi no se escucha.
  2. Ayuda que escale con el error: p. ej. el primer pozo de la partida no cuesta corazón, o la vela se reaviva un poco al caer.
  3. Medir con parejas reales antes de tocar nada (PLAYTEST.md).

### Anti-memorización medida (5.000 semillas por prueba, `antimemo.test.ts`)
- **Figuras raras:**
  - Azar 9,65 %. Clasificadores triviales: primera 9,36 %, última 9,80 %, del medio 9,78 %, más grande 9,82 %, más chica 10,28 %, más central 9,68 %, la rara 9,60 %. Ninguno supera azar + 2,5 pts.
  - Posición correcta uniforme por N (chi-cuadrado, p = 0,001).
  - Toda pareja de candidatas ≥ `FIGURE_DISTANCE.min`; sets repetidos: 0 %.
  - Mutadores: espejo 21 %, rotada 34 %, con agujeros 50 %; los 3 niveles de parecido > 20 %.
- **Cerradura:**
  - (a) Todas las pistas son verdaderas.
  - (b) Combinaciones que dejan las pistas: mín. 8, mediana 20, máx. 48.
  - (c) Solucionador independiente: media 2,48 intentos; 7 intentos en 3 de 5.000 casos (0,06 %).
  - (d) Sin pistas: 4,03 intentos de media contra 2,53 con pistas.
  - (e) Secreto uniforme por casilla y glifo (chi-cuadrado). «El primero de la paleta» acierta 15,5 % contra 14,5 % de azar. Las dos paletas nunca coinciden en orden.
  - (f) Tipos de pista: posición 21 %, exclusión 18 %, adyacencia 21 %, orden 19 %, conteo 20 %.
  - (g) Instancias repetidas: 0 %. 5 casillas 50 %, con repetición 40 %, modo «dos cuentas» 29 %.
- **Claves, emblemas y glifos:**
  - Las 30 claves de una partida son distintas.
  - Una clave recordada de otra partida abre algo en 0 de 5.000.
  - Emblemas y sets de glifos repetidos entre partidas: 0 %.
- **Nota de balance:** un solucionador ideal abre la cerradura en 2,5 intentos de media, dentro de los 3 gratis. Los costos de la cerradura vienen del descuido o de pistas mal comunicadas, que es lo que se quiere medir.

### Convivencia con la v1 desplegada
- **Código v2 en el despliegue viejo:** lo rechaza con «Ese código es de otra versión del juego. Actualicen ambos la página.» No hay partida cruzada posible.
- **Código v1 en los dos despliegues:** mismo laberinto (generador v1 congelado), pero reglas distintas. Para que la pareja lo note, el sello de la partida mezcla `RULES_VERSION` (`components/game/session.ts`): un dispositivo viejo y uno nuevo leen sellos distintos, y el lobby dice «Si no coincide, recarguen la página en los dos». Hay que subir `RULES_VERSION` cada vez que cambien las reglas de códigos que un despliegue anterior también acepta.
- **Almacenamiento:**
  - El historial (`laberinto.history.v1`, localStorage) conserva la clave y solo agrega campos (`result: "lost"`, `hearts`). Ninguna versión filtra al leer ni al guardar: nada se pierde al ir y volver. El despliegue viejo muestra una derrota v2 con la etiqueta de no-victoria.
  - Sonido y cruceta: mismas claves y formato.
  - La partida en curso pasó a `laberinto.live.v2` (sessionStorage, por pestaña): recargar a mitad de una partida justo cuando cambia el despliegue no la retoma.
  - Las notas de la guía usan una clave nueva: `laberinto.guide-stations.v1`.

---

## Anexo etapa 3: Racha, maldiciones y finales graduados (escrito antes de programar)

### Racha
- **Código:** sigue siendo de 8 caracteres. En v2, la cabecera que en v1 era «Dúo» pasa a significar **Racha** (en v2 no existían códigos Dúo; la v1 desplegada rechaza cualquier v2). Partida única = cabecera «Difícil», la opción por defecto.
- **Mapa i** (0, 1, 2…): generador v2 con semilla `semilla#r{i}` y tema sorteado entre los que no usó el mapa anterior. Ambos dispositivos generan el siguiente sin dictar nada.
- **Roles:** se intercambian siempre, en cada mapa, sin opción. El rol del mapa i sale del rol del mapa 0 y de la paridad de i.
- **Escalada:** dos niveles distintos, ambos con tope y en `tuning.streak`.
  - **Nivel de mapa = i.** Lo calculan los dos dispositivos, así que puede cambiar lo que ve la guía:
    - pozos extra fuera de la ruta, colocados antes de las estaciones (la auditoría de estaciones vuelve a probar que no haya soft-lock);
    - figuras más parecidas (el sorteo de parecido se corre hacia «alto»).
  - **Nivel de juego = i + huidas × `escapeBump`.** Solo lo usa el dispositivo del explorador:
    - vela más corta;
    - menos intentos gratis en cerradura y claves.
  - Una clave de relevo mal reconstruida solo puede descuadrar reglas del explorador, nunca el mapa.
- **Corazones:** se arrastran. Cada mapa empieza con los corazones con que terminó el anterior. Tras una salida de emergencia, con 1.
- **Clave de relevo:** 9 caracteres del alfabeto de los códigos, dictados «ABC-DEF-GHK».
  - 6 de carga: índice del mapa (0–63), corazones (0–3), resultado (completa / emergencia / atrapados), huidas acumuladas (0–15), sellos totales (0–255) y corazones perdidos totales (0–127). Son 29 bits y 29⁶ ≈ 2^29,1.
  - 2 de firma: hash(código de partida, índice).
  - 1 de verificación (la misma suma ponderada de los códigos: atrapa una letra cambiada y dos letras invertidas).
  - Errores, cada uno con su mensaje: verificación mala («una letra cambiada»), índice equivocado («esa clave es del mapa X»), firma que no coincide («esa clave es de otra racha»).
  - Respaldo «No tengo la clave»: elegir corazones y cómo salieron, con aviso de honor.
- **Fin:** 0 corazones. Pantalla de resumen: mapas, sellos totales, corazones perdidos y una frase. En el historial queda una entrada de tipo racha; la mejor racha aparece en la pantalla de inicio.
- **Reanudar:** la racha en curso vive en `sessionStorage` (`laberinto.streak.v1`, con try/catch).
- **¿Qué se recordaría tras 50 partidas?** Nada que ahorre pensar.
  - Cada mapa es nuevo (semilla + índice).
  - La clave de relevo no es una respuesta: codifica el estado de esa racha y no abre nada en otra.

### Maldiciones (reemplazan a los remolinos en v2; los códigos v1 conservan el remolino)
- **Sorteo:** pisar un remolino impone la maldición número k de la partida (k = 0, 1, 2…). Tipo, parámetros, duración (en pasos) y tipo de cura salen de `semilla|maldición|k`.
- **Tipos:**
  - **giro:** los controles rotan 90°, a un lado o al otro según el sorteo;
  - **ceguera:** la vista se limita a 1;
  - **hambre:** la vela se gasta al doble;
  - **máscara:** desaparecen del HUD los corazones, la vela y los sellos;
  - **espejo:** el mundo se dibuja espejado y los controles izquierda/derecha se invierten.
- La maldición se acaba sola al terminar sus pasos. Una maldición nueva reemplaza a la anterior.
- **Cura:** microprueba que solo resuelve la guía con lo que el explorador le describe. La cura exitosa se paga con una clave de 4 caracteres (3 de `semilla|cura|k|f` + verificación); f = errores de la guía, con tope de 9.
  - El dispositivo del explorador prueba f = 0…9.
  - Con f = 0 la cura regala un poco de vela (`curse.cureRefill`). Cada error de la guía resta `curse.failLight` de esa recompensa (nunca resta más vela de la que tenía).
  - Una clave equivocada no cuesta nada: la maldición sigue corriendo, que ya es el costo.
  - **a) Sigilo y antídoto:**
    - El explorador ve en su HUD un sigilo procedural (la maquinaria de figuras) con k + 1 muescas alrededor.
    - La guía ve 6 antídotos: el sigilo verdadero y 5 vecinos perceptuales, dibujados en trazo en vez de relleno.
    - Mutadores: giro o espejo del sigilo, parecido, agujeros, estilo.
  - **b) Eco:**
    - El explorador ve parpadear una secuencia de 3 o 4 glifos (la maquinaria de glifos, set de 5 o 6) y puede repetirla.
    - La guía la marca en un teclado de esos glifos, en otro orden, y obtiene la clave.
    - Mutadores: largo de la secuencia, tamaño del set, repetición sí o no, ritmo del parpadeo.
- **Panel «Maldiciones» de la guía:** lleva la cuenta k con avance manual (− / +). Las muescas del sigilo y del eco le dicen al explorador qué número decir. Si se descuadran, la clave no cura: es parte de la gracia.
- **Espacio de instancias:**
  - Sigilo: el de figuras (≈ 14 dimensiones continuas) × giros y espejos × 6 posiciones.
  - Eco: sets de glifos (≈ (5·5·4·4·orientación·continuos)^5–6) × 5^3…6^4 secuencias.
  - Claves de cura: 29³ por k y f.
- **¿Qué se recordaría tras 50 partidas?**
  - Qué hace cada tipo de maldición: eso es la interfaz, como saber que un pozo duele. Cuál toca, cuándo, hacia dónde gira y cuánto dura cambia por partida y por k.
  - La cura nunca se repite: sigilos y glifos nuevos, posición correcta uniforme, secuencia uniforme por casilla.
  - Se verifica con 5.000 semillas por tipo de cura, como en la etapa 2.

### Finales graduados
- **Victoria completa:** 3 sellos y salida.
- **Salida de emergencia** (escape parcial):
  - Solo en peligro (corazones ≤ 1 o vela apagada) y con 1 o 2 sellos.
  - Pisar la salida en ese estado ofrece confirmar.
  - En partida única es un final propio. En Racha, la racha sigue con 1 corazón y la penalización de huida en el siguiente mapa.
- **Atrapados:** 0 corazones. Termina la partida o la racha.
- Cada final tiene su pantalla y sus frases. La guía confirma el resultado entre los tres.

## Resultado etapa 3 (medido, después de programar)

### Decisiones al implementar
- **Arranque suave de la Racha.** El mapa 0 de una racha igual a una partida única hacía imposibles las metas (competente: mediana 3 mapas). La racha empieza más amable y sube:
  - pozos: −12 en el mapa 0, +2 por mapa, tope +6 (`streak.pits`), nunca menos de 6 en total;
  - vela: ×1,5 en el nivel de juego 0, −0,10 por nivel, piso ×0,65 (`streak.candleStart/Shrink/Floor`);
  - figuras más parecidas desde el mapa 2 y «muy parecidas» desde el 5;
  - intentos gratis: uno menos en la cerradura cada 2 niveles (mínimo 1); claves de sello sin intento gratis desde el nivel 3.
- **Corazones tras una huida:** 1. Cada huida suma 2 niveles de juego a todos los mapas siguientes.
- **Almacenamiento real** (cambia lo previsto en el anexo):
  - la racha en curso no usa `laberinto.streak.v1`: vive dentro de `laberinto.live.v2` (sessionStorage), con `streak`, `phase` (jugando / clave / entre mapas), `relay` y `guess`. Recargar en cualquiera de las tres fases la retoma;
  - rachas terminadas: `laberinto.streaks.v1` (localStorage), un registro por código de racha;
  - cada mapa también queda en `laberinto.history.v1` como entrada normal, con campos nuevos opcionales `ending`, `seals`, `streakIndex`. Una salida de emergencia se guarda como `result: "won"` + `ending: "escaped"`, así un despliegue viejo no ve un valor que no conoce;
  - cuaderno de maldiciones de la guía: `laberinto.guide-curses.v1` (sessionStorage, por semilla del mapa).
- **La guía también escribe la clave al perder:** la clave final trae los totales exactos para el resumen. Con «No tengo la clave» la racha sigue por honor: corazones (y sellos, si fue huida) elegidos a mano.
- **La cura no se ve en el HUD hasta que el explorador abre el chip «Curar»**; el chip muestra el tipo (icono + nombre) y cuánto falta en puntos, sin número.
- **Panel de estaciones de la guía:** en teléfonos empieza plegado en una píldora «Estaciones 0/3»; «Maldiciones» es otra píldora debajo. Las dos hojas son paneles inferiores con scroll.
- `RULES_VERSION` = 3 (en v2 el remolino ahora maldice).

### Calibración de rachas (`npm run calibrate 300 streak`, 300 rachas por pareja, tope 30 mapas)
| Pareja | Mapas (mediana) | p25 | p75 | Media | Sellos por racha | Huidas por racha | ≥ 5 mapas |
|---|---|---|---|---|---|---|---|
| Competente | 7 | 5 | 9 | 6,82 | 22,2 | 0,14 | 79 % |
| Normal | 3 | 1 | 5 | 3,20 | 11,3 | 0,14 | 29 % |
| Despistada | 0 | 0 | 1 | 0,70 | 3,7 | 0,06 | 0 % |

- Metas: competente ≈ 5–7 y normal ≈ 3–4 se cumplen. La despistada queda en 0 con cualquier ajuste probado: es la misma brecha de la partida única, y por decisión (opción 3) no se toca hasta medir con parejas reales.
- Con 120 rachas la mediana competente salía 7 y con 300, 9 (cola larga): por eso la tabla final usa 300 y un ajuste más empinado (+2 pozos por mapa, −0,10 de vela por nivel).

### Partida única con maldiciones y salida de emergencia (`npm run calibrate 1000`)
| Pareja | Gana | Emergencia | Maldiciones por partida |
|---|---|---|---|
| Competente | 83 % | 2 % | 0,96 |
| Normal | 54 % | 3 % | 1,14 |
| Despistada | 15 % | 3 % | 1,22 |

El balance de la partida única queda igual que en la etapa 2 (82 / 57 / 14).

### Anti-memorización medida (5.000 semillas por cura)
- **Sigilo y antídoto:**
  - Posición correcta uniforme (chi-cuadrado 8,4; crítico 20,5 a p = 0,001). «La primera» acierta 18,0 % y «la última» 16,8 %, contra 16,7 % de azar.
  - Mutadores: espejo 20 %, girado 51 %, agujeros 50 %, parecido bajo/medio/alto en tercios. Sets de antídotos repetidos: 0 %.
- **Eco:**
  - Set de 5 o 6 glifos (49 / 51 %), largo 3 o 4 (51 / 49 %), con repetición 50 %, ritmo 650 / 800 / 950 ms en tercios.
  - Teclado igual al orden de la secuencia: 0 de 5.000. «La primera tecla es el primer símbolo» acierta 17,9 % (azar ≈ 18 %). Instancias repetidas: 0 %.
  - Uniformidad por casilla: 6 pruebas de chi-cuadrado en `antimemo.test.ts`, con corrección de Bonferroni (z = 3,59 para la familia). Sin corregir, una casilla de los sets de 5 en las semillas «EC» daba 19,3 contra 18,7: falsa alarma esperable al hacer 6 pruebas; otros prefijos de semilla salen limpios.
- **Maldiciones:** los 5 tipos salen 19–21 % cada uno; sigilo y eco 50 / 50; 18 pasos de media.
- **Claves de cura:** las 40 claves de 4 maldiciones × 10 errores son distintas en todas las partidas. Una clave de otra partida cura algo en 1 de 5.000 (lo esperable con 10 / 29³ ≈ 0,04 %).
- **Clave de relevo:** cualquier letra cambiada y cualquier par de letras vecinas invertidas se detectan; una clave de otra racha pasa en menos de 0,5 % de los casos (`streak.test.ts`).

---

## Anexo etapa 4: PIANO DE LA BRUJA y TANGRAM A CIEGAS (escrito antes de programar)

### Estaciones con 4 pruebas
- **Tipos:** cada mapa sortea 3 tipos **distintos** entre figuras, cerradura, piano y tangram (`semilla|v2|station-kinds`). Cada tipo aparece en el 75 % de los mapas.
- **Dirección por estación:**
  - **A:** la guía actúa en su dispositivo y dicta una clave que lleva sus fallos.
  - **B:** el explorador actúa; el acierto abre el sello y el fallo cuesta al instante.
  - Las estaciones que no son cerradura toman sus direcciones de `[A, B, al azar]` barajado, para que casi siempre actúen los dos.
  - La cerradura no cambia: las luces siempre están del lado del explorador.
- **Contenido:** todo sale de `semilla|v2|station|índice` (la misma llave de estación de la etapa 2), así que los dos dispositivos abren lo mismo desde el mismo emblema.
- **Costos iguales en ambas direcciones:**
  - piano y tangram tienen `trials.pianoFreeTries` y `trials.tangramFreeTries` comprobaciones gratis;
  - después, cada fallo cuesta `failLight` y cada `heartEvery`, un corazón;
  - cuando la guía actúa, la clave lleva f fallos y el explorador paga max(0, f − gratis): ninguna dirección es más barata.
- **Comprobar no castiga lo incompleto:** está deshabilitado mientras falten notas o haya piezas solapadas. Solo cuenta una respuesta completa y errónea.
- **RULES_VERSION 4:** el mismo código v2 sigue dando el mismo laberinto y las mismas estaciones, pero el sorteo de tipos y direcciones cambió. Una pestaña con reglas 3 y otra con reglas 4 verían pruebas distintas en la misma estación; el sello («Bosque · 7F3K») ya incluye la versión de reglas, así que lo delata antes de empezar. Los códigos v1 no cambian.

### Prueba 3: PIANO DE LA BRUJA
- **Roles:**
  - quien **escucha** oye una melodía generada (con audífonos) y la describe;
  - quien **toca** tiene un teclado de 6–8 teclas con color y forma y arma la melodía.
  - **Dirección A:** escucha el explorador y toca la guía, que al acertar recibe una clave.
  - **Dirección B:** escucha la guía y toca el explorador; acertar abre el sello.
- **No depende de que el audio pase por la llamada.**
  - Cada uno oye solo su dispositivo; quien toca prueba teclas para comparar con lo que le cuentan («empieza en una media, sube a la más aguda, baja dos»).
  - Aviso visible: «Usa audífonos quien escucha».
- **Generación** (`src/engine/piano.ts`):
  - **Escala o modo, uno de 9:** pentatónica mayor y menor, mayor, menor natural, dórico, frigio, lidio, menor armónica y tonos enteros.
  - **Tónica:** MIDI 53–65.
  - **Timbre, uno de 5:** campana, flauta, cuerda pulsada, madera y órgano.
  - **Teclado:** K = 6–8 notas consecutivas de la escala desde la tónica, en un **orden de teclas permutado** (nunca ordenado de grave a agudo ni al revés). Color y forma de cada tecla se sortean aparte del orden y de la altura.
  - **Melodía:** L = 4–6 notas uniformes sobre las K teclas, con o sin repetición (50 %).
  - **Ritmo y tempo:** duración por nota de {½, 1, 1½, 2} pulsos (al menos 2 duraciones distintas); pulso de 0,30–0,50 s.
- **Filtro de «interés»** (simétrico bajo inversión grave↔agudo, para no sesgar las posiciones). Se rechazan las melodías que:
  - no tienen al menos 3 alturas distintas;
  - abarcan menos de 3 grados;
  - no cambian de dirección al menos una vez (fuera las monótonas);
  - repiten la misma nota 3 veces seguidas.
  - Sin catálogo: nada sale de una lista de melodías.
- **Respuesta:**
  - Cuenta la secuencia de alturas; el ritmo ayuda a describir y a separar en trozos, pero no se valida.
  - «Escuchar lo que armé» toca la secuencia con el ritmo real.
  - «Comprobar» exige las L casillas llenas y contesta «N de L en su sitio».
- **Accesibilidad:**
  - **Modo visual gratis:** quien escucha ve barras (alto = altura, ancho = duración); quien toca ve una barra de altura en la tecla al pulsarla.
  - Si el sonido está en «off» o no hay WebAudio, el modo visual se activa solo.
  - El audio solo suena tras un gesto, y se repite sin límite.
- **Espacio de instancias:**
  - fijo: 9 escalas × 13 tónicas × 5 timbres × 5 tempos;
  - teclados: (K! − 2) por K, unos 700–40.000;
  - melodías filtradas: ~10²–10⁴;
  - ritmos: ~4^L.
  - Del orden de 10¹² o más; la colisión se mide en tests.
- **¿Qué se recordaría tras 50 partidas?** Nada de la respuesta.
  - El mapeo tecla→nota es nuevo cada vez y nunca es el orden natural.
  - Colores y formas no dicen nada de la altura.
  - Cada posición de la melodía es uniforme sobre las teclas: no empieza ni termina siempre en la tónica.
  - El contorno cambia (entropía medida).
  - Tests: «la primera tecla es la primera nota», «la melodía sube», «empieza en la más aguda» y «la tecla de cierto color» ≈ azar.
  - Lo que mejora es el vocabulario de contorno de la pareja y ordenar teclas de oído: habilidad.

### Prueba 4: TANGRAM A CIEGAS
- **Roles:**
  - quien **ve** tiene la silueta objetivo, rellena y sin cuadrícula;
  - quien **arma** tiene 3–5 piezas (más un señuelo a veces) y un tablero con imán.
  - **Dirección A:** ve el explorador y arma la guía, que recibe una clave.
  - **Dirección B:** ve la guía y arma el explorador; acertar abre el sello.
- **Generación** (`src/engine/tangram.ts`):
  1. **Región:**
     - P = 3–5 piezas y área A según P: 15–18, 17–21 o 19–23 celdas (final; el borrador decía 9–13 / 12–17 / 15–20).
     - Crece al azar en una caja de 7×7, prefiriendo celdas con **menos** vecinas (forma ramificada; final, ver «Resultado etapa 4»).
     - Se rechaza si tiene agujeros, si llena más del 80 % de su recuadro o si tiene menos esquinas cóncavas que las del mutador. Así quedan fuera los rectángulos y las casi convexas.
  2. **Partición** (la solución existe por construcción):
     - P semillas separadas crecen en turnos aleatorios hasta cubrir la región; cada pieza tiene 2–6 celdas y es conexa.
     - Ninguna pieza es congruente con otra, ni girada ni espejada (sin simetrías ambiguas).
  3. **Señuelo (mutador):** una pieza sacada de cortar **otra** región con el mismo área y número de piezas, no congruente con las verdaderas (final; el borrador decía «del tamaño de una verdadera»). Ambos lados ven el aviso «sobra una pieza».
  4. **Presentación:**
     - La silueta se muestra con giro uniforme de 0–3 cuartos y posición al azar dentro de su marco.
     - Las piezas salen en orden barajado y, si se permiten giros, cada una con un giro al azar.
     - Sin giros (mutador), las piezas ya vienen orientadas y solo hay que colocarlas.
- **Mutadores:**
  - número de piezas;
  - área;
  - giros sí/no (70 / 30);
  - señuelo sí/no (40 %);
  - entrantes: pocas (4–6 esquinas cóncavas) o muchas (7–10) (final; el borrador decía 2, 3 o 4+).
- **Validación exacta, por forma:**
  - la unión de las piezas puestas en el tablero, sin solapes, debe ser igual a la silueta salvo traslación y giro (el espejo no vale);
  - las piezas que quedan en la bandeja no cuentan;
  - cualquier teselación alternativa es correcta;
  - los tests miden cuántas hay con un solucionador exacto y se regenera si sobran tantas que la silueta ya no obliga a pensar.
- **Controles:**
  - tocar una pieza de la bandeja la pone en el tablero, seleccionada;
  - se arrastra con el dedo o el ratón con imán a la cuadrícula;
  - se gira con un botón o tocándola otra vez;
  - arrastrarla fuera del tablero la devuelve.
  - Alternativa de teclado: flechas, R para girar y Supr para devolver, más botones de ≥ 44 px.
- **Espacio de instancias:**
  - poliominós de 15–23 celdas: unos 10³–10⁷ formas libres por área;
  - particiones: decenas a miles por región;
  - × giros, posiciones, señuelo y orden.
  - La colisión de siluetas canónicas se mide en tests.
- **¿Qué se recordaría tras 50 partidas?** Nada de la respuesta.
  - Siluetas y piezas se generan cada vez, sin catálogo de figuras.
  - El giro en que llegan las piezas no es el de la solución: «déjala como viene» ≈ ¼.
  - El señuelo no es la más grande, ni la más chica, ni la primera ni la última de la bandeja: ≈ azar.
  - La silueta no aparece siempre en la misma esquina ni orientación.
  - Lo que se aprende es describir formas en unidades («tres de ancho, con un diente abajo a la izquierda») y armar rompecabezas: habilidad.

## Resultado etapa 4 (medido, después de programar)

### Decisiones al implementar
- **Estaciones:** cada mapa baraja las 4 pruebas y toma 3 distintas. Direcciones: una A, una B y la tercera al azar, barajadas (la cerradura siempre es del explorador). Cada prueba sale en ~75 % de los mapas y cada dirección en 40–60 % (400 mapas, `trialplay.test.ts`).
- **Costos iguales en las dos direcciones:** piano y tangram tienen 1 intento gratis (`trials.pianoFreeTries`, `trials.tangramFreeTries`); después, cada fallo cuesta `failLight` y suma al conteo del corazón. Si actúa la guía, sus fallos viajan en la clave y se cobran al abrir, con el mismo intento gratis.
- **Tangram, parámetros finales** (cambian lo previsto en el anexo; el anexo ya está corregido):
  - Áreas 15–18 / 17–21 / 19–23 para 3 / 4 / 5 piezas; entrantes «pocas» 4–6 y «muchas» 7–10.
  - La región crece prefiriendo celdas de frontera con **menos** vecinas (peso 1/n). El crecimiento compacto daba manchas redondas que se repetían: 15,9 % de siluetas repetidas. Con crecimiento ramificado y áreas mayores baja a 0,08 %.
  - El señuelo sale del mismo proceso que las piezas reales (otra región cortada con el mismo área y número de piezas). Uno «del mismo tamaño» se detectaba por ser el menos compacto: 28,5 % contra 20,6 % de azar.
  - Se descartan instancias con más de 24 teselaciones alternativas.
  - Si 400 intentos no dan el número de entrantes del mutador, se acepta cualquier valor ≥ 2. Pasa en ~19 % de las «pocas» (probador de 500 semillas). Solo cambia la variedad, no filtra la respuesta.
- **Piano:**
  - la melodía se compara por nota (midi), así que dos teclas no pueden sonar igual;
  - el cursor de las casillas empieza vacío (tocar teclas para oírlas no escribe nada);
  - al escribir, el cursor avanza a la casilla siguiente aunque ya esté llena, porque reescribir es lo común tras un fallo;
  - el teclado muestra una regla de altura solo para las teclas ya oídas, y solo en modo visual.
- **Audio:**
  - el audio de la melodía va por un bus propio que baja la música mientras suena;
  - se desbloquea con el toque de «Escuchar»;
  - con sonido «apagado», ese dispositivo pasa solo a modo visual.
- `RULES_VERSION` = 4. Cuaderno de la guía: `laberinto.guide-stations.v2`, que agrega `misses` y `melodies` (el v1 se ignora, no se migra).
- Textos sin nombres de objetos: la silueta se describe en «cuadritos» y las teclas por forma y color (la forma va en el aria-label).

### Calibración
Mismas metas que la etapa 3. La simulación modela piano y tangram como fallos geométricos con aprendizaje (`TRIAL_LEARN` 0,6).

**Partida única (1.000 mapas):**

| Pareja | Gana (antes → ahora) | Sellos | Fallos pagados | Piano (s, mediana) | Tangram (s, mediana) |
|---|---|---|---|---|---|
| Competente | 83 % → 83 % | 2,84 | 0,24 | 40 | 50 |
| Normal | 54 % → 52 % | 2,40 | 0,54 | 100 | 65 |
| Despistada | 15 % → 17 % | 1,49 | 0,84 | 120 | 160 |

**Racha (300 rachas por pareja):**

| Pareja | Mediana (antes → ahora) | p25–p75 | Media | ≥ 5 mapas |
|---|---|---|---|---|
| Competente | 7 → 7 | 5–9 | 6,82 → 6,75 | 79 % → 76 % |
| Normal | 3 → 3 | 1–4 | 3,20 → 3,01 | 29 % → 24 % |
| Despistada | 0 → 0 | 0–1 | 0,70 → 0,68 | 0 % |

Sin cambios de ajuste: todo queda dentro de las metas.

### Anti-memorización medida (5.000 semillas, `antimemo-stage4.test.ts`)
- **Piano:**
  - Instancias repetidas: < 0,1 %.
  - El orden del teclado nunca es la escala ni la escala al revés. La tecla más grave cae en cualquier lugar (chi-cuadrado por tamaño de teclado).
  - Nota correcta uniforme por casilla: 12 pruebas, Bonferroni z = 3,77.
  - Clasificadores al nivel del azar (+ margen): «primera tecla», «última tecla», «la más aguda primero», «la más grave primero», «primer color», «empieza o termina en la tónica». Las melodías siempre subiendo o siempre bajando no aparecen (0).
  - Contornos: entropía 5,99 bits, 184 contornos distintos; el más común (sube-baja-sube) aparece en 7,3 %. Es inherente a las melodías de 4 notas con el filtro de interés.
  - Todos los mutadores aparecen: 9 escalas, 5 timbres, teclados de 6/7/8, largos de 4/5/6, repetición ~50 %, 5 tempos y ritmo con ≥ 2 duraciones.
- **Tangram:**
  - La solución construida siempre encaja.
  - Siluetas repetidas (forma canónica): 0,08 %.
  - Calidad: sin agujeros ni pellizcos, ≥ 2 entrantes, llenado ≤ 80 % y piezas no congruentes entre sí.
  - Teselaciones: mediana 1, p90 2, máximo 12 (tope 24).
  - Giro y posición de la silueta uniformes. «Déjala como viene» no supera el azar. El señuelo no es la más grande, la más chica, la primera, la última, la más compacta ni la menos compacta (azar + 4 puntos).

### Compatibilidad con v1
- El mapa v1 no cambia: las pruebas se sortean en flujos de azar propios de v2 (`seed|v2|station-kinds`, `seed|v2|station|i`). Los tests de «mismo código → mismo laberinto» y la auditoría del generador siguen en verde.
- Las claves de almacenamiento v1 no se tocaron. Solo cambió el cuaderno de estaciones de la guía, que es de v2 (`.v1` → `.v2`).
- Un dispositivo con el despliegue anterior (`RULES_VERSION` 3) puede sortear otras pruebas con el mismo código. Por eso la frase del sello («Bosque · 7F3K») cambia con `RULES_VERSION` 4: si los dos leen frases distintas, saben que uno tiene otra versión antes de jugar.

---

## Anexo etapa 5: LA SOMBRA (diseño y decisiones; los números medidos están más abajo)

### Modelo (`src/engine/shadow.ts`, `shadowaudit.ts`)
- **Ticks, no relojes.** La Sombra solo se mueve cuando el explorador gasta un *tick*: cada movimiento que va a alguna parte (deslizarse por hielo, un portal o caer cuentan **uno**) y la nueva acción **«Esperar»** (quieto un tick; botón y teclas Espacio/E). Los choques contra paredes o puertas cerradas no cuentan. Con una estación o una cura abierta no hay ticks (esas pantallas no llaman a `stepPlay`). «Esperar» gasta vela como un paso y hace avanzar maldiciones: esperar a que pase una ronda tiene precio.
- **Ronda.** Un `Shadow` es parte del `Game` (solo v2; un código v1 nunca lo tiene): ruta de 12 a 40 casillas por pasillos, sobre suelo liso (sin objetos que la bloqueen, hielo, pozos, puertas, portales ni remolinos) y **nunca en la entrada, la salida, una estación ni las 8 casillas que las rodean**. Dos formas: **bucle** (ciclo real por un lazo del laberinto: la ruta más corta alrededor de una arista cuyo largo cae en el rango) o **ida y vuelta** (camino simple por búsqueda en profundidad con presupuesto, que insiste en el largo sorteado). Velocidad: 1 casilla por tick o por 2. Fase inicial: uniforme sobre el ciclo. Posición = función del reloj de patrulla (`patrolCell`), que solo avanza con ticks.
- **Cuerpos.** Uno; desde el mapa `twoBodiesFrom` de una Racha, con probabilidad, dos que comparten ruta media vuelta desfasados (nunca con cazador).
- **Mutador «cazador».** Si un explorador queda a ≤ `hunterRadius` casillas **por pasillos**, la Sombra deja su ruta y avanza hacia él hasta `chaseTicks` ticks; luego (o si lo pierde a más de radio + 1) vuelve por el camino más corto a la casilla de su ruta más cercana y retoma la patrulla desde ahí. Determinista dado el recorrido del explorador. Nunca entra en las casillas prohibidas.
- **Contacto.** Se compara, tras cada tick, si algún cuerpo estaba antes o está después en alguna casilla que el explorador cruzó (así un deslizamiento o un cruce frente a frente no se «saltan» a la Sombra). Efecto: −`hurt` corazón (causa `shadow`), −`lightLoss` de vela, **inmunidad** de `immune` ticks (sin golpes encadenados) y el cuerpo **se retira** `retreat` casillas lejos del explorador y vuelve a su ruta.
- **Farol.** Recoger un farol aturde (congela) `lanternStun` ticks a los cuerpos a ≤ `lanternRange` casillas por pasillos: da valor táctico al farol (hay que pensarlo, no solo recargar).
- **Una sola función de avance.** `advanceBody` mueve a la Sombra en la partida y en la auditoría: lo que se demuestra es lo que se juega.

### Equidad (auditoría obligatoria, `auditShadow`)
Búsqueda de camino más corto en el **espacio expandido en el tiempo**: estados (casilla, llaves, estado de la Sombra), con *esperar* como acción y los mismos movimientos que usa el solucionador (portales, hielo, llaves). Estado de la Sombra: sin cazador, el reloj módulo el período (matriz tipada, ~8 ms); con cazador, el cuerpo completo (modo, casilla, cuenta de persecución, cadencia; ~55 ms de media, máx. ~0,3 s). Exigencia: desde la entrada, **a cada estación y a la salida** existe un camino sin tocar ningún cuerpo de longitud ≤ ⌈1,5 × la ruta normal⌉ + `fairSlack` (3) ticks. Si una semilla no pasa se reintenta de forma determinista (`semilla|v2|shadow|intento`, hasta `attempts` 40); si ninguna pasa, el mapa queda **sin Sombra** (`shadowSkip: "audit"`, cuenta en las estadísticas). Una casilla crítica nunca está «permanentemente ocupada»: la Sombra no puede pisar ninguna y, si su ronda cruza el único pasillo, la auditoría lo detecta (test con un pasillo de una casilla de ancho).
No cubre: el explorador **después de una caída** (aparece en un punto lejano; tocarla cuesta un corazón y nunca deja la partida sin salida) ni caminos entre estaciones; se documenta como límite conocido.

### Se sortea o no
`seed|v2|shadow|exists` decide si el mapa tiene Sombra (≈ 66 % en partida única); es un sorteo aparte para que un reintento de la ruta no lo cambie. **Racha:** la probabilidad parte de `start` en el mapa 0 y sube `perMap` por mapa hasta `cap` (también la de velocidad 1 y la del cazador); a partir del mapa 5 puede haber dos cuerpos. Valores en `TUNING.shadow` (`chance`, `fast`, `hunter`).

### Vistas
- **Explorador:** silueta oscura procedural (misma maquinaria que los puntos de referencia, con ojos), solo dentro de su radio de visión (la niebla la oculta; la maldición de ceguera lo reduce a 1); latido WebAudio («lub-dub» más rápido, más grave y más fuerte cuanto más cerca **por pasillos**), pulso del HUD (icono y tres puntos) y de la viñeta, vibración (`navigator.vibrate`) si hay soporte; con `prefers-reduced-motion` no hay balanceo ni animación CSS (los puntos del HUD y un pulso más suave siguen diciendo la cercanía); con el sonido apagado el pulso visual basta. Botón **Esperar** (≥ 44 px). Sin nombre: «algo ronda».
- **Guía:** su mapa dibuja la **ronda** (trazo con flechas de un solo sentido en un bucle, de ida y vuelta en el otro; un punto cada 4 casillas para contar) **pero no su posición actual**. Leyenda con texto de mecánica genérico. No ve la velocidad, el mutador ni cuántos cuerpos son: lo deduce hablando.
- **Sellos y versión:** `RULES_VERSION` 5. La huella del juego (`fingerprint`, solo v2) incluye la ronda, así que el sello «Bosque · 7F3K» cambia si dos dispositivos difieren en la Sombra.

### Anti-memorización: ¿qué recordaría alguien tras 50 partidas que le ahorre pensar?
- Que existe y que se mueve con los pasos: es la interfaz, como saber que un pozo duele.
- **Nada de la ronda:** ruta, forma (bucle o ida y vuelta), largo, velocidad, fase, cazador, número de cuerpos y su cara cambian por partida y por mapa (y la ruta depende del laberinto, que no se repite). No hay plantilla de patrulla.
- **Nada de la fase:** el arranque es uniforme sobre el ciclo; las características simples (largo, forma, velocidad, cazador, dónde empieza la ruta) no la predicen (tests con 5.000 sorteos).
- Lo que sí se aprende es leer el latido, contar las casillas con los puntos del trazo y decidir cuándo esperar: habilidad.
- **Espacio de instancias** (estimación gruesa, detalle en `docs/AUDIT.md`): ≳ 10⁷ rondas por laberinto (≈ 10³–10⁴ rutas de 12–40 casillas × 2 formas × 2 velocidades × fase ≈ 10–160 × cazador), y el laberinto aporta otro ≳ 10⁹.

## Resultado etapa 5 (medido, después de programar)

### Decisiones al implementar
- **«Esperar» es una acción propia** (no un paso de ida y vuelta): con solo pasos, en un callejón la paridad del tick decide si se puede esquivar. Cuesta vela como un paso; solo existe donde hay Sombra.
- **Ruta de ida y vuelta por DFS con presupuesto**, no por caminata aleatoria: una caminata se atascaba en callejones y el 18 % de las rutas medía 12 (ahora 29 largos distintos y el más común, 12 casillas, es el 9,8 %: los bucles se agrupan en 12–16 porque el laberinto no tiene ciclos largos en todas partes).
- **La Racha arranca suave** (`chance.start` 0,30; `fast.start` 0,10; `hunter.start` 0,05): con la probabilidad de la partida única en el mapa 0, la mediana de la pareja normal cayó de 3 a 2 mapas.
- **El modelo de simulación** (`shadowDodge` por perfil: 0,8 / 0,55 / 0,3, ×0,6 contra un cazador, hasta 6 esperas seguidas): antes de un paso que tocaría a la Sombra la pareja lo nota con esa probabilidad y espera; si no, la toca. Es un supuesto de modelado (la pareja oye el latido y la guía conoce la ronda), no una constante del juego; solo una pareja real lo corrige (PLAYTEST).
- La causa `shadow` es un `HurtCause` más (el mensaje de dolor genérico se omite: lo cubre el del contacto).

### Calibración (`npm run calibrate 1000` y `npm run calibrate 300 streak`)
Antes = etapa 4 (sin Sombra, medido en el mismo entorno con el mismo código base). Después = con Sombra y los valores finales de `tuning.ts`.

**Partida única (1.000 mapas Difícil v2)**

| Pareja | Gana antes → después | Sin daño | ♥ al ganar | Caídas | Toques por mapa con Sombra | Esperas | Gana con Sombra | Gana sin Sombra |
|---|---|---|---|---|---|---|---|---|
| Competente | 83 % → **80 %** | 69 → 65 % | 2,77 → 2,74 | 0,83 → 0,81 | 0,32 | 0,4 | 78 % | 84 % |
| Normal | 52 % → **49 %** | 39 → 35 % | 2,61 → 2,58 | 1,68 → 1,60 | 0,38 | 0,2 | 46 % | 54 % |
| Despistada | 17 % → 16 % | 10 → 9 % | 2,30 → 2,28 | 2,10 → 1,96 | 0,40 | 0,1 | 16 % | 15 % |

**Racha (300 rachas por pareja)**

| Pareja | Mediana antes → después | p25–p75 | Media antes → después | ≥ 5 mapas antes → después |
|---|---|---|---|---|
| Competente | 7 → **6** | 5–9 → 4–7 | 6,75 → 5,72 | 76 → 69 % |
| Normal | 3 → **3** | 1–4 → 1–4 | 3,01 → 2,85 | 24 → 22 % |
| Despistada | 0 → 0 | 0–1 → 0–1 | 0,68 → 0,63 | 0 → 0 % |

Metas: competente ≈ 80–85 % y normal ≈ 50–55 % (partida única; la normal queda 1 punto abajo, dentro del ruido de 1.000 mapas, ±1,6); competente ≈ 5–7 y normal ≈ 3–4 mapas en la Racha (cumplidas). La despistada no se tocó. **Lo único que se reajustó** fue el arranque de la Racha (sin él, normal = 2 mapas, 300 rachas). Probado sin efecto: `lightLoss` 0,15 → 0,10 y 0,08, `immune` 3 → 4, subidas más lentas por mapa: casi no mueven nada porque las partidas con Sombra se pierden por el corazón del toque, no por la vela.

### Estadísticas de generación (3.000 sorteos sobre 60 mapas reales, mismo `withShadow` del juego)
Con Sombra 66,5 % (objetivo ≈ 66 %); la auditoría dio por perdido el mapa en **0 de 3.000**; el primer intento pasó en el 99,1 % (los demás reintentaron, media 0,009 intentos extra); peor razón camino seguro / normal 1,64 (el límite es ⌈1,5·N⌉ + 3, así que rutas cortas pueden pasar de 1,5); bucles 31 %, cazadores 22 %, rápidas 30 %; 29 largos de ruta distintos (el más común, 12 casillas, 9,8 %); sorteos idénticos en el mismo laberinto (ruta + forma + velocidad + fase + mutadores): **0 de ≈ 2.000**; misma ruta sobre el mismo laberinto con otra fase: 2,1 % (cuenta de cumpleaños: ~50 sorteos por laberinto del grupo, un laberinto nunca se repite). Tiempo de `withShadow` (sorteo + auditoría): media 25 ms, máx. ≈ 1,1 s (un cazador con muchos estados; en un teléfono lento puede notarse al empezar).

### Anti-memorización medida (5.000 sorteos, `shadow-antimemo.test.ts`)
- (a) Colisión de instancias idénticas < 0,1 %.
- (b) Fase inicial uniforme (χ² sobre 8 tramos del ciclo < crítico p = 0,001); la casilla de arranque no está fija en la ruta.
- (c) Ningún clasificador trivial (largo, forma, velocidad, cazador, dónde empieza la ruta, período) predice el cuarto de la fase por encima de 25 % + 5 pts, ni el cuadrante de la ruta por encima de la clase mayoritaria + 5 pts.
- (d) La auditoría de equidad pasa en el 100 % de los mapas con Sombra (los que no pasan, por construcción, no la llevan).
- Mutadores presentes con frecuencias razonables (velocidad 1 ≈ 30 %, cazador ≈ 22 %, bucle > 10 %); en partida única nunca hay dos cuerpos.

---

## Anexo etapa 6: auditoría global, onboarding y cierre

- **`npm run audit:variety [N] [--write]`** (`scripts/audit-variety.ts`) ejecuta las pruebas de diversidad de **todas** las pruebas (figuras, cerradura, piano, tangram, sigilo, eco, la Sombra) más claves de sello, emblemas y juegos de glifos, estima el espacio de instancias y escribe `docs/AUDIT.md`.
- **Uso prolongado** (`longuse.test.ts`): un mismo dispositivo juega 200 expediciones seguidas (160 únicas y 40 Rachas de 3 mapas) con los códigos del propio `createCode` y su historial; no se repite ningún código, laberinto, instancia de prueba, trío de emblemas, juego de glifos, juego de siluetas, cura, ronda ni la clave que abre cada estación. Las 30 claves de cada partida chocan solo por azar (29⁵ posibles); las curas son de 4 caracteres a propósito y también chocan por azar.
- **Textos.** Bolsas de barajado (`lib/lines.ts`): una línea no vuelve hasta haber salido todas; ≥ 8 variantes por evento común (con plantillas apertura × cola donde conviene) y ≥ 12 por final (victoria, salida de emergencia, atrapados, fin de racha; en realidad 24 por situación). Los dos dispositivos de una pareja pueden leer líneas distintas del mismo final (nada depende de que coincidan); una pantalla que se redibuja conserva su línea (memoria por semilla). Tests: `variety.test.ts` (50 partidas simuladas sin repetición seguida ni línea que acapare) y `lines.test.ts`.
- **Onboarding.** «Cómo se juega» en 4 tarjetas, saltable y recordada en `localStorage` (clave `laberinto.hints.v1`, con try/catch); botón «Cómo se juega» siempre en el inicio. Pista de una frase la **primera vez** que aparece cada tipo de prueba (figuras, cerradura, piano, tangram), la cura, La Sombra (explorador y guía) y la clave de relevo; descartable y no vuelve sola.
- **QA.** Ver `docs/INFORME_NUBE.md` (casos borde, limpieza tras varias partidas, accesibilidad, rendimiento, capturas en `docs/capturas/`).

---

## Anexo de la etapa 7: interfaz para teléfono (sin cambios de reglas)

Solo interfaz. **No** cambian reglas, motor ni `RULES_VERSION` (sigue en 5); el sello y los códigos son los mismos.

- **Joystick** (`lib/joystick.ts` puro, `components/game/explorer/joystick.tsx`): sustituye a la cruceta de 4 botones. Salida de 4 direcciones por eje dominante; zona muerta 25 % del radio de la base (suelta al bajar de 18 %); para cambiar de eje el otro debe ganar por ×1,4 (banda de ±9,5° alrededor de la diagonal). Mantener = caminar continuo (el mismo `press(dir, true)` del deslizar). Captura de puntero con su propio `pointerId`; no deja pasar eventos al lienzo (deslizar y joystick son excluyentes). Mano izquierda/derecha en `laberinto.joystick.v1` (`{show, hand}`); el ajuste antiguo `laberinto.dpad.v1` solo decide `show` si no hay uno nuevo y cualquier valor raro se ignora. Fijo (no flotante).
- **«Esperar»** actúa al pulsar (`pointerdown`), no al `click`: con otro dedo ya en el joystick el navegador no genera el `click` del segundo toque. La activación sin puntero (teclado, lector de pantalla) sigue por `click`.
- **Pantalla completa** (`lib/display.ts`, `components/game/fullscreen.tsx`): Fullscreen API con prefijos y `try/catch`; en iPhone una ayuda única (`laberinto.install-help.v1`) a «Agregar a pantalla de inicio», que no sale en modo standalone.
- **Manifest** (`app/manifest.ts`, `force-static`) con `display: "fullscreen"`, `display_override`, íconos 192/512/maskable (`npm run brand`); `viewport-fit=cover`; `mobile-web-app-capable` y `apple-mobile-web-app-capable`.
- No se añaden nombres de objetos ni emoji: íconos de `lucide-react` y SVG propio.
