import { memo } from "react";
import {
  type Game,
  type Shape,
  KEY_COLORS,
  PORTAL_SYMBOLS,
  THEMES,
  cellX,
  cellY,
  isOpen,
  stationEmblems,
} from "@/src/engine";
import { landmarkShapes } from "../landmark-shapes";

/**
 * The guide's map, cartographer style: paper, fine ink, symbols. Pure SVG in
 * world units (CELL per cell). Memoized: pan/zoom never re-renders it.
 */

export const CELL = 40;
export const SWIRL_COLOR = "#7e4fc9";
export const SHADOW_COLOR = "#46347f";
export const MARK_COLOR = "#d9634c";
export const PIN_COLOR = "#1f7f76";

export function ShapeGlyph({ shape, cx, cy, r, fill, stroke = "#2b2520", sw = 1.4 }: {
  shape: Shape;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  sw?: number;
}) {
  const p = { fill, stroke, strokeWidth: sw, strokeLinejoin: "round" as const };
  switch (shape) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r * 0.9} {...p} />;
    case "square":
      return <rect x={cx - r * 0.8} y={cy - r * 0.8} width={r * 1.6} height={r * 1.6} rx={r * 0.15} {...p} />;
    case "triangle":
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy + r * 0.75} ${cx - r},${cy + r * 0.75}`} {...p} />;
    case "diamond":
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} {...p} />;
    case "hexagon":
      return (
        <polygon
          points={Array.from({ length: 6 }, (_, i) => `${cx + r * Math.cos((Math.PI / 3) * i)},${cy + r * Math.sin((Math.PI / 3) * i)}`).join(" ")}
          {...p}
        />
      );
  }
}

export function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (Math.PI / 5) * i;
    return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

export function spiralPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI * 4.2;
    const rad = r * t;
    pts.push(`${i === 0 ? "M" : "L"}${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join("");
}

/** Small reusable glyphs (also used by the legend at icon size). */
export const Glyph = {
  pit: (cx: number, cy: number, r: number, ink: string) => (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.08} fill="none" stroke={ink} strokeOpacity={0.35} strokeWidth={r * 0.12} strokeDasharray={`${r * 0.22} ${r * 0.16}`} />
      <circle cx={cx} cy={cy} r={r * 0.86} fill={ink} fillOpacity={0.9} />
      <ellipse cx={cx} cy={cy + r * 0.18} rx={r * 0.52} ry={r * 0.4} fill="#000" fillOpacity={0.45} />
    </g>
  ),
  star: (cx: number, cy: number, r: number) => (
    <polygon points={starPoints(cx, cy, r)} fill="#f2b84b" stroke="#a5700f" strokeWidth={r * 0.1} strokeLinejoin="round" />
  ),
  lantern: (cx: number, cy: number, r: number) => (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.15} fill="#ffd166" fillOpacity={0.3} />
      <path d={`M${cx},${cy - r}v${r * 0.3}`} stroke="#6b4a00" strokeWidth={r * 0.14} strokeLinecap="round" />
      <rect x={cx - r * 0.45} y={cy - r * 0.7} width={r * 0.9} height={r * 1.35} rx={r * 0.2} fill="#ffd166" stroke="#6b4a00" strokeWidth={r * 0.12} />
      <path d={`M${cx - r * 0.55},${cy + r * 0.7}h${r * 1.1}`} stroke="#6b4a00" strokeWidth={r * 0.14} strokeLinecap="round" />
    </g>
  ),
  /** A route candle (refills the explorer's light once). */
  candle: (cx: number, cy: number, r: number, ink: string) => (
    <g>
      <circle cx={cx} cy={cy - r * 0.55} r={r * 0.75} fill="#ffb43d" fillOpacity={0.22} />
      <rect x={cx - r * 0.28} y={cy - r * 0.2} width={r * 0.56} height={r * 1.1} rx={r * 0.12} fill="#f6ead2" stroke={ink} strokeWidth={r * 0.1} />
      <path d={`M${cx},${cy - r * 0.3}C${cx - r * 0.35},${cy - r * 0.6} ${cx - r * 0.15},${cy - r * 0.95} ${cx},${cy - r * 1.15}C${cx + r * 0.15},${cy - r * 0.95} ${cx + r * 0.35},${cy - r * 0.6} ${cx},${cy - r * 0.3}Z`} fill="#ffb43d" stroke={ink} strokeWidth={r * 0.07} />
    </g>
  ),
  swirl: (cx: number, cy: number, r: number, both: boolean) => (
    <g>
      <path d={spiralPath(cx, cy, r)} fill="none" stroke={SWIRL_COLOR} strokeWidth={r * 0.16} strokeLinecap="round" />
      {both && <circle cx={cx} cy={cy} r={r * 1.18} fill="none" stroke={SWIRL_COLOR} strokeWidth={r * 0.12} strokeDasharray={`${r * 0.25} ${r * 0.2}`} />}
    </g>
  ),
  key: (cx: number, cy: number, r: number, color: number) => {
    const k = KEY_COLORS[color];
    return (
      <g>
        <path
          d={`M${cx - r * 0.1},${cy}H${cx + r}M${cx + r * 0.65},${cy}v${r * 0.35}M${cx + r * 0.35},${cy}v${r * 0.28}`}
          stroke="#2b2520" strokeWidth={r * 0.32} strokeLinecap="round"
        />
        <path
          d={`M${cx - r * 0.1},${cy}H${cx + r}M${cx + r * 0.65},${cy}v${r * 0.35}M${cx + r * 0.35},${cy}v${r * 0.28}`}
          stroke={k.hex} strokeWidth={r * 0.16} strokeLinecap="round"
        />
        <ShapeGlyph shape={k.shape} cx={cx - r * 0.45} cy={cy} r={r * 0.55} fill={k.hex} sw={r * 0.1} />
      </g>
    );
  },
  portal: (cx: number, cy: number, r: number, symbol: number) => {
    const s = PORTAL_SYMBOLS[symbol];
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={s.hex} fillOpacity={0.16} stroke={s.hex} strokeWidth={r * 0.1} />
        <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={s.hex} strokeWidth={r * 0.06} strokeDasharray={`${r * 0.18} ${r * 0.14}`} />
        <ShapeGlyph shape={s.shape} cx={cx} cy={cy} r={r * 0.48} fill={s.hex} stroke="#fff" sw={r * 0.08} />
      </g>
    );
  },
  /** A station: this game's emblem in a medallion (same path on both screens). */
  station: (cx: number, cy: number, r: number, d: string, ink: string, paper: string) => (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.15} fill="#f2b84b" fillOpacity={0.25} />
      <circle cx={cx} cy={cy} r={r} fill={paper} stroke={ink} strokeWidth={r * 0.12} strokeDasharray={`${r * 0.3} ${r * 0.16}`} />
      <g transform={`translate(${cx} ${cy}) scale(${r * 0.7})`}>
        <path d={d} fill={ink} />
      </g>
    </g>
  ),
  /** This game's generated silhouette (same path the explorer's canvas draws). */
  landmark: (cx: number, cy: number, r: number, d: string, ink: string, paper: string) => (
    <g transform={`translate(${cx} ${cy}) scale(${r})`}>
      <path d={d} fill={ink} fillOpacity={0.82} stroke={paper} strokeWidth={0.08} strokeLinejoin="round" />
    </g>
  ),
};

/**
 * La Sombra's ROUND, never its position: a stroke along the corridors with
 * arrowheads (one way for a loop, both ways for a there-and-back) and a dot
 * every 4 cells to count with. Where it is right now, the pair works out by
 * talking. No name on the map.
 */
export function ShadowRoute({ game, cell = CELL, paper }: { game: Game; cell?: number; paper: string }) {
  const sh = game.shadow;
  if (!sh) return null;
  const g = game.grid;
  const pts = sh.route.map((c) => [cellX(g, c) * cell + cell / 2, cellY(g, c) * cell + cell / 2] as const);
  const closed = sh.shape === "loop";
  const d = `M${pts.map((p) => p.join(",")).join("L")}${closed ? "Z" : ""}`;
  const arrow = (x: number, y: number, dx: number, dy: number, key: string) => {
    const s = cell * 0.17;
    const px = -dy;
    const py = dx;
    return (
      <polygon
        key={key}
        points={`${x + dx * s},${y + dy * s} ${x - dx * s * 0.6 + px * s * 0.9},${y - dy * s * 0.6 + py * s * 0.9} ${x - dx * s * 0.6 - px * s * 0.9},${y - dy * s * 0.6 - py * s * 0.9}`}
        fill={SHADOW_COLOR}
        stroke={paper}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    );
  };
  const n = pts.length;
  const marks: React.ReactNode[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dx = (b[0] - a[0]) / len;
    const dy = (b[1] - a[1]) / len;
    if (i % 4 === 2 || (segs < 4 && i === 0)) {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      if (closed) marks.push(arrow(mx, my, dx, dy, `a${i}`));
      else {
        const o = cell * 0.13;
        marks.push(arrow(mx - dy * o, my + dx * o, dx, dy, `f${i}`), arrow(mx + dy * o, my - dx * o, -dx, -dy, `b${i}`));
      }
    }
  }
  return (
    <g aria-hidden>
      <path d={d} fill="none" stroke={paper} strokeWidth={cell * 0.22} strokeOpacity={0.75} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={SHADOW_COLOR} strokeWidth={cell * 0.08} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
      {marks}
      {pts.map((p, i) =>
        i % 4 === 0 ? <circle key={`d${i}`} cx={p[0]} cy={p[1]} r={i === 0 ? cell * 0.13 : cell * 0.09} fill={SHADOW_COLOR} stroke={paper} strokeWidth={1.2} /> : null,
      )}
    </g>
  );
}

function MapArtInner({ game }: { game: Game }) {
  const g = game.grid;
  const pal = THEMES[game.theme].palette;
  const ink = pal.ink;
  const W = g.width * CELL;
  const H = g.height * CELL;
  const cx = (c: number) => cellX(g, c) * CELL + CELL / 2;
  const cy = (c: number) => cellY(g, c) * CELL + CELL / 2;
  const R = CELL * 0.3;

  const walls: string[] = [];
  for (let c = 0; c < g.width * g.height; c++) {
    const x = cellX(g, c) * CELL;
    const y = cellY(g, c) * CELL;
    if (!isOpen(g, c, 0) && y > 0) walls.push(`M${x},${y}h${CELL}`);
    if (!isOpen(g, c, 3) && x > 0) walls.push(`M${x},${y}v${CELL}`);
  }

  const occ = game.occupant;
  return (
    <g>
      <defs>
        <pattern id="ice-hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill="#d5ebf6" />
          <line x1={0} y1={0} x2={0} y2={8} stroke="#9ccbe4" strokeWidth={2.2} />
        </pattern>
        <filter id="paper-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx={0} dy={4} stdDeviation={8} floodColor="#3b2a1a" floodOpacity={0.25} />
        </filter>
      </defs>

      {/* Paper sheet */}
      <rect x={-CELL * 0.35} y={-CELL * 0.35} width={W + CELL * 0.7} height={H + CELL * 0.7} rx={6} fill={pal.paper} filter="url(#paper-shadow)" />

      {/* Fine grid so coordinates can be counted */}
      <path
        d={[
          ...Array.from({ length: g.width - 1 }, (_, i) => `M${(i + 1) * CELL},0V${H}`),
          ...Array.from({ length: g.height - 1 }, (_, i) => `M0,${(i + 1) * CELL}H${W}`),
        ].join("")}
        stroke={ink}
        strokeOpacity={0.09}
        strokeWidth={1}
      />

      {/* Ice */}
      {game.ponds.map((p, i) => (
        <rect key={i} x={p.x * CELL} y={p.y * CELL} width={p.w * CELL} height={p.h * CELL} fill="url(#ice-hatch)" />
      ))}

      {/* Portal links (under the walls, like a route drawn on the map) */}
      {game.portals.map((p, i) => {
        const s = PORTAL_SYMBOLS[p.symbol];
        const x1 = cx(p.a), y1 = cy(p.a), x2 = cx(p.b), y2 = cy(p.b);
        const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18;
        const my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
        return (
          <path key={i} d={`M${x1},${y1}Q${mx},${my} ${x2},${y2}`} fill="none" stroke={s.hex} strokeWidth={2.4} strokeOpacity={0.6} strokeDasharray="7 6" strokeLinecap="round" />
        );
      })}

      {/* Walls */}
      <path d={walls.join("")} stroke={ink} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      <rect x={0} y={0} width={W} height={H} fill="none" stroke={ink} strokeWidth={5} rx={2} />

      {/* La Sombra's round (v2): the route only, never where it is */}
      <ShadowRoute game={game} paper={pal.paper} />

      {/* Landmarks */}
      {landmarkShapes(game).map((shape, i) => (
        <g key={`lm${i}`}>{Glyph.landmark(cx(game.landmarks[i].cell), cy(game.landmarks[i].cell), CELL * 0.4, shape.d, ink, pal.paper)}</g>
      ))}

      {/* Stations (v2) */}
      {game.stations &&
        stationEmblems(game).map((e, i) => (
          <g key={`st${i}`}>{Glyph.station(cx(game.stations![i].cell), cy(game.stations![i].cell), CELL * 0.42, e.d, ink, pal.paper)}</g>
        ))}

      {/* Things */}
      {occ.map((o, c) => {
        if (!o) return null;
        const x = cx(c);
        const y = cy(c);
        switch (o.type) {
          case "start":
            return (
              <g key={c}>
                <circle cx={x} cy={y} r={R * 1.2} fill="#3d9a5f" stroke={ink} strokeWidth={1.5} />
                <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">E</text>
              </g>
            );
          case "exit":
            return (
              <g key={c}>
                <path d={`M${x - R * 1.1},${y + R * 1.2}V${y - R * 0.3}A${R * 1.1},${R * 1.1} 0 0 1 ${x + R * 1.1},${y - R * 0.3}V${y + R * 1.2}Z`} fill={ink} />
                <text x={x} y={y + 7} textAnchor="middle" fontSize={14} fontWeight={700} fill={pal.paper}>S</text>
                {/* v2: three sockets over the door, one per seal */}
                {game.stations?.map((_, i) => (
                  <circle key={i} cx={x + (i - 1) * R * 0.75} cy={y - R * 1.15} r={R * 0.28} fill={pal.paper} stroke={ink} strokeWidth={1.2} />
                ))}
              </g>
            );
          case "checkpoint":
            return <g key={c}>{Glyph.candle(x, y + R * 0.3, R * 1.1, ink)}</g>;
          case "pit":
            return <g key={c}>{Glyph.pit(x, y, R, ink)}</g>;
          case "door": {
            const k = KEY_COLORS[o.color];
            const vertical = isOpen(g, c, 0) || isOpen(g, c, 2); // corridor runs up-down → bar lies across
            return (
              <g key={c}>
                {vertical ? (
                  <rect x={x - CELL / 2 + 2} y={y - 6} width={CELL - 4} height={12} rx={2} fill={k.hex} stroke={ink} strokeWidth={1.6} />
                ) : (
                  <rect x={x - 6} y={y - CELL / 2 + 2} width={12} height={CELL - 4} rx={2} fill={k.hex} stroke={ink} strokeWidth={1.6} />
                )}
                <circle cx={x} cy={y} r={R * 0.75} fill={pal.paper} stroke={ink} strokeWidth={1.2} />
                <ShapeGlyph shape={k.shape} cx={x} cy={y} r={R * 0.5} fill={k.hex} sw={1.1} />
              </g>
            );
          }
          case "key":
            return <g key={c}>{Glyph.key(x, y, R * 1.05, o.color)}</g>;
          case "portal":
            return <g key={c}>{Glyph.portal(x, y, R * 1.2, game.portals[o.pair].symbol)}</g>;
          case "swirl":
            return <g key={c}>{Glyph.swirl(x, y, R * 0.95, game.swirls[o.index].axes === "xy")}</g>;
          case "star":
            return <g key={c}>{Glyph.star(x, y, R * 1.1)}</g>;
          case "lantern":
            return <g key={c}>{Glyph.lantern(x, y, R * 0.95)}</g>;
        }
      })}

    </g>
  );
}

export const MapArt = memo(MapArtInner);
