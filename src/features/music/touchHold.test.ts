import { describe, expect, it } from "vitest";
import { holdArmed, holdCancelled, type HoldInput, holdMayStart, TOUCH_HOLD } from "./touchHold";

const STILL: HoldInput = { heldMs: TOUCH_HOLD.armMs, moved: 0, scrolled: false };

describe("the long-press that opens the radio", () => {
  it("arms only once the finger has stayed still long enough", () => {
    expect(holdArmed(STILL)).toBe(true);
    expect(holdArmed({ ...STILL, heldMs: TOUCH_HOLD.armMs - 1 })).toBe(false);
    expect(holdArmed({ ...STILL, moved: TOUCH_HOLD.slop })).toBe(true);
    // A thumb resting about half a second before a swipe never gets there.
    expect(holdArmed({ ...STILL, heldMs: 450 })).toBe(false);
    expect(TOUCH_HOLD.armMs).toBeGreaterThanOrEqual(550);
  });

  it("is cancelled by any real movement or by the page scrolling", () => {
    expect(holdCancelled({ ...STILL, moved: TOUCH_HOLD.slop + 0.5 })).toBe(true);
    expect(holdArmed({ ...STILL, heldMs: 5000, moved: TOUCH_HOLD.slop + 0.5 })).toBe(false);
    expect(holdCancelled({ ...STILL, scrolled: true })).toBe(true);
    expect(holdArmed({ ...STILL, heldMs: 5000, scrolled: true })).toBe(false);
    expect(TOUCH_HOLD.slop).toBeLessThanOrEqual(10);
  });

  it("never starts on a page in motion or right after a scroll", () => {
    expect(holdMayStart({ sinceScrollMs: 5000, scrolling: false })).toBe(true);
    expect(holdMayStart({ sinceScrollMs: 5000, scrolling: true })).toBe(false);
    expect(holdMayStart({ sinceScrollMs: TOUCH_HOLD.quietBeforeMs - 1, scrolling: false })).toBe(false);
    expect(holdMayStart({ sinceScrollMs: Number.POSITIVE_INFINITY, scrolling: false })).toBe(true);
  });
});
