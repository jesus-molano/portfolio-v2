import type { Locale } from "@/i18n/config";

/**
 * The link preview card (Open Graph and Twitter) of each locale: the
 * cinema's night plate with his name and role on the marquee, built by
 * `tools/art/og/build.py` into `public/og/<locale>.jpg`.
 */
export const SHARE_CARD = { width: 1200, height: 630, type: "image/jpeg" } as const;

/** Largest a card may weigh: messaging apps drop bigger previews. */
export const SHARE_CARD_MAX_BYTES = 300 * 1024;

export function shareCardPath(locale: Locale): string {
  return `/og/${locale}.jpg`;
}
