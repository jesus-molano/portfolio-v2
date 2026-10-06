import { describe, expect, it } from "vitest";
import { ARM, DISARMED, insideQuad, quadArea, quadClipPath, quadIsTargetable, stepArm } from "./hotspot";

const quad = [
  [-0.5, 0.5],
  [0.5, 0.5],
  [0.5, -0.5],
  [-0.5, -0.5],
] as const;

describe("hotspot geometry", () => {
  it("measures a quad as a share of the viewport", () => {
    expect(quadArea(quad)).toBeCloseTo(0.25, 9);
  });

  it("writes a clip-path in viewport percentages", () => {
    expect(quadClipPath(quad)).toBe("polygon(25.00% 25.00%, 75.00% 25.00%, 75.00% 75.00%, 25.00% 75.00%)");
  });

  it("targets only boards big enough and turned to the camera", () => {
    expect(quadIsTargetable(quad, 1)).toBe(true);
    expect(quadIsTargetable(quad, 0.2)).toBe(false);
    const tiny = quad.map(([x, y]) => [x * 0.2, y * 0.2] as const);
    expect(quadArea(tiny)).toBeLessThan(ARM.minArea);
    expect(quadIsTargetable(tiny, 1)).toBe(false);
  });

  it("knows a point inside a quad", () => {
    expect(insideQuad(quad, 0, 0)).toBe(true);
    expect(insideQuad(quad, 0.9, 0)).toBe(false);
  });
});

describe("arming", () => {
  it("arms on a real pointer move, not under a resting cursor", () => {
    expect(stepArm(DISARMED, { type: "pointermove", overQuad: true, resting: true }).state.armed).toBe(false);
    const armed = stepArm(DISARMED, { type: "pointermove", overQuad: true, resting: false });
    expect(armed.action).toBe("arm");
    expect(stepArm(armed.state, { type: "pointermove", overQuad: false, resting: false }).state.armed).toBe(false);
  });

  it("opens a mouse click only on an armed board", () => {
    const first = stepArm(DISARMED, { type: "tap", pointerType: "mouse", overQuad: true, heldMs: 80, at: 0 });
    expect(first.action).toBe("arm");
    expect(stepArm(first.state, { type: "tap", pointerType: "mouse", overQuad: true, heldMs: 80, at: 10 }).action).toBe(
      "open",
    );
  });

  it("on touch, arms on the first tap and opens on a second one within 4 s", () => {
    const first = stepArm(DISARMED, { type: "tap", pointerType: "touch", overQuad: true, heldMs: 90, at: 1000 });
    expect(first.action).toBe("arm");
    expect(stepArm(first.state, { type: "tap", pointerType: "touch", overQuad: true, heldMs: 90, at: 3000 }).action).toBe(
      "open",
    );
    const late = stepArm(first.state, { type: "tap", pointerType: "touch", overQuad: true, heldMs: 90, at: 6000 });
    expect(late.action).toBe("arm");
    expect(stepArm(first.state, { type: "tick", at: 1000 + ARM.touchMs + 1 }).state.armed).toBe(false);
  });

  it("ignores a long press (the radio wheel) and disarms when the stop changes", () => {
    expect(stepArm(DISARMED, { type: "tap", pointerType: "touch", overQuad: true, heldMs: 500, at: 0 }).action).toBe("none");
    const focused = stepArm(DISARMED, { type: "focus", at: 0 });
    expect(focused.state.via).toBe("focus");
    expect(stepArm(focused.state, { type: "stopChanged" }).state.armed).toBe(false);
    expect(stepArm(focused.state, { type: "blur" }).state.armed).toBe(false);
  });
});
