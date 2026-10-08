import { describe, expect, it } from "vitest";
import { afterContextLoss, CONTEXT_LOSS } from "./contextLoss";

describe("a lost WebGL context", () => {
  it("mounts the scene afresh, then gives up to the page's fallback", () => {
    for (let losses = 1; losses <= CONTEXT_LOSS.retries; losses += 1) expect(afterContextLoss(losses)).toBe("remount");
    expect(afterContextLoss(CONTEXT_LOSS.retries + 1)).toBe("fallback");
    expect(afterContextLoss(10)).toBe("fallback");
  });
});
