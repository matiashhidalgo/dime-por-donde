/**
 * Renders the share card and the iOS home-screen icon to public/ as real PNG
 * files (a static host serves them with the right type; Next's
 * opengraph-image route would export them without an extension).
 *
 *   npx vite-node scripts/render-brand.ts
 *
 * Re-run after changing the name in lib/site.ts.
 */
import { writeFileSync } from "node:fs";
import AppleIcon from "./brand/apple-icon";
import OgImage from "./brand/og-image";

for (const [file, render] of [
  ["public/og.png", OgImage],
  ["public/apple-touch-icon.png", AppleIcon],
] as const) {
  const res = render();
  writeFileSync(new URL(`../${file}`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}
