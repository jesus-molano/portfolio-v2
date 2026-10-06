/**
 * The scroll wall of the pinned stages after the hero (px of page scroll).
 * The hero writes its own wall to `scrollGate.maxScroll` every frame;
 * WorkStage writes the work stage's here, and SmoothScroll trims wheel and
 * touch input to the smaller of the two. Infinity when nothing holds.
 */
export const stageGate = { maxScroll: Number.POSITIVE_INFINITY };
