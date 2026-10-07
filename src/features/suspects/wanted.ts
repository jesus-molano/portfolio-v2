/**
 * Dante's wanted level, live: STATS's record (`stats.records.items`,
 * `wanted`) shows one star until she has tried to choose him in the
 * character select, and one more for every try, up to five, the GTA
 * escalation. Remembered per visitor (localStorage), read and written in
 * try/catch: a private window or blocked storage simply starts at one star
 * every visit. The server renders one star; five fixed star slots keep the
 * record's size whatever the level.
 *
 * The pure part (`parseTries`, `wantedLevel`, `raised`) is tested; the
 * store below is the client's (useSyncExternalStore in WantedLevel.tsx,
 * `tryDante` from the select).
 */

/** Where the tries are kept (localStorage), and the level STATS last showed (for its flash). */
export const WANTED_KEY = "va-dante-tries";
export const WANTED_SEEN_KEY = "va-dante-seen";

/** The top of the scale: five stars. */
export const WANTED_MAX = 5;

/** A stored count of tries: a whole number from 0, anything else is none. */
export function parseTries(raw: string | null | undefined): number {
  if (raw == null || !/^\d{1,6}$/.test(raw.trim())) return 0;
  return Number(raw.trim());
}

/** The stars for `tries` attempts to choose him: one to begin with, one more a try, five at most. */
export function wantedLevel(tries: number): number {
  const n = Number.isFinite(tries) ? Math.max(0, Math.floor(tries)) : 0;
  return Math.min(WANTED_MAX, 1 + n);
}

/**
 * The level went up since STATS last showed it: the stars flash once. Before
 * STATS ever showed it (the usual path: the select comes first), it showed
 * one star, the server's.
 */
export function raised(level: number, seen: number | null): boolean {
  return level > (seen ?? 1);
}

/** The level STATS last showed, or null before it ever showed one. */
export function parseSeen(raw: string | null | undefined): number | null {
  if (raw == null || !/^[1-5]$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

// ---------------------------------------------------------------- the client store

const listeners = new Set<() => void>();
let tries: number | null = null;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: the level lives for this page only.
  }
}

function current(): number {
  if (tries === null) tries = typeof window === "undefined" ? 0 : parseTries(read(WANTED_KEY));
  return tries;
}

/** Dante's level for this visitor (1 to 5). */
export function getWanted(): number {
  return wantedLevel(current());
}

/** The server's level: one star. */
export function getServerWanted(): number {
  return 1;
}

export function subscribeWanted(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== WANTED_KEY) return;
    tries = parseTries(event.newValue);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** She tried to choose Dante: one more star, up to five. */
export function tryDante(): void {
  const next = Math.min(WANTED_MAX - 1, current() + 1);
  if (next === tries) return;
  tries = next;
  write(WANTED_KEY, String(next));
  for (const listener of listeners) listener();
}

/** The level STATS last showed, and now shows. */
export function readSeen(): number | null {
  return typeof window === "undefined" ? null : parseSeen(read(WANTED_SEEN_KEY));
}

export function markSeen(level: number): void {
  write(WANTED_SEEN_KEY, String(level));
}
