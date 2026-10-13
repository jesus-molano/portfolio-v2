/**
 * When the hero's shots cut, on the film, and nothing else: the stage's
 * frame (HeroStage, scroll/story.ts) needs the cuts, not the cameras.
 * shots.ts builds its cameras out of three.js vectors as it loads, and a
 * module that builds one at its top keeps three.js in whatever bundle
 * imports it: the stage's import of these few numbers put three.js in the
 * page's first bundle, parsed and run before hydration. shots.ts
 * re-exports all of it, and its shots are counted against `SHOT_COUNT`
 * (shotTiming.test.ts). This module imports nothing.
 */

/** The film's shots (scene/shots.ts SHOTS): five setups, cut on the scroll. */
export const SHOT_COUNT = 5;

export function shotIndexAt(progress: number): number {
  return Math.min(SHOT_COUNT - 1, Math.max(0, Math.floor(progress * SHOT_COUNT)));
}

/** How far past a cut (film progress) the picture must go before it cuts (stickyShot). */
export const CUT_BAND = 0.002;

/** A shot and the film progress to show in it (stickyShot). */
export type ShotPick = { shot: number; p: number };

/**
 * Keeps the current shot until the progress is more than `band` past a
 * cut, clamping the progress into that shot, so a finger resting on the
 * glass at a cut never strobes between two shots. A jump of more than one
 * shot cuts at once. Writes into `out` when given, so a frame allocates
 * nothing.
 */
export function stickyShot(
  progress: number,
  previous: number,
  band = CUT_BAND,
  out: ShotPick = { shot: 0, p: 0 },
): ShotPick {
  const natural = shotIndexAt(progress);
  out.shot = natural;
  out.p = progress;
  if (previous < 0 || previous >= SHOT_COUNT || Math.abs(natural - previous) !== 1) return out;
  if (natural > previous) {
    const cut = (previous + 1) / SHOT_COUNT;
    if (progress > cut + band) return out;
    out.shot = previous;
    out.p = Math.min(progress, cut - 1e-6);
    return out;
  }
  const cut = previous / SHOT_COUNT;
  if (progress < cut - band) return out;
  out.shot = previous;
  out.p = Math.max(progress, cut);
  return out;
}
