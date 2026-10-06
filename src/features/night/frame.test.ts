import { describe, expect, it } from "vitest";
import { fitPose, MAX_FOV, poseAt, projectPose, SAFE, type Vec3 } from "./frame";

const board: Vec3[] = [
  [-8, 10, -13],
  [8, 10, -13],
  [8, 3, -13],
  [-8, 3, -13],
];
const pose = { position: [0, 2, 6] as Vec3, look: [0, 6, -13] as Vec3, fov: 35.6 };

function inside(points: [number, number][], safe: { x0: number; x1: number; y0: number; y1: number }) {
  return points.every(([x, y]) => x >= safe.x0 - 1e-3 && x <= safe.x1 + 1e-3 && y >= safe.y0 - 1e-3 && y <= safe.y1 + 1e-3);
}

describe("frame", () => {
  it("interpolates keys and holds before the first and after the last", () => {
    const keys = [
      { ...pose, p: 0.2 },
      { ...pose, position: [10, 2, 6] as Vec3, p: 0.4 },
    ];
    expect(poseAt(keys, 0).position[0]).toBe(0);
    expect(poseAt(keys, 0.3).position[0]).toBeCloseTo(5, 6);
    expect(poseAt(keys, 0.9).position[0]).toBe(10);
  });

  it("leaves a pose that already frames its board alone", () => {
    expect(fitPose(pose, board, 1.6, SAFE.desktop, 20)).toBe(pose);
  });

  it("fits the board inside the portrait safe rectangle by pulling back first", () => {
    const fitted = fitPose(pose, board, 0.46, SAFE.portrait, 80);
    expect(fitted.fov).toBeCloseTo(pose.fov, 6);
    expect(inside(projectPose(fitted, board, 0.46), SAFE.portrait)).toBe(true);
  });

  it("widens the lens only once it cannot pull back further, never past 70 degrees", () => {
    const fitted = fitPose(pose, board, 0.46, SAFE.portrait, 2);
    expect(fitted.fov).toBeGreaterThan(pose.fov);
    expect(fitted.fov).toBeLessThanOrEqual(MAX_FOV);
  });
});
