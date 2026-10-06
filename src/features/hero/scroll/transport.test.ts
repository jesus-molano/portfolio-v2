import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { activeCard, heroTimeline, STORY } from "./story";
import { limitPace, paceFor, THROTTLE, WAIT } from "./throttle";
import {
  FIGHT,
  fightLevel,
  focusFromPointer,
  HOLD_NOTE,
  type HoldNote,
  hintOpacity,
  isNotePush,
  isPictureTap,
  keyAction,
  type KeyInput,
  newHoldNote,
  nextRhythm,
  rhythmAfter,
  POINTER_FOCUS_MS,
  PROMPT,
  promptFor,
  type PromptInput,
  pushingHard,
  REMINDERS,
  SKIP_AGAIN,
  skipSwallowed,
  skipTapAllowed,
  speedKmh,
  stepHoldNote,
  teaseOffset,
  TRANSPORT,
  turnConditions,
  type TransportInput,
  transportMode,
  waitIdleFor,
} from "./transport";

const PLAYING: TransportInput = {
  started: true,
  p: 0.3,
  sinceInput: 0.05,
  sinceBackward: 9,
  pictureSpeed: 0.02,
  pace: 1.2,
  playing: false,
};

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

  it("waits a moment before her turn: a stalled frame or a card handing over is not WAITING", () => {
    const rest = { ...PLAYING, sinceInput: 2, pictureSpeed: 0 };
    expect(turnConditions(rest)).toBe(true);
    expect(transportMode({ ...rest, turnFor: TRANSPORT.turnDwell - 0.01 })).toBe("drive");
    expect(transportMode({ ...rest, turnFor: TRANSPORT.turnDwell })).toBe("waiting");
    // Once on, it holds through a settling glide whatever the dwell.
    expect(transportMode({ ...rest, pictureSpeed: 0.01, turnFor: 0 }, "waiting")).toBe("waiting");
    expect(turnConditions({ ...rest, playing: true })).toBe(false);
    expect(turnConditions({ ...rest, pictureSpeed: 0.01 })).toBe(false);
    expect(turnConditions({ ...rest, sinceInput: 0.5 })).toBe(false);
    expect(turnConditions({ ...rest, started: false })).toBe(false);
  });

  it("never reads WAITING while a line plays: she waits for the line, not the film for her", () => {
    expect(transportMode({ ...PLAYING, sinceInput: 30, pictureSpeed: 0, playing: true })).toBe("drive");
    expect(transportMode({ ...PLAYING, sinceInput: 30, pictureSpeed: 0, playing: true }, "waiting")).toBe("drive");
  });

  it("holds WAITING until she moves, even while a glide settles", () => {
    const waiting = { ...PLAYING, sinceInput: 2, pictureSpeed: 0.01 };
    expect(transportMode(waiting)).toBe("drive");
    expect(transportMode(waiting, "waiting")).toBe("waiting");
    expect(transportMode({ ...waiting, sinceInput: 0.1 }, "waiting")).toBe("drive");
  });

  it("gives a reader with a steady rhythm her own beat before WAITING", () => {
    expect(transportMode({ ...PLAYING, sinceInput: 1.5, pictureSpeed: 0, waitIdle: waitIdleFor(2.5) })).toBe("drive");
    expect(transportMode({ ...PLAYING, sinceInput: 3.2, pictureSpeed: 0, waitIdle: waitIdleFor(2.5) })).toBe("waiting");
    // A notch every 3.5 or 5 s is still a beat she keeps: she is never told it is her turn between them.
    for (const beat of [3.5, 4.5, 5]) {
      expect(waitIdleFor(beat) + TRANSPORT.turnDwell, `${beat} s`).toBeGreaterThan(beat);
    }
  });

  it("waits longer than the gap between a calm scroller's notches", () => {
    // One notch a second: the readout never blinks WAITING between them.
    expect(TRANSPORT.waitIdle).toBeGreaterThanOrEqual(1);
  });

  it("reads FLAT OUT at full throttle, YOU DRIVE otherwise, without flicker at the threshold", () => {
    expect(transportMode({ ...PLAYING, pace: 1.7 })).toBe("floored");
    expect(transportMode(PLAYING)).toBe("drive");
    expect(transportMode({ ...PLAYING, pace: 1.5 })).toBe("drive");
    expect(transportMode({ ...PLAYING, pace: 1.5 }, "floored")).toBe("floored");
    expect(transportMode({ ...PLAYING, pace: THROTTLE.ffOff - 0.01 }, "floored")).toBe("drive");
    // The feedback's own say (the pace held at full throttle) wins.
    expect(transportMode({ ...PLAYING, pace: 1.7, flatOut: false })).toBe("drive");
    expect(transportMode({ ...PLAYING, pace: 1.2, flatOut: true })).toBe("floored");
  });
});

describe("her rhythm", () => {
  it("smooths the gaps between her bursts, ignores bursts and forgets a long stop", () => {
    expect(nextRhythm(0, 0.1)).toBe(0);
    expect(nextRhythm(0, 2.5)).toBe(2.5);
    expect(nextRhythm(2.5, 1.5)).toBeCloseTo(2.1, 10);
    expect(nextRhythm(2.5, 0.2)).toBe(2.5);
    expect(nextRhythm(2.5, TRANSPORT.rhythmMax + 1)).toBe(0);
  });

  it("learns a pause that ended on her own beat, never one that answered WAITING", () => {
    expect(rhythmAfter(0, 2.5, -1)).toBe(2.5);
    // WAITING had been up 1.2 s: her own beat crossed it, still a beat of hers.
    expect(rhythmAfter(0, 2.5, TRANSPORT.answer + 0.2)).toBe(2.5);
    // She moved 0.3 s after WAITING came up: she waited to be asked; the next ask comes no later.
    expect(rhythmAfter(0, 1.6, 0.3)).toBe(0);
    expect(rhythmAfter(5, 5.6, 0)).toBe(5);
  });

  it("stretches the wait before WAITING to a little more than her beat, within bounds", () => {
    expect(waitIdleFor(0)).toBe(TRANSPORT.waitIdle);
    expect(waitIdleFor(0.5)).toBe(TRANSPORT.waitIdle);
    expect(waitIdleFor(2.5)).toBeGreaterThan(2.5);
    expect(waitIdleFor(30)).toBe(TRANSPORT.maxWaitIdle);
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
  const AT_REST: PromptInput = {
    started: true,
    sinceStart: 30,
    p: 0.3,
    card: false,
    rewinding: false,
    idle: 3,
    turn: true,
  };

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
    // Once its beat is over it goes while she drives, and comes back once it is her turn on the title.
    expect(hintOpacity({ ...AT_REST, sinceStart: 9, p: 0.01, idle: 0.2, turn: false })).toBe(0);
    expect(hintOpacity({ ...AT_REST, sinceStart: 9, p: 0.01, idle: 3 })).toBe(1);
  });

  it("answers her first input for as long as the name forms (sinceStart stays 0), then a beat", () => {
    for (const p of [0, 0.012, PROMPT.hintFrom]) {
      expect(promptFor({ ...AT_REST, sinceStart: 0, p, turn: false })).toBe("ack");
      expect(hintOpacity({ ...AT_REST, sinceStart: 0, p, turn: false })).toBe(1);
    }
    expect(promptFor({ ...AT_REST, sinceStart: PROMPT.ackHold + PROMPT.ackFade, p: 0.01, turn: false })).toBeNull();
  });

  it("says keep driving, in full, when she rests on the title with the wheel, never take the wheel again", () => {
    const back: PromptInput = { ...AT_REST, p: 0, sinceStart: 30, idle: 3 };
    expect(promptFor(back)).toBe("onward");
    expect(hintOpacity(back)).toBe(1);
    expect(promptFor({ ...back, p: PROMPT.titleRest - 0.001 })).toBe("onward");
    expect(promptFor({ ...back, p: PROMPT.titleRest })).toBe("between");
    // Right after "you have the wheel" (three flicks while the name formed, then a rest).
    expect(promptFor({ ...back, p: 0.02, sinceStart: PROMPT.ackHold + PROMPT.ackFade })).toBe("onward");
    for (let p = 0; p < 1; p += 0.001) {
      for (const sinceStart of [0, 1, 3, 30]) {
        for (const turn of [false, true]) expect(promptFor({ ...back, p, sinceStart, turn })).not.toBe("hint");
      }
    }
    // Only once it is her turn (the readout says WAITING), never next to YOU DRIVE.
    expect(promptFor({ ...back, turn: false })).toBeNull();
    // The bars are at most 3/8 out there: the hint still sits in the bottom bar.
    expect(PROMPT.titleRest / STORY.barsOut).toBeLessThanOrEqual(0.375);
  });

  it("asks for more only on her turn: never while she scrolls, rewinds, or a card is up", () => {
    expect(promptFor({ ...AT_REST, idle: 0.2, turn: false })).toBeNull();
    expect(promptFor({ ...AT_REST, rewinding: true })).toBeNull();
    expect(promptFor({ ...AT_REST, card: true })).toBeNull();
    expect(promptFor({ ...AT_REST, idle: 9, turn: false })).toBeNull();
    expect(promptFor(AT_REST)).toBe("between");
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
      // Wherever she stops, once it is her turn, a card (with its marker) or a prompt is up.
      const timeline = heroTimeline(lines);
      for (let p = 0; p < 1; p += 0.0005) {
        const card = activeCard(p, timeline) >= 0;
        for (const sinceStart of [3, 10, 60]) {
          const prompt = promptFor({ started: true, sinceStart, p, card, rewinding: false, idle: 3, turn: true });
          expect(card || prompt !== null, `p ${p.toFixed(4)}`).toBe(true);
        }
      }
      expect(
        promptFor({ started: false, sinceStart: Infinity, p: 0, card: false, rewinding: false, idle: 3, turn: false }),
      ).toBe("hint");
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

describe("the hold note", () => {
  const FRAME = 1 / 60;
  /**
   * Runs the note over `seconds` of frames `dt` long, pushing per `push(t)`
   * (held viewport heights this frame; 0: no push).
   */
  function run(
    note: HoldNote,
    seconds: number,
    push: (t: number) => number,
    card = 2,
    log?: boolean[],
    dt = FRAME,
    state = { sincePush: Number.POSITIVE_INFINITY },
    gap: number = HOLD_NOTE.gap,
  ) {
    for (let t = 0; t < seconds - 1e-9; t += dt) {
      const held = push(t);
      state.sincePush = isNotePush(held, dt) ? 0 : state.sincePush + dt;
      stepHoldNote(note, state.sincePush, held, card, dt, gap);
      log?.push(note.visible);
    }
    return state;
  }

  it("never scolds a flick or two, however long", () => {
    for (const gap of [0.25, 0.35, 0.6]) {
      for (const stroke of [0.45, 0.65, 0.9]) {
        const note = newHoldNote();
        const log: boolean[] = [];
        // Two strokes of 0.15 s, each throwing `stroke` viewports at the wall.
        run(note, 3, (t) => (t % gap < 0.15 && t < gap * 2 ? stroke / 9 : 0), 2, log);
        expect(log.some(Boolean), `gap ${gap}, ${stroke} vh`).toBe(false);
      }
    }
  });

  it("shows under sustained pushing, and goes the moment she stops", () => {
    const note = newHoldNote();
    const log: boolean[] = [];
    // A frantic wheel: a 100 px notch every 1/15 s on a 900 px screen.
    const state = run(note, 2, (t) => (Math.round(t * 60) % 4 === 0 ? 100 / 900 : 0), 2, log);
    const on = log.indexOf(true) * FRAME;
    expect(on).toBeGreaterThanOrEqual(HOLD_NOTE.sustain - FRAME);
    expect(on).toBeLessThanOrEqual(HOLD_NOTE.sustain + 0.1);
    expect(log.at(-1)).toBe(true);
    const after: boolean[] = [];
    run(note, 1, () => 0, 2, after, FRAME, state);
    expect(after.indexOf(false) * FRAME).toBeLessThanOrEqual(HOLD_NOTE.gap);
  });

  it("runs on real time: a slow device neither scolds sooner nor keeps it up longer", () => {
    for (const dt of [1 / 30, 1 / 4, 1 / 2]) {
      const note = newHoldNote();
      const log: boolean[] = [];
      // Frantic input at 4 fps arrives as a few notches a frame.
      const state = run(note, 3, () => (1.5 * dt), 2, log, dt);
      const on = log.indexOf(true) * dt;
      expect(on, `dt ${dt}`).toBeGreaterThanOrEqual(HOLD_NOTE.sustain - dt);
      expect(on, `dt ${dt}`).toBeLessThanOrEqual(HOLD_NOTE.sustain + dt);
      const after: boolean[] = [];
      run(note, 2, () => 0, 2, after, dt, state);
      expect(after.indexOf(false) * dt, `dt ${dt}`).toBeLessThanOrEqual(HOLD_NOTE.gap);
    }
  });

  it("counts a frame as a push only when the held input grew in it, fast enough", () => {
    expect(isNotePush(0, FRAME)).toBe(false);
    expect(isNotePush(1, 0)).toBe(false);
    // A thumb resting on the glass jitters a pixel a frame: no push.
    expect(isNotePush(1 / 844, FRAME)).toBe(false);
    expect(isNotePush(HOLD_NOTE.tail * FRAME * 1.01, FRAME)).toBe(true);
  });

  it("never takes a thumb resting on the glass for a push", () => {
    for (const gap of [HOLD_NOTE.gap, HOLD_NOTE.touchGap]) {
      const note = newHoldNote();
      const log: boolean[] = [];
      // Two quick flicks, the thumb left on the card, stretched: nothing new is held.
      run(note, 0.45, (t) => (t % 0.3 < 0.12 ? 0.55 / 7 : 0), 2, log, FRAME, undefined, gap);
      run(note, 3, () => 0, 2, log, FRAME, undefined, gap);
      expect(log.some(Boolean), `gap ${gap}`).toBe(false);
    }
  });

  it("on touch, bridges the lift between strokes: flicks that keep coming bring it, two never do", () => {
    for (const every of [0.4, 0.6, 0.8]) {
      const note = newHoldNote();
      const log: boolean[] = [];
      const state = run(note, 3, (t) => (t % every < 0.12 ? 0.45 / 7 : 0), 2, log, FRAME, undefined, HOLD_NOTE.touchGap);
      expect(log.some(Boolean), `every ${every} s`).toBe(true);
      const after: boolean[] = [];
      run(note, 2, () => 0, 2, after, FRAME, state, HOLD_NOTE.touchGap);
      expect(after.indexOf(false) * FRAME, `every ${every} s`).toBeLessThanOrEqual(HOLD_NOTE.touchGap);
    }
    for (const apart of [0.3, 0.5, HOLD_NOTE.touchGap + 0.1]) {
      const note = newHoldNote();
      const log: boolean[] = [];
      run(note, 3, (t) => ((t < 0.15 || (t >= apart && t < apart + 0.15)) ? 0.9 / 9 : 0), 2, log, FRAME, undefined, HOLD_NOTE.touchGap);
      expect(log.some(Boolean), `two flicks ${apart} s apart`).toBe(false);
    }
  });

  it("only talks about an unread card, and on a few lines a visit", () => {
    const note = newHoldNote();
    const log: boolean[] = [];
    run(note, 2, () => 0.1, -1, log);
    expect(log.some(Boolean)).toBe(false);
    for (let card = 0; card < 6; card += 1) {
      const shown: boolean[] = [];
      run(note, 2, () => 0.1, card, shown);
      expect(shown.some(Boolean), `card ${card}`).toBe(card < HOLD_NOTE.maxShows);
    }
    expect(note.shows).toBe(HOLD_NOTE.maxShows);
  });
});

describe("reminders", () => {
  it("escalate a long wait first when the car crawls lower", () => {
    expect(REMINDERS[0]).toBe(WAIT.deepAfter);
    for (let i = 1; i < REMINDERS.length; i += 1) expect(REMINDERS[i]).toBeGreaterThan(REMINDERS[i - 1]);
  });
});

describe("focusFromPointer", () => {
  it("takes focus right after a click or a release for the pointer's", () => {
    expect(focusFromPointer({ focusAt: 1500, pointerAt: 1000, keyAt: 0 })).toBe(true);
    expect(focusFromPointer({ focusAt: 1000 + POINTER_FOCUS_MS, pointerAt: 1000, keyAt: 0 })).toBe(false);
  });

  it("gives a Tab right after a click to the keyboard", () => {
    expect(focusFromPointer({ focusAt: 1200, pointerAt: 1000, keyAt: 1150 })).toBe(false);
    expect(focusFromPointer({ focusAt: 1200, pointerAt: 1000, keyAt: 1000 })).toBe(false);
  });

  it("keeps a control the pointer focused the pointer's when a dialog hands the focus back, until a Tab", () => {
    // The radio button clicked at 1000 (its focus then), its wheel closed with Esc at 4000.
    const back = { focusAt: 4010, pointerAt: 1000, keyAt: 4000, ownedAt: 1005 };
    expect(focusFromPointer(back)).toBe(true);
    expect(focusFromPointer({ ...back, tabAt: 900 })).toBe(true);
    // Tabbed away and back: the keyboard's.
    expect(focusFromPointer({ ...back, tabAt: 3000 })).toBe(false);
    // Never focused by the pointer: the keyboard's.
    expect(focusFromPointer({ ...back, ownedAt: undefined })).toBe(false);
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

  it("reads her demand, not the pace the limiter caps: pushing at a card still offers Skip", () => {
    // The limiter holds the pace at x1.235; she asks for x1.8.
    expect(limitPace()).toBeLessThan(THROTTLE.ff);
    const demand = 1.8;
    expect(pushingHard({ demand, holding: true, wall: 3 })).toBe(true);
    let level = 0;
    for (let t = 0; t < 3.5; t += 1 / 60) level = fightLevel(level, pushingHard({ demand, holding: true, wall: 3 }), 1 / 60);
    expect(level).toBeGreaterThanOrEqual(FIGHT.expandAt);
  });

  it("is no hard push without a wall holding her, or under full throttle", () => {
    expect(pushingHard({ demand: 1.8, holding: false, wall: 3 })).toBe(false);
    expect(pushingHard({ demand: 1.8, holding: true, wall: -1 })).toBe(false);
    expect(pushingHard({ demand: paceFor(0.3), holding: true, wall: 3 })).toBe(false);
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
    expect(keyAction(key("w"))).toBe("gas");
    expect(keyAction(key("W", { shiftKey: true }))).toBe("gas");
    expect(keyAction(key("s"))).toBe("up");
    expect(keyAction(key("Home"))).toBe("home");
    expect(keyAction(key("End"))).toBe("skip");
    expect(keyAction(key("Escape"))).toBe("skip");
    expect(keyAction(key("a"))).toBeNull();
    expect(keyAction(key("Enter"))).toBeNull();
  });

  it("takes the page's own jumps to its ends for End and Home, so none animates natively", () => {
    expect(keyAction(key("End", { ctrlKey: true }))).toBe("skip");
    expect(keyAction(key("End", { ctrlKey: true, shiftKey: true }))).toBe("skip");
    expect(keyAction(key("Home", { ctrlKey: true }))).toBe("home");
    // A Mac's: Cmd+Down and Cmd+Up.
    expect(keyAction(key("ArrowDown", { metaKey: true }))).toBe("skip");
    expect(keyAction(key("ArrowUp", { metaKey: true }))).toBe("home");
    // Not in a text field, where they move the caret.
    expect(keyAction(key("End", { ctrlKey: true, targetKind: "text" }))).toBeNull();
    expect(keyAction(key("ArrowDown", { metaKey: true, targetKind: "text" }))).toBeNull();
    // Not with Alt, nor other combinations.
    expect(keyAction(key("End", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(keyAction(key("ArrowDown", { ctrlKey: true }))).toBeNull();
    expect(keyAction(key("PageDown", { ctrlKey: true }))).toBeNull();
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

  it("makes W the pedal by its physical place, so AZERTY's Z drives and its W does not back up", () => {
    expect(keyAction(key("z", { code: "KeyW" }))).toBe("gas");
    expect(keyAction(key("w", { code: "KeyW" }))).toBe("gas");
    expect(keyAction(key("ArrowDown", { code: "ArrowDown" }))).toBe("down");
    expect(keyAction(key("w", { code: "KeyW", ctrlKey: true }))).toBeNull();
    expect(keyAction(key("w", { code: "KeyW", targetKind: "text" }))).toBeNull();
  });

  it("keeps Space a line step, and gives the focused pedal Space and Enter", () => {
    expect(keyAction(key(" ", { code: "Space" }))).toBe("next");
    expect(keyAction(key(" ", { targetKind: "button", onPedal: true }))).toBe("next");
    expect(keyAction(key("Enter", { targetKind: "button", onPedal: true }))).toBe("next");
    expect(keyAction(key("Enter", { targetKind: "button" }))).toBeNull();
  });
});

describe("skipSwallowed", () => {
  const ESC = { action: "skip", key: "Escape", repeat: false, sinceSkipMs: Infinity, sinceDialogEscMs: Infinity } as const;

  it("lets a lone Esc or End skip", () => {
    expect(skipSwallowed(ESC)).toBe(false);
    expect(skipSwallowed({ ...ESC, key: "End" })).toBe(false);
  });

  it("swallows a second Esc or End right after a skip: it would go on past the line-up", () => {
    for (const key of ["Escape", "End"]) {
      expect(skipSwallowed({ ...ESC, key, sinceSkipMs: 120 })).toBe(true);
      expect(skipSwallowed({ ...ESC, key, sinceSkipMs: SKIP_AGAIN.afterSkipMs - 1 })).toBe(true);
      expect(skipSwallowed({ ...ESC, key, sinceSkipMs: SKIP_AGAIN.afterSkipMs })).toBe(false);
    }
    // A held key's autorepeat never skips twice.
    expect(skipSwallowed({ ...ESC, repeat: true })).toBe(true);
  });

  it("swallows an Esc right after one a dialog took: she was closing the radio, not skipping the film", () => {
    expect(skipSwallowed({ ...ESC, sinceDialogEscMs: 200 })).toBe(true);
    expect(skipSwallowed({ ...ESC, sinceDialogEscMs: SKIP_AGAIN.afterDialogEscMs })).toBe(false);
    // End is no dialog's key: it still skips.
    expect(skipSwallowed({ ...ESC, key: "End", sinceDialogEscMs: 200 })).toBe(false);
  });

  it("leaves every other key alone", () => {
    expect(skipSwallowed({ ...ESC, action: "next", key: " ", sinceSkipMs: 10 })).toBe(false);
    expect(skipSwallowed({ ...ESC, action: null, key: "x", sinceSkipMs: 10, repeat: true })).toBe(false);
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
