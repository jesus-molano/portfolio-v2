/**
 * The police helicopter's searchlight over the Logixs wall (stop 4, the
 * wall of bills under «PROHIBIDO FIJAR CARTELES»): armed, a helicopter
 * hovering over the street hunts the bill sticker along the wall. Pure: the
 * set steps it once a frame and hands the shader where the beam comes from,
 * where it points and how bright it is.
 *
 * - It follows the pointer's place on the board (`pointer`, shares of the
 *   board from its top left, hotspot.ts `quadUv`) through a critically
 *   damped spring: a little behind, never past it, never bouncing.
 * - With no pointer (armed by the chip's keyboard focus, or a first tap) it
 *   settles where the tap landed if it knows it (`tap`), and otherwise
 *   searches on its own: a slow lazy eight over the run of bills, picked up
 *   at the point of the eight nearest where the light is.
 * - The helicopter hovers: the spot drifts a few centimetres (`wobble`) and
 *   the rotor chops the beam a few percent at about 11 Hz (`flicker`).
 * - Armed, it fades in where it is aimed in 0.3 s; disarmed, it fades out
 *   where it is in 0.3 s. It never loops back or restarts on its own.
 * - `still` (reduced motion): no wobble, no flicker, no lag, no search
 *   path; the light rests where it is aimed, or on the run's middle.
 */

/** The board in the set's metres: x from left to right, y from bottom to top, on the wall's plane. */
export type SpotArea = { x0: number; x1: number; y0: number; y1: number };

/** A place on the board in shares of it: u from its left edge, v from its top. */
export type BoardUv = readonly [number, number];

export const SEARCHLIGHT = {
  /** Fade in on arming and out on disarming, seconds. */
  fade: 0.3,
  /** The follow's natural frequency (rad/s), critically damped: 63 % of a jump in about 0.4 s, 95 % in 1.1 s. */
  follow: 4.2,
  /** The spot's radius across the beam where it meets the wall, metres; the wall's tilt to the beam stretches it upright. */
  radius: 0.92,
  /**
   * Where the helicopter hovers from the spot: a little to the right, high
   * over the street and out over it toward the camera, so the beam meets the
   * wall at about 40 degrees from below its normal and the spot is about a
   * third taller than wide. It drifts after the spot at a quarter of its
   * travel, so the beam's slant changes as it hunts.
   */
  hover: { x: 2.2, y: 13.5, z: 16, follow: 0.25 },
  /** The hover's drift of the spot, metres per axis: two slow incommensurate sines each. */
  wobble: { x: 0.05, y: 0.035, hz: [0.21, 0.37, 0.29, 0.53] },
  /** The helicopter itself bobs (metres), which tilts the beam a touch. */
  bob: { x: 0.35, y: 0.25, hz: [0.13, 0.19] },
  /** The rotor's chop: a share of the light, at its blade-pass frequency. */
  flicker: { depth: 0.035, hz: 11.3 },
  /**
   * The search with no pointer: a lazy eight (x = sin φ, y = sin 2φ) over
   * the run of bills, centre and half-extents in metres, one lap in
   * `period` seconds (about 2 m/s across the middle: a lazy hunt).
   */
  search: { cx: -2.1, cy: 2.5, ax: 4.6, ay: 0.8, period: 14 },
  /** A frame longer than this (s) is taken as this: a hitch never throws the light. */
  maxDt: 0.25,
} as const;

export type Searchlight = {
  /** Where the light is aimed on the wall (metres, before the hover's drift). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The fade, 0..1, linear in time; `level` eases it. */
  fade: number;
  /** Whether the light is up (or fading): off, the next arming lands it on its aim at once. */
  on: boolean;
  /** The search's phase (radians along the eight), advanced only while searching. */
  phase: number;
  /** Whether the last frame searched: entering the search picks the eight up nearest the light. */
  searching: boolean;
  /** Its own clock, seconds: the hover and the rotor read it. */
  t: number;
};

export function newSearchlight(): Searchlight {
  return { x: 0, y: 0, vx: 0, vy: 0, fade: 0, on: false, phase: 0, searching: false, t: 0 };
}

export type SpotInput = {
  armed: boolean;
  /** The pointer over the board, or null (away, or a touch screen). */
  pointer: BoardUv | null;
  /** Where the tap that armed it landed, or null. */
  tap: BoardUv | null;
  dt: number;
  still?: boolean;
};

/** A place on the board in the wall's metres. */
export function boardPoint(area: SpotArea, [u, v]: BoardUv): [number, number] {
  return [area.x0 + u * (area.x1 - area.x0), area.y1 - v * (area.y1 - area.y0)];
}

/** The lazy eight at a phase, metres. */
export function searchPath(phase: number): [number, number] {
  const s = SEARCHLIGHT.search;
  return [s.cx + s.ax * Math.sin(phase), s.cy + s.ay * Math.sin(2 * phase)];
}

/** The phase of the eight nearest a point: where a search takes over from the pointer. */
export function nearestPhase(x: number, y: number): number {
  const steps = 96;
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < steps; i += 1) {
    const phase = (i / steps) * Math.PI * 2;
    const [px, py] = searchPath(phase);
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = phase;
    }
  }
  return best;
}

/** One exact step of a critically damped spring toward a still target (any dt, never overshoots from rest). */
export function springStep(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const e = x - target;
  const j = v + omega * e;
  const decay = Math.exp(-omega * dt);
  return [target + (e + j * dt) * decay, (v - omega * j * dt) * decay];
}

/** Where the light wants to be this frame (metres), before the spring. */
function aimFor(light: Searchlight, area: SpotArea, input: SpotInput, dt: number): [number, number] {
  if (!input.armed) {
    // Going out: it fades where it is.
    light.searching = false;
    return [light.x, light.y];
  }
  if (input.pointer) {
    light.searching = false;
    return boardPoint(area, input.pointer);
  }
  if (input.tap) {
    light.searching = false;
    return boardPoint(area, input.tap);
  }
  if (input.still) {
    light.searching = false;
    return [SEARCHLIGHT.search.cx, SEARCHLIGHT.search.cy];
  }
  if (!light.searching) {
    light.searching = true;
    light.phase = light.on ? nearestPhase(light.x, light.y) : 0;
  }
  light.phase = (light.phase + (dt * Math.PI * 2) / SEARCHLIGHT.search.period) % (Math.PI * 2);
  return searchPath(light.phase);
}

/** Steps the light one frame. */
export function stepSearchlight(light: Searchlight, area: SpotArea, input: SpotInput): void {
  const dt = Math.min(Math.max(input.dt, 0), SEARCHLIGHT.maxDt);
  light.t += dt;
  if (!input.armed && !light.on) {
    light.searching = false;
    return;
  }
  const [tx, ty] = aimFor(light, area, input, dt);
  if (!light.on || input.still) {
    // Off until now (or still): it comes up where it is aimed, never sweeping in from where it last went out.
    light.x = tx;
    light.y = ty;
    light.vx = 0;
    light.vy = 0;
    light.on = true;
  } else {
    [light.x, light.vx] = springStep(light.x, light.vx, tx, SEARCHLIGHT.follow, dt);
    [light.y, light.vy] = springStep(light.y, light.vy, ty, SEARCHLIGHT.follow, dt);
  }
  const rate = dt / SEARCHLIGHT.fade;
  light.fade = input.armed ? Math.min(1, light.fade + rate) : Math.max(0, light.fade - rate);
  if (light.fade === 0 && !input.armed) {
    light.on = false;
    light.searching = false;
  }
}

/** The hover's drift of the spot at a time, metres. */
export function wobble(t: number): [number, number] {
  const w = SEARCHLIGHT.wobble;
  const [a, b, c, d] = w.hz;
  const tau = Math.PI * 2;
  return [
    w.x * (0.65 * Math.sin(tau * a * t) + 0.35 * Math.sin(tau * b * t + 1.3)),
    w.y * (0.6 * Math.sin(tau * c * t + 0.7) + 0.4 * Math.sin(tau * d * t + 2.1)),
  ];
}

/** The rotor's chop: a multiplier on the light, within 1 - depth .. 1. */
export function flicker(t: number): number {
  const f = SEARCHLIGHT.flicker;
  const chop = 0.5 + 0.5 * Math.sin(Math.PI * 2 * f.hz * t);
  return 1 - f.depth * chop * chop;
}

export type SpotBeam = {
  /** The helicopter's lamp, metres in the set's frame. */
  from: [number, number, number];
  /** Where the beam's axis meets the wall. */
  to: [number, number, number];
  /** The light's strength, 0..1: the eased fade times the rotor's chop. */
  level: number;
  /** The cone's half-angle as a tangent: `radius` across the beam at the wall. */
  tan: number;
};

/** The beam this frame: the lamp over the street, the spot on the wall at `wallZ`, the level. */
export function spotBeam(light: Searchlight, wallZ: number, still = false): SpotBeam {
  const [dx, dy] = still ? [0, 0] : wobble(light.t);
  const h = SEARCHLIGHT.hover;
  const b = SEARCHLIGHT.bob;
  const tau = Math.PI * 2;
  const bobX = still ? 0 : b.x * Math.sin(tau * b.hz[0] * light.t + 0.4);
  const bobY = still ? 0 : b.y * Math.sin(tau * b.hz[1] * light.t + 1.9);
  const to: [number, number, number] = [light.x + dx, light.y + dy, wallZ];
  const from: [number, number, number] = [
    SEARCHLIGHT.search.cx + (light.x - SEARCHLIGHT.search.cx) * h.follow + h.x + bobX,
    light.y + h.y + bobY,
    wallZ + h.z,
  ];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const eased = light.fade * light.fade * (3 - 2 * light.fade);
  return {
    from,
    to,
    level: eased * (still ? 1 : flicker(light.t)),
    tan: SEARCHLIGHT.radius / Math.max(length, 1e-3),
  };
}
