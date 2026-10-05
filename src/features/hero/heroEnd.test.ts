import { describe, expect, it } from "vitest";
import { getHeroEnd, registerHeroEnd } from "./heroEnd";

describe("the hero's cut, for deep links", () => {
  it("is there while a stage has it registered, and gone after", () => {
    const end = { section: {} as HTMLElement, cut: () => {} };
    const unregister = registerHeroEnd(end);
    expect(getHeroEnd()).toBe(end);
    unregister();
    expect(getHeroEnd()).toBeNull();
  });

  it("keeps a newer stage's cut when an older one unregisters late (a re-run)", () => {
    const old = { section: {} as HTMLElement, cut: () => {} };
    const fresh = { section: {} as HTMLElement, cut: () => {} };
    const unregisterOld = registerHeroEnd(old);
    const unregisterFresh = registerHeroEnd(fresh);
    unregisterOld();
    expect(getHeroEnd()).toBe(fresh);
    unregisterFresh();
  });
});
