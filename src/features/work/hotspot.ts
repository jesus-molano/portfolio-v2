/**
 * Boards are links that cannot be clicked by accident. Each board has a
 * hotspot over its projected quad; a board must be armed (a real pointer
 * move, a first tap or keyboard focus on its chip) before a click opens
 * it. Pure: the stage feeds it events and acts on the result.
 */

export type Ndc = readonly [number, number];

export type ArmVia = "pointer" | "touch" | "focus";

export type ArmState = { armed: boolean; armedAt: number; via: ArmVia | null };

export type ArmEvent =
  | { type: "pointermove"; overQuad: boolean; resting: boolean }
  | { type: "tap"; pointerType: string; overQuad: boolean; heldMs: number; at: number }
  | { type: "focus"; at: number }
  | { type: "blur" }
  | { type: "stopChanged" }
  | { type: "tick"; at: number };

export type ArmAction = "none" | "arm" | "open";

export const ARM = {
  /** A touch arming lasts this long (ms); a second tap within it opens. */
  touchMs: 4000,
  /** A press longer than this is a long press (the radio wheel), not a tap. */
  longPressMs: 400,
  /** A board smaller than this share of the viewport is too small to aim at. */
  minArea: 0.03,
  /** A board turned further from the camera than this (cosine) is not a target. */
  minFacing: 0.35,
} as const;

export const DISARMED: ArmState = { armed: false, armedAt: Number.NEGATIVE_INFINITY, via: null };

/** One step of the arming state machine. */
export function stepArm(state: ArmState, event: ArmEvent): { state: ArmState; action: ArmAction } {
  switch (event.type) {
    case "pointermove":
      if (event.overQuad && !event.resting) {
        if (state.armed) return { state, action: "none" };
        return { state: { armed: true, armedAt: 0, via: "pointer" }, action: "arm" };
      }
      if (!event.overQuad && state.via === "pointer") return { state: DISARMED, action: "none" };
      return { state, action: "none" };
    case "tap": {
      if (event.heldMs > ARM.longPressMs) return { state, action: "none" };
      if (!event.overQuad) return { state: state.via === "focus" ? state : DISARMED, action: "none" };
      if (event.pointerType === "touch") {
        if (state.armed && state.via === "touch" && event.at - state.armedAt <= ARM.touchMs) {
          return { state, action: "open" };
        }
        return { state: { armed: true, armedAt: event.at, via: "touch" }, action: "arm" };
      }
      if (state.armed) return { state, action: "open" };
      return { state: { armed: true, armedAt: event.at, via: "pointer" }, action: "arm" };
    }
    case "focus":
      return { state: { armed: true, armedAt: event.at, via: "focus" }, action: state.armed ? "none" : "arm" };
    case "blur":
      return { state: state.via === "focus" ? DISARMED : state, action: "none" };
    case "stopChanged":
      return { state: DISARMED, action: "none" };
    case "tick":
      if (state.via === "touch" && event.at - state.armedAt > ARM.touchMs) return { state: DISARMED, action: "none" };
      return { state, action: "none" };
  }
}

/** Share of the viewport a quad in normalised device coordinates covers (shoelace). */
export function quadArea(ndc: readonly Ndc[]): number {
  let twice = 0;
  for (let i = 0; i < ndc.length; i += 1) {
    const [x0, y0] = ndc[i];
    const [x1, y1] = ndc[(i + 1) % ndc.length];
    twice += x0 * y1 - x1 * y0;
  }
  // NDC spans 2 x 2.
  return Math.abs(twice) / 2 / 4;
}

/** A board can be aimed at: big enough on screen and turned toward the camera. */
export function quadIsTargetable(ndc: readonly Ndc[], facing: number): boolean {
  return facing >= ARM.minFacing && quadArea(ndc) >= ARM.minArea;
}

/** CSS clip-path for a quad in normalised device coordinates (y up), in viewport percentages. */
export function quadClipPath(ndc: readonly Ndc[]): string {
  const points = ndc.map(([x, y]) => `${(((x + 1) / 2) * 100).toFixed(2)}% ${(((1 - y) / 2) * 100).toFixed(2)}%`);
  return `polygon(${points.join(", ")})`;
}

/** Whether a point (NDC) lies inside a convex quad, either winding. */
export function insideQuad(ndc: readonly Ndc[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < ndc.length; i += 1) {
    const [x0, y0] = ndc[i];
    const [x1, y1] = ndc[(i + 1) % ndc.length];
    const cross = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
