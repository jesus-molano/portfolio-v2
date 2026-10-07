import type { MetadataRoute } from "next";
import { palette } from "@/design/tokens";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { MANIFEST_ICONS } from "@/lib/siteIcons";

/**
 * The web manifest: his name and the home-screen icons. A page in the
 * browser, not an app (`display: "browser"`), so no install prompt; the
 * start URL is the root, whose proxy picks her language.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const dict = await getDictionary(defaultLocale);
  return {
    name: dict.hero.name,
    short_name: dict.hero.name,
    start_url: "/",
    display: "browser",
    background_color: palette.night,
    theme_color: palette.night,
    icons: MANIFEST_ICONS,
  };
}
