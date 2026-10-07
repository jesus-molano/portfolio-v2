/**
 * Whether a stage's frame (HeroStage, WorkStage) may skip its work this
 * frame: every wall of it open, the page more than a screen away from it
 * (above or below), and nothing of hers in flight. Down at the cinema or
 * the credits both stages still ran their whole frame sixty times a second,
 * story, dash and feedback included, for a picture nobody could see.
 *
 * A closed wall always keeps the frame running, wherever the page is: the
 * same-frame pullback of a scrollbar drag or a find in page needs it. So
 * do a held pedal, a page in motion (Lenis gliding or the browser
 * scrolling), held input still decaying (`pressure`) and a push of the
 * last second: the frame runs again the moment any of them starts, or the
 * page comes within a screen of the stage, and it reads the page itself
 * before deciding.
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
  if (!input.wallsOpen || input.pedalDown || input.scrolling) return false;
  if (input.pressure > 0 || input.sincePush < PUSH_QUIET_MS) return false;
  const viewportBottom = input.scroll + input.vh;
  return input.scroll > input.bottom + input.vh || viewportBottom < input.top - input.vh;
}
