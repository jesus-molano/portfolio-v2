import { loadFaces } from "./artCanvas";
import { artQueue, stopRank, type Painter } from "./artQueue";
import { night } from "./nightState";

let pending = 0;
const listeners = new Set<() => void>();

function setPending(next: number) {
  pending = next;
  for (const listener of listeners) listener();
}

/**
 * Boards still on their way into the scene: waiting for their faces,
 * queued or painting, or painted less than a frame ago (their set takes
 * the art in a React update, which lands after the painter is done). The
 * night counts itself warm only at none (Warmup in NightScene.tsx): warm
 * with a board still to land, the opening cover rested the canvas, and the
 * stop's art was first uploaded, and its program compiled, at its cut.
 */
export function paintsPending(): number {
  return pending;
}

/**
 * Calls `listener` whenever `paintsPending` changes: a set asks for its
 * boards, or one lands. Warmup rests once every stop is warm and looks
 * again then.
 */
export function onPaintsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Runs after the next frame (a task after it with no frames, as in Node). */
function afterFrame(run: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(run, 0));
  else setTimeout(run, 0);
}

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
  let landed = false;
  setPending(pending + 1);
  const land = () => {
    if (landed) return;
    landed = true;
    setPending(pending - 1);
  };
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
        afterFrame(land);
      },
      (error: unknown) => {
        land();
        console.error(error);
      },
    );
  });
  return () => {
    cancelled = true;
    land();
    job?.cancel();
    if (made) release(made.value);
  };
}
