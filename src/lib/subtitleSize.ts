/**
 * The subtitle size she picks in STATS's settings (SETTINGS · DISPLAY):
 * small, medium or large, for the film's cards in the hero and in the
 * career city. Medium is the cards' own size and sets nothing; small and
 * large set `data-subtitles` and `--va-subtitle-scale` on <html>, which
 * globals.css multiplies into both stages' cards ([data-captions]
 * [data-card]). Remembered per visitor in localStorage; read back on
 * hydration by StatsSettings (restoreSubtitleSize, in its effect: the
 * settings panel is on every home page, open or not). A change fires
 * SUBTITLES_EVENT, so the hero fits its cards to their lines again
 * (cardFit.ts).
 */

export const SUBTITLE_SIZES = ["s", "m", "l"] as const;
export type SubtitleSize = (typeof SUBTITLE_SIZES)[number];

/** How much each size scales the cards' font. */
export const SUBTITLE_SCALE: Record<SubtitleSize, number> = { s: 0.85, m: 1, l: 1.2 };

export const SUBTITLE_KEY = "va-subtitles";
export const SUBTITLES_EVENT = "va:subtitles";

/** A stored value as a size: anything unknown is the default, medium. */
export function parseSubtitleSize(value: string | null | undefined): SubtitleSize {
  return SUBTITLE_SIZES.find((size) => size === value) ?? "m";
}

/** What <html> carries for a size: nothing for medium. */
export function subtitleAttributes(size: SubtitleSize): { attribute: string | null; scale: string | null } {
  return size === "m" ? { attribute: null, scale: null } : { attribute: size, scale: String(SUBTITLE_SCALE[size]) };
}

let current: SubtitleSize = "m";
const listeners = new Set<() => void>();

export function getSubtitleSize(): SubtitleSize {
  return current;
}

export function subscribeSubtitleSize(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function apply(size: SubtitleSize) {
  const root = document.documentElement;
  const { attribute, scale } = subtitleAttributes(size);
  if (attribute) root.setAttribute("data-subtitles", attribute);
  else root.removeAttribute("data-subtitles");
  if (scale) root.style.setProperty("--va-subtitle-scale", scale);
  else root.style.removeProperty("--va-subtitle-scale");
  window.dispatchEvent(new Event(SUBTITLES_EVENT));
}

/** Sets the size, remembers it and tells the stages. */
export function setSubtitleSize(size: SubtitleSize, { save = true } = {}) {
  if (save) {
    try {
      localStorage.setItem(SUBTITLE_KEY, size);
    } catch {
      // Blocked storage: the size lasts for this page.
    }
  }
  if (size === current && !save) return;
  current = size;
  apply(size);
  listeners.forEach((listener) => listener());
}

/** The remembered size, applied: on load. */
export function restoreSubtitleSize() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(SUBTITLE_KEY);
  } catch {
    // Blocked storage: medium.
  }
  const size = parseSubtitleSize(stored);
  if (size !== current) setSubtitleSize(size, { save: false });
}
