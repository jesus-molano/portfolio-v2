import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fragmentTarget,
  getPassage,
  goTo,
  INPUT_WINDOW_MS,
  FLING_WINDOW_MS,
  isNavigation,
  landingY,
  landsPast,
  PLACE,
  placeOf,
  registerPassage,
  registerScroller,
  withPlace,
} from "./navigate";

describe("fragmentTarget", () => {
  const here = "https://jesusmolano.dev/en";

  it("names the element an in-page link points to", () => {
    expect(fragmentTarget("https://jesusmolano.dev/en#projects", here)).toBe("projects");
    expect(fragmentTarget("https://jesusmolano.dev/en#stats-sheet", `${here}#stats`)).toBe("stats-sheet");
    expect(fragmentTarget("https://jesusmolano.dev/en#caf%C3%A9", here)).toBe("café");
    // A malformed escape is looked up as written, as the browser does.
    expect(fragmentTarget("https://jesusmolano.dev/en#100%", here)).toBe("100%");
  });

  it("leaves alone a link that leaves the page or names nothing", () => {
    expect(fragmentTarget("https://jesusmolano.dev/es#projects", here)).toBeNull();
    expect(fragmentTarget("https://jesusmolano.dev/en?x=1#projects", here)).toBeNull();
    expect(fragmentTarget("https://github.com/en#projects", here)).toBeNull();
    expect(fragmentTarget("https://jesusmolano.dev/en#", here)).toBeNull();
    expect(fragmentTarget("https://jesusmolano.dev/en", here)).toBeNull();
    expect(fragmentTarget("not a url", here)).toBeNull();
  });
});

describe("a history entry's place", () => {
  it("is where the page was when she left the entry, kept beside Next's own state", () => {
    const next = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] };
    const left = withPlace(next, 7210.6);
    expect(left).toEqual({ ...next, [PLACE]: 7211 });
    expect(placeOf(left)).toBe(7211);
    // The state it came from is untouched: history entries are copies.
    expect(next).not.toHaveProperty(PLACE);
    // A new entry starts with no place of its own.
    expect(placeOf(withPlace(left, null))).toBeNull();
    expect(withPlace(left, null)).toEqual(next);
  });

  it("is nothing for an entry nobody marked, or a place that is not one", () => {
    expect(placeOf(null)).toBeNull();
    expect(placeOf(undefined)).toBeNull();
    expect(placeOf("7200")).toBeNull();
    expect(placeOf({ [PLACE]: "7200" })).toBeNull();
    expect(placeOf({ [PLACE]: Number.NaN })).toBeNull();
    expect(placeOf({ [PLACE]: -5 })).toBeNull();
    expect(placeOf({ [PLACE]: 0 })).toBe(0);
    expect(withPlace(null, -3)).toEqual({ [PLACE]: 0 });
  });
});

describe("landingY", () => {
  it("lands an element's top under the page's scroll-padding, less its own scroll-margin", () => {
    expect(landingY({ top: 900, scrollY: 6300, scrollMargin: 0, scrollPadding: 64, limit: 1e5 })).toBe(7136);
    // STATS lands at the viewport's top edge: its negative margin cancels the padding.
    expect(landingY({ top: 900, scrollY: 6300, scrollMargin: -64, scrollPadding: 64, limit: 1e5 })).toBe(7200);
    expect(landingY({ top: 900, scrollY: 6300, scrollMargin: Number.NaN, scrollPadding: Number.NaN, limit: 1e5 })).toBe(7200);
  });

  it("stays within the page", () => {
    expect(landingY({ top: -20, scrollY: 10, scrollMargin: 0, scrollPadding: 64, limit: 1e5 })).toBe(0);
    expect(landingY({ top: 900, scrollY: 9000, scrollMargin: 0, scrollPadding: 0, limit: 9500 })).toBe(9500);
  });
});

describe("landsPast", () => {
  it("counts an element by where it is in the document, a position by the passage's end", () => {
    expect(landsPast({ y: 10, follows: true }, 5400)).toBe(true);
    expect(landsPast({ y: 9000, follows: false }, 5400)).toBe(false);
    expect(landsPast({ y: 5400, follows: null }, 5400)).toBe(true);
    expect(landsPast({ y: 5399.5, follows: null }, 5400)).toBe(true);
    expect(landsPast({ y: 5300, follows: null }, 5400)).toBe(false);
  });
});

describe("the registries", () => {
  it("keep the newest passage when an older one unregisters late (a re-run)", () => {
    const old = { section: {} as HTMLElement, open: () => {} };
    const fresh = { section: {} as HTMLElement, open: () => {} };
    const unregisterOld = registerPassage(old);
    const unregisterFresh = registerPassage(fresh);
    unregisterOld();
    expect(getPassage()).toBe(fresh);
    unregisterFresh();
    expect(getPassage()).toBeNull();
  });

  it("keep one passage per key: the hero and the career city both hold", () => {
    const hero = { section: {} as HTMLElement, open: () => {} };
    const work = { key: "work", section: {} as HTMLElement, open: () => {} };
    const offHero = registerPassage(hero);
    const offWork = registerPassage(work);
    expect(getPassage()).toBe(hero);
    expect(getPassage("work")).toBe(work);
    offHero();
    offWork();
  });
});

describe("isNavigation", () => {
  it("counts a move with no wheel, touch or key just before it as navigation", () => {
    expect(isNavigation(1000, 1000 + INPUT_WINDOW_MS - 1)).toBe(false);
    expect(isNavigation(1000, 1000 + INPUT_WINDOW_MS)).toBe(true);
    expect(isNavigation(Number.NEGATIVE_INFINITY, 0)).toBe(true);
  });

  it("never counts a finger's fling as navigation: its momentum records no input", () => {
    expect(isNavigation(0, 5000, 5000 - FLING_WINDOW_MS + 1)).toBe(false);
    expect(isNavigation(0, 5000, 5000 - FLING_WINDOW_MS)).toBe(true);
  });
});

describe("goTo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A page 12000 px tall in a 900 px window, scrolled to `scrollY`, with the hero ending at 5400. */
  function page(scrollY: number) {
    const log: string[] = [];
    const win = {
      scrollY,
      innerHeight: 900,
      scrollTo: (o: { top: number }) => {
        log.push(`page ${o.top}`);
        win.scrollY = o.top;
      },
    };
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { documentElement: { scrollHeight: 12000 } });
    vi.stubGlobal("Node", { DOCUMENT_POSITION_FOLLOWING: 4 });
    vi.stubGlobal("getComputedStyle", (element: { margin?: string }) => ({
      scrollMarginTop: element.margin ?? "0px",
      scrollPaddingTop: "64px",
    }));
    const element = (top: number, follows: boolean) =>
      ({
        isConnected: true,
        tabIndex: 0,
        hasAttribute: () => true,
        getBoundingClientRect: () => ({ top }),
        focus: () => log.push("focus"),
        follows,
      }) as unknown as HTMLElement & { follows: boolean };
    const hero = {
      isConnected: true,
      getBoundingClientRect: () => ({ bottom: 5400 - win.scrollY }),
      contains: () => false,
      compareDocumentPosition: (other: { follows: boolean }) => (other.follows ? 4 : 2),
    } as unknown as HTMLElement;
    const unregisterPassage = registerPassage({ section: hero, open: () => log.push("open") });
    const lenis = {
      animatedScroll: scrollY,
      targetScroll: scrollY,
      resize: () => log.push("resize"),
      reset: () => log.push("reset"),
      scrollTo: (y: number, o: { immediate?: boolean; force?: boolean; duration?: number; onComplete?: () => void }) => {
        log.push(`lenis ${y}${o.immediate ? " immediate" : ""}${o.force ? " force" : ""}${o.duration ? ` ${o.duration}s` : ""}`);
        o.onComplete?.();
      },
    };
    const unregisterScroller = registerScroller(lenis as never);
    return {
      log,
      element,
      /** Where Lenis stands: animatedScroll and targetScroll. */
      lenis: () => [lenis.animatedScroll, lenis.targetScroll],
      done: () => {
        unregisterPassage();
        unregisterScroller();
      },
    };
  }

  it("opens a stage up to a position inside it, and all of it for a position past it", () => {
    const p = page(0);
    const landed: string[] = [];
    const work = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 6000 - window.scrollY, bottom: 9000 - window.scrollY }),
      contains: () => false,
      compareDocumentPosition: () => 2,
    } as unknown as HTMLElement;
    const off = registerPassage({ key: "work", section: work, open: () => landed.push("all"), openTo: (y) => landed.push(`to ${y}`) });
    goTo(7000);
    goTo(9500);
    goTo(3000);
    expect(landed).toEqual(["to 7000", "all"]);
    off();
    p.done();
  });

  it("opens the hero, then moves the page with Lenis standing where it lands, then focuses", () => {
    const p = page(6300);
    // A link to the cinema, 900 px down, after the hero.
    goTo(p.element(900, true));
    expect(p.log).toEqual(["open", "resize", "reset", "page 7136", "focus"]);
    expect(p.lenis()).toEqual([7136, 7136]);
    p.done();
  });

  it("leaves the hero's walls alone for a place in it or before it", () => {
    const p = page(6300);
    goTo(0, { focus: null });
    goTo(2000, { focus: null });
    expect(p.log).toEqual(["resize", "reset", "page 0", "resize", "reset", "page 2000"]);
    expect(p.lenis()).toEqual([2000, 2000]);
    p.done();
  });

  it("opens the hero for a position at its end (Skip), and glides when asked", () => {
    const p = page(1200);
    goTo(5400, { focus: null });
    expect(p.log).toEqual(["open", "resize", "reset", "page 5400"]);
    p.log.length = 0;
    const arrived = vi.fn();
    goTo(0, { glide: 1.2, onArrive: arrived });
    expect(p.log).toEqual(["resize", "reset", "lenis 0 force 1.2s"]);
    expect(arrived).toHaveBeenCalledOnce();
    p.done();
  });

  it("scrolls the page itself when there is no Lenis", () => {
    const p = page(0);
    const unregister = registerScroller(null as never);
    unregister();
    p.done();
    // Both registries are empty now.
    const q = page(0);
    q.done();
    goTo(300, { focus: null });
    expect(q.log).toEqual(["page 300"]);
  });
});
