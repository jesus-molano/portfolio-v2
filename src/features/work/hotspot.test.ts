import { describe, expect, it } from "vitest";
import { ARM, DISARMED, insideQuad, quadArea, quadClipPath, quadIsTargetable, quadOverlapsScreen, quadUv, stepArm } from "./hotspot";

const quad = [
  [-0.5, 0.5],
  [0.5, 0.5],
  [0.5, -0.5],
  [-0.5, -0.5],
] as const;

describe("hotspot geometry", () => {
  it("finds a point's place on a board: shares from its top left", () => {
    expect(quadUv(quad, -0.5, 0.5)).toEqual([0, 0]);
    const [u, v] = quadUv(quad, 0.25, -0.25);
    expect(u).toBeCloseTo(0.75, 9);
    expect(v).toBeCloseTo(0.75, 9);
  });

  it("finds it through the board's perspective, exactly, and clamps it to the board", () => {
    // A pinhole camera off to the left looks at a board 16.5 x 3.8 m, turned 25 degrees.
    const corners: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const project = ([u, v]: [number, number]): [number, number] => {
      const turn = (25 * Math.PI) / 180;
      const x = (u - 0.5) * 16.5;
      const y = (0.5 - v) * 3.8;
      const wx = x * Math.cos(turn) + 2;
      const wz = -12 - x * Math.sin(turn);
      const f = 1.6;
      return [(f * wx) / -wz, (f * (y - 0.4)) / -wz];
    };
    const ndc = corners.map(project);
    for (const uv of [
      [0.5, 0.5],
      [0.1, 0.8],
      [0.93, 0.07],
      [0.3, 0.3],
    ] as [number, number][]) {
      const [x, y] = project(uv);
      const [u, v] = quadUv(ndc, x, y);
      expect(u).toBeCloseTo(uv[0], 9);
      expect(v).toBeCloseTo(uv[1], 9);
    }
    // A naive share of the top edge is off by several percent at the middle.
    const [mx] = project([0.5, 0.5]);
    expect(Math.abs((mx - ndc[0][0]) / (ndc[1][0] - ndc[0][0]) - 0.5)).toBeGreaterThan(0.03);
    expect(quadUv(ndc, Math.max(ndc[1][0], ndc[2][0]) + 0.02, (ndc[1][1] + ndc[2][1]) / 2)[0]).toBe(1);
  });

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

  it("knows a board covers the screen even when none of its corners is on it", () => {
    expect(quadOverlapsScreen(quad)).toBe(true);
    // Wider than a phone's frame on both sides: no corner on screen, the picture full of it.
    const wide = [
      [-2.4, 0.6],
      [1.9, 0.62],
      [1.9, -0.3],
      [-2.4, -0.32],
    ] as const;
    expect(quadOverlapsScreen(wide)).toBe(true);
    // Its edges across the screen, no corner of either inside the other.
    const band = [
      [-3, 0.2],
      [3, 0.2],
      [3, -0.2],
      [-3, -0.2],
    ] as const;
    expect(quadOverlapsScreen(band)).toBe(true);
    const offRight = quad.map(([x, y]) => [x + 2, y] as const);
    expect(quadOverlapsScreen(offRight)).toBe(false);
    const above = quad.map(([x, y]) => [x * 6, y + 3] as const);
    expect(quadOverlapsScreen(above)).toBe(false);
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
