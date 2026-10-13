import { describe, expect, it } from "vitest";
import { passPush, type PushFrame, type PushSeen, takePush } from "./pushTake";

const firstLine = 0.06;
const title = { kind: "title", to: 0.002 } as const;
const arrival = { kind: "hold", to: 0.04 } as const;
const line = { kind: "card", to: firstLine } as const;
const drive = { kind: "hold", to: 0.2 } as const;

/** A frame on the stage at the title wall, after a notch held there. */
function frame(over: Partial<PushFrame> = {}): PushFrame {
  return { pushedAt: 1000, front: title, firstLine, inStage: true, rewinding: false, source: "wheel", ...over };
}

describe("takePush", () => {
  it("carries a notch, flick or swipe held at the opening's walls on to the first line", () => {
    for (const source of ["wheel", "touch"] as const) {
      for (const front of [title, arrival]) {
        expect(takePush({ at: 0 }, frame({ source, front }))).toBe("carry");
      }
    }
  });

  it("takes each push once", () => {
    const seen: PushSeen = { at: 0 };
    expect(takePush(seen, frame())).toBe("carry");
    expect(takePush(seen, frame())).toBe("none");
    expect(takePush(seen, frame({ pushedAt: 1200 }))).toBe("carry");
  });

  it("only flashes the card for a push anywhere else, from anything else or going back", () => {
    // A line's own wall, a drive further on, every wall open.
    expect(takePush({ at: 0 }, frame({ front: line }))).toBe("flash");
    expect(takePush({ at: 0 }, frame({ front: drive }))).toBe("flash");
    expect(takePush({ at: 0 }, frame({ front: undefined }))).toBe("flash");
    // The page off the film: the hero's wall or the select's.
    expect(takePush({ at: 0 }, frame({ inStage: false }))).toBe("flash");
    // A key or a press has its own carry, the pedal pushes for itself.
    for (const source of ["key", "click", "pedal", null] as const) {
      expect(takePush({ at: 0 }, frame({ source }))).toBe("flash");
    }
    expect(takePush({ at: 0 }, frame({ rewinding: true }))).toBe("flash");
  });

  it("never carries a push the resting frame let go by, once the page lands at the title wall (LOAD GAME, Back, a fragment)", () => {
    const seen: PushSeen = { at: 0 };
    // In the hero, the city far below and resting: she wheels into a card's wall, and the push goes by.
    passPush(seen, 5000);
    // LOAD GAME lands the page at the stage's top, the title wall closed: the frame runs again.
    expect(takePush(seen, frame({ pushedAt: 5000, source: "wheel" }))).toBe("none");
    // Her own notch there carries, as ever.
    expect(takePush(seen, frame({ pushedAt: 9000, source: "wheel" }))).toBe("carry");
  });
});
