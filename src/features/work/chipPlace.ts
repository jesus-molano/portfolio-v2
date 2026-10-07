/**
 * Where a stop's chip stands on a phone: over the tallest of the stop's
 * subtitle cards, so no card of that stop, however many lines it wraps to
 * at her subtitle size, ever runs under the chip, and the chip never moves
 * from one line of the stop to the next. WorkStage measures the cards'
 * blocks when it fits them (the viewport, the fonts, the subtitle size;
 * never in the frame) and writes each stop's height as `--cards-h` on its
 * article's slot; the CSS stands the chip that far over the subtitles'
 * band, from the bottom of the pinned frame (Work.module.css .chipSlot).
 */

/** The tallest card block of each stop, in px: `heights[i]` belongs to stop `stops[i]`; a card with no stop (-1) counts for none. */
export function tallestCards(heights: readonly number[], stops: readonly number[], count: number): number[] {
  const tallest = Array.from({ length: count }, () => 0);
  heights.forEach((height, i) => {
    const stop = stops[i];
    if (stop >= 0 && stop < count && height > tallest[stop]) tallest[stop] = height;
  });
  return tallest.map((height) => Math.ceil(height));
}
