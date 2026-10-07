import { describe, expect, it } from "vitest";
import { GATE } from "@/features/hero/scroll/gate";
import { FLING_WINDOW_MS, INPUT_WINDOW_MS } from "@/lib/navigate";
import { BAR_WINDOW_MS, isStacked, keyAtWall, keyForward, PULL_WINDOW_MS, selectFrontier, selectGate, wallVerdict } from "./selectWall";

describe("selectFrontier", () => {
  it("stands where the select's foot meets the bottom of the screen", () => {
    expect(selectFrontier({ top: 5000, bottom: 6200 }, 900)).toBe(5300);
  });

  it("keeps his crown in view under the page controls when his strip stands under the cats' (a phone)", () => {
    // A phone: the select runs 2200 px; his crown is 1300 px down it.
    expect(selectFrontier({ top: 5000, bottom: 7200 }, 844, { top: 6300, stacked: true }, 112)).toBe(6188);
    // A wide screen where it fits: the foot decides.
    expect(selectFrontier({ top: 5000, bottom: 5900 }, 900, { top: 5136, stacked: false }, 112)).toBe(5000);
    expect(selectFrontier({ top: 5000, bottom: 6200 }, 900, { top: Number.NaN, stacked: true }, 112)).toBe(5300);
  });

  it("lets the foot decide with the five in one row, even when the row is taller than the screen", () => {
    // 1366 x 657: plates at 688 px; held at his crown they were cut off.
    expect(selectFrontier({ top: 4000, bottom: 4000 + 1100 }, 657, { top: 4100, stacked: false }, 112)).toBe(4443);
    // 844 x 390, a phone on its side: the whole 1118 px select is reachable.
    expect(selectFrontier({ top: 2000, bottom: 3118 }, 390, { top: 2150, stacked: false }, 112)).toBe(2728);
  });

  it("knows his strip is stacked only when it starts under every cat's", () => {
    expect(isStacked({ top: 900 }, [{ bottom: 400 }, { bottom: 400 }, { bottom: 800 }, { bottom: 800 }])).toBe(true);
    expect(isStacked({ top: 100 }, [{ bottom: 500 }, { bottom: 500 }, { bottom: 500 }, { bottom: 500 }])).toBe(false);
    expect(isStacked({ top: 100 }, [])).toBe(false);
  });

  it("never stands above the select's own top", () => {
    expect(selectFrontier({ top: 5000, bottom: 5600 }, 900)).toBe(5000);
  });

  it("starts open: nothing holds before the select has measured", () => {
    expect(selectGate.maxScroll).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("wallVerdict", () => {
  const at = { wall: 5300, now: 10_000 };

  it("does nothing while the page is at or before the wall, or within its slop", () => {
    expect(wallVerdict({ ...at, scroll: 5000, lastInputAt: 0 })).toBe("none");
    expect(wallVerdict({ ...at, scroll: 5300 + GATE.snapSlop, lastInputAt: 0 })).toBe("none");
    expect(wallVerdict({ ...at, wall: Number.POSITIVE_INFINITY, scroll: 99_999, lastInputAt: 0 })).toBe("none");
  });

  it("puts the page back when her own input took it past: a wheel, a finger, a key, a fling, the scrollbar", () => {
    const past = { ...at, scroll: 5400 };
    expect(wallVerdict({ ...past, lastInputAt: at.now - 10 })).toBe("back");
    expect(wallVerdict({ ...past, lastInputAt: at.now - INPUT_WINDOW_MS + 1 })).toBe("back");
    expect(wallVerdict({ ...past, lastInputAt: 0, liftedAt: at.now - FLING_WINDOW_MS + 10 })).toBe("back");
    expect(wallVerdict({ ...past, lastInputAt: 0, pointerHeld: true })).toBe("back");
  });

  it("keeps a click on the scrollbar's track hers while its step animates on after the button is up", () => {
    const past = { ...at, scroll: 5655, lastInputAt: 0 };
    expect(wallVerdict({ ...past, barAt: at.now - 120 })).toBe("back");
    expect(wallVerdict({ ...past, barAt: at.now - BAR_WINDOW_MS + 1 })).toBe("back");
    expect(wallVerdict({ ...past, barAt: at.now - BAR_WINDOW_MS })).toBe("open");
  });

  it("keeps a fling that outlives its window hers while the wall is pulling it back", () => {
    // Reduced motion on a phone: the momentum ran on 1.5 s after the lift.
    const past = { ...at, scroll: 5376, lastInputAt: 0, liftedAt: at.now - FLING_WINDOW_MS - 30 };
    expect(wallVerdict({ ...past, pulledAt: at.now - 16 })).toBe("back");
    expect(wallVerdict({ ...past, pulledAt: at.now - PULL_WINDOW_MS })).toBe("open");
  });

  it("opens for navigation: a move with no input of hers (find in page, a screen reader, a script's jump)", () => {
    expect(wallVerdict({ ...at, scroll: 9000, lastInputAt: 0 })).toBe("open");
    expect(wallVerdict({ ...at, scroll: 9000, lastInputAt: at.now - INPUT_WINDOW_MS, liftedAt: at.now - FLING_WINDOW_MS })).toBe("open");
  });
});

describe("keys at the wall", () => {
  const screen = 800;

  it("knows which keys scroll the page forward, and how far", () => {
    expect(keyForward({ key: "ArrowDown" }, "page", screen)).toBe(40);
    expect(keyForward({ key: "PageDown" }, "page", screen)).toBe(700);
    expect(keyForward({ key: " " }, "page", screen)).toBe(700);
    expect(keyForward({ key: "End" }, "page", screen)).toBe(Number.POSITIVE_INFINITY);
    expect(keyForward({ key: "End", ctrlKey: true }, "page", screen)).toBe(Number.POSITIVE_INFINITY);
    expect(keyForward({ key: "ArrowDown", metaKey: true }, "page", screen)).toBe(Number.POSITIVE_INFINITY);
  });

  it("leaves alone the keys that do not: back, Space on a control, typing in a field, shortcuts", () => {
    expect(keyForward({ key: "ArrowUp" }, "page", screen)).toBeNull();
    expect(keyForward({ key: " ", shiftKey: true }, "page", screen)).toBeNull();
    expect(keyForward({ key: " " }, "control", screen)).toBeNull();
    expect(keyForward({ key: "PageDown" }, "field", screen)).toBeNull();
    expect(keyForward({ key: "ArrowDown", altKey: true }, "page", screen)).toBeNull();
    expect(keyForward({ key: "w" }, "page", screen)).toBeNull();
  });

  it("lets a short scroll be, turns one that would pass the wall into a glide to it, and holds at it", () => {
    expect(keyAtWall(1000, 5300, 40)).toBe("native");
    expect(keyAtWall(5000, 5300, 700)).toBe("glide");
    expect(keyAtWall(0, 5300, Number.POSITIVE_INFINITY)).toBe("glide");
    expect(keyAtWall(5300, 5300, 40)).toBe("hold");
    expect(keyAtWall(5299.5, 5300, 40)).toBe("hold");
    expect(keyAtWall(5000, Number.POSITIVE_INFINITY, 700)).toBe("native");
  });
});
