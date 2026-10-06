import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  DASH,
  type DashInput,
  type LimiterInput,
  DASH_MEDIA,
  dashLayout,
  dashShow,
  dashVisibility,
  easeRevs,
  limiterState,
  litLeds,
  newDashState,
  speedCells,
  statusEm,
  stepDash,
  stepLimiter,
  stripThrottle,
  throttleOf,
} from "./dash";
import { PEDAL } from "./pedal";
import { STORY } from "./story";
import { feedMeter, type Meter, meterRate, THROTTLE } from "./throttle";
import { PROMPT, type TransportMode } from "./transport";

const FRAME = 1 / 60;

/** A string matched as itself in a RegExp. */
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The lights a single input lights, frame by frame from the next one, as HeroStage eases them. */
function stripAfter(viewports: number, frames: number): number[] {
  const meter: Meter = { rate: 0, at: 0 };
  feedMeter(meter, viewports, 0);
  let revs = 0;
  const lit: number[] = [];
  for (let i = 1; i <= frames; i += 1) {
    revs = easeRevs(revs, throttleOf(meterRate(meter, i * FRAME)), FRAME);
    lit.push(litLeds(revs, false));
  }
  return lit;
}

describe("throttleOf", () => {
  it("is 0 at rest, grows with her input and stays under 1", () => {
    expect(throttleOf(0)).toBe(0);
    expect(throttleOf(-2)).toBe(0);
    let previous = 0;
    for (let rate = 0.05; rate < 20; rate *= 1.4) {
      const value = throttleOf(rate);
      expect(value).toBeGreaterThan(previous);
      expect(value).toBeLessThan(1);
      previous = value;
    }
  });

  it("lights the strip as far as each real input asks", () => {
    const lights = (viewports: number) => litLeds(throttleOf(viewports / THROTTLE.tau), false);
    // One wheel notch (100 px of 900), an arrow press, Space or a tap.
    expect(lights(0.11)).toBe(10);
    expect(lights(THROTTLE.arrowStep)).toBeGreaterThanOrEqual(10);
    expect(lights(THROTTLE.arrowStep)).toBeLessThanOrEqual(11);
    expect(lights(THROTTLE.keyStep)).toBeGreaterThanOrEqual(14);
    // A steady scroll of a viewport a second keeps the meter at 1.
    expect(litLeds(throttleOf(1), false)).toBeGreaterThanOrEqual(13);
  });
});

describe("stripThrottle", () => {
  it("shows her input or her foot on the pedal, whichever is further down", () => {
    expect(stripThrottle(0, 0)).toBe(0);
    expect(stripThrottle(0, PEDAL.bite)).toBe(PEDAL.bite);
    expect(stripThrottle(0, 1)).toBe(1);
    expect(stripThrottle(3, 0)).toBe(throttleOf(3));
    expect(stripThrottle(3, 0.2)).toBe(throttleOf(3));
    expect(stripThrottle(0, Number.NaN)).toBe(0);
    expect(stripThrottle(0, 4)).toBe(1);
    // Her foot at the bite lights six of the fifteen, as many as the pedal's two treads stand for.
    expect(litLeds(stripThrottle(0, PEDAL.bite), false)).toBe(6);
  });
});

describe("easeRevs", () => {
  it("rises 63% in revRise and falls 63% in revFall", () => {
    expect(easeRevs(0, 1, DASH.revRise)).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(easeRevs(1, 0, DASH.revFall)).toBeCloseTo(Math.exp(-1), 6);
  });

  it("stays in 0..1, and a zero step changes nothing", () => {
    expect(easeRevs(0.4, 3, 10)).toBe(1);
    expect(easeRevs(0.4, -3, 10)).toBeCloseTo(0, 9);
    expect(easeRevs(0.4, -3, 10)).toBeGreaterThanOrEqual(0);
    expect(easeRevs(0.4, 0.9, 0)).toBe(0.4);
  });

  it("answers an input in the next frame, and a notch climbs for a few frames, then drains", () => {
    const notch = stripAfter(0.11, 60);
    expect(notch[0]).toBeGreaterThanOrEqual(3);
    expect(Math.max(...notch)).toBeGreaterThanOrEqual(7);
    expect(notch.at(-1)).toBeLessThan(Math.max(...notch));
    const space = stripAfter(THROTTLE.keyStep, 30);
    expect(space[0]).toBeGreaterThanOrEqual(4);
    expect(Math.max(...space)).toBeGreaterThanOrEqual(12);
  });
});

describe("litLeds", () => {
  it("keeps one light on, ten at most under the limiter, fifteen at full", () => {
    expect(litLeds(0, false)).toBe(1);
    expect(litLeds(Number.NaN, false)).toBe(1);
    expect(litLeds(1, false)).toBe(DASH.leds);
    expect(litLeds(1, true)).toBe(DASH.limiterLeds);
    expect(litLeds(0.3, true)).toBeLessThanOrEqual(DASH.limiterLeds);
  });
});

describe("limiterState", () => {
  it("is off without an unread line up", () => {
    expect(limiterState({ unreadCard: false, holding: true, sinceInput: 0 })).toBe("off");
  });

  it("is armed while a line is up and she is not pushing on it", () => {
    expect(limiterState({ unreadCard: true, holding: false, sinceInput: 0 })).toBe("armed");
    expect(limiterState({ unreadCard: true, holding: false, sinceInput: 5 })).toBe("armed");
  });

  it("stays armed under a pedal resting on the wall: her foot is input, but resting is not pushing", () => {
    // HeroStage: a held pedal is input every frame; only its knock on arrival is held input.
    expect(limiterState({ unreadCard: true, holding: false, sinceInput: 0 })).toBe("armed");
    expect(limiterState({ unreadCard: true, holding: true, sinceInput: 0 })).toBe("hit");
  });

  it("is hit only with input held at the wall and an input of hers just now", () => {
    expect(limiterState({ unreadCard: true, holding: true, sinceInput: 0.1 })).toBe("hit");
    // A fling's leftover pressure half a second after the finger lifted is no push.
    expect(limiterState({ unreadCard: true, holding: true, sinceInput: 0.5 })).toBe("armed");
  });
});

describe("dashShow", () => {
  const base = { p: 0.4, started: true, mode: "drive" as TransportMode, limiter: "off" as const, clearing: false };

  it("asks with her gesture before her first input, and hides from the fade", () => {
    expect(dashShow({ ...base, started: false, mode: "hidden" })).toBe("prompt");
    expect(dashShow({ ...base, p: STORY.fadeFrom })).toBe("hidden");
  });

  it("says REVERSE over everything else, then ALL CLEAR, then LIMITER", () => {
    expect(dashShow({ ...base, mode: "reverse", limiter: "hit", clearing: true })).toBe("reverse");
    expect(dashShow({ ...base, limiter: "armed", clearing: true })).toBe("clear");
    expect(dashShow({ ...base, limiter: "armed" })).toBe("limiter");
    expect(dashShow({ ...base, limiter: "hit", mode: "floored" })).toBe("limiter");
  });

  it("asks with her gesture once the car waits for her, after ALL CLEAR", () => {
    expect(dashShow({ ...base, mode: "waiting", clearing: true })).toBe("clear");
    expect(dashShow({ ...base, mode: "waiting" })).toBe("prompt");
  });

  it("says FLAT OUT or YOU DRIVE otherwise", () => {
    expect(dashShow({ ...base, mode: "floored" })).toBe("floored");
    expect(dashShow(base)).toBe("drive");
  });
});

describe("dashVisibility", () => {
  const base = { layout: "wide" as const, started: false, sinceEntered: 0, titleOut: 0, p: 0 };

  it("wakes dimmed with the title hint on wide screens, and comes on with her first input", () => {
    expect(dashVisibility({ ...base, sinceEntered: PROMPT.hintAt - 0.01 })).toBe("off");
    expect(dashVisibility({ ...base, sinceEntered: PROMPT.hintAt })).toBe("idle");
    expect(dashVisibility({ ...base, started: true, sinceEntered: 0.5 })).toBe("on");
  });

  it("takes the title's place on tall and compact screens, both ways", () => {
    for (const layout of ["tall", "compact"] as const) {
      const small = { ...base, layout, started: true, sinceEntered: 9 };
      expect(dashVisibility({ ...small, titleOut: DASH.titleClear - 0.01 })).toBe("off");
      expect(dashVisibility({ ...small, titleOut: DASH.titleClear, p: 0.1 })).toBe("on");
      // She rewinds to the title: it goes again.
      expect(dashVisibility({ ...small, titleOut: 0.3, p: 0.03 })).toBe("off");
      expect(dashVisibility({ ...small, started: false, titleOut: 1, p: 0.3 })).toBe("off");
    }
  });

  it("is never on a phone: the subtitles are the focus there", () => {
    for (const [started, titleOut, sinceEntered] of [
      [false, 0, 0],
      [false, 0, 30],
      [true, 1, 9],
      [true, 0.3, 9],
    ] as const) {
      expect(dashVisibility({ ...base, layout: "phone", started, titleOut, sinceEntered, p: 0.3 })).toBe("off");
    }
  });

  it("is off in every layout from the fade to night", () => {
    for (const layout of ["wide", "tall", "compact", "phone"] as const) {
      expect(dashVisibility({ ...base, layout, started: true, titleOut: 1, p: STORY.fadeFrom, sinceEntered: 30 })).toBe(
        "off",
      );
    }
  });
});

describe("dashLayout", () => {
  /** window.matchMedia for a `width` x `height` viewport, `coarse` for a touch screen. */
  const matcher =
    (width: number, height: number, coarse = false) =>
    (query: string) => {
      const aspect = width / height;
      if (query === DASH_MEDIA.wide) return aspect >= 1 && width >= 1024 && height >= 501;
      if (query === DASH_MEDIA.tall) return aspect <= 1;
      if (query === DASH_MEDIA.phone) return coarse && ((aspect <= 1 && width <= 599) || (aspect >= 1 && height <= 500));
      throw new Error(query);
    };

  it("puts portrait tablets and narrow windows in the tall layout, desktops in the wide one", () => {
    expect(dashLayout(matcher(390, 844))).toBe("tall");
    expect(dashLayout(matcher(768, 1024))).toBe("tall");
    expect(dashLayout(matcher(768, 1024, true))).toBe("tall");
    expect(dashLayout(matcher(1440, 900))).toBe("wide");
    expect(dashLayout(matcher(1024, 768))).toBe("wide");
    expect(dashLayout(matcher(1024, 768, true))).toBe("wide");
  });

  it("puts small and short landscape windows in the compact one", () => {
    expect(dashLayout(matcher(844, 390))).toBe("compact");
    expect(dashLayout(matcher(1280, 500))).toBe("compact");
    // A small tablet on its side keeps its dash.
    expect(dashLayout(matcher(960, 600, true))).toBe("compact");
  });

  it("gives a phone, upright or on its side, no dash at all", () => {
    for (const [width, height] of [
      [320, 568],
      [360, 640],
      [390, 844],
      [430, 932],
      [568, 320],
      [844, 390],
      [932, 430],
    ] as const) {
      expect(dashLayout(matcher(width, height, true)), `${width}x${height}`).toBe("phone");
    }
  });

  it("resolves a square window as the CSS does: wide when big, tall otherwise", () => {
    expect(dashLayout(matcher(1200, 1200))).toBe("wide");
    expect(dashLayout(matcher(800, 800))).toBe("tall");
  });

  it("uses the very media queries of the stylesheet", () => {
    const css = readFileSync(new URL("../Hero.module.css", import.meta.url), "utf8");
    expect(css).toContain(`@media ${DASH_MEDIA.wide} {`);
    expect(css).toContain(`@media ${DASH_MEDIA.tall} {`);
    // On a phone the pod is not rendered at all, and the radio's callout takes the sky it left.
    expect(css).toMatch(new RegExp(`@media ${escape(DASH_MEDIA.phone)} \\{\\s*\\.dash \\{\\s*display: none;`));
    const radio = readFileSync(new URL("../../music/RadioButton.module.css", import.meta.url), "utf8");
    expect(radio).toContain(`@media ${DASH_MEDIA.phone} {`);
  });

  it("sizes and places the pedal in those same queries, next to the dash", () => {
    const css = readFileSync(new URL("../Hero.module.css", import.meta.url), "utf8");
    /** The declarations of `.sticky` inside `@media <query> {`. */
    const sticky = (query: string) => {
      const at = css.indexOf(`@media ${query} {\n  .sticky {`);
      expect(at, query).toBeGreaterThanOrEqual(0);
      return css.slice(at, css.indexOf("}", at));
    };
    for (const query of [DASH_MEDIA.wide, DASH_MEDIA.tall, "(min-aspect-ratio: 1/1)"]) {
      const block = sticky(query);
      for (const name of ["--va-pod-fs", "--va-pedal-fs", "--va-pedal-right", "--va-pedal-bottom", "--va-band-bottom"]) {
        expect(block, `${query} ${name}`).toContain(`${name}:`);
      }
    }
    // On tall screens the subtitles stand above the pedal's plate.
    expect(sticky(DASH_MEDIA.tall)).toContain("--va-band-bottom: calc(var(--va-pedal-bottom) + 5.25 * var(--va-pedal-fs)");
  });
});

describe("speedCells", () => {
  it("right-aligns the speed with blank leading cells, never a leading zero", () => {
    expect(speedCells(7)).toEqual(["", "", "7"]);
    expect(speedCells(80)).toEqual(["", "8", "0"]);
    expect(speedCells(124)).toEqual(["1", "2", "4"]);
    expect(speedCells(64.6)).toEqual(["", "6", "5"]);
  });

  it("reads 0 for nonsense and clamps at 999", () => {
    expect(speedCells(Number.NaN)).toEqual(["", "", "0"]);
    expect(speedCells(-5)).toEqual(["", "", "0"]);
    expect(speedCells(4000)).toEqual(["9", "9", "9"]);
  });
});

describe("the dash's words", () => {
  /** Widths in em of the status text (it is 0.8125em of the dash). */
  const ARROW = 0.62;
  const MOUSE = 0.72;
  const GAP = 0.5;
  /** A keycap: 0.9em mono with 0.08em tracking, 0.35em of padding a side, 1.6em at least. */
  const keycap = (text: string) => Math.max(1.6, Array.from(text).length * 0.68 + 0.7) * 0.9;
  const inStatus = (em: number) => em * 0.8125;

  for (const [locale, dict] of [
    ["en", { ...en.hero, intro: { ...en.hero.intro, ...en.common.cues } }],
    ["es", { ...es.hero, intro: { ...es.hero.intro, ...es.common.cues } }],
  ] as const) {
    it(`${locale}: every word fits its slot, LIMITER beside its sign`, () => {
      // The cues live in common.cues (shared with the career city); the hero takes them as part of its intro.
      const { osd, intro } = dict;
      for (const word of [osd.drive, osd.floored, osd.reverse, osd.clear]) {
        expect(statusEm(word), word).toBeLessThanOrEqual(DASH.slotEm);
      }
      expect(statusEm(osd.limiter) + DASH.signGapEm + DASH.signEm).toBeLessThanOrEqual(DASH.slotEm);
      // The way on, in her input's words: a glyph or keycaps and a word.
      const prompts = [
        statusEm(intro.nextTouch) + inStatus(ARROW + GAP),
        statusEm(intro.next) + inStatus(MOUSE + GAP),
        statusEm(intro.nextClick) + inStatus(MOUSE + GAP),
        inStatus(keycap("W") + GAP + keycap(intro.nextKey)),
        // The pedal's glyph (0.8em) and its word.
        statusEm(intro.nextPedal) + inStatus(0.8 + GAP),
      ];
      for (const width of prompts) expect(width).toBeLessThanOrEqual(DASH.slotEm);
    });
  }
});

describe("stepLimiter and stepDash", () => {
  const dash = (over: Partial<DashInput> = {}): DashInput => ({
    now: 1000,
    realDt: 1 / 60,
    layout: "wide",
    started: true,
    sinceEntered: 10,
    titleOut: 1,
    p: 0.3,
    mode: "drive",
    rate: 0,
    foot: 0,
    tease: 0,
    stepAt: 0,
    pushedAt: 0,
    ...over,
  });
  const lim = (over: Partial<LimiterInput> = {}): LimiterInput => ({
    now: 1000,
    unreadCard: false,
    wall: -1,
    wallDone: () => false,
    holding: false,
    sinceInput: 0,
    ...over,
  });

  it("holds the limiter for an unread line, and says ALL CLEAR the frame its wall opens", () => {
    const state = newDashState(0, 0);
    const held = stepLimiter(state, lim({ unreadCard: true, wall: 3 }));
    expect(stepDash(state, held, dash()).show).toBe("limiter");
    expect(held.limiter).toBe("armed");
    const open = stepLimiter(state, lim({ now: 1100, wallDone: (w) => w === 3 }));
    expect(open.released).toBe(true);
    const shown = stepDash(state, open, dash({ now: 1100 }));
    expect(shown.show).toBe("clear");
    expect(shown.release).not.toBeNull();
    const later = stepLimiter(state, lim({ now: 1100 + DASH.clearHold * 1000 + 1 }));
    expect(later.clearing).toBe(false);
  });

  it("flares the strip on every input of hers, and lets it decay", () => {
    const state = newDashState(0, 0);
    const off = stepLimiter(state, lim());
    expect(stepDash(state, off, dash({ stepAt: 5 })).kick).toBe(1);
    expect(stepDash(state, off, dash({ stepAt: 5, realDt: 0.12 })).kick).toBeLessThan(0.5);
  });

  it("is off on a phone, and boots the first time it shows", () => {
    const state = newDashState();
    const off = stepLimiter(state, lim());
    expect(stepDash(newDashState(), off, dash({ layout: "phone" })).vis).toBe("off");
    expect(stepDash(state, off, dash()).boot).toBe(true);
    expect(stepDash(state, off, dash({ now: 1000 + DASH.boot * 1000 + 1 })).boot).toBe(false);
  });
});
