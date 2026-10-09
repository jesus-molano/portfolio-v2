import type { Locale } from "@/i18n/config";
import sources from "../../tools/art/og/sources.json";

/**
 * The link preview card (Open Graph and Twitter) of each locale: a game
 * cover's grid of the site's own frames and his name and role, built by
 * `tools/art/og/keyart/build.mjs` into `public/og/<locale>.jpg`.
 */
export const SHARE_CARD = { width: 1200, height: 630, type: "image/jpeg" } as const;

/** Largest a card may weigh: messaging apps drop bigger previews. */
export const SHARE_CARD_MAX_BYTES = 300 * 1024;

export function shareCardPath(locale: Locale): string {
  return `/og/${locale}.jpg`;
}

/**
 * The card's address in the metadata: its file with the start of its own
 * SHA-256 (recorded by the build in tools/art/og/sources.json) as a version.
 * LinkedIn, X and the messengers keep a preview by its image's address for
 * days, so a rebuilt card under the same name kept showing the old one.
 */
export function shareCardUrl(locale: Locale): string {
  return `${shareCardPath(locale)}?v=${sources[locale].card.slice(0, 10)}`;
}
