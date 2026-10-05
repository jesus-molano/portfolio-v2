import { describe, expect, it } from "vitest";
import { deepWait, type Feedback, type FeedbackInput, filmWaits, newFeedback, stepFeedback } from "./feedback";
import { feedMeter, type Meter, meterRate, THROTTLE, WAIT } from "./throttle";
import { PROMPT, TRANSPORT } from "./transport";

const FRAME = 1 / 60;

/** A visitor who has started, resting mid-film with nothing playing. */
function resting(extra: Partial<FeedbackInput> = {}): FeedbackInput {
  return {
    started: true,
    p: 0.3,
    sinceInput: 0,
    sinceBackward: 99,
    pictureSpeed: 0,
    pace: 1,
    playing: false,
    meterRate: 0,
    sinceEntered: 30,
    teasing: false,
    sincePush: Number.POSITIVE_INFINITY,
    held: 0,
    touch: false,
    unreadCard: -1,
    ...extra,
  };
}

/** Steps `seconds` of frames; `at(t, input)` may change the input each frame. */
function run(feedback: Feedback, input: FeedbackInput, seconds: number, at?: (t: number, input: FeedbackInput) => void) {
  for (let t = 0; t < seconds - 1e-9; t += FRAME) {
    at?.(t, input);
    stepFeedback(feedback, input, FRAME);
  }
}

describe("filmWaits", () => {
  it("lets the car cruise under the loader, then waits on the title once the hint asks", () => {
    expect(filmWaits(false, "hidden", -1, false)).toBe(false);
    expect(filmWaits(false, "hidden", PROMPT.hintAt - 0.01, false)).toBe(false);
    expect(filmWaits(false, "hidden", PROMPT.hintAt, false)).toBe(true);
    expect(filmWaits(false, "hidden", 60, false)).toBe(true);
  });

  it("revs the car with the attract tease", () => {
    expect(filmWaits(false, "hidden", 6.1, true)).toBe(false);
  });

  it("waits once she drives only while the readout says WAITING", () => {
    for (const mode of ["hidden", "reverse", "floored", "drive"] as const) {
      expect(filmWaits(true, mode, 30, false)).toBe(false);
    }
    expect(filmWaits(true, "waiting", 30, false)).toBe(true);
    expect(filmWaits(true, "waiting", 30, true)).toBe(true);
  });
});

describe("stepFeedback", () => {
  it("cruises while a line plays, however long she waits for it", () => {
    const feedback = newFeedback();
    const input = resting({ playing: true });
    run(feedback, input, 8, (t, i) => {
      i.sinceInput = t;
    });
    expect(feedback.mode).toBe("drive");
    expect(feedback.waitingFor).toBe(-1);
    expect(feedback.pace).toBeCloseTo(1, 3);
  });

  it("says WAITING once the line is done and she rests, brakes to the crawl, then lower", () => {
    const feedback = newFeedback();
    const input = resting();
    const modes: string[] = [];
    run(feedback, input, 10, (t, i) => {
      i.sinceInput = t;
      modes.push(feedback.mode);
    });
    expect(modes[Math.round((TRANSPORT.waitIdle + TRANSPORT.turnDwell - 0.05) / FRAME)]).toBe("drive");
    expect(modes[Math.round((TRANSPORT.waitIdle + TRANSPORT.turnDwell + 0.05) / FRAME)]).toBe("waiting");
    expect(deepWait(feedback)).toBe(true);
    expect(feedback.pace).toBeLessThan(THROTTLE.crawl);
    expect(feedback.pace).toBeGreaterThanOrEqual(THROTTLE.deepCrawl);
  });

  it("never says WAITING for a frame where the picture stalls between two moves, or a card hands over", () => {
    const feedback = newFeedback();
    const input = resting({ sinceInput: 2 });
    const modes = new Set<string>();
    run(feedback, input, 6, (t, i) => {
      // Still for 0.2 s out of every 0.5 s, or nothing playing for 0.2 s between two lines.
      const still = t % 0.5 < 0.2;
      i.pictureSpeed = still ? 0 : 0.01;
      i.playing = t > 3 && !still;
      if (t > 3) i.pictureSpeed = 0;
      modes.add(feedback.mode);
    });
    expect(modes.has("waiting")).toBe(false);
  });

  it("lets the brake start only after a moment of waiting", () => {
    const feedback = newFeedback();
    const input = resting();
    run(feedback, input, TRANSPORT.waitIdle + TRANSPORT.turnDwell + WAIT.delay, (t, i) => {
      i.sinceInput = t;
    });
    expect(feedback.mode).toBe("waiting");
    expect(feedback.pace).toBeGreaterThan(0.97);
  });

  for (const beat of [2.5, 3.5, 4.5, 5]) {
    it(`keeps a calm reader's car steady: no WAITING between notches ${beat} s apart`, () => {
      const feedback = newFeedback();
      const input = resting();
      const paces: number[] = [];
      const modes = new Set<string>();
      run(feedback, input, 8 + 6 * beat, (t, i) => {
        const notch = Math.floor(t / beat);
        i.sinceInput = t - notch * beat;
        // A notch feeds the meter (100 px on a 900 px screen) and moves the picture for half a second.
        i.meterRate = (100 / 900 / THROTTLE.tau) * Math.exp(-i.sinceInput / THROTTLE.tau);
        i.pictureSpeed = i.sinceInput < 0.5 ? 0.01 : 0;
        if (t > 3 * beat) {
          paces.push(feedback.pace);
          modes.add(feedback.mode);
        }
      });
      expect(feedback.rhythm).toBeCloseTo(beat, 1);
      expect(modes.has("waiting")).toBe(false);
      expect(Math.min(...paces)).toBeGreaterThan(0.95);
      expect(Math.max(...paces)).toBeLessThan(1.45);
    });
  }

  it("reads FLAT OUT only once she has held full throttle, and keeps it through a dip", () => {
    const feedback = newFeedback();
    const input = resting({ meterRate: 30 });
    const modes: string[] = [];
    run(feedback, input, 2, () => modes.push(feedback.mode));
    const firstFloored = modes.indexOf("floored") * FRAME;
    expect(firstFloored).toBeGreaterThan(THROTTLE.ffHold);
    expect(feedback.mode).toBe("floored");
    // An ease off (the pace dips under ff but not under ffOff) keeps it.
    input.meterRate = 0.4;
    run(feedback, input, 2.5);
    expect(feedback.pace).toBeLessThan(THROTTLE.ff);
    expect(feedback.mode).toBe("floored");
  });

  it("lets one swipe a second surge without reading FLAT OUT", () => {
    const feedback = newFeedback();
    const input = resting();
    const meter: Meter = { rate: 0, at: 0 };
    const modes = new Set<string>();
    let peak = 0;
    run(feedback, input, 12, (t, i) => {
      // A 300 px swipe over 0.15 s on a 750 px phone, once a second.
      const since = t % 1;
      if (since < 0.15) feedMeter(meter, (300 / 750) * (FRAME / 0.15), t);
      i.sinceInput = since < 0.15 ? 0 : since - 0.15;
      i.meterRate = meterRate(meter, t);
      i.pictureSpeed = 0.02;
      if (t > 2) {
        modes.add(feedback.mode);
        peak = Math.max(peak, feedback.pace);
      }
    });
    expect(peak).toBeGreaterThan(THROTTLE.ff);
    expect([...modes]).toEqual(["drive"]);
  });

  it("raises the hold note only under sustained pushing at an unread card", () => {
    const feedback = newFeedback();
    const input = resting({ playing: true, unreadCard: 3 });
    run(feedback, input, 2, (t, i) => {
      i.sincePush = 0;
      i.held = 0.02;
      i.sinceInput = 0;
    });
    expect(feedback.hold.visible).toBe(true);
    input.held = 0;
    run(feedback, input, 0.5, (t, i) => {
      i.sincePush = t + FRAME;
    });
    expect(feedback.hold.visible).toBe(false);
  });
});
