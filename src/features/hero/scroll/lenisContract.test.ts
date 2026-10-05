import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * Lenis is pinned on purpose. SmoothScroll's gate (gateInput) and
 * HeroStage.gate() rely on three internals of Lenis 1.3.26
 * (dist/lenis.mjs, onVirtualScroll):
 * 1. `options.virtualScroll` runs before Lenis' own ctrlKey and isStopped
 *    checks, so the gate sees (and filters) pinch zoom first;
 * 2. Lenis reads deltaX and deltaY from the callback's `data` after it
 *    returns, so trimming them trims the scroll, and zero deltas return
 *    early as for a tap (no touchend inertia);
 * 3. touchend inertia, sign(delta) * |velocity|^1.7, is computed after the
 *    callback from Lenis' own velocity, so it cannot be trimmed there and
 *    HeroStage.gate() retargets it into the wall.
 * Upgrading Lenis fails this test until someone re-checks all three.
 */
describe("Lenis contract", () => {
  const root = new URL("../../../../node_modules/lenis/", import.meta.url);

  it("is exactly the version the gate was verified against", () => {
    const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8")) as { version: string };
    expect(pkg.version).toBe("1.3.26");
  });

  it("still runs virtualScroll first and reads the deltas after it", () => {
    const source = readFileSync(new URL("dist/lenis.mjs", root), "utf8");
    const start = source.indexOf("onVirtualScroll = (data) => {");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, source.indexOf("resize()", start));
    const callback = body.indexOf("this.options.virtualScroll(data) === false) return;");
    const destructure = body.indexOf("const { deltaX, deltaY, event } = data;");
    const ctrl = body.indexOf("if (event.ctrlKey) return;");
    const tap = body.indexOf("const isClickOrTap = deltaX === 0 && deltaY === 0;");
    const inertia = body.indexOf("Math.abs(this.velocity) ** this.options.touchInertiaExponent");
    expect(callback).toBeGreaterThan(0);
    expect(destructure).toBeGreaterThan(callback);
    expect(ctrl).toBeGreaterThan(destructure);
    expect(tap).toBeGreaterThan(destructure);
    expect(inertia).toBeGreaterThan(tap);
  });
});
