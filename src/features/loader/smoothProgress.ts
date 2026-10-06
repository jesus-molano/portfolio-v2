/**
 * The load as the start menu shows it. The scene reports its progress in
 * steps (a texture, a model, a shader at a time), and drawn as reported
 * the selected item's fill and the slab jumped from step to step. The
 * shown value chases the reported one every frame instead: quickly when
 * far behind and never slower than `minPerSecond` near it, never faster
 * than `maxPerSecond`, never backwards, and
 * landing exactly on the target. Under reduced motion it is the target.
 */
export const SMOOTH = { tau: 0.35, maxPerSecond: 0.9, minPerSecond: 0.08, finishTau: 0.12, finishPerSecond: 3 } as const;

export function smoothProgress(shown: number, target: number, dt: number, options: { done?: boolean; reduced?: boolean } = {}): number {
  const goal = Math.min(1, Math.max(0, target));
  if (options.reduced) return goal;
  if (goal <= shown) return shown;
  const step = Math.min(Math.max(dt, 0), 0.25);
  const tau = options.done ? SMOOTH.finishTau : SMOOTH.tau;
  const max = options.done ? SMOOTH.finishPerSecond : SMOOTH.maxPerSecond;
  // Eased toward the target, with a floor so the last per cent lands instead of creeping forever.
  const eased = Math.max((goal - shown) * (1 - Math.exp(-step / tau)), SMOOTH.minPerSecond * step);
  const next = Math.min(goal, shown + Math.min(eased, max * step));
  return goal - next < 0.0005 ? goal : next;
}
