import { browserIdle, type IdleScheduler } from "@/lib/idle";

/**
 * The night's code fetched ahead, in idle time. Left to next/dynamic, the
 * chunk (the scene, its five sets, drei's environment) was fetched,
 * parsed and run only as the stage came near, right as she chose him at
 * the character select, and the mount waited on it. Now it is asked for
 * once the hero has settled (NightCanvas) and when LOAD GAME opens (a jump
 * into the city may follow), in an idle period, and the same import feeds
 * NightCanvas's `dynamic()`. Only the code, and the window atlas it paints
 * ahead a room at a time (`paintNightAhead`): never the mount, which waits
 * for the stage to come near and for her choice at the character select
 * (selectWall.ts). Nothing is fetched for a visitor who asked to save data
 * (`navigator.connection.saveData`) or where the night never mounts
 * (reduced motion: the city is plates).
 */

/** The longest the prefetch waits for an idle period: the hero's loads come first. */
export const PREFETCH_TIMEOUT_MS = 4000;

/** One import for everyone who asks; a failed one is tried again on the next ask (the mount's own, after a prefetch). */
export function sharedImport<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () => {
    if (!loading) {
      const made = load();
      loading = made;
      made.catch(() => {
        if (loading === made) loading = null;
      });
    }
    return loading;
  };
}

/** The night scene's module: the prefetch's and NightCanvas's `dynamic()`. */
export const loadNightScene = sharedImport(() => import("./NightScene"));

/** She asked her browser to spend as little data as it can. */
function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** The night never mounts under reduced motion (WorkStage shows its plates). */
function prefersStill(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The prefetch, asked for once a visit: the module in an idle period (at
 * most `PREFETCH_TIMEOUT_MS` later), then the window atlas painted ahead.
 * Every later call does nothing.
 */
export function createPrefetch(load: () => Promise<{ paintNightAhead(): void }>, idle: () => IdleScheduler = browserIdle) {
  let asked = false;
  return () => {
    if (asked || typeof window === "undefined") return;
    asked = true;
    if (savesData() || prefersStill()) return;
    idle().request(() => {
      load().then(
        (night) => night.paintNightAhead(),
        // The mount asks again, and its error boundary hears a second failure.
        () => undefined,
      );
    }, PREFETCH_TIMEOUT_MS);
  };
}

/** Asks for the night's code ahead (see above): once the hero has settled, and when LOAD GAME opens. */
export const prefetchNightScene = createPrefetch(loadNightScene);
