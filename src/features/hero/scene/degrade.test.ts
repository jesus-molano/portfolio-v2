import { describe, expect, it } from "vitest";
import {
  COMMIT_MS,
  LAST_LEVEL,
  LEVELS,
  TIER_MAX,
  commitQuality,
  declineQuality,
  drawsAlike,
  forceLevel,
  grainScale,
  lockQuality,
  nextLevel,
  pixelRatioFor,
  ratioOn,
  seedQuality,
  settingsFor,
  settleTier,
  shouldCommit,
  startLevel,
  structureFor,
} from "./degrade";

const seed = (gpu: Parameters<typeof seedQuality>[0], refreshHz: number | null = null) =>
  seedQuality(gpu, { dev: false, nanGuard: false, refreshHz });

describe("LEVELS", () => {
  it("never gives anything back on the way down", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const [prev, next] = [LEVELS[i - 1], LEVELS[i]];
      expect(next.budgetPx).toBeLessThanOrEqual(prev.budgetPx);
      expect(next.dprCeil).toBeLessThanOrEqual(prev.dprCeil);
      expect(next.dprFloor).toBeLessThanOrEqual(prev.dprFloor);
      expect(next.cloudOctaves).toBeLessThanOrEqual(prev.cloudOctaves);
      if (!prev.depthOfField) expect(next.depthOfField).toBe(false);
      if (!prev.cloudShadow) expect(next.cloudShadow).toBe(false);
    }
  });

  it("gives something up at every step", () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i]).not.toEqual(LEVELS[i - 1]);
  });

  it("keeps today's look on level 0 and draws below the screen's resolution only at the bottom", () => {
    expect(LEVELS[0]).toEqual({
      budgetPx: Number.POSITIVE_INFINITY,
      dprCeil: 1.5,
      dprFloor: 1,
      depthOfField: true,
      cloudOctaves: 5,
      cloudShadow: true,
    });
    LEVELS.slice(0, 5).forEach((level) => expect(level.dprFloor).toBe(1));
    expect(LEVELS[LAST_LEVEL].dprFloor).toBeLessThan(1);
  });

  it("leaves the clouds' self-shadow sample at least one octave where it is on", () => {
    // The shadow sample runs one octave fewer (shaders/sky.ts).
    LEVELS.filter((level) => level.cloudShadow).forEach((level) => expect(level.cloudOctaves - 1).toBeGreaterThanOrEqual(1));
  });
});

describe("startLevel", () => {
  it("starts a weaker GPU lower", () => {
    expect(startLevel("top")).toBe(0);
    expect(startLevel("mid")).toBe(2);
    expect(startLevel("low")).toBe(4);
    expect(startLevel("software")).toBe(LAST_LEVEL);
  });
});

describe("seedQuality", () => {
  it("builds the full post only for a visit starting on the first two levels", () => {
    expect(seed("top").structure).toEqual({ chromaticAberration: true, smaa: "high", nanGuard: false });
    expect(seed("mid").structure).toEqual({ chromaticAberration: false, smaa: "medium", nanGuard: false });
    expect(seed("software").structure.smaa).toBe("medium");
    expect(structureFor(1, true)).toEqual({ chromaticAberration: true, smaa: "high", nanGuard: true });
  });

  it("starts a GPU below the top at half rate on a fast display only", () => {
    expect(seed("mid", 144).halfRate).toBe(true);
    expect(seed("software", 120).halfRate).toBe(true);
    expect(seed("top", 165).halfRate).toBe(false);
    expect(seed("low", 100).halfRate).toBe(false);
    expect(seed("low", 60).halfRate).toBe(false);
    expect(seed("low", null).halfRate).toBe(false);
  });

  it("keeps a development build on level 0 with the full post, whatever the GPU", () => {
    const dev = seedQuality("software", { dev: true, nanGuard: true, refreshHz: 144 });
    expect(dev.level).toBe(0);
    expect(dev.start).toBe(0);
    expect(dev.halfRate).toBe(false);
    expect(dev.structure).toEqual({ chromaticAberration: true, smaa: "high", nanGuard: true });
  });
});

describe("declineQuality", () => {
  it("goes to half rate first on a display of 118 Hz or more, without losing a level", () => {
    const q = declineQuality(seed("top"), 144, 1000);
    expect(q.halfRate).toBe(true);
    expect(q.level).toBe(0);
    expect(q.pending).toBeNull();
    const next = declineQuality(q, 144, 4000);
    expect(next.pending).toBe(1);
    expect(next.declinedAt).toBe(4000);
  });

  it("never paces a display of 100 Hz or less, or one not measured yet: a level at once", () => {
    for (const hz of [60, 75, 100, null]) {
      const q = declineQuality(seed("top"), hz, 1000);
      expect(q.halfRate).toBe(false);
      expect(q.pending).toBe(1);
    }
  });

  it("steps one level at a time and stops at the last", () => {
    let q = seed("top");
    for (let i = 0; i < LEVELS.length + 3; i++) q = commitQuality(declineQuality(q, 60, i * 5000));
    expect(q.level).toBe(LAST_LEVEL);
    const bottom = declineQuality(q, 60, 1e6);
    expect(bottom).toBe(q);
  });

  it("never goes back up", () => {
    let q = seed("mid", 144);
    let level = q.level;
    for (let i = 0; i < 20; i++) {
      q = declineQuality(q, i % 3 === 0 ? 144 : null, i * 3000);
      if (i % 2 === 0) q = commitQuality(q);
      expect(q.level).toBeGreaterThanOrEqual(level);
      expect(q.halfRate).toBe(true);
      level = q.level;
    }
  });

  it("steps from a level still waiting for its cut, keeping the time of the first decline", () => {
    const once = declineQuality(seed("top"), 60, 1000);
    const twice = declineQuality(once, 60, 1200);
    expect(twice.pending).toBe(2);
    expect(twice.declinedAt).toBe(1000);
  });
});

describe("a step down on her screen", () => {
  const phone = { tier: "low", cssWidth: 390, cssHeight: 844, deviceRatio: 3 } as const;
  const desktop = { tier: "high", cssWidth: 1920, cssHeight: 1080, deviceRatio: 1 } as const;
  const retina = { tier: "high", cssWidth: 1440, cssHeight: 900, deviceRatio: 2 } as const;
  const entered = lockQuality(seed("top"));

  it("compares what two levels draw there: the pixel ratio and the detail the tier keeps", () => {
    expect(ratioOn(phone, 0)).toBe(1.5);
    expect(ratioOn(retina, 1)).toBe(1.4);
    expect(drawsAlike(phone, 0, 1)).toBe(true);
    expect(drawsAlike(phone, 0, 2)).toBe(true);
    expect(drawsAlike(phone, 0, 3)).toBe(false);
    expect(drawsAlike(retina, 0, 1)).toBe(false);
    expect(drawsAlike(desktop, 0, 1)).toBe(true);
    expect(drawsAlike(desktop, 1, 2)).toBe(false);
  });

  it("goes straight to a phone's first fewer pixels once she is in, past the levels it draws the same", () => {
    expect(nextLevel(entered, 0, [phone])).toBe(3);
    expect(nextLevel(entered, 3, [phone])).toBe(5);
    // Before she is in, the lighter post of level 2 is a change of its own.
    expect(nextLevel(seed("top"), 0, [phone])).toBe(2);
  });

  it("skips what a 1x desktop draws the same: the first pixel caps", () => {
    const path: number[] = [];
    for (let from: number | null = 0; from !== null; from = nextLevel(entered, from, [desktop])) path.push(from);
    expect(path).toEqual([0, 2, 4, 5, 6]);
  });

  it("takes a retina screen's pixels first", () => {
    expect(nextLevel(entered, 0, [retina])).toBe(1);
  });

  it("steps as far as the first change on any canvas's screen", () => {
    expect(nextLevel(entered, 0, [phone, retina])).toBe(1);
  });

  it("steps one level at a time while no screen is known", () => {
    expect(nextLevel(entered, 0, [])).toBe(1);
    expect(nextLevel(entered, LAST_LEVEL, [])).toBeNull();
  });

  it("leaves the state as it is when nothing below would change anything", () => {
    const low = forceLevel(entered, 5);
    expect(declineQuality(low, 60, 1000, [phone])).toBe(low);
    const stepped = declineQuality(entered, 60, 1000, [phone]);
    expect(stepped.pending).toBe(3);
    expect(stepped.declinedAt).toBe(1000);
  });

  it("still goes to half rate first on a fast display", () => {
    const q = declineQuality(entered, 144, 1000, [phone]);
    expect(q.halfRate).toBe(true);
    expect(q.pending).toBeNull();
  });
});

describe("shouldCommit and commitQuality", () => {
  it("lands a decline under the next cut, or after COMMIT_MS anyway", () => {
    expect(shouldCommit(null, 5000, 5000)).toBe(false);
    expect(shouldCommit(1000, null, 1000 + COMMIT_MS - 1)).toBe(false);
    expect(shouldCommit(1000, 900, 1100)).toBe(false);
    expect(shouldCommit(1000, 1050, 1100)).toBe(true);
    expect(shouldCommit(1000, null, 1000 + COMMIT_MS)).toBe(true);
  });

  it("changes the structure with the level until she has entered, and never after", () => {
    const before = commitQuality(declineQuality(declineQuality(seed("top"), 60, 0), 60, 0));
    expect(before.level).toBe(2);
    expect(before.structure).toEqual({ chromaticAberration: false, smaa: "medium", nanGuard: false });

    const locked = lockQuality(seed("top"));
    const after = commitQuality(declineQuality(declineQuality(locked, 60, 0), 60, 0));
    expect(after.level).toBe(2);
    expect(after.structure).toBe(locked.structure);
  });

  it("keeps the same structure object when a level changes nothing in it", () => {
    const q = seed("mid");
    expect(commitQuality(declineQuality(q, 60, 0)).structure).toBe(q.structure);
  });

  it("leaves a state with nothing pending as it is", () => {
    const q = seed("top");
    expect(commitQuality(q)).toBe(q);
    expect(lockQuality(lockQuality(q))).toEqual(lockQuality(q));
  });
});

describe("forceLevel", () => {
  it("goes both ways at once, with its structure, even once locked", () => {
    const low = forceLevel(lockQuality(seed("top")), 5);
    expect(low.level).toBe(5);
    expect(low.structure.chromaticAberration).toBe(false);
    const back = forceLevel(low, 0);
    expect(back.level).toBe(0);
    expect(back.structure).toEqual({ chromaticAberration: true, smaa: "high", nanGuard: false });
    expect(forceLevel(back, 99).level).toBe(LAST_LEVEL);
    expect(forceLevel(back, -3).level).toBe(0);
  });
});

describe("settingsFor", () => {
  it("gives the high tier the level as it is", () => {
    LEVELS.forEach((level, i) => expect(settingsFor("high", i)).toEqual(level));
  });

  it("never gives the low tier the depth of field or more clouds than it compiled", () => {
    LEVELS.forEach((level, i) => {
      const low = settingsFor("low", i);
      expect(low.depthOfField).toBe(false);
      expect(low.cloudShadow).toBe(false);
      expect(low.cloudOctaves).toBe(Math.min(level.cloudOctaves, TIER_MAX.low.cloudOctaves));
      expect(low.budgetPx).toBe(level.budgetPx);
    });
  });
});

describe("pixelRatioFor", () => {
  const at = (cssWidth: number, cssHeight: number, deviceRatio: number, level: number) => {
    const s = settingsFor("high", level);
    return pixelRatioFor({ cssWidth, cssHeight, deviceRatio, budgetPx: s.budgetPx, floor: s.dprFloor, ceil: s.dprCeil });
  };

  it("keeps the screen's own ratio where the budget allows, up to the ceiling", () => {
    expect(at(1440, 900, 1, 0)).toBe(1);
    expect(at(1440, 900, 2, 0)).toBe(1.5);
    expect(at(1920, 1080, 1.25, 0)).toBe(1.25);
    expect(at(390, 844, 3, 0)).toBe(1.5);
  });

  it("draws every screen at its own ratio up to 1.5 on level 0, as before the ladder", () => {
    // A 5K display, a Pro Display XDR, an iMac 24, a 4K screen at 200 % and 150 %, a MacBook Pro 16.
    for (const [w, h, ratio] of [
      [2560, 1335, 2],
      [3008, 1600, 2],
      [2240, 1155, 2],
      [1920, 950, 2],
      [2560, 1335, 1.5],
      [1728, 1000, 2],
    ]) {
      expect(at(w, h, ratio, 0)).toBe(Math.min(Math.max(ratio, 1), 1.5));
    }
  });

  it("caps a large screen at the budget from the first step down", () => {
    expect(at(2560, 1440, 1.5, 1)).toBeCloseTo(1, 5);
    expect(at(2560, 1335, 2, 1)).toBe(1);
    expect(at(1728, 1000, 2, 1)).toBe(1.2);
    expect(at(1536, 864, 1.25, 5)).toBe(1);
  });

  it("draws below the screen's resolution only down to the level's floor", () => {
    expect(at(1920, 1080, 1, 6)).toBeCloseTo(0.8, 5);
    expect(at(2560, 1440, 1, 6)).toBe(0.7);
  });

  it("snaps down in steps of 0.05, so a few pixels of resize change nothing", () => {
    const a = at(1920, 1080, 1, 6);
    const b = at(1921, 1083, 1, 6);
    expect(b).toBe(a);
    const value = at(1700, 1300, 2, 1);
    expect(Math.abs(value * 20 - Math.round(value * 20))).toBeLessThan(1e-9);
    expect(value * value * 1700 * 1300).toBeLessThanOrEqual(LEVELS[1].budgetPx);
  });

  it("survives a missing or odd device ratio", () => {
    expect(at(1440, 900, 0, 0)).toBe(1);
    expect(at(1440, 900, Number.NaN, 0)).toBe(1);
  });
});

describe("grainScale", () => {
  it("leaves the grain as it was wherever the canvas draws at the screen's own ratio", () => {
    expect(grainScale(1, 1)).toBe(1);
    expect(grainScale(1.25, 1.25)).toBe(1);
    expect(grainScale(1.5, 2)).toBe(1);
    expect(grainScale(1.5, 3)).toBe(1);
  });

  it("draws a clump over fewer buffer pixels as the ratio drops, so it keeps its size on screen", () => {
    expect(grainScale(1, 1.5)).toBeCloseTo(2 / 3, 10);
    expect(grainScale(0.7, 1)).toBeCloseTo(0.7, 10);
    expect(grainScale(0.85, 1.25)).toBeCloseTo(0.68, 10);
  });

  it("survives an odd ratio", () => {
    expect(grainScale(0, 1)).toBe(1);
    expect(grainScale(1, 0)).toBe(1);
    expect(grainScale(1, Number.NaN)).toBe(1);
  });
});

describe("settleTier", () => {
  it("follows the query until the scene is ready on a fine pointer, then keeps it", () => {
    expect(settleTier(null, "low", false)).toBe("low");
    expect(settleTier("high", "low", false)).toBe("low");
    expect(settleTier(null, "low", true)).toBe("low");
    expect(settleTier("high", "low", true)).toBe("high");
  });
});
