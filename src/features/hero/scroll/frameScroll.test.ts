import { describe, expect, it, vi } from "vitest";
import { frameScroll, refreshFrameScroll, takeFrameScroll } from "./frameScroll";

describe("frameScroll", () => {
  it("gives every tick of a frame the reading taken after Lenis, without reading the page again", () => {
    takeFrameScroll(1.25, 640);
    const read = vi.fn(() => 999);
    expect(frameScroll(1.25, read)).toBe(640);
    expect(frameScroll(1.25, read)).toBe(640);
    expect(read).not.toHaveBeenCalled();
  });

  it("reads the page once in a frame with no reading taken (Lenis not there yet), and keeps it for the frame", () => {
    takeFrameScroll(2, 100);
    const read = vi.fn(() => 300);
    expect(frameScroll(2.016, read)).toBe(300);
    expect(frameScroll(2.016, read)).toBe(300);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("follows a gate that moved the page in the frame", () => {
    takeFrameScroll(3, 5000);
    refreshFrameScroll(() => 4200);
    expect(frameScroll(3, () => 999)).toBe(4200);
  });

  it("never hands a frame the last frame's reading", () => {
    takeFrameScroll(4, 10);
    expect(frameScroll(4.016, () => 20)).toBe(20);
    takeFrameScroll(4.033, 30);
    expect(frameScroll(4.033, () => 999)).toBe(30);
  });
});
