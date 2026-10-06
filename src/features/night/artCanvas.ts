import { CanvasTexture, SRGBColorSpace } from "three";
import { typography } from "@/design/tokens";

/**
 * Board art is painted once per stop into a canvas, in the site's own
 * fonts (next/font), then uploaded as a texture. Our own typography, no
 * brand marks.
 */

/** A font family as the page loaded it, with its token fallbacks. */
export function family(variable: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const loaded = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return loaded ? `${loaded}, ${fallback}` : fallback;
}

export const fonts = {
  display: () => family("--font-display", typography.display.replace(/^var\(--font-display\),\s*/, "")),
  body: () => family("--font-body", "system-ui, sans-serif"),
  mono: () => family("--font-mono", "ui-monospace, monospace"),
  script: () => family("--font-sign-script", "'Brush Script MT', cursive"),
  deco: () => family("--font-sign-deco", "Didot, Georgia, serif"),
  serif: () => family("--font-sign-serif", "Didot, Georgia, serif"),
  block: () => family("--font-radio-hiphop", "Impact, sans-serif"),
  condensed: () => family("--font-marquee", "'Arial Narrow', sans-serif"),
};

/** Waits (briefly) for the faces a board uses, so the first paint is in the right type. */
export async function loadFaces(specs: string[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
  await Promise.race([Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => []))).then(() => {}), timeout]);
}

export function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas");
  return [canvas, ctx];
}

export function toTexture(canvas: HTMLCanvasElement, anisotropy = 4): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Fits a line of text into a width: returns the font size that makes it fit (at most `size`). */
export function fitText(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, width: number): number {
  ctx.font = font(size);
  const measured = ctx.measureText(text).width;
  return measured > width ? (size * width) / measured : size;
}

/**
 * The low tier keeps half the pixels of a big board (a quarter of the GPU
 * memory): phones never show it wider than about 600 device pixels.
 */
export function forTier(canvas: HTMLCanvasElement, low: boolean): HTMLCanvasElement {
  if (!low) return canvas;
  const [half, ctx] = makeCanvas(Math.round(canvas.width / 2), Math.round(canvas.height / 2));
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, half.width, half.height);
  return half;
}
