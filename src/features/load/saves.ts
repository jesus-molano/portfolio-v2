/**
 * LOAD GAME / CARGAR PARTIDA: the page's parts as a game's save slots, pure
 * and tested (saves.test.ts); LoadMenu.tsx draws them. One slot per part,
 * in the page's order, each a link to the part's anchor: a visitor in a
 * hurry (a recruiter) loads the player profile or the contact in one go,
 * from the start menu or from the page controls.
 *
 * `complete` is how far into the story that save stands, as a game's save
 * files say it (the career city is most of the page): the same for every
 * visitor, never what she has seen.
 */

export const SAVE_IDS = ["hero", "suspects", "work", "stats", "projects", "credits"] as const;
export type SaveId = (typeof SAVE_IDS)[number];

/** What a slot's tag says: the quickest way to the profile, the way to the contact. */
export type SaveTag = "quickest" | "contact";

export type Save = {
  id: SaveId;
  /** The element the slot lands on (`#target`); the hero's is the top of the page. */
  target: string;
  /** The part's own section, whose top says she is in it (currentSave). */
  section: string;
  /** Per cent of the story behind this save. */
  complete: number;
  tag: SaveTag | null;
};

export const SAVES: readonly Save[] = [
  { id: "hero", target: "main", section: "main", complete: 0, tag: null },
  { id: "suspects", target: "suspects", section: "suspects", complete: 15, tag: null },
  { id: "work", target: "work", section: "work", complete: 30, tag: null },
  { id: "stats", target: "stats", section: "stats", complete: 70, tag: "quickest" },
  { id: "projects", target: "projects", section: "projects", complete: 85, tag: null },
  // The credits' slot lands on the contact itself: the thanks and the GitHub and LinkedIn tickets.
  { id: "credits", target: "contact", section: "credits", complete: 95, tag: "contact" },
];

/** The slot the start menu puts the focus on: the player profile, the quickest look at him. */
export const QUICKEST: SaveId = "stats";

/** A slot's link: its target's fragment. */
export function saveHref(save: Save): string {
  return `#${save.target}`;
}

export type SlotKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

/**
 * Where the arrows take the focus in the grid of slots, `columns` wide
 * (two on a wide screen, one on a phone): left and right step through the
 * page's order, up and down a row; nothing past either end (a game's
 * load screen stops there). Home and End go to the first and the last.
 */
export function slotMove(index: number, key: SlotKey, columns: number, count: number = SAVES.length): number {
  const cols = Math.max(1, Math.round(columns));
  const last = count - 1;
  const clamp = (n: number) => Math.min(last, Math.max(0, n));
  switch (key) {
    case "Home":
      return 0;
    case "End":
      return last;
    case "ArrowLeft":
      return clamp(index - 1);
    case "ArrowRight":
      return clamp(index + 1);
    case "ArrowUp":
      return index - cols >= 0 ? index - cols : index;
    case "ArrowDown":
      return index + cols <= last ? index + cols : index;
  }
}

/** The arrows and Home and End, as slot moves; anything else, or with a modifier, is no move. */
export function slotKey(event: { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean }): SlotKey | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  return (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"] as const).find((k) => k === event.key) ?? null;
}

/**
 * The save she is in on the page: the last part whose top has come up past
 * the middle of the screen (`tops` in page order, document y), so the menu
 * opens on the slot that says "you are here". Above the first part, the
 * hero's.
 */
export function currentSave(tops: readonly number[], scrollY: number, viewport: number): number {
  const line = scrollY + viewport / 2;
  let at = 0;
  tops.forEach((top, i) => {
    if (Number.isFinite(top) && top <= line) at = i;
  });
  return at;
}

/**
 * Each slot's picture (tools/art/load/thumbs.py), a 16:9 still at these
 * widths: a wide screen's slot shows it 132 px wide, a phone's 96 (80
 * under 380 px).
 */
export const THUMB_WIDTHS = [160, 320] as const;
export const THUMB_SIZES = "(min-width: 760px) and (min-height: 521px) 132px, (max-width: 379.98px) 80px, 96px";

/** The slots whose picture carries words (the army's board, the cinema's marquee, the box office), one per locale. */
const LETTERED: readonly SaveId[] = ["work", "projects", "credits"];

/** A slot's picture in one format, as a srcset. */
export function thumbSrcSet(id: SaveId, locale: string, format: "avif" | "webp"): string {
  const stem = `/load/${id}${LETTERED.includes(id) ? `-${locale}` : ""}`;
  return THUMB_WIDTHS.map((width) => `${stem}-${width}.${format} ${width}w`).join(", ");
}

/** "70 % completado", "70% complete": the dictionary's pattern with the number in it. */
export function completeLabel(pattern: string, complete: number): string {
  return pattern.replace("{n}", String(complete));
}
