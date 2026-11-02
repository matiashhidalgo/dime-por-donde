# Plan: jugar bien en el teléfono (pantalla completa + joystick)

Rama `v2-sombra-cierre` (PR #1). Cambios solo de interfaz: no cambian reglas, `RULES_VERSION` sigue en 5 y `src/engine` no se toca.

## Orden de trabajo (cada paso = un commit pequeño)

1. **Línea base** y arreglo del aviso `Timeout calling "onTaskUpdate"` de `shadow-antimemo` (ceder el control cada 50 sorteos, como en `property.ts`).
2. **Lógica pura del joystick** `lib/joystick.ts` + tests: vector → una de 4 direcciones con zona muerta (25 % del radio), histéresis de sector y de zona muerta; ajustes guardados con migración de la cruceta antigua.
3. **Componente `Joystick`** (`components/game/explorer/joystick.tsx`): puntero con captura y `pointerId` propio, pomo que sigue al dedo, resorte al soltar, tic háptico al cambiar de dirección, `prefers-reduced-motion`. Sustituye a `DPad` en el explorador; ajuste «mano izquierda/derecha» (intercambia lados con «Esperar»).
4. **Pantalla completa**: `lib/display.ts` (detección pura: Fullscreen API con prefijos, iPhone, modo standalone) + tests; `components/game/fullscreen.tsx` (botón con `fullscreenchange`, ayuda «Agregar a pantalla de inicio» para iPhone una sola vez). Botón en cabeceras de explorador y guía.
5. **Manifest e iconos**: `app/manifest.ts` (`force-static`), iconos 192/512/maskable por `npm run brand`, metadatos (`viewport-fit=cover`, `apple-mobile-web-app-capable`, estilo de barra de estado, `theme-color`).
6. **Maquetación móvil**: `dvh`, `env(safe-area-inset-*)` en cabecera, HUD, joystick y «Esperar» (también en horizontal), `overscroll-behavior: none`, `touch-action: manipulation`, sin selección ni menú táctil en los controles. Horizontal: joystick a un lado, «Esperar» al otro, mapa al centro.
7. **Verificación**: tsc, vitest (archivos nuevos, luego la suite completa una vez), build, Playwright con Chromium en 375×812, 812×375 y tableta, con muesca simulada; axe-core; capturas en `docs/capturas-movil/`.
8. **Entrega**: `docs/INFORME_MOVIL.md`, push.

## Decisiones previas

- **Joystick fijo, no flotante.** El flotante exige otra zona táctil en la mitad inferior que choca con el gesto de deslizar del lienzo (que es una función existente); no es simple, así que no entra.
- **Salida de 4 direcciones.** Eje dominante; para no parpadear en diagonales, se mantiene el eje actual mientras el otro no lo supere por un margen (×1,4). La zona muerta tiene histéresis propia (entra a 25 %, suelta a 18 %).
- **Zoom:** no se bloquea el pellizco (accesibilidad); el doble toque se evita con `touch-action: manipulation`.
- **Barra de estado de iOS** en `default`: con `black-translucent` el reloj saldría blanco sobre papel claro.
- **Ajuste de la cruceta antigua** (`laberinto.dpad.v1`): si no hay ajuste nuevo, su valor decide solo si el joystick se muestra; nada más. Valores raros se ignoran.
- **Ayuda de iPhone** como diálogo de una sola vez en explorador y guía; en el explorador pausa el laberinto mientras está abierto.
- **Sin nombres de objetos ni emoji**: íconos de lucide o propios.

## Qué no se puede comprobar aquí

iOS Safari real, vibración, Fullscreen API real en un teléfono, multitáctil real y el «tacto» del joystick. Se dirá en el informe.
