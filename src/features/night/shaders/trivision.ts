import { floodChunk } from "./board";

/**
 * The trivision prisms: one instanced triangular prism per slice. Each
 * prism turns about its own vertical axis by `aAngle` (written every frame
 * from trivision.ts); a face shows its row of the atlas (Naturgy, Pangea,
 * Telpark) at its slice. Lit by the catwalk's sodium floods, and darkened
 * as it turns away from the street, so a turning board shows its sawtooth.
 * Faces stay under the bloom threshold: the art never smears.
 */
export const trivisionVertexShader = /* glsl */ `
  attribute float aFace;
  attribute float aSlice;
  attribute float aAngle;
  uniform float uSlices;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    float c = cos(-aAngle);
    float s = sin(-aAngle);
    vec3 p = position;
    vec3 n = normal;
    p.xz = vec2(c * p.x + s * p.z, -s * p.x + c * p.z);
    n.xz = vec2(c * n.x + s * n.z, -s * n.x + c * n.z);
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * n);
    vUv = vec2((aSlice + uv.x) / uSlices, (2.0 - aFace + uv.y) / 3.0);
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const trivisionFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uAmbient;
  uniform float uLift;
  uniform vec3 uFront;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${floodChunk}
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 art = texture2D(uMap, vUv).rgb;
    float facing = max(dot(n, uFront), 0.0);
    vec3 light = (uAmbient + floods(vWorld, n) * uLift) * (0.25 + 0.75 * facing * facing);
    vec3 color = min(art * light, vec3(0.75));
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
