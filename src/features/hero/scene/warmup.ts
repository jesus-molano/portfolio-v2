import { HalfFloatType, WebGLRenderTarget, type Camera, type Material, type Object3D, type Scene, type Texture, type WebGLRenderer } from "three";

/**
 * Warming a scene up before it is seen: its textures uploaded and its
 * programs compiled while nothing waits on them, so no frame she watches
 * stalls on a shader or a texture. Shared by the hero (HeroWarmup) and the
 * night (Warmup in NightScene.tsx).
 *
 * The programs must be the ones the frame uses. Every frame is drawn by the
 * post-processing composer into a half-float target, never straight to the
 * screen, and three.js compiles a material differently for a target (linear
 * output, no tone mapping) than for the screen (sRGB output): a warm-up
 * compiled for the screen warmed programs nothing ever drew, and every cut
 * compiled its stop again in her first frame of it.
 */

type Uniforms = Record<string, { value: unknown } | undefined>;

function take(value: unknown, into: Set<Texture>): void {
  const texture = value as Texture | null;
  if (texture && typeof texture === "object" && texture.isTexture === true) into.add(texture);
}

/** Every texture among a set of uniforms' values, single values and arrays, once each. */
export function uniformTextures(uniforms: Uniforms, into: Set<Texture> = new Set()): Set<Texture> {
  for (const uniform of Object.values(uniforms)) {
    const value = uniform?.value;
    if (Array.isArray(value)) for (const item of value) take(item, into);
    else take(value, into);
  }
  return into;
}

/** Every texture a material draws with: its own maps and its shader's uniforms (arrays too), once each. */
export function texturesOf(material: Material, into: Set<Texture> = new Set()): Set<Texture> {
  for (const value of Object.values(material)) take(value, into);
  const uniforms = (material as { uniforms?: Uniforms }).uniforms;
  if (uniforms) uniformTextures(uniforms, into);
  return into;
}

/** Calls `visit` with every material under `root`, visible or not (three compiles them all). */
function eachMaterial(root: Object3D, visit: (material: Material) => void): number {
  let drawn = 0;
  root.traverse((object) => {
    const material = (object as { material?: Material | Material[] }).material;
    if (!material) return;
    drawn += 1;
    if (Array.isArray(material)) material.forEach(visit);
    else visit(material);
  });
  return drawn;
}

/**
 * What a warm-up has seen of a group: how many things it draws and how many
 * textures they draw with, or null while it draws nothing. A model that
 * lands or a board whose art is painted changes it, so the group is warmed
 * again; a uniform that only changes value does not.
 */
export function warmKey(root: Object3D): string | null {
  const textures = new Set<Texture>();
  const drawn = eachMaterial(root, (material) => texturesOf(material, textures));
  return drawn === 0 ? null : `${drawn}:${textures.size}`;
}

/**
 * Uploads every texture the materials under `root` draw with, once each
 * (`seen`), at most `limit` of them (the night uploads one an idle slice:
 * an atlas is a long upload on its own). One with nothing in it yet (an
 * image still decoding, a render target's own) is left for a later look.
 * Returns how many it uploaded.
 */
export function uploadTextures(
  gl: Pick<WebGLRenderer, "initTexture">,
  root: Object3D,
  seen: WeakSet<Texture>,
  limit = Number.POSITIVE_INFINITY,
): number {
  const found = new Set<Texture>();
  eachMaterial(root, (material) => texturesOf(material, found));
  let uploaded = 0;
  for (const texture of found) {
    if (uploaded >= limit) break;
    if (seen.has(texture) || texture.version === 0) continue;
    seen.add(texture);
    gl.initTexture(texture);
    uploaded += 1;
  }
  return uploaded;
}

/**
 * A 1 x 1 target of the composer's own kind (half float, its
 * frameBufferType), bound while a warm-up compiles so three.js picks the
 * programs the composer draws with. Dispose of it with its canvas: the
 * renderer hangs a listener on it that would keep the whole renderer.
 */
export function createWarmTarget(): WebGLRenderTarget {
  return new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
}

type Compiler = Pick<
  WebGLRenderer,
  "getRenderTarget" | "getActiveCubeFace" | "getActiveMipmapLevel" | "setRenderTarget" | "compileAsync"
>;

/**
 * Compiles every material under `root` (visible or not) as the composer
 * draws it, lit by `scene`'s lights: `target` is bound while three.js
 * chooses and starts the programs (the synchronous part of
 * `compileAsync`), and the renderer's own target comes back after, also
 * when compiling throws. The promise settles once the programs are linked
 * (in parallel where the GPU allows); it rejects rather than throw.
 */
export function compileAsComposed(
  gl: Compiler,
  root: Object3D,
  camera: Camera,
  scene: Scene,
  target: WebGLRenderTarget,
): Promise<unknown> {
  const previous = gl.getRenderTarget();
  const face = gl.getActiveCubeFace();
  const level = gl.getActiveMipmapLevel();
  try {
    gl.setRenderTarget(target);
    return gl.compileAsync(root, camera, scene);
  } catch (error) {
    return Promise.reject(error);
  } finally {
    gl.setRenderTarget(previous, face, level);
  }
}

/**
 * drei's loaders have nothing left to fetch. The models start loading at
 * import (useGLTF.preload), and drei's progress store misses that start:
 * it reads "not active, nothing to load" until the first model arrives.
 * Counting that as done let a slow connection report the scene ready with
 * every model still downloading.
 */
export function downloadsDone({ active, loaded, total }: { active: boolean; loaded: number; total: number }): boolean {
  return !active && total > 0 && loaded >= total;
}

const warmed = new WeakSet<object>();

/** The scene of this renderer's canvas has been warmed up (HeroWarmup), or given up on. */
export function markWarm(gl: object): void {
  warmed.add(gl);
}

export function isWarm(gl: object): boolean {
  return warmed.has(gl);
}
