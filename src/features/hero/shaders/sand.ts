export const sandVertexShader = /* glsl */ `
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

/**
 * Beach sand, measured in metres from its inland edge: the curb for the
 * causeway strips (uCity = 0, patterns stream at z - uDistance), the
 * seawall for the city beach (uCity = 1, static, along x).
 *
 * From the inland edge out: dry sand with drifting tone, wind ripples and a
 * few dark tufts of beach grass near the curb; a broken wrack line at the
 * high-water mark; a band of wet sand that mirrors the sky; the swash with
 * its foam line running up and back; then shallow water over sand that
 * fades into the sea (the water mesh shows through).
 *
 * The waterline is `uShoreMean` plus two sines (uShoreAmp, uShoreFreq and
 * the phases of each side), plus the static flare near the landfall: the
 * same function as shoreDistance() and shoreFlare() in scene/roadside.ts,
 * so the props stand on sand.
 */
export const sandFragmentShader = /* glsl */ `
  uniform vec3 uSand;
  uniform vec3 uSandShade;
  uniform vec3 uWetSand;
  uniform vec3 uWrack;
  uniform vec3 uGrass;
  uniform vec3 uFoam;
  uniform vec3 uShallow;
  uniform vec3 uSheen;
  uniform float uTime;
  uniform float uDistance;
  uniform float uCity;
  uniform float uInner;
  uniform float uShoreMean;
  uniform vec2 uShoreAmp;
  uniform vec2 uShoreFreq;
  uniform vec2 uPhaseLeft;
  uniform vec2 uPhaseRight;
  uniform vec3 uFlare;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vWorld;
  varying float vFogDepth;

  float sandHash(vec2 p) {
    vec3 q = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  // Value noise in [0, 1], quintic, no sin(): it never bands.
  float sandNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = sandHash(i);
    float b = sandHash(i + vec2(1.0, 0.0));
    float c = sandHash(i + vec2(0.0, 1.0));
    float d = sandHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    bool city = uCity > 0.5;
    // across: metres from the inland edge; along: metres along the beach.
    float across = city ? vWorld.z - uInner : abs(vWorld.x) - uInner;
    float along = city ? vWorld.x : vWorld.z - uDistance;
    vec2 phase = vWorld.x < 0.0 ? uPhaseLeft : uPhaseRight;
    float shore = uShoreMean
      + uShoreAmp.x * sin(uShoreFreq.x * along + phase.x)
      + uShoreAmp.y * sin(uShoreFreq.y * along + phase.y);
    // Static flare into the city beach near the landfall (world z).
    shore += uFlare.z * (1.0 - smoothstep(uFlare.x, uFlare.y, vWorld.z));

    // The swash runs up the beach and back, unevenly along it.
    float swash = sin(uTime * 0.55 + along * 0.045) * 0.4 + sin(uTime * 0.93 + along * 0.13 + 1.7) * 0.18;
    // Metres inland of the water's edge (negative: under the water).
    float inland = shore + swash - across;
    // Metres inland of the mean shoreline: the wet band does not move.
    float dryness = shore - across;

    vec2 p = vec2(along, across);
    float broad = sandNoise(p * vec2(0.045, 0.11));
    float fine = sandNoise(p * vec2(0.23, 0.31) + 17.0);

    // Dry sand, drifting between sunlit and duskier patches.
    float mottle = sandNoise(p * vec2(0.42, 0.55) + 9.0);
    float speck = sandNoise(p * vec2(1.7, 2.1) + 41.0);
    vec3 color = mix(uSand, uSandShade, smoothstep(0.2, 0.9, broad) * 0.6 + mottle * 0.3 + fine * 0.14 + speck * 0.08 - 0.12);
    // Trodden, darker sand along the strip, lighter wind-blown crests.
    color *= 0.95 + mottle * 0.1;
    // Wind ripples: fine crests across the wind, only where it is dry.
    float ripple = sin(along * 2.3 + across * 0.7 + fine * 3.0) * 0.5 + 0.5;
    color *= 1.0 - ripple * ripple * 0.08 * smoothstep(3.0, 5.0, dryness);
    // Sparse tufts of beach grass in the dry sand by the curb.
    float grass = smoothstep(0.7, 0.82, sandNoise(p * vec2(0.9, 1.3) + 3.0))
      * smoothstep(0.45, 0.7, broad)
      * (1.0 - smoothstep(2.0, 4.5, across)) * smoothstep(0.5, 1.1, across);
    color = mix(color, uGrass, grass * 0.45 * (1.0 - uCity));
    // The curb (or the seawall) shades the first half metre.
    color *= mix(0.84, 1.0, smoothstep(0.0, 0.7, across));

    // Wrack line: dried seaweed at the high-water mark, broken into clumps.
    float wrackAt = 2.6 + (broad - 0.5) * 0.8;
    float wrack = (1.0 - smoothstep(0.0, 0.45, abs(dryness - wrackAt)))
      * smoothstep(0.5, 0.8, sandNoise(vec2(along * 0.6, across * 1.2)));
    color = mix(color, uWrack, wrack * 0.35);

    // Wet sand: darker and rosier toward the water, mirroring the sky at
    // grazing angles (a Schlick-like falloff, as products: no pow()).
    vec3 toEye = cameraPosition - vWorld;
    float eyeLength = length(toEye);
    float facing = eyeLength > 1e-4 ? clamp(toEye.y / eyeLength, 0.0, 1.0) : 1.0;
    float grazing = 1.0 - facing;
    float sheen = grazing * grazing * grazing;
    float wet = 1.0 - smoothstep(0.0, 2.2, dryness - (broad - 0.5) * 0.6);
    color = mix(color, mix(uWetSand, uSheen, sheen * 0.45), wet);
    // Glossy where the last wave just drew back.
    float glossy = (1.0 - smoothstep(0.0, 0.9, inland)) * step(0.0, inland);
    color = mix(color, uSheen, glossy * (0.15 + sheen * 0.35));

    // Foam: a bright line at the edge and lace in the backwash behind it.
    float lace = smoothstep(0.55, 0.72, sandNoise(vec2(along * 0.9, inland * 2.2) + uTime * vec2(0.1, 0.35)));
    float laceBand = (1.0 - smoothstep(0.0, 1.6, -inland)) * step(inland, 0.0);
    float edge = 1.0 - smoothstep(0.0, 0.16, abs(inland + 0.05));
    float foam = max(edge * 0.9, lace * laceBand * 0.55);

    // Shallow water over the sand, fading into the sea.
    float under = smoothstep(0.0, 0.8, -inland);
    color = mix(color, mix(uShallow, uSheen, sheen * 0.4), under * 0.7);
    color = mix(color, uFoam, foam);
    float alpha = 1.0 - smoothstep(0.6, 4.5, -inland);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), alpha);
  }
`;
