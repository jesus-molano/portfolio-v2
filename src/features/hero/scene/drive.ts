/**
 * The car drives on its own at constant speed; the world streams past it
 * (treadmill). Scroll never moves the car: it cuts between camera shots.
 * `distance` is advanced once per frame by `DriveClock` and read by the road,
 * the palms, the traffic and the wheels.
 */
export const drive = {
  /** Metres travelled since load. */
  distance: 0,
  /** Metres per second. */
  speed: 20,
};

/** Where the hero car sits in the world: right lane, never moves. */
export const CAR_POSITION = { x: 2.4, y: 0, z: 0 } as const;

/** The world streams in this z window and wraps around it. */
export const STREAM = { zBack: 70, zFront: -170 } as const;

export const STREAM_LENGTH = STREAM.zBack - STREAM.zFront;

/** Wraps a z coordinate that moved toward the camera back into the window. */
export function wrapZ(z: number): number {
  let value = z;
  while (value > STREAM.zBack) value -= STREAM_LENGTH;
  while (value < STREAM.zFront) value += STREAM_LENGTH;
  return value;
}
