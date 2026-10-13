import type { Texture } from "three";
import { uniformTextures } from "@/features/hero/scene/warmup";

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
  for (const uniforms of list) {
    if (uniforms) uniformTextures(uniforms, found);
  }
  return found;
}
