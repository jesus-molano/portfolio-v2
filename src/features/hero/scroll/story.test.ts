import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  activeCard,
  activeWindow,
  buildWalls,
  cardAt,
  cardWall,
  frontier,
  frontierIndex,
  heroTimeline,
  lineStep,
  newStory,
  openAll,
  openUpTo,
  playingBeat,
  readFill,
  settleTitle,
  stepStory,
  type Story,
  STORY,
  type StoryContext,
  type Wall,
} from "./story";
import { arrows, simulate, type Source, space, touch, trackpad, wheel } from "./testing/scrollerModel";
import type { FilmTimeline } from "./film";
import { CUT_BAND } from "../scene/shots";

const FRAME = 1 / 60;
const LOCALES = [
  ["en", en.hero.lines],
  ["es", es.hero.lines],
] as const;

const PLAYING: StoryContext = { rewinding: false, visible: true, introDone: true, introProgress: 1 };

/** Every scroller the tests run, with the viewport height it runs on. */
const SCROLLERS: [string, Source, number][] = [
  ["wheel 1/s", wheel(1), 900],
  ["wheel 2/s", wheel(2), 900],
  ["wheel 3/s", wheel(3), 900],
  ["wheel 5/s", wheel(5), 900],
  ["wheel 8/s", wheel(8), 900],
  ["wheel 15/s", wheel(15), 900],
  ["Firefox wheel 15/s x 50 px", wheel(15, 50), 900],
  ["trackpad swipe every 0.6 s", trackpad(0.6, 90), 900],
  ["trackpad swipe every 1.5 s", trackpad(1.5), 900],
  ["touch 400 px every 0.35 s", touch(0.35), 750],
  ["touch 250 px every 1 s", touch(1, 250, 0.15), 750],
  ["Space every 0.5 s", space(0.5), 900],
  ["Space every 2 s", space(2), 900],
  ["ArrowDown autorepeat 30/s", arrows(30), 900],
];

/** Steps a story at 60 fps with the picture held at `p`. */
function hold(walls: Wall[], story: Story, timeline: FilmTimeline, p: number, seconds: number, ctx = PLAYING) {
  for (let t = 0; t < seconds - 1e-9; t += FRAME) stepStory(walls, story, timeline, p, FRAME, ctx);
}

describe("buildWalls", () => {
  for (const [locale, lines] of LOCALES) {
    const timeline = heroTimeline(lines);
    const walls = buildWalls(timeline);
    const cards = timeline.beats.length;

    it(`${locale}: orders the title, the cards, the crane and the last card`, () => {
      expect(walls.map((w) => (w.kind === "card" ? `card${w.card}` : w.kind))).toEqual([
        "title",
        ...Array.from({ length: cards - 1 }, (_, i) => `card${i}`),
        "crane",
        `card${cards - 1}`,
      ]);
    });

    it(`${locale}: gives every wall room to creep, in film order`, () => {
      walls.forEach((wall, i) => {
        expect(wall.from).toBeLessThan(wall.to);
        if (i > 0) expect(wall.from).toBeGreaterThan(walls[i - 1].to);
      });
    });

    it(`${locale}: keeps every card wall inside its active window`, () => {
      walls
        .filter((w) => w.kind === "card")
        .forEach((wall) => {
          const window = activeWindow(timeline.beats[wall.card]);
          expect(wall.from).toBeGreaterThan(window.from);
          expect(wall.to).toBeLessThan(window.to);
          expect(wall.hold).toBe(timeline.beats[wall.card].seconds);
        });
    });

    it(`${locale}: puts the crane wall inside the crane shot, past the cut's band, before the last card`, () => {
      const crane = walls.find((w) => w.kind === "crane");
      // Past the band, so the picture cuts to the crane at once instead of waiting in the old shot.
      expect(crane?.from).toBeGreaterThan(STORY.craneFrom + CUT_BAND);
      expect(crane?.to).toBeLessThan(activeWindow(timeline.beats[cards - 1]).from);
      expect(crane?.hold).toBe(STORY.craneHold);
    });
  }
});

describe("activeWindow and activeCard", () => {
  const timeline = heroTimeline(en.hero.lines);

  it("agree at the edges of every window", () => {
    timeline.beats.forEach((beat, i) => {
      const window = activeWindow(beat);
      expect(window.from).toBeGreaterThan(beat.start);
      expect(window.to).toBeLessThan(beat.end);
      expect(activeCard(window.from, timeline)).toBe(i);
      expect(activeCard((window.from + window.to) / 2, timeline)).toBe(i);
      expect(activeCard(window.to - 1e-9, timeline)).toBe(i);
      expect(activeCard(window.to, timeline)).not.toBe(i);
      expect(activeCard(window.from - 1e-9, timeline)).not.toBe(i);
    });
  });

  it("is -1 on the title and between cards", () => {
    expect(activeCard(0, timeline)).toBe(-1);
    expect(activeCard(STORY.craneFrom + 0.01, timeline)).toBe(-1);
  });
});

describe("stepStory", () => {
  const timeline = heroTimeline(en.hero.lines);
  const walls = buildWalls(timeline);
  const first = cardWall(walls, 0);
  const atCard = (card: number) => walls[cardWall(walls, card)].from;

  it("fades a card in over 0.25 s and out over 0.2 s, on time", () => {
    const story = newStory(walls, timeline.beats.length);
    openUpTo(walls, story, atCard(0));
    hold(walls, story, timeline, atCard(0), 0.125);
    expect(story.opacity[0]).toBeCloseTo(0.5, 1);
    hold(walls, story, timeline, atCard(0), 0.2);
    expect(story.opacity[0]).toBe(1);
    hold(walls, story, timeline, 0.05, 0.1);
    expect(story.opacity[0]).toBeCloseTo(0.5, 1);
    hold(walls, story, timeline, 0.05, 0.15);
    expect(story.opacity[0]).toBe(0);
  });

  it("marks a card done only once its reading time ran and it was fully opaque", () => {
    const story = newStory(walls, timeline.beats.length);
    story.done[0] = true;
    const seconds = timeline.beats[0].seconds;
    hold(walls, story, timeline, atCard(0), seconds - 0.1);
    expect(story.done[first]).toBe(false);
    expect(frontier(walls, story)).toBeLessThanOrEqual(walls[first].to);
    hold(walls, story, timeline, atCard(0), 0.12);
    expect(story.done[first]).toBe(true);
    expect(frontierIndex(story)).toBe(first + 1);
  });

  it("never counts a card that is not fully opaque as read", () => {
    const story = newStory(walls, timeline.beats.length);
    story.done[0] = true;
    // The clocks ran out, but the card never reached full opacity.
    story.clock[first] = timeline.beats[0].seconds + 1;
    story.seen[first] = timeline.beats[0].seconds + 1;
    stepStory(walls, story, timeline, atCard(0), FRAME, PLAYING);
    expect(story.done[first]).toBe(false);
  });

  it("reads a line only while the card is fully up, so a stalled fade-in counts nothing", () => {
    const story = newStory(walls, timeline.beats.length);
    story.done[0] = true;
    // The card starts fading in, then a long frame (a stall, a slow device)
    // shows it half faded: none of that is reading time.
    stepStory(walls, story, timeline, atCard(0), 0.1, PLAYING);
    expect(story.opacity[0]).toBeCloseTo(0.4, 10);
    stepStory(walls, story, timeline, atCard(0), STORY.maxStep, PLAYING);
    expect(story.opacity[0]).toBe(1);
    expect(story.seen[first]).toBe(0);
    // The next long frame was spent showing it fully opaque: that counts.
    stepStory(walls, story, timeline, atCard(0), STORY.maxStep, PLAYING);
    expect(story.seen[first]).toBeCloseTo(STORY.maxStep, 10);
  });

  it("still needs a card's full reading time, fully up, after she rewinds out of it", () => {
    const story = newStory(walls, timeline.beats.length);
    story.done[0] = true;
    const seconds = timeline.beats[0].seconds;
    let opaque = 0;
    const frame = (p: number, ctx = PLAYING) => {
      stepStory(walls, story, timeline, p, FRAME, ctx);
      if (story.opacity[0] >= STORY.fullyVisible) opaque += FRAME;
    };
    // Half the line, then she backs out twice and comes back.
    for (let round = 0; round < 3 && !story.done[first]; round += 1) {
      for (let t = 0; t < seconds / 2 && !story.done[first]; t += FRAME) frame(atCard(0));
      for (let t = 0; t < 0.5; t += FRAME) frame(atCard(0), { ...PLAYING, rewinding: true });
    }
    for (let t = 0; t < seconds && !story.done[first]; t += FRAME) frame(atCard(0));
    expect(story.done[first]).toBe(true);
    expect(opaque).toBeGreaterThanOrEqual(seconds - STORY.cardFadeIn - FRAME);
  });

  it("creeps the wall of the first unfinished beat with its clock, never back", () => {
    const story = newStory(walls, timeline.beats.length);
    story.done[0] = true;
    let previous = frontier(walls, story);
    for (let t = 0; t < 1; t += FRAME) {
      stepStory(walls, story, timeline, Math.min(previous, atCard(0) + 0.01), FRAME, PLAYING);
      const now = frontier(walls, story);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
    expect(previous).toBeGreaterThan(walls[first].from);
    // Backing out of the card stops the clock but keeps the wall where it was.
    const clock = story.clock[first];
    hold(walls, story, timeline, 0.05, 0.5);
    expect(story.clock[first]).toBe(clock);
    expect(frontier(walls, story)).toBe(previous);
  });

  it("holds the title until 1.2 s after the reveal, and moves it a little from the first frame", () => {
    const story = newStory(walls, timeline.beats.length);
    const reveal: StoryContext = { rewinding: false, visible: true, introDone: false, introProgress: 0 };
    stepStory(walls, story, timeline, 0, FRAME, reveal);
    expect(frontier(walls, story)).toBeGreaterThanOrEqual(STORY.titleWallFrom);
    for (let progress = 0; progress <= 1; progress += 0.05) {
      stepStory(walls, story, timeline, 0, FRAME, { ...reveal, introProgress: progress });
      expect(frontier(walls, story)).toBeLessThanOrEqual(STORY.titleWallTo);
    }
    hold(walls, story, timeline, 0, STORY.titleHold - 0.05);
    expect(story.done[0]).toBe(false);
    expect(frontier(walls, story)).toBeLessThanOrEqual(STORY.titleWallTo);
    hold(walls, story, timeline, 0, 0.1);
    expect(story.done[0]).toBe(true);
  });

  it("holds the crane for 1.5 s inside the crane shot", () => {
    const story = newStory(walls, timeline.beats.length);
    const crane = walls.findIndex((w) => w.kind === "crane");
    openUpTo(walls, story, walls[crane - 1].from);
    // Before the shot the clock does not run.
    hold(walls, story, timeline, STORY.craneFrom - 0.01, 2);
    expect(story.done[crane]).toBe(false);
    expect(frontier(walls, story)).toBe(walls[crane].from);
    hold(walls, story, timeline, walls[crane].from, STORY.craneHold - 0.05);
    expect(story.done[crane]).toBe(false);
    expect(frontier(walls, story)).toBeLessThanOrEqual(walls[crane].to);
    hold(walls, story, timeline, walls[crane].from, 0.1);
    expect(story.done[crane]).toBe(true);
  });

  it("stops every clock while the tab is hidden", () => {
    const story = newStory(walls, timeline.beats.length);
    hold(walls, story, timeline, 0, 5, { ...PLAYING, visible: false });
    expect(story.clock.every((c) => c === 0)).toBe(true);
    expect(story.done[0]).toBe(false);
  });

  it("hides the cards while rewinding and stops their clocks", () => {
    const story = newStory(walls, timeline.beats.length);
    openUpTo(walls, story, atCard(0));
    hold(walls, story, timeline, atCard(0), 0.5);
    const clock = story.clock[first];
    const active = stepStory(walls, story, timeline, atCard(0), FRAME, { ...PLAYING, rewinding: true });
    expect(active).toBe(-1);
    hold(walls, story, timeline, atCard(0), 0.3, { ...PLAYING, rewinding: true });
    expect(story.opacity[0]).toBe(0);
    expect(story.clock[first]).toBe(clock);
  });

  it("caps a long frame (a tab coming back, a stall) at maxStep", () => {
    const story = newStory(walls, timeline.beats.length);
    story.done[0] = true;
    stepStory(walls, story, timeline, atCard(0), 5, PLAYING);
    expect(story.clock[first]).toBeCloseTo(STORY.maxStep, 10);
    expect(story.opacity[0]).toBe(Math.min(1, STORY.maxStep / STORY.cardFadeIn));
    expect(story.seen[first]).toBe(0);
  });
});

describe("frontier, openAll, openUpTo", () => {
  const timeline = heroTimeline(en.hero.lines);
  const walls = buildWalls(timeline);

  it("opens every wall at once (Skip, Esc, End, focus leaving the hero)", () => {
    const story = newStory(walls, timeline.beats.length);
    openAll(story);
    expect(frontierIndex(story)).toBe(-1);
    expect(frontier(walls, story)).toBe(Number.POSITIVE_INFINITY);
  });

  it("opens the walls up to a dev jump, so the picture can sit there", () => {
    for (const p of [0, 0.05, 0.3, 0.6, 0.85, 0.97]) {
      const story = newStory(walls, timeline.beats.length);
      openUpTo(walls, story, p);
      expect(frontier(walls, story)).toBeGreaterThanOrEqual(p);
    }
  });

  it("starts at the title wall", () => {
    const story = newStory(walls, timeline.beats.length);
    expect(frontier(walls, story)).toBe(STORY.titleWallFrom);
  });
});

describe("playingBeat", () => {
  const timeline = heroTimeline(en.hero.lines);
  const walls = buildWalls(timeline);

  it("plays the title until its hold is done, then the first card while it is unread and up", () => {
    const story = newStory(walls, timeline.beats.length);
    expect(playingBeat(walls, story, 0, -1)).toBe("title");
    story.done[0] = true;
    const first = activeWindow(timeline.beats[0]).from;
    // The first card's wall is the frontier, but the card is not up yet: her turn.
    expect(playingBeat(walls, story, 0.05, -1)).toBeNull();
    expect(playingBeat(walls, story, first, 0)).toBe("card");
    story.done[cardWall(walls, 0)] = true;
    expect(playingBeat(walls, story, first, 0)).toBeNull();
  });

  it("plays the crane only inside the crane shot, and nothing once every beat is done", () => {
    const story = newStory(walls, timeline.beats.length);
    const crane = walls.findIndex((wall) => wall.kind === "crane");
    for (let k = 0; k < crane; k += 1) story.done[k] = true;
    expect(playingBeat(walls, story, STORY.craneFrom - 0.01, -1)).toBeNull();
    expect(playingBeat(walls, story, STORY.craneFrom, -1)).toBe("crane");
    openAll(story);
    expect(playingBeat(walls, story, 0.5, 3)).toBeNull();
  });
});

describe("cardAt and cardWall", () => {
  const timeline = heroTimeline(es.hero.lines);
  const walls = buildWalls(timeline);

  it("finds the card she has reached, or none on the title", () => {
    expect(cardAt(0, timeline)).toBe(-1);
    timeline.beats.forEach((beat, i) => {
      const from = activeWindow(beat).from;
      expect(cardAt(from, timeline)).toBe(i);
      if (i > 0) expect(cardAt(from - 1e-6, timeline)).toBe(i - 1);
    });
    expect(cardAt(1, timeline)).toBe(timeline.beats.length - 1);
  });

  it("finds every card's wall, and none for a card that does not exist", () => {
    timeline.beats.forEach((_, i) => {
      const k = cardWall(walls, i);
      expect(walls[k]).toMatchObject({ kind: "card", card: i });
    });
    expect(cardWall(walls, timeline.beats.length)).toBe(-1);
  });
});

describe("readFill", () => {
  const timeline = heroTimeline(en.hero.lines);
  const walls = buildWalls(timeline);

  it("fills with the card's clock, never back, and is 1 once the card is done", () => {
    const story = newStory(walls, timeline.beats.length);
    story.done[0] = true;
    const at = walls[cardWall(walls, 0)].from;
    let previous = 0;
    for (let t = 0; t < timeline.beats[0].seconds + 0.2; t += FRAME) {
      stepStory(walls, story, timeline, at, FRAME, PLAYING);
      const fill = readFill(walls, story, 0);
      expect(fill).toBeGreaterThanOrEqual(previous);
      previous = fill;
    }
    expect(story.done[cardWall(walls, 0)]).toBe(true);
    expect(readFill(walls, story, 0)).toBe(1);
    expect(readFill(walls, story, 3)).toBe(0);
    expect(readFill(walls, story, 99)).toBe(0);
  });
});

describe("settleTitle", () => {
  const FRAME = 1 / 60;
  const settle = (from: number, seconds: number, p: number, back: boolean, resting: boolean) => {
    let value = from;
    for (let t = 0; t < seconds - 1e-9; t += FRAME) value = settleTitle(value, p, back, resting, FRAME);
    return value;
  };

  it("finishes the title's fade on time once she rests mid-dissolve", () => {
    const mid = (STORY.titleWallTo + STORY.titleOut) / 2;
    expect(settle(0, STORY.titleSettle / 2, mid, false, true)).toBeCloseTo(0.5, 1);
    expect(settle(0, STORY.titleSettle + FRAME, mid, false, true)).toBe(1);
    // Not while she drives, nor on the title itself, nor past the dissolve.
    expect(settle(0, 2, mid, false, false)).toBe(0);
    expect(settle(0, 2, STORY.titleWallTo, false, true)).toBe(0);
    expect(settle(0, 2, STORY.titleOut, false, true)).toBe(0);
  });

  it("gives the title back to the picture when she goes back toward it", () => {
    const mid = (STORY.titleWallTo + STORY.titleOut) / 2;
    expect(settle(1, STORY.titleSettle / 2 + FRAME, mid, true, false)).toBe(0);
    expect(settle(1, STORY.titleSettle / 2 + FRAME, STORY.titleWallTo / 2, false, false)).toBe(0);
    // Driving on keeps it gone.
    expect(settle(1, 2, mid + 0.01, false, false)).toBe(1);
  });
});

describe("lineStep", () => {
  const timeline = heroTimeline(en.hero.lines);
  const starts = timeline.beats.map((beat) => activeWindow(beat).from);

  it("steps forward to the start of the next card", () => {
    expect(lineStep(1, 0, timeline, Number.POSITIVE_INFINITY)).toBeCloseTo(starts[0] + STORY.wallInset, 10);
    expect(lineStep(1, starts[2] + 0.002, timeline, Number.POSITIVE_INFINITY)).toBeCloseTo(
      starts[3] + STORY.wallInset,
      10,
    );
    expect(lineStep(1, starts[starts.length - 1] + 0.002, timeline, Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("never steps past the frontier, and knocks at an unread wall", () => {
    const frontierP = starts[1] + 0.003;
    expect(lineStep(1, starts[1], timeline, frontierP)).toBeCloseTo(frontierP, 10);
    expect(lineStep(1, frontierP, timeline, frontierP)).toBeNull();
  });

  it("steps back to the previous card, or to the top", () => {
    expect(lineStep(-1, starts[3] + 0.002, timeline, 1)).toBeCloseTo(starts[2] + STORY.wallInset, 10);
    expect(lineStep(-1, starts[3] + 0.02, timeline, 1)).toBeCloseTo(starts[3] + STORY.wallInset, 10);
    expect(lineStep(-1, starts[0], timeline, 1)).toBe(0);
  });
});

describe("a visitor scrolling the hero", () => {
  for (const [locale, lines] of LOCALES) {
    for (const [label, source, vh] of SCROLLERS) {
      it(`${locale}, ${label}: shows every card for its reading time, in order`, () => {
        const run = simulate(lines, source, { vh });
        expect(run.fadeAt).toBeLessThan(150);
        run.timeline.beats.forEach((beat, i) => {
          expect(run.fullyOpaque[i]).toBeGreaterThanOrEqual(beat.seconds - STORY.cardFadeIn - FRAME);
          expect(run.onScreen[i]).toBeGreaterThanOrEqual(beat.seconds - FRAME);
        });
        expect(run.earlyCards).toBe(0);
        expect(run.frontierBackwards).toBe(0);
      });
    }

    it(`${locale}: a frantic wheel reaches the fade in 30-38 s, a calm one in under 56 s`, () => {
      const frantic = simulate(lines, wheel(15)).fadeAt;
      expect(frantic).toBeGreaterThan(30);
      expect(frantic).toBeLessThan(38);
      expect(simulate(lines, wheel(1)).fadeAt).toBeLessThan(56);
    });

    for (const [label, source, vh] of SCROLLERS.filter(([name]) => !name.startsWith("touch"))) {
      it(`${locale}, ${label}: never stops the picture dead while she scrolls`, () => {
        expect(simulate(lines, source, { vh }).longestDeadStop).toBeLessThanOrEqual(0.05);
      });
    }

    for (const [label, source, vh] of SCROLLERS) {
      it(`${locale}, ${label}: plays nothing on its own once she stops`, () => {
        for (const stopAt of [0.5, 1, 3, 5, 8, 12, 18, 24, 30, 36]) {
          const run = simulate(lines, source, { vh, stopAt, maxTime: stopAt + 6 });
          // Only the glide of her own last input (or of the line she asked for
          // with Space while the name formed): never past where she scrolled...
          expect(run.maxPAfterStop).toBeLessThanOrEqual(run.targetAtStop + 1e-9);
          // ...the picture is at rest (under 0.5 px a frame) within 0.6 s...
          expect(run.lastFastMove).toBeLessThanOrEqual(0.6);
          // ...and a card comes up only inside that glide. The glide's tail
          // (Lenis lerp 0.09: 95% in 0.55 s, the last pixels slower) can
          // carry the picture into the card her own last notch aimed at.
          expect(run.lateActivation).toBeLessThanOrEqual(0.75);
        }
      });
    }
  }

  it("keeps a card waiting for its full reading time while the tab is hidden", () => {
    const run = simulate(en.hero.lines, wheel(15), { hidden: [3, 13] });
    run.timeline.beats.forEach((beat, i) => {
      expect(run.fullyOpaque[i]).toBeGreaterThanOrEqual(beat.seconds - STORY.cardFadeIn - FRAME);
    });
    expect(run.earlyCards).toBe(0);
  });
});
