/**
 * The long-press on the hero scene that opens the radio wheel on a touch
 * screen. It must never steal a swipe: a visitor often rests her thumb on
 * the picture for a moment before she swipes up. So the press only arms
 * once the finger has stayed still for `armMs`, it opens the wheel when
 * the finger lifts without having moved (not while it is still down), any
 * movement past `slop` cancels it, and a press on a page that is still
 * scrolling (or that scrolls during the press) never counts. The music
 * button stays the obvious way in. Pure rules; RadioWheel applies them.
 */
export const TOUCH_HOLD = {
  /** The finger may wander this many px from where it landed. */
  slop: 8,
  /** Held still this long (ms), the press is armed: lifting opens the wheel. */
  armMs: 600,
  /** No scroll input this long (ms) before the press: a finger landing on a page in motion is stopping a scroll. */
  quietBeforeMs: 400,
} as const;

export type HoldInput = {
  /** How long the finger has been down, ms. */
  heldMs: number;
  /** Farthest it has moved from where it landed, px. */
  moved: number;
  /** Scroll input arrived since the finger landed. */
  scrolled: boolean;
};

/** A press may start a hold: the page is not scrolling and was not scrolled just before. */
export function holdMayStart(input: { sinceScrollMs: number; scrolling: boolean }): boolean {
  return !input.scrolling && input.sinceScrollMs >= TOUCH_HOLD.quietBeforeMs;
}

/** The finger has moved too far: the press is a swipe, not a hold. */
export function holdCancelled(input: HoldInput): boolean {
  return input.moved > TOUCH_HOLD.slop || input.scrolled;
}

/** Armed: held still long enough, so lifting now opens the wheel. */
export function holdArmed(input: HoldInput): boolean {
  return !holdCancelled(input) && input.heldMs >= TOUCH_HOLD.armMs;
}
