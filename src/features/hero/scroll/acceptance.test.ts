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
import { GATE } from "./gate";
import { STORY } from "./story";
import {
  arrows,
  drag,
  during,
  jump,
  restless,
  type SimFrame,
  simulate,
  type Source,
  space,
  strokeAndRest,
  together,
  touch,
  trackpad,
  tremble,
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
