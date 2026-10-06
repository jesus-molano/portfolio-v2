import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";

/**
 * The Logixs wall's paper, in one atlas: Bytetravel's deco travel poster
 * (a moon, streamlines, a route over a gridded globe, a suitcase of
 * stickers for the extras), the same with its top-right corner folded away
 * (that corner becomes the paper plane), Retech's day-glo bill with its
 * light tree, the snipe sheets, older bills from the earlier stops showing
 * through the tears, and the painted ban. Our type, no logos.
 */
export const LOGIXS_ATLAS = { w: 2048, h: 2048 } as const;
export const CELL = { w: 400, h: 580 } as const;

/** Atlas rectangles in pixels: x, y, w, h. */
export const RECTS = {
  bytetravel: [0, 0, 400, 580],
  bytetravelCut: [410, 0, 400, 580],
  retech: [820, 0, 400, 580],
  retechTorn: [1230, 0, 400, 580],
  fragments: [1640, 0, 400, 580],
  snipe: [0, 600, 2048, 150],
  ban: [0, 770, 2048, 170],
} as const;

/** Where the light tree's bulbs sit on a Retech bill, as fractions of the cell (x, y from the top). */
export const TREE = { x: 0.85, ys: [0.585, 0.665, 0.745, 0.845] } as const;

type Copy = {
  snipe: string;
  ban: string;
  bytetravel: readonly string[];
  retech: readonly string[];
  printer: string;
  fragments: readonly string[];
};

function fitFont(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, width: number) {
  ctx.font = font(size);
  const w = ctx.measureText(text).width;
  if (w > width) ctx.font = font((size * width) / w);
}

function bytetravel(ctx: CanvasRenderingContext2D, copy: Copy, cut: boolean) {
  const { w, h } = CELL;
  // A deco travel poster: airbrushed dusk over the curve of the globe.
  const sky = ctx.createLinearGradient(0, 70, 0, h);
  sky.addColorStop(0, "#2a1452");
  sky.addColorStop(0.32, "#7a2a8a");
  sky.addColorStop(0.58, "#ff4f8e");
  sky.addColorStop(0.8, "#ffb07a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // A low sun behind haze, never a striped one.
  const glow = ctx.createRadialGradient(270, 270, 10, 270, 270, 150);
  glow.addColorStop(0, "rgba(255, 214, 170, 0.55)");
  glow.addColorStop(1, "rgba(255, 214, 170, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255, 204, 168, 0.85)";
  ctx.beginPath();
  ctx.arc(270, 270, 62, 0, Math.PI * 2);
  ctx.fill();
  // The globe's dome, gridded.
  const cx = w / 2;
  const cy = 700;
  const r = 270;
  ctx.fillStyle = "#1c0f33";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(150, 120, 210, 0.55)";
  ctx.lineWidth = 1.5;
  for (let k = 1; k <= 5; k += 1) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, (r * k) / 5.5, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let k = 1; k <= 4; k += 1) {
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.18 * k, r, r * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 190, 220, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  // The dotted route off the globe, up to the plane.
  ctx.fillStyle = "#fff4ea";
  for (let i = 0; i <= 26; i += 1) {
    const t = i / 26;
    const x = 70 + (330 - 70) * t;
    const y = 470 - 360 * t + 120 * t * (1 - t) * -1;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(352, 96);
  ctx.rotate(-0.85);
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-14, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-14, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Its three extras as travel stickers on the globe: a visa stamp, an eSIM, a lounge seat.
  extras(ctx, w / 2, 458);
  // The masthead.
  ctx.fillStyle = "#1a0d33";
  ctx.fillRect(0, 0, w, 78);
  ctx.fillStyle = "#e8c37a";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, copy.bytetravel[0], (s) => `400 ${s}px ${fonts.deco()}`, 56, w - 44);
  ctx.fillText(copy.bytetravel[0], w / 2, 58);
  // The lines on the dark of the globe.
  ctx.fillStyle = "#fff0dc";
  fitFont(ctx, copy.bytetravel[1], (s) => `700 ${s}px ${fonts.serif()}`, 24, w - 70);
  ctx.fillText(copy.bytetravel[1], w / 2, 492);
  fitFont(ctx, copy.bytetravel[2], (s) => `700 ${s}px ${fonts.serif()}`, 24, w - 70);
  ctx.fillStyle = "#e8c37a";
  ctx.fillText(copy.bytetravel[2], w / 2, 522);
  ctx.fillStyle = "rgba(255, 240, 220, 0.7)";
  fitFont(ctx, copy.bytetravel[3], (s) => `600 ${s}px ${fonts.mono()}`, 12, w - 70);
  ctx.fillText(copy.bytetravel[3], w / 2, 546);
  ctx.font = `500 10px ${fonts.mono()}`;
  ctx.fillStyle = "rgba(255, 240, 220, 0.45)";
  ctx.fillText(copy.printer, w / 2, 564);
  // A hairline frame, inset like a printed border.
  ctx.strokeStyle = "rgba(232, 195, 122, 0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  if (cut) {
    // The top-right corner folded away along a paper edge: it flew off as the plane.
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(w - 150, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, 150);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#e9dfc6";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w - 150, 0);
    ctx.lineTo(w, 150);
    ctx.stroke();
  }
}

function extras(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const gold = "#e8c37a";
  ctx.save();
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = 2.5;
  // The visa stamp: a double ring with a star.
  const vx = cx - 70;
  ctx.beginPath();
  ctx.arc(vx, cy, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(vx, cy, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 2.6 : 6.5;
    ctx.lineTo(vx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  // The eSIM: a chip with its contacts.
  ctx.beginPath();
  ctx.roundRect(cx - 14, cy - 17, 28, 34, 5);
  ctx.stroke();
  for (const dy of [-8, 0, 8]) {
    ctx.fillRect(cx - 9, cy + dy - 1.5, 7, 3);
    ctx.fillRect(cx + 2, cy + dy - 1.5, 7, 3);
  }
  // The lounge: an armchair.
  const ax = cx + 70;
  ctx.beginPath();
  ctx.roundRect(ax - 12, cy - 15, 24, 18, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(ax - 18, cy - 4, 36, 12, 4);
  ctx.fill();
  ctx.fillRect(ax - 15, cy + 8, 3, 8);
  ctx.fillRect(ax + 12, cy + 8, 3, 8);
  ctx.restore();
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number) {
  // Letterspaced, centred on x.
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1);
  let at = x - total / 2;
  ctx.textAlign = "left";
  [...text].forEach((c, i) => {
    ctx.fillText(c, at, y);
    at += widths[i] + tracking;
  });
}

function retech(ctx: CanvasRenderingContext2D, copy: Copy, torn: boolean, random: () => number) {
  const { w, h } = CELL;
  const ink = "#22104a";
  // A letterpress gig bill: split-fountain ink, magenta into sodium.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#ff2d95");
  g.addColorStop(0.45, "#ff6f61");
  g.addColorStop(1, "#ffc46b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Double rule at the head.
  ctx.fillStyle = ink;
  ctx.fillRect(18, 22, w - 36, 3);
  ctx.fillRect(18, 30, w - 36, 1.5);
  // Wood type, slightly off register.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, copy.retech[0], (s) => `400 ${s}px ${fonts.condensed()}`, 210, w - 36);
  ctx.fillStyle = "rgba(255, 236, 160, 0.55)";
  ctx.fillText(copy.retech[0], w / 2 + 4, 214 + 4);
  ctx.fillStyle = ink;
  ctx.fillText(copy.retech[0], w / 2, 214);
  // The reversed band.
  ctx.fillRect(0, 236, w, 58);
  ctx.fillStyle = "#ffe2b0";
  fitFont(ctx, copy.retech[1], (s) => `700 ${s}px ${fonts.serif()}`, 26, w - 80);
  spaced(ctx, copy.retech[1], w / 2, 274, 4);
  // A halftone burst behind the bill's words.
  const bx = 140;
  const by = 420;
  ctx.fillStyle = "rgba(34, 16, 74, 0.28)";
  for (let y = by - 110; y < by + 110; y += 9) {
    for (let x = bx - 130; x < bx + 130; x += 9) {
      const d = Math.hypot(x - bx, y - by) / 120;
      if (d > 1) continue;
      ctx.beginPath();
      ctx.arc(x, y, 3.4 * (1 - d), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The programme, stacked in the left column; the light tree takes the right.
  ctx.fillStyle = ink;
  ctx.font = `700 32px ${fonts.serif()}`;
  ctx.textAlign = "center";
  const lines: string[] = [];
  for (const word of copy.retech[2].split(" ")) {
    const last = lines[lines.length - 1];
    if (last && ctx.measureText(`${last} ${word}`).width <= 240) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  lines.forEach((line, i) => {
    fitFont(ctx, line, (s) => `700 ${s}px ${fonts.serif()}`, 32, 250);
    ctx.fillText(line, 140, 372 + i * 42);
  });
  // The drag-race light tree: three ambers, then GO.
  const tx = w * TREE.x;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(tx - 30, h * 0.535, 60, h * 0.36, 14);
  ctx.fill();
  ctx.fillRect(tx - 3, h * 0.895, 6, h * 0.05);
  TREE.ys.forEach((fy, i) => {
    ctx.fillStyle = i === 3 ? "#1f5f50" : "#5a3a12";
    ctx.beginPath();
    ctx.arc(tx, h * fy, 19, 0, Math.PI * 2);
    ctx.fill();
  });
  // Foot rule and imprint.
  ctx.fillStyle = ink;
  ctx.fillRect(18, h - 44, w - 36, 1.5);
  ctx.font = `600 11px ${fonts.mono()}`;
  spaced(ctx, copy.printer, w / 2, h - 22, 3);
  if (torn) {
    // A tear down the left: the army's older stencil shows through.
    const edge: [number, number][] = [[0, 300]];
    for (let yy = 300; yy <= h; yy += 20) edge.push([60 + random() * 80, yy]);
    edge.push([0, h]);
    ctx.save();
    ctx.beginPath();
    edge.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "#d9c79a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3a2a5a";
    ctx.font = `800 54px ${fonts.display()}`;
    ctx.textAlign = "left";
    ctx.fillText("2018", 14, 460);
    ctx.restore();
    ctx.strokeStyle = "#fff6e6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    edge.slice(0, -1).forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
    ctx.stroke();
  }
}

function fragments(ctx: CanvasRenderingContext2D, copy: Copy) {
  const { w, h } = CELL;
  // Older bills from the earlier stops: the army's stencil, a PwC neon print, a strip of trivision vinyl.
  ctx.fillStyle = "#e9dbb4";
  ctx.fillRect(0, 0, w, h * 0.4);
  ctx.fillStyle = "#2a1745";
  fitFont(ctx, copy.fragments[0], (s) => `800 ${s}px ${fonts.display()}`, 46, w - 30);
  ctx.textAlign = "left";
  ctx.fillText(copy.fragments[0], 16, 120);
  ctx.fillStyle = "#1c0d33";
  ctx.fillRect(0, h * 0.4, w, h * 0.32);
  ctx.strokeStyle = "#ff5fb4";
  ctx.lineWidth = 5;
  ctx.font = `400 46px ${fonts.script()}`;
  ctx.strokeText(copy.fragments[1], 20, h * 0.58);
  ctx.fillStyle = "#14204a";
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 ? "#f2c38a" : "#ef8fae";
    ctx.fillRect(i * 50, h * 0.72, 48, h * 0.28);
  }
  ctx.fillStyle = "#14204a";
  fitFont(ctx, copy.fragments[2], (s) => `800 ${s}px ${fonts.display()}`, 52, w - 30);
  ctx.fillText(copy.fragments[2], 16, h * 0.92);
}

export function paintLogixs(copy: Copy): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(LOGIXS_ATLAS.w, LOGIXS_ATLAS.h);
  ctx.clearRect(0, 0, LOGIXS_ATLAS.w, LOGIXS_ATLAS.h);
  const random = createRandom(2025);
  const cell = (rect: readonly number[], paint: () => void) => {
    ctx.save();
    ctx.translate(rect[0], rect[1]);
    ctx.beginPath();
    ctx.rect(0, 0, rect[2], rect[3]);
    ctx.clip();
    paint();
    // Paper wrinkles and paste stains.
    for (let i = 0; i < 160; i += 1) {
      ctx.fillStyle = random() < 0.5 ? "rgba(255, 255, 255, 0.05)" : "rgba(30, 10, 30, 0.06)";
      ctx.fillRect(random() * rect[2], random() * rect[3], 2 + random() * 30, 1 + random() * 2);
    }
    ctx.restore();
  };
  cell(RECTS.bytetravel, () => bytetravel(ctx, copy, false));
  cell(RECTS.bytetravelCut, () => bytetravel(ctx, copy, true));
  cell(RECTS.retech, () => retech(ctx, copy, false, random));
  cell(RECTS.retechTorn, () => retech(ctx, copy, true, random));
  cell(RECTS.fragments, () => fragments(ctx, copy));
  cell(RECTS.snipe, () => {
    ctx.fillStyle = "#f3e7cf";
    ctx.fillRect(0, 0, RECTS.snipe[2], RECTS.snipe[3]);
    ctx.fillStyle = "#1c0f33";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, copy.snipe, (s) => `800 ${s}px ${fonts.display()}`, 92, RECTS.snipe[2] - 80);
    ctx.fillText(copy.snipe, RECTS.snipe[2] / 2, RECTS.snipe[3] / 2 + 4);
  });
  cell(RECTS.ban, () => {
    // Whitewashed lettering painted on the brick, in Spanish: it is the street's.
    ctx.fillStyle = "rgba(240, 236, 226, 0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, copy.ban, (s) => `400 ${s}px ${fonts.block()}`, 110, RECTS.ban[2] - 60);
    ctx.fillText(copy.ban, RECTS.ban[2] / 2, RECTS.ban[3] / 2);
  });
  return canvas;
}
