/**
 * The pause menu's tabs, STATS, MAP, ACHIEVEMENTS and SETTINGS, switched in
 * place like a game's: which fragment opens which tab, and what a key
 * does. Pure, so the tests hold it; StatsTabs.tsx does the DOM.
 */

/** In the menu's order: the player profile first, as a game's pause menu opens on it. */
export const STATS_TABS = ["sheet", "map", "achievements", "settings"] as const;
export type StatsTab = (typeof STATS_TABS)[number];

/** The section's id: a link to it (#stats) opens the first tab, STATS. */
export const STATS_ID = "stats";

/** Each tab's panel; also the fragment that opens it (#stats-map, #stats-achievements, #stats-settings; #stats-sheet too). */
export const PANEL_IDS: Record<StatsTab, string> = {
  sheet: "stats-sheet",
  map: "stats-map",
  achievements: "stats-achievements",
  settings: "stats-settings",
};

/**
 * Old fragments that still open a tab: the achievement tree took the
 * FAVOURITES tab's place, so a link shared as #stats-favorites lands on
 * it. Each alias is an element at the top of its panel (Stats.tsx), so the
 * browser and PageEntry find it, and it lands like the panel.
 */
export const PANEL_ALIASES: Readonly<Record<string, StatsTab>> = {
  "stats-favorites": "achievements",
};

/** Each tab's own id, which names its panel. */
export const TAB_IDS: Record<StatsTab, string> = {
  sheet: "stats-sheet-tab",
  map: "stats-map-tab",
  achievements: "stats-achievements-tab",
  settings: "stats-settings-tab",
};

/** The fragment that shares a tab: the section's for the first one (#stats), the panel's for the others. */
export function hashForTab(tab: StatsTab): string {
  return tab === STATS_TABS[0] ? `#${STATS_ID}` : `#${PANEL_IDS[tab]}`;
}

/** The tab an element id opens: the section, a panel or an old panel's alias; any other id opens none. */
export function tabForId(id: string | null): StatsTab | null {
  if (id === STATS_ID) return STATS_TABS[0];
  if (id !== null && Object.hasOwn(PANEL_ALIASES, id)) return PANEL_ALIASES[id];
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
