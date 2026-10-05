"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import {
  type Bone,
  BufferAttribute,
  Color,
  DoubleSide,
  type Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import type { QualityTier } from "../useQualityTier";

/**
 * Gold aviators with pink-violet mirrored lenses: an original model, built
 * and fitted to his head by tools/blender/build_sunglasses.py. The GLB is
 * in the frame of the rig's "head" bone, so it is simply that bone's child.
 */
export const SUNGLASSES_URL = "/models/sunglasses/aviator.glb";

useGLTF.preload(SUNGLASSES_URL);

/**
 * Thin gold wire: a plain metal, a little brushed. A pale gold: the warm
 * key and the pink sky it mirrors push it toward copper on their own.
 */
const FRAME = { color: "#f3d38c", metalness: 1, roughness: 0.3 } as const;

/**
 * Mirror coating over a dark lens. The tint is the mirror's own colour (its
 * reflectance), so the lenses show the sunset sky from the environment map
 * in violet at the top and pink at the bottom, as gradient mirrors do. From
 * behind, the lens is dark tinted glass. On the high tier a clear coat adds
 * the lens's own colourless gloss on top, which turns white at grazing angles.
 */
const LENS = {
  top: "#a04cf2",
  bottom: "#ff6cc0",
  back: "#2b1c33",
  metalness: 0.9,
  roughness: 0.05,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
} as const;

/** Prepared glasses, stored on the cached GLTF scene (it outlives remounts). */
type Prepared = { glasses: Group; lens: MeshPhysicalMaterial };
const PREPARED_KEY = "vaSunglasses";

/**
 * Vertical gradient as vertex colours, from the lens UVs: each lens has its
 * own box, and glTF's t runs from its top (0) to its bottom (1).
 */
function paintGradient(mesh: Mesh) {
  const uv = mesh.geometry.getAttribute("uv");
  if (!uv) return;
  const top = new Color(LENS.top);
  const bottom = new Color(LENS.bottom);
  const color = new Color();
  const colors = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    color.lerpColors(top, bottom, Math.min(1, Math.max(0, uv.getY(i))));
    color.toArray(colors, i * 3);
  }
  mesh.geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

function lensMaterial(): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    metalness: LENS.metalness,
    roughness: LENS.roughness,
    side: DoubleSide,
  });
  const uniforms = { uLensBack: { value: new Color(LENS.back) } };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 uLensBack;\nvoid main() {")
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        // The mirror coating faces out; inside, the lens is dark glass.
        if (!gl_FrontFacing) {
          diffuseColor.rgb = uLensBack;
          metalnessFactor = 0.0;
        }`,
      );
  };
  return material;
}

/** Swaps the model's materials for ours, once per loaded scene. */
function prepare(scene: Group): Prepared {
  const stored = scene.userData[PREPARED_KEY] as Prepared | undefined;
  if (stored) return stored;
  const frame = new MeshStandardMaterial(FRAME);
  frame.name = "Frame";
  const lens = lensMaterial();
  lens.name = "Lens";
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const source = object.material as MeshStandardMaterial;
    if (source.name === "Lens") {
      paintGradient(object);
      object.material = lens;
    } else {
      object.material = frame;
    }
    source.dispose();
    // The head turns; the glasses' bounds are small and always near it.
    object.frustumCulled = false;
  });
  const prepared = { glasses: scene, lens };
  scene.userData[PREPARED_KEY] = prepared;
  return prepared;
}

type Props = {
  /** The rig's head bone: the glasses ride on it, glance included. */
  head: Bone | undefined;
  tier: QualityTier;
};

/** Puts the aviators on his head. Renders nothing of its own. */
export function Sunglasses({ head, tier }: Props) {
  const { scene } = useGLTF(SUNGLASSES_URL);
  const invalidate = useThree((state) => state.invalidate);

  // Layout effect: on before the first frame, also with frameloop="demand".
  useLayoutEffect(() => {
    if (!head) return;
    const { glasses, lens } = prepare(scene);
    // The clear coat is a second specular layer: high tier only.
    lens.clearcoat = tier === "high" ? LENS.clearcoat : 0;
    lens.clearcoatRoughness = LENS.clearcoatRoughness;
    head.add(glasses);
    invalidate();
    return () => {
      head.remove(glasses);
    };
  }, [scene, head, tier, invalidate]);

  return null;
}
