/**
 * Film grain in the spirit of 80s and 90s 35 mm prints (Scarface, Reservoir
 * Dogs, Pulp Fiction): soft clumps about `uSize` pixels wide, strongest in
 * the midtones, refreshed 24 times a second like a projector. `time` and
 * `resolution` come from the postprocessing effect header; the grain scales
 * the colour, so blacks stay black and no channel can go negative.
 */
export const filmGrainFragmentShader = /* glsl */ `
  uniform float uAmount;
  uniform float uSize;

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
    float frame = floor(time * 24.0);
    vec2 offset = vec2(grainHash(vec2(frame, 1.7)), grainHash(vec2(frame, 9.2))) * 512.0;
    vec2 p = uv * resolution / uSize + offset;
    // Two octaves, centred on zero: about -0.5..0.5.
    float n = grainNoise(p) * 0.65 + grainNoise(p * 2.13 + 37.0) * 0.35 - 0.5;
    float luma = clamp(dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
    float response = smoothstep(0.0, 0.18, luma) * (1.0 - 0.7 * smoothstep(0.35, 1.0, luma));
    vec3 color = inputColor.rgb * (1.0 + 2.0 * n * uAmount * response);
    outputColor = vec4(max(color, vec3(0.0)), inputColor.a);
  }
`;
