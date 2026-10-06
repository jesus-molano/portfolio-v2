/**
 * The Heuristik LED screens: a dot matrix sampled from a canvas atlas at
 * each cell centre, so the text is crisp dots, never smeared type. Lit dots
 * glow HDR for the bloom; unlit dots stay faint. Below about two pixels per
 * cell the dots fade into their mean so they never shimmer.
 * `uScroll` scrolls the ticker row (in atlas u); `uInvert` flips the name bar.
 */
export const ledVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ledFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec4 uRect;
  uniform vec2 uCells;
  uniform float uScroll;
  uniform float uLevel;
  uniform float uInvert;
  uniform vec3 uTint;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vec2 cell = floor(vUv * uCells);
    vec2 centre = (cell + 0.5) / uCells;
    vec2 local = fract(vUv * uCells) - 0.5;
    float u = fract(centre.x + uScroll);
    vec2 uv = vec2(mix(uRect.x, uRect.z, u), mix(uRect.y, uRect.w, centre.y));
    vec3 sampleColor = texture2D(uMap, uv).rgb;
    sampleColor = mix(sampleColor, vec3(1.0) - sampleColor, uInvert);
    float lit = max(max(sampleColor.r, sampleColor.g), sampleColor.b);
    float disc = 1.0 - smoothstep(0.32, 0.46, length(local));
    // Few pixels per cell: show the cell's mean instead of aliasing dots.
    float px = max(fwidth(vUv.x * uCells.x), fwidth(vUv.y * uCells.y));
    float fine = smoothstep(0.35, 0.6, px);
    float shape = mix(disc, 0.55, fine);
    vec3 on = sampleColor * uTint * 3.2;
    vec3 off = vec3(0.04, 0.035, 0.06);
    vec3 color = mix(off, on, lit) * shape * uLevel + vec3(0.012, 0.01, 0.02);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * 0.6;
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;
