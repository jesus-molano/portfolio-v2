import { Color, UniformsLib, UniformsUtils, type Vector3 } from "three";
import { palette } from "@/design/tokens";

/**
 * The city's silhouette look: deep violet at street level, lilac at the
 * top. Shared by the skyline and the landmark so they read as one city.
 */
export const SILHOUETTE = { bottom: palette.ink, top: palette.lilac } as const;

type SilhouetteOptions = {
  /** Height (m) where the gradient reaches the top colour. */
  height: number;
  /** Unit vector toward the sun, seen from the city. */
  sun: Vector3;
  /** Share of the scene fog it takes: 1 is full aerial perspective. */
  fogAmount?: number;
  /** Strength of the warm line on the sun-side and top edges. */
  rim?: number;
  /** Width of that line, in metres. */
  rimWidth?: number;
};

/**
 * Uniforms for the silhouette shader. The sun lights the faces that look at
 * it (walls on its side, roofs) and draws a thin warm rim on the sun-side
 * edge and the top edge of every face that looks at the causeway; with the
 * sun dead ahead only the top edges catch it.
 */
export function createSilhouetteUniforms({
  height,
  sun,
  fogAmount = 1,
  rim = 0.35,
  rimWidth = 0.8,
}: SilhouetteOptions) {
  return UniformsUtils.merge([
    UniformsLib.fog,
    {
      uBottom: { value: new Color(SILHOUETTE.bottom) },
      uTop: { value: new Color(SILHOUETTE.top) },
      uHeight: { value: height },
      uSunDir: { value: sun.clone() },
      uSunSide: { value: Math.sign(sun.x) },
      uSideRim: { value: Math.min(1, Math.abs(sun.x) / 0.3) },
      uSunColor: { value: new Color(palette.orange) },
      uRimColor: { value: new Color(palette.amber) },
      uRim: { value: rim },
      uRimWidth: { value: rimWidth },
      uFogAmount: { value: fogAmount },
    },
  ]);
}

/**
 * Instanced, unlit silhouette with a vertical tint and scene fog.
 * Instances are axis-aligned boxes scaled per instance, so the normal
 * attribute is already the world normal and the lengths of the matrix
 * columns are the box size.
 */
export const silhouetteVertexShader = /* glsl */ `
  uniform float uSunSide;
  varying float vFogDepth;
  varying float vWorldY;
  varying vec3 vFaceNormal;
  varying vec2 vEdge;

  void main() {
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldY = worldPosition.y;
    vFaceNormal = normal;
    vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
    // Metres from the face's sun-side vertical edge and from its top edge.
    vEdge = vec2((0.5 - uSunSide * position.x) * size.x, (0.5 - position.y) * size.y);
    vec4 mvPosition = viewMatrix * worldPosition;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const silhouetteFragmentShader = /* glsl */ `
  uniform vec3 uBottom;
  uniform vec3 uTop;
  uniform float uHeight;
  uniform vec3 uSunDir;
  uniform float uSideRim;
  uniform vec3 uSunColor;
  uniform vec3 uRimColor;
  uniform float uRim;
  uniform float uRimWidth;
  uniform float uFogAmount;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying float vFogDepth;
  varying float vWorldY;
  varying vec3 vFaceNormal;
  varying vec2 vEdge;

  void main() {
    float t = clamp(vWorldY / uHeight, 0.0, 1.0);
    vec3 color = mix(uBottom, uTop, t);
    // Warm light on the faces that look at the low sun.
    color += uSunColor * max(dot(vFaceNormal, uSunDir), 0.0) * 0.35;
    // Rim: a thin warm line on the sun-side edge of the faces toward the
    // causeway, and on the top edge of every wall.
    float front = step(0.5, vFaceNormal.z);
    float wall = 1.0 - step(0.5, abs(vFaceNormal.y));
    float side = front * uSideRim * (1.0 - smoothstep(0.0, uRimWidth, vEdge.x));
    float top = wall * (1.0 - smoothstep(0.0, uRimWidth, vEdge.y)) * 0.6;
    color += uRimColor * max(side, top) * uRim;
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * uFogAmount;
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
