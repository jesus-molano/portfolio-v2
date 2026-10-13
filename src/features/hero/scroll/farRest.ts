/**
 * Whether a stage's frame (HeroStage, WorkStage) may skip its work this
 * frame. Down at the cinema or the credits both stages still ran their
 * whole frame sixty times a second, story, dash and feedback included, for
 * a picture nobody could see; and the career city, its walls closed until
 * she has driven it, ran its whole frame through the hero and the
 * character select above it, from the moment she entered.
 *
 * A stage more than a screen below everything on screen rests, whatever
 * its walls, its motion or the pressure held: nothing of hers reaches a
 * wall down there but the page itself, and the frame reads where the page
 * is before it decides, so a jump onto the stage (a link, the scrollbar,
 * find in page) runs its whole frame, gate included, in the frame it
 * lands. Every other stage rests only with every wall of it open, the
 * page more than a screen past it (or before it), and nothing of hers in
 * flight: a closed wall keeps the frame running wherever the page is
 * below its top, since the same-frame pullback of a scrollbar drag or a
 * find in page needs it. So do a held pedal, a page in motion (Lenis
 * gliding or the browser scrolling), held input still decaying
 * (`pressure`) and a push of the last second: the frame runs again the
 * moment any of them starts, or the page comes within a screen of the
 * stage.
 */
export type FarRestInput = {
  /** Every wall of the stage is open (its story complete or opened). */
  wallsOpen: boolean;
  /** The page's scroll and the stage's top and bottom, page px. */
  scroll: number;
  top: number;
  bottom: number;
  /** One screen, px. */
  vh: number;
  /** Held input still shown (scrollGate.pressure). */
  pressure: number;
  /** Milliseconds since the last push held at a wall. */
  sincePush: number;
  pedalDown: boolean;
  /** Lenis gliding, or the browser scrolling the page. */
  scrolling: boolean;
};

/** Pushes this recent still keep the frame running (a ride's and a knock's own timers are shorter). */
export const PUSH_QUIET_MS = 1000;

export function restsFarAway(input: FarRestInput): boolean {
  const viewportBottom = input.scroll + input.vh;
  // More than a screen below everything on screen: the page has to come to it first.
  if (viewportBottom < input.top - input.vh) return true;
  if (!input.wallsOpen || input.pedalDown || input.scrolling) return false;
  if (input.pressure > 0 || input.sincePush < PUSH_QUIET_MS) return false;
  return input.scroll > input.bottom + input.vh;
}
