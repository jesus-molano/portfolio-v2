import { describe, expect, it } from "vitest";
import { isOnScreen, ON_SCREEN_THRESHOLDS } from "./onScreen";

describe("isOnScreen", () => {
  it("keeps the scene running while any of it shows", () => {
    expect(isOnScreen({ isIntersecting: true, intersectionRatio: 1 })).toBe(true);
    expect(isOnScreen({ isIntersecting: true, intersectionRatio: 0.002 })).toBe(true);
  });

  it("stops it where Skip lands: the hero's bottom edge touching the viewport's top", () => {
    // An observer reports an edge-adjacent target as intersecting, with nothing of it in view.
    expect(isOnScreen({ isIntersecting: true, intersectionRatio: 0 })).toBe(false);
  });

  it("stops it once the hero is gone", () => {
    expect(isOnScreen({ isIntersecting: false, intersectionRatio: 0 })).toBe(false);
  });

  it("asks the observer to report the step from touching to showing", () => {
    // With [0] alone, touching and showing share a threshold index and the change goes unreported.
    expect(ON_SCREEN_THRESHOLDS[0]).toBe(0);
    expect(ON_SCREEN_THRESHOLDS.some((t) => t > 0 && t < 0.01)).toBe(true);
  });
});
