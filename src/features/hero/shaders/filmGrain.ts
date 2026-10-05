/**
 * The last pass of the frame: a colour grade, then film grain.
 *
 * Grade (after tone mapping, so it works on display values): a gentle
 * S-curve for contrast, lift that pulls the shadows toward violet instead of
 * black, gain that warms the highlights toward peach, and a touch of
 * saturation in the midtones but less in the shadows (the neutral tone
 * mapping already saturates the darks, and wet asphalt should read as deep
 * violet, not as purple paint). It works in a gamma-2 space (sqrt in,
 * square out): close enough to sRGB for grading and free of pow().
 *
 * Grain in the spirit of 80s and 90s 35 mm prints (Scarface, Reservoir Dogs,
 * Pulp Fiction): soft clumps about `uSize` pixels wide, strongest in the
 * midtones, refreshed 24 times a second like a projector. `time` and
 * `resolution` come from the postprocessing effect header; the grain scales
 * the colour, so no channel can go negative.
 */
export const filmGrainFragmentShader = /* glsl */ `
  uniform float uAmount;
  uniform float uSize;
  uniform vec3 uLift;
  uniform vec3 uGain;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uShadowSaturation;

  const vec3 GRADE_LUMA = vec3(0.2126, 0.7152, 0.0722);

  vec3 grade(vec3 linear) {
    vec3 c = sqrt(clamp(linear, 0.0, 1.0));
    // S-curve around mid grey: smoothstep pulls the darks down and the
    // highlights up; uContrast blends it in.
    c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
    // Lift and gain: 0 maps to uLift (violet), 1 to uGain (peach).
    c = c * uGain + uLift * (1.0 - c);
    float l = dot(c, GRADE_LUMA);
    float saturation = mix(uShadowSaturation, uSaturation, smoothstep(0.05, 0.4, l));
    c = clamp(mix(vec3(l), c, saturation), 0.0, 1.0);
    return c * c;
  }

  float grainHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Value noise: smooth clumps instead of single-pixel speckle.
  float grainNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = grainHash(cell);
    float b = grainHash(cell + vec2(1.0, 0.0));
    float c = grainHash(cell + vec2(0.0, 1.0));
    float d = grainHash(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 graded = grade(inputColor.rgb);

    float frame = floor(time * 24.0);
    vec2 offset = vec2(grainHash(vec2(frame, 1.7)), grainHash(vec2(frame, 9.2))) * 512.0;
    vec2 p = uv * resolution / uSize + offset;
    // Two octaves, centred on zero: about -0.5..0.5.
    float n = grainNoise(p) * 0.65 + grainNoise(p * 2.13 + 37.0) * 0.35 - 0.5;
    float luma = clamp(dot(graded, GRADE_LUMA), 0.0, 1.0);
    float response = smoothstep(0.0, 0.18, luma) * (1.0 - 0.7 * smoothstep(0.35, 1.0, luma));
    vec3 color = graded * (1.0 + 2.0 * n * uAmount * response);
    outputColor = vec4(max(color, vec3(0.0)), inputColor.a);
  }
`;
