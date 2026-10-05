import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/i18n/config";
import { absoluteUrl, siteUrl } from "@/lib/siteUrl";

/** The one page, once per language, each naming the other as its alternate. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = {
    ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(`/${locale}`, base)])),
    "x-default": absoluteUrl(`/${defaultLocale}`, base),
  };
  return locales.map((locale) => ({
    url: absoluteUrl(`/${locale}`, base),
    changeFrequency: "monthly",
    priority: locale === defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
