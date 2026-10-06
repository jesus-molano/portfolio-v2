import { describe, expect, it } from "vitest";
import { BAR_SLACK_PX, isBarResize, keptScreen, type Screen } from "./screen";

// A 390 x 844 phone: 770 px with its address bar and toolbar shown.
const shown: Screen = { width: 390, small: 770, large: 770 };
const hidden: Screen = { width: 390, small: 844, large: 844 };

describe("the page's stable screen", () => {
  it("ignores a phone's bars coming and going, whichever way, any number of times", () => {
    expect(isBarResize(shown, hidden, true)).toBe(true);
    expect(isBarResize(hidden, shown, true)).toBe(true);
    let kept = keptScreen(null, shown, true);
    for (const next of [hidden, shown, { ...hidden, small: 800, large: 800 }, hidden, { ...shown, small: 740, large: 740 }]) {
      kept = keptScreen(kept, next, true);
      expect(kept).toBe(shown);
    }
  });

  it("keeps standard browsers' values, which the bars never change", () => {
    // svh and lvh stay put there: nothing to keep, the same screen.
    const standard: Screen = { width: 390, small: 770, large: 844 };
    expect(keptScreen(standard, { ...standard }, true)).toBe(standard);
  });

  it("takes a real resize: a rotation, a split view, a change past the tallest bars", () => {
    expect(keptScreen(hidden, { width: 844, small: 390, large: 390 }, true).width).toBe(844);
    expect(keptScreen(hidden, { width: 320, small: 844, large: 844 }, true).width).toBe(320);
    const taller = { width: 390, small: 844 + BAR_SLACK_PX, large: 844 + BAR_SLACK_PX };
    expect(keptScreen(hidden, taller, true)).toBe(taller);
  });

  it("takes every resize of a desktop window: it has no bars", () => {
    const desktop: Screen = { width: 1440, small: 900, large: 900 };
    const shorter = { ...desktop, small: 840, large: 840 };
    expect(isBarResize(desktop, shorter, false)).toBe(false);
    expect(keptScreen(desktop, shorter, false)).toBe(shorter);
  });
});
