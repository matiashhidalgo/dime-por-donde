import {
  type Game,
  type Shape,
  KEY_COLORS,
  PORTAL_SYMBOLS,
  THEMES,
  cellX,
  cellY,
  columnLabel,
  isOpen,
} from "@/src/engine";

/**
 * Debug map: everything the generator placed, flat and honest. Not the guide's
 * final cartographer map — just enough to eyeball layouts and fairness.
 */

const CELL = 28;
const PAD = 22;

export interface MazeSvgOptions {
  showRoute: boolean;
  showLandmarks: boolean;
  showCoords: boolean;
}

export function ShapeMark({ shape, cx, cy, r, fill, stroke }: {
  shape: Shape;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
}) {
  const common = { fill, stroke: stroke ?? "rgba(0,0,0,0.55)", strokeWidth: 1.2 };
  switch (shape) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r} {...common} />;
    case "square":
      return <rect x={cx - r * 0.85} y={cy - r * 0.85} width={r * 1.7} height={r * 1.7} rx={1.5} {...common} />;
    case "triangle":
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}`} {...common} />;
    case "diamond":
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} {...common} />;
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      });
      return <polygon points={pts.join(" ")} {...common} />;
    }
  }
}

function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (Math.PI / 5) * i;
    return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
  }).join(" ");
}

export function MazeSvg({ game, options }: { game: Game; options: MazeSvgOptions }) {
  const g = game.grid;
  const pal = THEMES[game.theme].palette;
  const W = g.width * CELL + PAD * 2;
  const H = g.height * CELL + PAD * 2;
  const px = (c: number) => PAD + cellX(g, c) * CELL;
  const py = (c: number) => PAD + cellY(g, c) * CELL;
  const cx = (c: number) => px(c) + CELL / 2;
  const cy = (c: number) => py(c) + CELL / 2;

  const walls: string[] = [];
  for (let c = 0; c < g.width * g.height; c++) {
    const x = px(c);
    const y = py(c);
    if (!isOpen(g, c, 0)) walls.push(`M${x},${y}h${CELL}`);
    if (!isOpen(g, c, 3)) walls.push(`M${x},${y}v${CELL}`);
    if (cellX(g, c) === g.width - 1 && !isOpen(g, c, 1)) walls.push(`M${x + CELL},${y}v${CELL}`);
    if (cellY(g, c) === g.height - 1 && !isOpen(g, c, 2)) walls.push(`M${x},${y + CELL}h${CELL}`);
  }

  const route = game.solution.route;
  const routePath = route
    .map((c, i) => {
      const teleported = i > 0 && game.occupant[route[i - 1]]?.type === "portal" && game.occupant[c]?.type === "portal";
      return `${i === 0 || teleported ? "M" : "L"}${cx(c)},${cy(c)}`;
    })
    .join("");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Mapa completo del laberinto">
      <rect width={W} height={H} fill={pal.paper} />

      {/* ice */}
      {Array.from(game.ice).map((v, c) =>
        v ? <rect key={`i${c}`} x={px(c)} y={py(c)} width={CELL} height={CELL} fill="#bfe3f5" /> : null,
      )}

      {/* light grid */}
      <g stroke={pal.ink} strokeOpacity={0.08} strokeWidth={0.5}>
        {Array.from({ length: g.width + 1 }, (_, i) => (
          <line key={`gx${i}`} x1={PAD + i * CELL} y1={PAD} x2={PAD + i * CELL} y2={PAD + g.height * CELL} />
        ))}
        {Array.from({ length: g.height + 1 }, (_, i) => (
          <line key={`gy${i}`} x1={PAD} y1={PAD + i * CELL} x2={PAD + g.width * CELL} y2={PAD + i * CELL} />
        ))}
      </g>

      {options.showCoords && (
        <g fontSize={9} fill={pal.ink} fillOpacity={0.6} textAnchor="middle" fontFamily="ui-monospace, monospace">
          {Array.from({ length: g.width }, (_, i) => (
            <text key={`cx${i}`} x={PAD + i * CELL + CELL / 2} y={PAD - 7}>{columnLabel(i)}</text>
          ))}
          {Array.from({ length: g.height }, (_, i) => (
            <text key={`cy${i}`} x={PAD - 10} y={PAD + i * CELL + CELL / 2 + 3}>{i + 1}</text>
          ))}
        </g>
      )}

      {options.showRoute && (
        <path d={routePath} fill="none" stroke={pal.accent} strokeWidth={3} strokeOpacity={0.55} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* portal links */}
      {game.portals.map((p, i) => (
        <line
          key={`pl${i}`}
          x1={cx(p.a)} y1={cy(p.a)} x2={cx(p.b)} y2={cy(p.b)}
          stroke={PORTAL_SYMBOLS[p.symbol].hex} strokeWidth={1.2} strokeDasharray="4 4" strokeOpacity={0.7}
        />
      ))}

      <path d={walls.join("")} stroke={pal.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />

      {/* landmarks */}
      {options.showLandmarks &&
        game.landmarks.map((l, i) => (
          <g key={`l${i}`}>
            <rect x={cx(l.cell) - 6} y={cy(l.cell) - 6} width={12} height={12} rx={3} fill="none" stroke={pal.ink} strokeOpacity={0.45} strokeDasharray="2 2" />
            <text x={cx(l.cell)} y={cy(l.cell) + 3} fontSize={8} textAnchor="middle" fill={pal.ink} fillOpacity={0.7}>{i + 1}</text>
          </g>
        ))}

      {/* occupants */}
      {game.occupant.map((o, c) => {
        if (!o) return null;
        const x = cx(c);
        const y = cy(c);
        switch (o.type) {
          case "start":
            return (
              <g key={c}>
                <circle cx={x} cy={y} r={9} fill="#3a9d5d" />
                <text x={x} y={y + 3.5} fontSize={10} fontWeight={700} textAnchor="middle" fill="#fff">E</text>
              </g>
            );
          case "exit":
            return (
              <g key={c}>
                <rect x={x - 9} y={y - 9} width={18} height={18} rx={4} fill={pal.ink} />
                <text x={x} y={y + 3.5} fontSize={10} fontWeight={700} textAnchor="middle" fill={pal.paper}>S</text>
              </g>
            );
          case "checkpoint":
            return (
              <g key={c} stroke={pal.ink} strokeWidth={1.4}>
                <line x1={x - 5} y1={y + 9} x2={x - 5} y2={y - 9} />
                <polygon points={`${x - 5},${y - 9} ${x + 8},${y - 5} ${x - 5},${y - 1}`} fill="#e9c46a" />
              </g>
            );
          case "pit":
            return <circle key={c} cx={x} cy={y} r={8} fill="#1f1b18" stroke="#000" strokeOpacity={0.4} />;
          case "door": {
            const k = KEY_COLORS[o.color];
            return (
              <g key={c}>
                <rect x={x - 11} y={y - 11} width={22} height={22} rx={3} fill={k.hex} fillOpacity={0.3} stroke={k.hex} strokeWidth={2} />
                <ShapeMark shape={k.shape} cx={x} cy={y} r={5} fill={k.hex} />
              </g>
            );
          }
          case "key": {
            const k = KEY_COLORS[o.color];
            return (
              <g key={c}>
                <line x1={x - 2} y1={y + 2} x2={x + 8} y2={y + 2} stroke={k.hex} strokeWidth={2.5} />
                <ShapeMark shape={k.shape} cx={x - 4} cy={y - 1} r={5.5} fill={k.hex} />
              </g>
            );
          }
          case "portal": {
            const s = PORTAL_SYMBOLS[game.portals[o.pair].symbol];
            return (
              <g key={c}>
                <circle cx={x} cy={y} r={11} fill={s.hex} fillOpacity={0.18} stroke={s.hex} strokeWidth={1.5} />
                <ShapeMark shape={s.shape} cx={x} cy={y} r={6} fill={s.hex} stroke="#fff" />
              </g>
            );
          }
          case "swirl": {
            const sw = game.swirls[o.index];
            return (
              <g key={c}>
                <path
                  d={`M${x},${y} m0,-1 a2,2 0 1,1 -2,2 a4,4 0 1,1 4,4 a6,6 0 1,1 -6,-6 a8,8 0 1,1 8,8`}
                  fill="none" stroke="#8e5bd6" strokeWidth={1.6}
                />
                {sw.axes === "xy" && <circle cx={x + 9} cy={y - 9} r={2.5} fill="#8e5bd6" />}
              </g>
            );
          }
          case "star":
            return <polygon key={c} points={starPoints(x, y, 9)} fill="#f2c14e" stroke="#b8860b" strokeWidth={1} />;
          case "lantern":
            return (
              <g key={c}>
                <circle cx={x} cy={y} r={10} fill="#ffd166" fillOpacity={0.25} />
                <rect x={x - 4} y={y - 6} width={8} height={11} rx={2} fill="#ffd166" stroke="#a87b00" strokeWidth={1} />
                <line x1={x} y1={y - 9} x2={x} y2={y - 6} stroke="#a87b00" strokeWidth={1.2} />
              </g>
            );
        }
      })}
    </svg>
  );
}
