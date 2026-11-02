# Auditoría anti-memorización global

Generado con `npm run audit:variety 2000 --write`. Mismas semillas, mismo informe. Los tests de vitest repiten estas pruebas con 5.000 semillas (`antimemo*.test.ts`, `shadow-antimemo.test.ts`, `longuse.test.ts`).

Muestra: **2000** instancias por familia. Umbrales: colisiones < 0,1 %; uniformidad (χ² / crítico p = 0,001) < 1; mejor clasificador trivial: aciertos − azar < ~3 errores estándar (mín. 2,5 pts).

| Prueba | Qué se mide | Colisiones | Uniformidad | Mejor clasificador trivial (aciertos − azar) | Espacio estimado | Veredicto |
|---|---|---|---|---|---|---|
| Figuras raras | elegir entre 9–12 figuras parecidas | 0.00 % | 0.57 | la más grande: +1.3 pts | ≈10^15 | pasa |
| Cerradura de deducción | primer espacio del secreto sobre 6–8 glifos | 0.00 % | 0.49 | primer glifo de la paleta: +1.6 pts | ≈10^40 | pasa |
| Piano de la bruja | primera nota de la melodía sobre 6–8 teclas | 0.00 % | 0.63 | primera tecla: +1.0 pts | ≈10^13 | pasa |
| Tangram a ciegas | cuál pieza es el señuelo (en los mapas que lo tienen) | 0.00 % | 0.33 | primera: +2.6 pts | ≈10^9 | pasa |
| Cura: sigilo y antídoto | elegir el antídoto entre 6 | 0.00 % | 0.18 | primera: +0.5 pts | ≈10^14 | pasa |
| Cura: eco | primer glifo de la secuencia sobre 5–6 | 0.00 % | 0.18 | la primera tecla: +1.9 pts | ≈10^22 | pasa |
| La Sombra | cuarto del ciclo en que arranca (de 4) | 0.00 % | 0.21 | fase según el tipo: +1.3 pts | ≈10^9 por mapa | pasa |
| Claves de sello | 60000 claves (3 estaciones × 10 fallos × 2000 partidas) | 0.13 % | — | — | 29^5 ≈ 2·10^7 por clave | pasa |
| Emblemas de estación | 600 trios de emblemas (un emblema suelto puede repetirse: 0.11 %) | 0.00 % | — | — | ≈10^8 por emblema, ≈10^20 por trío | pasa |
| Sets de glifos | 600 sets de 6 | 0.00 % | — | — | ≈10^20 | pasa |

## Cómo se estimó el espacio de instancias

- **Figuras raras** (≈10^15): 14 parámetros continuos (≈8 niveles distinguibles cada uno ⇒ 8^14 ≈ 4·10^12 por figura) × giro/espejo (8) × parecido (3) × agujeros (2) × N (4) ≈ 10^15, sin contar las vecinas
- **Cerradura de deducción** (≈10^40): glifos: (6 bases × 5 marcas × 4 apéndices × orientaciones × continuos ≳ 10^3)^(6–8) ≳ 10^18–10^24 por set; secretos 6^4…8^5 (10^3–3·10^4); pistas: tipos × parámetros (≳ 10^3). Producto ≳ 10^30
- **Piano de la bruja** (≈10^13): 9 escalas × 13 tónicas × 5 timbres × 5 tempos (≈3·10^3) × orden de teclas (K! − 2: 720–40.320) × melodías filtradas (~10^2–10^4) × ritmos (4^L)
- **Tangram a ciegas** (≈10^9): siluetas libres de 15–23 celdas (≈10^3–10^7 por área; más teselaciones por silueta) × giro (4) × posición en el marco × orden de la bandeja × señuelo. Siluetas repetidas (forma canónica): 0.05 %; mapas con señuelo: 39 %
- **Cura: sigilo y antídoto** (≈10^14): la familia de figuras (≈10^12 por figura) × giro/espejo × 6 posiciones × parecido
- **Cura: eco** (≈10^22): sets de glifos (≳ 10^3)^(5–6) × secuencias 5^3…6^4 × orden del teclado (5!–6!) × ritmo
- **La Sombra** (≈10^9 por mapa): por mapa: rutas de 12–40 casillas (≈10^3–10^4 por laberinto) × ida y vuelta/bucle × velocidad (2) × fase (≈10–160) × cazador (2) ⇒ ≳ 10^7 por laberinto; el laberinto aporta otro ≳ 10^9 (6^8 semillas). Tienen Sombra 66 % de los mapas; cazador 22 %, rápida 30 %. Probabilidad base 0.66
- **Claves de sello** (29^5 ≈ 2·10^7 por clave): Cruzar partidas cuesta ~N²/2·29⁻⁵ choques: que dos partidas compartan una clave NO la hace útil (cada clave solo abre su estación, y una clave ajena abre algo en ≈0,04 % de los casos)
- **Emblemas de estación** (≈10^8 por emblema, ≈10^20 por trío): 8 familias × cuenta × espejo × inclinación continua; un trío son 3 familias distintas. Lo que identifica a la partida es el trío
- **Sets de glifos** (≈10^20): 6 bases × 5 marcas × 4 apéndices × orientación × proporciones continuas, 6 glifos distintos por 2+ partes

## Pregunta obligatoria: ¿qué recordaría alguien tras 50 partidas que le ahorre pensar?

| Prueba | Respuesta |
|---|---|
| Figuras raras | Nada de la respuesta: figura y vecinas nuevas, posición correcta uniforme, giro/espejo sorteados. Mejora el vocabulario para describir (habilidad). |
| Cerradura | Nada de la respuesta: glifos, secreto y pistas cambian; las dos paletas tienen órdenes distintos. Se aprende a deducir y a describir pictogramas (la gramática de pistas es la interfaz). |
| Piano | Nada: el mapeo tecla→nota es nuevo cada vez y nunca ordenado; cada posición de la melodía es uniforme. Mejora el oído y el vocabulario de contorno. |
| Tangram | Nada: siluetas y piezas generadas; el señuelo no se delata por tamaño ni posición; la silueta llega girada y desplazada. Mejora describir formas. |
| Curas (sigilo y eco) | Nada: sigilos y glifos nuevos; la tecla nunca está en el orden de la secuencia. Se aprende qué hace cada maldición (interfaz). |
| La Sombra | Que existe y que se mueve con los pasos (interfaz). Su ronda, velocidad, fase, mutador y hasta su cara son nuevos en cada partida; la fase es uniforme y ninguna característica simple la predice. Lo que mejora es leer el latido y calcular tiempos con la guía (habilidad). |
| Claves dictadas | Nada: dependen de semilla + estación + fallos; dentro de una partida las 30 son distintas y entre partidas casi nunca coinciden (y aunque coincidan, solo abren su estación). |

## Qué NO cubre esta auditoría

- Parejas reales: no se puede medir aburrimiento. `PLAYTEST.md` tiene las preguntas de rejugabilidad.
- Los textos (frases por evento): se auditan aparte con `components/game/__tests__/variety.test.ts` y `lib/__tests__/lines.test.ts`.
- Las 8 familias de siluetas y las 5 maldiciones son vocabulario fijo de mecánica a propósito: son la interfaz, no la respuesta.
