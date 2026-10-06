import type { Object3D } from "three";

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
