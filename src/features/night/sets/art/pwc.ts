import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";
import { withInkCentred } from "./ink";

/**
 * PwC's blade sign: deep-violet enamel, a cyan double border tube, P, W and
 * C stacked in pink outline neon (our type, never the firm's mark), each
 * tube with a white-hot core, and a stepped deco crown with a sunburst fan.
 * One ray is dying: it is drawn dim here, with orange electrode ends, and
 * struck by its own overlay (PwcSet) when the board is armed.
 */
export const BLADE = { w: 440, h: 2600, metresW: 3.4, metresH: 20 } as const;

const PINK = "#ff5fb4";
const CYAN = "#3be8ff";
const SODIUM = "#ffc46b";
const ENAMEL = "#1c0d33";

function tube(ctx: CanvasRenderingContext2D, color: string, width: number, path: () => void) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 3;
  ctx.lineWidth = width;
  path();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 245, 250, 0.9)";
  ctx.lineWidth = width * 0.38;
  path();
  ctx.stroke();
  ctx.restore();
}

/** A band round a mask's edge: dilated by `outer`, less the mask eroded by `inner` (both in px). */
function band(mask: HTMLCanvasElement, outer: number, inner: number): HTMLCanvasElement {
  const [out, ctx] = makeCanvas(mask.width, mask.height);
  const steps = 24;
  const ring = (r: number, op: GlobalCompositeOperation, target: CanvasRenderingContext2D) => {
    target.globalCompositeOperation = op;
    for (let k = 0; k < steps; k += 1) {
      const a = (k / steps) * Math.PI * 2;
      target.drawImage(mask, Math.cos(a) * r, Math.sin(a) * r);
    }
  };
  ring(outer, "source-over", ctx);
  ctx.drawImage(mask, 0, 0);
  const [eroded, e] = makeCanvas(mask.width, mask.height);
  e.drawImage(mask, 0, 0);
  ring(inner, "destination-in", e);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(eroded, 0, 0);
  return out;
}

/** Tints a mask in place. */
function tint(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const ctx = mask.getContext("2d");
  if (!ctx) return mask;
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, mask.width, mask.height);
  return mask;
}

/** A glyph in outline neon, from its filled mask: a pink tube with a glow and a white-hot core. */
function neonOutline(ctx: CanvasRenderingContext2D, w: number, h: number, y: number, draw: (mask: CanvasRenderingContext2D) => void) {
  const [mask, m] = makeCanvas(w, Math.ceil(h));
  m.fillStyle = "#fff";
  draw(m);
  const tube = tint(band(mask, 8, 8), PINK);
  const core = tint(band(mask, 2.5, 2.5), "rgba(255, 240, 248, 0.95)");
  ctx.save();
  ctx.shadowColor = PINK;
  ctx.shadowBlur = 34;
  ctx.drawImage(tube, 0, y);
  ctx.shadowBlur = 0;
  ctx.drawImage(core, 0, y);
  ctx.restore();
}

/** The fan rays of the crown, from a hub at the top of the blade: [angle, colour]. */
export const RAYS: [number, string][] = [-62, -40, -20, 0, 20, 40, 62].map((deg, i) => [
  (deg * Math.PI) / 180,
  i % 2 ? SODIUM : PINK,
]);
/** The ray that flickers. */
export const DYING_RAY = 4;
export const HUB = { x: BLADE.w / 2, y: 470 } as const;
const RAY_FROM = 70;
const RAY_TO = 300;

function rayPath(ctx: CanvasRenderingContext2D, angle: number) {
  return () => {
    ctx.beginPath();
    ctx.moveTo(HUB.x + Math.sin(angle) * RAY_FROM, HUB.y - Math.cos(angle) * RAY_FROM);
    ctx.lineTo(HUB.x + Math.sin(angle) * RAY_TO, HUB.y - Math.cos(angle) * RAY_TO);
  };
}

export function paintBlade(letters: readonly string[]): HTMLCanvasElement {
  const { w, h } = BLADE;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  // The crown: stepped deco tiers (transparent around them).
  ctx.fillStyle = ENAMEL;
  const steps = [
    [40, 520, w - 80, 2080],
    [90, 470, w - 180, 60],
    [140, 430, w - 280, 50],
  ];
  for (const [x, y, sw, sh] of steps) ctx.fillRect(x, y, sw, sh);
  // The fan behind the crown.
  RAYS.forEach(([angle, color], i) => {
    if (i === DYING_RAY) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      tube(ctx, color, 14, rayPath(ctx, angle));
      ctx.restore();
      // Its electrode ends still glow orange.
      for (const r of [RAY_FROM, RAY_TO]) {
        ctx.fillStyle = "#ff8a3c";
        ctx.shadowColor = "#ff8a3c";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(HUB.x + Math.sin(angle) * r, HUB.y - Math.cos(angle) * r, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      return;
    }
    tube(ctx, color, 14, rayPath(ctx, angle));
  });
  // Cyan double border round the blade.
  for (const inset of [22, 46]) {
    tube(ctx, CYAN, 10, () => {
      ctx.beginPath();
      ctx.roundRect(40 + inset, 520 + inset, w - 80 - inset * 2, 2080 - inset * 2, 26);
    });
  }
  // P, W, C stacked, pink outline neon. The tube follows the letter's
  // outline as one shape: a font built of overlapping strokes would
  // otherwise show its overlaps as tubes across the stems.
  const family = fonts.display();
  const cell = 2080 / letters.length;
  letters.forEach((letter, i) => {
    const size = Math.min(cell * 0.72, (w - 160) * 1.05);
    const cy = 520 + cell * (i + 0.5);
    neonOutline(ctx, w, cell, 520 + cell * i, (mask) => {
      mask.font = `800 ${size}px ${family}`;
      mask.textAlign = "center";
      mask.textBaseline = "middle";
      mask.fillText(letter, w / 2, cy - (520 + cell * i));
    });
  });
  return canvas;
}

/** The dying ray alone, struck at full: an additive overlay over the blade. */
export function paintDyingRay(): HTMLCanvasElement {
  const { w, h } = BLADE;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  const [angle, color] = RAYS[DYING_RAY];
  tube(ctx, color, 14, rayPath(ctx, angle));
  return canvas;
}

/**
 * The marquee under the blade and the lobby's sign, in rows of one atlas:
 * the role in neon over enamel, a lit readerboard of changeable letters
 * with what the hotel has on this season (the Bono Cultural), and the
 * check-in sign over the lobby with the years. Few words, big, in our type, centred on their measured ink.
 */
export const MARQUEE = { w: 1024, h: 1024 } as const;
export const MARQUEE_ROWS = {
  fascia: [0, 0, 1024, 280],
  reader: [0, 300, 1024, 260],
  checkIn: [0, 580, 1024, 128],
} as const;

type MarqueeCopy = { crossbar: readonly string[]; plaques: readonly string[]; door: string };

export function paintMarquee(copy: MarqueeCopy): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(MARQUEE.w, MARQUEE.h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MARQUEE.w, MARQUEE.h);

  // The fascia: enamel, a cyan border tube, the role in pink script over spaced cyan caps.
  {
    const [x, y, w, h] = MARQUEE_ROWS.fascia;
    ctx.fillStyle = ENAMEL;
    ctx.fillRect(x, y, w, h);
    tube(ctx, CYAN, 8, () => {
      ctx.beginPath();
      ctx.roundRect(x + 22, y + 20, w - 44, h - 40, 18);
    });
    ctx.font = `400 150px ${fonts.script()}`;
    withInkCentred(ctx, copy.crossbar[0], w / 2, y + 112, w - 160, (tx, ty) => {
      ctx.lineJoin = "round";
      ctx.strokeStyle = PINK;
      ctx.shadowColor = PINK;
      ctx.shadowBlur = 28;
      ctx.lineWidth = 12;
      ctx.strokeText(copy.crossbar[0], tx, ty);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff2f8";
      ctx.fillText(copy.crossbar[0], tx, ty);
    });
    ctx.font = `700 58px ${fonts.mono()}`;
    const caps = copy.crossbar[1].split("").join(" ");
    withInkCentred(ctx, caps, w / 2, y + 214, w - 140, (tx, ty) => {
      ctx.fillStyle = "#c9f6ff";
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 14;
      ctx.fillText(caps, tx, ty);
      ctx.shadowBlur = 0;
    });
  }

  // The readerboard: a lit milk panel in a dark frame, two tracks of changeable letters.
  {
    const [x, y, w, h] = MARQUEE_ROWS.reader;
    ctx.fillStyle = "#1c1030";
    ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#efe0c0");
    g.addColorStop(0.5, "#f6ead0");
    g.addColorStop(1, "#e4d0aa");
    ctx.fillStyle = g;
    ctx.fillRect(x + 16, y + 14, w - 32, h - 28);
    const rows = [y + 14 + (h - 28) * 0.24, y + 14 + (h - 28) * 0.7];
    // The tracks the letters hang on.
    ctx.fillStyle = "rgba(90, 70, 90, 0.35)";
    for (const ry of rows) {
      ctx.fillRect(x + 16, ry - 52, w - 32, 3);
      ctx.fillRect(x + 16, ry + 50, w - 32, 3);
    }
    const random = createRandom(2023);
    // A small heading track over the one bill in big letters: what the hotel has on this season.
    copy.plaques.slice(0, 2).forEach((line, row) => {
      ctx.font = `400 ${row === 0 ? 72 : 112}px ${fonts.condensed()}`;
      withInkCentred(ctx, line, w / 2, rows[row], w - 90, (tx, ty) => {
        // Letter by letter, each a hair off true, as a hand on a ladder hangs them.
        let pen = tx;
        for (const letter of line) {
          const advance = ctx.measureText(letter).width;
          ctx.save();
          ctx.translate(pen + advance / 2, ty - 36);
          ctx.rotate((random() - 0.5) * 0.03);
          ctx.fillStyle = "#24122e";
          ctx.fillText(letter, -advance / 2, 36 + (random() - 0.5) * 3);
          ctx.restore();
          pen += advance + 4;
        }
      });
    });
  }

  // The lobby's sign: the years as a hotel's check-in and check-out, sodium neon on enamel.
  {
    const [x, y, w, h] = MARQUEE_ROWS.checkIn;
    ctx.fillStyle = ENAMEL;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255, 196, 107, 0.5)";
    ctx.fillRect(x + 14, y + 12, w - 28, 3);
    ctx.fillRect(x + 14, y + h - 15, w - 28, 3);
    ctx.font = `800 70px ${fonts.display()}`;
    const text = copy.door;
    withInkCentred(ctx, text, w / 2, y + h / 2, w - 120, (tx, ty) => {
      ctx.lineJoin = "round";
      ctx.strokeStyle = SODIUM;
      ctx.shadowColor = SODIUM;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 6;
      ctx.strokeText(text, tx, ty);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffdcae";
      ctx.fillText(text, tx, ty);
    });
    // Deco chevrons at the ends.
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x + 34 : x + w - 34;
      tube(ctx, PINK, 5, () => {
        ctx.beginPath();
        for (let i = 0; i < 2; i += 1) {
          ctx.moveTo(cx - side * (8 + i * 12), y + 40);
          ctx.lineTo(cx + side * (4 - i * 12), y + h / 2);
          ctx.lineTo(cx - side * (8 + i * 12), y + h - 40);
        }
      });
    }
  }
  return canvas;
}
