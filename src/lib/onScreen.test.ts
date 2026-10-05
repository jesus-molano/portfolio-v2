import { describe, expect, it } from "vitest";
import { isOnScreen, lineRootMargin, ON_SCREEN_THRESHOLDS } from "./onScreen";

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

describe("lineRootMargin", () => {
  it("shrinks the viewport to the one line of pixels at y", () => {
    // 900 px tall, the line at 52: 52 above it, 847 below, 1 left.
    expect(lineRootMargin(52, 900)).toBe("-52px 0px -847px 0px");
    expect(lineRootMargin(51.6, 900)).toBe("-52px 0px -847px 0px");
  });

  it("keeps the line inside the viewport", () => {
    expect(lineRootMargin(-10, 900)).toBe("0px 0px -899px 0px");
    expect(lineRootMargin(2000, 900)).toBe("-899px 0px 0px 0px");
    expect(lineRootMargin(0, 0)).toBe("0px 0px 0px 0px");
  });
});
