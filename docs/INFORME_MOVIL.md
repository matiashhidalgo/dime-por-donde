# Informe: pantalla completa y joystick para el teléfono

Rama de trabajo: `v2-sombra-cierre` (los commits actualizan el PR #1 hacia `v2`). No se tocó `main` ni `v2`, no se fusionó, no se desplegó, no se tocó Vercel ni la configuración del repositorio. **No cambian reglas**: `RULES_VERSION` sigue en 5 y `src/engine` no se tocó (solo un test del motor, ver sección 6). Esta sesión no puede avisar al terminar: este informe y los commits son la única señal.

Plan previo: [`PLAN_MOVIL.md`](PLAN_MOVIL.md).

## 1. Qué se hizo

### Joystick virtual (reemplaza la cruceta de 4 botones)
- **Lógica pura** en `lib/joystick.ts`: vector del dedo → una de 4 direcciones (o ninguna).
  - Zona muerta: entra a **25 %** del radio de la base y suelta a **18 %** (histéresis de zona muerta).
  - Sectores con histéresis: mientras el pomo apunta a un eje, lo conserva hasta que el otro eje lo supere por **×1,4** (banda de ±9,5° alrededor de la diagonal). No parpadea entre diagonales.
  - Mantener el pomo = caminar continuo (el mismo `press(dir, true)` / `release(dir)` del deslizar y del teclado); cambiar de dirección sin soltar funciona (suelta la anterior y pulsa la nueva).
  - También: `clampKnob` (el pomo sigue al dedo dentro de un radio) y `readJoystickPrefs` (ajustes guardados con migración).
- **Componente** `components/game/explorer/joystick.tsx`: base circular translúcida con degradado y sombra, pozo oscuro, cuatro flechas tenues, pomo con volumen y brillo. La dirección activa **se ilumina con el acento del tema** (flecha + arco en el borde de la base + aro del pomo). El pomo **crece** al tocarlo, **vuelve con un resorte suave** al soltar y da un **tic háptico** corto (`navigator.vibrate` con comprobación de soporte, vía `buzz`) cada vez que cambia de dirección. Solo animan `transform` y `opacity`.
  - `prefers-reduced-motion`: sin resorte (el pomo vuelve de golpe) y sin transiciones de opacidad.
  - Eventos de puntero con **captura y su propio `pointerId`**; detiene la propagación para que **no dispare el deslizar** del lienzo; un segundo dedo en el joystick se ignora. Suelta todo si la pestaña se oculta, si la ventana pierde el foco o si el componente se desmonta (abrir una estación, por ejemplo).
  - Tamaño fluido: diámetro de la base `clamp(7.5rem, 34vmin, 10.5rem)` (≈ 120–168 px) y una zona táctil 1 rem mayor por cada lado (160–200 px).
- **Mano izquierda/derecha:** un botón encima del joystick («Mano derecha» / «Mano izquierda») intercambia lados con «Esperar». Se guarda en `laberinto.joystick.v1` (`{show, hand}`) con `try/catch` (vía `lib/storage`).
- **Cruceta antigua:** el ajuste `laberinto.dpad.v1` solo decide si el joystick se muestra cuando no hay un ajuste nuevo; valores raros (`"banana"`, JSON roto) se ignoran sin romper. El botón del mando en la cabecera muestra/oculta el joystick (por defecto visible en pantallas táctiles, oculto en escritorio).
- **«Esperar» actúa al pulsar** (`pointerdown`), no al `click`: ver sección 4.

### Pantalla completa
- `lib/display.ts` (puro, con tests) y `components/game/fullscreen.tsx`. Botón en la cabecera del **explorador y de la guía**: «Pantalla completa» → «Salir» (en pantallas estrechas solo el ícono, con el nombre accesible completo). Usa la Fullscreen API con prefijos (`webkit`, `ms`), `try/catch` y reacciona a `fullscreenchange` / `webkitfullscreenchange`.
- **iPhone Safari** (sin Fullscreen API para páginas): no hay botón; se muestra **una vez** una ayuda con 3 pasos («Compartir» → «Agregar a pantalla de inicio» → abrir desde el ícono). Se recuerda en `laberinto.install-help.v1` (con `try/catch`) y se marca al mostrarse. Si ya corre en modo standalone (`navigator.standalone` o `display-mode: standalone | fullscreen | minimal-ui`), no se muestra nada. En el explorador pausa el laberinto mientras está abierta.

### Manifest, iconos y metadatos
- `app/manifest.ts` (`force-static`, sale como `/manifest.webmanifest`): nombre «Dime por dónde», `display: "fullscreen"`, `display_override: ["fullscreen","standalone","minimal-ui"]`, `orientation: "any"`, colores de la marca, iconos 192, 512 y maskable 512.
- `npm run brand` (`scripts/render-brand.ts`, nuevo `scripts/brand/app-icon.tsx`) genera además `public/icon-192.png`, `icon-512.png` e `icon-maskable-512.png` (el maskable con el motivo dentro de la zona segura central). `og.png` y `apple-touch-icon.png` salen idénticos (no hubo cambios en git).
- Metadatos: `viewport-fit=cover`, `width=device-width, initial-scale=1`, `theme-color` (ya estaba, claro y oscuro), `mobile-web-app-capable` (lo escribe Next) y `apple-mobile-web-app-capable` (añadido a mano: Next 15 no lo escribe), `apple-mobile-web-app-status-bar-style=default`.

### Maquetación móvil
- `.game-shell` (`app/globals.css`) para explorador y guía: `100dvh` (con respaldo `100vh`), `overscroll-behavior: none`, sin selección de texto ni menú de pulsación larga (`user-select`, `-webkit-touch-callout`), con campos de texto seguiendo seleccionables. `touch-action: manipulation` en `body` quita el zoom por doble toque (el pellizco no se bloquea, ver decisiones).
- `env(safe-area-inset-*)` en cabecera, HUD, joystick, «Esperar», botones centrales y, en la guía, el mapa y la barra de herramientas.
- **Horizontal:** joystick de un lado, «Esperar» del otro a la altura del centro del joystick, mapa libre al centro. En vertical, los botones centrales («Abrir la estación», «Salida de emergencia») suben por encima de la pila joystick + «Esperar» (`.act-bar` / `.has-joy`) para no chocar.
- Guía: el botón «Estaciones» pasó de 36 a 44 px de alto (objetivo táctil).

## 2. Archivos tocados

- Nuevos: `lib/joystick.ts`, `lib/display.ts`, `lib/__tests__/joystick.test.ts`, `lib/__tests__/display.test.ts`, `components/game/explorer/joystick.tsx`, `components/game/fullscreen.tsx`, `app/manifest.ts`, `scripts/brand/app-icon.tsx`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `docs/PLAN_MOVIL.md`, `docs/INFORME_MOVIL.md`, `docs/capturas-movil/` (25 imágenes, ~1 MB).
- Modificados: `components/game/explorer/explorer-view.tsx` (cruceta fuera, joystick, pantalla completa, ayuda de iPhone, posiciones y zonas seguras), `components/game/guide/guide-view.tsx` y `guide/stations.tsx`, `app/layout.tsx`, `app/globals.css`, `scripts/render-brand.ts`, `README.md`, `GAME_SPEC_V2.md` (anexo de la etapa 7), `PLAYTEST.md`, `src/engine/__tests__/shadow-antimemo.test.ts`.

## 3. Resultados de tsc, tests y build

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | sin errores |
| `npx vitest run` (línea base, antes de tocar nada) | 27 archivos, **286 tests** en verde (15 min: corrió a la vez que otras cosas) |
| `npx vitest run` (final) | 29 archivos, **312 tests** en verde (286 + 18 del joystick + 8 de `display`), 9 min 26 s, salida 0 y sin el aviso de `onTaskUpdate` |
| `npm run build` | OK; `/`: 130 kB, First Load JS **264 kB** (antes 260 kB) |
| `/manifest.webmanifest` en `out/` | sí, con los 3 iconos |

Aviso de vitest `Timeout calling "onTaskUpdate"`: arreglado, ver sección 6.

## 4. Verificación en navegador (Chromium headless con Playwright)

Contra `next dev` con los atajos de desarrollo (`?dev=`, `__teleport`, `__explorer`), con **emulación táctil real** (`Input.dispatchTouchEvent` por CDP, con varios dedos) y **zona segura simulada** con `Emulation.setSafeAreaInsetsOverride`: vertical 375×812 (arriba 47, abajo 34), horizontal 812×375 (muesca a los lados: 47 / 47, abajo 21) y tableta 820×1180. Los scripts no están en el repositorio (viven en la carpeta temporal de la sesión); esto es lo que comprobaron, **135 comprobaciones, todas en verde**:

- **Sin desbordes** horizontales ni verticales en los tres tamaños, ni en la guía.
- **Zonas seguras:** joystick, «Esperar», botones de cabecera, chips del HUD, botón «Abrir la estación» y (en la guía) todos los botones quedan dentro de las zonas seguras, también en horizontal y con la mano izquierda. Ningún solapamiento entre el botón de la estación, el joystick, su botón de mano y «Esperar» (vertical y horizontal).
- **Objetivos táctiles:** los botones de la cabecera, el joystick (zona de 160–200 px), «Esperar» (≥ 48 px), el botón de mano (44 px), la ayuda de iPhone y todos los botones de la guía miden ≥ 44 px.
- **Joystick:** para cada dirección (arriba, derecha, abajo, izquierda) pulsa exactamente esa dirección y enciende solo su flecha; al soltar libera y apaga; cada gesto produce **una pulsación y una liberación y nada más** (el deslizar del lienzo no se dispara). Cambiar de dirección sin soltar: derecha → arriba → izquierda produce `press1, rel1, press0, rel0, press3`. Volver a la zona muerta libera. El pomo vuelve al centro tras soltar.
- **Multitáctil:** con un dedo sosteniendo el joystick, un segundo dedo toca «Esperar»: la espera ocurre y el joystick sigue sostenido. (Esto destapó un fallo real, ver sección 5.)
- **Deslizar** sobre el lienzo sigue funcionando.
- **Mano izquierda:** joystick a la izquierda, «Esperar» a la derecha, sin solapar, dentro de la zona segura; se guarda en `localStorage`.
- **Pantalla completa:** el botón aparece en explorador y guía; al pulsarlo entra, cambia a «Salir de pantalla completa», reacciona a `fullscreenchange` (al salir con la API vuelve a «Pantalla completa») y «Salir» sale.
- **iPhone simulado** (perfil iPhone 13 y sin Fullscreen API): sin botón; la ayuda aparece **una vez**, pausa el laberinto, cabe en pantalla, no vuelve en la visita siguiente (ni en la guía); aparece sin errores aunque `localStorage` esté bloqueado; **no aparece** en modo standalone (`navigator.standalone` ni `display-mode`). En Android emulado (Pixel 7): botón sí, ayuda no.
- **`prefers-reduced-motion`:** el pomo vuelve al centro sin transición (50 ms después ya está en 0); en movimiento normal la transición del resorte está activa y el pomo sigue en vuelo a los 40 ms.
- **Ajuste antiguo de cruceta:** `false` oculta el joystick, `true`, `"banana"` y JSON roto lo muestran, ninguno rompe. En escritorio empieza oculto y el botón de la cabecera lo muestra; el teclado (Espacio = «Esperar») sigue igual.
- **axe-core** (WCAG 2 A/AA, 2.1 AA, 2.2 AA y buenas prácticas) sobre el explorador con el joystick (mano derecha e izquierda, los tres tamaños), la guía (vertical y horizontal) y el diálogo de iPhone: **0 violaciones** en todo.
- Sin errores de página en ninguna escena.

Capturas en [`capturas-movil/`](capturas-movil/) (comprimidas; los teléfonos están a 1×):
- `movil-375x812-1-reposo`, `-2-activo-{arriba,derecha,abajo,izquierda}`, `-3-mano-izquierda`, `-estacion-boton`, `-guia`
- `horizontal-812x375-…` (la misma serie)
- `tableta-820x1180-…` (reposo, cuatro direcciones, mano izquierda)
- `iphone-ayuda-pantalla-inicio`, `movil-pantalla-completa-activa`, `escritorio-explorador-joystick`

## 5. Hallazgos durante las pruebas

1. **«Esperar» no respondía con otro dedo en el joystick.** El navegador no genera el `click` de un segundo toque mientras hay otro dedo apoyado (el `pointerdown` sí llega). Ahora «Esperar» actúa en `pointerdown`; el `click` sin puntero (`detail === 0`: teclado, lector de pantalla) sigue funcionando. Detectado con la prueba multitáctil.
2. **La flecha iluminada quedaba tapada por el pomo** al empujarlo; se añadió un arco iluminado en el borde de la base (visible aunque el pomo cubra la flecha) y se redujeron el pomo (40 %) y su recorrido (48 % del radio).
3. **Objetivo de 36 px preexistente** («Estaciones» de la guía) → 44 px.
4. La barra de herramientas de la guía invadía la zona segura lateral en horizontal → relleno con `env(safe-area-inset-left/right)`.

## 6. Aviso de vitest «Timeout calling "onTaskUpdate"»

Causa: pruebas de `shadow-antimemo` que bloquean el hilo del worker más de 60 s seguidos (el sorteo de 5.000 mapas en el `beforeAll` y, sobre todo, la prueba «(d) equidad», un bucle síncrono de ~80 s de auditorías). Cedí el control cada 50 sorteos en el `beforeAll` y cada 25 auditorías en la prueba (d), como en `property.ts`. Resultado: antes de la corrección la suite completa terminaba con «1 error» (código de salida 1) aunque los 286 tests pasaban; **después, la suite completa (29 archivos, 312 tests, 9 min 26 s) termina sin aviso y con código de salida 0**, y `shadow-antimemo` corrido solo también (5 min). Queda el riesgo de que en una máquina más lenta otro archivo pesado (`generator.hard`, 9 min con 4 procesos en paralelo) vuelva a pasarse de 60 s sin ceder; hoy no ocurre.

## 7. Decisiones propias y por qué

- **Joystick fijo, no flotante.** El flotante exige una zona táctil nueva en la mitad inferior que compite con el deslizar del lienzo (función existente); no era simple, así que no entra.
- **Banda de histéresis ×1,4 (±9,5°).** ×1,3 resultaba demasiado estrecha para un pulgar sobre una diagonal; ×1,4 queda cómoda sin que cueste cambiar de eje.
- **Zona muerta medida sobre el radio de la base**, no sobre el recorrido del pomo, tal como pedía el encargo (≈ 17 px a 135 px de base); el pomo recorre el 48 % del radio, así que la dirección se activa a medio recorrido y el tope es alcanzable con holgura.
- **Un botón de mano sobre el joystick** en vez de otro ícono en la cabecera: en 375 px la cabecera ya lleva cuatro botones de 44 px y el título se habría quedado sin sitio. Cuesta 44 px de alto en la pila del joystick.
- **Pellizco de zoom no bloqueado** (accesibilidad); solo el doble toque se evita (`touch-action: manipulation`).
- **Barra de estado de iOS en `default`**, no `black-translucent`: con el fondo claro el reloj saldría blanco sobre papel. A cambio, en modo instalado el contenido empieza bajo la barra.
- **«Esperar» en `pointerdown`** y el mismo cuidado para teclado/lector de pantalla (`click` con `detail === 0`).
- **Ayuda de iPhone en explorador y guía** (no en el inicio) porque ahí vive el botón que no existe; pausa el laberinto mientras está abierta. Se marca como vista al mostrarse, no al cerrarse: «una vez» es una vez.
- **Iconos del manifest con la misma tubería** (`npm run brand`), con el maskable a 56 % del lienzo para respetar la zona segura.
- **Capturas comprimidas** (paleta de 192 colores, teléfonos a 1×): 1 MB en total; los colores se aplanan un poco.

## 8. Lo que NO se pudo verificar (dicho sin adornos)

- **iOS Safari real.** Lo del iPhone se simuló con Chromium: perfil de iPhone 13, borrando la Fullscreen API y simulando `navigator.standalone`. No se probó el comportamiento real de Safari (que la ayuda diga justo el botón y el menú de la versión de iOS de cada quien, que «Agregar a pantalla de inicio» abra el manifest en pantalla completa, la barra de estado, el color del fondo al instalar, Chrome para iOS, el interruptor de silencio).
- **Vibración.** Se comprobó que la llamada se hace con soporte comprobado, no que el teléfono vibre ni que el tic de 10 ms se sienta (hay teléfonos que ignoran pulsos tan cortos).
- **Fullscreen API real en un teléfono.** En Chromium de escritorio entra y sale; no se probó en Android Chrome real (barra de navegación, gestos para salir, rotación dentro de pantalla completa) ni en iPad.
- **Multitáctil real y el «tacto» del joystick.** Los gestos se emularon con eventos táctiles exactos pero sin una mano: no sé si 25 % de zona muerta, ×1,4 de histéresis, 120–168 px y el resorte se sienten bien; si el pulgar alcanza el borde sin tapar el mapa; si el arco y el aro del pomo se leen a la luz del día; si el botón de mano se toca sin querer. `PLAYTEST.md` lo pregunta ahora.
- **Muesca y barra inferior reales.** Se simularon las zonas seguras con el CDP (`setSafeAreaInsetsOverride`); un iPhone real puede devolver otros valores (isla dinámica, barra de gestos que se oculta).
- **Rendimiento en un teléfono lento** del Canvas con el joystick animándose encima (las animaciones son solo `transform`/`opacity`, pero no se midió nada fuera de este entorno).
- **Manifest y «Instalar»** en un dispositivo real (que Chrome ofrezca instalar, que el ícono maskable se recorte bien).
- **Lectores de pantalla.** axe-core no sustituye a VoiceOver/TalkBack: el joystick es un grupo sin teclado propio (el teclado de escritorio sigue en las flechas y WASD); no se probó cómo lo anuncian.

## 9. Cómo reproducir

```bash
git fetch origin v2-sombra-cierre && git checkout v2-sombra-cierre
npm ci
npx tsc --noEmit && npx vitest run lib && npm run build
npm run brand        # regenera los íconos (og.png y apple-touch-icon.png no cambian)
npm run dev          # /?dev=843WHABB&role=explorer  (código con Sombra)
```

En el teléfono (mismo Wi-Fi) abre la dirección de `npm run dev` o del despliegue de vista previa y revisa: joystick en las cuatro direcciones y en las diagonales, mano izquierda, «Esperar» con el otro pulgar mientras caminas, pantalla completa (Android) o la ayuda de «Agregar a pantalla de inicio» (iPhone), y que ni la muesca ni la barra inferior tapen nada en vertical y en horizontal.
