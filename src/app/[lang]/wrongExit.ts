import type { Locale } from "@/i18n/config";

/**
 * Where the 404 offers to go besides the top of the home page: a section
 * each, in the page's order (anchors.test.ts checks that each id is on
 * the home page). A full load, so the start menu comes first and then
 * PageEntry lands on the section, as any deep link does.
 */
export const WRONG_EXIT_PLACES = ["work", "stats", "projects", "contact"] as const;

export type WrongExitPlace = (typeof WRONG_EXIT_PLACES)[number];

export function placeHref(locale: Locale, place: WrongExitPlace): string {
  return `/${locale}#${place}`;
}
