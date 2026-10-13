import { describe, expect, it, vi } from "vitest";
import { artQueue } from "./artQueue";
import { onPaintsChange, paintSet, paintsPending } from "./paintSet";

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

  it("counts a board pending from its call until a frame after its set took it", async () => {
    const before = paintsPending();
    let atKeep = -1;
    const keep = () => {
      atKeep = paintsPending();
    };
    const cleanup = paintSet([], 0, () => () => "poster", keep, vi.fn());
    expect(paintsPending()).toBe(before + 1);
    await settle();
    // Kept, but its set's update has not landed yet: still pending.
    expect(atKeep).toBe(before + 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(paintsPending()).toBe(before);
    cleanup();
    expect(paintsPending()).toBe(before);
  });

  it("tells its listeners as a board is asked for and as it lands, until they leave", async () => {
    const seen: number[] = [];
    const off = onPaintsChange(() => seen.push(paintsPending()));
    const before = paintsPending();
    const cleanup = paintSet([], 0, () => () => "poster", vi.fn(), vi.fn());
    expect(seen).toEqual([before + 1]);
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen).toEqual([before + 1, before]);
    off();
    paintSet([], 0, () => () => "poster", vi.fn(), vi.fn())();
    expect(seen).toEqual([before + 1, before]);
    cleanup();
  });

  it("stops counting a board cleaned up before its turn, or whose painter throws", async () => {
    const before = paintsPending();
    paintSet([], 3, () => () => "wall", vi.fn(), vi.fn())();
    expect(paintsPending()).toBe(before);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    paintSet(
      [],
      1,
      () => () => {
        throw new Error("no 2D canvas");
      },
      vi.fn(),
      vi.fn(),
    );
    await settle();
    expect(paintsPending()).toBe(before);
    errors.mockRestore();
  });
});
