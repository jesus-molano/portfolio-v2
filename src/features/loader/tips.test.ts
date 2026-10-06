import { describe, expect, it } from "vitest";
import { readingSeconds } from "@/features/hero/scroll/film";
import {
  eligible,
  firstTip,
  isSlow,
  type LoaderTip,
  pad2,
  percentLabel,
  tipDuration,
  tipOrder,
} from "./tips";

const tip = (kind: LoaderTip["kind"], when: LoaderTip["when"], text = `${kind} ${when.join("+")}`): LoaderTip => ({
  kind,
  when,
  text,
});

/** Shaped like the dictionaries: useful tips first, then the trivia. */
const TIPS: LoaderTip[] = [
  tip("tip", ["motion"], "t0 drive"),
  tip("tip", ["pointer"], "t1 radio by mouse"),
  tip("tip", ["touch"], "t2 radio by touch"),
  tip("tip", ["pointer", "motion"], "t3 keys"),
  tip("tip", ["touch", "motion"], "t4 swipes"),
  tip("tip", [], "t5 stations"),
  tip("trivia", [], "q6"),
  tip("trivia", [], "q7"),
  tip("trivia", ["motion"], "q8"),
];

/** A seeded generator, so a shuffle is repeatable. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kinds = (order: number[]) => order.map((index) => TIPS[index].kind);

describe("eligible", () => {
  const desk = { touch: false, reducedMotion: false };
  const phone = { touch: true, reducedMotion: false };
  const still = { touch: false, reducedMotion: true };

  it("shows a tip for everyone to everyone", () => {
    expect(eligible(tip("tip", []), desk)).toBe(true);
    expect(eligible(tip("tip", []), { touch: true, reducedMotion: true })).toBe(true);
  });

  it("keeps mouse and keyboard tips off phones, and touch tips off desktops", () => {
    expect(eligible(tip("tip", ["pointer"]), desk)).toBe(true);
    expect(eligible(tip("tip", ["pointer"]), phone)).toBe(false);
    expect(eligible(tip("tip", ["touch"]), phone)).toBe(true);
    expect(eligible(tip("tip", ["touch"]), desk)).toBe(false);
  });

  it("keeps driving tips away from reduced motion", () => {
    expect(eligible(tip("tip", ["motion"]), desk)).toBe(true);
    expect(eligible(tip("tip", ["motion"]), still)).toBe(false);
  });

  it("needs every condition", () => {
    expect(eligible(tip("tip", ["pointer", "motion"]), desk)).toBe(true);
    expect(eligible(tip("tip", ["pointer", "motion"]), still)).toBe(false);
    expect(eligible(tip("tip", ["pointer", "motion"]), phone)).toBe(false);
  });
});

describe("firstTip", () => {
  it("is the first tip, or under reduced motion the first tip for everyone", () => {
    expect(firstTip(TIPS, false)).toBe(0);
    expect(firstTip(TIPS, true)).toBe(5);
  });

  it("skips trivia when it looks for the reduced-motion card", () => {
    const tips = [tip("tip", ["motion"]), tip("trivia", []), tip("tip", [])];
    expect(firstTip(tips, true)).toBe(2);
  });
});

describe("tipOrder", () => {
  it("starts on the card the server rendered", () => {
    expect(tipOrder(TIPS, { touch: false, reducedMotion: false, random: seeded(1) })[0]).toBe(0);
    expect(tipOrder(TIPS, { touch: true, reducedMotion: false, random: seeded(1) })[0]).toBe(0);
    expect(tipOrder(TIPS, { touch: false, reducedMotion: true, random: seeded(1) })[0]).toBe(5);
    expect(tipOrder(TIPS, { touch: true, reducedMotion: true, random: seeded(1) })[0]).toBe(5);
  });

  it("holds every eligible tip once, and nothing else", () => {
    for (const touch of [false, true]) {
      for (const reducedMotion of [false, true]) {
        const order = tipOrder(TIPS, { touch, reducedMotion, random: seeded(7) });
        const expected = TIPS.flatMap((t, i) => (eligible(t, { touch, reducedMotion }) ? [i] : []));
        expect([...order].sort((a, b) => a - b)).toEqual(expected);
      }
    }
  });

  it("alternates tips and trivia, then runs out the longer kind", () => {
    const order = tipOrder(TIPS, { touch: false, reducedMotion: false, random: seeded(3) });
    // Desktop with motion: tips 0, 1, 3, 5 and trivia 6, 7, 8.
    expect(kinds(order)).toEqual(["tip", "trivia", "tip", "trivia", "tip", "trivia", "tip"]);
    const useful = order.filter((index) => TIPS[index].kind === "tip");
    expect(useful).toEqual([0, 1, 3, 5]);
  });

  it("keeps the authored order of the tips on a phone", () => {
    const order = tipOrder(TIPS, { touch: true, reducedMotion: false, random: seeded(3) });
    expect(order.filter((index) => TIPS[index].kind === "tip")).toEqual([0, 2, 4, 5]);
    expect(order).not.toContain(1);
    expect(order).not.toContain(3);
  });

  it("leaves the driving tips out under reduced motion", () => {
    const order = tipOrder(TIPS, { touch: false, reducedMotion: true, random: seeded(3) });
    expect(order).toEqual(expect.arrayContaining([5, 1, 6, 7]));
    expect(order).toHaveLength(4);
    expect(kinds(order)).toEqual(["tip", "trivia", "tip", "trivia"]);
  });

  it("shuffles the trivia with the random it is given, the same way every time", () => {
    const a = tipOrder(TIPS, { touch: false, reducedMotion: false, random: seeded(11) });
    const b = tipOrder(TIPS, { touch: false, reducedMotion: false, random: seeded(11) });
    expect(a).toEqual(b);
    const trivia = (order: number[]) => order.filter((index) => TIPS[index].kind === "trivia");
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      seen.add(trivia(tipOrder(TIPS, { touch: false, reducedMotion: false, random: seeded(seed) })).join());
    }
    // Three trivia have six orders; forty seeds find more than one of them.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("shuffles Fisher–Yates style: no swap when random is near one", () => {
    const zero = tipOrder(TIPS, { touch: false, reducedMotion: false, random: () => 0 });
    const one = tipOrder(TIPS, { touch: false, reducedMotion: false, random: () => 0.999999 });
    expect(one.filter((index) => TIPS[index].kind === "trivia")).toEqual([6, 7, 8]);
    expect(zero.filter((index) => TIPS[index].kind === "trivia")).toEqual([7, 8, 6]);
  });
});

describe("tipDuration", () => {
  it("never shows a tip for less than five seconds", () => {
    expect(tipDuration("Hi.")).toBe(5);
  });

  it("gives a long tip its reading time and a beat more", () => {
    const text = "a".repeat(120);
    expect(tipDuration(text)).toBeCloseTo(readingSeconds(text) + 1.5, 5);
    expect(tipDuration(text)).toBeGreaterThan(8);
  });
});

describe("isSlow", () => {
  it("is not slow while progress keeps coming in the first eight seconds", () => {
    expect(isSlow({ sinceMountMs: 7900, sinceProgressMs: 200, progress: 60 })).toBe(false);
  });

  it("is slow after eight seconds without the scene", () => {
    expect(isSlow({ sinceMountMs: 8000, sinceProgressMs: 100, progress: 92 })).toBe(true);
  });

  it("is slow after five seconds without any progress", () => {
    expect(isSlow({ sinceMountMs: 5000, sinceProgressMs: 5000, progress: 0 })).toBe(true);
    expect(isSlow({ sinceMountMs: 6000, sinceProgressMs: 4999, progress: 30 })).toBe(false);
  });

  it("is never slow once loaded", () => {
    expect(isSlow({ sinceMountMs: 30000, sinceProgressMs: 30000, progress: 100 })).toBe(false);
  });
});

describe("labels", () => {
  it("pads the counter to two digits", () => {
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
  });

  it("keeps the percent four characters long", () => {
    expect(percentLabel(0)).toBe("  0%");
    expect(percentLabel(64.4)).toBe(" 64%");
    expect(percentLabel(100)).toBe("100%");
    expect(percentLabel(140)).toBe("100%");
    for (const value of [0, 7, 42, 100]) expect(Array.from(percentLabel(value))).toHaveLength(4);
  });
});
