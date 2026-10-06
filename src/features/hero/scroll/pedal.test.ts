import { describe, expect, it } from "vitest";
import {
  keyLost,
  newPedal,
  PEDAL,
  pedalPush,
  pedalRate,
  pedalRibs,
  pedalSpeed,
  pedalVisibility,
  pressPedal,
  releasePedal,
  stepPedal,
  suspendPedal,
  teachDip,
} from "./pedal";
import { paceFor } from "./throttle";
import { PROMPT } from "./transport";

const FRAME = 1 / 60;

/** Holds a pressed pedal for `seconds` in frames of `dt`. */
function hold(p: ReturnType<typeof newPedal>, seconds: number, dt = FRAME, analog?: number): number {
  let level = p.level;
  for (let t = 0; t < seconds - 1e-9; t += dt) level = stepPedal(p, Math.min(dt, seconds - t), analog);
  return level;
}

describe("pressPedal", () => {
  it("starts a press that plays the next line; a second press while down does nothing", () => {
    const p = newPedal();
    expect(pressPedal(p, "touch", 1000)).toBe("step");
    expect(pressPedal(p, "key", 1010)).toBeNull();
    expect(p.via).toBe("touch");
  });

  it("bites at once: her foot is at the bite on the press frame", () => {
    const p = newPedal();
    pressPedal(p, "mouse", 0);
    expect(p.level).toBe(PEDAL.bite);
    expect(p.shown).toBe(PEDAL.bite);
  });

  it("continues a hold pressed again within the regrip window, never after a tap or later", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    hold(p, 0.5);
    expect(releasePedal(p, 500)).toBe("hold");
    expect(pressPedal(p, "touch", 500 + PEDAL.regripMs - 1)).toBe("regrip");
    // A regrip keeps the hold's own start: letting go again is still a hold.
    expect(releasePedal(p, 700)).toBe("hold");
    expect(pressPedal(p, "touch", 700 + PEDAL.regripMs + 1)).toBe("step");
    // After a tap, a quick press is a new press: a new line.
    expect(releasePedal(p, 700 + PEDAL.regripMs + 50)).toBe("tap");
    expect(pressPedal(p, "touch", 700 + PEDAL.regripMs + 60)).toBe("step");
  });

  it("never takes a key pressed again for a regrip: a second press of W or Space is a new line", () => {
    const p = newPedal();
    pressPedal(p, "key", 0);
    hold(p, 0.3);
    expect(releasePedal(p, 300)).toBe("hold");
    expect(pressPedal(p, "key", 300 + PEDAL.regripMs / 2)).toBe("step");
    // The mouse on the button still regrips, like a finger.
    hold(p, 0.3);
    expect(releasePedal(p, 800)).toBe("hold");
    expect(pressPedal(p, "mouse", 800 + PEDAL.regripMs / 2)).toBe("regrip");
  });

  it("goes back down from where the plate was on a regrip, and keeps its contact with the wall", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    hold(p, 1);
    pedalPush(p, { target: 100, push: 10, max: 100, dt: FRAME });
    releasePedal(p, 1000);
    stepPedal(p, 0.03);
    const shown = p.shown;
    expect(pressPedal(p, "touch", 1030)).toBe("regrip");
    expect(p.level).toBeCloseTo(Math.max(shown, PEDAL.bite), 6);
    expect(pedalPush(p, { target: 100, push: 10, max: 100, dt: FRAME }).knock).toBe(false);
  });
});

describe("stepPedal", () => {
  it("spools up 63% of the way from the bite to full in PEDAL.rise, at 60 fps as at 4 fps", () => {
    const want = PEDAL.bite + (1 - PEDAL.bite) * (1 - Math.exp(-1));
    for (const dt of [FRAME, 1 / 30, 0.25]) {
      const p = newPedal();
      pressPedal(p, "key", 0);
      expect(hold(p, PEDAL.rise, dt)).toBeCloseTo(want, 6);
    }
    const fast = newPedal();
    pressPedal(fast, "key", 0);
    const slow = newPedal();
    pressPedal(slow, "key", 0);
    expect(Math.abs(hold(fast, 0.75, FRAME) - hold(slow, 0.75, 0.25))).toBeLessThan(0.01);
  });

  it("is near full after a second's hold, and follows a pad trigger's own value", () => {
    const p = newPedal();
    pressPedal(p, "key", 0);
    expect(hold(p, 1.05)).toBeGreaterThan(0.95);
    const pad = newPedal();
    pressPedal(pad, "pad", 0);
    expect(hold(pad, 4, FRAME, 0.5)).toBeCloseTo(0.5, 3);
  });

  it("drops her foot at once when she lets go, while the plate springs back 63% in PEDAL.spring", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    hold(p, 2);
    const shown = p.shown;
    releasePedal(p, 2000);
    expect(p.level).toBe(0);
    expect(stepPedal(p, FRAME)).toBe(0);
    const q = newPedal();
    pressPedal(q, "touch", 0);
    hold(q, 2);
    releasePedal(q, 2000);
    hold(q, PEDAL.spring);
    expect(q.shown).toBeCloseTo(shown * Math.exp(-1), 3);
    hold(q, 1);
    expect(q.shown).toBe(0);
  });
});

describe("releasePedal", () => {
  it("calls a press under PEDAL.tapMs a tap, a longer one a hold, and nothing when it was up", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    expect(releasePedal(p, PEDAL.tapMs - 1)).toBe("tap");
    expect(releasePedal(p, 1000)).toBeNull();
    pressPedal(p, "touch", 2000);
    expect(releasePedal(p, 2000 + PEDAL.tapMs)).toBe("hold");
  });

  it("clears a suspended push: the next press drives again", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    p.suspended = true;
    releasePedal(p, 500);
    pressPedal(p, "touch", 1000);
    expect(p.suspended).toBe(false);
  });
});

describe("suspendPedal", () => {
  it("suspends the push on going back, and only while it is down", () => {
    const p = newPedal();
    expect(suspendPedal(p, { back: true, sinceBack: 0 })).toBe(false);
    expect(p.suspended).toBe(false);
    pressPedal(p, "key", 0);
    expect(suspendPedal(p, { back: false, sinceBack: 10 })).toBe(false);
    expect(suspendPedal(p, { back: true, sinceBack: 0 })).toBe(true);
  });

  it("drives again under a key or the mouse once she has stopped going back for PEDAL.resume", () => {
    for (const via of ["key", "mouse", "pad"] as const) {
      const p = newPedal();
      pressPedal(p, via, 0);
      suspendPedal(p, { back: true, sinceBack: 0 });
      expect(suspendPedal(p, { back: false, sinceBack: PEDAL.resume - 0.01 }), via).toBe(true);
      expect(suspendPedal(p, { back: false, sinceBack: PEDAL.resume }), via).toBe(false);
    }
  });

  it("stays suspended under a finger until her next press: the swipe back was hers to read", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    suspendPedal(p, { back: true, sinceBack: 0 });
    expect(suspendPedal(p, { back: false, sinceBack: 60 })).toBe(true);
    releasePedal(p, 5000);
    pressPedal(p, "touch", 6000);
    expect(suspendPedal(p, { back: false, sinceBack: 60 })).toBe(false);
  });
});

describe("pedalPush", () => {
  it("never goes backwards and is trimmed at the wall", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    expect(pedalPush(p, { target: 0, push: 10, max: 100, dt: FRAME }).dest).toBe(10);
    expect(pedalPush(p, { target: 95, push: 10, max: 100, dt: FRAME }).dest).toBe(100);
    expect(pedalPush(p, { target: 420, push: 10, max: 400, dt: FRAME }).dest).toBe(420);
    expect(pedalPush(p, { target: 50, push: -10, max: 400, dt: FRAME }).dest).toBe(50);
  });

  it("knocks once per arrival, rests quietly, and knocks again only at the next wall", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    expect(pedalPush(p, { target: 0, push: 10, max: 100, dt: FRAME }).knock).toBe(false);
    expect(pedalPush(p, { target: 95, push: 10, max: 100, dt: FRAME }).knock).toBe(true);
    // Resting on it, the wall creeping on as the line is read: no knock.
    for (let i = 0; i < 120; i += 1) {
      expect(pedalPush(p, { target: 100 + i * 0.2, push: 10, max: 100 + (i + 1) * 0.2, dt: FRAME }).knock).toBe(false);
    }
    // A wall that creeps at about her speed, met and lost frame after frame, knocks once.
    let knocks = 0;
    for (let i = 0; i < 60; i += 1) {
      if (pedalPush(p, { target: 200 + i * 5, push: i % 2 ? 6 : 4, max: 200 + i * 5 + 5, dt: FRAME }).knock) knocks += 1;
    }
    expect(knocks).toBe(0);
    // The wall opens: she drives on for a while, and the next wall knocks again.
    for (let i = 0; i < 30; i += 1) expect(pedalPush(p, { target: 400 + i * 10, push: 10, max: 2000, dt: FRAME }).knock).toBe(false);
    expect(pedalPush(p, { target: 1995, push: 10, max: 2000, dt: FRAME }).knock).toBe(true);
  });

  it("knocks on arrival at each line's wall, even straight from the last one", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    expect(pedalPush(p, { target: 95, push: 10, max: 100, dt: FRAME, wall: 1 }).knock).toBe(true);
    expect(pedalPush(p, { target: 100, push: 10, max: 100.2, dt: FRAME, wall: 1 }).knock).toBe(false);
    // Line 1 read: its wall opens and the next line's wall is met a frame later.
    expect(pedalPush(p, { target: 100.2, push: 10, max: 104, dt: FRAME, wall: 2 }).knock).toBe(true);
    expect(pedalPush(p, { target: 104, push: 10, max: 104.1, dt: FRAME, wall: 2 }).knock).toBe(false);
  });
});

describe("speeds, demand and the ribs", () => {
  it("pushes and asks harder the further her foot goes, up to its full values", () => {
    let speed = -1;
    let rate = -1;
    for (let level = 0; level <= 1.0001; level += 0.05) {
      expect(pedalSpeed(level)).toBeGreaterThan(speed);
      expect(pedalRate(level)).toBeGreaterThan(rate);
      speed = pedalSpeed(level);
      rate = pedalRate(level);
    }
    expect(pedalSpeed(1)).toBe(PEDAL.vFull);
    expect(pedalRate(1)).toBe(PEDAL.demand);
    expect(pedalSpeed(2)).toBe(PEDAL.vFull);
    expect(pedalSpeed(Number.NaN)).toBe(0);
    expect(pedalSpeed(PEDAL.bite)).toBeCloseTo(0.32, 6);
  });

  it("floored, surges the world past x1.9", () => {
    expect(paceFor(pedalRate(1))).toBeGreaterThan(1.9);
  });

  it("lights no rib at rest, all six floored, and at most four under the limiter", () => {
    expect(pedalRibs(0, false)).toBe(0);
    expect(pedalRibs(1, false)).toBe(6);
    expect(pedalRibs(1, true)).toBe(4);
    expect(pedalRibs(PEDAL.bite, false)).toBe(2);
    for (let shown = 0; shown <= 1; shown += 0.05) expect(pedalRibs(shown, true)).toBeLessThanOrEqual(4);
  });
});

describe("keyLost", () => {
  it("catches a held key whose autorepeat went silent, and never one with key repeat off", () => {
    expect(keyLost({ repeating: true, sinceKeyMs: PEDAL.lostKeyMs })).toBe(true);
    expect(keyLost({ repeating: true, sinceKeyMs: 100 })).toBe(false);
    expect(keyLost({ repeating: false, sinceKeyMs: 10_000 })).toBe(false);
  });
});

describe("pedalVisibility", () => {
  const base = { started: false, sinceEntered: 0, p: 0, reduced: false, wheelOpen: false };

  it("rises with the title hint, or her first input", () => {
    expect(pedalVisibility(base)).toBe("hidden");
    expect(pedalVisibility({ ...base, sinceEntered: -1 })).toBe("hidden");
    expect(pedalVisibility({ ...base, sinceEntered: PROMPT.hintAt })).toBe("shown");
    expect(pedalVisibility({ ...base, started: true })).toBe("shown");
  });

  it("stays to the end of the hero, so a press there glides on into the next section, and goes as the page leaves it", () => {
    expect(pedalVisibility({ ...base, started: true, p: 1 })).toBe("shown");
    expect(pedalVisibility({ ...base, started: true, p: 1, past: true })).toBe("hidden");
  });

  it("is never there under reduced motion, nor while the radio wheel is open", () => {
    expect(pedalVisibility({ ...base, started: true, reduced: true })).toBe("hidden");
    expect(pedalVisibility({ ...base, started: true, wheelOpen: true })).toBe("hidden");
  });
});

describe("teachDip", () => {
  it("dips twice to the bite with each tease, and rests otherwise", () => {
    expect(teachDip(-0.1)).toBe(0);
    expect(teachDip(0)).toBe(0);
    expect(teachDip(0.18)).toBeCloseTo(PEDAL.bite, 6);
    expect(teachDip(0.4)).toBeCloseTo(0, 6);
    expect(teachDip(0.58)).toBeCloseTo(PEDAL.bite, 6);
    expect(teachDip(0.8)).toBe(0);
    for (let t = 0; t < 1; t += 0.01) expect(teachDip(t)).toBeLessThanOrEqual(PEDAL.bite + 1e-9);
  });
});
