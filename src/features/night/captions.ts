/**
 * Where each stop's captions (the HUD and the super, top left) stand on a
 * portrait screen, a phone: on the right when the stop's art holds the top
 * left of its portrait shots (the work stage's `data-caption-side`, at
 * most `CAPTION_SPAN` of the width), on the left otherwise (null).
 *
 * Its own module, imports none: the work stage reads it in its frame and
 * its markup, and direction.ts, where it lived, brings the camera's
 * three.js objects with it, which put three.js in the page's first
 * bundle. direction.ts gives each stop's direction its side from here.
 */
export type CaptionSide = "right";

/** The share of a portrait screen's width the stop's captions take when they stand on the right (Work.module.css). */
export const CAPTION_SPAN = 0.48;

/** One per stop, in the order of the drive (work/stops.ts, direction.ts DIRECTION). */
export const PHONE_CAPTIONS: readonly (CaptionSide | null)[] = [
  // The army.
  null,
  // PwC. On a phone the hotel is fitted from the start, and the blade's C stands over the readerboard,
  // left of the car (seen from down the street the car is always right of the board), in the top left
  // of every reading shot: no framing keeps the C, the readerboard and the car in a tall frame without
  // it, so the captions stand on the right and the C reads whole.
  "right",
  // Cloud District, Logixs, Heuristik.
  null,
  null,
  null,
];
