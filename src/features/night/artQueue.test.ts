import { describe, expect, it } from "vitest";
import { createArtQueue, nextJob, stopRank } from "./artQueue";

/** A queue whose steps run only when the test says so. */
function manual() {
  const pending: (() => void)[] = [];
  const queue = createArtQueue((run) => pending.push(run));
  const tick = () => pending.shift()?.();
  const flush = async () => {
    while (pending.length) {
      tick();
      await Promise.resolve();
    }
  };
  return { queue, pending, tick, flush };
}

describe("artQueue", () => {
  it("runs one painter per task, never two in the same one", () => {
    const { queue, pending, tick } = manual();
    const ran: string[] = [];
    queue.paint(() => ran.push("a"));
    queue.paint(() => ran.push("b"));
    expect(ran).toEqual([]);
    expect(pending).toHaveLength(1);
    tick();
    expect(ran).toEqual(["a"]);
    tick();
    expect(ran).toEqual(["a", "b"]);
    expect(pending).toHaveLength(0);
  });

  it("steps a generator one yield per task and resolves with its value", async () => {
    const { queue, tick, flush } = manual();
    const steps: number[] = [];
    function* wall() {
      steps.push(1);
      yield;
      steps.push(2);
      yield;
      steps.push(3);
      return "canvas";
    }
    const { done } = queue.paint(wall());
    tick();
    expect(steps).toEqual([1]);
    tick();
    expect(steps).toEqual([1, 2]);
    await flush();
    await expect(done).resolves.toBe("canvas");
    expect(steps).toEqual([1, 2, 3]);
  });

  it("paints the stop she reaches first first, rank read at each step", () => {
    const { queue, tick } = manual();
    const ran: string[] = [];
    let current = 0;
    queue.paint(() => ran.push("logixs"), () => stopRank(3, current));
    queue.paint(() => ran.push("army"), () => stopRank(0, current));
    queue.paint(() => ran.push("pwc"), () => stopRank(2, current));
    tick();
    expect(ran).toEqual(["army"]);
    current = 3;
    tick();
    expect(ran).toEqual(["army", "logixs"]);
    tick();
    expect(ran).toEqual(["army", "logixs", "pwc"]);
  });

  it("drops a cancelled painter and goes on with the rest", () => {
    const { queue, tick } = manual();
    const ran: string[] = [];
    const first = queue.paint(() => ran.push("a"));
    queue.paint(() => ran.push("b"));
    first.cancel();
    tick();
    expect(ran).toEqual(["b"]);
    expect(queue.pending()).toBe(0);
  });

  it("drops a painter cancelled inside its own step, and no other", () => {
    const { queue, tick } = manual();
    const ran: string[] = [];
    const self = { cancel: () => {} };
    self.cancel = queue.paint(
      (function* () {
        ran.push("a1");
        self.cancel();
        yield;
        ran.push("a2");
      })(),
    ).cancel;
    queue.paint(() => ran.push("b"));
    tick();
    tick();
    tick();
    expect(ran).toEqual(["a1", "b"]);
    expect(queue.pending()).toBe(0);
  });

  it("rejects a painter that throws and keeps painting", async () => {
    const { queue, flush } = manual();
    const bad = queue.paint(() => {
      throw new Error("no 2D canvas");
    });
    const good = queue.paint(() => 1);
    await flush();
    await expect(bad.done).rejects.toThrow("no 2D canvas");
    await expect(good.done).resolves.toBe(1);
  });

  it("picks the lowest rank, the earliest among equals", () => {
    const job = (rank: number, order: number) => ({ rank: () => rank, order });
    expect(nextJob([job(2, 0), job(1, 1), job(1, 2)])?.order).toBe(1);
    expect(nextJob([])).toBeUndefined();
  });

  it("ranks the stops by how soon she reaches them along the film, never round", () => {
    expect(stopRank(3, 3)).toBe(0);
    const order = (current: number) => [0, 1, 2, 3, 4].sort((a, b) => stopRank(a, current) - stopRank(b, current));
    // Driving in from the line-up: in the film's order.
    expect(order(0)).toEqual([0, 1, 2, 3, 4]);
    // Back up from STATS: Heuristik, then Logixs, the army last.
    expect(order(4)).toEqual([4, 3, 2, 1, 0]);
    // A link to PwC: PwC, then the stop ahead before the one behind.
    expect(order(1)).toEqual([1, 2, 0, 3, 4]);
    expect(order(2)).toEqual([2, 3, 1, 4, 0]);
  });
});
