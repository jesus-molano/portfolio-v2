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
 * 3. touchend inertia, sign(delta) * |velocity|^touchInertiaExponent, is
 *    computed after the callback from Lenis' own velocity: the gate
 *    zeroes the deltas (2) and glides the same law itself, from the
 *    finger's own speed (gate.ts steadyFling), into the wall at most.
 *    That speed is read from the touchmove's deltas, which Lenis takes
 *    from the touch's clientX and clientY against the move before: a move
 *    with both deltas 0 did not move (on iOS, a force or contact change),
 *    and is no sample of the finger's speed there (gate.ts strokeMove).
 * And HeroStage's frame (gate.ts) on two more:
 * 4. Lenis can miss a native move of the page: it drops the scroll event
 *    after its own landing (preventNextNativeScrollEvent, cleared on the
 *    next frame) and ignores native scrolls while it glides. So the frame
 *    reads the page's own offset and sets Lenis' `animatedScroll` and
 *    `targetScroll` (public fields) to it when Lenis missed one;
 * 5. `scrollTo` returns early, doing nothing, when asked for its own
 *    `targetScroll`: before pulling the page back to the wall, the stage
 *    sets both fields to where the page is, so the pull never is a no-op.
 * And SmoothScroll's touch gate on one more:
 * 6. a touchmove Lenis drops (no vertical delta: a still finger whose
 *    moves Chrome coalesced, a pressure change, a sideways sway; or one
 *    the gate holds) returns before Lenis cancels it, and a cancelable
 *    touchmove nobody cancels hands the rest of the stroke to the
 *    browser's own scrolling, past every gate. So the gate cancels those
 *    itself, wherever Lenis drives the stroke: not under
 *    `data-lenis-prevent`, not while iOS drags a selection handle. Below
 *    the hero (gate.ts browserStroke) the gate relies on the same drop the
 *    other way: it returns false for every move and the lift, so the
 *    browser scrolls the stroke, and lets the touchstart through, which
 *    Lenis takes for a tap that stops its own glide (`reset()`).
 * And the page's one way of moving (lib/navigate.ts) on one more:
 * 7. `resize()` re-measures the page and stands Lenis where the page is,
 *    and `reset()` (public at runtime, private in its types) also stops
 *    any glide; then the page is moved natively and Lenis' public
 *    `animatedScroll` and `targetScroll` set to where it landed. Lenis' own
 *    immediate `scrollTo` would drop the next native scroll event (4).
 * Upgrading Lenis fails this test until someone re-checks all seven.
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

  it("can still miss a native scroll, and still ignores a scrollTo to its own target", () => {
    const source = readFileSync(new URL("dist/lenis.mjs", root), "utf8");
    const native = source.slice(source.indexOf("onNativeScroll = () => {"), source.indexOf("reset() {"));
    expect(native).toContain("if (this._preventNextNativeScrollEvent) {");
    expect(native).toContain('if (this.isScrolling === false || this.isScrolling === "native") {');
    expect(native).toContain("this.animatedScroll = this.targetScroll = this.actualScroll;");
    const scrollTo = source.slice(source.indexOf("scrollTo(_target, {"), source.indexOf("preventNextNativeScrollEvent() {"));
    expect(scrollTo).toContain("if (target === this.targetScroll) {");
    expect(scrollTo).toContain("this.animatedScroll = this.targetScroll = target;");
  });

  it("still drops a touchmove without vertical delta before it cancels it, and leaves the same strokes alone", () => {
    const source = readFileSync(new URL("dist/lenis.mjs", root), "utf8");
    const start = source.indexOf("onVirtualScroll = (data) => {");
    const body = source.slice(start, source.indexOf("resize()", start));
    const unknown = body.indexOf('this.options.gestureOrientation === "vertical" && deltaY === 0');
    const drop = body.indexOf("if (isClickOrTap || isUnknownGesture) return;");
    const cancel = body.indexOf("if (event.cancelable) event.preventDefault();");
    expect(unknown).toBeGreaterThan(0);
    expect(drop).toBeGreaterThan(unknown);
    expect(cancel).toBeGreaterThan(drop);
    // Its touch listeners can cancel a move...
    expect(source).toContain("const listenerOptions = { passive: false };");
    expect(source).toContain('this.element.addEventListener("touchmove", this.onTouchMove, listenerOptions);');
    // ...and the strokes it leaves to the browser, which the gate leaves alone too.
    expect(body).toContain("if (this._isDraggingSelection) {");
    for (const attribute of ["data-lenis-prevent", "data-lenis-prevent-vertical", "data-lenis-prevent-horizontal", "data-lenis-prevent-touch"]) {
      expect(body).toContain(`node.hasAttribute?.("${attribute}")`);
    }
    expect(body).toContain("composedPath = composedPath.slice(0, composedPath.indexOf(this.rootElement));");
    // A finger landing stops Lenis' glide (a stroke left to the browser must not fight it).
    const tapStops = body.indexOf('this.options.syncTouch && isTouch && event.type === "touchstart" && isClickOrTap');
    expect(tapStops).toBeGreaterThan(body.indexOf("const isClickOrTap"));
    expect(body.slice(tapStops, tapStops + 200)).toContain("this.reset();");
  });

  it("still reads a touchmove's deltas from where the finger was at the move before", () => {
    const source = readFileSync(new URL("dist/lenis.mjs", root), "utf8");
    const move = source.slice(source.indexOf("onTouchMove = (event) => {"), source.indexOf("onTouchEnd = (event) => {"));
    expect(move).toContain("const deltaX = -(clientX - this.touchStart.x) * this.options.touchMultiplier;");
    expect(move).toContain("const deltaY = -(clientY - this.touchStart.y) * this.options.touchMultiplier;");
    expect(move).toContain("this.touchStart.y = clientY;");
  });

  it("still re-measures and stands where the page is on resize() and reset(), which also stops a glide", () => {
    const source = readFileSync(new URL("dist/lenis.mjs", root), "utf8");
    const resize = source.slice(source.indexOf("\tresize() {"), source.indexOf("\temit() {"));
    expect(resize).toContain("this.dimensions.resize();");
    expect(resize).toContain("this.animatedScroll = this.targetScroll = this.actualScroll;");
    const reset = source.slice(source.indexOf("\treset() {"), source.indexOf("\tstart() {"));
    expect(reset).toContain("this.animatedScroll = this.targetScroll = this.actualScroll;");
    expect(reset).toContain("this.animate.stop();");
    // A glide (back to top) still runs while the radio holds the scroll, when forced.
    const scrollTo = source.slice(source.indexOf("scrollTo(_target, {"), source.indexOf("preventNextNativeScrollEvent() {"));
    expect(scrollTo).toContain("if ((this.isStopped || this.isLocked) && !force) return;");
  });
});
