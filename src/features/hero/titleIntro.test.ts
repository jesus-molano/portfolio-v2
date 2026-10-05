import { describe, expect, it, vi } from "vitest";
import { markTitleIntroDone, registerTitleIntro, titleIntro } from "./titleIntro";

describe("titleIntro", () => {
  it("is idle until the title registers its reveal", () => {
    expect(titleIntro.done).toBe(false);
    expect(titleIntro.progress()).toBe(0);
    expect(() => titleIntro.hurry()).not.toThrow();
  });

  it("hands the reveal over and takes it back on cleanup", () => {
    const hurry = vi.fn();
    const complete = vi.fn();
    const cleanup = registerTitleIntro({ progress: () => 0.4, hurry, complete });
    expect(titleIntro.progress()).toBe(0.4);
    titleIntro.hurry();
    titleIntro.complete();
    expect(hurry).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    markTitleIntroDone();
    expect(titleIntro.done).toBe(true);
    cleanup();
    expect(titleIntro.done).toBe(false);
    expect(titleIntro.progress()).toBe(0);
  });

  it("starts done when there is no reveal (reduced motion)", () => {
    const cleanup = registerTitleIntro({ progress: () => 1, hurry: () => {}, complete: () => {} }, true);
    expect(titleIntro.done).toBe(true);
    cleanup();
  });
});
