import { BufferAttribute, type BufferGeometry, type Group, Mesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Kenney Nature Kit palms (CC0), served from public/models. */
export const PALM_MODELS = [
  "/models/kenney-nature/tree_palmDetailedTall.glb",
  "/models/kenney-nature/tree_palmTall.glb",
  "/models/kenney-nature/tree_palmBend.glb",
] as const;

/** The models are about 1.25 units tall; the scene palms are ~11. */
export const PALM_MODEL_SCALE = 9;

/**
 * Flattens a loaded glTF scene into one geometry with only positions and an
 * `aSway` attribute (0 at the roots, 1 at the crown) for the wind shader.
 * The model's own materials and UVs are discarded: palms render as tinted
 * silhouettes.
 */
export function flattenPalm(scene: Group): BufferGeometry {
  scene.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = (object.geometry as BufferGeometry).clone();
    geometry.applyMatrix4(object.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position") geometry.deleteAttribute(name);
    }
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
  });
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Palm model could not be merged");
  parts.forEach((p) => p.dispose());

  merged.scale(PALM_MODEL_SCALE, PALM_MODEL_SCALE, PALM_MODEL_SCALE);
  merged.computeBoundingBox();
  const top = merged.boundingBox?.max.y ?? 1;
  const position = merged.getAttribute("position");
  const sway = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    const t = Math.max(0, position.getY(i)) / top;
    sway[i] = Math.pow(t, 2.2);
  }
  merged.setAttribute("aSway", new BufferAttribute(sway, 1));
  merged.computeBoundingSphere();
  return merged;
}
