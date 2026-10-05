import { Color, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createGlowUniforms } from "./neon";
import { createSilhouetteUniforms, SILHOUETTE } from "./silhouette";

describe("createSilhouetteUniforms", () => {
  it("uses the city's silhouette ramp, full fog by default", () => {
    const uniforms = createSilhouetteUniforms({ height: 55, sun: new Vector3(0, 0.2, -1).normalize() });
    expect(uniforms.uBottom.value).toEqual(new Color(SILHOUETTE.bottom));
    expect(uniforms.uTop.value).toEqual(new Color(SILHOUETTE.top));
    expect(uniforms.uHeight.value).toBe(55);
    expect(uniforms.uFogAmount.value).toBe(1);
    expect(uniforms.fogColor).toBeDefined();
  });

  it("rims the sun's side, and no side when the sun is dead ahead", () => {
    const left = createSilhouetteUniforms({ height: 55, sun: new Vector3(-0.5, 0.5, -0.7).normalize() });
    expect(left.uSunSide.value).toBe(-1);
    expect(left.uSideRim.value).toBe(1);
    const ahead = createSilhouetteUniforms({ height: 55, sun: new Vector3(0, 0.2, -1).normalize() });
    expect(ahead.uSideRim.value).toBe(0);
  });

  it("keeps its own copy of the sun direction", () => {
    const sun = new Vector3(1, 0, 0);
    const uniforms = createSilhouetteUniforms({ height: 10, sun });
    sun.set(0, 1, 0);
    expect(uniforms.uSunDir.value.x).toBe(1);
  });
});

describe("createGlowUniforms", () => {
  it("carries the intensity, the share of fog and the scene fog", () => {
    const uniforms = createGlowUniforms(0.4, 2);
    expect(uniforms.uIntensity.value).toBe(2);
    expect(uniforms.uFogAmount.value).toBe(0.4);
    expect(uniforms.fogNear).toBeDefined();
    expect(createGlowUniforms(0.5).uIntensity.value).toBe(1);
  });
});
