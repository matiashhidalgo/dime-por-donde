import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Static export: the manifest is rendered once at build time (/manifest.webmanifest).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    lang: "es",
    start_url: "/",
    scope: "/",
    // Full screen where the browser allows it; otherwise the standalone window.
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: SITE.paper,
    theme_color: SITE.paper,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
