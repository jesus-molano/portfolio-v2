/**
 * Lens state shared by the camera rig and the post-processing: CameraRig
 * writes it every frame for the current shot, the depth of field reads it.
 * A plain mutable object, like heroProgress, so nothing re-renders.
 */
export const lens = {
  /** Distance from the camera to the subject in focus, in metres. */
  focusDistance: 8,
  /** Depth that stays sharp around the focus distance, in metres. */
  focusRange: 3,
  /** Bokeh size; 0 turns depth of field off for the shot. */
  bokehScale: 0,
};
