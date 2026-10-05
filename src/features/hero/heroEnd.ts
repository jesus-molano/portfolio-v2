/**
 * The hero's cut to its end (what Skip, Esc and End do), for code outside
 * the stage: a deep link to a later section (/en#contact, components/PageEntry.tsx)
 * cuts the film first, then goes there. HeroStage registers its section
 * and its cut while it is mounted.
 */
export type HeroEnd = { section: HTMLElement; cut: () => void };

let current: HeroEnd | null = null;

export function registerHeroEnd(end: HeroEnd): () => void {
  current = end;
  return () => {
    if (current === end) current = null;
  };
}

export function getHeroEnd(): HeroEnd | null {
  return current;
}
