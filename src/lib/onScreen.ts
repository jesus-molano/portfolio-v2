/**
 * Whether an observed element shows on screen, for the work that stops
 * while it does not (the hero's render loop, the sections' looping CSS
 * animations). An IntersectionObserver reports a target whose edge only
 * touches the viewport as intersecting, with a ratio of 0: that is exactly
 * where Skip, Esc and End leave the hero, its bottom edge on the
 * viewport's top, and the scene would go on rendering a frame nobody sees.
 * Only a visible area counts; observe with these thresholds, so the step
 * between touching and showing is reported.
 */
export const ON_SCREEN_THRESHOLDS = [0, 0.001];

export function isOnScreen(entry: Pick<IntersectionObserverEntry, "isIntersecting" | "intersectionRatio">): boolean {
  return entry.isIntersecting && entry.intersectionRatio > 0;
}

/**
 * The root margin that shrinks the viewport to one line of pixels, `y` px
 * from its top, for an observer that asks whether a target crosses that
 * line: whether any of it lies under the bottom edge of a fixed element
 * there (the page controls asking whether the hero's picture is behind
 * them). The line stays inside the viewport.
 */
export function lineRootMargin(y: number, viewportHeight: number): string {
  const top = Math.min(Math.max(0, Math.round(y)), Math.max(0, viewportHeight - 1));
  const bottom = Math.max(0, viewportHeight - top - 1);
  return `${-top}px 0px ${-bottom}px 0px`;
}

/**
 * The line `gap` px under the lowest of some fixed boxes (top and height in
 * viewport px, as `offsetTop` and `offsetHeight` give them for a fixed
 * element: without the transform of its fade), for an observer on that
 * line (`lineRootMargin`) that asks whether a target at the top of the page
 * runs down past all of them, so whatever comes after it starts below
 * them. With no box, the viewport's top edge.
 */
export function lineBelow(boxes: Iterable<{ top: number; height: number }>, gap: number): number {
  let bottom = Number.NEGATIVE_INFINITY;
  for (const box of boxes) bottom = Math.max(bottom, box.top + box.height);
  return Number.isFinite(bottom) ? bottom + gap : 0;
}
