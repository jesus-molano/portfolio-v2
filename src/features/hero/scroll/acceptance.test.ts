/**
 * The pure half of the scroll UX acceptance checks: a model of real
 * scrollers (testing/scrollerModel.ts: Lenis, the gate, the story and the
 * feedback HeroStage draws) run frame by frame. What needs a browser
 * (latency, layout, animations, the radio's gestures) is checked on a
 * running dev server; what is decided by the story and the feedback is
 * checked here, on every script line in both languages.
 */
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { createRandom } from "../scene/world";
import { DASH } from "./dash";
import { GATE } from "./gate";
import { STORY } from "./story";
import { PEDAL } from "./pedal";
import {
  answering,
  arrows,
  backAt,
  drag,
  during,
  jump,
  pedal,
  pedalBy,
  pedalTaps,
  pump,
  restless,
  settle,
  type SimFrame,
  simulate,
  type Source,
  space,
  strokeAndRest,
  together,
  touch,
  trackpad,
  tremble,
  tremor,
  wheel,
} from "./testing/scrollerModel";
import { THROTTLE, WAIT } from "./throttle";
import { HOLD_NOTE, TRANSPORT } from "./transport";

/** The longest she may rest before it is her turn: her own beat at most, and the dwell. */
const TURN = TRANSPORT.maxWaitIdle + TRANSPORT.turnDwell;

const FRAME = 1 / 60;
const LOCALES = [
  ["en", en.hero.lines],
  ["es", es.hero.lines],
] as const;

/** Every scroller, from frantic to calm, with the viewport it runs on. */
const SCROLLERS: [string, Source, number][] = [
  ["wheel 1/s", wheel(1), 900],
  ["wheel 3/s", wheel(3), 900],
  ["wheel 15/s", wheel(15), 900],
  ["trackpad swipe every 0.6 s", trackpad(0.6, 90), 900],
  ["trackpad swipe every 1.5 s", trackpad(1.5), 900],
  ["touch 400 px every 0.35 s", touch(0.35), 750],
  ["touch 250 px every 1 s", touch(1, 250, 0.15), 750],
  ["Space every 0.5 s", space(0.5), 900],
  ["Space every 2 s", space(2), 900],
  ["ArrowDown autorepeat 30/s", arrows(30), 900],
];

const STOPS = [2, 5, 9, 14, 20, 27];

/** Frames from `from` seconds on. */
const after = (frames: SimFrame[], from: number) => frames.filter((frame) => frame.time >= from - 1e-9);

describe("acceptance: one state at a time", () => {
  for (const [locale, lines] of LOCALES) {
    for (const [label, source, vh] of SCROLLERS) {
      it(`${locale}, ${label}: the hero says "hold on" or "your turn", never both`, () => {
        for (const stopAt of [...STOPS, Number.POSITIVE_INFINITY]) {
          const run = simulate(lines, source, { vh, stopAt, maxTime: Math.min(stopAt + 12, 90) });
          for (const frame of run.frames) {
            const at = `${stopAt} s, frame at ${frame.time.toFixed(2)} s`;
            // WAITING (and the brake that comes with it) never while a line plays or the note scolds.
            if (frame.mode === "waiting") {
              expect(frame.playing, at).toBeNull();
              expect(frame.holdNote, at).toBe(false);
              if (frame.active >= 0) expect(frame.fill, at).toBe(1);
            }
            // The note is about a line still playing, never a read one.
            if (frame.holdNote) {
              expect(frame.playing, at).toBe("card");
              expect(frame.ready, at).toBe(false);
            }
            // While a line plays the car never brakes toward the crawl.
            if (frame.playing !== null) expect(frame.waitingFor, at).toBe(-1);
            // And the other way: the marker and the cues ask for more only with WAITING, never next to YOU DRIVE.
            const asks = frame.ready || frame.prompt === "between" || frame.prompt === "onward";
            if (asks && frame.mode !== "hidden") expect(frame.mode, at).toBe("waiting");
          }
        }
      });
    }
  }
});

describe("acceptance: the idle state is unmistakable", () => {
  for (const [locale, lines] of LOCALES) {
    for (const [label, source, vh] of SCROLLERS) {
      it(`${locale}, ${label}: once she stops, the film says it is her turn, brakes, then escalates`, () => {
        for (const stopAt of STOPS) {
          const run = simulate(lines, source, { vh, stopAt, maxTime: stopAt + 14 });
          const rest = after(run.frames, run.lastInput + 0.6);
          // A short script can be over by then: the fade shows the way into the city instead.
          if (rest[0].p >= STORY.fadeFrom) {
            expect(after(rest, run.lastInput + STORY.endIdle + 2 * FRAME).every((frame) => frame.prompt === "end")).toBe(true);
            continue;
          }
          // Once the glide of her own last input has landed (Lenis lerp 0.09: under half a pixel a
          // frame within about 0.6 s, the last pixels slower), the picture does not move again.
          expect(run.lastFastMove).toBeLessThanOrEqual(0.75);
          const landed = after(rest, run.lastInput + 1.5);
          for (const frame of landed) expect(Math.abs(frame.p - landed[0].p)).toBeLessThanOrEqual(1e-6);
          // Whatever was playing ends (a line's reading time is a few seconds)...
          let lastPlaying = -1;
          rest.forEach((frame, i) => {
            if (frame.playing !== null) lastPlaying = i;
          });
          const done = rest[lastPlaying + 1];
          expect(done, `${stopAt} s`).toBeDefined();
          const turn = Math.max(done.time, run.lastInput + TRANSPORT.maxWaitIdle) + TRANSPORT.turnDwell;
          // ...then the readout says WAITING, at most her own beat (and the dwell) later...
          const waiting = rest.find((frame) => frame.mode === "waiting");
          expect(waiting, `${stopAt} s`).toBeDefined();
          expect(waiting!.time).toBeLessThanOrEqual(turn + 2 * FRAME);
          // ...and the way on is on screen: the read card's marker, or a prompt.
          for (const frame of after(rest, waiting!.time)) {
            expect(frame.ready || frame.prompt !== null, `${stopAt} s, ${frame.time.toFixed(2)} s`).toBe(true);
          }
          // The car brakes to the crawl within a few seconds, and lower after a long wait.
          const crawling = after(rest, waiting!.time + WAIT.delay + WAIT.ramp + 1.5);
          expect(crawling[0].pace).toBeLessThanOrEqual(THROTTLE.crawl + 0.05);
          expect(run.frames.at(-1)!.pace).toBeLessThanOrEqual(THROTTLE.deepCrawl + 0.02);
          // The bar fills while the line plays and never goes back.
          let fill = 0;
          let card = -2;
          for (const frame of rest) {
            if (frame.active !== card) {
              card = frame.active;
              fill = 0;
            }
            expect(frame.fill).toBeGreaterThanOrEqual(fill - 1e-9);
            fill = frame.fill;
          }
        }
      });
    }
  }

  it("shows the marker or the cue together with WAITING, the moment it is her turn", () => {
    for (const [, lines] of LOCALES) {
      for (const [source, vh] of [
        [wheel(3), 900],
        [touch(0.35), 750],
        [space(0.5), 900],
      ] as const) {
        for (const stopAt of STOPS) {
          const run = simulate(lines, source, { vh, stopAt, maxTime: stopAt + 12 });
          const rest = after(run.frames, run.lastInput);
          const waiting = rest.findIndex((frame) => frame.mode === "waiting");
          const at = `${stopAt} s`;
          if (waiting < 0) {
            // Only past the fade, where the end cue asks instead.
            expect(rest.at(-1)!.p, at).toBeGreaterThanOrEqual(STORY.fadeFrom);
            continue;
          }
          const frame = rest[waiting];
          // In the same frame: the read card's marker, or a prompt where no card is up.
          // ("You have the wheel" may still finish its beat on the title: it says the same.)
          if (frame.active >= 0) expect(frame.ready, at).toBe(true);
          else expect(frame.prompt === "between" || frame.prompt === "onward" || frame.prompt === "ack", at).toBe(true);
          // Never earlier.
          for (const before of rest.slice(0, waiting)) expect(before.ready || before.prompt === "between", at).toBe(false);
        }
      }
    }
  });

  it("asks for the first input on the title, and nothing moves until she gives it", () => {
    const run = simulate(en.hero.lines, wheel(1), { startAt: 30, maxTime: 30 });
    for (const frame of run.frames) {
      expect(frame.p).toBe(0);
      expect(frame.prompt).toBe("hint");
      expect(frame.mode).toBe("hidden");
    }
  });
});

describe("acceptance: the hold note", () => {
  for (const [locale, lines] of LOCALES) {
    it(`${locale}: scolds sustained pushing at once, and goes the moment she stops`, () => {
      for (const [source, vh, gap] of [
        [wheel(15), 900, HOLD_NOTE.gap],
        [touch(0.35), 750, HOLD_NOTE.touchGap],
        [arrows(30), 900, HOLD_NOTE.gap],
      ] as const) {
        for (const stopAt of [8, 15, 22]) {
          const run = simulate(lines, source, { vh, stopAt, maxTime: stopAt + 4 });
          expect(run.frames.some((frame) => frame.holdNote)).toBe(true);
          const gone = gap + FRAME;
          for (const frame of after(run.frames, run.lastInput + gone)) expect(frame.holdNote).toBe(false);
        }
      }
    });

    it(`${locale}: never scolds a calm reader`, () => {
      for (const [source, vh] of [
        [wheel(1), 900],
        [wheel(0.4), 900],
        [trackpad(1.5), 900],
        [touch(1, 250, 0.15), 750],
        [space(2), 900],
      ] as const) {
        const run = simulate(lines, source, { vh, maxTime: 60 });
        expect(run.frames.some((frame) => frame.holdNote)).toBe(false);
      }
    });

    it(`${locale}: never scolds two flicks, however long, or one trackpad fling`, () => {
      // A calm reader reaches a line; two quick flicks, or one fling, the moment it is up.
      const calm = wheel(1);
      for (const vh of [750, 900]) {
        const reach = simulate(lines, calm, { maxTime: 60, vh });
        for (const card of [1, 2, 3]) {
          const up = reach.frames.find((frame) => frame.playing === "card" && frame.active === card)!.time;
          const tries: [string, Source][] = [];
          for (const stroke of [350, 450, 550, 650]) {
            for (const gap of [0.3, 0.4, 0.5]) {
              tries.push([`two ${stroke} px flicks ${gap} s apart`, during(up, up + gap + 0.15 + FRAME, touch(gap, stroke, 0.15))]);
            }
          }
          for (const peak of [60, 90, 120, 200]) {
            tries.push([`a fling peaking at ${peak} px`, during(up, up + 3, trackpad(10, peak))]);
          }
          for (const [label, input] of tries) {
            const run = simulate(lines, together(during(0, up, calm), input), { vh, maxTime: up + 4 });
            const at = after(run.frames, up);
            const what = `${vh} px, card ${card}, ${label}`;
            // They did push at the line...
            expect(Math.max(...at.map((frame) => frame.holdHeld)), what).toBeGreaterThan(0.3);
            // ...and were answered by the bounce and the surge, not a scolding.
            expect(at.some((frame) => frame.holdNote), what).toBe(false);
          }
        }
      }
    });
  }
});

describe("acceptance: the hold note under a finger", () => {
  for (const [locale, lines] of LOCALES) {
    const calm = wheel(1);
    const reach = simulate(lines, calm, { maxTime: 60, vh: 750 });
    const upAt = (card: number) => reach.frames.find((frame) => frame.playing === "card" && frame.active === card)!.time;

    it(`${locale}: a thumb left on the glass after two quick flicks is no push`, () => {
      for (const card of [1, 2, 3]) {
        const up = upAt(card);
        for (const stroke of [350, 500, 650]) {
          // A flick, a second one 0.3 s later whose thumb stays on the glass, then stillness.
          const input = together(during(up, up + 0.3, touch(0.3, stroke, 0.12)), during(up + 0.3, up + 6, strokeAndRest(stroke, 0.12)));
          const run = simulate(lines, together(during(0, up, calm), input), { vh: 750, maxTime: up + 6 });
          const at = after(run.frames, up);
          const what = `card ${card}, ${stroke} px`;
          expect(Math.max(...at.map((frame) => frame.holdHeld)), what).toBeGreaterThan(0.3);
          expect(at.some((frame) => frame.holdNote), what).toBe(false);
        }
      }
    });

    it(`${locale}: flicks that keep coming, or a finger dragging on, bring the note; it goes once she stops`, () => {
      for (const card of [1, 2, 3]) {
        const up = upAt(card);
        const tries: [string, Source][] = [];
        for (const gap of [0.4, 0.55, 0.7, 0.8]) tries.push([`a flick every ${gap} s`, touch(gap, 400, 0.12)]);
        tries.push(["a finger dragging on at a viewport a second", drag(1)]);
        for (const [label, input] of tries) {
          const run = simulate(lines, together(during(0, up, calm), during(up, up + 3, input)), { vh: 750, maxTime: up + 5 });
          const at = after(run.frames, up);
          const what = `card ${card}, ${label}`;
          const first = at.find((frame) => frame.holdNote);
          expect(first, what).toBeDefined();
          // Once the pushes span over a second, never at the first stroke.
          expect(first!.holdSpan, what).toBeGreaterThanOrEqual(HOLD_NOTE.sustain - 1e-9);
          expect(first!.time - up, what).toBeGreaterThan(0.4);
          for (const frame of after(run.frames, run.lastInput + HOLD_NOTE.touchGap + FRAME)) expect(frame.holdNote, what).toBe(false);
        }
      }
    });
  }
});

describe("acceptance: a resting thumb that trembles is still", () => {
  for (const [locale, lines] of LOCALES) {
    const calm = wheel(1);
    const reach = simulate(lines, calm, { maxTime: 60, vh: 750 });
    const upAt = (card: number) => reach.frames.find((frame) => frame.playing === "card" && frame.active === card)!.time;

    it(`${locale}: a calm swipe, then a thumb trembling 0.3 to 3 px on the glass: the line stays up and is read`, () => {
      for (const card of [1, 2, 3]) {
        // The line has come up and is being read.
        const up = upAt(card) + 0.4;
        for (const amp of [0.3, 0.67, 1, 2, 3]) {
          const input = together(during(up, up + 0.15, strokeAndRest(60, 0.15)), during(up + 0.15, up + 3.15, tremble(amp)));
          const run = simulate(lines, together(during(0, up, calm), input), { vh: 750, maxTime: up + 3.15 });
          const rest = run.frames.filter((frame) => frame.time >= up + 0.4 && frame.time < up + 3.15);
          const what = `card ${card}, ${amp} px`;
          // Never read as going back, never as pushing: the line stays on screen...
          expect(rest.filter((frame) => frame.mode === "reverse").length, what).toBe(0);
          expect(rest.every((frame) => frame.active === card && frame.opacity[card] >= STORY.fullyVisible), what).toBe(true);
          expect(rest.some((frame) => frame.holdNote), what).toBe(false);
          // ...and its reading clock runs: read to the end, or 2.7 s further on.
          const first = rest[0].fill;
          const last = rest.at(-1)!.fill;
          expect(last >= 1 || last - first > 0.2, `${what}: ${first} -> ${last}`).toBe(true);
        }
      }
    });

    it(`${locale}: two quick flicks, then a thumb left trembling on the glass: no note, no REVERSE`, () => {
      for (const card of [1, 2, 3]) {
        const up = upAt(card);
        for (const stroke of [350, 500, 650]) {
          const input = together(
            during(up, up + 0.3, touch(0.3, stroke, 0.12)),
            during(up + 0.3, up + 0.42, strokeAndRest(stroke, 0.12)),
            during(up + 0.42, up + 6, tremble(3)),
          );
          const run = simulate(lines, together(during(0, up, calm), input), { vh: 750, maxTime: up + 6 });
          const rest = after(run.frames, up + 0.42 + STORY.rewindHide + FRAME);
          const what = `card ${card}, ${stroke} px`;
          expect(run.frames.some((frame) => frame.time >= up && frame.holdNote), what).toBe(false);
          expect(rest.filter((frame) => frame.mode === "reverse").length, what).toBe(0);
        }
      }
    });

    it(`${locale}: after a swipe back, a thumb resting on the glass is rest, not REVERSE`, () => {
      for (const card of [1, 2, 3]) {
        const up = upAt(card) + 0.4;
        for (const [amp, roll] of [
          [0.3, 0],
          [1, -3],
          [2, -7],
          [3, -7],
          [1, 3],
        ] as const) {
          // A calm swipe back of 200 px, the thumb left on the glass, trembling and rolling as it settles.
          const input = together(during(up, up + 0.15, strokeAndRest(-200, 0.15)), during(up + 0.15, up + 4.15, settle(amp, roll)));
          const run = simulate(lines, together(during(0, up, calm), input), { vh: 750, maxTime: up + 4.15 });
          const what = `card ${card}, ${amp} px, rolling ${roll} px`;
          // The swipe went back...
          const swiped = after(run.frames, up)[0];
          expect(Math.min(...after(run.frames, up).map((frame) => frame.p)), what).toBeLessThan(swiped.p - 150 / (5 * 750));
          // ...and once the thumb has come to rest on the glass (gate.ts Stroke) it is still: no
          // REVERSE, nothing hidden, the picture at rest.
          const rest = after(run.frames, up + 0.15 + GATE.restMs / 1000 + Math.max(STORY.rewindHide, TRANSPORT.reverseWindow) + 0.1);
          expect(rest.filter((frame) => frame.mode === "reverse").length, what).toBe(0);
          for (const frame of rest) expect(frame.p, `${what}, ${frame.time.toFixed(2)} s`).toBeCloseTo(rest[0].p, 6);
        }
      }
    });

    it(`${locale}: a real swipe back still rewinds, from a resting thumb or a new one`, () => {
      const up = upAt(2) + 0.4;
      // The same thumb, after resting and trembling, drags back at a viewport a second...
      const same = together(during(up, up + 0.15, strokeAndRest(60, 0.15)), during(up + 0.15, up + 1.15, tremble(3)), during(up + 1.15, up + 1.6, drag(-1)));
      // ...or a new finger swipes back 150 px.
      const fresh = during(up, up + 0.5, touch(0.5, -150, 0.15));
      for (const [label, input, from] of [["resting thumb", same, up + 1.15], ["new finger", fresh, up]] as const) {
        const run = simulate(lines, together(during(0, up, calm), input), { vh: 750, maxTime: up + 2 });
        const back = run.frames.filter((frame) => frame.time >= from && frame.time < from + 0.45);
        const p0 = after(run.frames, from)[0].p;
        // REVERSE within a few frames of the drag, and the picture goes back.
        const firstReverse = back.find((frame) => frame.mode === "reverse");
        expect(firstReverse, label).toBeDefined();
        expect(firstReverse!.time - from, label).toBeLessThan(0.1);
        expect(Math.min(...back.map((frame) => frame.p)), label).toBeLessThan(p0 - 60 / (5 * 750));
      }
    });
  }
});

describe("acceptance: a calm reader's car does not lurch", () => {
  for (const [locale, lines] of LOCALES) {
    for (const beat of [2.5, 3, 3.5, 4, 4.5, 5]) {
      it(`${locale}: a notch every ${beat} s keeps a steady pace and readout`, () => {
        const run = simulate(lines, wheel(1 / beat), { maxTime: 8 + 10 * beat });
        const steady = after(run.frames, 8).filter((frame) => frame.p < STORY.fadeFrom);
        const paces = steady.map((frame) => frame.pace);
        expect(Math.min(...paces)).toBeGreaterThan(0.9);
        expect(Math.max(...paces)).toBeLessThan(1.45);
        let flips = 0;
        for (let i = 1; i < steady.length; i += 1) if (steady[i].mode !== steady[i - 1].mode) flips += 1;
        expect(flips).toBeLessThanOrEqual(2);
        expect(steady.some((frame) => frame.mode === "waiting")).toBe(false);
      });
    }

    it(`${locale}: a notch every 6 s, a stop-and-go reader, is told it is her turn without lurching the car`, () => {
      const run = simulate(lines, wheel(1 / 6), { maxTime: 60 });
      const steady = after(run.frames, 8);
      expect(steady.some((frame) => frame.mode === "waiting")).toBe(true);
      expect(Math.min(...steady.map((frame) => frame.pace))).toBeGreaterThan(0.8);
    });

    it(`${locale}: a visitor who waits to be asked, a notch each time, is asked again as soon as the first time`, () => {
      const run = simulate(lines, answering(0.3, () => [{ type: "wheel", delta: 100 }]), { maxTime: 120 });
      // Each ask comes as soon as it is her turn by the first wait (TRANSPORT.waitIdle after her notch,
      // once the picture is still and nothing plays): the pauses she spent waiting to be asked never
      // become a beat of hers that would stretch the next wait toward TRANSPORT.maxWaitIdle.
      let rest = Number.NaN;
      let asks = 0;
      for (let i = 1; i < run.frames.length; i += 1) {
        const frame = run.frames[i];
        if (frame.p >= STORY.fadeFrom) break;
        expect(frame.rhythm, `${frame.time.toFixed(2)} s`).toBeLessThan(TRANSPORT.waitIdle);
        const moving = Math.abs(frame.p - run.frames[i - 1].p) / FRAME >= TRANSPORT.stillSpeed;
        if (moving || frame.playing !== null) rest = frame.time;
        if (frame.idle < FRAME / 2) rest = frame.time + TRANSPORT.waitIdle;
        const ask = frame.mode === "waiting" && run.frames[i - 1].mode !== "waiting";
        if (!ask || Number.isNaN(rest)) continue;
        asks += 1;
        expect(frame.time - rest, `${frame.time.toFixed(2)} s`).toBeLessThanOrEqual(TRANSPORT.turnDwell + 0.5);
      }
      expect(asks).toBeGreaterThan(20);
      // She gets through the whole drive, one ask at a time.
      expect(run.frames.at(-1)!.p).toBeGreaterThanOrEqual(STORY.fadeFrom);
    });

    it(`${locale}: one swipe a second surges the car without flipping the readout to FLAT OUT`, () => {
      const run = simulate(lines, touch(1, 300, 0.15), { vh: 750, maxTime: 40 });
      const steady = after(run.frames, 3);
      expect(steady.some((frame) => frame.mode === "floored")).toBe(false);
      expect(Math.max(...steady.map((frame) => frame.pace))).toBeGreaterThan(1.3);
    });
  }
});

describe("acceptance: a slow device", () => {
  for (const fps of [4, 2]) {
    for (const [locale, lines] of LOCALES) {
      it(`${locale}, ${fps} fps: never scolds a calm reader, and drops the note and FLAT OUT as she stops`, () => {
        for (const beat of [1, 2.5]) {
          const run = simulate(lines, wheel(1 / beat), { fps, maxTime: 80 });
          expect(run.frames.some((frame) => frame.holdNote), `${beat} s`).toBe(false);
        }
        for (const stopAt of [10, 20]) {
          const run = simulate(lines, wheel(15), { fps, stopAt, maxTime: stopAt + 6 });
          expect(run.frames.some((frame) => frame.holdNote), `${stopAt} s`).toBe(true);
          for (const frame of after(run.frames, run.lastInput + HOLD_NOTE.gap + 1 / fps + 1e-6)) {
            expect(frame.holdNote, `${stopAt} s, ${frame.time.toFixed(2)} s`).toBe(false);
          }
          for (const frame of after(run.frames, run.lastInput + 2)) {
            expect(frame.mode, `${stopAt} s, ${frame.time.toFixed(2)} s`).not.toBe("floored");
          }
        }
      });
    }
  }
});

describe("acceptance: the title", () => {
  for (const [locale, lines] of LOCALES) {
    it(`${locale}: a short first swipe that rests mid-dissolve leaves no ghost of the title`, () => {
      for (const stroke of [100, 140, 170]) {
        // She waits for the name, then one short swipe into the dissolve.
        const run = simulate(lines, during(5, 5.2, touch(5, stroke, 0.15)), { vh: 750, maxTime: 15 });
        const parked = run.frames.at(-1)!;
        expect(parked.p, `${stroke} px`).toBeGreaterThan(STORY.titleWallTo);
        expect(parked.p, `${stroke} px`).toBeLessThan(STORY.titleOut);
        const settled = after(run.frames, run.lastInput + TURN + STORY.titleSettle + 0.1);
        for (const frame of settled) expect(frame.title, `${stroke} px`).toBe(0);
      }
    });

    it(`${locale}: hard flicks while the name forms are answered, and never asked for again`, () => {
      for (const at of [0.5, 1.5, 2.5, 3.5]) {
        // Three hard flicks into the title wall, then she waits.
        const run = simulate(lines, during(at, at + 1.2, touch(0.4, 500, 0.1)), { vh: 750, maxTime: at + 12 });
        const after0 = after(run.frames, at + 0.05);
        const what = `${at} s`;
        // Answered in place while the name is still arriving...
        const naming = after0.filter((frame) => frame.naming);
        expect(naming.length, what).toBeGreaterThan(0);
        for (const frame of naming) expect(frame.prompt, `${what}, ${frame.time.toFixed(2)} s`).toBe("ack");
        // ...and, once it is her turn on the title, told how to go on: never to take the wheel she has.
        for (const frame of after0) expect(frame.prompt, `${what}, ${frame.time.toFixed(2)} s`).not.toBe("hint");
        const rest = run.frames.at(-1)!;
        if (rest.p < 0.06 && rest.mode === "waiting") expect(rest.prompt, what).toBe("onward");
      }
    });

    it(`${locale}: Space (or a tap) pressed while the name forms plays the first line once it has`, () => {
      for (const at of [0.2, 1.2, 2.5]) {
        const run = simulate(lines, during(at, at + 0.1, space(5)), { maxTime: 12 });
        const first = run.frames.find((frame) => frame.active === 0);
        expect(first, `${at} s`).toBeDefined();
        // Within a moment of the title's beat ending (the intro, hurried, and its 1.2 s hold).
        expect(first!.time, `${at} s`).toBeLessThan(at + 4);
      }
    });
  }
});

describe("acceptance: the page never traps her", () => {
  /** Every frame: the page is at most a hair past the wall, and the picture never past the frontier. */
  const neverPast = (frames: SimFrame[], what: string) => {
    for (const frame of frames) {
      expect(frame.page, `${what}, ${frame.time.toFixed(2)} s`).toBeLessThanOrEqual(frame.maxScroll + GATE.snapSlop + 1e-6);
      expect(frame.p, `${what}, ${frame.time.toFixed(2)} s`).toBeLessThanOrEqual(frame.frontier + 1e-9);
    }
  };

  for (const [locale, lines] of LOCALES) {
    for (const fps of [60, 4, 0.8]) {
      it(`${locale}, ${fps} fps: a native jump past the frontier is put back in the same frame, and she drives on`, () => {
        const calm = wheel(1);
        const reach = simulate(lines, calm, { maxTime: 40 });
        for (const card of [0, 1, 3]) {
          const up = reach.frames.find((frame) => frame.playing === "card" && frame.active === card)!.time;
          // Just past the wall, deep into the film, past the hero, the bottom of the page.
          for (const to of [STORY.titleOut + 0.05, 0.6, 1.15, 1.4]) {
            for (const seen of [false, true]) {
              const what = `card ${card}, to ${to}, ${seen ? "seen" : "missed"} by Lenis`;
              const at = up + 0.5;
              const run = simulate(lines, together(during(0, up, calm), jump(at, to, seen), during(at + 2, 200, wheel(3))), {
                fps,
                maxTime: at + 70,
              });
              neverPast(run.frames, what);
              // No card was passed early, and the film goes on: to the end, or, under 4 fps,
              // where every line reads slower than real time (STORY.maxStep), well on.
              expect(run.earlyCards, what).toBe(0);
              const final = run.frames.at(-1)!.p;
              if (fps >= 4) expect(final, what).toBeGreaterThanOrEqual(0.999);
              else expect(final, what).toBeGreaterThan(after(run.frames, at)[0].p + 0.2);
            }
          }
        }
      });
    }

    it(`${locale}: a 40-notch burst inside one long frame never pushes the page past the wall`, () => {
      for (const fps of [0.8, 1, 2]) {
        for (const at of [3, 8, 14]) {
          const run = simulate(lines, together(during(0, at, wheel(1)), during(at, at + 0.64, wheel(62.5)), during(at + 4, 200, wheel(1))), {
            fps,
            maxTime: at + 90,
          });
          neverPast(run.frames, `${fps} fps, at ${at} s`);
          expect(run.earlyCards).toBe(0);
          // After the burst, a calm wheel still moves the film on.
          const after4 = after(run.frames, at + 4)[0].p;
          expect(run.frames.at(-1)!.p, `${fps} fps, at ${at} s`).toBeGreaterThan(after4 + 0.2);
        }
      }
    });
  }

  it("keeps the page at the wall for every scroller, fling and fuzzed visitor", () => {
    for (const [label, source, vh] of SCROLLERS) neverPast(simulate(en.hero.lines, source, { vh, maxTime: 60 }).frames, label);
    for (const seed of [2, 5, 9]) neverPast(simulate(es.hero.lines, restless(createRandom(seed)), { maxTime: 60 }).frames, `seed ${seed}`);
  });
});

describe("acceptance: her input goes on from where the page is", () => {
  for (const [locale, lines] of LOCALES) {
    it(`${locale}: a native move Lenis has not heard of, then a notch in the same frame: on from there, never back`, () => {
      const range = 5 * 900;
      for (const fps of [60, 4, 0.8]) {
        // Read to the end (the walls open): slower under 4 fps, where the reading clocks are capped.
        const read = simulate(lines, wheel(3), { fps, maxTime: 900 });
        const open = read.frames.find((frame) => !Number.isFinite(frame.frontier))!.time;
        // Past the hero (the walls open), then further down or back up into the hero.
        for (const to of [1.15, 1.3, 0.4]) {
          const at = Math.ceil((open + 3) * fps) / fps;
          const run = simulate(lines, together(during(0, open + 1, wheel(3)), jump(at, to, false), during(at, at + 0.01, wheel(0.1))), {
            fps,
            maxTime: at + 3,
          });
          const what = `${fps} fps, to ${to}`;
          const settled = run.frames.at(-1)!;
          // One notch on from where the page was moved, never from where Lenis had it.
          expect(settled.page, what).toBeCloseTo(to * range + 100, 0);
          for (const frame of after(run.frames, at)) expect(frame.page, `${what}, ${frame.time.toFixed(2)} s`).toBeGreaterThanOrEqual(to * range - 1);
        }
      }
    });
  }
});

describe("acceptance: the pedal goes on from where the page is", () => {
  for (const [locale, lines] of LOCALES) {
    it(`${locale}: a native move Lenis has not heard of, then the pedal pressed and held: on from there, never back`, () => {
      const range = 5 * 900;
      for (const fps of [60, 4]) {
        const read = simulate(lines, wheel(3), { fps, maxTime: 900 });
        const open = read.frames.find((frame) => !Number.isFinite(frame.frontier))!.time;
        // The walls open, she is back at 0.2 (Lenis with her), then the scrollbar takes the page down
        // to 0.6 and W goes down in that same frame: the press steps on from 0.6, the hold drives on.
        const at = Math.ceil((open + 3) * fps) / fps;
        const moved = at + 1;
        const back = simulate(
          lines,
          together(during(0, open + 1, wheel(3)), jump(at, 0.2, true), jump(moved, 0.6, false), pedalBy("key", [moved, moved + 1.5])),
          { fps, maxTime: moved + 2.5 },
        );
        for (const frame of after(back.frames, moved)) {
          expect(frame.page, `${fps} fps, ${frame.time.toFixed(2)} s`).toBeGreaterThanOrEqual(0.6 * range - 1);
        }
        expect(back.frames.at(-1)!.page, `${fps} fps`).toBeGreaterThan(0.6 * range + 100);
        // Past the hero the pedal has gone with it: a press there moves nothing.
        const past = simulate(lines, together(during(0, open + 1, wheel(3)), jump(at, 1.3, false), pedal([at, at + 1.5])), {
          fps,
          maxTime: at + 2.5,
        });
        for (const frame of after(past.frames, at)) {
          expect(frame.page, `${fps} fps, past, ${frame.time.toFixed(2)} s`).toBeCloseTo(1.3 * range, 0);
        }
      }
    });
  }
});

describe("acceptance: no stuck states (fuzz)", () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    it(`seed ${seed}: keeps every invariant and always says how to go on`, () => {
      const lines = seed % 2 ? en.hero.lines : es.hero.lines;
      const vh = seed % 3 ? 900 : 750;
      const run = simulate(lines, restless(createRandom(seed)), { vh, maxTime: 120 });
      let frontier = 0;
      let lastInput = 0;
      let next = 0;
      for (const frame of run.frames) {
        while (next < run.inputs.length && run.inputs[next] <= frame.time + 1e-9) lastInput = run.inputs[next++];
        expect(frame.p).toBeLessThanOrEqual(frame.frontier + 1e-9);
        if (Number.isFinite(frame.frontier)) {
          expect(frame.frontier).toBeGreaterThanOrEqual(frontier - 1e-12);
          frontier = frame.frontier;
        }
        expect(Number.isFinite(frame.pace)).toBe(true);
        expect(frame.pace).toBeGreaterThanOrEqual(THROTTLE.deepCrawl - 1e-9);
        expect(frame.pace).toBeLessThanOrEqual(1 + THROTTLE.gain + 1e-9);
        // Once she has the wheel, nothing asks her to take it again.
        if (frame.started) expect(frame.prompt, `${frame.time.toFixed(2)} s`).not.toBe("hint");
        // Once it is her turn at the latest: a card up (its bar filling or its marker), a prompt, or the end.
        if (frame.time - lastInput >= TURN + 0.1 && run.inputs.length > 0) {
          const way = frame.active >= 0 || frame.prompt !== null || frame.p >= 0.999;
          expect(way, `${frame.time.toFixed(2)} s`).toBe(true);
        }
      }
    });
  }

  it("reaches the end from wherever a restless visitor left it, with a steady wheel", () => {
    for (const seed of [3, 8, 13]) {
      const run = simulate(
        en.hero.lines,
        together(during(0, 40, restless(createRandom(seed))), during(40, 200, wheel(3))),
        { maxTime: 110 },
      );
      expect(run.frames.at(-1)!.p, `seed ${seed}`).toBeGreaterThanOrEqual(0.999);
    }
  });
});

describe("acceptance: the dash and its pit limiter", () => {
  /** km/h the pace reads, as the dash's digits do. */
  const kmh = (pace: number) => Math.round(18 * 3.6 * pace);

  for (const [locale, lines] of LOCALES) {
    for (const [name, source, vh] of SCROLLERS) {
      it(`${locale}, ${name}: an unread line holds the car at 80 km/h at most, and its release fires once`, () => {
        const run = simulate(lines, source, { vh, maxTime: 90 });
        const what = `${locale} ${name}`;
        // A car arriving fast brakes into the pit lane: from a quarter of a second after the limiter caps it.
        let cappedFor = 0;
        for (const frame of run.frames) {
          cappedFor = frame.limited ? cappedFor + FRAME : 0;
          if (cappedFor >= 1) expect(kmh(frame.pace), `${what} ${frame.time.toFixed(2)} s`).toBeLessThanOrEqual(81);
          // LIMITER only ever explains a line on screen, and never shows next to a WAITING car.
          if (frame.show === "limiter") {
            expect(frame.playing, what).toBe("card");
            expect(frame.mode).not.toBe("waiting");
          }
        }
        // ALL CLEAR once per line read, never twice for the same wall.
        const walls = run.releases.map((release) => release.wall);
        expect(new Set(walls).size, what).toBe(walls.length);
        const cards = run.walls.filter((wall) => wall.kind === "card").length;
        if (run.endAt === run.endAt) expect(walls.length, what).toBe(cards);
      });
    }

    it(`${locale}: pushing on a line shows LIMITER hit only while she pushes; resting, it stays armed`, () => {
      for (const stopAt of [6, 12, 20]) {
        const run = simulate(lines, wheel(15), { stopAt, maxTime: stopAt + 4 });
        expect(run.frames.some((frame) => frame.show === "limiter" && frame.limiter === "hit")).toBe(true);
        for (const frame of run.frames) {
          if (frame.limiter === "hit") expect(frame.idle, `${stopAt} s`).toBeLessThan(DASH.hitInput);
        }
      }
    });

    it(`${locale}: a rewind never releases a line, and the line held before it releases once read`, () => {
      // Drive onto the second card, rewind over it before it is read, then drive back.
      const run = simulate(
        lines,
        together(during(0, 6, wheel(6)), during(6, 6.6, () => [{ type: "wheel", delta: -120 }]), during(7.5, 40, wheel(4))),
        { maxTime: 40 },
      );
      const walls = run.releases.map((release) => release.wall);
      expect(new Set(walls).size).toBe(walls.length);
      for (const release of run.releases) {
        const frame = run.frames.find((f) => f.time >= release.time - 1e-9)!;
        // Released where the line was read, never while the picture went back: ALL CLEAR shows.
        expect(frame.show === "clear" || frame.p >= STORY.fadeFrom).toBe(true);
        expect(frame.mode).not.toBe("reverse");
      }
    });

    it(`${locale}: ALL CLEAR lifts the cap: a car still pushed leaves the pit lane above 80 km/h`, () => {
      const run = simulate(lines, wheel(15), { maxTime: 40 });
      const clear = run.frames.filter((frame) => frame.clearing && frame.p < STORY.fadeFrom);
      expect(clear.length).toBeGreaterThan(0);
      expect(Math.max(...clear.map((frame) => kmh(frame.pace)))).toBeGreaterThan(90);
    });
  }
});

describe("acceptance: a phone has no dash, and loses nothing it said", () => {
  /** Phone visitors: a finger on the picture, the pedal under a thumb, both. */
  const PHONE: [string, Source][] = [
    ["touch 400 px every 0.35 s", touch(0.35)],
    ["touch 250 px every 1 s", touch(1, 250, 0.15)],
    ["a tap every 2 s", space(2)],
    ["the pedal held from the title", pedal([0, 200])],
    ["the pedal pumped 1.5 s on, 1.5 s off", pump(1.5, 1.5)],
    ["the pedal tapped every 2 s", pedalTaps(2)],
  ];

  for (const [locale, lines] of LOCALES) {
    for (const [label, source] of PHONE) {
      it(`${locale}, ${label}: the card, its bar, the cues and the pedal say what the dash said`, () => {
        for (const stopAt of [5, 14, Number.POSITIVE_INFINITY]) {
          const run = simulate(lines, source, { vh: 750, stopAt, maxTime: Math.min(stopAt + 12, 120), layout: "phone" });
          for (const frame of run.frames) {
            const at = `${label}, ${stopAt} s, ${frame.time.toFixed(2)} s`;
            // No dash at all: no lights, no speed, no word, no limit sign.
            expect(frame.dash, at).toBe("hidden");
            if (frame.p >= STORY.fadeFrom) continue;
            // LIMITER: the unread line is on screen, its reading bar filling under it, and a foot on the
            // pedal sees the limiter in its own treads.
            if (frame.show === "limiter") {
              expect(frame.active, at).toBeGreaterThanOrEqual(0);
              expect(frame.opacity[frame.active], at).toBeGreaterThan(0);
              expect(frame.fill, at).toBeLessThan(1);
              if (frame.pedalDown) expect(frame.pedalLim, at).toBe(true);
            }
            // "Let the man finish" rides on the card it is about.
            if (frame.holdNote) expect(frame.playing, at).toBe("card");
            // Her turn (the dash's gesture): the read card's marker or a cue says how to go on.
            if (frame.started && frame.mode === "waiting") expect(frame.ready || frame.prompt !== null, at).toBe(true);
          }
        }
      });
    }
  }
});

describe("acceptance: the pedal", () => {
  /** A swipe of `dy` px (negative: down, going back) over 0.13 s, starting at `at` seconds. */
  const swipeAt = (at: number, dy: number): Source => during(at, at + 0.13 + 2 * FRAME, touch(10, dy, 0.13));
  /** Pedal visitors, from a thumb held from the title to a frantic one, with the viewport they run on. */
  const PEDALERS: [string, Source, number][] = [
    ["held from the title", pedal([0, 200]), 750],
    ["held on a desktop (W or the mouse)", pedal([0, 200]), 900],
    ["held, letting go to read", pump(2.5, 3), 750],
    ["pumped 1.5 s on, 1.5 s off", pump(1.5, 1.5), 750],
    ["pumped 1 s on, 3 s off", pump(1, 3), 750],
    ["tapped every 2 s", pedalTaps(2), 750],
    ["held with a tremor (a 120 ms lift every 2 s)", tremor(2, 0.12), 750],
    ["held, and a swipe up on the picture", together(pedal([0, 200]), swipeAt(6, 300)), 750],
  ];

  for (const [locale, lines] of LOCALES) {
    for (const [label, source, vh] of PEDALERS) {
      it(`${locale}, ${label}: every line read in full, never WAITING under her foot, never dead, never past the hero`, () => {
        const run = simulate(lines, source, { vh, maxTime: 150 });
        const what = `${locale} ${label}`;
        // Every card fully up for its reading time, none early.
        run.timeline.beats.forEach((beat, i) => {
          expect(run.fullyOpaque[i], `${what}, card ${i}`).toBeGreaterThanOrEqual(beat.seconds - STORY.cardFadeIn - FRAME);
        });
        expect(run.earlyCards, what).toBe(0);
        // She gets to the end. The pedal never pushes the page past the hero: only a new press
        // there, or the pedal held there until the way on has been up a while, glides on into the
        // next section.
        expect(run.frames.at(-1)!.p, what).toBeGreaterThanOrEqual(0.999);
        const range = 5 * vh;
        let onward = false;
        let upAt = Number.NEGATIVE_INFINITY;
        let restedAtEnd = 0;
        for (let i = 0; i < run.frames.length; i += 1) {
          const frame = run.frames[i];
          const was = i > 0 && run.frames[i - 1].pedalDown;
          if (was && !frame.pedalDown) upAt = frame.time;
          // A new press at the end (a quick regrip of a hold only carries on).
          const press = frame.pedalDown && !was && frame.time - upAt >= PEDAL.regripMs / 1000;
          if (press && i > 0 && run.frames[i - 1].p >= 0.999) onward = true;
          restedAtEnd = was && i > 0 && run.frames[i - 1].p >= 0.999 ? restedAtEnd + FRAME : 0;
          if (restedAtEnd >= PEDAL.endHold - 2 * FRAME) onward = true;
          if (!onward) expect(frame.page, `${what}, ${frame.time.toFixed(2)} s`).toBeLessThanOrEqual(range + 1);
          // Her foot on the pedal is input: it is never her turn while it is down.
          if (frame.pedalDown) expect(frame.mode, `${what}, ${frame.time.toFixed(2)} s`).not.toBe("waiting");
        }
        if (onward) expect(run.frames.at(-1)!.page, what).toBeGreaterThan(range + 0.5 * vh);
        // Never dead under her foot: the picture moves, or a line (or the title, or the crane) plays.
        let still = 0;
        let longest = 0;
        for (let i = 1; i < run.frames.length; i += 1) {
          const frame = run.frames[i];
          const dead =
            frame.pedalDown &&
            !frame.pedalSuspended &&
            frame.p < 0.999 &&
            frame.playing === null &&
            Math.abs(frame.p - run.frames[i - 1].p) < 1e-7;
          still = dead ? still + FRAME : 0;
          longest = Math.max(longest, still);
        }
        expect(longest, what).toBeLessThanOrEqual(2 * FRAME);
      });
    }

    it(`${locale}: a held pedal knocks once at each line and rests there: never the note, never "In a hurry?"`, () => {
      for (const [label, source, vh] of PEDALERS.filter(([name]) => name.startsWith("held"))) {
        const run = simulate(lines, source, { vh, maxTime: 90 });
        const what = `${locale} ${label}`;
        expect(run.frames.some((frame) => frame.holdNote), what).toBe(false);
        expect(run.frames.some((frame) => frame.hurry), what).toBe(false);
        // One knock per wall at most: the title, each card and the crane.
        expect(run.knocks.length, what).toBeLessThanOrEqual(run.walls.length);
        // Resting on a line's wall, the dash says LIMITER, armed: "pushing on it" only for the knock
        // (a swipe of hers against the wall is a push of its own).
        if (label.includes("swipe")) continue;
        for (const frame of run.frames) {
          if (frame.pedalDown && frame.limiter === "hit") {
            const knock = run.knocks.findLast((t) => t <= frame.time + 1e-9) ?? Number.NEGATIVE_INFINITY;
            expect(frame.time - knock, `${what}, ${frame.time.toFixed(2)} s`).toBeLessThan(0.3 + FRAME);
          }
        }
      }
    });

    it(`${locale}: a tremor or a rolling thumb on the pedal knocks no more than a steady hold`, () => {
      const steady = simulate(lines, pedal([0, 200]), { vh: 750, maxTime: 90 });
      for (const lift of [0.06, 0.12]) {
        const shaky = simulate(lines, tremor(2, lift), { vh: 750, maxTime: 90 });
        expect(shaky.knocks.length, `${lift} s lifts`).toBeLessThanOrEqual(steady.knocks.length);
        expect(shaky.frames.some((frame) => frame.holdNote), `${lift} s lifts`).toBe(false);
      }
    });

    it(`${locale}: sustained pumping at an unread line brings the note and "In a hurry?", as mashed Space does`, () => {
      const run = simulate(lines, pump(0.1, 0.15), { vh: 750, maxTime: 60 });
      expect(run.frames.some((frame) => frame.holdNote)).toBe(true);
      expect(run.frames.some((frame) => frame.hurry)).toBe(true);
      // ...and never skips a line.
      expect(run.earlyCards).toBe(0);
    });

    it(`${locale}: taps on the pedal every 2 s finish within a second of Space every 2 s`, () => {
      const taps = simulate(lines, pedalTaps(2), { vh: 750, maxTime: 150 });
      const keys = simulate(lines, space(2), { vh: 750, maxTime: 150 });
      expect(Math.abs(taps.endAt - keys.endAt)).toBeLessThanOrEqual(1);
    });

    it(`${locale}: held from the title, the walls set the pace: every line in full, about half a minute`, () => {
      const run = simulate(lines, pedal([0, 200]), { vh: 750, maxTime: 90 });
      const reading = run.timeline.beats.reduce((sum, beat) => sum + beat.seconds, 0);
      expect(run.fadeAt).toBeGreaterThan(reading);
      expect(run.fadeAt).toBeLessThan(reading + 25);
      // The pace never sits at the crawl while her foot is down, and the limiter holds it at 80 km/h on a line.
      for (const frame of after(run.frames, 3)) {
        if (frame.pedalDown && frame.p < STORY.fadeFrom) expect(frame.pace, `${frame.time.toFixed(2)} s`).toBeGreaterThan(THROTTLE.crawl + 0.3);
      }
    });

    it(`${locale}: letting go stops the picture within 0.2 s (or as her press's line step lands), and the car brakes`, () => {
      for (const upAt of [3.3, 8, 12.7, 17, 21.2]) {
        const run = simulate(lines, pedal([0, upAt]), { vh: 750, maxTime: upAt + 8 });
        const what = `${upAt} s`;
        // Not under her foot any more: the picture stops within 0.2 s of the release.
        expect(run.lastFastMove, what).toBeLessThanOrEqual(0.2 + FRAME);
        expect(run.maxPAfterStop, what).toBeLessThanOrEqual(run.targetAtStop + 1e-9);
        // Then it is her turn as soon as nothing plays, and the car brakes toward the crawl.
        expect(run.frames.at(-1)!.pace, what).toBeLessThanOrEqual(THROTTLE.crawl + 0.05);
      }
    });

    it(`${locale}: held to the end, the way on comes up under her foot, then she goes on into the next section`, () => {
      for (const via of ["touch", "key"] as const) {
        const run = simulate(lines, pedalBy(via, [0, 200]), { vh: 750, maxTime: 90 });
        const range = 5 * 750;
        const what = `${locale} ${via}`;
        const arrived = run.frames.find((frame) => frame.p >= 0.999)!;
        // While she still holds it at the end, the cue says how to go on...
        const cue = run.frames.find((frame) => frame.time >= arrived.time && frame.prompt === "end")!;
        expect(cue, what).toBeDefined();
        expect(cue.pedalDown, what).toBe(true);
        expect(cue.time - arrived.time, what).toBeLessThanOrEqual(STORY.endIdle + 0.1);
        // ...and, held on, the pedal takes her into the line-up once the cue has been read.
        const gone = run.frames.find((frame) => frame.page > range + 1)!;
        expect(gone, what).toBeDefined();
        expect(gone.time - arrived.time, what).toBeGreaterThanOrEqual(PEDAL.endHold - FRAME);
        expect(gone.time - arrived.time, what).toBeLessThanOrEqual(PEDAL.endHold + 0.2);
        expect(run.frames.at(-1)!.page, what).toBeGreaterThan(range + 0.9 * 750);
      }
    });

    it(`${locale}: W held through a tap of S goes back, then drives on, and the dash never reads FLAT OUT over a still picture`, () => {
      const at = 9;
      const run = simulate(lines, together(pedalBy("key", [0, 200]), backAt(at)), { vh: 750, maxTime: 20 });
      const before = after(run.frames, at)[0].p;
      const back = after(run.frames, at + 0.3)[0];
      expect(back.p).toBeLessThan(before);
      // Once she has stopped going back, her foot drives again: the picture moves on past where it was.
      expect(after(run.frames, at + 2.5)[0].p).toBeGreaterThan(before);
      // Suspended, her foot is not input: the pace is not held at full while the picture waits.
      for (const frame of after(run.frames, at)) {
        if (frame.time > at + 2.5) break;
        if (frame.pedalSuspended) expect(frame.mode, `${frame.time.toFixed(2)} s`).not.toBe("floored");
      }
    });

    it(`${locale}: a swipe down while the pedal is held goes back and is never fought until her next press`, () => {
      const at = 9;
      const run = simulate(lines, together(pedal([0, 200]), swipeAt(at, -300)), { vh: 750, maxTime: 20 });
      const before = after(run.frames, at)[0].p;
      const back = after(run.frames, at + 0.4)[0];
      expect(back.p).toBeLessThan(before);
      expect(back.pedalSuspended).toBe(true);
      // Her foot is still down, but its push waits: the picture never creeps forward again on its own.
      let lowest = back.p;
      for (const frame of after(run.frames, at + 0.4)) {
        expect(frame.p, `${frame.time.toFixed(2)} s`).toBeLessThanOrEqual(lowest + 1e-6);
        lowest = Math.min(lowest, frame.p);
      }
      // Her foot is not input while its push waits: it becomes her turn, and the car brakes.
      expect(after(run.frames, at + 0.4).some((frame) => frame.pedalDown && frame.mode === "waiting")).toBe(true);
      expect(after(run.frames, at + 0.4).some((frame) => frame.mode === "floored")).toBe(false);
      // Her next press drives again.
      const again = simulate(lines, together(pedal([0, 10.5], [11, 200]), swipeAt(at, -300)), { vh: 750, maxTime: 20 });
      expect(again.frames.at(-1)!.p).toBeGreaterThan(after(again.frames, 10.6)[0].p);
    });
  }

  it("spools her foot up to the floor in about a second, and pushes no faster than PEDAL.vFull", () => {
    const run = simulate(en.hero.lines, pedal([0, 200]), { vh: 750, maxTime: 40 });
    const floored = run.frames.find((frame) => frame.pedalLevel >= 0.95)!;
    expect(floored.time).toBeLessThan(1.1);
    for (let i = 1; i < run.frames.length; i += 1) {
      const step = (run.frames[i].page - run.frames[i - 1].page) / 750;
      // A press's line step glides faster for a moment; the pedal's own push never passes vFull.
      if (run.frames[i].pedalDown && step > 0) expect(step).toBeLessThanOrEqual(5 * PEDAL.vFull * FRAME + 0.05);
    }
  });
});
