/**
 * Work for the moments the page has nothing else to do: the browser's idle
 * periods, after a frame's own work and before the next one is due. The
 * night's code fetched ahead (night/prefetch.ts), its window atlas painted
 * a room at a time, its stops warmed up while it rests, its boards painted
 * while she is not scrolling: each of them, run when it came up, was a
 * long task in the middle of her drive.
 */

/** An idle period as the browser hands it over (its own IdleDeadline): how long is left, and whether it came by the timeout. */
export type IdleSlice = { readonly didTimeout: boolean; timeRemaining(): number };

/** Where idle periods come from (the browser's; a fake in the tests). */
export type IdleScheduler = {
  /** Calls `run` in an idle period, or once `timeoutMs` has passed whatever the page is doing. */
  request(run: (slice: IdleSlice) => void, timeoutMs: number): unknown;
  cancel(handle: unknown): void;
};

/**
 * What the fallback offers a callback, in milliseconds. A browser without
 * requestIdleCallback (Safari) never says how long it is idle; right after
 * a frame is when the most of one is left.
 */
export const FALLBACK_SLICE_MS = 8;

function fallbackIdle(): IdleScheduler {
  const slice = (start: number): IdleSlice => ({
    didTimeout: false,
    timeRemaining: () => Math.max(0, start + FALLBACK_SLICE_MS - performance.now()),
  });
  return {
    request(run) {
      const handle = { timer: undefined as ReturnType<typeof setTimeout> | undefined, frame: 0, cancelled: false };
      const go = () => {
        handle.timer = setTimeout(() => {
          if (!handle.cancelled) run(slice(performance.now()));
        }, 0);
      };
      // After the next frame, in a task of its own (no frame in a hidden tab: it waits, as idle periods do).
      if (typeof requestAnimationFrame === "function") handle.frame = requestAnimationFrame(go);
      else go();
      return handle;
    },
    cancel(handle) {
      const own = handle as { timer?: ReturnType<typeof setTimeout>; frame: number; cancelled: boolean };
      own.cancelled = true;
      if (own.frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(own.frame);
      if (own.timer !== undefined) clearTimeout(own.timer);
    },
  };
}

/** The browser's idle periods: requestIdleCallback where there is one, else right after a frame. */
export function browserIdle(): IdleScheduler {
  if (typeof requestIdleCallback !== "function") return fallbackIdle();
  return {
    request: (run, timeoutMs) => requestIdleCallback(run, timeoutMs > 0 ? { timeout: timeoutMs } : undefined),
    cancel: (handle) => cancelIdleCallback(handle as number),
  };
}

export type IdleLoopOptions = {
  /** The longest a step waits for an idle period: past it, one step runs whatever the page is doing. */
  timeoutMs?: number;
  /**
   * A step starts only with more than this left of the period (ms): a step
   * is not cut short, so one started on the last scrap of a period ran
   * into the next frame.
   */
  reserveMs?: number;
  scheduler?: IdleScheduler;
};

export type IdleLoop = {
  /** Asks for an idle period (nothing if one is asked for already, or the loop is stopped). */
  wake(): void;
  /** For good: a period already asked for is cancelled, and a wake does nothing. */
  stop(): void;
};

/**
 * Runs `step` in idle periods while it has work: as many steps as a
 * period has room for (`timeRemaining` over `reserveMs`), and exactly one
 * in a period that came by its timeout, so a page that is never idle
 * still gets there. `step` returns true when it has more to do now; false
 * parks the loop until `wake` (a promise it waits on settling, something
 * new to do). A step that throws parks it too.
 */
export function createIdleLoop(step: () => boolean, options: IdleLoopOptions = {}): IdleLoop {
  const { timeoutMs = 1000, reserveMs = 2, scheduler = browserIdle() } = options;
  let handle: unknown = null;
  let asked = false;
  let stopped = false;

  const ask = () => {
    asked = true;
    handle = scheduler.request(run, timeoutMs);
  };

  function run(slice: IdleSlice) {
    asked = false;
    handle = null;
    if (stopped) return;
    let more = true;
    // A period with no room for a step waits for the next one, unless the step has waited long enough.
    if (slice.didTimeout || slice.timeRemaining() > reserveMs) {
      do {
        more = step();
      } while (more && !stopped && slice.timeRemaining() > reserveMs);
    }
    // A step may have woken the loop itself (asked again already).
    if (more && !stopped && !asked) ask();
  }

  return {
    wake() {
      if (!stopped && !asked) ask();
    },
    stop() {
      stopped = true;
      if (asked) scheduler.cancel(handle);
      asked = false;
      handle = null;
    },
  };
}
