import { describe, expect, it } from "vitest";
import { GATE, gateAction, lenisMissed, liftFling, pageScroll } from "./gate";

describe("where the page is", () => {
  it("draws from Lenis' sub-pixel value while it agrees with the page", () => {
    expect(pageScroll({ page: 341, lenis: 340.6, gliding: true })).toBe(340.6);
    expect(pageScroll({ page: 341, lenis: 340.6, gliding: false })).toBe(340.6);
    expect(lenisMissed({ page: 341, lenis: 340.6, gliding: false })).toBe(false);
  });

  it("trusts the page when Lenis missed a native move, and starts Lenis again from it", () => {
    // Lenis dropped the scroll event after its own landing; the page went on to 2584.
    const reading = { page: 2584, lenis: 284, gliding: false };
    expect(pageScroll(reading)).toBe(2584);
    expect(lenisMissed(reading)).toBe(true);
    // Back up as well: the page is where it is.
    expect(pageScroll({ page: 120, lenis: 900, gliding: false })).toBe(120);
  });

  it("does not take a glide for a miss: Lenis writes the page itself", () => {
    expect(lenisMissed({ page: 2584, lenis: 284, gliding: true })).toBe(false);
  });
});

describe("the gate", () => {
  const max = 500;

  it("puts the page back at the wall, whatever moved it past it", () => {
    for (const scroll of [max + GATE.snapSlop + 0.5, max + 300, max + 2300]) {
      for (const gliding of [false, true]) {
        for (const lenisTarget of [max, scroll, max - 100]) {
          expect(gateAction({ scroll, lenisTarget, gliding, max }), `${scroll} ${gliding} ${lenisTarget}`).toBe("back");
        }
      }
    }
  });

  it("turns a glide aimed past the wall into it, and leaves the page alone otherwise", () => {
    expect(gateAction({ scroll: max - 50, lenisTarget: max + 200, gliding: true, max })).toBe("into");
    expect(gateAction({ scroll: max - 50, lenisTarget: max + 200, gliding: false, max })).toBe("none");
    expect(gateAction({ scroll: max - 50, lenisTarget: max, gliding: true, max })).toBe("none");
    expect(gateAction({ scroll: max + GATE.snapSlop, lenisTarget: max, gliding: false, max })).toBe("none");
  });

  it("holds nothing once every beat is done", () => {
    expect(gateAction({ scroll: 1e5, lenisTarget: 1e5, gliding: true, max: Number.POSITIVE_INFINITY })).toBe("none");
  });

  it("lets a finger's fling fly up to the wall and no further, and not at all close to it", () => {
    const vh = 844;
    expect(liftFling(300, 1000, vh)).toBe(300);
    expect(liftFling(300, 120, vh)).toBe(120);
    expect(liftFling(300, GATE.liftRoom * vh - 1, vh)).toBe(0);
    expect(liftFling(0, 1000, vh)).toBe(0);
    expect(liftFling(Number.NaN, 1000, vh)).toBe(0);
    // Never past the wall, for any fling and room.
    for (const fling of [1, 50, 400, 3000]) {
      for (const room of [-50, 0, 40, 60, 200, 5000]) expect(liftFling(fling, room, vh)).toBeLessThanOrEqual(Math.max(0, room));
    }
  });
});
