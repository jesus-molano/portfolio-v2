import { skyGradientChunk } from "./sky";

export const roadVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Wet asphalt causeway. Under the paint: asphalt with old and new patches
 * and darker tyre tracks, and a wet film that mirrors the world above it:
 *
 * - the sky (skyGradientChunk from shaders/sky.ts, the dome's own gradient) along the view ray mirrored about +Y, weighted by
 *   Schlick's Fresnel (F0 = 0.04), so the road is dark underfoot and turns
 *   into a mirror of the afterglow toward the horizon;
 * - roughness from low-frequency patch noise streaming with the road
 *   (worldZ - uDistance): standing water is a near mirror, damp asphalt a
 *   duller one, the tyre tracks the driest;
 * - glossy streaks of the lights: the sun, every lamp head (the rows repeat
 *   every uLamp.z metres per side, phases in uLampPhase) and the hero's
 *   tail lights. A streak is an anisotropic lobe around the mirrored ray,
 *   narrow across and long along the view, so each light draws the long
 *   vertical stroke a wet road gives it, from wherever the camera is.
 *
 * The lane paint is matte: it takes no reflection. Every normalize() is
 * guarded and there is no pow() of a base that can be negative.
 */
export const roadFragmentShader = /* glsl */ `
  uniform float uDistance;
  uniform vec3 uAsphalt;
  uniform vec3 uLine;
  uniform vec3 uEdge;
  uniform vec3 uSunPosition;
  uniform vec3 uSunGlint;
  uniform vec3 uLampGlint;
  uniform vec3 uTailGlint;
  // x: |x| of the lamp heads, y: their height, z: spacing along one side.
  uniform vec3 uLamp;
  // z of one lamp head on the left (x) and right (y) side.
  uniform vec2 uLampPhase;
  // The z range the lamps stand in (front, back).
  uniform vec2 uLampWindow;
  uniform vec3 uTailLeft;
  uniform vec3 uTailRight;
  uniform float uReflection;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vFogDepth;
  ${skyGradientChunk}

  float roadHash(vec2 p) {
    vec3 q = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  // Value noise in [0, 1], quintic, no sin(): it never bands.
  float roadNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = roadHash(i);
    float b = roadHash(i + vec2(1.0, 0.0));
    float c = roadHash(i + vec2(0.0, 1.0));
    float d = roadHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Glossy lobe between the mirrored view ray r and the unit direction l to
  // a light: across is the angular half width sideways, along the half
  // width in elevation (much larger: the vertical streak).
  float streak(vec3 r, vec3 l, float across, float along) {
    float rLength = length(r.xz);
    float lLength = length(l.xz);
    if (rLength < 1e-4 || lLength < 1e-4) return 0.0;
    vec2 a = r.xz / rLength;
    vec2 b = l.xz / lLength;
    if (dot(a, b) <= 0.0) return 0.0;
    float side = (a.x * b.y - a.y * b.x) / across;
    float rise = (r.y - l.y) / along;
    return exp(-side * side - rise * rise);
  }

  // Unit vector from p toward q; straight up if they meet.
  vec3 towards(vec3 p, vec3 q) {
    vec3 d = q - p;
    float len = length(d);
    return len > 1e-4 ? d / len : vec3(0.0, 1.0, 0.0);
  }

  // The streak of the lamp head on one side (headX carries its sign) whose
  // mirror image lines up with this point: walk from p away from the
  // camera to the row of heads and take the nearest one there.
  // cameraPosition is three.js' built-in uniform.
  float lampStreak(vec3 p, vec3 r, vec2 away, float headX, float phase, float across, float along) {
    if (abs(away.x) < 1e-3) return 0.0;
    float t = (headX - p.x) / away.x;
    if (t <= 0.0) return 0.0;
    float zHit = p.z + t * away.y;
    float z = phase + uLamp.z * floor((zHit - phase) / uLamp.z + 0.5);
    if (z < uLampWindow.x || z > uLampWindow.y) return 0.0;
    vec3 head = vec3(headX, uLamp.y, z);
    // A far head is a smaller source: its blurred image is dimmer.
    vec3 seen = (head - cameraPosition) / 60.0;
    float near = 1.0 / (1.0 + dot(seen, seen));
    return streak(r, towards(p, head), across, along) * near;
  }

  void main() {
    float across = vUv.x * 2.0 - 1.0;
    // Four lanes, US style. x in metres across the 16 m road.
    float x = across * 8.0;
    // Ground-fixed patterns stream with the drive like the lane dashes.
    float zg = vWorld.z - uDistance;

    // Asphalt: smooth patches of older and newer surface, no per-cell noise.
    float patches = sin(zg * 0.045 + sin(vWorld.x * 0.21) * 1.5) * sin(zg * 0.017 + 1.7);
    float shade = 1.0 + patches * 0.05;
    // Darker tyre tracks along each of the four 4 m lanes. Squares, not
    // pow(): pow() of a negative base is NaN in GLSL.
    float lanePos = fract((vWorld.x + 8.0) / 4.0);
    float trackA = (lanePos - 0.3) * 14.0;
    float trackB = (lanePos - 0.7) * 14.0;
    float tracks = exp(-trackA * trackA) + exp(-trackB * trackB);
    shade -= tracks * 0.06;
    vec3 base = uAsphalt * shade;

    // Lane paint. The car drives toward -z, so the dashes slide toward +z.
    float dash = step(0.6, fract(zg / 12.0));
    float centre = 1.0 - smoothstep(0.06, 0.1, abs(abs(x) - 0.18));
    float divider = (1.0 - smoothstep(0.06, 0.1, abs(abs(x) - 4.0))) * dash;
    float edgeLine = 1.0 - smoothstep(0.07, 0.11, abs(abs(x) - 7.6));
    vec3 paintColor = mix(uEdge, uLine, centre);
    float paint = max(centre * 0.95, max(divider, edgeLine) * 0.85);

    // Wetness: big streaming patches of standing water between damp,
    // duller asphalt; the tyre tracks are the driest.
    float puddles = roadNoise(vec2(vWorld.x * 0.25, zg * 0.08)) * 0.7
      + roadNoise(vec2(vWorld.x * 0.7 + 7.0, zg * 0.25)) * 0.3;
    float rough = mix(0.04, 0.62, smoothstep(0.32, 0.62, puddles));
    rough = min(0.8, rough + tracks * 0.2);
    // Far off, a pixel covers many patches: they average out.
    float eyeDistance = length(vWorld.xz - cameraPosition.xz);
    rough = mix(rough, 0.3, smoothstep(40.0, 160.0, eyeDistance));
    float gloss = 1.0 - rough;

    // View and the mirrored view ray (the road's normal is +Y).
    vec3 view = towards(vWorld, cameraPosition);
    vec3 mirrored = vec3(-view.x, view.y, -view.z);
    float facing = clamp(view.y, 0.0, 1.0);
    float m = 1.0 - facing;
    float m2 = m * m;
    // Schlick with F0 = 0.04; a rough film never reaches a full mirror.
    float fresnel = 0.04 + (mix(1.0, 0.55, rough) - 0.04) * m2 * m2 * m;

    // The sky it mirrors. Roughness widens the lobe; leaning the ray toward
    // the zenith stands in for averaging over it.
    vec3 blurred = mirrored + vec3(0.0, 0.02 + rough * 0.4, 0.0);
    float blurredLength = length(blurred);
    blurred = blurredLength > 1e-4 ? blurred / blurredLength : vec3(0.0, 1.0, 0.0);
    vec3 toSun = towards(vWorld, uSunPosition);
    vec3 sky = skyGradient(blurred, toSun);

    // Streaks: narrow on standing water, wider and dimmer on damp asphalt.
    vec3 glints = uSunGlint * streak(mirrored, toSun, 0.03 + rough * 0.06, 0.1 + rough * 0.25);
    vec2 away = vWorld.xz - cameraPosition.xz;
    float lampAcross = 0.006 + rough * 0.012;
    float lampAlong = 0.06 + rough * 0.2;
    float lamps = lampStreak(vWorld, mirrored, away, -uLamp.x, uLampPhase.x, lampAcross, lampAlong)
      + lampStreak(vWorld, mirrored, away, uLamp.x, uLampPhase.y, lampAcross, lampAlong);
    glints += uLampGlint * lamps;
    // The tail lights shine backward only: nothing in front of them.
    float behind = smoothstep(uTailLeft.z, uTailLeft.z + 0.6, vWorld.z);
    float tailAcross = 0.012 + rough * 0.015;
    float tailAlong = 0.05 + rough * 0.15;
    float tails = streak(mirrored, towards(vWorld, uTailLeft), tailAcross, tailAlong)
      + streak(mirrored, towards(vWorld, uTailRight), tailAcross, tailAlong);
    glints += uTailGlint * tails * behind;
    glints *= gloss * gloss * (0.25 + fresnel);

    vec3 color = mix(base, sky * uReflection, fresnel) + glints;
    // Paint is matte: no reflection on the lines.
    color = mix(color, paintColor, paint);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
