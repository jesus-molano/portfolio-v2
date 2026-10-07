/**
 * Dante's claw swipe: three scratches raking down and left across the
 * whole screen from just over his head, torn edges, a pink glow and the
 * dark gash in each. Pure geometry for the screen-sized SVG that
 * CharacterSelect.tsx lays over the page (claw marks drawn in the
 * stylesheet's colours); deterministic, so every swipe at one screen size
 * is the same three marks.
 *
 * Plain paths, no SVG filter: the tear is noise baked into the outlines
 * here and the glow is three nested outlines. Torn by fractal noise and a
 * displacement map and glowing through a blur, the screen-sized filters
 * were drawn on the CPU by Safari at three times the pixels, again every
 * frame the reveal moved: an iPhone froze on Dante's strike and only the
 * chip's words came up.
 */

export type ClawMark = {
  /** The stroke's centre line, for the reveal mask (pathLength 1). */
  center: string;
  /** The mark from outside in: the glow (three nested outlines), torn pale edge, pink flesh, the gash, its dark core. */
  glow: string[];
  edge: string;
  flesh: string;
  gash: string;
  core: string;
};

export type Claw = {
  marks: ClawMark[];
  /** The widest mark's width (px). */
  width: number;
};

/** Each layer's width as a share of the mark's own width (the glow from its outer ring in). */
const LAYERS = { glow: [3.6, 2.9, 2.2], edge: 1.5, flesh: 1.26, gash: 1.02, core: 0.42 } as const;

/**
 * The tear (what the filters did): how far an edge is pushed in or out, as
 * a share of the widest mark, and how fine its rags are (cycles a px, two
 * octaves). The pale edge and the flesh share one tear, so the rim follows
 * the wound; the gash is ragged finer.
 */
export const TEAR = {
  edge: { amplitude: 0.21, frequency: 0.045 },
  gash: { amplitude: 0.15, frequency: 0.08 },
  /** Px between the points of a torn outline: a few per rag. */
  step: 4,
} as const;

/** Points along a mark, rounded for a short path. */
function pathOf(points: readonly (readonly [number, number])[], close: boolean): string {
  const text = points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");
  return `M${text}${close ? "Z" : ""}`;
}

/** A deterministic value in [-1, 1] for lattice point `i` of stream `seed`. */
function lattice(seed: number, i: number): number {
  let h = Math.imul(i ^ Math.imul(seed, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Smooth 1D value noise at `x` (lattice units), in [-1, 1]. */
function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return lattice(seed, i) * (1 - s) + lattice(seed, i + 1) * s;
}

/** Two octaves of value noise along an edge, `s` px from its start, in [-1, 1]. */
export function tearNoise(seed: number, s: number, frequency: number): number {
  return (valueNoise(seed, s * frequency) * 2 + valueNoise(seed + 101, s * frequency * 2)) / 3;
}

/**
 * The three marks on a `width` x `height` screen, starting from `from` (his
 * slot's top right on a wide screen; past the screen's right edge on a
 * phone, where they cut across the strips at a steeper angle).
 */
export function clawMarks(width: number, height: number, from: { x: number; y: number }, phone: boolean): Claw {
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const short = Math.min(W, H);
  const angle = ((phone ? 128 : 151) * Math.PI) / 180;
  const length = Math.hypot(W, H) * 1.1;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const gap = short * (phone ? 0.13 : 0.078);
  const widest = short * (phone ? 0.062 : 0.036);
  const marks: ClawMark[] = [];
  for (let k = 0; k < 3; k += 1) {
    const off = (k - 1) * gap;
    // The middle claw leads a little: the paw's longest toe.
    const lead = k === 1 ? -gap * 0.45 : 0;
    const start = { x: from.x + nx * off + dx * lead, y: from.y + ny * off + dy * lead };
    const L = length * (k === 1 ? 1 : k === 0 ? 0.86 : 0.92);
    const bend = 0.07 + (k - 1) * 0.025;
    const markWidth = widest * (k === 1 ? 1 : 0.8);
    // Thin at the tip, full a third of the way in, tapering out as the paw lifts.
    const at = (t: number) => markWidth * Math.sin(Math.PI * Math.min(1, t * 1.12)) ** 0.6 * (1 - t * 0.3);
    /** The centre line in `n` steps, with each point's distance along it (px). */
    const line = (n: number) => {
      const points: { x: number; y: number; t: number; s: number }[] = [];
      for (let i = 0; i <= n; i += 1) {
        const t = i / n;
        const curve = Math.sin(t * Math.PI) * L * bend;
        points.push({ x: start.x + dx * L * t + nx * curve, y: start.y + dy * L * t + ny * curve, t, s: 0 });
        if (i > 0) points[i].s = points[i - 1].s + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      return points;
    };
    const coarse = line(48);
    const fine = line(Math.max(48, Math.ceil(L / TEAR.step)));
    /** One side of the outline at `share` of the mark's width, its edge pushed by `tear` (px at distance s). */
    const side = (points: ReturnType<typeof line>, sign: 1 | -1, share: number, tear?: (s: number) => number) =>
      points.map((p, i) => {
        const next = points[Math.min(points.length - 1, i + 1)];
        const prev = points[Math.max(0, i - 1)];
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const n = Math.hypot(tx, ty) || 1;
        tx /= n;
        ty /= n;
        const half = (at(p.t) * share) / 2;
        // Torn only where the mark is open: the tip and the tail stay sharp.
        const push = tear ? tear(p.s) * Math.min(1, half / (markWidth * 0.25)) : 0;
        const r = Math.max(0, half + push);
        return [p.x - ty * r * sign, p.y + tx * r * sign] as const;
      });
    const outline = (points: ReturnType<typeof line>, share: number, tear?: (sign: 1 | -1) => (s: number) => number) =>
      pathOf([...side(points, 1, share, tear?.(1)), ...side(points, -1, share, tear?.(-1)).reverse()], true);
    // Each side of each mark tears its own way; the edge and the flesh share it.
    const torn = (amplitude: number, frequency: number, salt: number) => (sign: 1 | -1) => {
      const seed = k * 10 + (sign > 0 ? 1 : 2) + salt;
      return (s: number) => tearNoise(seed, s, frequency) * widest * amplitude;
    };
    const edgeTear = torn(TEAR.edge.amplitude, TEAR.edge.frequency, 0);
    const gashTear = torn(TEAR.gash.amplitude, TEAR.gash.frequency, 50);
    marks.push({
      center: pathOf(
        coarse.map((p) => [p.x, p.y] as const),
        false,
      ),
      glow: LAYERS.glow.map((share) => outline(coarse, share)),
      edge: outline(fine, LAYERS.edge, edgeTear),
      flesh: outline(fine, LAYERS.flesh, edgeTear),
      gash: outline(fine, LAYERS.gash, gashTear),
      core: outline(coarse, LAYERS.core),
    });
  }
  return { marks, width: widest };
}

/**
 * Where the swipe starts, from Dante himself on the screen (his render's
 * box in viewport px): up and to the right of his head on a wide screen,
 * a third of the screen over it, so the paw rakes clear of his chip and
 * across the line-up; past the screen's right edge on a phone.
 */
export function clawStart(cat: { left: number; top: number; width: number; height: number }, screen: { width: number; height: number }, phone: boolean) {
  const x = phone ? screen.width * 1.02 : Math.min(screen.width * 0.97, cat.left + cat.width + screen.width * 0.12);
  const y = Math.max(screen.height * 0.03, cat.top - (phone ? 0.05 * cat.height : screen.height * 0.35));
  return { x, y };
}

/** The swipe's timing (ms): the paw's wind-up, the tear, how long the marks stay, their fade. */
export const CLAW_TIMING = { lead: 150, rake: 150, stagger: 45, hold: 1300, out: 520, shake: 420, reducedHold: 1800 } as const;
