import type { Dictionary } from "@/i18n/dictionaries";
import type { SaveId } from "./saves";

/** Each slot's word and ribbon: its section's chapter card, the hero's own and STATS's longer ribbon. */
export type SlotWords = Record<SaveId, { word: string; ribbon: string }>;

/**
 * The words of every slot, from the dictionary, on the server: the
 * chapter cards' own, so a slot reads as its section's heading.
 */
export function slotWords(dict: Dictionary): SlotWords {
  return {
    hero: dict.load.opening,
    suspects: dict.suspects.chapter,
    work: dict.work.chapter,
    stats: { word: dict.stats.chapter.word, ribbon: dict.load.statsRibbon },
    projects: dict.projects.chapter,
    credits: dict.credits.chapter,
  };
}
