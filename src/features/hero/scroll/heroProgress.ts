/**
 * Shared scroll progress of the hero, written by ScrollTrigger and read by the
 * Three.js camera rig inside `useFrame`. A plain mutable object avoids React
 * re-renders on every scroll frame.
 */
export const heroProgress = {
  /** 0 at the top of the hero, 1 when its scroll range ends. */
  value: 0,
};

/** Progress used when motion is reduced: a static, well-composed frame. */
export const STATIC_PROGRESS = 0.28;
