import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { buildCity } from "./cityLayout";
import { evaluateCamera, projectToNdc, REFERENCE_ASPECT } from "./shots";
import { buildWaterfront } from "./waterfrontLayout";
import { world } from "./world";

/**
 * The sun has to be seen where the film shows it: in the rear chase that
 * opens the hero and at the end of the crane, over the city. The towers
 * stand between the camera and the sun, so a sun placed too low or behind
 * a dense block of towers disappears. These checks ray-trace the disc
 * against the skyline and the hotel row of each tier.
 */

type Box = { min: Vector3; max: Vector3 };

type Block = { x: number; y: number; z: number; w: number; h: number; d: number };

function toBoxes(blocks: Block[]): Box[] {
  return blocks.map((b) => ({
    min: new Vector3(b.x - b.w / 2, b.y, b.z - b.d / 2),
    max: new Vector3(b.x + b.w / 2, b.y + b.h, b.z + b.d / 2),
  }));
}

function hits(origin: Vector3, direction: Vector3, length: number, boxes: Box[]): boolean {
  return boxes.some((box) => {
    let near = 0;
    let far = length;
    for (const axis of ["x", "y", "z"] as const) {
      const inverse = 1 / direction[axis];
      let t0 = (box.min[axis] - origin[axis]) * inverse;
      let t1 = (box.max[axis] - origin[axis]) * inverse;
      if (t0 > t1) [t0, t1] = [t1, t0];
      near = Math.max(near, t0);
      far = Math.min(far, t1);
      if (near > far) return false;
    }
    return true;
  });
}

/** Radius of the bright disc: 0.29 of the half size of the sun quad (shaders/sun.ts). */
const DISC_RADIUS = world.sun.size * 0.95 * 0.29;

/** Share of the disc (sampled on a grid) that the camera sees. */
function visibleShare(eye: Vector3, boxes: Box[]): number {
  const sun = world.sun.position;
  const toEye = eye.clone().sub(sun).normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), toEye).normalize();
  const up = new Vector3().crossVectors(toEye, right);
  let seen = 0;
  let total = 0;
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const u = i / 6;
      const v = j / 6;
      if (u * u + v * v > 1) continue;
      total += 1;
      const point = sun
        .clone()
        .addScaledVector(right, u * DISC_RADIUS)
        .addScaledVector(up, v * DISC_RADIUS);
      const ray = point.clone().sub(eye);
      const length = ray.length();
      if (point.y > 0 && !hits(eye, ray.normalize(), length, boxes)) seen += 1;
    }
  }
  return seen / total;
}

const PHONE_ASPECT = 390 / 844;
const waterfront = buildWaterfront();
const hotels = toBoxes([...waterfront.solids, ...waterfront.hotels]);
// The city each tier builds (Skyline.tsx): the tiers draw different towers.
const TIERS = [
  {
    name: "desktop, high tier",
    aspect: REFERENCE_ASPECT,
    boxes: [...toBoxes(buildCity(150, 5000, 400).blocks), ...hotels],
  },
  {
    name: "phone, low tier",
    aspect: PHONE_ASPECT,
    boxes: [...toBoxes(buildCity(90, 1500, 120).blocks), ...hotels],
  },
];
const FRAMES = [
  { name: "rear chase", progress: 0.05 },
  { name: "end of the crane", progress: 0.97 },
];

describe("sun framing", () => {
  it("sits ahead and to the left of the drive, over the city", () => {
    expect(world.sun.position.x).toBeLessThan(0);
    expect(world.sun.position.z).toBeLessThan(world.skyline.zFar);
  });

  for (const tier of TIERS) {
    for (const frame of FRAMES) {
      it(`shows the disc in the ${frame.name} (${tier.name})`, () => {
        const pose = evaluateCamera(
          frame.progress,
          { position: new Vector3(), look: new Vector3(), fov: world.camera.fov, shot: 0 },
          tier.aspect,
        );
        const ndc = { x: 0, y: 0 };
        expect(projectToNdc(world.sun.position, pose, tier.aspect, ndc)).toBe(true);
        expect(Math.abs(ndc.x)).toBeLessThan(0.85);
        expect(ndc.y).toBeLessThan(0.85);
        // Measured at 0.58-0.79 with the sun at (-50, 55, -330): the lower
        // part sinks behind the tower tops, the rest stays clear.
        expect(visibleShare(pose.position, tier.boxes)).toBeGreaterThan(0.4);
      });
    }
  }
});
