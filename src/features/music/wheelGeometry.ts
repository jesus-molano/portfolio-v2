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
 * A phone on its side (a viewport wider than tall and at most 500 px tall,
 * the `@media` in RadioWheel.module.css): the hint stands beside the wheel,
 * a column `hint` px wide, `gap` px off it, and the wheel takes the height.
 * With the hint under it, a 360 px tall phone got a 216 px wheel: badges
 * under 44 px and a centre whose type ran past the rim.
 */
export const SIDE_HINT = { maxHeight: 500, hint: 208, gap: 24 } as const;

/**
 * The wheel's diameter in px for a viewport: the same as `--size` on
 * `.wheel` in RadioWheel.module.css (600 px at most, a 12 px margin each
 * side, 9rem of height left for the hint; on a phone on its side 1rem above
 * and below, the hint beside it).
 */
export function wheelSize(viewportWidth: number, viewportHeight: number): number {
  if (viewportWidth > viewportHeight && viewportHeight <= SIDE_HINT.maxHeight) {
    return Math.min(600, viewportHeight - 32, viewportWidth - 24 - SIDE_HINT.gap - SIDE_HINT.hint);
  }
  return Math.min(600, viewportWidth - 24, viewportHeight - 144);
}

/**
 * The centre disc's radius as a fraction of the wheel's diameter: the
 * circle RadioWheel draws inside the ring (`RING.inner - 3` of its 200).
 */
export const DISC = WHEEL_LAYOUT.inner - 3 / 200;

/** A wheel this many px across or less (a phone's) sets its centre in CENTRE_TYPE. */
export const SMALL_WHEEL = 400;

/**
 * The centre's type on a small wheel, as fractions of its diameter
 * (RadioWheel passes them to the CSS as `--centre-*-k`). It scales with the
 * disc, so every phone wraps the centre the same way and keeps the same
 * margin to the rim. With a big wheel's rem floors a 336 px wheel got
 * nearly a desktop's type, and a station on air (frequency, name, two
 * lines of tagline, the track and its artist, the status) ran past the
 * rim. One name size for every station: the largest that keeps WITNESS ME
 * and ONE LOUDER over the longest track on air 4 px inside the disc.
 */
export const CENTRE_TYPE = {
  frequency: 0.0315,
  name: 0.04,
  tagline: 0.032,
  track: 0.0277,
  status: 0.0259,
} as const;

export type CentreRow = keyof typeof CENTRE_TYPE;

/** The centre's font sizes in px on a small wheel `size` px across. */
export function centreType(size: number): Record<CentreRow, number> {
  const rows = Object.keys(CENTRE_TYPE) as CentreRow[];
  return Object.fromEntries(rows.map((row) => [row, CENTRE_TYPE[row] * size])) as Record<CentreRow, number>;
}

/**
 * The longest text, in characters, the small centre was measured with in
 * the browser (`tools/capture/radiowheel.mjs`, every sector, track on air
 * and language): a longer name, tagline or credit is measured again before
 * it ships. `off` is radio off's name, alone in the centre.
 */
export const CENTRE_BUDGET = { name: 10, off: 13, tagline: 41, trackTitle: 31, trackArtist: 15 } as const;

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
