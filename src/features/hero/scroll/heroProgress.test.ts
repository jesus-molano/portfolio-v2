import { beforeEach, describe, expect, it } from "vitest";
import { heroFeedback, recordInput, resetInput, scrollGate, scrollInput } from "./heroProgress";
import { meterRate } from "./throttle";

describe("recordInput", () => {
  beforeEach(() => resetInput());

  it("records forward input, its source and how hard she pushes", () => {
    recordInput(100, "wheel", 1000, 900);
    expect(scrollInput).toMatchObject({ at: 1000, forwardAt: 1000, source: "wheel" });
    expect(scrollInput.backwardAt).toBe(Number.NEGATIVE_INFINITY);
    expect(meterRate(scrollInput.meter, 1)).toBeGreaterThan(0);
  });

  it("records backward input without feeding the throttle", () => {
    recordInput(-100, "touch", 2000, 900);
    expect(scrollInput).toMatchObject({ at: 2000, backwardAt: 2000, source: "touch" });
    expect(scrollInput.forwardAt).toBe(Number.NEGATIVE_INFINITY);
    expect(meterRate(scrollInput.meter, 2)).toBe(0);
  });

  it("counts a zero step as input that goes nowhere", () => {
    recordInput(0, "key", 3000, 900);
    expect(scrollInput).toMatchObject({ at: 3000, source: "key" });
    expect(scrollInput.forwardAt).toBe(Number.NEGATIVE_INFINITY);
    expect(scrollInput.backwardAt).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("resetInput", () => {
  it("forgets every input, the held pressure and the pace", () => {
    recordInput(300, "wheel", 1000, 900);
    scrollGate.pressure = 40;
    scrollGate.touching = true;
    heroFeedback.pace = 1.8;
    resetInput();
    expect(scrollInput.source).toBeNull();
    expect(scrollInput.at).toBe(Number.NEGATIVE_INFINITY);
    expect(scrollInput.meter.rate).toBe(0);
    expect(scrollGate.pressure).toBe(0);
    expect(scrollGate.touching).toBe(false);
    expect(heroFeedback.pace).toBe(1);
  });
});
