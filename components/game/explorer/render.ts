import {
  type Dir,
  type Game,
  KEY_COLORS,
  PIT_KNOWN,
  PORTAL_SYMBOLS,
  type Palette,
  type PlayState,
  type Shape,
  THEMES,
  exitOpen,
  isOpen,
  stationEmblems,
} from "@/src/engine";
import { SWIRL_COLOR } from "../guide/map-art";
import { landmarkShapes } from "../landmark-shapes";

/**
 * Explorer view renderer: oblique top-down 2.5D on Canvas 2D. Up is up, like
 * the guide's map; walls stand toward the viewer with a darker front face.
 * No words anywhere: things are told apart by shape and color only (v2).
 * Stateless: draws whatever Scene it's given. Everything is drawn in CSS
 * pixels (the caller sets the DPR transform), and only cells inside the
 * camera and not fully fogged are touched.
 */

export interface Player {
  /** Center position in cell units (cell x + 0.5). */
  x: number;
  y: number;
  facing: Dir;
  /** Squash (−) / stretch (+). */
  squash: number;
  scale: number;
  alpha: number;
  /** Height above the floor, in cells. */
  hop: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  size: number;
  star: boolean;
}

export interface TrailPoint {
  x: number;
  y: number;
  life: number;
}
export const TRAIL_LIFE = 650;

export interface Scene {
  game: Game;
  pal: Palette;
  /** What the explorer knows right now (memo, keys, collected things). */
  state: PlayState;
  /** Displayed visibility per cell, eased toward `target`. */
  vis: Float32Array;
  target: Float32Array;
  cam: { x: number; y: number };
  tile: number;
  width: number;
  height: number;
  time: number;
  player: Player;
  shake: number;
  particles: Particle[];
  /** Fading streak left behind while sliding on ice (newest last). */
  trail: TrailPoint[];
  /** 0..1 strength of the inverted-controls effect. */
  invertFx: number;
  invertBoth: boolean;
  /** Sight radius in cells, eased toward the candle's (0 = darkness). */
  sightFx: number;
  /** 0..1 candle left, eased: drives the glow around the explorer. */
  lightFx: number;
  /** 0..1 red flash after losing a heart. */
  hurtFx: number;
  /** Items grouped by row for back-to-front drawing. */
  rows: RowItem[][];
}

export type RowItem =
  | { kind: "occ"; cell: number }
  | { kind: "landmark"; cell: number; index: number }
  | { kind: "station"; cell: number; index: number };

/** Per-theme look of slippery floor (desert ice is slick sand). */
const SLICK: Record<string, { base: string; streak: string; trail: string }> = {
  forest: { base: "#cfe6ef", streak: "rgba(255,255,255,0.75)", trail: "#ffffff" },
  cave: { base: "#7f97c6", streak: "rgba(220,235,255,0.55)", trail: "#e6f0ff" },
  ice: { base: "#bfe1f4", streak: "rgba(255,255,255,0.85)", trail: "#4f86b8" },
  desert: { base: "#f9e6c1", streak: "rgba(196,140,80,0.45)", trail: "#a8682e" },
};

const START_COLOR = "#3d9a5f";
/** The explorer's body color: warm and high-contrast on each theme's floor. */
const HERO: Record<string, string> = { forest: "#e8735a", cave: "#f2a65a", ice: "#ef6f6c", desert: "#2f9c8f" };
const STAR_FILL = "#f2b84b";
const STAR_EDGE = "#a5700f";

export function buildRows(game: Game): RowItem[][] {
  const rows: RowItem[][] = Array.from({ length: game.grid.height }, () => []);
  game.occupant.forEach((o, c) => {
    if (o && o.type !== "pit") rows[Math.floor(c / game.grid.width)].push({ kind: "occ", cell: c });
  });
  game.landmarks.forEach((l, index) => rows[Math.floor(l.cell / game.grid.width)].push({ kind: "landmark", cell: l.cell, index }));
  game.stations?.forEach((st) => rows[Math.floor(st.cell / game.grid.width)].push({ kind: "station", cell: st.cell, index: st.index }));
  return rows;
}

export function draw(ctx: CanvasRenderingContext2D, sc: Scene): void {
  const { game, pal, tile: T, width: W, height: H } = sc;
  const g = game.grid;
  const shakeX = sc.shake ? Math.sin(sc.time * 0.09) * sc.shake * T * 0.12 : 0;
  const shakeY = sc.shake ? Math.cos(sc.time * 0.113) * sc.shake * T * 0.1 : 0;
  const ox = W / 2 - sc.cam.x * T + shakeX;
  const oy = H / 2 - sc.cam.y * T + shakeY;
  const wallH = T * 0.3;
  const thick = Math.max(4, T * 0.19);

  // ── Background: the theme's haze. Structure fades INTO this exact color
  // (opaque color mixing, not transparency, so overlaps never go blotchy).
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.fog;
  ctx.fillRect(0, 0, W, H);
  const fog = pal.fog;

  const x0 = Math.max(0, Math.floor(sc.cam.x - W / 2 / T) - 1);
  const x1 = Math.min(g.width - 1, Math.ceil(sc.cam.x + W / 2 / T) + 1);
  const y0 = Math.max(0, Math.floor(sc.cam.y - H / 2 / T) - 1);
  const y1 = Math.min(g.height - 1, Math.ceil(sc.cam.y + H / 2 / T) + 2);
  const vis = sc.vis;
  const at = (x: number, y: number) => y * g.width + x;
  const slick = SLICK[game.theme];

  // ── Floor tiles: soft slabs with a darker front edge.
  const inset = Math.max(1, T * 0.03);
  const radius = T * 0.18;
  const edge = Math.max(2, T * 0.07);
  const tw = T - inset * 2;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = at(x, y);
      const a = vis[c];
      if (a < 0.01) continue;
      ctx.globalAlpha = 1;
      const px = ox + x * T;
      const py = oy + y * T;
      const top = game.ice[c] ? slick.base : (x + y) % 2 ? pal.floorAlt : pal.floor;
      ctx.fillStyle = fade(shade(top, -0.16), fog, a);
      roundRect(ctx, px + inset, py + inset, tw, tw, radius);
      ctx.fill();
      ctx.fillStyle = fade(top, fog, a);
      roundRect(ctx, px + inset, py + inset, tw, tw - edge, radius);
      ctx.fill();
      if (game.ice[c]) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = slick.streak;
        ctx.lineWidth = Math.max(1, T * 0.035);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px + T * 0.22, py + T * 0.62);
        ctx.lineTo(px + T * 0.48, py + T * 0.36);
        ctx.moveTo(px + T * 0.5, py + T * 0.76);
        ctx.lineTo(px + T * 0.78, py + T * 0.48);
        ctx.stroke();
      }
      if (sc.state.memo[c] & PIT_KNOWN) {
        ctx.globalAlpha = a;
        drawPit(ctx, px + T / 2, py + T / 2, T, pal);
      }
    }
  }

  // ── Soft wall shadows on the floor (cast down-right).
  ctx.fillStyle = pal.shadow;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = at(x, y);
      const a = vis[c];
      if (a < 0.01) continue;
      ctx.globalAlpha = a * 0.9;
      const px = ox + x * T;
      const py = oy + y * T;
      if (!isOpen(g, c, 0)) ctx.fillRect(px + thick * 0.3, py + thick / 2, T, thick * 0.9);
      if (!isOpen(g, c, 3)) ctx.fillRect(px + thick / 2, py + thick * 0.4, thick * 0.9, T);
    }
  }

  // ── Floor decals: start pad, portals, swirls, exit light, player shadow.
  for (let y = y0; y <= y1; y++) {
    for (const item of sc.rows[y]) {
      if (item.kind === "landmark") continue;
      const c = item.cell;
      const a = vis[c];
      if (a < 0.01) continue;
      const cx = ox + (c % g.width) * T + T / 2;
      const cy = oy + y * T + T / 2;
      ctx.globalAlpha = a;
      if (item.kind === "station") {
        drawStationPlate(ctx, cx, cy, T, (sc.state.seals & (1 << item.index)) !== 0, sc.time);
        continue;
      }
      const o = game.occupant[c]!;
      if (o.type === "start") drawStartPad(ctx, cx, cy, T);
      else if (o.type === "portal") drawPortal(ctx, cx, cy, T, game.portals[o.pair].symbol, sc.time);
      else if (o.type === "swirl") drawSwirl(ctx, cx, cy, T, game.swirls[o.index].axes === "xy", sc.time);
      else if (o.type === "exit" && exitOpen(game, sc.state)) drawExitLight(ctx, cx, cy, T, pal, sc.time);
    }
  }
  // Ice trail: two thin runner lines that fade from the tail.
  if (sc.trail.length > 1) {
    ctx.strokeStyle = SLICK[game.theme].trail;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, T * 0.05);
    for (const off of [-0.11, 0.11]) {
      for (let i = 1; i < sc.trail.length; i++) {
        const a = sc.trail[i - 1];
        const b = sc.trail[i];
        const horiz = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
        const sx = horiz ? 0 : off * T;
        const sy = horiz ? off * T + T * 0.06 : 0;
        ctx.globalAlpha = (0.75 * Math.min(a.life, b.life)) / TRAIL_LIFE;
        ctx.beginPath();
        ctx.moveTo(ox + a.x * T + sx, oy + a.y * T + sy);
        ctx.lineTo(ox + b.x * T + sx, oy + b.y * T + sy);
        ctx.stroke();
      }
    }
  }

  const p = sc.player;
  const psx = ox + p.x * T;
  const psy = oy + p.y * T;
  ctx.globalAlpha = 0.28 * p.alpha * Math.max(0.3, 1 - p.hop);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(psx, psy + T * 0.06, T * 0.24 * p.scale, T * 0.085 * p.scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Rows back to front: north walls, side walls, things standing, player.
  const playerRow = Math.floor(p.y);
  for (let y = y0; y <= y1 + 1; y++) {
    if (y <= g.height) {
      for (let x = x0; x <= x1; x++) {
        const below = y < g.height ? at(x, y) : -1;
        const above = y > 0 ? at(x, y - 1) : -1;
        const closed = below >= 0 ? !isOpen(g, below, 0) : true;
        if (!closed) continue;
        const a = Math.max(below >= 0 ? vis[below] : 0, above >= 0 ? vis[above] : 0);
        if (a < 0.01) continue;
        hWall(ctx, ox + x * T, oy + y * T, T, thick, wallH, pal, fog, a);
      }
    }
    if (y >= g.height) continue;
    for (let x = x0; x <= x1 + 1; x++) {
      if (x > g.width) continue;
      const right = x < g.width ? at(x, y) : -1;
      const left = x > 0 ? at(x - 1, y) : -1;
      const closed = right >= 0 ? !isOpen(g, right, 3) : true;
      if (!closed) continue;
      const a = Math.max(right >= 0 ? vis[right] : 0, left >= 0 ? vis[left] : 0);
      if (a < 0.01) continue;
      vWall(ctx, ox + x * T, oy + y * T, T, thick, wallH, pal, fog, a);
    }
    ctx.globalAlpha = 1;
    for (const item of sc.rows[y]) {
      const a = vis[item.cell];
      if (a < 0.01) continue;
      const cx = ox + (item.cell % g.width) * T + T / 2;
      const cy = oy + y * T + T / 2;
      ctx.globalAlpha = a;
      if (item.kind === "landmark") drawLandmark(ctx, sc, item.index, cx, cy, T);
      else if (item.kind === "station") drawStation(ctx, sc, item.index, cx, cy, T);
      else drawThing(ctx, sc, item.cell, cx, cy, T, wallH, thick);
    }
    if (y === playerRow && p.alpha > 0.01) drawPlayer(ctx, psx, psy, T, p, HERO[game.theme] ?? pal.accent, sc.time);
  }

  // ── Light: the candle's warm glow around the explorer (it shrinks and
  // flickers as it burns), then fog closing in at the edges.
  ctx.globalAlpha = 1;
  const flicker = sc.lightFx < 0.25 ? 0.75 + 0.25 * Math.sin(sc.time / 70) * Math.sin(sc.time / 190) : 1;
  const glowR = T * (0.8 + sc.lightFx * 1.6) * flicker;
  if (sc.lightFx > 0.005) {
    const glow = ctx.createRadialGradient(psx, psy, 0, psx, psy, glowR);
    glow.addColorStop(0, withAlpha(pal.glow, (0.18 + sc.lightFx * 0.18) * flicker));
    glow.addColorStop(1, withAlpha(pal.glow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(psx - glowR, psy - glowR, glowR * 2, glowR * 2);
  }

  const sight = sc.sightFx;
  const fogInner = T * (sight + 0.3);
  const fogOuter = T * (sight + 5);
  const haze = ctx.createRadialGradient(psx, psy, fogInner, psx, psy, fogOuter);
  haze.addColorStop(0, withAlpha(pal.fog, 0));
  haze.addColorStop(1, withAlpha(pal.fog, 0.55));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);
  // Running low: real darkness creeps in from the edges, total when it's out.
  const dark = Math.max(0, Math.min(1, 1 - sight / 1.5));
  if (dark > 0.01) {
    const night = ctx.createRadialGradient(psx, psy, T * (0.35 + sight * 0.6), psx, psy, T * (1.4 + sight * 1.5));
    night.addColorStop(0, "rgba(8,6,14,0)");
    night.addColorStop(1, `rgba(8,6,14,${(0.55 + 0.4 * dark) * dark})`);
    ctx.fillStyle = night;
    ctx.fillRect(0, 0, W, H);
  }
  // A breath of the theme's sky over everything: dusk, cave dark, cold air.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, withAlpha(pal.skyTop, 0.14));
  sky.addColorStop(1, withAlpha(pal.skyBottom, 0.12));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  if (sc.invertFx > 0.01) {
    const inv = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    inv.addColorStop(0, withAlpha(SWIRL_COLOR, 0));
    inv.addColorStop(1, withAlpha(SWIRL_COLOR, 0.38 * sc.invertFx));
    ctx.fillStyle = inv;
    ctx.fillRect(0, 0, W, H);
    // A little orbit of swirls around the explorer while controls are inverted.
    ctx.globalAlpha = sc.invertFx;
    ctx.strokeStyle = SWIRL_COLOR;
    ctx.lineWidth = Math.max(1.5, T * 0.045);
    ctx.lineCap = "round";
    const orbit = sc.invertBoth ? 3 : 2;
    for (let i = 0; i < orbit; i++) {
      const ang = sc.time / 520 + (i * Math.PI * 2) / orbit;
      spiral(ctx, psx + Math.cos(ang) * T * 0.48, psy - T * 0.32 + Math.sin(ang) * T * 0.2, T * 0.11, sc.time / 300);
    }
  }

  // ── Particles (stars, confetti, dust).
  for (const q of sc.particles) {
    const k = Math.max(0, q.life / q.max);
    ctx.globalAlpha = Math.min(1, k * 1.6);
    const qx = ox + q.x * T;
    const qy = oy + q.y * T - q.z * T;
    ctx.fillStyle = q.color;
    if (q.star) {
      starPath(ctx, qx, qy, q.size * T);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(qx, qy, q.size * T, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── A heart lost: a red pulse closing in from the edges.
  if (sc.hurtFx > 0.01) {
    const hurt = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    hurt.addColorStop(0, "rgba(200,30,50,0)");
    hurt.addColorStop(1, `rgba(200,30,50,${0.5 * sc.hurtFx})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = hurt;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────── walls

function hWall(ctx: CanvasRenderingContext2D, px: number, py: number, T: number, t: number, h: number, pal: Palette, fog: string, a: number) {
  const x = px - t / 2;
  const w = T + t;
  ctx.fillStyle = fade(pal.wallFace, fog, a);
  ctx.fillRect(x, py + t / 2 - h, w, h);
  ctx.fillStyle = fade(pal.wallTop, fog, a);
  ctx.fillRect(x, py - t / 2 - h, w, t);
  ctx.fillStyle = fade(shade(pal.wallTop, 0.22), fog, a);
  ctx.fillRect(x, py - t / 2 - h, w, Math.max(1, t * 0.18));
}

function vWall(ctx: CanvasRenderingContext2D, px: number, py: number, T: number, t: number, h: number, pal: Palette, fog: string, a: number) {
  const x = px - t / 2;
  ctx.fillStyle = fade(pal.wallFace, fog, a);
  ctx.fillRect(x, py + T + t / 2 - h, t, h);
  ctx.fillStyle = fade(pal.wallTop, fog, a);
  ctx.fillRect(x, py - t / 2 - h, t, T + t);
  ctx.fillStyle = fade(shade(pal.wallTop, 0.22), fog, a);
  ctx.fillRect(x, py - t / 2 - h, Math.max(1, t * 0.18), T + t);
}

// ─────────────────────────────────────────────────────────────── things

function drawThing(ctx: CanvasRenderingContext2D, sc: Scene, c: number, cx: number, cy: number, T: number, wallH: number, thick: number) {
  const o = sc.game.occupant[c]!;
  const s = sc.state;
  const bob = Math.sin(sc.time / 420 + c) * T * 0.04;
  switch (o.type) {
    case "exit":
      drawExitArch(ctx, cx, cy, T, sc.pal, exitOpen(sc.game, s));
      break;
    case "checkpoint":
      drawCandle(ctx, cx, cy, T, (s.candles & (1 << o.index)) === 0, sc.time);
      break;
    case "door":
      drawDoor(ctx, sc.game, c, cx, cy, T, wallH, thick, (s.keys & (1 << o.color)) !== 0);
      break;
    case "key":
      if (s.keys & (1 << o.color)) return;
      shadow(ctx, cx, cy, T * 0.2);
      drawKey(ctx, cx, cy - T * 0.3 + bob, T * 0.24, o.color);
      break;
    case "star":
      if (s.stars & (1 << o.index)) return;
      shadow(ctx, cx, cy, T * 0.18);
      ctx.save();
      ctx.translate(cx, cy - T * 0.32 + bob);
      ctx.scale(0.75 + 0.25 * Math.cos(sc.time / 500 + c), 1);
      ctx.fillStyle = STAR_FILL;
      ctx.strokeStyle = STAR_EDGE;
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.lineJoin = "round";
      starPath(ctx, 0, 0, T * 0.22);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    case "lantern":
      if (s.lanterns & (1 << o.index)) return;
      drawLantern(ctx, cx, cy, T, sc.time);
      break;
  }
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.5, r, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;
}

function drawPit(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, pal: Palette) {
  ctx.fillStyle = pal.wallFace;
  ctx.beginPath();
  ctx.ellipse(cx, cy, T * 0.36, T * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#120f18";
  ctx.beginPath();
  ctx.ellipse(cx, cy + T * 0.03, T * 0.3, T * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawStartPad(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.55;
  ctx.fillStyle = START_COLOR;
  ctx.beginPath();
  ctx.ellipse(cx, cy + T * 0.05, T * 0.34, T * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;
  ctx.strokeStyle = START_COLOR;
  ctx.lineWidth = Math.max(1, T * 0.035);
  ctx.beginPath();
  ctx.ellipse(cx, cy + T * 0.05, T * 0.4, T * 0.31, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, symbol: number, time: number) {
  const s = PORTAL_SYMBOLS[symbol];
  const a = ctx.globalAlpha;
  const r = T * 0.4;
  ctx.globalAlpha = a * 0.25;
  ctx.fillStyle = s.hex;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;
  ctx.strokeStyle = s.hex;
  ctx.lineWidth = Math.max(1.5, T * 0.05);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([T * 0.07, T * 0.06]);
  ctx.lineDashOffset = -time / 40;
  ctx.lineWidth = Math.max(1, T * 0.03);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.74, r * 0.6, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // The symbol floats above the ring so it reads from any side.
  const lift = T * 0.22 + Math.sin(time / 380 + symbol) * T * 0.03;
  shapePath(ctx, s.shape, cx, cy - lift, T * 0.17);
  ctx.fillStyle = s.hex;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(1.2, T * 0.035);
  ctx.lineJoin = "round";
  ctx.stroke();
}

function drawSwirl(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, both: boolean, time: number) {
  ctx.strokeStyle = SWIRL_COLOR;
  ctx.lineWidth = Math.max(1.5, T * 0.05);
  ctx.lineCap = "round";
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.8);
  spiral(ctx, 0, 0, T * 0.3, time / 700);
  if (both) {
    ctx.setLineDash([T * 0.08, T * 0.06]);
    ctx.beginPath();
    ctx.arc(0, 0, T * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawExitLight(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, pal: Palette, time: number) {
  const a = ctx.globalAlpha;
  const pulse = 0.5 + 0.5 * Math.sin(time / 500);
  const r = T * (0.75 + pulse * 0.12);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, withAlpha(pal.glow, 0.9));
  grad.addColorStop(1, withAlpha(pal.glow, 0));
  ctx.globalAlpha = a;
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function drawExitArch(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, pal: Palette, open: boolean) {
  const w = T * 0.62;
  const h = T * 0.72;
  const base = cy + T * 0.18;
  // Stone arch with stairs of light going down.
  ctx.fillStyle = pal.wallFace;
  archPath(ctx, cx, base, w, h);
  ctx.fill();
  ctx.fillStyle = pal.wallTop;
  archPath(ctx, cx, base - T * 0.04, w * 0.98, h);
  ctx.fill();
  const inner = ctx.createLinearGradient(0, base - h * 0.8, 0, base);
  inner.addColorStop(0, "#fff7d6");
  inner.addColorStop(1, pal.glow);
  ctx.fillStyle = inner;
  archPath(ctx, cx, base, w * 0.62, h * 0.78);
  ctx.fill();
  ctx.strokeStyle = withAlpha(pal.wallFace, 0.5);
  ctx.lineWidth = Math.max(1, T * 0.025);
  for (let i = 1; i <= 3; i++) {
    const yy = base - (h * 0.78 * i) / 4.2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, yy);
    ctx.lineTo(cx + w * 0.28, yy);
    ctx.stroke();
  }
  if (open) return;
  // Sealed: dark doorway behind iron bars with three empty sockets above.
  ctx.fillStyle = shade(pal.wallFace, -0.45);
  archPath(ctx, cx, base, w * 0.62, h * 0.78);
  ctx.fill();
  ctx.strokeStyle = "#2a2622";
  ctx.lineWidth = Math.max(1.5, T * 0.035);
  for (const k of [-0.2, 0, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(cx + w * k, base);
    ctx.lineTo(cx + w * k, base - h * 0.72);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.31, base - h * 0.4);
  ctx.lineTo(cx + w * 0.31, base - h * 0.4);
  ctx.stroke();
}

function archPath(ctx: CanvasRenderingContext2D, cx: number, base: number, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, base);
  ctx.lineTo(cx - r, base - h + r);
  ctx.arc(cx, base - h + r, r, Math.PI, 0);
  ctx.lineTo(cx + r, base);
  ctx.closePath();
}

/** A route candle (v2 replaces the respawn flags): lit until used, then a stub. */
function drawCandle(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, lit: boolean, time: number) {
  const a = ctx.globalAlpha;
  const w = T * 0.13;
  const h = lit ? T * 0.34 : T * 0.12;
  const base = cy + T * 0.08;
  if (lit) {
    const flicker = 0.85 + 0.15 * Math.sin(time / 80 + cx) * Math.sin(time / 210);
    const halo = ctx.createRadialGradient(cx, base - h - T * 0.08, 0, cx, base - h - T * 0.08, T * 0.42);
    halo.addColorStop(0, `rgba(255,190,90,${0.5 * flicker})`);
    halo.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - T * 0.45, base - h - T * 0.5, T * 0.9, T * 0.9);
    ctx.globalAlpha = a;
  }
  shadow(ctx, cx, cy, T * 0.13);
  ctx.globalAlpha = a;
  ctx.fillStyle = "#6b4a2f";
  ctx.beginPath();
  ctx.ellipse(cx, base, w * 1.25, w * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit ? "#f6ead2" : "#cdbfa6";
  roundRect(ctx, cx - w / 2, base - h, w, h, w * 0.3);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,40,20,0.45)";
  ctx.lineWidth = Math.max(1, T * 0.02);
  ctx.stroke();
  if (lit) {
    const fy = base - h - T * 0.02;
    const sway = Math.sin(time / 160 + cx) * T * 0.015;
    ctx.fillStyle = "#ffb43d";
    ctx.beginPath();
    ctx.moveTo(cx, fy);
    ctx.quadraticCurveTo(cx - T * 0.06, fy - T * 0.06, cx + sway, fy - T * 0.17);
    ctx.quadraticCurveTo(cx + T * 0.06, fy - T * 0.06, cx, fy);
    ctx.fill();
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath();
    ctx.ellipse(cx, fy - T * 0.05, T * 0.022, T * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#2b2520";
    ctx.beginPath();
    ctx.moveTo(cx, base - h);
    ctx.lineTo(cx + T * 0.02, base - h - T * 0.05);
    ctx.stroke();
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, game: Game, c: number, cx: number, cy: number, T: number, wallH: number, thick: number, open: boolean) {
  const k = KEY_COLORS[(game.occupant[c] as { color: number }).color];
  const across = isOpen(game.grid, c, 0) || isOpen(game.grid, c, 2); // N-S corridor → bar lies E-W
  const h = open ? wallH * 0.18 : wallH * 0.95;
  const d = thick * 1.6;
  ctx.save();
  if (open) ctx.globalAlpha *= 0.55;
  if (across) {
    const x = cx - T / 2;
    ctx.fillStyle = shade(k.hex, -0.28);
    ctx.fillRect(x, cy + d / 2 - h, T, h);
    ctx.fillStyle = k.hex;
    ctx.fillRect(x, cy - d / 2 - h, T, d);
    emblem(ctx, k.shape, k.hex, cx, cy + d / 2 - h / 2, Math.min(T * 0.15, h * 0.42 + T * 0.04));
  } else {
    const y = cy - T / 2;
    ctx.fillStyle = shade(k.hex, -0.28);
    ctx.fillRect(cx - d / 2, y + T + 0 - h, d, h);
    ctx.fillStyle = k.hex;
    ctx.fillRect(cx - d / 2, y - h, d, T);
    emblem(ctx, k.shape, k.hex, cx, cy - h - T * 0.05, T * 0.15);
  }
  ctx.restore();
}

function emblem(ctx: CanvasRenderingContext2D, shape: Shape, hex: string, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
  shapePath(ctx, shape, cx, cy, r * 0.8);
  ctx.fillStyle = hex;
  ctx.fill();
}

function drawKey(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: number) {
  const k = KEY_COLORS[color];
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2b2520";
  ctx.lineWidth = r * 0.36;
  keyShaft(ctx, cx, cy, r);
  ctx.strokeStyle = k.hex;
  ctx.lineWidth = r * 0.18;
  keyShaft(ctx, cx, cy, r);
  shapePath(ctx, k.shape, cx - r * 0.45, cy, r * 0.6);
  ctx.fillStyle = k.hex;
  ctx.fill();
  ctx.strokeStyle = "#2b2520";
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.lineJoin = "round";
  ctx.stroke();
}

function keyShaft(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.1, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx + r * 0.65, cy);
  ctx.lineTo(cx + r * 0.65, cy + r * 0.35);
  ctx.moveTo(cx + r * 0.35, cy);
  ctx.lineTo(cx + r * 0.35, cy + r * 0.28);
  ctx.stroke();
}

function drawLantern(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, time: number) {
  const a = ctx.globalAlpha;
  const flicker = 0.85 + 0.15 * Math.sin(time / 90) * Math.sin(time / 230);
  const top = cy - T * 0.5;
  const halo = ctx.createRadialGradient(cx, top + T * 0.12, 0, cx, top + T * 0.12, T * 0.5);
  halo.addColorStop(0, `rgba(255,209,102,${0.55 * flicker})`);
  halo.addColorStop(1, "rgba(255,209,102,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(cx - T * 0.5, top - T * 0.38, T, T);
  shadow(ctx, cx, cy, T * 0.14);
  ctx.globalAlpha = a;
  ctx.strokeStyle = "#6b4a00";
  ctx.lineWidth = Math.max(1.2, T * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx, cy + T * 0.1);
  ctx.lineTo(cx, top + T * 0.26);
  ctx.stroke();
  ctx.fillStyle = "#ffd166";
  roundRect(ctx, cx - T * 0.1, top, T * 0.2, T * 0.26, T * 0.05);
  ctx.fill();
  ctx.stroke();
}

const pathCache = new WeakMap<Game, Path2D[]>();
const emblemCache = new WeakMap<Game, Path2D[]>();
const SEAL_GOLD = "#f2b84b";

/** The stone plate under a station: a ring of light while its seal is still to win. */
function drawStationPlate(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, sealed: boolean, time: number) {
  const a = ctx.globalAlpha;
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + T * 0.08, T * 0.42, T * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, T * 0.04);
  ctx.strokeStyle = sealed ? SEAL_GOLD : `rgba(255,236,180,${0.45 + 0.25 * Math.sin(time / 600)})`;
  ctx.setLineDash(sealed ? [] : [T * 0.08, T * 0.06]);
  ctx.beginPath();
  ctx.ellipse(cx, cy + T * 0.08, T * 0.4, T * 0.18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = a;
}

/**
 * A station: a stone post holding a medallion with this game's emblem (the
 * same path the guide's map and the seals HUD draw). Once its seal is won the
 * medallion turns gold and gets a ring of rays.
 */
function drawStation(ctx: CanvasRenderingContext2D, sc: Scene, index: number, cx: number, cy: number, T: number) {
  let paths = emblemCache.get(sc.game);
  if (!paths) {
    paths = stationEmblems(sc.game).map((e) => new Path2D(e.d));
    emblemCache.set(sc.game, paths);
  }
  const sealed = (sc.state.seals & (1 << index)) !== 0;
  const pal = sc.pal;
  const base = cy + T * 0.1;
  const r = T * 0.24;
  const my = base - T * 0.52;
  // Post.
  ctx.fillStyle = pal.wallFace;
  roundRect(ctx, cx - T * 0.07, my, T * 0.14, base - my, T * 0.03);
  ctx.fill();
  // Medallion.
  if (sealed) {
    ctx.strokeStyle = withAlpha(SEAL_GOLD, 0.7);
    ctx.lineWidth = Math.max(1, T * 0.025);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + sc.time / 2400;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r * 1.15, my + Math.sin(ang) * r * 1.15);
      ctx.lineTo(cx + Math.cos(ang) * r * 1.45, my + Math.sin(ang) * r * 1.45);
      ctx.stroke();
    }
  }
  ctx.fillStyle = sealed ? SEAL_GOLD : pal.wallTop;
  ctx.strokeStyle = sealed ? "#a5700f" : shade(pal.wallFace, -0.25);
  ctx.lineWidth = Math.max(1.5, T * 0.04);
  ctx.beginPath();
  ctx.arc(cx, my, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const path = paths[index];
  if (!path) return;
  ctx.save();
  ctx.translate(cx, my);
  ctx.scale(r * 0.72, r * 0.72);
  ctx.fillStyle = sealed ? "#5a3a08" : shade(pal.wallFace, -0.35);
  ctx.fill(path);
  ctx.restore();
}

/**
 * Landmarks: this game's generated silhouettes (the same paths the guide's map
 * draws), standing in the cell's back-left corner so the explorer walks past.
 */
function drawLandmark(ctx: CanvasRenderingContext2D, sc: Scene, index: number, cx: number, cy: number, T: number) {
  let paths = pathCache.get(sc.game);
  if (!paths) {
    paths = landmarkShapes(sc.game).map((s) => new Path2D(s.d));
    pathCache.set(sc.game, paths);
  }
  const path = paths[index];
  if (!path) return;
  const r = T * 0.27;
  const x = cx - T * 0.16;
  const base = cy + T * 0.06;
  shadow(ctx, x, base - T * 0.02, r * 0.9);
  ctx.save();
  ctx.translate(x, base - r);
  ctx.scale(r, r);
  ctx.fillStyle = shade(sc.pal.wallFace, -0.15);
  ctx.fill(path);
  ctx.strokeStyle = shade(sc.pal.wallTop, 0.25);
  ctx.lineWidth = 0.09;
  ctx.lineJoin = "round";
  ctx.stroke(path);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── player

function drawPlayer(ctx: CanvasRenderingContext2D, sx: number, sy: number, T: number, p: Player, hero: string, time: number) {
  const breathe = Math.sin(time / 650) * 0.035;
  const sq = p.squash + breathe;
  const r = T * 0.25 * p.scale;
  const sxs = 1 - sq * 0.16;
  const sys = 1 + sq * 0.2;
  const by = sy + T * 0.04 - r * sys - p.hop * T;
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.translate(sx, by);
  ctx.scale(sxs, sys);
  // Body
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  grad.addColorStop(0, shade(hero, 0.35));
  grad.addColorStop(1, hero);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,20,20,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  // Sprout
  ctx.strokeStyle = "#4f8a4c";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.quadraticCurveTo(r * 0.05, -r * 1.25, r * 0.2, -r * 1.35);
  ctx.stroke();
  ctx.fillStyle = "#6fb36b";
  ctx.beginPath();
  ctx.ellipse(r * 0.33, -r * 1.38, r * 0.22, r * 0.11, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Face looks where it's going.
  const fx = [0, 1, 0, -1][p.facing] * r * 0.24;
  const fy = [-1, 0, 1, 0][p.facing] * r * 0.16;
  if (p.facing !== 0) {
    ctx.fillStyle = "rgba(255,120,120,0.45)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.52 + fx, r * 0.18 + fy, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.52 + fx, r * 0.18 + fy, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    const ex = side * r * 0.3 + fx;
    const ey = -r * 0.08 + fy;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.17, r * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2730";
    ctx.beginPath();
    ctx.arc(ex + fx * 0.25, ey + fy * 0.3 + r * 0.03, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── helpers

export function shapePath(ctx: CanvasRenderingContext2D, shape: Shape, cx: number, cy: number, r: number) {
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      break;
    case "square":
      roundRect(ctx, cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6, r * 0.15);
      break;
    case "triangle":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.75);
      ctx.lineTo(cx - r, cy + r * 0.75);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      break;
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      break;
  }
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (Math.PI / 5) * i;
    if (i === 0) ctx.moveTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    else ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath();
}

function spiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const a = t * Math.PI * 4 + rot;
    const x = cx + r * t * Math.cos(a);
    const y = cy + r * t * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const alphaCache = new Map<string, string>();
/** "#rrggbb" + alpha → "rgba(…)" (cached; gradients ask for these every frame). */
export function withAlpha(hex: string, a: number): string {
  const q = Math.round(a * 100) / 100;
  const key = `${hex}${q}`;
  let v = alphaCache.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${q})`;
    if (alphaCache.size > 500) alphaCache.clear();
    alphaCache.set(key, v);
  }
  return v;
}

const fadeCache = new Map<string, string>();
/** Opaque mix of `hex` into the fog: a = 1 → hex, a = 0 → fog (24 cached steps). */
export function fade(hex: string, fog: string, a: number): string {
  const q = Math.max(0, Math.min(24, Math.round(a * 24)));
  const key = `${hex}${fog}${q}`;
  let v = fadeCache.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    const f = parseInt(fog.slice(1), 16);
    const k = q / 24;
    const ch = (sh: number) => Math.round(((f >> sh) & 255) + (((n >> sh) & 255) - ((f >> sh) & 255)) * k);
    v = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
    if (fadeCache.size > 2000) fadeCache.clear();
    fadeCache.set(key, v);
  }
  return v;
}

const shadeCache = new Map<string, string>();
/** Lighten (+) or darken (−) a "#rrggbb" color. */
export function shade(hex: string, k: number): string {
  const key = `${hex}${k}`;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  const out = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  shadeCache.set(key, out);
  return out;
}

export const themePalette = (game: Game) => THEMES[game.theme].palette;
