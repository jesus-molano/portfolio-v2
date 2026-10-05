import { Color, Vector3 } from "three";
import { world } from "./world";

/**
 * The afterglow ramp of the sky dome and the colours of its clouds. One
 * table for the visible dome (`Sky.tsx`), the environment map
 * (`SkyEnvironment.tsx`) and the water's sky reflection (`Water.tsx`), so
 * the car paint, the sea and every lit material reflect exactly the sky the
 * camera sees.
 */
export const SKY_COLORS = {
  /** Lavender at the zenith. */
  top: "#7257cc",
  /** Pink band under the sun. */
  middle: "#e49bcd",
  /** Peach at the horizon under the sun. */
  horizon: "#ffcaa0",
  /** Away from the sun the same ramp turns cooler. */
  awayMiddle: "#b58ad6",
  awayHorizon: "#dca3cf",
  /** Warm glow around the sun and along the horizon. */
  glow: "#ffe2b8",
  /** Cloud faces toward the sun: peach-gold (multiplied up for the silver lining). */
  cloudSun: "#ffd3a2",
  /** Lit cloud faces away from the sun: pink. */
  cloudLit: "#ffb0d6",
  /** Cloud bellies away from the sun: lavender-violet. */
  cloudShade: "#7b5ab6",
  /** Cloud bellies under the sun: dusky rose. */
  cloudShadeWarm: "#a4688f",
} as const;

export type SkyUniforms = {
  uTop: { value: Color };
  uMiddle: { value: Color };
  uHorizon: { value: Color };
  uAwayMiddle: { value: Color };
  uAwayHorizon: { value: Color };
  uGlow: { value: Color };
  uSunPosition: { value: Vector3 };
  /** Seconds of cloud drift. Advanced by the visible dome only. */
  uCloudTime: { value: number };
  uCloudSun: { value: Color };
  uCloudLit: { value: Color };
  uCloudShade: { value: Color };
  uCloudShadeWarm: { value: Color };
};

/**
 * Fresh uniforms for one sky material. Every material gets its own objects:
 * three.js uploads uniforms by reference, and a shared Color would let one
 * material's tweak leak into the other.
 */
export function createSkyUniforms(sunPosition: Vector3 = world.sun.position): SkyUniforms {
  return {
    uTop: { value: new Color(SKY_COLORS.top) },
    uMiddle: { value: new Color(SKY_COLORS.middle) },
    uHorizon: { value: new Color(SKY_COLORS.horizon) },
    uAwayMiddle: { value: new Color(SKY_COLORS.awayMiddle) },
    uAwayHorizon: { value: new Color(SKY_COLORS.awayHorizon) },
    uGlow: { value: new Color(SKY_COLORS.glow) },
    uSunPosition: { value: sunPosition.clone() },
    uCloudTime: { value: 0 },
    uCloudSun: { value: new Color(SKY_COLORS.cloudSun) },
    uCloudLit: { value: new Color(SKY_COLORS.cloudLit) },
    uCloudShade: { value: new Color(SKY_COLORS.cloudShade) },
    uCloudShadeWarm: { value: new Color(SKY_COLORS.cloudShadeWarm) },
  };
}

/** Cloud detail per tier: fbm octaves, and the bank's self-shadow sample. */
export const CLOUD_DETAIL = {
  high: { octaves: 5, shadow: true },
  low: { octaves: 3, shadow: false },
} as const;

/**
 * Shader defines for the clouds of one tier (see shaders/sky.ts). The
 * environment map renders once, so it always takes the high tier.
 */
export function cloudDefines(tier: "high" | "low"): Record<string, number> {
  const detail = CLOUD_DETAIL[tier];
  return detail.shadow
    ? { CLOUD_OCTAVES: detail.octaves, CLOUD_SHADOW: 1 }
    : { CLOUD_OCTAVES: detail.octaves };
}

/**
 * Unit vector from `from` toward the sun. The key light and the hot spot of
 * the environment map both point along it, so the paint highlight sits where
 * the sun is. Falls back to straight ahead (-z) if the two points coincide.
 */
export function sunDirection(
  from: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  sunPosition: Vector3 = world.sun.position,
): Vector3 {
  const direction = new Vector3(sunPosition.x - from.x, sunPosition.y - from.y, sunPosition.z - from.z);
  return direction.lengthSq() > 1e-12 ? direction.normalize() : new Vector3(0, 0, -1);
}

/** Look of the environment map's extra layers (see shaders/environment.ts). */
export const ENVIRONMENT_LOOK = {
  /** Angular radius of the hot sun disc, in degrees. Larger than the real
   *  sun (0.27°) so rough paint still catches a highlight. */
  sunRadius: 2.2,
  /** Soft limb outside that radius, in degrees. */
  sunSoftness: 1.4,
  /** HDR radiance of the disc: what makes the paint highlight hot. */
  sunRadiance: 14,
  /** HDR radiance of the horizon strip under the sun. */
  stripRadiance: 1.6,
  /** Half height of the horizon strip, as a direction's y (about 0.7°). */
  stripWidth: 0.012,
  /** The ground below the horizon, as a fraction of the haze and asphalt colours. */
  groundHorizon: 0.55,
  groundDeep: 0.45,
} as const;

export type EnvironmentLook = { [K in keyof typeof ENVIRONMENT_LOOK]: number };

export type EnvironmentLightUniforms = {
  uSunDirection: { value: Vector3 };
  uSunColor: { value: Color };
  uSunCos: { value: number };
  uSunSoftCos: { value: number };
  uStripColor: { value: Color };
  uStripWidth: { value: number };
};

/**
 * Uniforms of the environment's sun disc and horizon strip. The disc points
 * along `sunDirection()` from the cube camera at the origin; `uSunCos` and
 * `uSunSoftCos` are the cosines of the disc radius and of the outer limb,
 * so the shader needs no trigonometry.
 */
export function createEnvironmentLightUniforms(
  sunColor: string,
  stripColor: string,
  sunPosition: Vector3 = world.sun.position,
  look: EnvironmentLook = ENVIRONMENT_LOOK,
): EnvironmentLightUniforms {
  const degrees = Math.PI / 180;
  return {
    uSunDirection: { value: sunDirection({ x: 0, y: 0, z: 0 }, sunPosition) },
    uSunColor: { value: new Color(sunColor).multiplyScalar(look.sunRadiance) },
    uSunCos: { value: Math.cos(look.sunRadius * degrees) },
    uSunSoftCos: { value: Math.cos((look.sunRadius + look.sunSoftness) * degrees) },
    uStripColor: { value: new Color(stripColor).multiplyScalar(look.stripRadiance) },
    uStripWidth: { value: look.stripWidth },
  };
}
