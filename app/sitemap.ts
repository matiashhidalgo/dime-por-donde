import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Static export: generated once at build time.
export const dynamic = "force-static";


const SITE_URL = SITE.url;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
