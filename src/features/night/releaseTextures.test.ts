import { Color, DataTexture, Texture } from "three";
import { describe, expect, it } from "vitest";
import { boundTextures } from "./releaseTextures";

describe("boundTextures", () => {
  it("collects every texture a set of uniforms binds, once", () => {
    const atlas = new Texture();
    const lut = new DataTexture(new Uint8Array(4), 1, 1);
    const shadow = new Texture();
    const found = boundTextures([
      { uMap: { value: atlas }, uColor: { value: new Color() }, uLevel: { value: 0.3 }, uNone: { value: null } },
      { dfgLUT: { value: lut }, uMap: { value: atlas }, shadows: { value: [shadow, null] } },
      undefined,
      { missing: undefined },
    ]);
    expect([...found]).toEqual([atlas, lut, shadow]);
  });
});
