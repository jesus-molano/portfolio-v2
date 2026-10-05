import { Color } from "three";
import { palette } from "@/design/tokens";

/**
 * The colour grade of the last pass (shaders/filmGrain.ts), as data.
 * Tuned on luma and saturation histograms of the hero frames: the darkest
 * silhouettes reach a deep violet (never black), the sun keeps a peach
 * roll-off and the pastels gain a little colour.
 */
export type GradeLook = {
  /** How far the shadows lift toward the silhouette violet (0 = black floor). */
  lift: number;
  /** How far the highlights warm toward peach (0 = neutral white). */
  warmth: number;
  /** S-curve blend: 0 = linear, 1 = full smoothstep. */
  contrast: number;
  /** Midtone and highlight saturation: 1 = unchanged, above 1 = more colour. */
  saturation: number;
  /** Saturation of the shadows, blended in below display luma 0.4. */
  shadowSaturation: number;
};

/**
 * Tuned on the review frames of both tiers (display luma, HUD rows left
 * out): after the neutral tone mapping alone the 1st percentile sat at 0.03,
 * 0.6% of the pixels were near black and the darks were oversaturated
 * violet. With this grade the 1st percentile is about 0.08, nothing is near
 * black or white-clipped, and the median moves by about 0.01.
 */
export const GRADE: GradeLook = {
  lift: 0.4,
  warmth: 0.1,
  contrast: 0.25,
  saturation: 1.08,
  shadowSaturation: 0.75,
};

export type Rgb = [number, number, number];

/** Display-space (sRGB) channels of a hex colour, 0..1. */
function displayRgb(hex: string): Rgb {
  const color = new Color(hex);
  // Color stores linear values; the grade works on display values.
  color.convertLinearToSRGB();
  return [color.r, color.g, color.b];
}

/**
 * The uniforms the grade shader reads: `lift` is the colour pure black maps
 * to (a fraction of palette.ink), `gain` the colour white maps to (white
 * pulled toward palette.amber; no channel above 1, so nothing clips).
 */
export function gradeUniforms(look: GradeLook = GRADE): {
  lift: Rgb;
  gain: Rgb;
  contrast: number;
  saturation: number;
  shadowSaturation: number;
} {
  const ink = displayRgb(palette.ink);
  const amber = displayRgb(palette.amber);
  const peak = Math.max(...amber);
  return {
    lift: ink.map((channel) => channel * look.lift) as Rgb,
    gain: amber.map((channel) => 1 + (channel / peak - 1) * look.warmth) as Rgb,
    contrast: look.contrast,
    saturation: look.saturation,
    shadowSaturation: look.shadowSaturation,
  };
}

const LUMA: Rgb = [0.2126, 0.7152, 0.0722];

/**
 * CPU mirror of `grade()` in shaders/filmGrain.ts, for tests and for tuning
 * against captured frames. Input and output are linear values.
 */
export function gradeLinear(linear: Rgb, uniforms = gradeUniforms()): Rgb {
  const c = linear.map((v) => Math.sqrt(Math.min(1, Math.max(0, v)))) as Rgb;
  for (let i = 0; i < 3; i++) {
    const curve = c[i] * c[i] * (3 - 2 * c[i]);
    c[i] = c[i] + (curve - c[i]) * uniforms.contrast;
    c[i] = c[i] * uniforms.gain[i] + uniforms.lift[i] * (1 - c[i]);
  }
  const l = c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
  const t = Math.min(1, Math.max(0, (l - 0.05) / 0.35));
  const blend = t * t * (3 - 2 * t);
  const saturation = uniforms.shadowSaturation + (uniforms.saturation - uniforms.shadowSaturation) * blend;
  return c.map((v) => {
    const saturated = Math.min(1, Math.max(0, l + (v - l) * saturation));
    return saturated * saturated;
  }) as Rgb;
}
