import { settleFits } from "./cardFit";

/**
 * Fits subtitle cards to their lines (cardFit.ts): each card's text box is
 * one block around its whole line, balanced, and a wrapped block would keep
 * the full width of its band, so it is set to its widest line (`--fit`).
 * Every box is let go first and then measured, so no card is measured
 * against an old fit, and measured again in its new box until its balance
 * settles (`settleFits`: balance wraps a narrower box onto other breaks).
 * The one fitting of the hero's cards and the career city's: call it when
 * the viewport, the fonts or the subtitle size change, never in the frame.
 */
export function fitCards(texts: readonly (HTMLElement | null | undefined)[]) {
  for (const text of texts) text?.style.removeProperty("--fit");
  settleFits(
    texts.length,
    (i) => {
      const text = texts[i];
      if (!text) return null;
      const range = document.createRange();
      range.selectNodeContents(text);
      return range.getClientRects();
    },
    (i, width) => texts[i]?.style.setProperty("--fit", `${width}px`),
  );
}
