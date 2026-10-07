/**
 * Subtitle cards are one solid block around the whole line, wrapped with
 * `text-wrap: balance`. A wrapped block is as wide as the room it has, not
 * as its balanced lines, so it would show an empty margin on both sides;
 * HeroStage measures each card's lines when the viewport changes (or the
 * fonts arrive) and sets the block to its widest line. Pure, so the rule
 * is tested.
 */

type Rect = { left: number; right: number; top: number; bottom: number };

/**
 * The widest line of a paragraph, from the client rects of its fragments
 * (a Range over its text): fragments whose vertical centres lie within
 * `slop` px of each other are one line, and a line is as wide as from its
 * leftmost to its rightmost fragment. Empty fragments do not count.
 */
export function widestLine(rects: ArrayLike<Rect>, slop = 2): number {
  const lines: { mid: number; left: number; right: number }[] = [];
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    if (!(rect.right - rect.left > 0)) continue;
    const mid = (rect.top + rect.bottom) / 2;
    const line = lines.find((candidate) => Math.abs(candidate.mid - mid) <= slop);
    if (line) {
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
    } else {
      lines.push({ mid, left: rect.left, right: rect.right });
    }
  }
  return lines.reduce((widest, line) => Math.max(widest, line.right - line.left), 0);
}

/** The width (px) to give a card's text box: its widest line, rounded up, plus a pixel so no line rewraps. */
export function fitWidth(rects: ArrayLike<Rect>): number {
  const widest = widestLine(rects);
  return widest > 0 ? Math.ceil(widest) + 1 : 0;
}

/**
 * How many times a card is measured at most (settleFits). Two passes
 * settle every card of both scripts at every width; the rest is margin.
 */
export const FIT_PASSES = 4;

/**
 * Fits cards to their widest lines, to a fixed point. `text-wrap: balance`
 * is not idempotent: a block set to the widest line of its balance in the
 * free band balances again in that narrower box, and often onto other
 * breaks whose widest line is narrower still (the career city's "Zod
 * doesn't take bribes…" at 1180 px: 276 px free, 266 px in a 277 px box),
 * so one pass left the block up to 15 px wider than its text. Each pass
 * measures every card in the box the last one gave it and narrows those
 * whose widest line now needs less, until none does; a box never widens,
 * so the line count never grows and the loop ends.
 *
 * `measure(i)` reads card i's fragments as laid out now (null: no card);
 * `apply(i, width)` sets its box. The first pass measures the free band:
 * the caller lets every box go first. Every pass reads all the cards
 * before it writes any, so a pass costs one layout.
 */
export function settleFits(
  count: number,
  measure: (index: number) => ArrayLike<Rect> | null,
  apply: (index: number, width: number) => void,
  passes = FIT_PASSES,
): number[] {
  const widths = new Array<number>(count).fill(0);
  for (let pass = 0; pass < passes; pass += 1) {
    const next = widths.map((width, i) => {
      if (pass > 0 && width === 0) return 0;
      const rects = measure(i);
      const fit = rects ? fitWidth(rects) : 0;
      return fit > 0 && (pass === 0 || fit < width) ? fit : 0;
    });
    if (next.every((width) => width === 0)) break;
    next.forEach((width, i) => {
      if (width === 0) return;
      widths[i] = width;
      apply(i, width);
    });
  }
  return widths;
}
