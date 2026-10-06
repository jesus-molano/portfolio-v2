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
