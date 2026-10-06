import { describe, expect, it } from "vitest";
import { canChoose, itemState, MENU_ITEMS, type MenuKeyEvent, menuMove, moveSelection } from "./menu";

const key = (value: string, code = "", extra: Partial<MenuKeyEvent> = {}): MenuKeyEvent => ({
  key: value,
  code,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  isComposing: false,
  ...extra,
});

describe("the start menu's items", () => {
  it("are NEW GAME, CONTINUE and SETTINGS, in that order", () => {
    expect(MENU_ITEMS).toEqual(["newGame", "continue", "settings"]);
  });

  it("keep the two ways in waiting for the city, and SETTINGS working at once", () => {
    const loading = { loaded: false, slow: false };
    expect(itemState("newGame", loading)).toBe("wait");
    expect(itemState("continue", loading)).toBe("wait");
    expect(itemState("settings", loading)).toBe("ready");
    expect(canChoose("newGame", loading)).toBe(false);
    expect(canChoose("settings", loading)).toBe(true);
  });

  it("offer the way in early on a slow load, and as they say once the city is in", () => {
    expect(itemState("newGame", { loaded: false, slow: true })).toBe("early");
    expect(canChoose("continue", { loaded: false, slow: true })).toBe(true);
    for (const item of MENU_ITEMS) expect(itemState(item, { loaded: true, slow: false })).toBe("ready");
    for (const item of MENU_ITEMS) expect(itemState(item, { loaded: true, slow: true })).toBe("ready");
  });
});

describe("the menu's keys", () => {
  it("move with the arrows, and with W and S by their place on the keyboard", () => {
    expect(menuMove(key("ArrowUp", "ArrowUp"))).toBe("up");
    expect(menuMove(key("ArrowDown", "ArrowDown"))).toBe("down");
    expect(menuMove(key("w", "KeyW"))).toBe("up");
    expect(menuMove(key("s", "KeyS"))).toBe("down");
    // AZERTY: the key in W's place types Z.
    expect(menuMove(key("z", "KeyW"))).toBe("up");
    expect(menuMove(key("W", "KeyW", { shiftKey: true }))).toBe("up");
    expect(menuMove(key("Home", "Home"))).toBe("first");
    expect(menuMove(key("End", "End"))).toBe("last");
  });

  it("keep moving while held, like a game's menu", () => {
    expect(menuMove(key("ArrowDown", "ArrowDown", { repeat: true }))).toBe("down");
  });

  it("start nothing on any other key: no 'press any key' that enters by accident", () => {
    for (const [value, code] of [
      ["a", "KeyA"],
      ["7", "Digit7"],
      ["Enter", "Enter"],
      [" ", "Space"],
      ["Escape", "Escape"],
      ["Tab", "Tab"],
      ["PageDown", "PageDown"],
      ["q", "KeyQ"],
    ]) {
      expect(menuMove(key(value, code)), value).toBeNull();
    }
  });

  it("leave shortcuts and IME compositions alone", () => {
    expect(menuMove(key("s", "KeyS", { ctrlKey: true }))).toBeNull(); // Ctrl+S
    expect(menuMove(key("w", "KeyW", { metaKey: true }))).toBeNull(); // Cmd+W
    expect(menuMove(key("ArrowDown", "ArrowDown", { altKey: true }))).toBeNull();
    expect(menuMove(key("s", "KeyS", { isComposing: true }))).toBeNull();
  });

  it("wrap around at both ends", () => {
    expect(moveSelection(0, "up")).toBe(2);
    expect(moveSelection(2, "down")).toBe(0);
    expect(moveSelection(1, "down")).toBe(2);
    expect(moveSelection(1, "first")).toBe(0);
    expect(moveSelection(0, "last")).toBe(2);
  });
});
