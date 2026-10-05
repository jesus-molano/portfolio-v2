/**
 * The pause menu's tabs, MAP and STATS, switched in place like a game's:
 * which fragment opens which tab, and what a key does. Pure, so the tests
 * hold it; StatsTabs.tsx does the DOM.
 */

export const STATS_TABS = ["map", "sheet"] as const;
export type StatsTab = (typeof STATS_TABS)[number];

/** The section's id: a link to it (#stats) opens the first tab, MAP. */
export const STATS_ID = "stats";

/** Each tab's panel; STATS's is also the fragment that opens it (#stats-sheet). */
export const PANEL_IDS: Record<StatsTab, string> = { map: "stats-map", sheet: "stats-sheet" };

/** Each tab's own id, which names its panel. */
export const TAB_IDS: Record<StatsTab, string> = { map: "stats-map-tab", sheet: "stats-sheet-tab" };

/** The fragment that shares a tab: the section's for MAP (#stats), the panel's for STATS (#stats-sheet). */
export function hashForTab(tab: StatsTab): string {
  return tab === STATS_TABS[0] ? `#${STATS_ID}` : `#${PANEL_IDS[tab]}`;
}

/** The tab an element id opens: the section or a panel; any other id opens none. */
export function tabForId(id: string | null): StatsTab | null {
  if (id === STATS_ID) return STATS_TABS[0];
  return STATS_TABS.find((tab) => PANEL_IDS[tab] === id) ?? null;
}

/** The tab `step` places from `tab`, wrapping round at both ends. */
export function stepTab(tab: StatsTab, step: number): StatsTab {
  const count = STATS_TABS.length;
  const index = STATS_TABS.indexOf(tab);
  return STATS_TABS[(((index + step) % count) + count) % count];
}

/**
 * A key on the focused tab (the WAI-ARIA tabs pattern, the selection
 * following the focus): the arrows step and wrap, Home and End go to the
 * ends, Space and Enter keep the tab (and stop Space scrolling the page).
 * Null: the key is not the tab bar's.
 */
export function tabListKey(key: string, tab: StatsTab): StatsTab | null {
  switch (key) {
    case "ArrowRight":
      return stepTab(tab, 1);
    case "ArrowLeft":
      return stepTab(tab, -1);
    case "Home":
      return STATS_TABS[0];
    case "End":
      return STATS_TABS[STATS_TABS.length - 1];
    case " ":
    case "Enter":
      return tab;
    default:
      return null;
  }
}

export type ShoulderKey = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean };

/**
 * The shoulder buttons: [ steps to the tab on the left, ] to the one on the
 * right, wrapping like the arrows. Q is the radio's, so never Q or E. A
 * held key does not repeat. Ctrl and Cmd are the browser's; AltGr (Ctrl
 * and Alt on Windows, Option on a Mac) types the brackets on Spanish and
 * German keyboards, so Alt passes.
 */
export function shoulderStep({ key, ctrlKey, metaKey, altKey, repeat }: ShoulderKey): -1 | 0 | 1 {
  if (repeat || metaKey || (ctrlKey && !altKey)) return 0;
  return key === "[" ? -1 : key === "]" ? 1 : 0;
}

/**
 * Whether the shoulder buttons are STATS's: the focus is in it, or it
 * crosses the middle of the viewport (the section she is looking at, not
 * one peeking in at an edge).
 */
export function ownsShoulderKeys(rect: { top: number; bottom: number }, viewportHeight: number, focusInside: boolean): boolean {
  if (focusInside) return true;
  const middle = viewportHeight / 2;
  return rect.top <= middle && rect.bottom > middle;
}
