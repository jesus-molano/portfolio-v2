/**
 * The Logixs wall and its paper. One light function for both: a violet
 * ambient, the wall lantern's warm pool, the crossing light's red spill
 * and, when the board is armed, a passing car's headlights raking across
 * the run as a slanted band. The brick is procedural; plaster above it.
 */
const wallLight = /* glsl */ `
  uniform vec3 uAmbient;
  uniform vec3 uLanternPos;
  uniform vec3 uLanternColor;
  uniform vec3 uSignalPos;
  uniform vec3 uSignalColor;
  uniform float uSweep;
  uniform float uSweepLevel;

  vec3 wallLight(vec3 world) {
    vec3 L = uLanternPos - world;
    float d2 = max(dot(L, L), 1e-3);
    vec3 light = uAmbient + uLanternColor * (5.0 / (1.0 + 0.6 * d2));
    vec3 S = uSignalPos - world;
    light += uSignalColor * (2.2 / (1.0 + dot(S, S)));
    // The raking headlight sweep: a slanted band moving along x.
    float band = world.x - uSweep + world.y * 0.45;
    light += vec3(1.0, 0.92, 0.8) * uSweepLevel * exp(-band * band * 1.6);
    return light;
  }
`;

export const wallVertexShader = /* glsl */ `
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const wallFragmentShader = /* glsl */ `
  uniform float uBrickTop;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${wallLight}
  varying vec3 vWorld;
  varying float vFogDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 albedo;
    if (vWorld.y < uBrickTop) {
      vec2 b = vec2(vWorld.x / 0.24, vWorld.y / 0.075);
      float row = floor(b.y);
      b.x += mod(row, 2.0) * 0.5;
      vec2 f = fract(b);
      float mortar = max(1.0 - smoothstep(0.0, 0.05, f.x), 1.0 - smoothstep(0.0, 0.14, f.y));
      float tone = hash(floor(b));
      vec3 brick = mix(vec3(0.36, 0.13, 0.12), vec3(0.5, 0.22, 0.17), tone);
      albedo = mix(brick, vec3(0.42, 0.38, 0.4), mortar);
    } else {
      float stain = hash(floor(vWorld.xy * 2.0)) * 0.08;
      albedo = vec3(0.62, 0.55, 0.62) - stain;
    }
    vec3 color = albedo * wallLight(vWorld);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

/**
 * The posters: instanced planes, each showing its own rectangle of the
 * atlas (`aUvRect`), standing 3 mm per layer off the wall. A loose corner
 * lifts (`aLift`) and flutters on time; torn paper is cut out by the
 * atlas alpha so the older bill beneath shows.
 */
export const pasteUpVertexShader = /* glsl */ `
  attribute vec4 aUvRect;
  attribute float aLift;
  attribute float aSeed;
  uniform float uTime;
  uniform float uLiftExtra;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec3 p = position;
    vec2 local = uv;
    float corner = local.x * local.y;
    float curl = (aLift + uLiftExtra * step(0.01, aLift)) * corner * corner;
    float flutter = sin(uTime * 3.1 + aSeed * 6.28) * 0.5 + sin(uTime * 5.3 + aSeed * 3.1) * 0.25;
    p.z += curl * (0.25 + 0.08 * flutter);
    p.x -= curl * 0.05;
    vUv = vec2(mix(aUvRect.x, aUvRect.z, uv.x), mix(aUvRect.y, aUvRect.w, uv.y));
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const pasteUpFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${wallLight}
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec4 art = texture2D(uMap, vUv);
    if (art.a < 0.5) discard;
    // Day-glo stays under the bloom threshold: the bills read, only bulbs bloom.
    vec3 color = min(art.rgb * wallLight(vWorld), vec3(0.8));
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
