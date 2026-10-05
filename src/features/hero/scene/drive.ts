import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { world } from "./world";

/**
 * The car drives on its own at constant speed; the world streams past it
 * (treadmill). Scroll never moves the car: it cuts between camera shots.
 *
 * Coherence rule: everything fixed to the ground moves toward +z by
 * `distance`. Instanced props use `wrapZ(z0 + distance, window)`; shaders
 * use `worldZ - distance` for their patterns (lane dashes, asphalt, sand,
 * water).
 */
export const drive = {
  /** Metres travelled since load. */
  distance: 0,
  /** Metres per second. */
  speed: 18,
};

/**
 * Where the hero car sits in the world: right lane, never moves. Its group
 * sits on the asphalt (the tyres touch the road plane, see carModel.ts).
 */
export const CAR_POSITION = { x: 2.4, y: world.road.y, z: 0 } as const;

/** Streamed props live in this z window and wrap around it. */
export const STREAM = { zBack: 70, zFront: -150 } as const;

export const STREAM_LENGTH = STREAM.zBack - STREAM.zFront;

/** A z range that streamed things live in; they wrap from `zBack` to `zFront`. */
export type StreamWindow = { readonly zFront: number; readonly zBack: number };

/**
 * STREAM is the traffic's. The roadside (palms, lamps, guardrail posts,
 * towers, pier) lives in a longer window. Its far edge is the landfall on the city beach, so the
 * rows run all the way to the city; whatever comes in there is hidden by a
 * static twin (Palms.tsx, Props.tsx) or rises out of the sand, never grows.
 * Its near edge is far enough behind every lens that a prop leaving it is
 * a speck in the haze. 308 m is a whole number of lamp periods (44 m) and
 * guardrail posts (4 m), so neither row shows a seam.
 */
export const ROADSIDE = { zFront: -164, zBack: 144 } as const;

export const ROADSIDE_LENGTH = ROADSIDE.zBack - ROADSIDE.zFront;

/** Distance over which a prop grows in from the haze instead of popping. */
const FADE_IN = 35;

/** Wraps a z coordinate that moved toward the camera back into the window. */
export function wrapZ(z: number, window: StreamWindow = STREAM): number {
  // Modulo, not a loop: the distance grows without limit while the page is
  // open, and a loop would get slower every minute.
  const length = window.zBack - window.zFront;
  const offset = (((z - window.zFront) % length) + length) % length;
  return window.zFront + offset;
}

/** 0 at the far edge of the window, 1 once the prop is `fadeIn` metres closer. */
export function streamFade(z: number, window: StreamWindow = STREAM, fadeIn: number = FADE_IN): number {
  const t = Math.min(1, Math.max(0, (z - window.zFront) / fadeIn));
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
 * With `grow` false the props keep their full size at the far edge (their
 * entry is hidden by a twin, see ROADSIDE). `fixed` instances (twins) are
 * written after the streamed ones and never move.
 */
export function placeStreamed(
  mesh: InstancedMesh,
  list: StreamPlacement[],
  distance: number,
  options: { window?: StreamWindow; grow?: boolean; fixed?: StreamPlacement[] } = {},
) {
  const { window = STREAM, grow = true, fixed = [] } = options;
  list.forEach((item, i) => {
    const z = wrapZ(item.z0 + distance, window);
    const fade = grow ? streamFade(z, window) : 1;
    writeMatrix(mesh, i, item, z, Math.max(0.001, fade * (item.scale ?? 1)));
  });
  fixed.forEach((item, i) => writeMatrix(mesh, list.length + i, item, item.z0, item.scale ?? 1));
  mesh.instanceMatrix.needsUpdate = true;
}

function writeMatrix(mesh: InstancedMesh, index: number, item: StreamPlacement, z: number, s: number) {
  quaternion.setFromAxisAngle(Y_AXIS, item.rotY ?? 0);
  position.set(item.x, item.y ?? 0, z);
  scale.setScalar(s);
  matrix.compose(position, quaternion, scale);
  mesh.setMatrixAt(index, matrix);
}
