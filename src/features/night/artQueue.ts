import { scrollInput } from "@/features/hero/scroll/heroProgress";
import { browserIdle, type IdleScheduler } from "@/lib/idle";

/**
 * The night's board art, painted in turns. Every set paints its boards
 * once its faces are in (artCanvas.ts loadFaces), and with the faces
 * already loaded all five sets' painters ran back to back in one task as
 * the night mounted: up to twenty seconds without a frame or an answer to
 * a touch on a mid-range phone, at the character select's wall. Here a
 * painter runs one step per task, the stop she will see first first
 * (`rank`, read as each step is picked). A painter is a function (one
 * step) or a generator that yields between its steps (Logixs' wall, cell
 * by cell).
 *
 * A step for the stop on screen or a stop beside it (`nearStop`) runs after
 * the next frame: she is looking at the one, and the next she reaches,
 * whichever way she drives, is one of the others. One further off waits
 * for a quiet moment (`mayPaint`): an idle period with no scroll of hers and
 * no move of the page in the last 200 ms, a second at most. A step is 50 to
 * 600 ms on a phone (a grain pass over every pixel of a big board), and run
 * a frame apart they landed as hitches all through her drive into the
 * city. Only the stop on screen went at once at first: back up from STATS
 * with the wheel, never still, Logixs' wall (a dozen steps) waited its
 * second a step all through Heuristik's stretch, and she reached a bare
 * wall that then painted frame after frame in front of her.
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

/**
 * The furthest rank (stopRank) that paints after the next frame: the stop on
 * screen (0), the stop ahead (2) and the stop behind (3).
 */
export const NEAR_RANK = 3;

/** Whether a stop of this rank is the one on screen or one beside it: she reaches it next, whichever way she drives. */
export function nearStop(rank: number): boolean {
  return rank <= NEAR_RANK;
}

/** How long the page must have been still before a step for a stop further off paints, and the longest such a step waits (ms). */
export const PAINT_GATE = { quietMs: 200, timeoutMs: 1000 } as const;

/**
 * Whether a step that has waited since `since` may paint at `now`: at once
 * for the stop on screen or one beside it (`urgent`), else once nothing
 * has scrolled for `quietMs` (`scrolledAt`: her last input or the page's
 * last move), or once it has waited `timeoutMs` (a visitor who never stops
 * still gets her boards).
 */
export function mayPaint(urgent: boolean, now: number, since: number, scrolledAt: number): boolean {
  return urgent || now - scrolledAt >= PAINT_GATE.quietMs || now - since >= PAINT_GATE.timeoutMs;
}

/** Schedules a step that may wait: `run` once `urgent()` holds or the page is quiet (`mayPaint`). */
export type Wait = (run: () => void, urgent: () => boolean) => void;

/**
 * Waits in idle periods for a quiet moment (`mayPaint`), looking again at
 * each one; `scrolledAt` is her last scroll or the page's last move.
 */
export function createQuietWait(idle: IdleScheduler, now: () => number, scrolledAt: () => number): Wait {
  return (run, urgent) => {
    const since = now();
    const look = () => {
      const at = now();
      if (mayPaint(urgent(), at, since, scrolledAt())) run();
      else idle.request(look, Math.max(1, since + PAINT_GATE.timeoutMs - at));
    };
    idle.request(look, PAINT_GATE.timeoutMs);
  };
}

/** When the page last moved under her (a scroll event: her input, Lenis' glide after it, the browser's own fling). */
let movedAt = Number.NEGATIVE_INFINITY;
let watching = false;

/** Her last scroll input (heroProgress `scrollInput`, the pedal held too) or the page's last move, whichever is later. */
function lastScroll(): number {
  if (!watching && typeof window !== "undefined") {
    watching = true;
    window.addEventListener(
      "scroll",
      () => {
        movedAt = performance.now();
      },
      { passive: true },
    );
  }
  return Math.max(scrollInput.at, movedAt);
}

/** The page's own wait: its idle periods, its clock, its scroll. */
function quietWait(): Wait {
  let wait: Wait | null = null;
  return (run, urgent) => {
    wait ??= createQuietWait(browserIdle(), () => performance.now(), lastScroll);
    wait(run, urgent);
  };
}

/**
 * A queue of painters; `defer` schedules the next step when it is for the
 * stop on screen or one beside it, `wait` when it is for one further off
 * (tests pass their own).
 */
export function createArtQueue(defer: (run: () => void) => void = afterFrame, wait: Wait = quietWait()) {
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

  /** The next step is for the stop on screen or one beside it. */
  const urgent = () => {
    const job = nextJob(jobs);
    return job !== undefined && nearStop(job.rank());
  };

  const schedule = () => {
    if (waiting || jobs.length === 0) return;
    waiting = true;
    if (urgent()) defer(runOne);
    else wait(runOne, urgent);
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

/**
 * How soon she reaches stop `index` from the stop on screen (0: that one).
 * The film runs from the first stop to the last, never round: nearer
 * first, and the stop ahead before the one behind at equal distance (from
 * STATS, Logixs right after Heuristik, the army last).
 */
export function stopRank(index: number, current: number): number {
  const ahead = index - current;
  return ahead >= 0 ? 2 * ahead : 1 - 2 * ahead;
}

/** The stops in the order she reaches them from `current` (stopRank): the warm-up's order. */
export function stopOrder(count: number, current: number): number[] {
  return Array.from({ length: count }, (_, i) => i).sort((a, b) => stopRank(a, current) - stopRank(b, current));
}
