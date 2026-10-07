import { fitWidth } from "./cardFit";

/**
 * Fits subtitle cards to their lines (cardFit.ts): each card's text box is
 * one block around its whole line, balanced, and a wrapped block would keep
 * the full width of its band, so it is set to its widest line (`--fit`).
 * Every box is let go first and then measured, so no card is measured
 * against an old fit. The one fitting of the hero's cards and the career
 * city's: call it when the viewport, the fonts or the subtitle size
 * change, never in the frame.
 */
export function fitCards(texts: readonly (HTMLElement | null | undefined)[]) {
  for (const text of texts) text?.style.removeProperty("--fit");
  const widths = texts.map((text) => {
    if (!text) return 0;
    const range = document.createRange();
    range.selectNodeContents(text);
    return fitWidth(range.getClientRects());
  });
  texts.forEach((text, i) => {
    if (text && widths[i] > 0) text.style.setProperty("--fit", `${widths[i]}px`);
  });
}
