/**
 * The scroll wall of the pinned stages after the hero (px of page scroll).
 * The hero writes its own wall to `scrollGate.maxScroll` every frame;
 * WorkStage writes the work stage's here, and SmoothScroll trims wheel and
 * touch input to the smaller of the two. Infinity when nothing holds.
 *
 * `pinFrom` and `pinTo` are the page scroll (px) over which the stage's
 * film is pinned: a touch stroke that starts there stays Lenis', as in the
 * hero, even with every wall open (gate.ts browserStroke). Empty (from
 * over to) when there is no film (reduced motion, no stage).
 */
export const stageGate = {
  maxScroll: Number.POSITIVE_INFINITY,
  pinFrom: Number.POSITIVE_INFINITY,
  pinTo: Number.NEGATIVE_INFINITY,
};
