/**
 * The page's scroll offset, read once a frame. SmoothScroll takes it right
 * after `lenis.raf` has written the page (`takeFrameScroll`), before any
 * stage has written anything, and the stages' ticks (HeroStage, the
 * character select, WorkStage) draw from it (`frameScroll`). Each of them
 * read `window.scrollY` itself, after the one before had written its
 * styles and attributes, and every such read made the browser bring the
 * page's style and layout up to date in the middle of the frame.
 *
 * A gate that moves the page in the frame (a jump back to its wall) reads
 * it again (`refreshFrameScroll`), so a tick after it sees where the page
 * is now, as it did reading the page itself. Event handlers come between
 * frames and read the page themselves.
 */
const reading = { time: Number.NaN, page: 0 };

const pageNow = () => window.scrollY;

/** The frame's reading, taken once Lenis has written the page; `time` is the frame's (lib/frameTicker.ts). */
export function takeFrameScroll(time: number, page: number): void {
  reading.time = time;
  reading.page = page;
}

/**
 * Where the page is in the frame at `time`: the reading SmoothScroll took,
 * or the page's own offset when none was taken in this frame (Lenis not
 * there yet), kept for the rest of the frame.
 */
export function frameScroll(time: number, read: () => number = pageNow): number {
  if (reading.time !== time) {
    reading.time = time;
    reading.page = read();
  }
  return reading.page;
}

/** Something in the frame moved the page (a gate putting it back at its wall): the reading follows it. */
export function refreshFrameScroll(read: () => number = pageNow): void {
  reading.page = read();
}
