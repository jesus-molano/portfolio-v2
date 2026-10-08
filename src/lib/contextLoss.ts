/**
 * A WebGL context the browser took back (a phone short of GPU memory, a
 * video call beside the page, a driver reset): the canvas stays on the
 * page, white or black, Chrome's frowning face in its corner, and nothing
 * draws again. The scene is mounted afresh on a new canvas instead, a
 * moment later; after `retries` losses in one visit it gives up and the
 * page's own fallback shows (the hero's CSS sky, the city's night with its
 * text), never a dead canvas.
 */
export const CONTEXT_LOSS = {
  /** Fresh canvases tried after a loss, then the fallback. */
  retries: 2,
  /** How long the browser gets before the next canvas asks for a context (ms). */
  delayMs: 700,
} as const;

/** After the `losses`-th lost context: a fresh canvas, or the fallback for the rest of the visit. */
export function afterContextLoss(losses: number): "remount" | "fallback" {
  return losses <= CONTEXT_LOSS.retries ? "remount" : "fallback";
}
