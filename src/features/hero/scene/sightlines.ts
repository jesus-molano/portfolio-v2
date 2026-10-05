/**
 * Line-of-sight checks for the city layouts: can a camera see a sign or a
 * crown, or does a building stand in the way? Boxes are axis-aligned,
 * origin at their bottom centre (the layouts' convention).
 */
export type Point = { x: number; y: number; z: number };
export type Box = { x: number; y: number; z: number; w: number; h: number; d: number };

/**
 * Whether the segment from `from` to `to` passes through `box` before it
 * reaches `to` (slab test). Touching the far end does not count, so a
 * point on a box's own face is not hidden by that box.
 */
export function segmentHitsBox(from: Point, to: Point, box: Box): boolean {
  const min = [box.x - box.w / 2, box.y, box.z - box.d / 2];
  const max = [box.x + box.w / 2, box.y + box.h, box.z + box.d / 2];
  const origin = [from.x, from.y, from.z];
  const delta = [to.x - from.x, to.y - from.y, to.z - from.z];
  let enter = 0;
  let exit = 1 - 1e-6;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(delta[axis]) < 1e-12) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return false;
      continue;
    }
    let t0 = (min[axis] - origin[axis]) / delta[axis];
    let t1 = (max[axis] - origin[axis]) / delta[axis];
    if (t0 > t1) [t0, t1] = [t1, t0];
    enter = Math.max(enter, t0);
    exit = Math.min(exit, t1);
    if (enter > exit) return false;
  }
  return true;
}

/** Share (0..1) of `targets` that `eye` sees past every box in `blockers`. */
export function visibleShare(eye: Point, targets: Point[], blockers: Box[]): number {
  if (targets.length === 0) return 0;
  const seen = targets.filter((target) => !blockers.some((box) => segmentHitsBox(eye, target, box)));
  return seen.length / targets.length;
}
