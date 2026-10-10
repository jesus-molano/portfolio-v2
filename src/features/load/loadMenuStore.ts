/**
 * Whether the page's load menu is open, and who opened it (the focus goes
 * back there when it closes without loading): the page controls' button
 * opens it, LoadGame.tsx draws it. A tiny store for useSyncExternalStore.
 */

let open = false;
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === open) return;
  open = next;
  listeners.forEach((listener) => listener());
}

export function isLoadMenuOpen(): boolean {
  return open;
}

/** Server render and hydration: closed. */
export function isLoadMenuOpenOnServer(): boolean {
  return false;
}

export function subscribeLoadMenu(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openLoadMenu(from: HTMLElement | null = null) {
  opener = from;
  set(true);
}

export function closeLoadMenu() {
  set(false);
}

/** Who opened it, once: the focus goes back there. */
export function takeLoadOpener(): HTMLElement | null {
  const element = opener;
  opener = null;
  return element;
}
