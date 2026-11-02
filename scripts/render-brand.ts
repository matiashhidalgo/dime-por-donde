/**
 * Renders the share card, the iOS home-screen icon and the manifest icons to public/ as real PNG
 * files (a static host serves them with the right type; Next's
 * opengraph-image route would export them without an extension).
 *
 *   npx vite-node scripts/render-brand.ts
 *
 * Re-run after changing the name in lib/site.ts.
 */
import { writeFileSync } from "node:fs";
import AppleIcon from "./brand/apple-icon";
import { appIcon } from "./brand/app-icon";
import OgImage from "./brand/og-image";

for (const [file, render] of [
  ["public/og.png", OgImage],
  ["public/apple-touch-icon.png", AppleIcon],
  // Web app manifest icons (app/manifest.ts).
  ["public/icon-192.png", () => appIcon(192, false)],
  ["public/icon-512.png", () => appIcon(512, false)],
  ["public/icon-maskable-512.png", () => appIcon(512, true)],
] as const) {
  const res = render();
  writeFileSync(new URL(`../${file}`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}
