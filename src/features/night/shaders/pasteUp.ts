import { spotLightGlsl } from "./spotLight";

/**
 * The Logixs wall and its paper. One light function for both: a violet
 * ambient, the wall lantern's warm pool, the crossing light's red spill
 * and, when the board is armed, a police helicopter's searchlight hunting
 * along the wall (searchlight.ts, spotLight.ts): a cone from the lamp
 * over the street, its spot on the wall a hot core, an even body and a
 * crisp rim, stretched upright where the steep beam meets the brick. The
 * brick is procedural; plaster above it.
 */
const wallLight = /* glsl */ `
  uniform vec3 uAmbient;
  uniform vec3 uLanternPos;
  uniform vec3 uLanternColor;
  uniform vec3 uSignalPos;
  uniform vec3 uSignalColor;
  ${spotLightGlsl}

  vec3 wallLight(vec3 world) {
    vec3 L = uLanternPos - world;
    float d2 = max(dot(L, L), 1e-3);
    vec3 light = uAmbient + uLanternColor * (5.0 / (1.0 + 0.6 * d2));
    vec3 S = uSignalPos - world;
    light += uSignalColor * (2.2 / (1.0 + dot(S, S)));
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

  // Value noise, smoothly interpolated between the cells' hashes.
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x);
    float b = mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x);
    return mix(a, b, u.y);
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
      // Damp and soot that run into each other: one hash per half-metre cell
      // painted the plaster as a grid of flat squares, which a phone's close
      // shot read as a low-resolution texture.
      float stain = (valueNoise(vWorld.xy * 1.3) * 0.65 + valueNoise(vWorld.xy * 4.1 + 7.0) * 0.35) * 0.08;
      albedo = vec3(0.62, 0.55, 0.62) - stain;
    }
    vec3 color = albedo * (wallLight(vWorld) + spotLight(vWorld));
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

/**
 * The posters: instanced planes, each showing its own rectangle of the
 * atlas (`aUvRect`), standing 3 mm per layer off the wall. A loose corner
 * lifts (`aLift`) and flutters on time; torn paper is cut out by the
 * atlas alpha so the older bill beneath shows. The fresh sheet (`aFresh`)
 * shows only down to `uReveal` of its height, lifted where it is still
 * being laid, and shines with wet paste while `uWet` lasts.
 */
export const pasteUpVertexShader = /* glsl */ `
  attribute vec4 aUvRect;
  attribute float aLift;
  attribute float aSeed;
  attribute float aFresh;
  uniform float uTime;
  uniform float uLiftExtra;
  uniform float uReveal;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vFresh;
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
    // The fresh sheet stands off the wall just above the brush, where it is still being laid down.
    float edge = 1.0 - uReveal;
    float laying = aFresh * (1.0 - smoothstep(0.0, 0.12, local.y - edge)) * step(edge, local.y) * step(uReveal, 0.999);
    p.z += laying * 0.06;
    vLocal = local;
    vFresh = aFresh;
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
  uniform float uReveal;
  uniform float uWet;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${wallLight}
  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vFresh;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    // The fresh sheet exists only as far down as the brush has laid it.
    if (vFresh > 0.5 && vLocal.y < 1.0 - uReveal) discard;
    vec4 art = texture2D(uMap, vUv);
    if (art.a < 0.5) discard;
    // Day-glo stays under the bloom threshold: the bills read, only bulbs bloom.
    // In the searchlight the paper goes over it, as hot as a xenon lamp makes
    // it: past the knee its brightest channel rolls off on a soft shoulder
    // (toward 0.8 + 2.6) and the others keep their share of it, so
    // the print keeps its colours and stays readable, the core still hotter
    // than the body, and tone mapping and the bloom take it from there.
    // Unlit, the colour is never over the knee and the shoulder is a no-op.
    vec3 color = min(art.rgb * wallLight(vWorld), vec3(0.8));
    color += art.rgb * spotLight(vWorld);
    float peak = max(max(color.r, color.g), color.b);
    if (peak > 0.8) {
      float over = peak - 0.8;
      color *= (0.8 + over / (1.0 + over / 2.6)) / peak;
    }
    // Wet paste: the brush's diagonal strokes catch the lantern until the sheet dries.
    float strokes = 0.5 + 0.5 * sin((vLocal.x * 3.0 + vLocal.y * 1.4) * 7.0 + sin(vLocal.y * 11.0) * 1.2);
    color += vFresh * uWet * (0.03 + 0.04 * strokes * strokes) * vec3(1.0, 0.86, 0.7);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
