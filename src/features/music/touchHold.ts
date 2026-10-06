/**
 * The long-press on the hero scene that opens the radio wheel on a touch
 * screen. It must never steal a swipe or answer a thumb that is only
 * resting: a visitor often rests her thumb on the picture for a moment
 * before she swipes up, or for a whole line while she reads. So the press
 * only arms once the finger has stayed still for `armMs` (a ring comes up
 * under it), it opens the wheel when the finger lifts without having
 * moved (not while it is still down), and only while the ring is up: a
 * thumb left there past `lapseMs` is resting, the ring goes and lifting
 * opens nothing. Any movement past `slop` (the scroll's own stroke slop,
 * gate.ts: whatever the stroke scrolls is no long-press), any input that
 * moves the page (a swipe, the pedal held by the other thumb), a second
 * finger (a pinch, a thumb on the pedal) and a page still in motion when
 * it landed cancel it. The music button stays the obvious way in. Pure
 * rules; RadioWheel applies them.
 */
export const TOUCH_HOLD = {
  /** The finger may wander this many px from where it landed. */
  slop: 8,
  /** Held still this long (ms), the press is armed: lifting opens the wheel. */
  armMs: 600,
  /** Held this long (ms), it has lapsed: a thumb resting on the picture, not a long-press. */
  lapseMs: 2500,
  /** No scroll input this long (ms) before the press: a finger landing on a page in motion is stopping a scroll. */
  quietBeforeMs: 400,
} as const;

export type HoldInput = {
  /** How long the finger has been down, ms. */
  heldMs: number;
  /** Farthest it has moved from where it landed, px. */
  moved: number;
  /** Scroll input arrived since the finger landed (her other thumb on the pedal too). */
  scrolled: boolean;
  /** Another finger touched the glass since it landed. */
  others: boolean;
};

/** A press may start a hold: the page is not scrolling and was not scrolled just before. */
export function holdMayStart(input: { sinceScrollMs: number; scrolling: boolean }): boolean {
  return !input.scrolling && input.sinceScrollMs >= TOUCH_HOLD.quietBeforeMs;
}

/** The press is a swipe, a scroll, a pinch or a second thumb, not a long-press. */
export function holdCancelled(input: HoldInput): boolean {
  return input.moved > TOUCH_HOLD.slop || input.scrolled || input.others;
}

/** Held so long it is a thumb resting on the picture: the ring goes, and lifting opens nothing. */
export function holdLapsed(input: HoldInput): boolean {
  return input.heldMs >= TOUCH_HOLD.lapseMs;
}

/** Armed: held still long enough, and not so long that it lapsed, so lifting now opens the wheel. */
export function holdArmed(input: HoldInput): boolean {
  return !holdCancelled(input) && input.heldMs >= TOUCH_HOLD.armMs && !holdLapsed(input);
}
