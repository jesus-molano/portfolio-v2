import { UniformsLib, UniformsUtils } from "three";

/**
 * Uniforms for the glow and billboard shaders: an intensity on top of the
 * instance colours, and the share (0..1) of the scene fog they take.
 */
export function createGlowUniforms(fogAmount: number, intensity = 1) {
  return UniformsUtils.merge([
    UniformsLib.fog,
    { uIntensity: { value: intensity }, uFogAmount: { value: fogAmount } },
  ]);
}

/**
 * Self-lit instances (neon bands, lit windows, lamp heads) that keep part
 * of their colour through the haze: `uFogAmount` is the share of the scene
 * fog they take, so a far neon line still reads. Colours above 1 bloom.
 */
export const glowVertexShader = /* glsl */ `
  varying vec3 vColor;
  varying float vFogDepth;

  void main() {
    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif
    vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const glowFragmentShader = /* glsl */ `
  uniform float uIntensity;
  uniform float uFogAmount;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vColor;
  varying float vFogDepth;

  void main() {
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * uFogAmount;
    gl_FragColor = vec4(mix(vColor * uIntensity, fogColor, fogFactor), 1.0);
  }
`;

/**
 * Billboard faces: one instanced plane per board, each showing its own
 * rectangle of the shared text atlas (`aUvRect`: u0, v0, u1, v1) at its own
 * level (`aLevel`: 1 lit, lower while its tubes are off).
 */
export const billboardVertexShader = /* glsl */ `
  attribute vec4 aUvRect;
  attribute float aLevel;
  varying vec2 vUv;
  varying float vLevel;
  varying float vFogDepth;

  void main() {
    vUv = vec2(mix(aUvRect.x, aUvRect.z, uv.x), mix(aUvRect.y, aUvRect.w, uv.y));
    vLevel = aLevel;
    vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const billboardFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uIntensity;
  uniform float uFogAmount;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying float vLevel;
  varying float vFogDepth;

  void main() {
    vec3 color = texture2D(uMap, vUv).rgb * uIntensity * vLevel;
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * uFogAmount;
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
