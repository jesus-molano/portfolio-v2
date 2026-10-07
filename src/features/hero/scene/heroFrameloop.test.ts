import { describe, expect, it } from "vitest";
import { READY_GRACE_MS, heroFrameloop } from "./heroFrameloop";

const base = { animate: true, active: true, ready: false, entered: false, sinceReadyMs: 0 };

describe("heroFrameloop", () => {
  it("draws every frame while the scene loads", () => {
    expect(heroFrameloop(base)).toBe("always");
  });

  it("keeps drawing for a short grace once ready, then rests behind the menu", () => {
    expect(heroFrameloop({ ...base, ready: true, sinceReadyMs: 0 })).toBe("always");
    expect(heroFrameloop({ ...base, ready: true, sinceReadyMs: READY_GRACE_MS - 1 })).toBe("always");
    expect(heroFrameloop({ ...base, ready: true, sinceReadyMs: READY_GRACE_MS })).toBe("demand");
    expect(heroFrameloop({ ...base, ready: true, sinceReadyMs: Number.POSITIVE_INFINITY })).toBe("demand");
  });

  it("draws every frame from the moment she enters", () => {
    expect(heroFrameloop({ ...base, ready: true, entered: true, sinceReadyMs: Number.POSITIVE_INFINITY })).toBe("always");
    // A slow load lets her in early: still drawing.
    expect(heroFrameloop({ ...base, entered: true })).toBe("always");
  });

  it("renders on demand out of view, under opaque night and under reduced motion", () => {
    expect(heroFrameloop({ ...base, entered: true, ready: true, active: false })).toBe("demand");
    expect(heroFrameloop({ ...base, entered: true, ready: true, animate: false })).toBe("demand");
    expect(heroFrameloop({ ...base, animate: false })).toBe("demand");
  });
});
