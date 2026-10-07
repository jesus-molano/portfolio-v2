import { describe, expect, it } from "vitest";
import { createRangeGuard } from "./rangeGuard";

describe("createRangeGuard", () => {
  it("gives back the value a touch found when the browser takes the swipe", () => {
    const guard = createRangeGuard();
    guard.down("touch", 100);
    expect(guard.cancel()).toBe(100);
  });

  it("keeps what a tap or a drag along the track set", () => {
    const guard = createRangeGuard();
    guard.down("touch", 100);
    guard.up();
    expect(guard.cancel()).toBeNull();
  });

  it("never touches the mouse or a pen", () => {
    const guard = createRangeGuard();
    guard.down("mouse", 60);
    expect(guard.cancel()).toBeNull();
    guard.down("pen", 60);
    expect(guard.cancel()).toBeNull();
  });

  it("restores once per touch", () => {
    const guard = createRangeGuard();
    guard.down("touch", 40);
    expect(guard.cancel()).toBe(40);
    expect(guard.cancel()).toBeNull();
  });
});
