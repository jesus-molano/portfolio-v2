import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSceneLoading,
  getServerSceneLoading,
  markEntered,
  markSceneReady,
  markOnScreen,
  markOnStage,
  markQuiet,
  markSettled,
  reportSceneProgress,
  resetSceneLoading,
  subscribeSceneLoading,
} from "./sceneLoading";

describe("sceneLoading", () => {
  beforeEach(() => resetSceneLoading());

  it("starts empty, on the server and in the browser", () => {
    const empty = {
      progress: 0,
      ready: false,
      entered: false,
      enteredAt: Number.NEGATIVE_INFINITY,
      enteredVia: null,
      settled: false,
      quiet: true,
      onScreen: true,
      onStage: true,
    };
    expect(getSceneLoading()).toEqual(empty);
    expect(getServerSceneLoading()).toEqual(empty);
  });

  it("tells its subscribers only when the hero's quiet changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSceneLoading(listener);
    markQuiet(true);
    expect(listener).not.toHaveBeenCalled();
    markQuiet(false);
    markQuiet(false);
    expect(getSceneLoading().quiet).toBe(false);
    markQuiet(true);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("says whether the hero is up behind the side hints, telling its subscribers only on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSceneLoading(listener);
    markOnScreen(true);
    expect(listener).not.toHaveBeenCalled();
    markOnScreen(false);
    markOnScreen(false);
    expect(getSceneLoading().onScreen).toBe(false);
    markOnScreen(true);
    expect(getSceneLoading().onScreen).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("says whether the hero is on stage (the film not over), telling its subscribers only on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSceneLoading(listener);
    markOnStage(true);
    expect(listener).not.toHaveBeenCalled();
    markOnStage(false);
    markOnStage(false);
    expect(getSceneLoading().onStage).toBe(false);
    markOnStage(true);
    expect(getSceneLoading().onStage).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("settles only once she has entered, and tells its subscribers once", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSceneLoading(listener);
    markSettled();
    expect(getSceneLoading().settled).toBe(false);
    markEntered("pointer", 10);
    listener.mockClear();
    markSettled();
    markSettled();
    expect(getSceneLoading().settled).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("records how and when the visitor entered, once", () => {
    markEntered("key", 1234);
    expect(getSceneLoading()).toMatchObject({ entered: true, enteredVia: "key", enteredAt: 1234 });
    markEntered("pointer", 5678);
    expect(getSceneLoading()).toMatchObject({ enteredVia: "key", enteredAt: 1234 });
  });

  it("enters by pointer when no way in is given", () => {
    markEntered();
    expect(getSceneLoading().enteredVia).toBe("pointer");
    expect(Number.isFinite(getSceneLoading().enteredAt)).toBe(true);
  });

  it("only moves progress forward and clamps it to 0..100", () => {
    reportSceneProgress(40);
    reportSceneProgress(20);
    expect(getSceneLoading().progress).toBe(40);
    reportSceneProgress(250);
    expect(getSceneLoading().progress).toBe(100);
  });

  it("jumps to 100 when ready and ignores later progress", () => {
    reportSceneProgress(30);
    markSceneReady();
    reportSceneProgress(60);
    expect(getSceneLoading()).toMatchObject({ progress: 100, ready: true });
  });

  it("notifies subscribers once per real change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSceneLoading(listener);
    reportSceneProgress(10);
    reportSceneProgress(10);
    markSceneReady();
    markSceneReady();
    markEntered();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    markEntered();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("returns a stable snapshot between changes", () => {
    const first = getSceneLoading();
    expect(getSceneLoading()).toBe(first);
    reportSceneProgress(5);
    expect(getSceneLoading()).not.toBe(first);
  });
});
