import { drive, STREAM, STREAM_LENGTH } from "./drive";
import { createRandom } from "./world";

/** Pastel paint jobs so the traffic belongs to the palette. */
export const PAINTS = ["#ff9ec7", "#8fe3d0", "#ffd58a", "#b9a4ff", "#f4f1fa", "#7fd0ff"];

/**
 * Lanes: the hero owns the inner right lane (x = 2.4). Traffic uses only the
 * outer lanes (centred between the dividers at ±4 and the edge lines at
 * ±7.6), so no car ever passes between a camera and the hero car.
 */
export const SAME_LANE_X = 5.8;
export const ONCOMING_LANE_X = -5.8;
/** Same-direction traffic is slower than us: we overtake it. */
export const SAME_RELATIVE = 4;
/** Oncoming traffic: its speed plus ours. */
export const ONCOMING_RELATIVE = drive.speed + 20;

export type TrafficCar = {
  model: number;
  paint: string;
  x: number;
  z0: number;
  /** Metres per second relative to the hero car; + drifts toward the camera. */
  relative: number;
  oncoming: boolean;
};

/**
 * Every car in a lane shares that lane's speed and keeps a fixed gap, so
 * cars never overtake or pass through each other.
 */
export function makeTraffic(perLane: number, modelCount: number): TrafficCar[] {
  const random = createRandom(31);
  const cars: TrafficCar[] = [];
  const spacing = STREAM_LENGTH / perLane;
  for (let i = 0; i < perLane; i += 1) {
    cars.push({
      model: Math.floor(random() * modelCount),
      paint: PAINTS[Math.floor(random() * PAINTS.length)],
      x: SAME_LANE_X,
      z0: STREAM.zFront + i * spacing,
      relative: SAME_RELATIVE,
      oncoming: false,
    });
    cars.push({
      model: Math.floor(random() * modelCount),
      paint: PAINTS[Math.floor(random() * PAINTS.length)],
      x: ONCOMING_LANE_X,
      z0: STREAM.zFront + (i + 0.5) * spacing,
      relative: ONCOMING_RELATIVE,
      oncoming: true,
    });
  }
  return cars;
}
