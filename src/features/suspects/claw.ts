/**
 * Dante's claw swipe: three scratches raking down and left across the
 * whole screen from just over his head, torn edges, a pink glow and the
 * dark gash in each. Pure geometry for the screen-sized SVG that
 * CharacterSelect.tsx lays over the page (claw marks drawn in the
 * stylesheet's colours); deterministic, so every swipe at one screen size
 * is the same three marks.
 */

export type ClawMark = {
  /** The stroke's centre line, for the reveal mask (pathLength 1). */
  center: string;
  /** The mark from outside in: glow, torn pale edge, pink flesh, the gash, its dark core. */
  glow: string;
  edge: string;
  flesh: string;
  gash: string;
  core: string;
};

export type Claw = {
  marks: ClawMark[];
  /** The widest mark's width (px), which the stylesheet's tear and glow filters scale from. */
  width: number;
};

/** Each layer's width as a share of the mark's own width. */
const LAYERS = { glow: 2.9, edge: 1.5, flesh: 1.26, gash: 1.02, core: 0.42 } as const;

/** Points along a mark, rounded for a short path. */
function pathOf(points: readonly (readonly [number, number])[], close: boolean): string {
  const text = points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");
  return `M${text}${close ? "Z" : ""}`;
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
  const N = 48;
  const marks: ClawMark[] = [];
  for (let k = 0; k < 3; k += 1) {
    const off = (k - 1) * gap;
    // The middle claw leads a little: the paw's longest toe.
    const lead = k === 1 ? -gap * 0.45 : 0;
    const start = { x: from.x + nx * off + dx * lead, y: from.y + ny * off + dy * lead };
    const L = length * (k === 1 ? 1 : k === 0 ? 0.86 : 0.92);
    const bend = 0.07 + (k - 1) * 0.025;
    const points: { x: number; y: number; t: number }[] = [];
    for (let i = 0; i <= N; i += 1) {
      const t = i / N;
      const curve = Math.sin(t * Math.PI) * L * bend;
      points.push({ x: start.x + dx * L * t + nx * curve, y: start.y + dy * L * t + ny * curve, t });
    }
    const markWidth = widest * (k === 1 ? 1 : 0.8);
    // Thin at the tip, full a third of the way in, tapering out as the paw lifts.
    const at = (t: number) => markWidth * Math.sin(Math.PI * Math.min(1, t * 1.12)) ** 0.6 * (1 - t * 0.3);
    const side = (sign: 1 | -1, share: number) =>
      points.map((p, i) => {
        const next = points[Math.min(N, i + 1)];
        const prev = points[Math.max(0, i - 1)];
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const n = Math.hypot(tx, ty) || 1;
        tx /= n;
        ty /= n;
        const half = (at(p.t) * share) / 2;
        return [p.x - ty * half * sign, p.y + tx * half * sign] as const;
      });
    const outline = (share: number) => pathOf([...side(1, share), ...side(-1, share).reverse()], true);
    marks.push({
      center: pathOf(
        points.map((p) => [p.x, p.y] as const),
        false,
      ),
      glow: outline(LAYERS.glow),
      edge: outline(LAYERS.edge),
      flesh: outline(LAYERS.flesh),
      gash: outline(LAYERS.gash),
      core: outline(LAYERS.core),
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
