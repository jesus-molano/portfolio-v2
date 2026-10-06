"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  Color,
  type Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  ShaderChunk,
  SRGBColorSpace,
  type Texture,
  Vector4,
} from "three";
import { palette } from "@/design/tokens";
import type { QualityTier } from "../useQualityTier";
import { softDiscFragmentShader, softDiscVertexShader } from "../shaders/softDisc";
import { CAR_MODEL, WHEEL_RADIUS } from "./carModel";
import { CAR_POSITION, drive } from "./drive";
import { Driver } from "./Driver";
import { blurAmount, radialAverage, rimUvCircle, type UvCircle, wheelAngularSpeed } from "./wheelBlur";

type Props = { animate: boolean; tier: QualityTier };

/** "Convertible" by Poly by Google, CC BY 3.0 (see public/models/poly-convertible). */
export const CAR_URL = "/models/poly-convertible/convertible.glb";
const WHEEL_NAMES = ["wheel_front_l", "wheel_front_r", "wheel_rear_l", "wheel_rear_r"];

useGLTF.preload(CAR_URL);

/**
 * Deep blue under a clear coat: a dark paint shows the sky best. The base is
 * mostly dielectric, so the blue stays blue at any angle and the clear coat
 * does the mirroring: crisp sun and sky highlights over a deep colour, not a
 * grey metallic sheen.
 */
const PAINT = {
  color: "#173b9e",
  metalness: 0.05,
  roughness: 0.5,
  /**
   * The base coat's own reflection, off: under a clear coat it only spread
   * the low sun into a milky sheet over the whole flank. The clear coat
   * gives the crisp highlights.
   */
  specularIntensity: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  /**
   * Reflectance of the clear coat at grazing angles (1 in three.js). Our
   * environment is open sky in every direction, without the trees and
   * buildings that darken a real reflection, so an edge-on flank would mirror
   * a bright lavender sheet; capping it keeps the blue in the flank.
   */
  clearcoatF90: 0.4,
} as const;

/** Lamp glow, linear HDR: above the bloom threshold, so the lamps bleed a little. */
const LAMPS = {
  /** Warm headlights. */
  head: new Color("#ffd2a0").multiplyScalar(2.4),
  /** Tail lights glow in their own red from the atlas, this much. */
  tailGain: 2,
} as const;

/** The paint colour, one uniform shared by the paint and the trim materials. */
type PaintUniform = { value: Color };

/**
 * Atlas alpha: 1 keeps the colour, 0.5 is paint, 0.25 is a lamp (see
 * tools/blender/refine_convertible.py). Tints the paint pixels with uPaint
 * and leaves `lampMask` for the emissive pass.
 */
const ATLAS_MASK_FRAGMENT = `#include <map_fragment>
        #ifdef USE_MAP
          float maskAlpha = sampledDiffuseColor.a;
          float paintMask = clamp(min((1.0 - maskAlpha) * 2.0, (maskAlpha - 0.25) * 4.0), 0.0, 1.0);
          float lampMask = clamp((0.5 - maskAlpha) * 4.0, 0.0, 1.0);
          diffuseColor.rgb *= mix(vec3(1.0), uPaint, paintMask);
          diffuseColor.a = opacity;
        #endif`;

/**
 * Bodywork paint. The atlas alpha marks the paint (0.5) and the lamps (0.25)
 * against everything else (1), see tools/blender/refine_convertible.py: only
 * the paint is tinted; lamps keep their colour from the atlas and glow, red
 * tail lights in their own colour, headlights warm.
 */
function paintMaterial(map: Texture | null, paint: PaintUniform): MeshPhysicalMaterial {
  // The colour goes in through `paint` and the mask: as the base colour it
  // would also tint the lamps, plate and grille.
  const { metalness, roughness, specularIntensity, clearcoat, clearcoatRoughness } = PAINT;
  const material = new MeshPhysicalMaterial({
    map,
    metalness,
    roughness,
    specularIntensity,
    clearcoat,
    clearcoatRoughness,
  });
  const uniforms = {
    uPaint: paint,
    uClearcoatF90: { value: PAINT.clearcoatF90 },
    uHeadlight: { value: LAMPS.head.clone() },
    uTailGain: { value: LAMPS.tailGain },
  };
  // Dev builds can tweak the look live through window.__vaScene.
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform vec3 uPaint;\nuniform float uClearcoatF90;\nuniform vec3 uHeadlight;\nuniform float uTailGain;\nvoid main() {",
      )
      .replace("#include <map_fragment>", ATLAS_MASK_FRAGMENT)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        #ifdef USE_MAP
          // Red lamps glow red, the pale ones warm.
          float lampRed = clamp((sampledDiffuseColor.r - max(sampledDiffuseColor.g, sampledDiffuseColor.b)) * 4.0, 0.0, 1.0);
          totalEmissiveRadiance += lampMask * mix(uHeadlight, sampledDiffuseColor.rgb * uTailGain, lampRed);
        #endif`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        ShaderChunk.lights_physical_fragment.replace(
          "material.clearcoatF90 = 1.0;",
          "material.clearcoatF90 = uClearcoatF90;",
        ),
      );
  };
  return material;
}

/**
 * Trim: interior and underbody. A few trim faces (the door tops, the edge of
 * the dashboard) also cover bodywork in the atlas; the paint mask tints it
 * there too, so it never shows as the atlas's neutral grey.
 */
function trimMaterial(map: Texture | null, paint: PaintUniform): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.1 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = paint;
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 uPaint;\nvoid main() {")
      .replace("#include <map_fragment>", ATLAS_MASK_FRAGMENT);
  };
  return material;
}

/** Windscreen: a faint tint where you look through it, a mirror at grazing angles. */
const GLASS = { color: "#dfe8ff", opacity: 0.08, edgeOpacity: 0.85 } as const;

function glassMaterial(): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: GLASS.color,
    metalness: 0,
    roughness: 0.03,
    transparent: true,
    opacity: GLASS.opacity,
    depthWrite: false,
  });
  const uniforms = { uEdgeOpacity: { value: GLASS.edgeOpacity } };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float uEdgeOpacity;\nvoid main() {")
      .replace(
        "#include <opaque_fragment>",
        `// Fresnel: the glass turns into a mirror toward grazing angles.
        float glassFacing = saturate(dot(normal, normalize(vViewPosition)));
        float glassEdge = 1.0 - glassFacing;
        diffuseColor.a = mix(diffuseColor.a, uEdgeOpacity, glassEdge * glassEdge * glassEdge);
        #include <opaque_fragment>`,
      );
  };
  return material;
}

type RimUniforms = {
  uBlurMap: { value: Texture | null };
  /** The rim disc in the atlas: centre uv and radius (uv units). */
  uRim: { value: Vector4 };
  /** 0 sharp spokes, 1 the blur disc only. */
  uBlur: { value: number };
};

/** Rims: metal, with the blur disc (wheelBlur.ts) blended over the spokes as the wheel spins up. */
function rimMaterial(map: Texture | null, uniforms: RimUniforms): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ map, metalness: 0.85, roughness: 0.25 });
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform sampler2D uBlurMap;\nuniform vec4 uRim;\nuniform float uBlur;\nvoid main() {",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        #ifdef USE_MAP
          if (uBlur > 0.0 && uRim.z > 0.0) {
            vec2 rimLocal = (vMapUv - uRim.xy) / uRim.z;
            float inside = 1.0 - smoothstep(0.94, 1.0, length(rimLocal));
            vec3 blurred = texture2D(uBlurMap, rimLocal * 0.5 + 0.5).rgb;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * blurred, uBlur * inside);
          }
        #endif`,
      );
  };
  return material;
}

/** Size of the blur disc texture, in pixels. */
const BLUR_SIZE = 128;

/**
 * The blur disc: the rim's patch of the atlas, averaged around its centre.
 * Built once on the CPU when the model loads (a 128 px canvas). Returns
 * null where a 2D canvas is not available; the rims then stay sharp.
 */
function makeBlurDisc(map: Texture, circle: UvCircle): CanvasTexture | null {
  const image = map.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!image?.width || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = BLUR_SIZE;
  canvas.height = BLUR_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  // glTF textures are not flipped: v runs down the image.
  const radiusX = circle.radius * image.width;
  const radiusY = circle.radius * image.height;
  context.drawImage(
    image,
    circle.u * image.width - radiusX,
    circle.v * image.height - radiusY,
    radiusX * 2,
    radiusY * 2,
    0,
    0,
    BLUR_SIZE,
    BLUR_SIZE,
  );
  const pixels = context.getImageData(0, 0, BLUR_SIZE, BLUR_SIZE);
  pixels.data.set(radialAverage(pixels.data, BLUR_SIZE));
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

/** Materials by the names tools/blender/refine_convertible.py gives the faces. */
function carMaterial(source: MeshStandardMaterial, rim: RimUniforms, paint: PaintUniform): Material {
  const map = source.map;
  switch (source.name) {
    case "Paint":
      return paintMaterial(map, paint);
    case "Glass":
      return glassMaterial();
    case "Rim":
      return rimMaterial(map, rim);
    case "Tyre":
      return new MeshStandardMaterial({ color: "#1d1824", roughness: 0.92 });
    default:
      return trimMaterial(map, paint);
  }
}

/**
 * Swaps the model's materials for ours, once per loaded scene: the cached
 * GLTF scene outlives remounts (the Canvas remounts on a tier change), so
 * the swap and the rims' blur uniforms are stored on the scene itself.
 */
export function prepareCar(scene: Group): RimUniforms {
  const stored = scene.userData.vaRim as RimUniforms | undefined;
  if (stored) return stored;
  const rim: RimUniforms = { uBlurMap: { value: null }, uRim: { value: new Vector4() }, uBlur: { value: 0 } };
  const paint: PaintUniform = { value: new Color(PAINT.color) };
  // Wheels share their materials: one replacement per source material.
  const swapped = new Map<Material, Material>();
  let blurSource: { map: Texture; circle: UvCircle } | undefined;
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const source = object.material as MeshStandardMaterial;
    if (source.name === "Rim" && source.map && !blurSource) {
      const { position, uv } = object.geometry.attributes;
      const circle = uv ? rimUvCircle(position.array, uv.array) : null;
      if (circle) blurSource = { map: source.map, circle };
    }
    let material = swapped.get(source);
    if (!material) {
      material = carMaterial(source, rim, paint);
      material.name = source.name;
      swapped.set(source, material);
    }
    object.material = material;
  });
  if (blurSource) {
    rim.uBlurMap.value = makeBlurDisc(blurSource.map, blurSource.circle);
    rim.uRim.value.set(blurSource.circle.u, blurSource.circle.v, blurSource.circle.radius, 0);
  }
  // The atlas is shared by the new materials: dispose the old materials only.
  swapped.forEach((_, source) => source.dispose());
  scene.userData.vaRim = rim;
  return rim;
}

/** Seconds over which the wheel blur eases in when the drive starts and out when it stops. */
const SPEED_SMOOTHING = 0.25;

/**
 * The hero car. It never moves: the world streams past. Wheels spin with the
 * drive distance and blur as they do; the body (and the driver with it)
 * rides the suspension.
 */
export function Car({ animate, tier }: Props) {
  const { scene } = useGLTF(CAR_URL);
  const ride = useRef<Group>(null);
  const parts = useRef<{ wheels: Object3D[]; body?: Object3D; rim?: RimUniforms }>({ wheels: [] });
  const shadowUniforms = useMemo(
    () => ({ uColor: { value: new Color(palette.night) }, uOpacity: { value: 0.7 } }),
    [],
  );
  const wheelSpeed = useRef({ distance: drive.distance, angular: 0 });

  // Layout effect: the paint swap lands before the first frame renders.
  useLayoutEffect(() => {
    parts.current = {
      wheels: WHEEL_NAMES.map((name) => scene.getObjectByName(name)).filter(
        (o): o is Object3D => Boolean(o),
      ),
      body: scene.getObjectByName("body"),
      rim: prepareCar(scene),
    };
  }, [scene]);

  // Reduced motion stops the wheels: sharp, still spokes again.
  useEffect(() => {
    const { rim } = parts.current;
    if (!animate && rim) rim.uBlur.value = 0;
  }, [animate]);

  useFrame((state, delta) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    // The model faces +z; it is rotated 180 degrees, so a positive spin rolls forward (-z).
    const spin = drive.distance / WHEEL_RADIUS;
    const { wheels, body, rim } = parts.current;
    // Per-frame mutation of scene objects is the R3F pattern; nothing here feeds React state.
    // eslint-disable-next-line react-hooks/immutability
    for (const wheel of wheels) wheel.rotation.x = spin;
    // The wheels blur while the drive runs and sharpen when it stops; they
    // follow the real pace, which the visitor's push raises (DriveClock).
    const speed = wheelSpeed.current;
    const target = wheelAngularSpeed(drive.distance - speed.distance, delta, WHEEL_RADIUS);
    speed.angular += (target - speed.angular) * Math.min(1, delta / SPEED_SMOOTHING);
    speed.distance = drive.distance;
    if (rim) rim.uBlur.value = blurAmount(speed.angular);
    if (ride.current) {
      ride.current.position.y = Math.sin(t * 2.3) * 0.01 + Math.sin(t * 6.1) * 0.004;
      ride.current.rotation.z = Math.sin(t * 0.8) * 0.004;
      ride.current.rotation.x = Math.sin(t * 1.7) * 0.003;
      if (body) body.position.y = ride.current.position.y / CAR_MODEL.scale;
    }
  });

  return (
    <group position={[CAR_POSITION.x, CAR_POSITION.y, CAR_POSITION.z]}>
      <primitive object={scene} scale={CAR_MODEL.scale} rotation-y={Math.PI} />
      <group ref={ride}>
        <Driver animate={animate} tier={tier} />
      </group>
      {/* Soft contact shadow (radial, no hard rectangle), just above the asphalt. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.015} renderOrder={2}>
        <planeGeometry args={[3.0, 6.0]} />
        <shaderMaterial
          uniforms={shadowUniforms}
          vertexShader={softDiscVertexShader}
          fragmentShader={softDiscFragmentShader}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}
