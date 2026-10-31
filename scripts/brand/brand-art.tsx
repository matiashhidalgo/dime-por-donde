// eslint-disable-next-line @typescript-eslint/no-unused-vars -- classic JSX runtime under vite-node
import React from "react";
import { SITE } from "../../lib/site";

/**
 * Artwork for the share card and the home-screen icon, rendered at build time
 * by next/og (inline styles only: it runs through Satori, not the browser).
 */

const WALLS = [
  "M20 20h160v60", "M20 20v160h100", "M60 60v80h40", "M60 60h80v40", "M100 100h40v40h40", "M180 120v60h-40", "M140 180v-20",
];

export function MazeMark({ size, stroke = SITE.ink }: { size: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {WALLS.map((d) => (
        <path key={d} d={d} fill="none" stroke={stroke} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path d="M40 162V40h120v30" fill="none" stroke={SITE.accent} strokeWidth={5} strokeDasharray="2 12" strokeLinecap="round" />
      <circle cx="160" cy="84" r="13" fill={SITE.accent} />
      <circle cx="156" cy="81" r="2.6" fill="#fff" />
      <circle cx="165" cy="81" r="2.6" fill="#fff" />
      <path d="M160 160l5.9 12 13.2 1.6-9.8 9.2 2.6 13.2-11.9-6.4-11.8 6.4 2.6-13.2-9.8-9.2 13.2-1.6z" fill="#f2b84b" transform="translate(0 -14)" />
    </svg>
  );
}
