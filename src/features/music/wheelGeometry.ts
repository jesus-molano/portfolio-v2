/**
 * Drawing helpers for the radio wheel's SVG, in a coordinate system centred
 * on the wheel with y down, angles in degrees clockwise from 12 o'clock
 * (the convention of stations.ts).
 */

export type Point = { x: number; y: number };

/** Rounds for compact, stable SVG path strings. */
function round(value: number): number {
  return Math.round(value * 100) / 100 + 0;
}

export function polarPoint(angle: number, radius: number): Point {
  const radians = (angle * Math.PI) / 180;
  return { x: round(radius * Math.sin(radians)), y: round(-radius * Math.cos(radians)) };
}

/**
 * SVG path of one wedge of a ring: sector `index` of `count`, centred on
 * `start + index * 360 / count`, between `inner` and `outer` radius, with
 * `gap` degrees left empty on each side.
 */
export function ringSectorPath(
  index: number,
  count: number,
  inner: number,
  outer: number,
  gap: number,
  start: number,
): string {
  const step = 360 / count;
  const centre = start + index * step;
  const from = centre - step / 2 + gap / 2;
  const to = centre + step / 2 - gap / 2;
  const large = to - from > 180 ? 1 : 0;
  const a = polarPoint(from, outer);
  const b = polarPoint(to, outer);
  const c = polarPoint(to, inner);
  const d = polarPoint(from, inner);
  return [
    `M${a.x} ${a.y}`,
    `A${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y}`,
    `L${c.x} ${c.y}`,
    `A${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y}`,
    "Z",
  ].join(" ");
}

/**
 * SVG path of the arc along one wedge's edge at `radius`: sector `index` of
 * `count`, with `gap` degrees left empty on each side, drawn clockwise. The
 * wheel lights the rim of the station on air with it.
 */
export function sectorArcPath(index: number, count: number, radius: number, gap: number, start: number): string {
  const step = 360 / count;
  const centre = start + index * step;
  const from = polarPoint(centre - step / 2 + gap / 2, radius);
  const to = polarPoint(centre + step / 2 - gap / 2, radius);
  const large = step - gap > 180 ? 1 : 0;
  return `M${from.x} ${from.y} A${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y}`;
}

/**
 * Turns `previous` (any number of degrees, unwrapped) by the shortest way
 * to point at `next`, so a CSS rotation never spins the long way round.
 */
export function unwrapAngle(previous: number, next: number): number {
  const delta = ((((next - previous) % 360) + 540) % 360) - 180;
  return previous + delta;
}

/**
 * The wheel's proportions, as fractions of its diameter: the SVG draws the
 * ring from them and RadioWheel passes them to the CSS, which sets the
 * badges on them.
 */
export const WHEEL_LAYOUT = {
  /** Radius of the ring's inner edge (the centre disc sits inside). */
  inner: 0.25,
  /** Radius of the ring's outer edge. */
  outer: 0.495,
  /** Radius of the circle the badge centres sit on. */
  orbit: 0.372,
  /** Badge diameter. */
  badge: 0.2,
  /** Empty degrees between two wedges. */
  gap: 1.6,
} as const;

/**
 * The wheel's diameter in px for a viewport: the same as `--size` on
 * `.wheel` in RadioWheel.module.css (600 px at most, a 12 px margin each
 * side, 9rem of height left for the hint).
 */
export function wheelSize(viewportWidth: number, viewportHeight: number): number {
  return Math.min(600, viewportWidth - 24, viewportHeight - 144);
}

/**
 * What one of `count` sectors measures on a wheel `size` px across: the
 * badge, the wedge's arc at its narrowest (inner) edge, and the clear space
 * between two neighbouring badges. Touch targets need 44 px.
 */
export function sectorSizes(
  size: number,
  count: number,
  layout: typeof WHEEL_LAYOUT = WHEEL_LAYOUT,
): { badge: number; arc: number; clearance: number } {
  const step = (2 * Math.PI) / count;
  const gap = (layout.gap * Math.PI) / 180;
  const badge = layout.badge * size;
  return {
    badge,
    arc: layout.inner * size * (step - gap),
    clearance: 2 * layout.orbit * size * Math.sin(step / 2) - badge,
  };
}
