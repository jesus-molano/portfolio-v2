import { describe, expect, it } from "vitest";
import { GATE, newStroke, resetStroke, steadyFling, strokeLift, strokeMove } from "./gate";

/**
 * A flick of `dy` px over `ms`, the finger sampled every 8 ms, read by a page drawing a frame every
 * `frameMs` (a multiple of 8): each frame gets that frame's moves as one coalesced touchmove. Lenis
 * 1.3.26 under syncTouch sets its target at once on every move (lerp 1), so its velocity at the lift
 * is the last frame's move, and its fling |velocity|^1.7.
 */
function flick(dy: number, ms: number, frameMs: number) {
  const stroke = newStroke();
  resetStroke(stroke, 1000);
  let velocity = 0;
  for (let t = frameMs; t <= ms; t += frameMs) {
    velocity = strokeMove(stroke, (dy * frameMs) / ms, 1000 + t);
  }
  const lift = strokeLift(stroke, 1000 + ms + 4);
  return { lenis: Math.abs(velocity) ** 1.7, steady: steadyFling(velocity, stroke, 1.7), lift };
}

describe("steadyFling", () => {
  it("flings a flick as far at 20 or 30 fps as at 60, where Lenis' own flew three to six times further", () => {
    const at60 = flick(420, 96, 16);
    expect(at60.lift).toBe(1);
    // At 60 fps it is Lenis' own fling, within a tenth.
    expect(at60.steady).toBeGreaterThan(at60.lenis * 0.9);
    for (const frameMs of [32, 48]) {
      const slow = flick(420, 96, frameMs);
      expect(slow.lenis).toBeGreaterThan(at60.lenis * 3);
      expect(slow.lift).toBe(1);
      expect(slow.steady).toBeLessThan(at60.lenis * 1.25);
      expect(slow.steady).toBeGreaterThan(at60.lenis * 0.75);
    }
  });

  it("never flings further than Lenis would, and a still finger flings nothing", () => {
    const s = newStroke();
    resetStroke(s, 0);
    strokeMove(s, 30, 16);
    expect(steadyFling(5, s, 1.7)).toBeCloseTo(5 ** 1.7);
    expect(steadyFling(0, s, 1.7)).toBe(0);
    expect(steadyFling(40, newStroke(), 1.7)).toBe(0);
  });

  it("reads one coalesced move from the landing: a flick of a single frame still flings", () => {
    const s = newStroke();
    resetStroke(s, 0);
    strokeMove(s, 300, 60);
    expect(steadyFling(300, s, 1.7)).toBeGreaterThan((300 / 60 * GATE.flingFrameMs * 0.9) ** 1.7);
  });
});
