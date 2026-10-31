import { useMemo } from "react";
import { braid, carveMaze, cellAt, createRng, isOpen } from "@/src/engine";

/**
 * Hero illustration: a tiny maze drawn by the real engine, a dotted route and
 * a little explorer with a glow — fogged at the edges like the real game.
 */
export function DecorMaze({ className }: { className?: string }) {
  const W = 9;
  const H = 6;
  const C = 22;
  const { walls, route } = useMemo(() => {
    const rng = createRng("decor-hero");
    const g = carveMaze(W, H, "backtracker", rng.fork("m"));
    braid(g, 0.4, rng.fork("b"));
    const walls: string[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = cellAt(g, x, y);
        if (!isOpen(g, c, 0)) walls.push(`M${x * C},${y * C}h${C}`);
        if (!isOpen(g, c, 3)) walls.push(`M${x * C},${y * C}v${C}`);
        if (x === W - 1) walls.push(`M${(x + 1) * C},${y * C}v${C}`);
        if (y === H - 1) walls.push(`M${x * C},${(y + 1) * C}h${C}`);
      }
    }
    return { walls: walls.join(""), route: `M${C * 0.5},${C * 0.5}h${C * 2}v${C * 2}h${C * 2}` };
  }, []);
  const ex = C * 4.5;
  const ey = C * 2.5;
  return (
    <svg viewBox={`-6 -6 ${W * C + 12} ${H * C + 12}`} className={className} aria-hidden>
      <defs>
        <radialGradient id="hero-fog" cx={ex / (W * C)} cy={ey / (H * C)} r="0.55">
          <stop offset="0.35" stopColor="var(--card)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--card)" stopOpacity="0.92" />
        </radialGradient>
        <radialGradient id="hero-glow">
          <stop offset="0" stopColor="#ffe3a6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe3a6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={walls} stroke="currentColor" strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d={route} stroke="var(--accent)" strokeWidth={2.4} strokeDasharray="0.1 6" strokeLinecap="round" fill="none" />
      <rect x={-6} y={-6} width={W * C + 12} height={H * C + 12} fill="url(#hero-fog)" />
      <circle cx={ex} cy={ey} r={18} fill="url(#hero-glow)" />
      <ellipse cx={ex} cy={ey + 6} rx={5.5} ry={2} fill="#000" opacity={0.18} />
      <circle cx={ex} cy={ey} r={6} fill="var(--accent)" />
      <circle cx={ex - 2} cy={ey - 1} r={1} fill="#fff" />
      <circle cx={ex + 2} cy={ey - 1} r={1} fill="#fff" />
      <g transform={`translate(${C * 7.5},${C * 4.5})`}>
        <path d="M0,-7 L2,-2 7,-2 3,1.5 4.5,7 0,4 -4.5,7 -3,1.5 -7,-2 -2,-2Z" fill="#f2b84b" opacity={0.85} />
      </g>
    </svg>
  );
}
