import { skyGradientChunk } from "./sky";

export const waterVertexShader = /* glsl */ `
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
 * Stylised dusk sea: a violet body that turns pink toward the horizon, a
 * Fresnel reflection of our own sky (the dome's gradient, skyGradientChunk)
 * and the sun's glitter path. The surface normal comes from three octaves
 * of gradient noise with analytic derivatives in (x, worldZ - uDistance),
 * so the waves stream with the drive like the rest of the ground. The
 * glitter is a specular reflection of uGlintSource, the sun moved left
 * (Water.tsx): it lies on the line from the camera toward that point,
 * over the open water left of the causeway, since the true sun's path runs
 * under the island. The sky reflection still reads the true sun.
 * WATER_FINE adds the finest octave (high tier).
 */
export const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDistance;
  uniform vec3 uSunPosition;
  uniform vec3 uGlintSource;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec3 uGlint;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vWorld;
  varying float vFogDepth;
  ${skyGradientChunk}

  vec2 waveHash(vec2 i) {
    vec3 p = fract(i.xyx * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xx + p.yz) * p.zy) * 2.0 - 1.0;
  }

  // Gradient noise with its derivatives: x = value, yz = d/dp.
  vec3 waveNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    vec2 ga = waveHash(i);
    vec2 gb = waveHash(i + vec2(1.0, 0.0));
    vec2 gc = waveHash(i + vec2(0.0, 1.0));
    vec2 gd = waveHash(i + vec2(1.0, 1.0));
    float va = dot(ga, f);
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));
    float k = va - vb - vc + vd;
    float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
    vec2 slope = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
      + du * (u.yx * k + vec2(vb, vc) - va);
    return vec3(value, slope);
  }

  void main() {
    vec3 toEye = cameraPosition - vWorld;
    float eyeDistance = length(toEye);
    vec3 view = eyeDistance > 1e-4 ? toEye / eyeDistance : vec3(0.0, 1.0, 0.0);
    float dist = length(vWorld.xz - cameraPosition.xz);
    float t = smoothstep(10.0, 480.0, dist);

    // Wave slopes in the streamed frame. Each octave adds A * f * grad(n):
    // long swells across the wind, a rotated chop, a fine ripple that
    // fades with distance so it never shimmers.
    vec2 p = vec2(vWorld.x, vWorld.z - uDistance);
    vec2 slope = vec2(0.0);
    vec2 f1 = vec2(0.07, 0.15);
    vec3 n1 = waveNoise(p * f1 + vec2(uTime * 0.03, uTime * 0.09));
    slope += n1.yz * f1 * 0.55;
    mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
    vec3 n2 = waveNoise(turn * p * 0.38 + vec2(-uTime * 0.12, uTime * 0.2));
    // d/dp n(M p) = transpose(M) grad n.
    slope += (n2.yz * turn) * 0.38 * 0.13 * (1.0 - smoothstep(180.0, 520.0, dist) * 0.6);
    #ifdef WATER_FINE
      vec3 n3 = waveNoise(p * vec2(1.3, 1.1) + vec2(uTime * 0.35, -uTime * 0.25));
      slope += n3.yz * vec2(1.3, 1.1) * 0.032 * (1.0 - smoothstep(30.0, 140.0, dist));
    #endif
    // The y component is 1, so this vector is never zero.
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));

    // Body: deep violet up close, pink toward the horizon, a faint swell.
    vec3 body = mix(uNear, uFar, pow(t, 0.7));
    body *= 0.94 + 0.12 * n1.x;

    // Fresnel (Schlick, water F0 = 0.02), as products: no pow().
    float facing = clamp(dot(normal, view), 0.0, 1.0);
    float m = 1.0 - facing;
    float m2 = m * m;
    float fresnel = 0.02 + 0.98 * m2 * m2 * m;

    // The sky the surface mirrors. Waves can tip the reflection below the
    // horizon at grazing angles; fold it back up and guard the length.
    vec3 reflected = reflect(-view, normal);
    reflected.y = abs(reflected.y);
    float reflectedLength = length(reflected);
    reflected = reflectedLength > 1e-4 ? reflected / reflectedLength : vec3(0.0, 1.0, 0.0);
    vec3 toSunRaw = uSunPosition - vWorld;
    float sunLength = length(toSunRaw);
    vec3 toSun = sunLength > 1e-4 ? toSunRaw / sunLength : vec3(0.0, 1.0, 0.0);
    vec3 sky = skyGradient(reflected, toSun);
    vec3 color = mix(body, sky, fresnel);

    // Sun glitter: the low sun mirrored by each facet (exp lobes, no
    // pow()). Sharp sparkles up close; far away the facets are smaller
    // than a pixel, so the lobe widens into a smooth path. The facets
    // mirror uGlintSource, the sun moved left over the open sea (see
    // Water.tsx): the true path runs under the island in every shot.
    vec3 toGlintRaw = uGlintSource - vWorld;
    float glintLength = length(toGlintRaw);
    vec3 toGlint = glintLength > 1e-4 ? toGlintRaw / glintLength : toSun;
    float cosSun = dot(reflected, toGlint);
    float sharpness = mix(900.0, 90.0, smoothstep(20.0, 320.0, dist));
    float sparkle = exp((cosSun - 1.0) * sharpness);
    float sheen = exp((cosSun - 1.0) * 14.0);
    vec3 glitter = uGlint * (sparkle * 2.6 + sheen * 0.1) * (0.3 + fresnel);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    color = mix(color, fogColor, fogFactor);
    // The glints shine through the haze more than the water does.
    color += glitter * (1.0 - fogFactor * 0.6);
    gl_FragColor = vec4(color, 1.0);
  }
`;
