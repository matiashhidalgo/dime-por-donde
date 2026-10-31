# GAME_SPEC — Laberinto a ciegas (nombre provisional)

Fuente de verdad para todas las sesiones. Si el código contradice este archivo, gana este archivo (o se actualiza aquí primero).

Juego cooperativo asimétrico para 2 personas. Cada una abre el mismo link en su propio dispositivo (compu o celular). NO se comparte pantalla: la videollamada es solo para hablar. Uno es el EXPLORADOR (ve solo su entorno inmediato, con niebla) y la otra es la GUÍA (ve el mapa completo con trampas y objetos, pero no sabe dónde está el explorador). Hablan para llegar a la salida. No hay backend: ambos ingresan el mismo código de partida y el juego genera EXACTAMENTE el mismo laberinto de forma determinista.

## A. REGLAS
- Roles: Explorador y Guía. Se eligen al empezar y se pueden intercambiar entre rondas.
- Objetivo: el explorador llega a la salida. Opcional: recoger estrellas (las ve la guía en su mapa).
- Cada dispositivo lleva su propio cronómetro (no hay sincronización). Ritual de inicio: cuenta regresiva 3-2-1 en ambas pantallas que cada uno dispara a viva voz ("¡ya!"). Hay modo "sin tiempo".
- Caer en un pozo: vuelve al último checkpoint (bandera) y suma 10 s de penalización. Se cuentan las caídas.
- La guía tiene un botón "¡Llegó!" que detiene su cronómetro cuando el explorador avisa por voz.
- La guía puede poner marcas locales en su mapa (alfiler "creo que estás aquí", y dibujar o marcar casillas); es solo para ella.

## B. CÓDIGO DE PARTIDA
- Lo genera una persona y la otra lo escribe. Debe contener TODO lo necesario para que ambos obtengan idéntica partida: semilla, dificultad y versión del generador.
- Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L). Unos 6 caracteres de semilla. Fácil de dictar por voz (se puede mostrar con agrupación visual).
- Historial en localStorage de cada dispositivo: código, fecha, rol, resultado, tiempo. Quien genera nunca recibe un código ya jugado; quien lo escribe recibe un aviso si ya lo jugó. Pantalla de historial con opción de rejugar un código a propósito.
- Toda lectura/escritura de localStorage va en try/catch y el juego funciona sin él.

## C. GENERADOR (determinista, TypeScript puro, sin DOM)
- PRNG con semilla (hash de string + mulberry32 o similar). Nunca Math.random en el motor.
- Laberinto con paredes entre casillas; algoritmo variable según la semilla (pasillos largos tipo backtracker vs. muchos callejones tipo Prim). "Braiding": abrir una fracción de callejones sin salida para crear ciclos y rutas alternativas.
- Entrada y salida lejanas; checkpoints repartidos.
- Cada partida elige un TEMA (bosque, cueva, hielo, atardecer en el desierto) que define paleta y los puntos de referencia descriptibles (árbol, hongo, charco, estatua, etc.): objetos o decoraciones colocados de forma que cada zona sea distinguible y describible con palabras.
- Cada partida elige un subconjunto de tipos de obstáculos y sus cantidades.

## D. OBSTÁCULOS (v1)
1. Pozos: el explorador no los ve hasta caer; la guía los ve.
2. Llaves y puertas de colores: cada color tiene también una forma distinta (accesibilidad y claridad por voz). Una puerta bloquea hasta tener la llave.
3. Portales en pares: el explorador ve "portal triángulo azul"; la guía ve adónde lleva cada uno.
4. Hielo: al pisarlo, se desliza hasta chocar con una pared.
5. Zonas de controles invertidos: durante N pasos, izquierda/derecha (o ambos ejes) se invierten, con un efecto visual claro.
6. Extras: estrellas (opcionales) y faroles (aumentan el radio de visión unos segundos).
- Regla de justicia: el solver (BFS sobre estado que incluya llaves, hielo y portales) debe garantizar que existe ruta a la salida, que ninguna llave quede inalcanzable y que la ruta mínima esté dentro de un rango razonable por dificultad. Si una semilla falla, se reintenta de forma determinista (semilla + intento) para que ambos obtengan lo mismo.

## E. DIFICULTAD (valores iniciales a calibrar)
- Fácil: ~12x12, visión 4 pasos, memoria de lo visitado visible, 2 tipos de obstáculo.
- Medio: ~18x18, visión 3, memoria tenue, 3-4 tipos.
- Difícil: ~26x26, visión 3 sin memoria, 4-5 tipos, más trampas.
- Objetivo: partidas de 10 a 20 minutos.

## F. VISTAS
- Orientación: en AMBAS vistas arriba es arriba e izquierda es izquierda. Nada de isométrico a 45° (rompería la comunicación).
- Explorador: vista desde arriba oblicua 2.5D en Canvas 2D (paredes con cara frontal más oscura, sombra suave y volumen; personaje pequeño y simpático con sombra). Estilo Monument Valley / Alto's Adventure: paletas suaves por tema, degradados, siluetas. Niebla: visibilidad por pasos reales a través de pasillos abiertos (no a través de paredes); las casillas se desvanecen con la distancia mezclándose con el color de bruma del tema; resplandor suave alrededor del personaje. Controles: teclado (flechas/WASD) y táctil (swipe o cruceta).
- Guía: mapa plano desde arriba en SVG, estilo cartógrafo (papel, tinta fina, símbolos), con cuadrícula y coordenadas (A1, B3...), zoom y desplazamiento (pinch en celular), leyenda, y herramientas de marca. Diseño responsive, funcional en vertical en celular.
- Íconos: SVG propios o de librería (por ejemplo Lucide). NO emoji (se ven distinto entre dispositivos).
- Color + forma + nombre para todo lo que se distinga por color.

## G. DIVERSIÓN Y "JUICE"
- Sonidos sintetizados con WebAudio (pasos suaves, llave, portal, pozo, estrella, victoria) y un ambiente musical suave por tema; interruptor de silencio persistente.
- Animaciones: squash & stretch del personaje, partículas en estrellas y victoria, leve temblor de pantalla al caer, estela en el hielo, remolino violeta en controles invertidos, vibración en móvil (navigator.vibrate).
- Textos con humor cariñoso en español neutro (tú): consejos de inicio, frases según resultados ("Cayeron 4 veces en pozos: la guía debería revisar su mapa").
- Pantalla final: tiempo, pozos, estrellas, calificación de 1 a 3 estrellas y frase graciosa. Opción de intercambiar roles y jugar otra.
- Modo "Dúo de 3 rondas": tres laberintos seguidos con dificultad creciente y roles que se intercambian.

## H. TECNOLOGÍA Y RENDIMIENTO
- Next.js (export estático) + TypeScript + Tailwind siguiendo mis convenciones del skill project-kickstart. Vitest para tests. Sin motor de juego (nada de Phaser/Three.js). Sin imágenes externas: todo dibujado con código.
- Lógica del motor separada del render (src/engine puro y testeable; el render es reemplazable).
- Fluido a 60 fps en un celular de gama media: dibujar solo lo visible, límite de DPR en 2, redibujar solo cuando cambia algo, respetar prefers-reduced-motion. Usar Wake Lock en móvil para que la pantalla no se apague.
- Cero dependencias de servidor. No hagas deploy ni crees repositorios: déjame los pasos al final.

---

## ANEXO — Decisiones del motor v1 (2026-10-31)

Este anexo registra cómo se interpretaron las reglas y con qué valores arrancan. No contradice nada de arriba: lo concreta. Los valores con (calibrar) son los primeros a ajustar después de jugar.

### Código de partida
- Formato: `H SSSSSS C` (8 caracteres), mostrado como `HSSS-SSSC`. H = versión del generador + modo; S = semilla; C = checksum.
- Alfabeto de 29 símbolos: `23456789ABCDEFGHJKMPQRSTUWXYZ`. Además de 0/O/1/I/L se excluyen V (suena como B: "be/uve") y N (suena como M por llamada). Si alguien escribe V o N, se convierten en B o M y el checksum confirma.
- El checksum (suma ponderada mód 29, un primo) detecta TODO error de un carácter y TODO intercambio de dos vecinos. Esto está probado de forma exhaustiva en los tests.
- Modos codificados: fácil, medio, difícil y **dúo** (3 rondas fácil→medio→difícil, con temas distintos derivados del mismo código).
- La aleatoriedad para crear códigos la pone la UI (`crypto.getRandomValues`); el motor solo recibe una función `random` y un `isTaken(code)` para saltar los ya jugados.
- **Versión congelada:** el generador v1 no puede cambiar su salida. Un test de huellas "golden" lo protege. Cualquier cambio de generación se publica como v2, y v1 se mantiene para los códigos viejos.

### Reglas de movimiento (src/engine/rules.ts, compartidas por solver y juego)
- **Hielo:** al entrar a una casilla de hielo sigues en la misma dirección hasta chocar con una pared o puerta cerrada, o hasta salir del hielo a suelo normal (ahí te detienes). El hielo viene en **lagos rectangulares** (2×3 a 4×4) sin paredes internas, para que deslizarse sea un mini-puzle.
- **Portales:** al entrar a un portal apareces en su pareja y te quedas ahí. Volver a pisarlo te regresa. Prefieren callejones sin salida, así nunca bloquean pasillos.
- **Puertas/llaves:** la llave no se gasta (una puerta por color). Colores con forma: roja=círculo, azul=cuadrado, amarilla=triángulo. Los portales usan otros colores (turquesa=triángulo, naranja=círculo, rosa=rombo), así que "azul" siempre significa llave.
- **Pozos:** caer = volver a la última bandera (+10 s). El solver nunca cuenta una caída como movimiento útil.
- **Remolinos:** son casillas trampa. Al pisarlas, los controles se invierten durante N pasos: solo izq/der (`x`) o ambos ejes (`xy`).
- **Pozos siempre están** en toda partida: es la mecánica que más necesita a la guía. Los demás tipos se sortean.

### Justicia (src/engine/solver.ts + audit.ts)
- BFS sobre (casilla, llaves) con las reglas reales de hielo, portales y puertas.
- Se exige: salida alcanzable; toda llave, portal, estrella, farol, bandera y remolino alcanzable; **ninguna llave detrás de su propia puerta**; **cero estados de bloqueo** (desde cualquier estado alcanzable aún se puede llegar a la salida).
- Cada pieza que puede romper la partida (lago, llave, portal, pozo) se valida con el solver al colocarla y se deshace si rompe algo. Así los reintentos completos son raros: 0,1 de media, máximo 4 en 6.000 semillas.
- **Esfuerzo de ruta** = movimientos + 2 × decisiones (cruces en la ruta óptima). Se usa en lugar de solo movimientos porque los laberintos tipo Prim tienen rutas cortas pero un cruce en casi cada casilla, y medidos por movimientos el 100% se rechazaba (en difícil). Con esfuerzo, los tres algoritmos conviven en proporción ~1/3 cada uno.

### Valores iniciales (src/engine/difficulty.ts)

| | Fácil | Medio | Difícil |
|---|---|---|---|
| Tamaño | 12×12 | 18×18 | 26×26 |
| Visión / memoria | 4 / completa | 3 / tenue | 3 / ninguna |
| Tipos de obstáculo | 2 | 3–4 | 4–5 |
| Braiding (calibrar) | 15–30 % | 20–35 % | 25–40 % |
| Pozos (calibrar) | 3–5 | 7–10 | 16–22 |
| Puertas / pares de portales / lagos | 1 / 1 / 1 | 1–2 / 1–2 / 1–2 | 2–3 / 2–3 / 2–3 |
| Remolinos (pasos) | 1–2 (6–8) | 2–3 (8–10) | 3–4 (10–12) |
| Estrellas / faroles / banderas | 3 / 1 / 2 | 3 / 2 / 3 | 3 / 3 / 4 |
| Zonas con punto de referencia | 9 | 16 | 16 |
| Rango de esfuerzo (calibrar) | 40–130 | 60–210 | 90–340 |

### Puntos de referencia
- 8 tipos por tema × 3 variantes ("hongo gigante", "cactus con flor"…). Cada zona del mapa recibe uno y ninguna frase se repite dentro de una partida.
- Ponen nombre a cada zona del mapa ("estoy junto al iglú derretido") y no estorban el paso.

### Pendiente de calibrar jugando
Ver `docs/stats/*.json` (se regeneran con `npm test`).

### Vista del explorador v1 (2026-10-31)
- **Reglas del explorador** en `src/engine/play.ts` (puro, con tests). Mueve con `resolveMove`, la misma función que usa el solver: lo que el solver prueba posible es exactamente lo que el jugador puede hacer. Un test recorre la ruta del solver con el juego real en 450 semillas y siempre llega.
- **Visión:** BFS por pasillos abiertos hasta el radio de la dificultad (+2 con farol). Una puerta cerrada se ve, pero no se ve a través de ella.
- **Memoria:** recuerda las casillas que **ha visto**, no solo las pisadas. Fácil 34 %, medio 15 %, difícil nada (calibrar). Un pozo en el que caíste queda visible.
- **Remolino:** cuenta los pasos que mueven (chocar con pared no gasta). Caer en un pozo quita la inversión.
- **Farol:** se gasta al tomarlo; dura 10 s (8 en difícil) de reloj real.
- **Nombres compartidos:** `src/engine/names.ts` alimenta tanto la leyenda/chips de la guía como las etiquetas del explorador ("llave azul", "portal triángulo turquesa").
- **Render:** Canvas 2D oblicuo; las casillas se funden con el color de bruma del tema mezclando colores opacos (no transparencia), así no se manchan las paredes al desvanecerse. Bucle a 60 fps solo mientras algo se mueve, ~24 fps de ambiente en reposo, nada con reduced-motion. DPR máximo 2.
- **Controles:** flechas/WASD (mantener = seguir caminando), deslizar (deslizar y mantener = seguir), cruceta opcional (encendida por defecto en pantallas táctiles, se recuerda). Buffer de una dirección durante la animación.

### Diversión y calibración v1 (2026-10-31)

**Calibración** (`npx vite-node scripts/calibrate.ts 400`; generador v1 intacto, sin cambio de versión: nada de esto cambia los laberintos ni los códigos).

| | Fácil | Medio | Difícil |
|---|---|---|---|
| Movimientos de la ruta (p50) | 47 | 69 | 104 |
| Cruces en la ruta (p50) | 13 | 21 | 31 |
| Pozos junto a la ruta (p50 / p95) | 1 / 2 | 1 / 4 | 2 / 5 |
| Ida y vuelta por las estrellas (p50, casillas) | 30 | 42 | 60 |
| Tiempo estimado hablando (p5 · p50 · p95) | 5 · 6½ · 9 min | 7 · 10 · 14 min | 10 · 14 · 20 min |

- **Tiempo de referencia (par):** antes era 4 s × esfuerzo. Sobrevaloraba los pasillos largos y castigaba los laberintos tipo Prim (la estimación quedaba entre 0,9× y 1,8× del par según el algoritmo), y además no contaba el desvío por estrellas: ir por ellas podía costar la estrella de tiempo. Ahora: **par = 45 s + 2 s × (movimientos + ida y vuelta a las estrellas) + 14 s × cruces**, redondeado a 5 s. Es el ritmo esperado hablando; la estrella de tiempo se pierde solo al pasar **1,5×** el par. Con el modelo de ritmo, la estimación queda en 1,00–1,04× del par en los tres niveles, para cualquier algoritmo.
- El modelo de ritmo es una suposición (1,6 s por casilla narrando, 11 s por cruce, 4 s por aviso de pozo, 40 s para orientarse, ×1,25 por vueltas equivocadas). Se ajusta jugando.
- Nota: en la prueba anterior, «1 de 3» eran las **estrellas recogidas**; la calificación de esa partida era 3/3. Por eso la pantalla final ahora separa «Calificación» de «Estrellas del mapa» y explica el porqué con tres chips (ritmo, caídas, estrellas).
- **Farol:** 20 s / 18 s / 15 s (antes 10/10/8). A ritmo de conversación, 10 s eran 5 o 6 casillas: no alcanzaba para describir lo que se ve.
- **Pozos en difícil (16–22):** se mantienen. La densidad es la misma en los tres niveles (≈2,8 % de las casillas) y solo 2 de mediana tocan la ruta óptima. Pesan cuando el explorador se pierde, que es justo lo difícil. Reducirlos obligaría a un generador v2 sin evidencia de juego.
- **Visión / memoria:** sin cambios (4 completa · 3 tenue · 3 ninguna).
- **Duración:** fácil y medio son cortos (≈6 y 10 min); difícil ≈14 min; un dúo completo ≈30 min.

**Audio** (`lib/audio.ts`, WebAudio puro, sin archivos)
- El contexto se crea con el primer gesto (pointerdown/keydown). Se suspende con la pestaña oculta.
- Botón de sonido en inicio, cuenta regresiva, explorador y guía. Recorre tres estados: **música y efectos → solo efectos → silencio**, guardado en `laberinto.sound.v1`. Volumen bajo a propósito: suena al lado de una videollamada.
- Efectos: pasos por tema (crujido de nieve, eco de cueva, arena, hojas), deslizar, choque, puerta cerrada, puerta que se abre, llave, estrella, farol, bandera, portal (entrar y aparecer), pozo, remolino, controles normales, victoria, tic 3-2-1 y «¡ya!», alfiler de la guía, botones.
- Música: ambiente generativo por tema (acorde lento + notas sueltas de una escala, eco suave; gotas en la cueva). Suena en ambas vistas.

**Juice añadido** (no duplica lo de v1: squash, temblor, remolino, confeti y toasts ya existían)
- Estela de dos líneas al deslizarse por el hielo o la arena resbalosa.
- Polvo al aterrizar tras un portal o una caída, y al chocar contra una pared.
- Chispas al tomar bandera, remolino (violeta) y al abrir una puerta (color de la llave).
- Confeti en la pantalla final para los dos roles. Las estrellas de la calificación aparecen una por una.
- Vibración corta también en puerta cerrada, bandera, portal y remolino. Con reduced-motion no hay partículas, estela ni confeti.

**Textos**
- Varias frases por evento que rotan sin repetirse seguidas (`explorer/messages.ts`). Las caídas suben de tono (3.ª caída, 5 o más).
- Consejos de inicio por rol (`lib/phrases.ts`), en el lobby y en la cuenta regresiva entre rondas del dúo.
- Frases finales según caídas, estrellas y ritmo, y frase de cierre del dúo.

**Pantalla final y dúo**
- Igual para los dos roles. La guía edita estrellas y caídas en la misma tarjeta, con +/−.
- Botones «Intercambiar roles y jugar otra» y «Volver al inicio». En el dúo, «Ronda N: ahora eres …».
- Entre rondas, la cuenta regresiva muestra «Cambio de roles: ahora eres …».
- Tras la ronda 3 aparece el **Resumen del dúo**: rondas con rol, tiempo y calificación, más el total sobre 9, las estrellas, el tiempo total y las caídas. Se guarda en memoria de la sesión, no en el historial.

## Anexo · Cierre v1 (QA y publicación)

- **Nombre visible:** «Dime por dónde». Única fuente: `lib/site.ts` (título, inicio, metadatos, tarjeta OG). Imágenes de marca: `npm run brand` → `public/og.png` y `public/apple-touch-icon.png`; ícono vectorial en `public/icon.svg`.
- **Recarga a media partida:** se guarda la ronda en `sessionStorage` (`laberinto.live.v1`, por pestaña, caduca a las 3 h). Al volver, el inicio ofrece «Continuar» con el mismo reloj o «Descartar». El resultado y el abandono la borran.
- **Botón atrás del navegador:** durante la partida abre «¿Salir de la partida?»; en la cuenta regresiva vuelve a la sala; en el resto, al inicio. Cerrar o recargar a media partida pide confirmación.
- **Dos pestañas en un dispositivo:** cada una tiene su propia partida guardada; el modo de sonido se sincroniza entre pestañas.
- **Pestaña oculta:** suelta las direcciones sostenidas y pausa la música; el cronómetro sigue (es tiempo real compartido con la pareja).
- **Producción:** `?dev=` y los ganchos `window.__explorer`, `__explorerSolution`, `__audio` solo existen en desarrollo. `/debug/` se publica pero `robots` lo excluye.
