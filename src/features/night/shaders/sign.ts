/**
 * Self-lit signage from a canvas texture (neon faces, lit glass, LED-free
 * nameplates): the art's colour times a level, HDR so the tubes bloom, and
 * a share of the fog. Texels with alpha under 0.5 are cut out.
 */
export const signVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const signFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uLevel;
  uniform float uIntensity;
  uniform float uFogAmount;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vec4 art = texture2D(uMap, vUv);
    if (art.a < 0.5) discard;
    // Bright texels (the tubes) go HDR; the dark enamel stays dark.
    float glow = max(max(art.r, art.g), art.b);
    vec3 color = art.rgb * mix(1.0, uIntensity, glow * glow) * uLevel;
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * uFogAmount;
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
