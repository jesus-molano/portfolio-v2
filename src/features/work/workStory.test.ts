import { describe, expect, it } from "vitest";
import { STORY } from "@/features/hero/scroll/story";
import en from "@/i18n/dictionaries/en.json";
import { workTimeline } from "./workTimeline";
import {
  activeCardAt,
  HOLD_LEAD,
  newStageStory,
  openAllWalls,
  openWallsUpTo,
  stageFrontier,
  stageFrontierIndex,
  stageLineStep,
  stageReadFill,
  stageWalls,
  stepStageStory,
} from "./workStory";

const timeline = workTimeline(en.work);
const walls = stageWalls(timeline);
const running = { rewinding: false, running: true };

/** A visitor who scrolls flat out: the picture always sits on the frontier. */
function race(seconds: number, dt = 1 / 60) {
  const story = newStageStory(walls, timeline.cards.length);
  let p = 0;
  const firstSeen: number[] = timeline.cards.map(() => -1);
  for (let t = 0; t < seconds; t += dt) {
    const active = stepStageStory(walls, story, timeline, p, dt, running);
    if (active >= 0 && story.opacity[active] >= 1 && firstSeen[active] < 0) firstSeen[active] = t;
    const fr = stageFrontier(walls, story);
    p = Math.min(1, fr);
  }
  return { story, p, firstSeen };
}

describe("work story", () => {
  it("builds one wall per title, hold and card, in film order", () => {
    expect(walls.filter((w) => w.kind === "card")).toHaveLength(timeline.cards.length);
    for (let i = 1; i < walls.length; i += 1) expect(walls[i].from).toBeGreaterThan(walls[i - 1].to - 1e-9);
    for (const wall of walls) expect(wall.to).toBeGreaterThan(wall.from);
  });

  it("starts held at the title and runs to the end at the natural pace, never sooner", () => {
    const fresh = newStageStory(walls, timeline.cards.length);
    expect(stageFrontier(walls, fresh)).toBeLessThan(0.01);
    const early = race(timeline.seconds * 0.5);
    expect(early.p).toBeLessThan(0.9);
    const done = race(timeline.seconds * 1.6);
    expect(stageFrontierIndex(done.story)).toBe(-1);
    expect(done.p).toBe(1);
  });

  it("keeps every card on screen for its reading time", () => {
    const dt = 1 / 30;
    const story = newStageStory(walls, timeline.cards.length);
    let p = 0;
    const shown = timeline.cards.map(() => 0);
    for (let t = 0; t < timeline.seconds * 2; t += dt) {
      const active = stepStageStory(walls, story, timeline, p, dt, running);
      if (active >= 0 && story.opacity[active] >= STORY.fullyVisible) shown[active] += dt;
      p = Math.min(1, stageFrontier(walls, story));
    }
    timeline.cards.forEach((card, i) => {
      expect(shown[i]).toBeGreaterThanOrEqual(card.seconds - STORY.cardFadeIn - 2 * dt);
    });
  });

  it("does not run the clocks while the night is not ready or the tab is hidden", () => {
    const story = newStageStory(walls, timeline.cards.length);
    for (let i = 0; i < 300; i += 1) stepStageStory(walls, story, timeline, 0, 1 / 60, { rewinding: false, running: false });
    expect(stageFrontierIndex(story)).toBe(0);
    expect(story.clock[0]).toBe(0);
  });

  it("plays a held beat only while she drives into it: a rest leaves at most HOLD_LEAD of it ahead", () => {
    const dt = 1 / 60;
    const k = walls.findIndex((w) => w.kind === "hold" && timeline.beats[w.beat].id.endsWith(".open"));
    const wall = walls[k];
    const story = newStageStory(walls, timeline.cards.length);
    openWallsUpTo(walls, story, wall.from - 1e-4);
    // She arrives at the cut and stops there, under the night, for five seconds.
    const p = wall.from;
    for (let t = 0; t < 5; t += dt) stepStageStory(walls, story, timeline, p, dt, { ...running, reach: p });
    expect(story.done[k]).toBe(false);
    const ahead = stageFrontier(walls, story) - p;
    const lead = (HOLD_LEAD * (wall.to - wall.from)) / wall.hold;
    expect(ahead).toBeGreaterThan(lead * 0.9);
    expect(ahead).toBeLessThan(lead + 0.0001);
    // Driving on (the page heading for the wall), the rest of the beat plays at its own pace.
    let q = p;
    let t = 0;
    while (!story.done[k] && t < 10) {
      stepStageStory(walls, story, timeline, q, dt, { ...running, reach: stageFrontier(walls, story) });
      q = Math.min(stageFrontier(walls, story), wall.to);
      t += dt;
    }
    expect(story.done[k]).toBe(true);
    expect(t).toBeGreaterThan(wall.hold - HOLD_LEAD - 0.1);
  });

  it("opens the walls for navigation and for Skip", () => {
    const story = newStageStory(walls, timeline.cards.length);
    const mid = timeline.stops[2].from;
    openWallsUpTo(walls, story, mid);
    expect(stageFrontier(walls, story)).toBeGreaterThan(mid);
    openAllWalls(story);
    expect(stageFrontier(walls, story)).toBe(Number.POSITIVE_INFINITY);
    expect(stageReadFill(walls, story, 0)).toBe(1);
  });

  it("steps line by line and knocks at an unread card", () => {
    const first = timeline.cards[0];
    const at = stageLineStep(1, 0, timeline, 1);
    expect(at).not.toBeNull();
    expect(activeCardAt(at ?? 0, timeline)).toBe(0);
    expect(at).toBeGreaterThan(first.start);
    expect(stageLineStep(1, 0.5, timeline, 0.5)).toBeNull();
    expect(stageLineStep(-1, 0.001, timeline, 1)).toBe(0);
  });
});
