import { CAR_POSITION, drive, STREAM, STREAM_LENGTH } from "./drive";
import { createRandom, world } from "./world";

/**
 * Dusty pastels so the traffic belongs to the palette without outshining the
 * hero: greyer than his deep blue, never as saturated, and no white, the
 * one paint that pulled the eye from him.
 */
export const PAINTS = ["#d996b4", "#8cbfb3", "#d8b98a", "#a597d2", "#86a9cc"];

/**
 * Lanes: the hero owns the inner right lane (x = 2.4). Traffic uses only the
 * outer lanes (centred between the dividers at ±4 and the edge lines at
 * ±7.6), so no car ever passes between a camera and the hero car.
 */
export const SAME_LANE_X = 5.8;
export const ONCOMING_LANE_X = -5.8;
/**
 * Same-direction traffic holds our pace (never faster than the hero, AGENTS.md),
 * so it keeps its distance: it never comes alongside him in the rear shot or
 * behind his head in the close-up, whenever the visitor scrolls there.
 */
export const SAME_RELATIVE = 0;
/**
 * Same-direction cars, metres from the hero along z (negative is ahead),
 * in order of need: one ahead for the rear and low shots, one behind for the
 * crane's opening, one further ahead for the high end of the crane.
 */
export const SAME_LANE_Z = [-62, 48, -110] as const;
/** No same-direction car comes closer to the hero than this, ahead or behind. */
export const HERO_CLEARANCE = 40;
/** Oncoming traffic: its speed plus ours. It streams past in the far lane. */
export const ONCOMING_RELATIVE = drive.speed + 20;
/**
 * One oncoming car: it shows up far down the causeway, sweeps past about
 * every six seconds and is in the hero's shots for under a second of that.
 * Two of them put a car beside him in about a third of the frames.
 */
export const ONCOMING_COUNT = 1;

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
 * cars never overtake or pass through each other. `perLane` same-direction
 * cars (capped by the slots above) and ONCOMING_COUNT oncoming ones.
 */
export function makeTraffic(perLane: number, modelCount: number): TrafficCar[] {
  const random = createRandom(31);
  const pick = () => ({
    model: Math.floor(random() * modelCount),
    paint: PAINTS[Math.floor(random() * PAINTS.length)],
  });
  const same = Math.min(perLane, SAME_LANE_Z.length);
  const oncoming = ONCOMING_COUNT;
  const cars: TrafficCar[] = [];
  for (let i = 0; i < same; i += 1) {
    cars.push({
      ...pick(),
      x: SAME_LANE_X,
      z0: CAR_POSITION.z + SAME_LANE_Z[i],
      relative: SAME_RELATIVE,
      oncoming: false,
    });
  }
  const spacing = STREAM_LENGTH / oncoming;
  for (let i = 0; i < oncoming; i += 1) {
    cars.push({
      ...pick(),
      x: ONCOMING_LANE_X,
      z0: STREAM.zFront + (i + 0.5) * spacing,
      relative: ONCOMING_RELATIVE,
      oncoming: true,
    });
  }
  return cars;
}

/** Height for a car model's origin so its lowest point (the tyres) rests on the road. */
export function restingY(modelMinY: number): number {
  return world.road.y - modelMinY;
}
