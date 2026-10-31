import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Static export: generated once at build time.
export const dynamic = "force-static";


const SITE_URL = SITE.url;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/debug/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
