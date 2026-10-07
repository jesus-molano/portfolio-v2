/**
 * A finger that lands on a range's track to scroll the page.
 *
 * Chrome on a touch screen moves a range's thumb to the finger on
 * pointerdown, before it knows whether the finger slides along the track
 * or swipes past it; a vertical swipe then goes to the page as a scroll
 * (`pointercancel`), and the value it jumped to stays. On STATS's SETTINGS
 * tab, every swipe that started on the volume track changed her volume.
 * The guard remembers the value a touch found and hands it back if the
 * browser cancels that touch; a tap or a drag along the track (which ends
 * in `pointerup`) keeps what it set, and the mouse and the keys are never
 * touched.
 */
export type RangeGuard = {
  /** A pointer went down on the range holding `value`. */
  down(pointerType: string, value: number): void;
  /** The gesture ended as the range's own (`pointerup`): keep what it set. */
  up(): void;
  /** The browser took the gesture (`pointercancel`): the value to restore, or null. */
  cancel(): number | null;
};

export function createRangeGuard(): RangeGuard {
  let found: number | null = null;
  return {
    down(pointerType, value) {
      found = pointerType === "touch" ? value : null;
    },
    up() {
      found = null;
    },
    cancel() {
      const value = found;
      found = null;
      return value;
    },
  };
}
