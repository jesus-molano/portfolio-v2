import { describe, expect, it, vi } from "vitest";
import { artQueue } from "./artQueue";
import { paintSet } from "./paintSet";

/** Lets the faces (none in Node) and every queued painter run. */
async function settle() {
  for (let i = 0; i < 20 && (artQueue.pending() > 0 || i < 2); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("paintSet", () => {
  it("paints in turn, keeps what it made and releases it on cleanup", async () => {
    const keep = vi.fn();
    const release = vi.fn();
    const cleanup = paintSet([], 0, () => () => "poster", keep, release);
    expect(keep).not.toHaveBeenCalled();
    await settle();
    expect(keep).toHaveBeenCalledWith("poster");
    expect(release).not.toHaveBeenCalled();
    cleanup();
    expect(release).toHaveBeenCalledWith("poster");
  });

  it("paints nothing once cleaned up before its turn", async () => {
    const painter = vi.fn(() => "wall");
    const keep = vi.fn();
    const cleanup = paintSet([], 3, () => painter, keep, vi.fn());
    cleanup();
    await settle();
    expect(painter).not.toHaveBeenCalled();
    expect(keep).not.toHaveBeenCalled();
  });

  it("stops a generator mid-wall when cleaned up, and keeps nothing", async () => {
    const steps: number[] = [];
    const keep = vi.fn();
    const release = vi.fn();
    const self = { cleanup: () => {} };
    self.cleanup = paintSet(
      [],
      3,
      () =>
        (function* () {
          steps.push(1);
          yield;
          self.cleanup();
          yield;
          steps.push(3);
          return "wall";
        })(),
      keep,
      release,
    );
    await settle();
    expect(steps).toEqual([1]);
    expect(keep).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
});
