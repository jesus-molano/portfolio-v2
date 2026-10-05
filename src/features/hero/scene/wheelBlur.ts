/**
 * Wheel blur, as racing games do it: past a few turns a second the rim's
 * spokes fade into their rotational average, a blur disc that looks the
 * same at any angle, so a fast wheel never strobes or looks frozen.
 * Pure helpers; Car.tsx builds the texture and drives the blend.
 */

/** Below this angular speed (rad/s, ~1 turn a second) the spokes stay sharp. */
export const BLUR_START = 6;
/** At and above this angular speed (~4 turns a second) the disc is fully in. */
export const BLUR_FULL = 25;

/**
 * Angular speed (rad/s) of a wheel of `radius` metres that rolled
 * `deltaDistance` metres in `delta` seconds; 0 for an empty frame.
 */
export function wheelAngularSpeed(deltaDistance: number, delta: number, radius: number): number {
  return delta > 0 && radius > 0 ? deltaDistance / delta / radius : 0;
}

/** Blend of the blur disc over the spokes for an angular speed in rad/s. */
export function blurAmount(angularSpeed: number): number {
  const t = Math.min(1, Math.max(0, (Math.abs(angularSpeed) - BLUR_START) / (BLUR_FULL - BLUR_START)));
  return t * t * (3 - 2 * t);
}

/** Circle in texture space: centre (u, v) and radius, in UV units. */
export type UvCircle = { u: number; v: number; radius: number };

/**
 * Where a wheel's rim disc sits in the texture atlas: the UV of the vertex
 * on the axle (the centre of the disc) and the UV distance to the furthest
 * rim vertex. `positions` are xyz triples in the wheel's local space, the
 * axle along x; `uvs` are uv pairs. Returns null without a vertex.
 */
export function rimUvCircle(positions: ArrayLike<number>, uvs: ArrayLike<number>): UvCircle | null {
  const count = Math.min(Math.floor(positions.length / 3), Math.floor(uvs.length / 2));
  if (count === 0) return null;
  let centre = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i += 1) {
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const offAxis = y * y + z * z;
    if (offAxis < best) {
      best = offAxis;
      centre = i;
    }
  }
  const u = uvs[centre * 2];
  const v = uvs[centre * 2 + 1];
  let radius = 0;
  for (let i = 0; i < count; i += 1) {
    radius = Math.max(radius, Math.hypot(uvs[i * 2] - u, uvs[i * 2 + 1] - v));
  }
  return { u, v, radius };
}

const toLinear = (channel: number) => (channel / 255) ** 2.2;
const toByte = (linear: number) => Math.round(Math.min(1, Math.max(0, linear)) ** (1 / 2.2) * 255);

/**
 * Rotational average of a square RGBA image about its centre: every pixel
 * becomes the mean of the ring it sits on, averaged in linear light like a
 * camera shutter would. Pixels beyond the inscribed circle take the
 * outermost ring. Returns a new array of the same size.
 */
export function radialAverage(pixels: ArrayLike<number>, size: number): Uint8ClampedArray {
  const half = size / 2;
  const rings = Math.max(1, Math.ceil(half));
  const sums = new Float64Array(rings * 4);
  const counts = new Float64Array(rings);
  const ringOf = (x: number, y: number) =>
    Math.min(rings - 1, Math.floor(Math.hypot(x + 0.5 - half, y + 0.5 - half)));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const ring = ringOf(x, y);
      const i = (y * size + x) * 4;
      sums[ring * 4] += toLinear(pixels[i]);
      sums[ring * 4 + 1] += toLinear(pixels[i + 1]);
      sums[ring * 4 + 2] += toLinear(pixels[i + 2]);
      sums[ring * 4 + 3] += pixels[i + 3];
      counts[ring] += 1;
    }
  }

  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const ring = ringOf(x, y);
      const n = Math.max(1, counts[ring]);
      const i = (y * size + x) * 4;
      out[i] = toByte(sums[ring * 4] / n);
      out[i + 1] = toByte(sums[ring * 4 + 1] / n);
      out[i + 2] = toByte(sums[ring * 4 + 2] / n);
      out[i + 3] = Math.round(sums[ring * 4 + 3] / n);
    }
  }
  return out;
}
