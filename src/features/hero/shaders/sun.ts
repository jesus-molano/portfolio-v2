export const sunVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * A soft, atmospheric sun: no retro bands. A bright core, a wide warm glow
 * and a horizon-side darkening where the haze eats the disc.
 */
export const sunFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uRim;
  uniform vec3 uGlow;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p);

    // Compact disc with a soft limb; the sky gradient carries the mood.
    float disc = 1.0 - smoothstep(0.26, 0.31, d);
    vec3 discColor = mix(uCore, uRim, smoothstep(0.05, 0.31, d));
    // Haze eats the lower part of the disc.
    float hazeCut = smoothstep(-0.35, 0.1, p.y);
    discColor = mix(uRim * 0.85, discColor, hazeCut);

    // Soft glow, stronger sideways (atmospheric scattering near the horizon).
    float glow = exp(-d * d * 7.0) * 0.3 + exp(-abs(p.y) * 7.0) * exp(-abs(p.x) * 1.8) * 0.16;
    float breathe = 1.0 + sin(uTime * 0.6) * 0.02;

    vec3 color = discColor * disc * uIntensity * breathe + uGlow * glow;
    float alpha = clamp(disc + glow, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const flareVertexShader = sunVertexShader;

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
