import { BufferGeometry, type Material, type Mesh, type Object3D, type Texture } from "three";

/**
 * Clones a cached glTF scene for the night canvas. Object3D.clone copies
 * userData through JSON, and the hero keeps live objects there (the car's
 * rim uniforms, the driver's bind pose and glasses), so the clone is made
 * with every userData set aside and put back afterwards.
 */
export function cloneBare<T extends Object3D>(root: T, clone: (source: T) => T = (source) => source.clone(true) as T): T {
  const saved = new Map<Object3D, Record<string, unknown>>();
  root.traverse((object) => {
    saved.set(object, object.userData);
    object.userData = {};
  });
  try {
    return clone(root);
  } finally {
    saved.forEach((userData, object) => {
      object.userData = userData;
    });
  }
}

/** A clone whose geometries, materials and textures are its own (see `cloneOwned`). */
export type Owned<T> = { object: T; dispose: () => void };

/**
 * A geometry of its own over the same data: the attributes (and their
 * arrays) are shared, nothing is copied, but the renderer that draws it
 * hangs its dispose listener on this object, not on the cached one.
 */
export function shareGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.name = source.name;
  geometry.setIndex(source.index);
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  const morphs = geometry.morphAttributes as Record<string, unknown[]>;
  for (const [name, list] of Object.entries(source.morphAttributes)) if (list) morphs[name] = list.slice();
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  for (const group of source.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.boundingBox = source.boundingBox?.clone() ?? null;
  geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  geometry.drawRange.start = source.drawRange.start;
  geometry.drawRange.count = source.drawRange.count;
  geometry.userData = source.userData;
  return geometry;
}

/**
 * A material of its own with the same look: every setting copied, the
 * shader hooks the hero gave it (`onBeforeCompile`, its cache key) kept,
 * its live uniforms (`userData`) shared by reference rather than copied
 * through JSON, and its textures swapped for clones of their own over the
 * same image (`textures`, one clone per source texture).
 */
export function ownMaterial(source: Material, textures: Map<Texture, Texture>): Material {
  const userData = source.userData;
  source.userData = {};
  let material: Material;
  try {
    material = source.clone();
  } finally {
    source.userData = userData;
  }
  material.userData = userData;
  if (Object.prototype.hasOwnProperty.call(source, "onBeforeCompile")) material.onBeforeCompile = source.onBeforeCompile;
  if (Object.prototype.hasOwnProperty.call(source, "customProgramCacheKey")) material.customProgramCacheKey = source.customProgramCacheKey;
  const slots = material as unknown as Record<string, unknown>;
  for (const key of Object.keys(slots)) {
    const value = slots[key] as Texture | null;
    if (!value || typeof value !== "object" || !(value as Texture).isTexture) continue;
    let copy = textures.get(value);
    if (!copy) {
      copy = value.clone();
      textures.set(value, copy);
    }
    slots[key] = copy;
  }
  return material;
}

/**
 * Clones a cached glTF scene for the night canvas (as `cloneBare`), with
 * geometries, materials and textures of its own, and a `dispose` that
 * releases them. The hero's renderer and the night's each hang a dispose
 * listener on what they draw; on resources shared with the hero's cache,
 * which lives for the page, the night's listener kept the whole night
 * renderer (its WebGL context, programs and buffers) alive after its canvas
 * was gone, once per pass down into the city and back. Disposing the
 * night's own copies runs and removes its listeners, and touches nothing
 * the hero draws.
 */
export function cloneOwned<T extends Object3D>(root: T, clone?: (source: T) => T): Owned<T> {
  const object = cloneBare(root, clone);
  const geometries = new Map<BufferGeometry, BufferGeometry>();
  const materials = new Map<Material, Material>();
  const textures = new Map<Texture, Texture>();
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    let ownGeometry = geometries.get(geometry);
    if (!ownGeometry) {
      ownGeometry = shareGeometry(geometry);
      geometries.set(geometry, ownGeometry);
    }
    mesh.geometry = ownGeometry;
    const own = (material: Material) => {
      let copy = materials.get(material);
      if (!copy) {
        copy = ownMaterial(material, textures);
        materials.set(material, copy);
      }
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
  });
  return {
    object,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}

/** Adds another clone's resources to an owner's `dispose`. */
export function adopt<T>(owner: Owned<T>, other: Owned<unknown>): Owned<T> {
  const first = owner.dispose;
  return {
    object: owner.object,
    dispose: () => {
      first();
      other.dispose();
    },
  };
}
