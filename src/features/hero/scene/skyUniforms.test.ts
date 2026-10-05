import { Color, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  CLOUD_DETAIL,
  ENVIRONMENT_LOOK,
  SKY_COLORS,
  cloudDefines,
  createEnvironmentLightUniforms,
  createSkyUniforms,
  sunDirection,
} from "./skyUniforms";
import { world } from "./world";

describe("createSkyUniforms", () => {
  it("uses the shared afterglow ramp and the world sun", () => {
    const uniforms = createSkyUniforms();
    expect(uniforms.uTop.value.equals(new Color(SKY_COLORS.top))).toBe(true);
    expect(uniforms.uHorizon.value.equals(new Color(SKY_COLORS.horizon))).toBe(true);
    expect(uniforms.uSunPosition.value.equals(world.sun.position)).toBe(true);
  });

  it("gives every material its own objects", () => {
    const a = createSkyUniforms();
    const b = createSkyUniforms();
    expect(a.uTop.value).not.toBe(b.uTop.value);
    expect(a.uSunPosition.value).not.toBe(b.uSunPosition.value);
    // A copy, so moving one dome's sun never moves the world sun.
    expect(a.uSunPosition.value).not.toBe(world.sun.position);
  });

  it("carries the cloud palette, its clock at rest", () => {
    const uniforms = createSkyUniforms();
    expect(uniforms.uCloudTime.value).toBe(0);
    expect(uniforms.uCloudSun.value.equals(new Color(SKY_COLORS.cloudSun))).toBe(true);
    expect(uniforms.uCloudLit.value.equals(new Color(SKY_COLORS.cloudLit))).toBe(true);
    expect(uniforms.uCloudShade.value.equals(new Color(SKY_COLORS.cloudShade))).toBe(true);
    expect(uniforms.uCloudShadeWarm.value.equals(new Color(SKY_COLORS.cloudShadeWarm))).toBe(true);
    expect(createSkyUniforms().uCloudSun.value).not.toBe(uniforms.uCloudSun.value);
  });

  it("keeps cloud bellies darker than their lit faces", () => {
    const luminance = (hex: string) => {
      const c = new Color(hex);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    expect(luminance(SKY_COLORS.cloudShade)).toBeLessThan(luminance(SKY_COLORS.cloudLit));
    expect(luminance(SKY_COLORS.cloudShadeWarm)).toBeLessThan(luminance(SKY_COLORS.cloudSun));
  });

  it("follows a sun moved elsewhere", () => {
    const sun = new Vector3(-70, 9, -330);
    expect(createSkyUniforms(sun).uSunPosition.value.equals(sun)).toBe(true);
  });
});

describe("sunDirection", () => {
  it("is a unit vector toward the sun", () => {
    const sun = new Vector3(-70, 9, -330);
    const direction = sunDirection({ x: 2.4, y: 0, z: 0 }, sun);
    expect(direction.length()).toBeCloseTo(1);
    const expected = sun.clone().sub(new Vector3(2.4, 0, 0)).normalize();
    expect(direction.distanceTo(expected)).toBeLessThan(1e-9);
  });

  it("points ahead and low for the default world", () => {
    const direction = sunDirection();
    expect(direction.z).toBeLessThan(0);
    expect(direction.y).toBeGreaterThan(0);
    expect(direction.y).toBeLessThan(0.2);
  });

  it("never returns NaN when the two points coincide", () => {
    const sun = new Vector3(1, 2, 3);
    const direction = sunDirection({ x: 1, y: 2, z: 3 }, sun);
    expect(Number.isNaN(direction.x + direction.y + direction.z)).toBe(false);
    expect(direction.length()).toBeCloseTo(1);
  });
});

describe("createEnvironmentLightUniforms", () => {
  it("aims the disc at the sun and keeps the limb outside the disc", () => {
    const sun = new Vector3(-70, 9, -330);
    const uniforms = createEnvironmentLightUniforms("#ffd8a8", "#ffe2b8", sun);
    expect(uniforms.uSunDirection.value.distanceTo(sun.clone().normalize())).toBeLessThan(1e-9);
    // A wider angle has a smaller cosine.
    expect(uniforms.uSunSoftCos.value).toBeLessThan(uniforms.uSunCos.value);
    expect(uniforms.uSunCos.value).toBeCloseTo(Math.cos((ENVIRONMENT_LOOK.sunRadius * Math.PI) / 180));
  });

  it("makes the sun HDR and brighter than the horizon strip", () => {
    const uniforms = createEnvironmentLightUniforms("#ffd8a8", "#ffe2b8");
    const sun = uniforms.uSunColor.value;
    const strip = uniforms.uStripColor.value;
    expect(Math.max(sun.r, sun.g, sun.b)).toBeGreaterThan(1);
    expect(sun.r).toBeGreaterThan(strip.r);
    expect(uniforms.uStripWidth.value).toBeGreaterThan(0);
  });
});

describe("cloudDefines", () => {
  it("gives the high tier more detail and the self-shadow sample", () => {
    const high = cloudDefines("high");
    const low = cloudDefines("low");
    expect(high.CLOUD_OCTAVES).toBe(CLOUD_DETAIL.high.octaves);
    expect(low.CLOUD_OCTAVES).toBe(CLOUD_DETAIL.low.octaves);
    expect(high.CLOUD_OCTAVES).toBeGreaterThan(low.CLOUD_OCTAVES);
    expect(high.CLOUD_SHADOW).toBe(1);
    expect("CLOUD_SHADOW" in low).toBe(false);
  });

  it("leaves the self-shadow sample at least one octave", () => {
    // The shadow sample runs CLOUD_OCTAVES - 1 octaves (shaders/sky.ts).
    for (const detail of Object.values(CLOUD_DETAIL)) {
      if (detail.shadow) expect(detail.octaves - 1).toBeGreaterThanOrEqual(1);
    }
  });
});
