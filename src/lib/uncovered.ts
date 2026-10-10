/**
 * Runs `fn` once nothing covers the page: at once, or as soon as `<html>`
 * loses `data-loading` (the start menu, or LOAD GAME's load screen). The
 * one-time entrances (a chapter card's, the wanted level's flash) play
 * where she can see them, never under a screen. Returns a cancel.
 */
export function whenUncovered(fn: () => void): () => void {
  const html = document.documentElement;
  if (!html.hasAttribute("data-loading")) {
    fn();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (html.hasAttribute("data-loading")) return;
    observer.disconnect();
    fn();
  });
  observer.observe(html, { attributes: true, attributeFilter: ["data-loading"] });
  return () => observer.disconnect();
}
