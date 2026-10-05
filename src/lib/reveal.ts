/**
 * Asked of a deep link's target before the page goes to it
 * (components/PageEntry.tsx): whatever hides it shows it first. STATS
 * opens the tab the target is in; a closed tab is not on screen, so the
 * page could neither scroll to it nor focus it. A listener may also name
 * the element to bring into view in its place: a tab panel is seen from
 * its section, with the tab bar above it.
 */
export const REVEAL_EVENT = "va:reveal";

export type RevealDetail = { view: HTMLElement };

/** Asks the target's ancestors to show it; returns the element to scroll into view. */
export function reveal(target: HTMLElement): HTMLElement {
  const detail: RevealDetail = { view: target };
  target.dispatchEvent(new CustomEvent<RevealDetail>(REVEAL_EVENT, { bubbles: true, detail }));
  return detail.view;
}
