import { describe, expect, it } from "vitest";
import { tallestCards } from "./chipPlace";

describe("tallestCards", () => {
  it("keeps each stop's tallest card, rounded up to a whole pixel", () => {
    expect(tallestCards([55, 81.2, 55, 34, 107.5], [0, 0, 1, 2, 2], 3)).toEqual([82, 55, 108]);
  });

  it("ignores the bridge card, which belongs to no stop", () => {
    expect(tallestCards([200, 55], [-1, 0], 1)).toEqual([55]);
  });

  it("gives a stop with no measured card nothing to clear", () => {
    expect(tallestCards([55], [0], 2)).toEqual([55, 0]);
  });
});
