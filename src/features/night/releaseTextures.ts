import type { Texture } from "three";

type Uniforms = Record<string, { value: unknown } | undefined>;

/**
 * Every texture a set of compiled uniforms binds (single values and
 * arrays), once each. NightScene releases them with its renderer: the
 * hero's and the night's renderers each hang a dispose listener on a
 * texture they upload, and on one that outlives the night (the window
 * atlas, painted once for the page; three's shared DFG lookup table; the
 * hero car's rim blur, bound through its shader hook) that listener kept
 * the whole night renderer alive after its canvas was gone.
 */
export function boundTextures(list: Iterable<Uniforms | undefined>): Set<Texture> {
  const found = new Set<Texture>();
  const take = (value: unknown) => {
    const texture = value as Texture | null;
    if (texture && typeof texture === "object" && texture.isTexture) found.add(texture);
  };
  for (const uniforms of list) {
    if (!uniforms) continue;
    for (const uniform of Object.values(uniforms)) {
      const value = uniform?.value;
      if (Array.isArray(value)) value.forEach(take);
      else take(value);
    }
  }
  return found;
}
