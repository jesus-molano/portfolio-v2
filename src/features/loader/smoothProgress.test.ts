import { describe, expect, it } from "vitest";
import { SMOOTH, smoothProgress } from "./smoothProgress";

/** Runs the shown value at 60 fps against a sequence of reported steps. */
function run(steps: { at: number; target: number }[], seconds: number, done = false) {
  const frames: number[] = [];
  let shown = 0;
  let target = 0;
  for (let t = 0; t <= seconds; t += 1 / 60) {
    for (const step of steps) if (step.at <= t) target = step.target;
    shown = smoothProgress(shown, target, 1 / 60, { done });
    frames.push(shown);
  }
  return frames;
}

describe("the start menu's shown load", () => {
  it("glides between the scene's steps instead of jumping to each", () => {
    // The scene reports in big steps: 0 → 40 % → 45 % → 90 %.
    const frames = run(
      [
        { at: 0.1, target: 0.4 },
        { at: 1.2, target: 0.45 },
        { at: 1.6, target: 0.9 },
      ],
      4,
    );
    const steps = frames.slice(1).map((value, i) => value - frames[i]);
    // No frame moves more than the speed limit allows, and none goes back.
    for (const step of steps) {
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(SMOOTH.maxPerSecond / 60 + 1e-9);
    }
    // It keeps moving through a step (no stop-and-go at the step's edge) and lands on the target.
    expect(frames.at(-1)).toBe(0.9);
  });

  it("finishes quickly once the city is in, and never past the end", () => {
    const frames = run([{ at: 0, target: 1 }], 1.2, true);
    expect(frames.at(-1)).toBe(1);
    expect(Math.max(...frames)).toBeLessThanOrEqual(1);
  });

  it("is the target itself under reduced motion, and never backs up", () => {
    expect(smoothProgress(0.2, 0.7, 1 / 60, { reduced: true })).toBe(0.7);
    expect(smoothProgress(0.6, 0.3, 1 / 60)).toBe(0.6);
  });
});
