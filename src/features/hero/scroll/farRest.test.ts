import { describe, expect, it } from "vitest";
import { PUSH_QUIET_MS, restsFarAway } from "./farRest";

const vh = 800;
// A stage from 0 to 5600 px (a 6-screen film and its pinned frame).
const base = { wallsOpen: true, scroll: 20_000, top: 0, bottom: 5600, vh, pressure: 0, sincePush: 60_000, pedalDown: false, scrolling: false };

describe("restsFarAway", () => {
  it("rests more than a screen below the stage, every wall open, nothing in flight", () => {
    expect(restsFarAway(base)).toBe(true);
    expect(restsFarAway({ ...base, scroll: 5600 + vh + 1 })).toBe(true);
  });

  it("runs within a screen of the stage, or on it", () => {
    expect(restsFarAway({ ...base, scroll: 5600 + vh })).toBe(false);
    expect(restsFarAway({ ...base, scroll: 5600 })).toBe(false);
    expect(restsFarAway({ ...base, scroll: 2000 })).toBe(false);
  });

  it("rests more than a screen above a stage further down the page", () => {
    const below = { ...base, top: 10_000, bottom: 16_000 };
    expect(restsFarAway({ ...below, scroll: 0 })).toBe(true);
    expect(restsFarAway({ ...below, scroll: 10_000 - 2 * vh - 1 })).toBe(true);
    expect(restsFarAway({ ...below, scroll: 10_000 - 2 * vh })).toBe(false);
  });

  it("rests far below the screen whatever its walls, its motion or the pressure held (the career city under the hero)", () => {
    const below = { ...base, top: 10_000, bottom: 16_000, scroll: 3000 };
    expect(restsFarAway({ ...below, wallsOpen: false })).toBe(true);
    expect(restsFarAway({ ...below, wallsOpen: false, scrolling: true, pedalDown: true })).toBe(true);
    expect(restsFarAway({ ...below, wallsOpen: false, pressure: 40, sincePush: 0 })).toBe(true);
  });

  it("runs the frame the page comes within a screen of it, walls closed (a jump lands its gate in the same frame)", () => {
    const below = { ...base, top: 10_000, bottom: 16_000, wallsOpen: false };
    expect(restsFarAway({ ...below, scroll: 10_000 - 2 * vh })).toBe(false);
    // The scrollbar dragged onto the stage, or past its wall: this frame's reading sees it.
    expect(restsFarAway({ ...below, scroll: 10_500 })).toBe(false);
    expect(restsFarAway({ ...below, scroll: 20_000 })).toBe(false);
  });

  it("always runs with a wall closed once the page is at or past a screen above the stage (the scrollbar's pullback)", () => {
    expect(restsFarAway({ ...base, wallsOpen: false })).toBe(false);
  });

  it("runs while anything of hers is in flight", () => {
    expect(restsFarAway({ ...base, pedalDown: true })).toBe(false);
    expect(restsFarAway({ ...base, scrolling: true })).toBe(false);
    expect(restsFarAway({ ...base, pressure: 3 })).toBe(false);
    expect(restsFarAway({ ...base, sincePush: PUSH_QUIET_MS - 1 })).toBe(false);
  });
});
