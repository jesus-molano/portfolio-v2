/**
 * A push held at a wall, as the career city's frame takes it. The push
 * (scrollGate.pushedAt) is the page's, not the stage's: the hero's walls
 * and the character select's record one too. The frame takes each push
 * once, in the frame after it was held (`takePush`): the card on screen
 * gives under it, and one held at the opening's walls (the title or the
 * arrival, before the first line) by a notch, a flick or a swipe on the
 * stage carries the page on to that line, as a press does.
 *
 * A frame resting far from the stage (hero/scroll/farRest.ts) takes none,
 * so it lets each one go by (`passPush`), as the frame did when it still
 * ran there, the page off its film. Kept for the frame back on the stage, a
 * push held at one of the hero's cards minutes before read as one at the
 * title wall the moment LOAD GAME, Back or a fragment landed the page
 * there, and the city drove itself through the opening to the army's first
 * line with no input of hers.
 */
import type { InputSource } from "@/features/hero/scroll/heroProgress";
import type { Wall } from "./workStory";

/** The last push the frame took or let go by (scrollGate.pushedAt, ms). */
export type PushSeen = { at: number };

/** What the frame reads for a push, filled in place each frame. */
export type PushFrame = {
  /** The last push held at any wall (scrollGate.pushedAt). */
  pushedAt: number;
  /** The stage's first closed wall (none: every wall open). */
  front: Pick<Wall, "kind" | "to"> | undefined;
  /** The film position of the first line. */
  firstLine: number;
  /** The page on the stage's film. */
  inStage: boolean;
  /** She is going back (a rewind's cards hidden). */
  rewinding: boolean;
  /** Her last input (scrollInput.source). */
  source: InputSource | null;
};

/**
 * What a push does as the frame takes it: nothing if it has been taken or
 * let go by already, else a flash under the card, and a carry on to the
 * first line when it was a notch, flick or swipe held at the opening's
 * walls, on the stage, going forward.
 */
export function takePush(seen: PushSeen, frame: PushFrame): "none" | "flash" | "carry" {
  if (frame.pushedAt === seen.at) return "none";
  seen.at = frame.pushedAt;
  const { front } = frame;
  const opening = front !== undefined && front.kind !== "card" && front.to <= frame.firstLine;
  const scrolled = frame.source === "wheel" || frame.source === "touch";
  return opening && frame.inStage && !frame.rewinding && scrolled ? "carry" : "flash";
}

/** Out of sight: the push goes by, never taken by a later frame (see above). */
export function passPush(seen: PushSeen, pushedAt: number): void {
  seen.at = pushedAt;
}
