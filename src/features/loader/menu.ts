/**
 * The start menu's rules, pure and tested (menu.test.ts); LoadingScreen.tsx
 * wires them up. Four items, a game's main menu: NEW GAME (in with the
 * radio), CONTINUE (in without music), LOAD GAME (the save slots: straight
 * into any part of the page, src/features/load) and SETTINGS (the same
 * settings as the pause menu's). The two ways in wait for the scene; LOAD
 * GAME and SETTINGS open at once (a slot, too, waits for the scene).
 */

export const MENU_ITEMS = ["newGame", "continue", "load", "settings"] as const;
export type MenuItem = (typeof MENU_ITEMS)[number];

/**
 * Where an item stands. `wait`: a way in while the city loads (she can
 * select it, choosing it only says "not yet"). `early`: a way in on a slow
 * load, on offer before the city is in. `ready`: it does what it says.
 */
export type ItemState = "wait" | "early" | "ready";

export function itemState(item: MenuItem, { loaded, slow }: { loaded: boolean; slow: boolean }): ItemState {
  if (item === "settings" || item === "load" || loaded) return "ready";
  return slow ? "early" : "wait";
}

/** Whether choosing the item does something now (LOAD GAME and SETTINGS always; a way in once loaded or slow). */
export function canChoose(item: MenuItem, loading: { loaded: boolean; slow: boolean }): boolean {
  return itemState(item, loading) !== "wait";
}

export type MenuKeyEvent = {
  key: string;
  code: string;
  repeat?: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey?: boolean;
  isComposing: boolean;
};

export type MenuMove = "up" | "down" | "first" | "last";

/**
 * The menu's keys, as a game's: the arrows, and W and S by their place on
 * the keyboard (`code`, so AZERTY's Z and S move it too); Home and End go
 * to the first and the last item. Held, they keep moving (a game's menu
 * repeats). Enter and Space choose, on the focused item itself (it is a
 * button); no other key does anything, so a key typed by accident never
 * starts the game. Never with Ctrl, Alt or Meta (a shortcut), nor in the
 * middle of an IME composition.
 */
export function menuMove(event: MenuKeyEvent): MenuMove | null {
  if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return null;
  if (event.key === "ArrowUp" || event.code === "KeyW") return "up";
  if (event.key === "ArrowDown" || event.code === "KeyS") return "down";
  if (event.key === "Home") return "first";
  if (event.key === "End") return "last";
  return null;
}

/** The item a move lands on: up and down wrap around, like a game's menu. */
export function moveSelection(index: number, move: MenuMove, count: number = MENU_ITEMS.length): number {
  if (move === "first") return 0;
  if (move === "last") return count - 1;
  const step = move === "up" ? -1 : 1;
  return (((index + step) % count) + count) % count;
}

/**
 * Roughly how wide, in ems of the marquee face (Bebas Neue, uppercase), the
 * longest item word is: the menu's CSS sizes the words so it fits the
 * menu's width ("CONFIGURACIÓN" is far longer than "SETTINGS"). Bebas
 * Neue's capitals average 0.4 em, I and J about half that.
 */
export function longestEm(words: readonly string[]): number {
  const em = (word: string) =>
    Array.from(word.toUpperCase()).reduce((sum, ch) => sum + (ch === " " ? 0.2 : /[IJ1]/.test(ch) ? 0.2 : /[MW]/.test(ch) ? 0.52 : 0.41), 0);
  return Math.round(Math.max(...words.map(em)) * 100) / 100;
}
