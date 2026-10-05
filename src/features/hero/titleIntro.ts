/**
 * The title's letter reveal, as the story sees it (story.ts holds the
 * title wall until the name has formed and held). HeroTitle registers its
 * GSAP timeline here; HeroStage reads the progress, fast-forwards the
 * reveal on the visitor's first input and completes it for dev jumps.
 * A plain mutable object, like heroProgress, so nothing re-renders.
 */
export type TitleIntro = {
  /** The reveal has completed (or does not run: reduced motion). */
  done: boolean;
  /** Progress of the reveal, 0..1. */
  progress: () => number;
  /** Plays the rest of the reveal faster. */
  hurry: () => void;
  /** Jumps to the end of the reveal. */
  complete: () => void;
};

const idle = () => 0;
const noop = () => {};

export const titleIntro: TitleIntro = { done: false, progress: idle, hurry: noop, complete: noop };

/** HeroTitle: hands its timeline over; returns the cleanup. */
export function registerTitleIntro(handlers: Omit<TitleIntro, "done">, done = false): () => void {
  titleIntro.done = done;
  titleIntro.progress = handlers.progress;
  titleIntro.hurry = handlers.hurry;
  titleIntro.complete = handlers.complete;
  return () => {
    titleIntro.done = false;
    titleIntro.progress = idle;
    titleIntro.hurry = noop;
    titleIntro.complete = noop;
  };
}

/** The reveal has finished on its own or was completed. */
export function markTitleIntroDone(): void {
  titleIntro.done = true;
}
