import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/siteUrl";

/** Every page may be crawled; the sitemap lists both languages. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml", base),
  };
}
