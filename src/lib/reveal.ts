/**
 * Asked of a deep link's target before the page goes to it
 * (components/PageEntry.tsx): whatever hides it shows it first. STATS
 * opens the tab the target is in; a closed tab is not on screen, so the
 * page could neither scroll to it nor focus it. A listener may also name
 * the element to bring into view in its place (a tab panel is seen from
 * its section, with the tab bar above it) and the one to take the focus
 * (an old fragment's alias hands it to the panel it stands for).
 */
export const REVEAL_EVENT = "va:reveal";

export type RevealDetail = { view: HTMLElement; focus: HTMLElement };

/** Asks the target's ancestors to show it; returns the element to scroll into view and the one to focus. */
export function reveal(target: HTMLElement): RevealDetail {
  const detail: RevealDetail = { view: target, focus: target };
  target.dispatchEvent(new CustomEvent<RevealDetail>(REVEAL_EVENT, { bubbles: true, detail }));
  return detail;
}
