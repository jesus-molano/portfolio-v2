/**
 * WCAG contrast for the line-up's colours, so the tests can hold the
 * tokens to the targets (cream on night, ink on the slip).
 */

type Rgb = readonly [number, number, number];

/** "#rrggbb" to 0-255 channels. */
export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`hexToRgb: "${hex}" is not #rrggbb`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A colour at `alpha` laid over an opaque background. */
export function over(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  const a = Math.min(1, Math.max(0, alpha));
  return [0, 1, 2].map((i) => foreground[i] * a + background[i] * (1 - a)) as unknown as Rgb;
}

/** WCAG 2 relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
