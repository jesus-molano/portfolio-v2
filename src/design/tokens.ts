/**
 * Vice Afterglow design tokens.
 *
 * Single source of truth for the palette, typography, motion and layering.
 * - CSS reads them as custom properties emitted by `TokensStyle` (`--va-*`).
 * - Three.js materials and shaders import the hex values directly.
 */

export const palette = {
  /** Deep violet: page bottom, teaser, shadows. */
  night: "#1a0d38",
  /** Upper sky lavender. */
  dusk: "#6a4bc4",
  /** Pink afterglow haze, also the fog color. */
  haze: "#e39bbd",
  /** Primary hot pink accent. */
  magenta: "#ff2d95",
  /** Soft pink for highlights. */
  pink: "#ff8fd0",
  /** Cool accent, used sparingly. */
  cyan: "#19e6ff",
  /** Violet accents. */
  violet: "#8a4dff",
  /** Low sun orange. */
  orange: "#ff8a5c",
  /** Peach: sunlit edges, lines. */
  amber: "#ffd8a8",
  /** Silhouettes: buildings, palms. Deep violet, never black. */
  ink: "#2b1848",
  /** Warm off-white for display type. */
  cream: "#fff4f1",
  /** Body text. */
  text: "#f6f1ff",
  /** Secondary text. */
  textMuted: "rgba(246, 241, 255, 0.72)",
} as const;

export type PaletteKey = keyof typeof palette;

export const typography = {
  /** CSS variable names assigned by `next/font` in the root layout. */
  display: "var(--font-display), 'Arial Black', Impact, sans-serif",
  body: "var(--font-body), system-ui, sans-serif",
  mono: "var(--font-mono), ui-monospace, 'JetBrains Mono', monospace",
  /** Fluid sizes. */
  heroName: "clamp(2.7rem, 9.4vw, 10.5rem)",
  heroRole: "clamp(0.72rem, 1.05vw, 0.95rem)",
  bodySize: "clamp(1rem, 1.1vw, 1.125rem)",
} as const;

export const motion = {
  /** Seconds. */
  revealDuration: 1.6,
  revealStagger: 0.06,
  ease: "power3.out",
  /** Lenis interpolation factor. */
  scrollLerp: 0.09,
  /** Hero scroll length, in viewport heights. Four shots, six lines: give them room. */
  heroScrollVh: 800,
} as const;

export const layers = {
  canvas: 0,
  haze: 1,
  title: 2,
  ui: 3,
} as const;

export const breakpoints = {
  /** Below this width the light scene tier is used. */
  mobile: 768,
} as const;

/** Flattened CSS custom properties, emitted once in the root layout. */
export function tokensToCssVariables(): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(palette)) {
    entries.push(`--va-color-${kebab(key)}: ${value};`);
  }
  entries.push(`--va-font-display: ${typography.display};`);
  entries.push(`--va-font-body: ${typography.body};`);
  entries.push(`--va-font-mono: ${typography.mono};`);
  entries.push(`--va-size-hero-name: ${typography.heroName};`);
  entries.push(`--va-size-hero-role: ${typography.heroRole};`);
  entries.push(`--va-size-body: ${typography.bodySize};`);
  entries.push(`--va-motion-reveal: ${motion.revealDuration}s;`);
  entries.push(`--va-hero-scroll: ${motion.heroScrollVh}vh;`);
  for (const [key, value] of Object.entries(layers)) {
    entries.push(`--va-z-${kebab(key)}: ${value};`);
  }
  return `:root{${entries.join("")}}`;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
