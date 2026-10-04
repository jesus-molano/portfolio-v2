import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSceneLoading,
  getServerSceneLoading,
  markEntered,
  markSceneReady,
  reportSceneProgress,
  resetSceneLoading,
  subscribeSceneLoading,
} from "./sceneLoading";

describe("sceneLoading", () => {
  beforeEach(() => resetSceneLoading());

  it("starts empty, on the server and in the browser", () => {
    expect(getSceneLoading()).toEqual({ progress: 0, ready: false, entered: false });
    expect(getServerSceneLoading()).toEqual({ progress: 0, ready: false, entered: false });
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
