import { describe, expect, it } from "vitest";
import { volumeAt } from "./player";

describe("volumeAt", () => {
  it("interpolates linearly over the fade", () => {
    expect(volumeAt(0, 0.5, 0, 1000)).toBe(0);
    expect(volumeAt(0, 0.5, 500, 1000)).toBeCloseTo(0.25, 10);
    expect(volumeAt(0, 0.5, 1000, 1000)).toBe(0.5);
    expect(volumeAt(0.5, 0, 250, 1000)).toBeCloseTo(0.375, 10);
  });

  it("never leaves [0, 1] when the frame time comes before the start", () => {
    // Seen in the browser: a fade in with elapsed -0.4 ms gave -0.000147.
    expect(volumeAt(0, 0.55, -0.4, 1500)).toBe(0);
    expect(volumeAt(0.55, 0, 1600, 500)).toBe(0);
    expect(volumeAt(0.9, 1.4, 1000, 1000)).toBe(1);
  });

  it("jumps to the target for a zero-length fade", () => {
    expect(volumeAt(0.2, 0.55, 0, 0)).toBe(0.55);
  });
});
