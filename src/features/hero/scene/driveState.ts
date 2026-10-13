/**
 * The car drives on its own at constant speed; the world streams past it
 * (treadmill). Scroll never moves the car: it cuts between camera shots.
 *
 * Coherence rule: everything fixed to the ground moves toward +z by
 * `distance`. Instanced props use `wrapZ(z0 + distance, window)`; shaders
 * use `worldZ - distance` for their patterns (lane dashes, asphalt, sand,
 * water).
 *
 * The state alone, in a module that imports nothing: the stage reads the
 * speed for its dash, and drive.ts, which places the streamed props with
 * three.js objects built as it loads, put three.js in the page's first
 * bundle through that one import. drive.ts re-exports it.
 */
export const drive = {
  /** Metres travelled since load. */
  distance: 0,
  /** Metres per second. */
  speed: 18,
};
