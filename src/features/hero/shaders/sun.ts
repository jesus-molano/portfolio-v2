import { skyCloudsChunk } from "./sky";

export const sunVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * A soft, atmospheric sun: no retro bands. An HDR disc (a hot core, a
 * warmer limb) that the tone mapping rolls off and the bloom haloes, and a
 * faint warm glow around it; the sky dome carries the wide glow. Clouds of
 * the dome that pass in front of the disc dim it (skyCloudCover), so the
 * sun sits behind them, not on top.
 */
export const sunFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uLimb;
  uniform vec3 uHalo;
  uniform vec3 uSunPosition;
  varying vec2 vUv;
  varying vec3 vWorld;
  ${skyCloudsChunk}

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p);

    // Disc with a short soft limb; limb darkening turns the edge warmer.
    float disc = 1.0 - smoothstep(0.27, 0.31, d);
    float limb = smoothstep(0.0, 0.31, d);
    vec3 discColor = mix(uCore, uLimb, limb * limb);
    // The thicker air near the horizon warms the lower half a little.
    discColor = mix(discColor, uLimb, (1.0 - smoothstep(-0.31, 0.1, p.y)) * 0.35);

    // A faint glow just outside the disc; the dome draws the wide one.
    float halo = exp(-d * d * 9.0) * 0.28;
    float breathe = 1.0 + sin(uTime * 0.6) * 0.02;

    vec3 color = discColor * disc * breathe + uHalo * halo;
    float alpha = clamp(disc + halo, 0.0, 1.0);
    // Most of the quad is empty: skip the cloud noise there.
    if (alpha < 0.003) discard;

    // Cloud in front of the sun hides it.
    vec3 view = vWorld - cameraPosition;
    float viewLength = length(view);
    vec3 dir = viewLength > 1e-4 ? view / viewLength : vec3(0.0, 0.0, -1.0);
    vec3 toSunRaw = uSunPosition - cameraPosition;
    float sunLength = length(toSunRaw);
    vec3 toSun = sunLength > 1e-4 ? toSunRaw / sunLength : dir;
    alpha *= 1.0 - skyCloudCover(dir, toSun);

    gl_FragColor = vec4(color, alpha);
  }
`;

export const flareVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Anamorphic horizontal streak crossing the sun. */
export const flareFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float x = abs(vUv.x - 0.5) * 2.0;
    float y = abs(vUv.y - 0.5) * 2.0;
    float streak = exp(-x * x * 4.5) * exp(-y * y * 9.0);
    gl_FragColor = vec4(uColor, streak * uOpacity);
  }
`;
