/** What centring needs of a canvas TextMetrics. */
export type InkMetrics = Pick<TextMetrics, "actualBoundingBoxLeft" | "actualBoundingBoxRight" | "actualBoundingBoxAscent" | "actualBoundingBoxDescent">;

/**
 * Where to draw a line (left-aligned, on the alphabetic baseline) so its ink,
 * not its advance box, is centred on the origin, and how much to squeeze it
 * to fit `maxWidth`. Signs are sampled by LED cells and seen from 40 m: an
 * advance box's side bearings and a font's ascent put text visibly off.
 */
export function inkOrigin(m: InkMetrics, maxWidth: number): { x: number; y: number; squeeze: number } {
  const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  return {
    x: -inkW / 2 + m.actualBoundingBoxLeft,
    y: inkH / 2 - m.actualBoundingBoxDescent,
    squeeze: inkW > 0 ? Math.min(1, maxWidth / inkW) : 1,
  };
}

/**
 * Sets up `ctx` so drawing at (x, y) puts the text's ink centred on (cx, cy),
 * squeezed to fit; `draw` paints it (fill, stroke, glow), then the context
 * is restored.
 */
export function withInkCentred(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  draw: (x: number, y: number) => void,
): void {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const { x, y, squeeze } = inkOrigin(ctx.measureText(text), maxWidth);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squeeze, 1);
  draw(x, y);
  ctx.restore();
}

/** The role as one line: the ticker's loop separators dropped at the ends, single spaced. */
export function roleLine(ticker: string): string {
  return ticker
    .split("◆")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ◆ ");
}
