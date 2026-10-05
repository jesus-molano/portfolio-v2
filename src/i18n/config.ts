export const locales = ["en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Each language named in itself, for the language switch. */
export const localeNames: Record<Locale, string> = { en: "English", es: "Español" };

/** Each language as Open Graph names it (language_TERRITORY), for the link preview cards. */
export const openGraphLocales: Record<Locale, string> = { en: "en_GB", es: "es_ES" };

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Picks the best supported locale from an `Accept-Language` header.
 * Falls back to the default locale.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.toLowerCase(), quality, index };
    })
    .filter((item) => item.tag && !Number.isNaN(item.quality) && item.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (hasLocale(base)) return base;
  }
  return defaultLocale;
}
