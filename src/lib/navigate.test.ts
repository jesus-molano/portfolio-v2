import { afterEach, describe, expect, it, vi } from "vitest";
import { fragmentTarget, getPassage, goTo, landingY, landsPast, registerPassage, registerScroller } from "./navigate";

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
});

describe("goTo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A page 12000 px tall in a 900 px window, scrolled to `scrollY`, with the hero ending at 5400. */
  function page(scrollY: number) {
    const log: string[] = [];
    vi.stubGlobal("window", { scrollY, innerHeight: 900, scrollTo: (o: { top: number }) => log.push(`native ${o.top}`) });
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
      getBoundingClientRect: () => ({ bottom: 5400 - scrollY }),
      contains: () => false,
      compareDocumentPosition: (other: { follows: boolean }) => (other.follows ? 4 : 2),
    } as unknown as HTMLElement;
    const unregisterPassage = registerPassage({ section: hero, open: () => log.push("open") });
    const lenis = {
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
      done: () => {
        unregisterPassage();
        unregisterScroller();
      },
    };
  }

  it("opens the hero, then moves Lenis and the page together from where the page is, then focuses", () => {
    const p = page(6300);
    // The booth's link: the cinema, 900 px down, after the hero.
    goTo(p.element(900, true));
    expect(p.log).toEqual(["open", "resize", "reset", "lenis 7136 immediate force", "focus"]);
    p.done();
  });

  it("leaves the hero's walls alone for a place in it or before it", () => {
    const p = page(6300);
    goTo(0, { focus: null });
    goTo(2000, { focus: null });
    expect(p.log).toEqual(["resize", "reset", "lenis 0 immediate force", "resize", "reset", "lenis 2000 immediate force"]);
    p.done();
  });

  it("opens the hero for a position at its end (Skip), and glides when asked", () => {
    const p = page(1200);
    goTo(5400, { focus: null });
    expect(p.log).toEqual(["open", "resize", "reset", "lenis 5400 immediate force"]);
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
    expect(q.log).toEqual(["native 300"]);
  });
});
