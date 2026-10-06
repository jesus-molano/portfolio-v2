import { describe, expect, it } from "vitest";
import { idFromHash } from "@/lib/hash";
import {
  PANEL_ALIASES,
  PANEL_IDS,
  STATS_ID,
  STATS_TABS,
  TAB_IDS,
  hashForTab,
  ownsShoulderKeys,
  shoulderStep,
  stepTab,
  tabForId,
  tabListKey,
  type ShoulderKey,
} from "./statsTabs";

const key = (k: string, mods: Partial<ShoulderKey> = {}): ShoulderKey => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  ...mods,
});

describe("the STATS tabs' fragments", () => {
  it("lists STATS first, then MAP, ACHIEVEMENTS and SETTINGS", () => {
    expect(STATS_TABS).toEqual(["sheet", "map", "achievements", "settings"]);
  });

  it("opens STATS from #stats, and every other tab from its panel's fragment", () => {
    expect(tabForId(idFromHash("#stats"))).toBe("sheet");
    expect(tabForId(idFromHash("#stats-map"))).toBe("map");
    expect(tabForId(idFromHash("#stats-achievements"))).toBe("achievements");
    expect(tabForId(idFromHash("#stats-settings"))).toBe("settings");
    // STATS's own panel id opens it too, so an old link to #stats-sheet still lands on it.
    expect(tabForId(idFromHash("#stats-sheet"))).toBe("sheet");
    // The achievement tree took the favourites' place: a link shared before still opens it.
    expect(tabForId(idFromHash("#stats-favorites"))).toBe("achievements");
    expect(PANEL_ALIASES).toEqual({ "stats-favorites": "achievements" });
  });

  it("opens nothing for a fragment that is not the section's or a panel's", () => {
    for (const hash of ["", "#", "#projects", "#stats-records", "#stats-map-tab", "#Stats", "#stats-favourites", "#stats-achievements-title"]) {
      expect(tabForId(idFromHash(hash)), hash).toBeNull();
    }
  });

  it("shares STATS as #stats and the others by their panels, and reads each back as its tab", () => {
    expect(hashForTab("sheet")).toBe("#stats");
    expect(hashForTab("map")).toBe("#stats-map");
    expect(hashForTab("achievements")).toBe("#stats-achievements");
    expect(hashForTab("settings")).toBe("#stats-settings");
    for (const tab of STATS_TABS) expect(tabForId(idFromHash(hashForTab(tab)))).toBe(tab);
  });

  it("gives every tab and panel its own id, none of them the section's", () => {
    const ids = [STATS_ID, ...Object.values(PANEL_IDS), ...Object.values(TAB_IDS), ...Object.keys(PANEL_ALIASES)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the tab bar's keys", () => {
  it("steps with the arrows and wraps round at both ends", () => {
    expect(tabListKey("ArrowRight", "sheet")).toBe("map");
    expect(tabListKey("ArrowRight", "map")).toBe("achievements");
    expect(tabListKey("ArrowRight", "settings")).toBe("sheet");
    expect(tabListKey("ArrowLeft", "map")).toBe("sheet");
    expect(tabListKey("ArrowLeft", "sheet")).toBe("settings");
  });

  it("goes to the ends with Home and End", () => {
    for (const tab of STATS_TABS) {
      expect(tabListKey("Home", tab)).toBe("sheet");
      expect(tabListKey("End", tab)).toBe("settings");
    }
  });

  it("keeps the tab on Space and Enter, so Space does not scroll the page", () => {
    for (const tab of STATS_TABS) {
      expect(tabListKey(" ", tab)).toBe(tab);
      expect(tabListKey("Enter", tab)).toBe(tab);
    }
  });

  it("leaves every other key alone: Tab goes on to the panel, the vertical arrows scroll", () => {
    for (const k of ["Tab", "ArrowUp", "ArrowDown", "PageDown", "Escape", "q", "[", "a"]) expect(tabListKey(k, "map"), k).toBeNull();
  });

  it("steps any distance, wrapping", () => {
    expect(stepTab("sheet", 1)).toBe("map");
    expect(stepTab("sheet", 4)).toBe("sheet");
    expect(stepTab("sheet", -1)).toBe("settings");
    expect(stepTab("map", -6)).toBe("settings");
  });
});

describe("the shoulder buttons", () => {
  it("steps left with [ and right with ]", () => {
    expect(shoulderStep(key("["))).toBe(-1);
    expect(shoulderStep(key("]"))).toBe(1);
  });

  it("never takes Q or E: Q is the radio's", () => {
    for (const k of ["q", "Q", "e", "E"]) expect(shoulderStep(key(k)), k).toBe(0);
  });

  it("ignores a held key and the browser's shortcuts", () => {
    expect(shoulderStep(key("]", { repeat: true }))).toBe(0);
    expect(shoulderStep(key("]", { ctrlKey: true }))).toBe(0);
    expect(shoulderStep(key("[", { metaKey: true }))).toBe(0);
  });

  it("takes the brackets typed with AltGr or Option (Spanish and German keyboards)", () => {
    expect(shoulderStep(key("[", { ctrlKey: true, altKey: true }))).toBe(-1);
    expect(shoulderStep(key("]", { altKey: true }))).toBe(1);
  });

  it("are STATS's while it crosses the middle of the viewport, or holds the focus", () => {
    const vh = 900;
    expect(ownsShoulderKeys({ top: 0, bottom: 900 }, vh, false)).toBe(true);
    expect(ownsShoulderKeys({ top: -1200, bottom: 600 }, vh, false)).toBe(true);
    // Peeking in at the bottom, or leaving at the top: another section is the one on screen.
    expect(ownsShoulderKeys({ top: 700, bottom: 1600 }, vh, false)).toBe(false);
    expect(ownsShoulderKeys({ top: -800, bottom: 100 }, vh, false)).toBe(false);
    expect(ownsShoulderKeys({ top: 3000, bottom: 3900 }, vh, true)).toBe(true);
  });
});
