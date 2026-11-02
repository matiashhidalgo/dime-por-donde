# Publicar y probar la rama v2 (instrucciones; no se ejecutó nada de esto)

Todo aquí lo haces tú. Nada de esto se hizo desde la sesión: no se tocó Vercel, ni la configuración del repo, ni `main`.

## 0. Antes de nada: ¿qué hay en cada rama?

| Rama | Qué es |
|---|---|
| `main` | La v1, la que está desplegada hoy en producción. |
| `v2` | El rediseño v2 (etapas 1 a 4). |
| `v2-sombra-cierre` | Esta rama: v2 + La Sombra (etapa 5) + auditoría, onboarding y cierre (etapa 6). El PR va hacia `v2`. |

Orden recomendado: **1)** probar `v2-sombra-cierre` en una vista previa; **2)** fusionar el PR hacia `v2`; **3)** cuando `v2` esté probado con una pareja real, fusionar `v2` a `main`.

## 1. Probar la rama en una vista previa de Vercel

Si el proyecto de Vercel está conectado a este repositorio de GitHub (debería estarlo, si `main` ya se despliega solo), cada rama que subes genera sola una **vista previa** (Preview). No hay que configurar nada.

1. Abre el proyecto en <https://vercel.com/dashboard> y entra a la pestaña **Deployments**.
2. Filtra por la rama `v2-sombra-cierre` (menú **Branch**). Verás el último despliegue con estado «Ready».
3. Toca **Visit** (o copia la URL). Tiene la forma `https://<proyecto>-git-v2-sombra-cierre-<equipo>.vercel.app` (la «URL de rama», que siempre apunta al último commit de la rama) y también una URL fija por commit, `https://<proyecto>-<hash>-<equipo>.vercel.app`.
4. En el PR de GitHub también aparece un comentario del bot de Vercel con el enlace.

Con la CLI, si prefieres (opcional): `npx vercel pull && npx vercel build && npx vercel deploy --prebuilt` crea una vista previa desde tu compu. No hace falta.

**Las dos personas deben abrir exactamente la misma URL de vista previa.** Cada despliegue es una versión distinta del juego: mezclar la vista previa con producción hace que el sello no coincida (ver sección 4).

### Las vistas previas pueden estar protegidas

Por defecto, muchos proyectos de Vercel protegen las vistas previas con **Vercel Authentication**: quien abre el enlace tiene que haber iniciado sesión en Vercel con una cuenta del equipo. Si tu pareja de juego ve una pantalla de inicio de sesión de Vercel en vez del juego, es eso. Opciones para compartirla con otra persona (los nombres de los menús pueden cambiar; si no los ves así, busca «Deployment Protection» en la documentación de Vercel):

1. **Enlace compartible (lo más cómodo).** Abre la vista previa con tu sesión iniciada; en la barra flotante de Vercel (abajo en la página) o en el panel del despliegue toca **Share** y crea un enlace. Pásaselo a la otra persona: abre la vista previa sin cuenta mientras el enlace siga vigente (suele durar unas horas; el panel te lo dice).
2. **Invitar a la persona al equipo** de Vercel (**Settings → Members**) para que inicie sesión.
3. **Quitar la protección de las vistas previas** (**Project → Settings → Deployment Protection**, apartado de Vercel Authentication, déjalo en «Production» en vez de «All deployments»). Cualquiera con el enlace podría abrirlo: úsalo solo mientras pruebas y vuelve a activarlo.

Ningún paso de aquí requiere tocar el código.

### Qué mirar en la vista previa (5 minutos, sin pareja)

- Inicio: aparece «Cómo se juega» (4 tarjetas) la primera vez; se puede saltar.
- Crear partida → el sello de la partida aparece como «Bosque · 7F3K». Es distinto del que daba la v1 (a propósito).
- Explorador (`?dev=` no existe en producción): crear y unirse con dos pestañas del navegador; en una pestaña elijan Guía y en la otra Explorador.
- En un mapa con Sombra: la guía ve el trazo con flechas y puntos; el explorador ve el icono del latido y el botón «Esperar».

## 2. Fusionar a `main` cuando esté probado

Hazlo solo cuando una pareja real haya jugado al menos 2 partidas únicas y 1 Racha en la vista previa (ver `PLAYTEST.md`).

**Por GitHub (recomendado):**

1. Fusiona el PR de `v2-sombra-cierre` hacia `v2` (botón **Merge pull request**).
2. Abre un PR nuevo: base `main`, comparar `v2`. Revisa el resumen y fusiónalo. Vercel despliega producción solo al llegar el commit a `main`.

**Por terminal (equivalente):**

```bash
git fetch origin
git checkout main
git pull origin main
git merge --no-ff origin/v2 -m "Dime por dónde v2"
git push origin main
```

Si Git avisa de conflictos, resuélvelos en `main`; el generador v1 y sus huellas «golden» no deberían cambiar (`npm test` lo comprueba).

Antes de empujar, comprueba en local:

```bash
npm ci
npx tsc --noEmit
npm test
npm run build
```

## 3. Volver atrás

**Rápido, sin tocar el código (Vercel):** en **Deployments**, busca el último despliegue de producción que sabías bueno (el de la v1), abre su menú (⋯) y elige **Promote to Production** (o **Instant Rollback**). Es inmediato y se puede deshacer promoviendo de nuevo el otro.

**Por git (deja la historia limpia):** busca el hash del commit de fusión y revírtelo.

```bash
git checkout main
git pull origin main
git log --merges --oneline -5          # anota el hash de «Dime por dónde v2»
git revert -m 1 <hash-de-la-fusion>
git push origin main
```

El historial de partidas de cada persona vive en su navegador (`localStorage`) y solo **agrega** campos, así que ir y volver entre v1 y v2 no pierde nada (ver el anexo de la etapa 2 de `GAME_SPEC_V2.md`).

## 4. Advertencia: `RULES_VERSION` y los sellos entre versiones

- El **sello** de la partida («Bosque · 7F3K») mezcla el laberinto con `RULES_VERSION` (`components/game/session.ts`, hoy **5**). Dos dispositivos con versiones distintas leen sellos distintos para el mismo código. **Si el sello no coincide, recarguen la página en los dos** (y comprueben que abrieron la misma URL: una vista previa y producción no son la misma versión).
- Qué pasa con cada combinación:
  - **Código v2 en el despliegue viejo (v1 en producción):** lo rechaza con «Ese código es de otra versión del juego. Actualicen ambos la página.» No hay partida cruzada.
  - **Código v1 en ambos despliegues:** mismo laberinto, **reglas distintas** (corazones, vela…), sellos distintos para que lo noten.
  - **Dos pestañas con `RULES_VERSION` 4 y 5 en un mismo código v2:** mismo laberinto y estaciones, pero solo la versión 5 tiene Sombra y «Esperar»; el sello lo delata antes de empezar.
- **Cada vez que cambien reglas que un despliegue anterior también acepta, hay que subir `RULES_VERSION`.** Si se olvida, parejas con versiones mezcladas jugarían creyendo que ven lo mismo.
- Mientras haya gente con una pestaña vieja abierta tras un despliegue, la partida en curso no se retoma entre versiones (la clave de sesión es `laberinto.live.v2`).
