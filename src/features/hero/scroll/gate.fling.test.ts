import { describe, expect, it } from "vitest";
import { GATE, newStroke, resetStroke, steadyFling, strokeLift, strokeMove } from "./gate";

/**
 * A flick of `dy` px over `ms`, the finger sampled every 8 ms, read by a page drawing a frame every
 * `frameMs` (a multiple of 8): each frame gets that frame's moves as one coalesced touchmove. Lenis
 * 1.3.26 under syncTouch sets its target at once on every move (lerp 1) and its velocity in its
 * frame, so at the lift its velocity is the last frame's move, and its fling |velocity|^1.7. With
 * `sameTask`, the lift comes in the same task as the last frame's moves (a frame blocked longer than
 * the gesture's tail): Lenis' velocity is still the frame before's.
 */
function flick(dy: number, ms: number, frameMs: number, sameTask = false) {
  const stroke = newStroke();
  resetStroke(stroke, 1000);
  let velocity = 0;
  let last = 0;
  for (let t = frameMs; t <= ms; t += frameMs) {
    const move = (dy * frameMs) / ms;
    strokeMove(stroke, move, 1000 + t);
    velocity = last;
    last = move;
  }
  if (!sameTask) velocity = last;
  const at = 1000 + ms + 4;
  return { lenis: Math.abs(velocity) ** 1.7, steady: steadyFling(stroke, 1.7, at), lift: strokeLift(stroke, at) };
}

describe("steadyFling", () => {
  it("flings a flick as far at 20 or 30 fps as at 60, where Lenis' own flew three to six times further", () => {
    const at60 = flick(420, 96, 16);
    expect(at60.lift).toBe(1);
    // At 60 fps it is Lenis' own fling, within a tenth.
    expect(at60.steady).toBeGreaterThan(at60.lenis * 0.9);
    expect(at60.steady).toBeLessThan(at60.lenis * 1.1);
    for (const frameMs of [32, 48]) {
      const slow = flick(420, 96, frameMs);
      expect(slow.lenis).toBeGreaterThan(at60.lenis * 3);
      expect(slow.lift).toBe(1);
      expect(slow.steady).toBeLessThan(at60.lenis * 1.25);
      expect(slow.steady).toBeGreaterThan(at60.lenis * 0.75);
    }
  });

  it("flings a flick whose lift shares a frame's task with its last moves as far as at 60 fps", () => {
    const at60 = flick(420, 96, 16);
    for (const frameMs of [48, 96]) {
      // Lenis' velocity was still the frame before's (or zeroed): measured, it flew 150 px, then none.
      const loaded = flick(420, 96, frameMs, true);
      expect(loaded.lift).toBe(1);
      expect(loaded.steady).toBeGreaterThan(at60.lenis * 0.75);
      expect(loaded.steady).toBeLessThan(at60.lenis * 1.25);
    }
  });

  it("flings nothing for a finger that stopped before it lifted, or never moved", () => {
    const s = newStroke();
    resetStroke(s, 0);
    for (let t = 16; t <= 96; t += 16) strokeMove(s, 70, t);
    expect(steadyFling(s, 1.7, 96 + GATE.flingStaleMs)).toBeGreaterThan(0);
    expect(steadyFling(s, 1.7, 96 + GATE.flingStaleMs + 1)).toBe(0);
    expect(steadyFling(newStroke(), 1.7, 0)).toBe(0);
    const still = newStroke();
    resetStroke(still, 0);
    expect(steadyFling(still, 1.7, 8)).toBe(0);
  });

  it("reads one coalesced move from the landing: a flick of a single frame still flings", () => {
    const s = newStroke();
    resetStroke(s, 0);
    strokeMove(s, 300, 60);
    expect(steadyFling(s, 1.7, 64)).toBeGreaterThan((300 / 60 * GATE.flingFrameMs * 0.9) ** 1.7);
  });
});
