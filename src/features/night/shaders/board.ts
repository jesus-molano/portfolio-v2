/**
 * Printed boards at night (the army poster, the trivision faces, the paste-up
 * wall): the art from a canvas texture, lit by up to four analytic floods
 * (spot cones: position, direction, colour, level) over a violet ambient,
 * plus an emissive share for art that glows on its own. No real lights,
 * so the light count never changes and nothing recompiles at a cut.
 */
export const boardVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vFogDepth;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/** The flood term, shared by the boards and their structures. */
export const floodChunk = /* glsl */ `
  uniform vec3 uFloodPos[4];
  uniform vec3 uFloodDir[4];
  uniform vec3 uFloodColor[4];
  uniform float uFloodLevel[4];
  uniform float uFloodCos[2];

  vec3 floods(vec3 world, vec3 normal) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      vec3 L = uFloodPos[i] - world;
      float d = max(length(L), 1e-3);
      vec3 l = L / d;
      float facing = max(dot(normal, l), 0.0);
      float cone = smoothstep(uFloodCos[0], uFloodCos[1], dot(-l, uFloodDir[i]));
      sum += uFloodColor[i] * uFloodLevel[i] * facing * cone / (1.0 + 0.04 * d * d);
    }
    return sum;
  }
`;

export const boardFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uAmbient;
  uniform float uEmissive;
  uniform float uLift;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${floodChunk}
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vFogDepth;

  void main() {
    vec4 art = texture2D(uMap, vUv);
    if (art.a < 0.5) discard;
    vec3 n = normalize(vNormal);
    vec3 light = uAmbient + floods(vWorld, n) * uLift;
    vec3 color = art.rgb * light + art.rgb * uEmissive;
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

/** Untextured structure (posts, truss, frames) under the same floods. */
export const structureFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAmbient;
  uniform vec3 uRim;
  uniform float uLift;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${floodChunk}
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vFogDepth;

  void main() {
    vec3 n = normalize(vNormal);
    // Upward faces catch the city's pink glow.
    float upward = max(n.y, 0.0);
    vec3 color = uColor * (uAmbient + floods(vWorld, n) * uLift) + uRim * upward * 0.5;
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
