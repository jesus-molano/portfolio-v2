import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { activeCard, heroTimeline, STORY } from "./story";
import { THROTTLE } from "./throttle";
import {
  driveWaits,
  FIGHT,
  fightLevel,
  hintOpacity,
  isPictureTap,
  keyAction,
  type KeyInput,
  PROMPT,
  promptFor,
  type PromptInput,
  skipTapAllowed,
  speedKmh,
  teaseOffset,
  TRANSPORT,
  type TransportInput,
  transportMode,
} from "./transport";

const PLAYING: TransportInput = { started: true, p: 0.3, sinceInput: 0.05, sinceBackward: 9, pictureSpeed: 0.02, pace: 1.2 };

describe("transportMode", () => {
  it("hides before the first input and from the fade", () => {
    expect(transportMode({ ...PLAYING, started: false })).toBe("hidden");
    expect(transportMode({ ...PLAYING, p: 0.93 })).toBe("hidden");
  });

  it("reads REVERSE going back, even at full throttle", () => {
    expect(transportMode({ ...PLAYING, sinceBackward: 0.1, pace: 2 })).toBe("reverse");
  });

  it("reads WAITING only when she is idle and the picture is still", () => {
    const idle = TRANSPORT.waitIdle;
    expect(transportMode({ ...PLAYING, sinceInput: idle, pictureSpeed: 0 })).toBe("waiting");
    expect(transportMode({ ...PLAYING, sinceInput: idle - 0.05, pictureSpeed: 0 })).toBe("drive");
    expect(transportMode({ ...PLAYING, sinceInput: idle + 1, pictureSpeed: 0.01 })).toBe("drive");
  });

  it("waits longer than the gap between a calm scroller's notches", () => {
    // One notch a second: the readout never blinks WAITING between them.
    expect(TRANSPORT.waitIdle).toBeGreaterThanOrEqual(1);
  });
});

describe("driveWaits", () => {
  const TITLE = { mode: "hidden" as const, started: false, sinceEntered: 0, teasing: false };

  it("lets the car cruise under the loader, then waits on the title once the hint asks", () => {
    expect(driveWaits({ ...TITLE, sinceEntered: -1 })).toBe(false);
    expect(driveWaits({ ...TITLE, sinceEntered: PROMPT.hintAt - 0.01 })).toBe(false);
    expect(driveWaits({ ...TITLE, sinceEntered: PROMPT.hintAt })).toBe(true);
    expect(driveWaits({ ...TITLE, sinceEntered: 60 })).toBe(true);
  });

  it("revs the car with the attract tease", () => {
    expect(driveWaits({ ...TITLE, sinceEntered: 6.1, teasing: true })).toBe(false);
  });

  it("waits once she drives only while the readout says WAITING", () => {
    for (const mode of ["hidden", "reverse", "floored", "drive"] as const) {
      expect(driveWaits({ ...TITLE, started: true, sinceEntered: 30, mode })).toBe(false);
    }
    expect(driveWaits({ ...TITLE, started: true, sinceEntered: 30, mode: "waiting" })).toBe(true);
    expect(driveWaits({ ...TITLE, started: true, sinceEntered: 30, mode: "waiting", teasing: true })).toBe(true);
  });

  it("reads FLAT OUT at full throttle, YOU DRIVE otherwise", () => {
    expect(transportMode({ ...PLAYING, pace: 1.7 })).toBe("floored");
    expect(transportMode(PLAYING)).toBe("drive");
  });
});

describe("speedKmh", () => {
  it("reads the cruise as 65 km/h and scales with the pace", () => {
    expect(speedKmh(1)).toBe(65);
    expect(speedKmh(2)).toBe(130);
    expect(speedKmh(THROTTLE.crawl)).toBe(13);
    expect(speedKmh(1, 10)).toBe(36);
    expect(speedKmh(-1)).toBe(0);
  });
});

describe("promptFor and hintOpacity", () => {
  const AT_REST: PromptInput = { started: true, sinceStart: 30, p: 0.3, card: false, rewinding: false, idle: 3 };

  it("asks for the first input with the hint, then answers it in place", () => {
    expect(promptFor({ ...AT_REST, started: false, p: 0, idle: 30 })).toBe("hint");
    expect(hintOpacity({ ...AT_REST, started: false, p: 0, idle: 30 })).toBe(1);
    expect(promptFor({ ...AT_REST, sinceStart: 0.1, p: 0.01, idle: 0.1 })).toBe("ack");
    expect(hintOpacity({ ...AT_REST, sinceStart: 0.1, p: 0, idle: 0.1 })).toBe(1);
    // The answer fades after its beat, and as the drive moves.
    expect(hintOpacity({ ...AT_REST, sinceStart: PROMPT.ackHold + PROMPT.ackFade / 2, p: 0 })).toBeCloseTo(0.5, 10);
    // It holds through the title's hold, then fades as the drive moves on.
    expect(hintOpacity({ ...AT_REST, sinceStart: 0.1, p: PROMPT.hintFrom, idle: 0.1 })).toBe(1);
    expect(hintOpacity({ ...AT_REST, sinceStart: 0.1, p: PROMPT.hintFrom + PROMPT.hintOut / 2, idle: 0.1 })).toBeCloseTo(
      0.5,
      10,
    );
    expect(hintOpacity({ ...AT_REST, sinceStart: 9, p: 0.01 })).toBe(0);
  });

  it("says nothing while she scrolls, rewinds, or a card is up", () => {
    expect(promptFor({ ...AT_REST, idle: 0.2 })).toBeNull();
    expect(promptFor({ ...AT_REST, rewinding: true })).toBeNull();
    expect(promptFor({ ...AT_REST, card: true })).toBeNull();
    expect(promptFor({ ...AT_REST, idle: STORY.cueIdle - 0.01 })).toBeNull();
    expect(promptFor({ ...AT_REST, idle: STORY.cueIdle })).toBe("between");
  });

  it("points into the city from the fade", () => {
    expect(promptFor({ ...AT_REST, p: STORY.endFrom, idle: STORY.endIdle })).toBe("end");
    expect(promptFor({ ...AT_REST, p: 0.99, idle: 0.1 })).toBeNull();
  });

  for (const [locale, lines] of [
    ["en", en.hero.lines],
    ["es", es.hero.lines],
  ] as const) {
    it(`${locale}: leaves no resting place of the film without a way on`, () => {
      // Wherever she stops for 3 s, a card (with its marker) or a prompt is up.
      const timeline = heroTimeline(lines);
      for (let p = 0; p < 1; p += 0.0005) {
        const card = activeCard(p, timeline) >= 0;
        for (const sinceStart of [3, 10, 60]) {
          const prompt = promptFor({ started: true, sinceStart, p, card, rewinding: false, idle: 3 });
          expect(card || prompt !== null, `p ${p.toFixed(4)}`).toBe(true);
        }
      }
      expect(promptFor({ started: false, sinceStart: Infinity, p: 0, card: false, rewinding: false, idle: 3 })).toBe(
        "hint",
      );
    });
  }
});

describe("teaseOffset", () => {
  it("lifts to 1 at 0.28 s and settles by 0.78 s", () => {
    expect(teaseOffset(-0.1)).toBe(0);
    expect(teaseOffset(0)).toBe(0);
    expect(teaseOffset(0.28)).toBeCloseTo(1, 10);
    expect(teaseOffset(0.78)).toBeCloseTo(0, 10);
    expect(teaseOffset(1)).toBe(0);
    expect(teaseOffset(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(teaseOffset(Number.NaN)).toBe(0);
    for (let t = 0; t <= 0.8; t += 0.01) {
      expect(teaseOffset(t)).toBeGreaterThanOrEqual(0);
      expect(teaseOffset(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe("fightLevel", () => {
  it("offers Skip after about 2.5 s of pushing at FF", () => {
    let level = 0;
    let time = 0;
    while (level < FIGHT.expandAt && time < 10) {
      level = fightLevel(level, true, 1 / 60);
      time += 1 / 60;
    }
    expect(time).toBeGreaterThan(2.5);
    expect(time).toBeLessThan(3.5);
  });

  it("forgets the fight once she stops pushing", () => {
    expect(fightLevel(2, false, FIGHT.window * Math.LN2)).toBeCloseTo(1, 10);
  });
});

describe("keyAction", () => {
  const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
    key: k,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    targetKind: "other",
    ...extra,
  });

  it("maps the film's keys", () => {
    expect(keyAction(key(" "))).toBe("next");
    expect(keyAction(key("PageDown"))).toBe("next");
    expect(keyAction(key(" ", { shiftKey: true }))).toBe("prev");
    expect(keyAction(key("PageUp"))).toBe("prev");
    expect(keyAction(key("ArrowDown"))).toBe("down");
    expect(keyAction(key("ArrowUp"))).toBe("up");
    expect(keyAction(key("w"))).toBe("down");
    expect(keyAction(key("W", { shiftKey: true }))).toBe("down");
    expect(keyAction(key("s"))).toBe("up");
    expect(keyAction(key("Home"))).toBe("home");
    expect(keyAction(key("End"))).toBe("skip");
    expect(keyAction(key("Escape"))).toBe("skip");
    expect(keyAction(key("a"))).toBeNull();
    expect(keyAction(key("Enter"))).toBeNull();
  });

  it("leaves modifiers, text fields and focused controls alone", () => {
    expect(keyAction(key("ArrowDown", { ctrlKey: true }))).toBeNull();
    expect(keyAction(key(" ", { altKey: true }))).toBeNull();
    expect(keyAction(key("End", { metaKey: true }))).toBeNull();
    expect(keyAction(key(" ", { targetKind: "text" }))).toBeNull();
    expect(keyAction(key("ArrowDown", { targetKind: "text" }))).toBeNull();
    expect(keyAction(key(" ", { targetKind: "button" }))).toBeNull();
    expect(keyAction(key(" ", { targetKind: "link" }))).toBeNull();
    expect(keyAction(key("PageDown", { targetKind: "button" }))).toBe("next");
  });
});

describe("isPictureTap", () => {
  const tap = { dx: 0, dy: 0, ms: 120, sinceScroll: 2000, button: 0 };

  it("counts a short, still, primary press after the scroll settled", () => {
    expect(isPictureTap(tap)).toBe(true);
    expect(isPictureTap({ ...tap, dx: 6, dy: 7 })).toBe(true);
  });

  it("ignores drags, long presses, other buttons and presses right after a scroll", () => {
    expect(isPictureTap({ ...tap, dx: 8, dy: 6 })).toBe(false);
    expect(isPictureTap({ ...tap, ms: 400 })).toBe(false);
    expect(isPictureTap({ ...tap, button: 2 })).toBe(false);
    expect(isPictureTap({ ...tap, sinceScroll: 299 })).toBe(false);
    expect(isPictureTap({ ...tap, sinceScroll: 300 })).toBe(true);
  });
});

describe("skipTapAllowed", () => {
  const touchTap = { pointerType: "touch", sinceTouchEnd: 1000, sinceShown: 5000, moved: 2, ms: 100 };

  it("always lets the mouse and the keyboard skip", () => {
    expect(skipTapAllowed({ ...touchTap, pointerType: "mouse", sinceTouchEnd: 0, sinceShown: 0 })).toBe(true);
  });

  it("ignores a stray touch right after a scroll or right after Skip appeared", () => {
    expect(skipTapAllowed(touchTap)).toBe(true);
    expect(skipTapAllowed({ ...touchTap, sinceTouchEnd: 250 })).toBe(false);
    expect(skipTapAllowed({ ...touchTap, sinceTouchEnd: 350 })).toBe(true);
    expect(skipTapAllowed({ ...touchTap, sinceShown: 500 })).toBe(false);
    expect(skipTapAllowed({ ...touchTap, sinceShown: 600 })).toBe(true);
  });

  it("ignores a touch that dragged or was held", () => {
    expect(skipTapAllowed({ ...touchTap, moved: 10 })).toBe(false);
    expect(skipTapAllowed({ ...touchTap, ms: 600 })).toBe(false);
  });
});
