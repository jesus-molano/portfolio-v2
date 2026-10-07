import { loadFaces } from "./artCanvas";
import { artQueue, stopRank, type Painter } from "./artQueue";
import { night } from "./nightState";

/**
 * A set's boards, painted in turn (artQueue.ts) once their faces are in:
 * `painter` makes the art (a function, or a generator that yields between
 * its steps), `keep` takes it, `release` disposes of it. Ranked by how
 * soon she reaches stop `index`. Returns the effect's cleanup, which drops
 * a painter still waiting and releases what was made.
 */
export function paintSet<T>(
  faces: string[],
  index: number,
  painter: () => Painter<T>,
  keep: (made: T) => void,
  release: (made: T) => void,
): () => void {
  let cancelled = false;
  let made: { value: T } | null = null;
  let job: { cancel: () => void } | null = null;
  loadFaces(faces).then(() => {
    if (cancelled) return;
    const turn = artQueue.paint(painter(), () => stopRank(index, night.stop));
    job = turn;
    turn.done.then(
      (value) => {
        if (cancelled) {
          release(value);
          return;
        }
        made = { value };
        keep(value);
      },
      (error: unknown) => console.error(error),
    );
  });
  return () => {
    cancelled = true;
    job?.cancel();
    if (made) release(made.value);
  };
}
