import { afterEach, describe, expect, it, vi } from "vitest";
import { createRandom } from "@/features/hero/scene/world";
import { ATLAS, ATRIUM, GAIN, LOBBY, PANE, PANE_COUNT, paintWindows, paintWindowsSteps, pickPane, WINDOW } from "./windows";

/**
 * Canvases whose 2D context writes down every call and every setting, in
 * order (Node has no canvas): two canvases painted the same way have the
 * same log. Objects a context hands out (gradients) are numbered per
 * canvas, so they compare too.
 */
function recordingCanvases() {
  const logs = new Map<object, string[]>();
  let latest: string[] = [];
  const show = (value: unknown): string =>
    typeof value === "object" && value !== null ? `#${String((value as { id?: number }).id)}` : String(value);
  vi.stubGlobal("document", {
    createElement: () => {
      const log: string[] = [];
      let ids = 0;
      const recorder = (): object => {
        const target = { id: ids++ };
        return new Proxy(target, {
          get(own, key) {
            if (key === "id") return own.id;
            if (typeof key === "symbol") return undefined;
            return (...args: unknown[]) => {
              log.push(`${key}(${args.map(show).join(",")})`);
              return recorder();
            };
          },
          set(_own, key, value) {
            log.push(`${String(key)}=${show(value)}`);
            return true;
          },
        });
      };
      const canvas = { width: 0, height: 0, getContext: () => recorder() };
      logs.set(canvas, log);
      latest = log;
      return canvas;
    },
  });
  return {
    /** What was drawn on `canvas`. */
    log: (canvas: object) => logs.get(canvas) ?? [],
    /** What is drawn on the canvas made last, as it is drawn. */
    latest: () => latest,
  };
}

const OFFICE = new Set<number>([
  PANE.office,
  PANE.blinds,
  PANE.officeLate,
  PANE.study,
  PANE.officePair,
  PANE.meeting,
  PANE.officeHalf,
  PANE.archive,
  PANE.cornerOffice,
]);
const OFFICE_DARK = new Set<number>([PANE.dark, PANE.blindsDark]);

describe("window atlas", () => {
  it("names every cell once, inside the grid", () => {
    const cells = Object.values(PANE);
    expect(new Set(cells).size).toBe(cells.length);
    expect(PANE_COUNT).toBe(ATLAS.cols * ATLAS.rows);
    for (const cell of cells) expect(cell).toBeLessThan(PANE_COUNT);
  });

  it("picks the same rooms from the same seed", () => {
    const a = createRandom(7);
    const b = createRandom(7);
    for (let i = 0; i < 50; i += 1) expect(pickPane(a, "hotel", 0.5)).toEqual(pickPane(b, "hotel", 0.5));
  });

  it("keeps each kind of building to its own rooms, and dark panes dark", () => {
    const random = createRandom(11);
    for (let i = 0; i < 400; i += 1) {
      const lit = pickPane(random, "office", 1);
      expect(OFFICE.has(lit.cell)).toBe(true);
      const dark = pickPane(random, "office", 0);
      expect(OFFICE_DARK.has(dark.cell)).toBe(true);
      expect(pickPane(random, "hotel", 0).cell).toBe(PANE.dark);
      expect(pickPane(random, "home", 1).cell).not.toBe(PANE.office);
    }
  });

  it("flickers televisions only, and varies the rooms' brightness within a calm range", () => {
    const random = createRandom(3);
    let tvs = 0;
    for (let i = 0; i < 600; i += 1) {
      const look = pickPane(random, "home", 0.6);
      if (look.cell === PANE.roomTv) {
        tvs += 1;
        expect(look.flicker).toBeGreaterThan(0);
      } else {
        expect(look.flicker ?? 0).toBe(0);
      }
      expect(look.gain).toBeGreaterThanOrEqual(GAIN.half[0]);
      expect(look.gain).toBeLessThanOrEqual(GAIN.lit[1]);
    }
    expect(tvs).toBeGreaterThan(0);
  });

  it("never puts the same lit room twice side by side, and leaves some rooms half lit", () => {
    for (const occupancy of ["hotel", "home", "office"] as const) {
      const random = createRandom(5);
      let beside = -1;
      let half = 0;
      for (let i = 0; i < 400; i += 1) {
        const look = pickPane(random, occupancy, 1, beside);
        expect(look.cell, occupancy).not.toBe(beside);
        if ((look.gain ?? 1) < GAIN.lit[0]) half += 1;
        beside = look.cell;
      }
      expect(half).toBeGreaterThan(20);
    }
  });

  it("paints the lobby and the atrium as rooms across neighbouring cells", () => {
    for (const room of [LOBBY, ATRIUM]) room.forEach((cell, i) => i > 0 && expect(cell).toBe(room[i - 1] + 1));
  });
});

describe("painting the atlas a room at a time", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("paints the same atlas as in one go, whatever runs between its steps", () => {
    const canvases = recordingCanvases();
    const steps = paintWindowsSteps();
    let step = steps.next();
    step = steps.next();
    // Another atlas painted in one go between two steps draws nothing on this one and takes nothing of its seed.
    const whole = paintWindows();
    let painted = 2;
    while (!step.done) {
      expect(step.value).toBe(painted);
      step = steps.next();
      painted += 1;
    }
    // The lobby and the atrium are the last rooms painted; no step past the grid.
    expect(painted).toBeGreaterThan(ATRIUM[ATRIUM.length - 1]);
    expect(painted).toBeLessThanOrEqual(PANE_COUNT);
    expect(canvases.log(step.value).length).toBeGreaterThan(0);
    expect(canvases.log(step.value)).toEqual(canvases.log(whole));
  });

  it("paints one cell a step, each on its own place in the grid", () => {
    const canvases = recordingCanvases();
    const steps = paintWindowsSteps();
    let step = steps.next();
    const log = canvases.latest();
    let cell = 0;
    let start = 0;
    for (;;) {
      const x = (cell % ATLAS.cols) * WINDOW.w;
      const y = Math.floor(cell / ATLAS.cols) * WINDOW.h;
      expect(log.slice(start, start + 2), `cell ${cell}`).toEqual(["save()", `translate(${x},${y})`]);
      if (step.done) break;
      cell = step.value;
      start = log.length;
      step = steps.next();
    }
    expect(cell).toBeGreaterThan(ATLAS.cols);
  });
});
