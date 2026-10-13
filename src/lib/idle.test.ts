import { afterEach, describe, expect, it, vi } from "vitest";
import { browserIdle, createIdleLoop, FALLBACK_SLICE_MS, type IdleScheduler, type IdleSlice } from "./idle";

/**
 * Idle periods the test hands out: each `period(ms)` runs the waiting
 * callback with that much time left, and every step the loop runs uses up
 * `cost` of it.
 */
function fakeIdle() {
  const waiting: { run: (slice: IdleSlice) => void; timeoutMs: number; cancelled: boolean }[] = [];
  let left = 0;
  const scheduler: IdleScheduler = {
    request(run, timeoutMs) {
      const entry = { run, timeoutMs, cancelled: false };
      waiting.push(entry);
      return entry;
    },
    cancel(handle) {
      (handle as { cancelled: boolean }).cancelled = true;
    },
  };
  const take = () => {
    let entry = waiting.shift();
    while (entry?.cancelled) entry = waiting.shift();
    return entry;
  };
  return {
    scheduler,
    waiting: () => waiting.filter((entry) => !entry.cancelled),
    spend: (ms: number) => {
      left -= ms;
    },
    /** One idle period of `ms`; returns whether a callback was waiting for it. */
    period(ms: number) {
      const entry = take();
      if (!entry) return false;
      left = ms;
      entry.run({ didTimeout: false, timeRemaining: () => Math.max(0, left) });
      return true;
    },
    /** A callback run by its timeout, with no idle time at all. */
    timeout() {
      const entry = take();
      if (!entry) return false;
      left = 0;
      entry.run({ didTimeout: true, timeRemaining: () => 0 });
      return true;
    },
  };
}

describe("createIdleLoop", () => {
  it("runs as many steps as a period has room for, and goes on in the next", () => {
    const idle = fakeIdle();
    let done = 0;
    const loop = createIdleLoop(
      () => {
        done += 1;
        idle.spend(4);
        return done < 10;
      },
      { scheduler: idle.scheduler, reserveMs: 2, timeoutMs: 500 },
    );
    loop.wake();
    expect(idle.waiting()).toHaveLength(1);
    expect(idle.waiting()[0].timeoutMs).toBe(500);
    // 13 ms: steps start with 13, 9 and 5 left, then 1 is under the reserve.
    idle.period(13);
    expect(done).toBe(3);
    idle.period(50);
    expect(done).toBe(10);
    // Done for now: nothing asked for until it is woken.
    expect(idle.waiting()).toHaveLength(0);
  });

  it("starts no step on a scrap of a period, but one when it came by its timeout", () => {
    const idle = fakeIdle();
    let done = 0;
    const loop = createIdleLoop(
      () => {
        done += 1;
        idle.spend(30);
        return true;
      },
      { scheduler: idle.scheduler, reserveMs: 6 },
    );
    loop.wake();
    idle.period(5);
    expect(done).toBe(0);
    expect(idle.waiting()).toHaveLength(1);
    idle.timeout();
    expect(done).toBe(1);
    idle.timeout();
    expect(done).toBe(2);
    // A long step runs once in a period, however much of it was left.
    idle.period(20);
    expect(done).toBe(3);
  });

  it("parks when the step has nothing to do, and asks once however often it is woken", () => {
    const idle = fakeIdle();
    let work = 0;
    const step = vi.fn(() => {
      if (work > 0) work -= 1;
      return work > 0;
    });
    const loop = createIdleLoop(step, { scheduler: idle.scheduler });
    loop.wake();
    loop.wake();
    expect(idle.waiting()).toHaveLength(1);
    idle.period(50);
    expect(step).toHaveBeenCalledTimes(1);
    expect(idle.waiting()).toHaveLength(0);
    work = 2;
    loop.wake();
    idle.period(50);
    expect(step).toHaveBeenCalledTimes(3);
    expect(work).toBe(0);
  });

  it("does not ask twice when a step wakes the loop itself", () => {
    const idle = fakeIdle();
    const self = { loop: null as ReturnType<typeof createIdleLoop> | null };
    let calls = 0;
    self.loop = createIdleLoop(
      () => {
        calls += 1;
        self.loop?.wake();
        idle.spend(10);
        return calls < 3;
      },
      { scheduler: idle.scheduler },
    );
    self.loop.wake();
    idle.period(5);
    expect(idle.waiting()).toHaveLength(1);
  });

  it("stops for good: the period asked for is cancelled and a wake does nothing", () => {
    const idle = fakeIdle();
    const step = vi.fn(() => true);
    const loop = createIdleLoop(step, { scheduler: idle.scheduler });
    loop.wake();
    loop.stop();
    expect(idle.waiting()).toHaveLength(0);
    loop.wake();
    expect(idle.period(50)).toBe(false);
    expect(step).not.toHaveBeenCalled();
  });

  it("stops between two steps when a step stops it", () => {
    const idle = fakeIdle();
    const self = { loop: null as ReturnType<typeof createIdleLoop> | null };
    const step = vi.fn(() => {
      self.loop?.stop();
      return true;
    });
    self.loop = createIdleLoop(step, { scheduler: idle.scheduler });
    self.loop.wake();
    idle.period(50);
    expect(step).toHaveBeenCalledTimes(1);
    expect(idle.waiting()).toHaveLength(0);
  });

  it("parks when a step throws, and can be woken again", () => {
    const idle = fakeIdle();
    let fail = true;
    const step = vi.fn(() => {
      if (fail) throw new Error("no 2D canvas");
      return false;
    });
    const loop = createIdleLoop(step, { scheduler: idle.scheduler });
    loop.wake();
    expect(() => idle.period(50)).toThrow("no 2D canvas");
    expect(idle.waiting()).toHaveLength(0);
    fail = false;
    loop.wake();
    idle.period(50);
    expect(step).toHaveBeenCalledTimes(2);
  });
});

describe("browserIdle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses requestIdleCallback with the timeout where the browser has it", () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal("requestIdleCallback", request);
    vi.stubGlobal("cancelIdleCallback", cancel);
    const idle = browserIdle();
    const run = () => undefined;
    expect(idle.request(run, 400)).toBe(7);
    expect(request).toHaveBeenCalledWith(run, { timeout: 400 });
    idle.cancel(7);
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("falls back to a task after the frame, offering a short slice, and can cancel it", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("requestAnimationFrame", undefined);
    const idle = browserIdle();
    const slices: IdleSlice[] = [];
    idle.request((slice) => slices.push(slice), 400);
    const dropped = idle.request((slice) => slices.push(slice), 400);
    idle.cancel(dropped);
    vi.runAllTimers();
    expect(slices).toHaveLength(1);
    expect(slices[0].didTimeout).toBe(false);
    expect(slices[0].timeRemaining()).toBeLessThanOrEqual(FALLBACK_SLICE_MS);
  });
});
