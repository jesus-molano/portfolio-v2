import type { Vec3 } from "./frame";

/**
 * A board's frame in its set: its face centre, its yaw (radians, turning
 * the face normal from +z toward +x) and its size. Converts board-local
 * points (x right, y up, z out of the face) to set coordinates, and gives
 * the corners and the normal the rig and the hotspot need.
 */
export type BoardFrame = { centre: Vec3; yaw: number; w: number; h: number };

export function toSet(frame: BoardFrame, local: Vec3): Vec3 {
  const c = Math.cos(frame.yaw);
  const s = Math.sin(frame.yaw);
  const [x, y, z] = local;
  return [frame.centre[0] + x * c + z * s, frame.centre[1] + y, frame.centre[2] - x * s + z * c];
}

export function boardCorners(frame: BoardFrame, margin = 0): [Vec3, Vec3, Vec3, Vec3] {
  const hw = frame.w / 2 + margin;
  const hh = frame.h / 2 + margin;
  return [toSet(frame, [-hw, hh, 0]), toSet(frame, [hw, hh, 0]), toSet(frame, [hw, -hh, 0]), toSet(frame, [-hw, -hh, 0])];
}

export function boardNormal(frame: BoardFrame): Vec3 {
  return [Math.sin(frame.yaw), 0, Math.cos(frame.yaw)];
}
