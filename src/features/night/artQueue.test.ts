import { describe, expect, it } from "vitest";
import type { IdleScheduler } from "@/lib/idle";
import { createArtQueue, createQuietWait, mayPaint, nextJob, PAINT_GATE, stopOrder, stopRank } from "./artQueue";

/** A queue whose steps run only when the test says so, the stop on screen's and the others' alike. */
function manual() {
  const pending: (() => void)[] = [];
  const queue = createArtQueue(
    (run) => pending.push(run),
    (run) => pending.push(run),
  );
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
    const order = (current: number) => stopOrder(5, current);
    // Driving in from the line-up: in the film's order.
    expect(order(0)).toEqual([0, 1, 2, 3, 4]);
    // Back up from STATS: Heuristik, then Logixs, the army last.
    expect(order(4)).toEqual([4, 3, 2, 1, 0]);
    // A link to PwC: PwC, then the stop ahead before the one behind.
    expect(order(1)).toEqual([1, 2, 0, 3, 4]);
    expect(order(2)).toEqual([2, 3, 1, 4, 0]);
    expect(stopOrder(0, 0)).toEqual([]);
  });
});

describe("the paint gate", () => {
  /** A queue whose stop-on-screen steps and waiting steps are kept apart. */
  function split() {
    const now: (() => void)[] = [];
    const waiting: { run: () => void; urgent: () => boolean }[] = [];
    const queue = createArtQueue(
      (run) => now.push(run),
      (run, urgent) => waiting.push({ run, urgent }),
    );
    return { queue, now, waiting };
  }

  it("paints the stop on screen after a frame, and makes every other wait for a quiet moment", () => {
    const { queue, now, waiting } = split();
    const ran: string[] = [];
    let current = 0;
    queue.paint(() => ran.push("pwc"), () => stopRank(1, current));
    expect(now).toHaveLength(0);
    expect(waiting).toHaveLength(1);
    expect(waiting[0].urgent()).toBe(false);
    // She reaches PwC while it waits: it is the stop on screen now.
    current = 1;
    expect(waiting[0].urgent()).toBe(true);
    waiting.shift()?.run();
    expect(ran).toEqual(["pwc"]);
    queue.paint(() => ran.push("pwc again"), () => stopRank(1, current));
    expect(now).toHaveLength(1);
    expect(waiting).toHaveLength(0);
    now.shift()?.();
    expect(ran).toEqual(["pwc", "pwc again"]);
  });

  it("paints the stop on screen first even when another was asked for earlier", () => {
    const { queue, now, waiting } = split();
    const ran: string[] = [];
    queue.paint(() => ran.push("logixs"), () => stopRank(3, 0));
    queue.paint(() => ran.push("army"), () => stopRank(0, 0));
    // The first step was scheduled as a wait; when it runs, the army goes first.
    waiting.shift()?.run();
    expect(ran).toEqual(["army"]);
    expect(waiting).toHaveLength(1);
    expect(now).toHaveLength(0);
    waiting.shift()?.run();
    expect(ran).toEqual(["army", "logixs"]);
  });

  it("lets a step through once the page has been still a moment, or once it has waited long enough", () => {
    const since = 1000;
    // At once for the stop on screen, whatever she is doing.
    expect(mayPaint(true, since, since, since)).toBe(true);
    // She scrolled 50 ms ago: it waits.
    expect(mayPaint(false, since + 100, since, since + 50)).toBe(false);
    expect(mayPaint(false, since + 50 + PAINT_GATE.quietMs, since, since + 50)).toBe(true);
    // She never stops: a second at most.
    expect(mayPaint(false, since + PAINT_GATE.timeoutMs - 1, since, since + PAINT_GATE.timeoutMs - 10)).toBe(false);
    expect(mayPaint(false, since + PAINT_GATE.timeoutMs, since, since + PAINT_GATE.timeoutMs - 10)).toBe(true);
  });

  it("looks again at every idle period until the page is still, a second at most", () => {
    let clock = 0;
    let scrolled = 0;
    const asked: { look: () => void; timeoutMs: number }[] = [];
    const idle: IdleScheduler = {
      request: (run, timeoutMs) => asked.push({ look: () => run({ didTimeout: false, timeRemaining: () => 10 }), timeoutMs }),
      cancel: () => undefined,
    };
    const wait = createQuietWait(
      idle,
      () => clock,
      () => scrolled,
    );
    let ran = 0;
    let urgent = false;
    wait(
      () => (ran += 1),
      () => urgent,
    );
    expect(asked[0].timeoutMs).toBe(PAINT_GATE.timeoutMs);
    // She keeps scrolling: each idle period finds the page moving, and the time left shrinks.
    clock = 300;
    scrolled = 250;
    asked.shift()?.look();
    expect(ran).toBe(0);
    expect(asked[0].timeoutMs).toBe(PAINT_GATE.timeoutMs - 300);
    // She stops: 200 ms later it paints.
    clock = 450;
    asked.shift()?.look();
    expect(ran).toBe(1);
    expect(asked).toHaveLength(0);

    // Never still: it paints at the timeout.
    wait(
      () => (ran += 1),
      () => urgent,
    );
    clock = 450 + PAINT_GATE.timeoutMs;
    scrolled = clock - 16;
    asked.shift()?.look();
    expect(ran).toBe(2);

    // Still scrolling, but she has reached its stop: at once.
    wait(
      () => (ran += 1),
      () => urgent,
    );
    clock += 50;
    scrolled = clock;
    urgent = true;
    asked.shift()?.look();
    expect(ran).toBe(3);
  });
});
