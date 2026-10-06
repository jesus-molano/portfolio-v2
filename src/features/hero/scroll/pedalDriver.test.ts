import { describe, expect, it } from "vitest";
import { newPedal, PEDAL, pressPedal, releasePedal } from "./pedal";
import { driveFrame, type DriveInput } from "./pedalDriver";

const input = (over: Partial<DriveInput> = {}): DriveInput => ({
  dt: 1 / 60,
  back: false,
  sinceBack: 10,
  frozen: false,
  atEnd: false,
  stepping: false,
  ...over,
});

describe("driveFrame", () => {
  it("does nothing while the pedal is up", () => {
    const p = newPedal();
    expect(driveFrame(p, { endHold: 0 }, input())).toEqual({ kind: "up" });
  });

  it("drives once pressed, and waits for a line's glide to land before it pushes", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    const gliding = driveFrame(p, { endHold: 0 }, input({ stepping: true }));
    expect(gliding).toMatchObject({ kind: "drive", push: false });
    const free = driveFrame(p, { endHold: 0 }, input());
    expect(free).toMatchObject({ kind: "drive", push: true });
    if (free.kind === "drive") expect(free.level).toBeGreaterThanOrEqual(PEDAL.bite);
  });

  it("suspends the push when she goes back, and the frozen stage holds it", () => {
    const p = newPedal();
    pressPedal(p, "touch", 0);
    expect(driveFrame(p, { endHold: 0 }, input({ back: true, sinceBack: 0 }))).toEqual({ kind: "suspended" });
    const q = newPedal();
    pressPedal(q, "key", 0);
    expect(driveFrame(q, { endHold: 0 }, input({ frozen: true }))).toEqual({ kind: "frozen" });
  });

  it("rests at the end, and goes on once it has rested PEDAL.endHold", () => {
    const p = newPedal();
    pressPedal(p, "key", 0);
    const state = { endHold: 0 };
    let last = driveFrame(p, state, input({ atEnd: true, dt: 0.25 }));
    expect(last).toEqual({ kind: "end", goOn: false });
    for (let t = 0.25; t < PEDAL.endHold; t += 0.25) last = driveFrame(p, state, input({ atEnd: true, dt: 0.25 }));
    expect(last).toEqual({ kind: "end", goOn: true });
    // Letting go forgets the rest.
    releasePedal(p, 5000);
    driveFrame(p, state, input());
    expect(state.endHold).toBe(0);
  });
});
