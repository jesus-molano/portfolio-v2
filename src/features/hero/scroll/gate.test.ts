import { describe, expect, it } from "vitest";
import { browserStroke, GATE, gateAction, keyScrollsPage, lenisMissed, liftFling, newStroke, pageScroll, resetStroke, strokeLift, strokeMove } from "./gate";

describe("where the page is", () => {
  it("draws from Lenis' sub-pixel value while it agrees with the page", () => {
    expect(pageScroll({ page: 341, lenis: 340.6, gliding: true })).toBe(340.6);
    expect(pageScroll({ page: 341, lenis: 340.6, gliding: false })).toBe(340.6);
    expect(lenisMissed({ page: 341, lenis: 340.6, gliding: false })).toBe(false);
  });

  it("trusts the page when Lenis missed a native move, and starts Lenis again from it", () => {
    // Lenis dropped the scroll event after its own landing; the page went on to 2584.
    const reading = { page: 2584, lenis: 284, gliding: false };
    expect(pageScroll(reading)).toBe(2584);
    expect(lenisMissed(reading)).toBe(true);
    // Back up as well: the page is where it is.
    expect(pageScroll({ page: 120, lenis: 900, gliding: false })).toBe(120);
  });

  it("does not take a glide for a miss: Lenis writes the page itself", () => {
    expect(lenisMissed({ page: 2584, lenis: 284, gliding: true })).toBe(false);
  });
});

describe("the gate", () => {
  const max = 500;

  it("puts the page back at the wall, whatever moved it past it", () => {
    for (const scroll of [max + GATE.snapSlop + 0.5, max + 300, max + 2300]) {
      for (const gliding of [false, true]) {
        for (const lenisTarget of [max, scroll, max - 100]) {
          expect(gateAction({ scroll, lenisTarget, gliding, max }), `${scroll} ${gliding} ${lenisTarget}`).toBe("back");
        }
      }
    }
  });

  it("turns a glide aimed past the wall into it, and leaves the page alone otherwise", () => {
    expect(gateAction({ scroll: max - 50, lenisTarget: max + 200, gliding: true, max })).toBe("into");
    expect(gateAction({ scroll: max - 50, lenisTarget: max + 200, gliding: false, max })).toBe("none");
    expect(gateAction({ scroll: max - 50, lenisTarget: max, gliding: true, max })).toBe("none");
    expect(gateAction({ scroll: max + GATE.snapSlop, lenisTarget: max, gliding: false, max })).toBe("none");
  });

  it("holds nothing once every beat is done", () => {
    expect(gateAction({ scroll: 1e5, lenisTarget: 1e5, gliding: true, max: Number.POSITIVE_INFINITY })).toBe("none");
  });

  it("lets a finger's fling fly up to the wall and no further, and not at all close to it", () => {
    const vh = 844;
    expect(liftFling(300, 1000, vh)).toBe(300);
    expect(liftFling(300, 120, vh)).toBe(120);
    expect(liftFling(300, GATE.liftRoom * vh - 1, vh)).toBe(0);
    expect(liftFling(0, 1000, vh)).toBe(0);
    expect(liftFling(Number.NaN, 1000, vh)).toBe(0);
    // Never past the wall, for any fling and room.
    for (const fling of [1, 50, 400, 3000]) {
      for (const room of [-50, 0, 40, 60, 200, 5000]) expect(liftFling(fling, room, vh)).toBeLessThanOrEqual(Math.max(0, room));
    }
  });
});

describe("a finger's stroke", () => {
  /** What a run of moves scrolls, move by move, one a frame (`frameMs` apart). */
  const run = (moves: number[], frameMs = 1000 / 60) => {
    const stroke = newStroke();
    const scrolled = moves.map((move, i) => strokeMove(stroke, move, i * frameMs));
    /** Which way it flings, lifted the frame after its last move. */
    const lift = () => strokeLift(stroke, moves.length * frameMs);
    return { scrolled, stroke, lift };
  };

  it("keeps a resting thumb that trembles still: it neither goes back nor pushes", () => {
    for (const amp of [0.3, 0.67, 1, 2, 3]) {
      // Up and down by `amp` around where it landed, for 3 s.
      const moves = Array.from({ length: 180 }, (_, i) => (i % 2 ? amp : -amp));
      const { scrolled, lift } = run(moves);
      expect(scrolled.every((px) => px === 0), `${amp} px`).toBe(true);
      expect(lift(), `${amp} px`).toBe(0);
    }
  });

  it("keeps a thumb resting after a swipe still, however it trembles within its slop", () => {
    for (const amp of [0.3, 1, 3]) {
      const swipe = [40, 40, 40];
      // Then up and down by `amp` around where the swipe left it: -amp, +amp, -amp...
      const tremble = Array.from({ length: 120 }, (_, i) => (i === 0 ? -amp : i % 2 ? 2 * amp : -2 * amp));
      const { scrolled, lift } = run([...swipe, ...tremble]);
      expect(scrolled.slice(0, 3)).toEqual([40, 40, 40]);
      const after = scrolled.slice(3);
      // Never back; forward at most once, by the tremble's own reach past where the swipe stopped.
      expect(after.every((px) => px >= 0), `${amp} px`).toBe(true);
      expect(after.filter((px) => px > 0).length, `${amp} px`).toBeLessThanOrEqual(1);
      expect(after.reduce((a, b) => a + b, 0), `${amp} px`).toBeLessThanOrEqual(amp + 1e-9);
      // Come to rest, it lands still again: lifted, it flings nothing.
      expect(lift()).toBe(0);
      // Lifted mid-tremble, before it has rested, it flings the way the swipe went, never the tremble's.
      expect(run([...swipe, -amp, 2 * amp, -2 * amp]).lift()).toBe(1);
      // Swiped, then held perfectly still (no moves at all) and lifted: it rested, and flings nothing.
      const still = run(swipe);
      expect(strokeLift(still.stroke, 3 * (1000 / 60) + GATE.restMs)).toBe(0);
    }
  });

  it("after a swipe back, a thumb that rests and rolls on the glass never scrolls back again", () => {
    for (const [amp, roll] of [
      [0.3, -3],
      [1, -7],
      [3, -7],
      [2, 5],
    ] as const) {
      // A swipe back, then the thumb on the glass for 3 s: trembling by `amp` and rolling `roll` px
      // over the first 1.5 s as its pad flattens.
      const swipe = [-40, -40, -40];
      const rest = Array.from({ length: 180 }, (_, i) => (i % 2 ? amp : -amp) + (i < 90 ? roll / 90 : 0));
      const { scrolled, lift } = run([...swipe, ...rest]);
      expect(scrolled.slice(0, 3)).toEqual([-40, -40, -40]);
      // At most the first few moves before it has rested follow it, a pixel or two; then nothing.
      const resting = scrolled.slice(3 + Math.ceil(GATE.restMs / (1000 / 60)) + 1);
      expect(resting.every((px) => px === 0), `${amp} px, ${roll} px`).toBe(true);
      expect(Math.abs(scrolled.slice(3).reduce((a, b) => a + b, 0)), `${amp} px, ${roll} px`).toBeLessThanOrEqual(GATE.restPx + amp);
      expect(lift(), `${amp} px, ${roll} px`).toBe(0);
    }
  });

  it("follows a slow, deliberate drag, and one that pauses and goes on, losing nothing", () => {
    // Two pixels a frame (120 px a second) for 2 s.
    const slow = Array.from({ length: 120 }, () => 2);
    const { scrolled } = run(slow);
    expect(scrolled.reduce((a, b) => a + b, 0)).toBe(240);
    expect(scrolled.slice(4).every((px) => px === 2)).toBe(true);
    // A drag that stops for half a second (no moves) and goes on: it rested, so past the rest's
    // slop it scrolls the whole travel again.
    const stroke = newStroke();
    const first = [20, 20, 20].map((px, i) => strokeMove(stroke, px, i * 16));
    const again = [4, 4, 4, 20].map((px, i) => strokeMove(stroke, px, 600 + i * 16));
    expect(first).toEqual([20, 20, 20]);
    expect(again).toEqual([0, 0, GATE.restSlop, 20]);
  });

  it("follows a real swipe 1:1 once past its slop, and loses nothing", () => {
    const moves = [3, 3, 3, 12, 20, 20];
    const { scrolled } = run(moves);
    expect(scrolled).toEqual([0, 0, 9, 12, 20, 20]);
    expect(scrolled.reduce((a, b) => a + b, 0)).toBe(moves.reduce((a, b) => a + b, 0));
  });

  it("still rewinds on a real swipe back, from the furthest the finger went", () => {
    // Forward 100 px, then back: the first 7 px back are slack, then the page is under the finger again.
    const { scrolled, lift } = run([50, 50, -4, -3, -5, -30, -30]);
    expect(scrolled).toEqual([50, 50, 0, 0, -12, -30, -30]);
    expect(lift()).toBe(-1);
    // A swipe that starts backwards rewinds as soon as it leaves the slop.
    expect(run([-6, -6, -20]).scrolled).toEqual([0, -12, -20]);
  });

  it("starts every finger still, and ignores a move that is not a number", () => {
    const stroke = newStroke();
    expect(strokeMove(stroke, 30, 0)).toBe(30);
    resetStroke(stroke);
    expect(stroke).toEqual(newStroke());
    expect(strokeMove(stroke, GATE.touchSlop - 1, 0)).toBe(0);
    expect(strokeMove(stroke, Number.NaN, 16)).toBe(0);
    expect(strokeMove(stroke, 1, 32)).toBe(GATE.touchSlop);
  });
});

describe("a finger below the hero", () => {
  // A 390 x 844 phone: the film ends five screens down the stage.
  const heroEnd = 5 * 844;

  it("is the browser's stroke once the film has ended and the walls are open", () => {
    expect(browserStroke(heroEnd, heroEnd, Number.POSITIVE_INFINITY)).toBe(true);
    expect(browserStroke(heroEnd + 4000, heroEnd, Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("stays Lenis' in the hero, where the walls pace the film", () => {
    expect(browserStroke(heroEnd - 1, heroEnd, Number.POSITIVE_INFINITY)).toBe(false);
    expect(browserStroke(0, heroEnd, Number.POSITIVE_INFINITY)).toBe(false);
    // Walls up: always gated, wherever the page is.
    expect(browserStroke(heroEnd + 10, heroEnd, 1200)).toBe(false);
  });

  it("stays Lenis' inside the career city's film, its walls open or not", () => {
    const pinned = { from: heroEnd + 2000, to: heroEnd + 9000 };
    expect(browserStroke(heroEnd + 2000, heroEnd, Number.POSITIVE_INFINITY, pinned)).toBe(false);
    expect(browserStroke(heroEnd + 5000, heroEnd, Number.POSITIVE_INFINITY, pinned)).toBe(false);
    expect(browserStroke(heroEnd + 9000, heroEnd, Number.POSITIVE_INFINITY, pinned)).toBe(false);
    // Above it (THE USUAL SUSPECTS) and below it (STATS) the browser's, as ever.
    expect(browserStroke(heroEnd + 1000, heroEnd, Number.POSITIVE_INFINITY, pinned)).toBe(true);
    expect(browserStroke(heroEnd + 9100, heroEnd, Number.POSITIVE_INFINITY, pinned)).toBe(true);
    // Landing on the browser's own fling (flown in from STATS): the browser's, which stops it.
    expect(browserStroke(heroEnd + 5000, heroEnd, Number.POSITIVE_INFINITY, pinned, true)).toBe(true);
    // With a wall closed, never.
    expect(browserStroke(heroEnd + 5000, heroEnd, heroEnd + 6000, pinned, true)).toBe(false);
  });

  it("leaves the browser's own fling to the browser in the hero too, its walls open", () => {
    // Flown up from THE USUAL SUSPECTS into the hero's end: the finger that lands on it stops it.
    expect(browserStroke(heroEnd - 300, heroEnd, Number.POSITIVE_INFINITY, undefined, true)).toBe(true);
    expect(browserStroke(heroEnd - 300, heroEnd, 900, undefined, true)).toBe(false);
    expect(browserStroke(0, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, undefined, true)).toBe(false);
  });

  it("stays Lenis' with no film measured (no hero on the page, or the still hero)", () => {
    expect(browserStroke(9000, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("a key below the hero", () => {
  it("scrolls the page natively: Lenis' glide stops for it", () => {
    for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]) expect(keyScrollsPage(key, "page")).toBe(true);
    expect(keyScrollsPage("PageDown", "control")).toBe(true);
  });

  it("leaves a field's keys, Space on a control and every other key alone", () => {
    expect(keyScrollsPage("ArrowDown", "field")).toBe(false);
    expect(keyScrollsPage(" ", "field")).toBe(false);
    expect(keyScrollsPage(" ", "control")).toBe(false);
    for (const key of ["q", "[", "]", "Tab", "Enter", "Escape", "w"]) expect(keyScrollsPage(key, "page")).toBe(false);
  });
});
