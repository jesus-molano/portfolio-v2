/**
 * Whether the night canvas is hidden under the stage's own opaque night,
 * so it may stop drawing (NightScene renders only while active and not
 * covered). Two places, never a dip between two stops (the set changes and
 * compiles there):
 * - the iris closed at the end of the drive: the strip of the stage left
 *   under STATS's chapter card and veil, or the stage's end where a link
 *   lands; the iris is drawn only once the night has faded in (`sceneIn`
 *   1), and closed from the end beat's end (`endT` 1);
 * - the opening cover still fully up (`sceneIn` 0: through the chapter
 *   card and before the bridge line), once the scene is ready and every
 *   stop has been warmed up (compiled and uploaded), since that warm-up
 *   runs in the frame loop.
 */
export type NightCoverInput = {
  /** The night scene has rendered its first settled frames. */
  ready: boolean;
  /** The opening: 0 under the cover, 1 once the night has faded in (opening.ts sceneIn). */
  sceneIn: number;
  /** The end beat's progress: 1 once the iris has closed. */
  endT: number;
  /** The dip to night between two stops (dip.ts). */
  dip: number;
  /** Every stop's materials compiled and textures uploaded, nothing loading. */
  warm: boolean;
};

export function nightCovered({ ready, sceneIn, endT, dip, warm }: NightCoverInput): boolean {
  if (!ready || dip > 0) return false;
  if (sceneIn >= 1 && endT >= 1) return true;
  return sceneIn <= 0 && warm;
}
