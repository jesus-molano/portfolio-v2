/**
 * The night dome, centred on the camera: deep violet at the zenith, a
 * magenta city glow at the horizon, sparse stars and a thin moon over the
 * islands. Never black: the darkest value is palette.night.
 */
export const nightSkyVertexShader = /* glsl */ `
  varying vec3 vDir;

  void main() {
    vDir = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // On the far plane, so the dome never hides anything.
    gl_Position.z = gl_Position.w;
  }
`;

export const nightSkyFragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform float uGlowLevel;
  uniform float uStars;
  uniform vec3 uMoonDir;
  uniform float uMoon;
  varying vec3 vDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float len = max(length(vDir), 1e-4);
    vec3 dir = vDir / len;
    float h = clamp(dir.y, -0.2, 1.0);
    float up = smoothstep(0.0, 0.55, h);
    vec3 color = mix(uHorizon, uZenith, up);
    // The city's glow: a magenta band on the horizon, widest behind the camera's view.
    float band = 1.0 - smoothstep(0.0, 0.14, abs(h - 0.01));
    color += uGlow * band * uGlowLevel;
    // Stars: one per cell at most, small, only well above the horizon.
    if (uStars > 0.0) {
      vec2 g = vec2(atan(dir.z, dir.x) * 260.0, h * 420.0);
      vec2 cell = floor(g);
      vec2 f = fract(g) - 0.5;
      float r = hash(cell);
      vec2 offset = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float d = length(f - offset * 0.6);
      float star = step(0.992, r) * (1.0 - smoothstep(0.04, 0.14, d)) * smoothstep(0.1, 0.4, h);
      color += vec3(0.95, 0.9, 1.0) * star * uStars * (0.7 + 0.6 * fract(r * 91.7));
    }
    // A thin crescent: a disc minus an offset disc.
    if (uMoon > 0.0) {
      float d = 1.0 - dot(dir, uMoonDir);
      vec3 shifted = normalize(uMoonDir + vec3(0.012, 0.006, 0.0));
      float d2 = 1.0 - dot(dir, shifted);
      float disc = 1.0 - smoothstep(0.00008, 0.00014, d);
      float bite = 1.0 - smoothstep(0.00008, 0.00014, d2);
      float halo = exp(-d * 900.0) * 0.25;
      color += vec3(1.0, 0.96, 1.0) * (max(disc - bite, 0.0) * 2.4 + halo) * uMoon;
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;
