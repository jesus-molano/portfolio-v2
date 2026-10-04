import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

/**
 * The car drives on its own at constant speed; the world streams past it
 * (treadmill). Scroll never moves the car: it cuts between camera shots.
 *
 * Coherence rule: everything fixed to the ground moves toward +z by
 * `distance`. Instanced props use `wrapZ(z0 + distance)`; shaders use
 * `worldZ - distance` for their patterns (lane dashes, asphalt, sand, water).
 */
export const drive = {
  /** Metres travelled since load. */
  distance: 0,
  /** Metres per second. */
  speed: 18,
};

/** Where the hero car sits in the world: right lane, never moves. */
export const CAR_POSITION = { x: 2.4, y: 0, z: 0 } as const;

/** Streamed props live in this z window and wrap around it. */
export const STREAM = { zBack: 70, zFront: -150 } as const;

export const STREAM_LENGTH = STREAM.zBack - STREAM.zFront;

/** Distance over which a prop grows in from the haze instead of popping. */
const FADE_IN = 35;

/** Wraps a z coordinate that moved toward the camera back into the window. */
export function wrapZ(z: number): number {
  // Modulo, not a loop: the distance grows without limit while the page is
  // open, and a loop would get slower every minute.
  const offset = (((z - STREAM.zFront) % STREAM_LENGTH) + STREAM_LENGTH) % STREAM_LENGTH;
  return STREAM.zFront + offset;
}

/** 0 at the far edge of the window, 1 once the prop is FADE_IN metres closer. */
export function streamFade(z: number): number {
  const t = Math.min(1, Math.max(0, (z - STREAM.zFront) / FADE_IN));
  return t * t * (3 - 2 * t);
}

export type StreamPlacement = {
  x: number;
  y?: number;
  z0: number;
  rotY?: number;
  scale?: number;
};

const matrix = new Matrix4();
const quaternion = new Quaternion();
const position = new Vector3();
const scale = new Vector3();
const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Writes streamed instance matrices. Geometry must have its base at y = 0 so
 * the grow-in keeps it on the ground. Scale never reaches 0 (no NaN normals).
 */
export function placeStreamed(mesh: InstancedMesh, list: StreamPlacement[], distance: number) {
  list.forEach((item, i) => {
    const z = wrapZ(item.z0 + distance);
    const s = Math.max(0.001, streamFade(z) * (item.scale ?? 1));
    quaternion.setFromAxisAngle(Y_AXIS, item.rotY ?? 0);
    position.set(item.x, item.y ?? 0, z);
    scale.setScalar(s);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
