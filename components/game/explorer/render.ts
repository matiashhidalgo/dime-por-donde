import {
  DIFFICULTIES,
  type Dir,
  type Game,
  KEY_COLORS,
  type Landmark,
  PIT_KNOWN,
  PORTAL_SYMBOLS,
  type Palette,
  type PlayState,
  type Shape,
  THEMES,
  isOpen,
  keyName,
  doorName,
  portalName,
} from "@/src/engine";
import { SWIRL_COLOR } from "../guide/map-art";

/**
 * Explorer view renderer: oblique top-down 2.5D on Canvas 2D. Up is up, like
 * the guide's map; walls stand toward the viewer with a darker front face.
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
  /** 1 where the cell is in sight right now (labels only show there). */
  inSight: Uint8Array;
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
  /** 0..1 strength of the lantern light. */
  lanternFx: number;
  /** Items grouped by row for back-to-front drawing. */
  rows: RowItem[][];
  fonts: { ui: string; display: string };
}

export type RowItem =
  | { kind: "occ"; cell: number }
  | { kind: "landmark"; cell: number; landmark: Landmark };

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
const FLAG_COLOR = "#e9a23b";
const STAR_FILL = "#f2b84b";
const STAR_EDGE = "#a5700f";

export function buildRows(game: Game): RowItem[][] {
  const rows: RowItem[][] = Array.from({ length: game.grid.height }, () => []);
  game.occupant.forEach((o, c) => {
    if (o && o.type !== "pit") rows[Math.floor(c / game.grid.width)].push({ kind: "occ", cell: c });
  });
  for (const l of game.landmarks) rows[Math.floor(l.cell / game.grid.width)].push({ kind: "landmark", cell: l.cell, landmark: l });
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
      if (item.kind !== "occ") continue;
      const c = item.cell;
      const a = vis[c];
      if (a < 0.01) continue;
      const o = game.occupant[c]!;
      const cx = ox + (c % g.width) * T + T / 2;
      const cy = oy + y * T + T / 2;
      ctx.globalAlpha = a;
      if (o.type === "start") drawStartPad(ctx, cx, cy, T);
      else if (o.type === "portal") drawPortal(ctx, cx, cy, T, game.portals[o.pair].symbol, sc.time);
      else if (o.type === "swirl") drawSwirl(ctx, cx, cy, T, game.swirls[o.index].axes === "xy", sc.time);
      else if (o.type === "exit") drawExitLight(ctx, cx, cy, T, pal, sc.time);
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
      if (item.kind === "landmark") drawLandmark(ctx, cx, cy, T, item.landmark, pal);
      else drawThing(ctx, sc, item.cell, cx, cy, T, wallH, thick);
    }
    if (y === playerRow && p.alpha > 0.01) drawPlayer(ctx, psx, psy, T, p, HERO[game.theme] ?? pal.accent, sc.time);
  }

  // ── Light: warm glow around the explorer, then fog closing in at the edges.
  ctx.globalAlpha = 1;
  const glowR = T * (1.7 + sc.lanternFx * 1.4);
  const glow = ctx.createRadialGradient(psx, psy, 0, psx, psy, glowR);
  glow.addColorStop(0, withAlpha(pal.glow, 0.26 + sc.lanternFx * 0.16));
  glow.addColorStop(1, withAlpha(pal.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(psx - glowR, psy - glowR, glowR * 2, glowR * 2);

  const sight = DIFFICULTIES[game.level].vision + sc.lanternFx * DIFFICULTIES[game.level].lanternBonus;
  const fogInner = T * (sight + 0.3);
  const fogOuter = T * (sight + 5);
  const haze = ctx.createRadialGradient(psx, psy, fogInner, psx, psy, fogOuter);
  haze.addColorStop(0, withAlpha(pal.fog, 0));
  haze.addColorStop(1, withAlpha(pal.fog, 0.55));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);
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

  // ── Names, on top of everything, only for what's in sight.
  drawLabels(ctx, sc, ox, oy, x0, x1, y0, y1);
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
      drawExitArch(ctx, cx, cy, T, sc.pal);
      break;
    case "checkpoint":
      drawFlag(ctx, cx, cy, T, s.checkpoint === c, sc.time);
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

function drawExitArch(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, pal: Palette) {
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

function drawFlag(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, active: boolean, time: number) {
  const px = cx - T * 0.12;
  const top = cy - T * 0.62;
  shadow(ctx, cx, cy, T * 0.14);
  ctx.strokeStyle = "#4a3b2c";
  ctx.lineWidth = Math.max(1.5, T * 0.045);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px, cy + T * 0.08);
  ctx.lineTo(px, top);
  ctx.stroke();
  const wave = active ? Math.sin(time / 180) * T * 0.04 : 0;
  ctx.fillStyle = active ? START_COLOR : FLAG_COLOR;
  ctx.beginPath();
  ctx.moveTo(px, top);
  ctx.quadraticCurveTo(px + T * 0.2, top + T * 0.04 + wave, px + T * 0.38, top + T * 0.14);
  ctx.lineTo(px, top + T * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, T * 0.02);
  ctx.stroke();
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

/** Small silhouettes per landmark family; the name label does the real work. */
const LANDMARK_FAMILY: Record<string, "plant" | "mushroom" | "stone" | "water" | "crystal" | "object"> = {
  tree: "plant", bush: "plant", pine: "plant", palm: "plant", cactus: "plant",
  mushroom: "mushroom",
  rock: "stone", stalagmite: "stone", block: "stone", column: "stone", statue: "stone", igloo: "stone", snowman: "stone",
  pond: "water", puddle: "water",
  crystal: "crystal",
};

function drawLandmark(ctx: CanvasRenderingContext2D, cx: number, cy: number, T: number, l: Landmark, pal: Palette) {
  // Tucked into the cell's upper-left corner so the explorer walks past it.
  const x = cx - T * 0.22;
  const y = cy - T * 0.12;
  const fam = LANDMARK_FAMILY[l.kind] ?? "object";
  const dark = pal.wallFace;
  const light = pal.wallTop;
  switch (fam) {
    case "plant":
      shadow(ctx, x, y, T * 0.16);
      ctx.fillStyle = shade(dark, -0.2);
      ctx.fillRect(x - T * 0.03, y - T * 0.22, T * 0.06, T * 0.24);
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(x, y - T * 0.32, T * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(x + T * 0.05, y - T * 0.28, T * 0.11, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "mushroom":
      shadow(ctx, x, y, T * 0.14);
      ctx.fillStyle = "#f3ead8";
      ctx.fillRect(x - T * 0.04, y - T * 0.2, T * 0.08, T * 0.2);
      ctx.fillStyle = "#d1495b";
      ctx.beginPath();
      ctx.ellipse(x, y - T * 0.2, T * 0.17, T * 0.11, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - T * 0.06, y - T * 0.25, T * 0.025, 0, Math.PI * 2);
      ctx.arc(x + T * 0.06, y - T * 0.24, T * 0.02, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "stone":
      shadow(ctx, x, y, T * 0.17);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(x, y - T * 0.08, T * 0.17, T * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(x - T * 0.03, y - T * 0.12, T * 0.12, T * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "water":
      ctx.fillStyle = "#6fa8c9";
      ctx.beginPath();
      ctx.ellipse(x + T * 0.04, y + T * 0.02, T * 0.2, T * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(1, T * 0.02);
      ctx.beginPath();
      ctx.ellipse(x, y, T * 0.08, T * 0.04, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "crystal":
      shadow(ctx, x, y, T * 0.14);
      ctx.fillStyle = l.label.includes("rosa") ? "#e58fc0" : l.label.includes("verde") ? "#7fd18e" : "#7fb8e8";
      ctx.beginPath();
      ctx.moveTo(x - T * 0.1, y);
      ctx.lineTo(x - T * 0.05, y - T * 0.32);
      ctx.lineTo(x + T * 0.02, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x + T * 0.07, y - T * 0.24);
      ctx.lineTo(x + T * 0.12, y);
      ctx.fill();
      break;
    case "object":
      shadow(ctx, x, y, T * 0.15);
      ctx.fillStyle = dark;
      roundRect(ctx, x - T * 0.13, y - T * 0.2, T * 0.26, T * 0.2, T * 0.05);
      ctx.fill();
      ctx.fillStyle = light;
      roundRect(ctx, x - T * 0.13, y - T * 0.24, T * 0.26, T * 0.08, T * 0.04);
      ctx.fill();
      break;
  }
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

// ─────────────────────────────────────────────────────────────── labels

function drawLabels(ctx: CanvasRenderingContext2D, sc: Scene, ox: number, oy: number, x0: number, x1: number, y0: number, y1: number) {
  const { game, tile: T } = sc;
  const g = game.grid;
  const size = Math.round(Math.max(11, Math.min(14, T * 0.22)));
  const placed: Box[] = [];
  for (let y = y0; y <= y1; y++) {
    for (const item of sc.rows[y]) {
      const c = item.cell;
      const x = c % g.width;
      if (x < x0 || x > x1 || !sc.inSight[c]) continue;
      const a = Math.min(1, (sc.vis[c] - 0.35) * 2.5);
      if (a <= 0) continue;
      let text: string | null = null;
      let italic = false;
      if (item.kind === "landmark") {
        text = item.landmark.label;
        italic = true;
      } else {
        const o = game.occupant[c]!;
        if (o.type === "key" && !(sc.state.keys & (1 << o.color))) text = keyName(o.color);
        else if (o.type === "door") text = doorName(o.color);
        else if (o.type === "portal") text = portalName(game.portals[o.pair].symbol);
        else if (o.type === "exit") text = "salida";
      }
      if (!text) continue;
      const cx = ox + x * T + (item.kind === "landmark" ? T * 0.28 : T / 2);
      const cy = oy + y * T + (item.kind === "landmark" ? -T * 0.1 : -T * 0.12);
      pill(ctx, text, cx, cy, size, italic ? sc.fonts.display : sc.fonts.ui, italic, a, placed);
    }
  }
}

interface Box { x: number; y: number; w: number; h: number }

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, size: number, font: string, italic: boolean, a: number, placed: Box[]) {
  ctx.font = `${italic ? "italic " : ""}${italic ? 500 : 600} ${size}px ${font}`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  // Nudge up until it doesn't cover a label already drawn this frame.
  let cy = y;
  for (let tries = 0; tries < 4; tries++) {
    const hit = placed.find((b) => Math.abs(b.x - cx) * 2 < b.w + w && Math.abs(b.y - cy) * 2 < b.h + h);
    if (!hit) break;
    cy = hit.y - (hit.h + h) / 2 - 2;
  }
  placed.push({ x: cx, y: cy, w, h });
  ctx.globalAlpha = a * 0.88;
  ctx.fillStyle = "rgba(28,24,32,0.82)";
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#fffaf0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + size * 0.05);
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
