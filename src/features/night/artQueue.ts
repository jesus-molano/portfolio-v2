/**
 * The night's board art, painted in turns. Every set paints its boards
 * once its faces are in (artCanvas.ts loadFaces), and with the faces
 * already loaded all five sets' painters ran back to back in one task as
 * the night mounted: up to twenty seconds without a frame or an answer to
 * a touch on a mid-range phone, at the character select's wall. Here a
 * painter runs one step per task, a frame between two steps, the stop she
 * will see first first (`rank`, read as each step is picked). A painter is
 * a function (one step) or a generator that yields between its steps
 * (Logixs' wall, cell by cell).
 */

export type Painter<T> = (() => T) | Generator<unknown, T, unknown>;

type Job = {
  rank: () => number;
  order: number;
  step: () => IteratorResult<unknown, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

/** The waiting job to run next: the lowest rank, the earliest asked among equals. */
export function nextJob<J extends { rank: () => number; order: number }>(jobs: readonly J[]): J | undefined {
  let best: J | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const job of jobs) {
    const rank = job.rank();
    if (best === undefined || rank < bestRank || (rank === bestRank && job.order < best.order)) {
      best = job;
      bestRank = rank;
    }
  }
  return best;
}

/** Runs a step after the next frame, in a task of its own (no frame in a hidden tab: it waits). */
function afterFrame(run: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(run, 0));
  else setTimeout(run, 0);
}

/** A queue of painters; `defer` schedules its next step (tests pass their own). */
export function createArtQueue(defer: (run: () => void) => void = afterFrame) {
  const jobs: Job[] = [];
  let order = 0;
  let waiting = false;

  const remove = (job: Job) => {
    const at = jobs.indexOf(job);
    if (at >= 0) jobs.splice(at, 1);
  };

  const runOne = () => {
    waiting = false;
    const job = nextJob(jobs);
    if (!job) return;
    try {
      const result = job.step();
      if (result.done) {
        remove(job);
        job.resolve(result.value);
      }
    } catch (error) {
      remove(job);
      job.reject(error);
    }
    schedule();
  };

  const schedule = () => {
    if (waiting || jobs.length === 0) return;
    waiting = true;
    defer(runOne);
  };

  /** Paints in turn; `cancel` drops a painter that has not finished (its promise never settles). */
  function paint<T>(painter: Painter<T>, rank: () => number = () => 0): { done: Promise<T>; cancel: () => void } {
    let job: Job | undefined;
    const done = new Promise<T>((resolve, reject) => {
      const step: Job["step"] =
        typeof painter === "function" ? () => ({ done: true, value: painter() }) : () => painter.next();
      job = { rank, order: order++, step, resolve: resolve as (value: unknown) => void, reject };
      jobs.push(job);
    });
    schedule();
    return {
      done,
      cancel: () => {
        if (job) remove(job);
        if (typeof painter === "function") return;
        try {
          painter.return(undefined as T);
        } catch {
          // Cancelled from inside its own step: out of the queue, it is never stepped again.
        }
      },
    };
  }

  return { paint, pending: () => jobs.length };
}

/** The page's one queue: every set of the night paints through it. */
export const artQueue = createArtQueue();

/** How soon she reaches stop `index` (0 next), counting on from the stop on screen. */
export function stopRank(index: number, current: number, count = 5): number {
  return (((index - current) % count) + count) % count;
}
