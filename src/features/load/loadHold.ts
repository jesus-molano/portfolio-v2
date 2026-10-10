/**
 * Whether a save is loading under the load screen, for the code that must
 * wait for it (tested in loadHold.test.ts): the start menu's release of
 * the page queues behind it (`afterLoadHold`), PageEntry leaves the
 * landing to it (`loadOwnsEntry`), and the scenes' performance monitors
 * ignore the compile frames under it (a load must never step a slow phone
 * down for the visit). The screen itself registers how a load begins
 * (`registerLoadCurtain`), so the menus call `beginLoad` without knowing
 * it.
 */
import type { EnteredVia } from "@/features/hero/sceneLoading";
import type { Save } from "./saves";

export type LoadOptions = {
  /** From the start menu (before she is in: the screen owns the landing) or from the page controls. */
  mode: "start" | "page";
  via: EnteredVia;
  /** The slot's picture as the menu showed it (already in the cache). */
  picture: string;
};

let holding = false;
let owns = false;
let queue: (() => void)[] = [];
const listeners = new Set<() => void>();
let begin: ((save: Save, options: LoadOptions) => boolean) | null = null;

function notify() {
  for (const listener of listeners) listener();
}

export function isLoadHolding(): boolean {
  return holding;
}

/** Server render and hydration: nothing loading. */
export function getServerLoadHolding(): boolean {
  return false;
}

export function subscribeLoadHold(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Runs `fn` now, or once the load screen has lifted, in the order they came. */
export function afterLoadHold(fn: () => void): void {
  if (!holding) fn();
  else queue.push(fn);
}

/** The start menu's load: the screen lands the page and gives the focus, not PageEntry. */
export function loadOwnsEntry(): boolean {
  return holding && owns;
}

export function startHold({ ownsEntry }: { ownsEntry: boolean }): void {
  holding = true;
  owns = ownsEntry;
  notify();
}

export function endHold(): void {
  if (!holding) return;
  holding = false;
  owns = false;
  const waiting = queue;
  queue = [];
  for (const fn of waiting) fn();
  notify();
}

export function registerLoadCurtain(next: (save: Save, options: LoadOptions) => boolean): () => void {
  begin = next;
  return () => {
    if (begin === next) begin = null;
  };
}

/** Loads a save under the screen; false when no screen is there to take it (the caller jumps itself). */
export function beginLoad(save: Save, options: LoadOptions): boolean {
  return begin ? begin(save, options) : false;
}
