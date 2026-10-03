/**
 * Vice Afterglow design tokens.
 *
 * Single source of truth for the palette, typography, motion and layering.
 * - CSS reads them as custom properties emitted by `TokensStyle` (`--va-*`).
 * - Three.js materials and shaders import the hex values directly.
 */

export const palette = {
  /** Deep night background, top of the sky. */
  night: "#0b0618",
  /** Upper sky violet. */
  dusk: "#2a0f4a",
  /** Horizon purple used for fog. */
  haze: "#4a1466",
  /** Primary neon pink. */
  magenta: "#ff2d95",
  /** Soft pink for highlights. */
  pink: "#ff7ac3",
  /** Primary neon cyan. */
  cyan: "#19e6ff",
  /** Electric violet accents. */
  violet: "#8a4dff",
  /** Sun core orange. */
  orange: "#ff7a3d",
  /** Sun top amber. */
  amber: "#ffd36a",
  /** Silhouettes: buildings, palms. */
  ink: "#06030d",
  /** Body text. */
  text: "#f6f1ff",
  /** Secondary text. */
  textMuted: "rgba(246, 241, 255, 0.72)",
} as const;

export type PaletteKey = keyof typeof palette;

export const typography = {
  /** CSS variable names assigned by `next/font` in the root layout. */
  display: "var(--font-display), Impact, 'Arial Narrow Bold', sans-serif",
  body: "var(--font-body), system-ui, sans-serif",
  /** Fluid sizes. */
  heroName: "clamp(4.5rem, 17vw, 21rem)",
  heroRole: "clamp(0.85rem, 1.6vw, 1.35rem)",
  bodySize: "clamp(1rem, 1.1vw, 1.125rem)",
} as const;

export const motion = {
  /** Seconds. */
  revealDuration: 1.6,
  revealStagger: 0.06,
  ease: "power3.out",
  /** Lenis interpolation factor. */
  scrollLerp: 0.09,
  /** Hero scroll length, in viewport heights. */
  heroScrollVh: 400,
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
