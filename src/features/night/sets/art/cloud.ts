import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";
import { type Box, POSTCARDS } from "./postcards";

/**
 * The Cloud District trivision: three client faces, each the client's own
 * product at a glance, in the client's own colours, our type and our
 * drawing (no logo files, no copied marks). Rows top to bottom: Naturgy
 * (its customer area, Omega, and its in-house monitor, Monitor), Pangea (a
 * travel agency's web of destination cards) and Telpark (a parking
 * booking: the search, a result, the garage). The main words are set big
 * enough to read on a phone; the UI around them is texture. Plus the
 * nameplate (the café's sign and room are `cafe.ts`).
 *
 * The board's shader caps every lit texel at 0.75, so the clients' white
 * pages are painted a little warm and grey: lit, they stay paper, never a
 * flat blown white, and the orange keeps its hue.
 */
export const FACE = { w: 2048, h: 852 } as const;
export const CLOUD_ATLAS = { w: 2048, h: FACE.h * 3 } as const;

type Product = { name: string; kind: string; what: string };
type Spot = { name: string; price: string; per: string; cta: string };
type Face = {
  title: string;
  lines: readonly string[];
  /** Naturgy: the products he built, each named and said in a few words. */
  products?: readonly Product[];
  /** Pangea: the call to action on its page. */
  cta?: string;
  /** Telpark: the search's fields (label, value) and the result's card. */
  search?: readonly (readonly string[])[];
  spot?: Spot;
};
type Ctx = CanvasRenderingContext2D;

/** The clients' own colours, as their sites publish them, and our paper and inks around them. */
const NATURGY = {
  navy: "#004571",
  deep: "#0a2c48",
  orange: "#e57200",
  paper: "#e9e5de",
  page: "#f3f1ec",
  ice: "#dde7ed",
  ink: "#476178",
} as const;
const PANGEA = { navy: "#1f2a44", paper: "#ebe7e0", page: "#f4f2ed", ink: "#56607a", hole: "#151c30" } as const;
const TELPARK = { orange: "#f28a12", navy: "#1d2245", paper: "#e9e6e0", page: "#f5f3ee", ink: "#5d6380", rule: "#d6d2ca" } as const;

/** Sets a line of text at most `maxWidth` wide (the size shrinks to fit, never squashes), returns its width. */
function say(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  o: { size: number; weight?: number | string; family?: string; colour: string; maxWidth?: number; align?: CanvasTextAlign; tracking?: number },
): number {
  const family = o.family ?? fonts.body();
  const weight = o.weight ?? 700;
  ctx.letterSpacing = `${o.tracking ?? 0}px`;
  ctx.font = `${weight} ${o.size}px ${family}`;
  let width = ctx.measureText(text).width;
  if (o.maxWidth && width > o.maxWidth) {
    ctx.font = `${weight} ${(o.size * o.maxWidth) / width}px ${family}`;
    width = ctx.measureText(text).width;
  }
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = o.colour;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = "0px";
  return width;
}

/** Splits `text` into at most two lines of `maxWidth` at the current font, the break as even as the words allow. */
function twoLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(" ");
  let best: string[] = [text];
  let score = Number.POSITIVE_INFINITY;
  for (let k = 1; k < words.length; k += 1) {
    const a = words.slice(0, k).join(" ");
    const b = words.slice(k).join(" ");
    const wide = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (wide < score) {
      score = wide;
      best = [a, b];
    }
  }
  return best;
}

function rounded(ctx: Ctx, b: Box, r: number): Path2D {
  const path = new Path2D();
  path.roundRect(b.x, b.y, b.w, b.h, r);
  return path;
}

/** A soft drop shadow under a card, as a page casts it. */
function card(ctx: Ctx, path: Path2D, fill: string, shadow = "rgba(20, 30, 50, 0.16)") {
  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.restore();
}

/** A row of rounded bars: placeholder text, the way a page reads from across the street. */
function bars(ctx: Ctx, x: number, y: number, widths: readonly number[], h: number, colour: string, gap = h * 0.7) {
  ctx.fillStyle = colour;
  let at = x;
  for (const w of widths) {
    ctx.beginPath();
    ctx.roundRect(at, y, w, h, h / 2);
    ctx.fill();
    at += w + gap;
  }
}

/* ---------------------------------------------------------------- Naturgy */

/** Omega, the customer area: the bill, the usage bars, the contracts with their switches. */
function omegaScreen(ctx: Ctx, b: Box) {
  const shape = rounded(ctx, b, 26);
  card(ctx, shape, NATURGY.page);
  ctx.save();
  ctx.clip(shape);
  // The page's top bar, navy, with the menu as texture and the customer's avatar.
  ctx.fillStyle = NATURGY.navy;
  ctx.fillRect(b.x, b.y, b.w, 58);
  bars(ctx, b.x + 30, b.y + 22, [90, 120, 80], 14, "rgba(243, 241, 236, 0.45)", 22);
  ctx.fillStyle = NATURGY.orange;
  ctx.beginPath();
  ctx.arc(b.x + b.w - 44, b.y + 29, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0, 69, 113, 0.35)";
  ctx.stroke(shape);
  const top = b.y + 82;
  const h = b.h - 82 - 24;
  const gap = 22;
  const w = (b.w - 2 * 26 - 2 * gap) / 3;
  const tiles = [0, 1, 2].map((k) => ({ x: b.x + 26 + k * (w + gap), y: top, w, h }));
  for (const t of tiles) {
    ctx.fillStyle = NATURGY.ice;
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, t.w, t.h, 18);
    ctx.fill();
  }
  // The bill: a receipt with a torn edge and a paid tick.
  const [bill, usage, contracts] = tiles;
  const rx = bill.x + bill.w * 0.18;
  const rw = bill.w * 0.5;
  const ry = bill.y + 26;
  const rh = bill.h - 64;
  ctx.fillStyle = "#faf9f6";
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(rx + rw, ry);
  ctx.lineTo(rx + rw, ry + rh);
  for (let k = 0; k < 6; k += 1) ctx.lineTo(rx + rw - ((k + 0.5) * rw) / 6, ry + rh + (k % 2 ? 0 : 14));
  ctx.lineTo(rx, ry + rh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = NATURGY.navy;
  ctx.lineWidth = 4;
  ctx.stroke();
  for (let k = 0; k < 4; k += 1) bars(ctx, rx + 18, ry + 24 + k * 30, [rw * (k === 3 ? 0.35 : 0.62)], 10, k === 3 ? NATURGY.navy : "rgba(0, 69, 113, 0.35)");
  ctx.fillStyle = NATURGY.orange;
  ctx.beginPath();
  ctx.arc(bill.x + bill.w * 0.78, bill.y + bill.h - 50, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = NATURGY.page;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bill.x + bill.w * 0.78 - 12, bill.y + bill.h - 50);
  ctx.lineTo(bill.x + bill.w * 0.78 - 2, bill.y + bill.h - 40);
  ctx.lineTo(bill.x + bill.w * 0.78 + 14, bill.y + bill.h - 62);
  ctx.stroke();
  // Usage: a year of months, this one in orange.
  const months = [0.55, 0.7, 0.62, 0.45, 0.38, 0.5, 0.74, 0.86, 0.6, 0.48, 0.58, 0.8];
  const bw = (usage.w - 40) / months.length;
  const base = usage.y + usage.h - 26;
  months.forEach((m, k) => {
    ctx.fillStyle = k === months.length - 1 ? NATURGY.orange : NATURGY.navy;
    ctx.beginPath();
    ctx.roundRect(usage.x + 20 + k * bw + bw * 0.18, base - m * (usage.h - 60), bw * 0.64, m * (usage.h - 60), [6, 6, 0, 0]);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(0, 69, 113, 0.4)";
  ctx.fillRect(usage.x + 16, base, usage.w - 32, 3);
  // Contracts: power and gas, each with its switch on.
  for (let k = 0; k < 2; k += 1) {
    const cy = contracts.y + contracts.h * (0.3 + k * 0.42);
    const ix = contracts.x + 46;
    ctx.fillStyle = NATURGY.navy;
    if (k === 0) {
      ctx.beginPath();
      ctx.arc(ix, cy - 6, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(ix - 9, cy + 10, 18, 12);
    } else {
      ctx.beginPath();
      ctx.moveTo(ix, cy - 26);
      ctx.quadraticCurveTo(ix + 26, cy + 4, ix + 12, cy + 20);
      ctx.lineTo(ix - 12, cy + 20);
      ctx.quadraticCurveTo(ix - 26, cy + 4, ix, cy - 26);
      ctx.fill();
    }
    bars(ctx, ix + 34, cy - 14, [contracts.w * 0.3], 12, "rgba(0, 69, 113, 0.45)");
    bars(ctx, ix + 34, cy + 8, [contracts.w * 0.2], 10, "rgba(0, 69, 113, 0.25)");
    const sx = contracts.x + contracts.w - 92;
    ctx.fillStyle = NATURGY.orange;
    ctx.beginPath();
    ctx.roundRect(sx, cy - 20, 66, 40, 20);
    ctx.fill();
    ctx.fillStyle = NATURGY.page;
    ctx.beginPath();
    ctx.arc(sx + 46, cy, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Monitor, the in-house dashboard: process states, a log tail, a graph of events. */
function monitorScreen(ctx: Ctx, b: Box) {
  const shape = rounded(ctx, b, 26);
  card(ctx, shape, NATURGY.deep, "rgba(10, 30, 50, 0.3)");
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = "#06223a";
  ctx.fillRect(b.x, b.y, b.w, 58);
  ["#e57200", "#d8cfc0", "#4fb7a0"].forEach((c, k) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(b.x + 34 + k * 30, b.y + 29, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  bars(ctx, b.x + 150, b.y + 22, [110, 90, 120], 14, "rgba(221, 231, 237, 0.3)", 24);
  ctx.restore();
  const top = b.y + 84;
  const inner = b.h - 84 - 24;
  // Processes: a status light and a name bar each.
  const states = ["#4fb7a0", "#4fb7a0", NATURGY.orange, "#4fb7a0", "#e8584a", "#4fb7a0"];
  const pw = b.w * 0.3;
  states.forEach((c, k) => {
    const y = top + 12 + k * (inner / states.length);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(b.x + 40, y + 10, 10, 0, Math.PI * 2);
    ctx.fill();
    bars(ctx, b.x + 64, y + 3, [pw * (0.5 + ((k * 37) % 30) / 100)], 14, "rgba(221, 231, 237, 0.55)");
  });
  // The log tail, as texture: timestamps, a level in its colour, a line.
  const lx = b.x + pw + 40;
  const lw = b.w * 0.34;
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.beginPath();
  ctx.roundRect(lx - 14, top, lw, inner, 12);
  ctx.fill();
  const levels = ["#4fb7a0", "#4fb7a0", "#e8b04a", "#4fb7a0", "#e8584a", "#4fb7a0", "#4fb7a0", "#e8b04a", "#4fb7a0"];
  levels.forEach((c, k) => {
    const y = top + 14 + k * (inner / levels.length);
    bars(ctx, lx, y, [44], 10, "rgba(221, 231, 237, 0.35)");
    bars(ctx, lx + 56, y, [30], 10, c);
    bars(ctx, lx + 98, y, [lw * (0.3 + ((k * 53) % 35) / 100)], 10, "rgba(221, 231, 237, 0.5)");
  });
  // Events: a graph with a spike, the line in Naturgy's orange.
  const gx = lx + lw + 14;
  const gw = b.x + b.w - 26 - gx;
  ctx.strokeStyle = "rgba(221, 231, 237, 0.14)";
  ctx.lineWidth = 2;
  for (let k = 0; k <= 4; k += 1) {
    ctx.beginPath();
    ctx.moveTo(gx, top + (k * inner) / 4);
    ctx.lineTo(gx + gw, top + (k * inner) / 4);
    ctx.stroke();
  }
  const series = [0.3, 0.35, 0.28, 0.42, 0.38, 0.5, 0.46, 0.9, 0.55, 0.48, 0.52, 0.44, 0.6, 0.56];
  const pts = series.map((v, k) => [gx + (k / (series.length - 1)) * gw, top + inner - v * inner * 0.9] as const);
  const area = ctx.createLinearGradient(0, top, 0, top + inner);
  area.addColorStop(0, "rgba(229, 114, 0, 0.45)");
  area.addColorStop(1, "rgba(229, 114, 0, 0)");
  ctx.fillStyle = area;
  ctx.beginPath();
  ctx.moveTo(gx, top + inner);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(gx + gw, top + inner);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = NATURGY.orange;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.fillStyle = "#f3f1ec";
  ctx.beginPath();
  ctx.arc(pts[7][0], pts[7][1], 9, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Naturgy, the energy supplier, as its own pages look: paper white, navy
 * type, the orange accent. Its name in our type with an orange full stop
 * (never its butterfly), then the two things he built side by side, each
 * named big and said in a few words: Omega, the customer area, over its
 * bill, usage and contracts; Monitor, the in-house dashboard, over its
 * processes, logs and events. The top right corner stays quiet: the bolt
 * breaks out of the board there.
 */
function naturgy(ctx: Ctx, face: Face) {
  const { w, h } = FACE;
  ctx.fillStyle = NATURGY.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = NATURGY.page;
  ctx.fillRect(0, 0, w, 168);
  ctx.fillStyle = "rgba(0, 69, 113, 0.12)";
  ctx.fillRect(0, 168, w, 3);
  const mark = say(ctx, face.title.toLowerCase(), 70, 124, { size: 132, colour: NATURGY.navy, tracking: -3 });
  ctx.fillStyle = NATURGY.orange;
  ctx.beginPath();
  ctx.arc(70 + mark + 24, 112, 16, 0, Math.PI * 2);
  ctx.fill();
  say(ctx, face.lines[0] ?? "", 70 + mark + 110, 112, { size: 46, family: fonts.mono(), colour: NATURGY.orange, tracking: 2, maxWidth: 1660 - mark - 180 });
  const columns = [
    { x: 70, w: 924 },
    { x: 1054, w: 924 },
  ];
  (face.products ?? []).slice(0, 2).forEach((product, k) => {
    const { x, w: cw } = columns[k];
    say(ctx, product.name, x - 6, 330, { size: 158, colour: NATURGY.navy, tracking: -2, maxWidth: cw });
    say(ctx, product.kind, x, 404, { size: 64, colour: NATURGY.orange, maxWidth: cw });
    say(ctx, product.what, x, 466, { size: 50, weight: 600, colour: NATURGY.ink, maxWidth: cw });
    const screen = { x, y: 500, w: cw, h: 318 };
    if (k === 0) omegaScreen(ctx, screen);
    else monitorScreen(ctx, screen);
  });
}

/**
 * The jigsaw cut of Pangea's face, shared with the 3D piece that flies into
 * it: square pieces of `PIECE.size` metres, and the missing piece's one knob
 * on its right edge (`PIECE.knob`: the circle's centre past the edge and
 * its radius). `PIECE.slot` is where the missing piece sits, in face pixels.
 */
export const PIECE = { size: 1.5, knob: { offset: 0.14, radius: 0.2 }, slot: { x: 1069, y: 426 } } as const;
const PX_PER_M = FACE.w / 18;

/** Points along one jigsaw edge from a to b, the knob bulging along `side` (+1 or -1 of the edge's normal) or none (0). */
export function jigsawEdge(ax: number, ay: number, bx: number, by: number, side: number, points: [number, number][]): void {
  const len = Math.hypot(bx - ax, by - ay);
  const tx = (bx - ax) / len;
  const ty = (by - ay) / len;
  const nx = -ty * side;
  const ny = tx * side;
  if (side === 0) {
    points.push([bx, by]);
    return;
  }
  const d = PIECE.knob.offset * PX_PER_M;
  const r = PIECE.knob.radius * PX_PER_M;
  const half = Math.sqrt(r * r - d * d);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const cx = mx + nx * d;
  const cy = my + ny * d;
  points.push([mx - tx * half, my - ty * half]);
  const a0 = Math.atan2(my - ty * half - cy, mx - tx * half - cx);
  const a1 = Math.atan2(my + ty * half - cy, mx + tx * half - cx);
  // The long way round, through the far side of the knob.
  const out = Math.atan2(ny, nx);
  let sweep = a1 - a0;
  const mid = (t: number) => a0 + sweep * t;
  if (Math.cos(mid(0.5) - out) < 0) sweep = sweep > 0 ? sweep - Math.PI * 2 : sweep + Math.PI * 2;
  for (let i = 1; i <= 20; i += 1) {
    const a = a0 + (sweep * i) / 20;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  points.push([bx, by]);
}

/** The box of the missing piece's picture on the face (the square and its knob), in face pixels: the 3D piece's texture. */
export const PIECE_BOX = {
  x: PIECE.slot.x - (PIECE.size * PX_PER_M) / 2,
  y: PIECE.slot.y - (PIECE.size * PX_PER_M) / 2,
  w: (PIECE.size + PIECE.knob.offset + PIECE.knob.radius) * PX_PER_M,
  h: PIECE.size * PX_PER_M,
} as const;

/** The jigsaw's grid: whole pieces, columns and rows around the missing piece (0, 0), so the card's border never cuts one. */
export const JIGSAW: { readonly cols: readonly [number, number]; readonly rows: readonly [number, number] } = { cols: [-1, 1], rows: [-1, 1] };
const SIZE_PX = PIECE.size * PX_PER_M;
/** The photo the jigsaw is cut from: exactly the grid's pieces. */
export const PHOTO: Box = {
  x: PIECE.slot.x - SIZE_PX / 2 + JIGSAW.cols[0] * SIZE_PX,
  y: PIECE.slot.y - SIZE_PX / 2 + JIGSAW.rows[0] * SIZE_PX,
  w: (JIGSAW.cols[1] - JIGSAW.cols[0] + 1) * SIZE_PX,
  h: (JIGSAW.rows[1] - JIGSAW.rows[0] + 1) * SIZE_PX,
};

/**
 * The knobs of piece (i, j)'s edges, [top, right, bottom, left], each +1
 * bulging out of the piece, -1 into it, 0 straight: one decision per edge
 * shared by both its pieces, straight on the photo's border, and the
 * missing piece's only knob on its right.
 */
export function pieceSides(i: number, j: number): [number, number, number, number] {
  const hash = (a: number, b: number, k: number) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453;
    return v - Math.floor(v) < 0.5 ? -1 : 1;
  };
  const [i0, i1] = JIGSAW.cols;
  const [j0, j1] = JIGSAW.rows;
  const isSlot = (a: number, b: number) => a === 0 && b === 0;
  // The vertical edge right of (a, b), the horizontal edge under it: +1 bulges into the next piece.
  const right = (a: number, b: number) => (a < i0 || a >= i1 ? 0 : isSlot(a, b) ? 1 : isSlot(a + 1, b) ? 0 : hash(a, b, 1));
  const below = (a: number, b: number) => (b < j0 || b >= j1 || isSlot(a, b) || isSlot(a, b + 1) ? 0 : hash(a, b, 2));
  return [0 - below(i, j - 1), right(i, j), below(i, j), 0 - right(i - 1, j)];
}

/** The outline of piece (i, j), in face pixels. */
function piecePath(i: number, j: number): Path2D {
  const size = SIZE_PX;
  const x0 = PIECE.slot.x - size / 2 + i * size;
  const y0 = PIECE.slot.y - size / 2 + j * size;
  const [top, right, bottom, left] = pieceSides(i, j);
  // Going clockwise on screen, jigsawEdge's +1 bulges into the piece: out of it is -1.
  const pts: [number, number][] = [[x0, y0]];
  jigsawEdge(x0, y0, x0 + size, y0, -top, pts);
  jigsawEdge(x0 + size, y0, x0 + size, y0 + size, -right, pts);
  jigsawEdge(x0 + size, y0 + size, x0, y0 + size, -bottom, pts);
  jigsawEdge(x0, y0 + size, x0, y0, -left, pts);
  const path = new Path2D();
  pts.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

/** A destination's name on its card, on a dark chip as the agency's site sets it. */
function chip(ctx: Ctx, text: string, x: number, y: number) {
  ctx.font = `600 38px ${fonts.body()}`;
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = "rgba(24, 28, 44, 0.62)";
  ctx.beginPath();
  ctx.roundRect(x, y - 56, w, 56, 10);
  ctx.fill();
  say(ctx, text, x + 18, y - 16, { size: 38, weight: 600, colour: "#f4f1ea" });
}

/** The cards' rows: under the header, down to the stack line's baseline. */
const CARDS = { top: PHOTO.y, bottom: 802 } as const;
/** The big card: a lagoon at sunset cut as a photo jigsaw (`PHOTO`), its name on a navy band under it. */
const FEATURE: Box = { x: PHOTO.x, y: CARDS.top, w: PHOTO.w, h: CARDS.bottom - CARDS.top };
/** The other destinations: [box, painter, which of `pieces` names it]. */
const GALLERY: [Box, keyof typeof POSTCARDS, number][] = [
  [{ x: 1357, y: CARDS.top, w: 300, h: 300 }, "terraces", 3],
  [{ x: 1357, y: CARDS.bottom - 300, w: 300, h: 300 }, "savannah", 2],
  [{ x: 1689, y: CARDS.top, w: 303, h: 360 }, "village", 0],
  [{ x: 1689, y: CARDS.bottom - 240, w: 303, h: 240 }, "andes", 1],
];

/**
 * Pangea, the travel agency's site: a white page, deep navy type, rounded
 * photo cards of destinations in warm tones. Its name in our type, "The
 * Travel Store" under it (its own full name), our tagline and our button.
 * One card per continent (the supercontinent's whole world); the big one is
 * a photo jigsaw whose last piece is missing until the 3D piece flies in.
 * `whole` paints the picture without the hole: the piece's own texture.
 */
function pangea(ctx: Ctx, face: Face, pieces: readonly string[], whole = false) {
  const { w, h } = FACE;
  ctx.fillStyle = PANGEA.paper;
  ctx.fillRect(0, 0, w, h);
  // The page's header: the menu as texture, a search button, the account.
  ctx.fillStyle = PANGEA.page;
  ctx.fillRect(0, 0, w, 112);
  ctx.fillStyle = "rgba(31, 42, 68, 0.1)";
  ctx.fillRect(0, 112, w, 3);
  // The menu ends well clear of the search button.
  bars(ctx, 1040, 46, [130, 150, 170, 100], 20, "rgba(31, 42, 68, 0.28)", 36);
  ctx.strokeStyle = PANGEA.navy;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(1790, 56, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(1786, 52, 11, 0, Math.PI * 2);
  ctx.moveTo(1794, 60);
  ctx.lineTo(1804, 70);
  ctx.stroke();
  ctx.fillStyle = PANGEA.navy;
  ctx.beginPath();
  ctx.roundRect(1846, 24, 146, 64, 32);
  ctx.fill();
  bars(ctx, 1876, 48, [86], 16, "rgba(244, 242, 237, 0.7)");
  // The cards.
  const feature = rounded(ctx, FEATURE, 30);
  card(ctx, feature, PANGEA.page);
  for (const [box, scene, name] of GALLERY) {
    const path = rounded(ctx, box, 26);
    card(ctx, path, PANGEA.page);
    ctx.save();
    ctx.clip(path);
    POSTCARDS[scene](ctx, box);
    ctx.restore();
    chip(ctx, pieces[name] ?? "", box.x + 18, box.y + box.h - 18);
  }
  // The big card: the photo, every cut printed faint over it, the missing piece's place dark, its name on the band under it.
  ctx.save();
  ctx.clip(feature);
  POSTCARDS.lagoon(ctx, PHOTO);
  for (let j = JIGSAW.rows[0]; j <= JIGSAW.rows[1]; j += 1) {
    for (let i = JIGSAW.cols[0]; i <= JIGSAW.cols[1]; i += 1) {
      if (i === 0 && j === 0) continue;
      const path = piecePath(i, j);
      ctx.strokeStyle = "rgba(255, 246, 232, 0.45)";
      ctx.lineWidth = 3;
      ctx.stroke(path);
      ctx.save();
      ctx.translate(1.5, 2);
      ctx.strokeStyle = "rgba(40, 30, 40, 0.3)";
      ctx.lineWidth = 2;
      ctx.stroke(path);
      ctx.restore();
    }
  }
  const band = PHOTO.y + PHOTO.h;
  ctx.fillStyle = PANGEA.navy;
  ctx.fillRect(FEATURE.x, band, FEATURE.w, FEATURE.y + FEATURE.h - band);
  ctx.restore();
  say(ctx, pieces[4] ?? "", FEATURE.x + 32, band + 76, { size: 48, weight: 600, colour: "#f4f1ea", maxWidth: FEATURE.w - 200 });
  bars(ctx, FEATURE.x + FEATURE.w - 152, band + 52, [120], 16, "rgba(244, 241, 234, 0.45)");
  const hole = piecePath(0, 0);
  if (!whole) {
    ctx.fillStyle = PANGEA.hole;
    ctx.fill(hole);
    ctx.save();
    ctx.clip(hole);
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 16;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.stroke(hole);
    ctx.restore();
    ctx.save();
    ctx.setLineDash([16, 12]);
    ctx.strokeStyle = "rgba(244, 241, 234, 0.8)";
    ctx.lineWidth = 4;
    ctx.stroke(hole);
    ctx.restore();
  } else {
    ctx.strokeStyle = "rgba(40, 30, 40, 0.4)";
    ctx.lineWidth = 3;
    ctx.stroke(hole);
  }
  // The words: the name big, its full name, our tagline, our button, the stack.
  // The text column ends a gutter short of the photo.
  const column = PHOTO.x - 74 - 40;
  say(ctx, face.title, 74, 330, { size: 206, colour: PANGEA.navy, tracking: -4, maxWidth: column });
  say(ctx, "THE TRAVEL STORE", 82, 396, { size: 46, weight: 500, colour: PANGEA.navy, tracking: 9, maxWidth: column });
  ctx.font = `700 66px ${fonts.body()}`;
  twoLines(ctx, face.lines[0] ?? "", column).forEach((line, k) => say(ctx, line, 78, 496 + k * 74, { size: 66, colour: PANGEA.navy, maxWidth: column }));
  const cta = `${face.cta ?? ""}  →`;
  ctx.font = `700 48px ${fonts.body()}`;
  const bw = Math.min(column, ctx.measureText(cta).width + 84);
  ctx.fillStyle = PANGEA.navy;
  ctx.beginPath();
  ctx.roundRect(78, 628, bw, 92, 46);
  ctx.fill();
  say(ctx, cta, 78 + 42, 690, { size: 48, colour: "#f4f2ed", maxWidth: bw - 84 });
  say(ctx, face.lines[1] ?? "", 80, 790, { size: 32, family: fonts.mono(), colour: PANGEA.ink, maxWidth: column - 6 });
}

/** The garage on Telpark's card: a ramp in one-point perspective, navy, its bands and lines in the brand's orange, a car coming up. */
function garage(ctx: Ctx, b: Box) {
  const shape = rounded(ctx, b, 30);
  card(ctx, shape, "#161a36");
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = "#161a36";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const vx = b.x + b.w / 2;
  const vy = b.y + b.h * 0.4;
  const floor = ctx.createLinearGradient(0, vy, 0, b.y + b.h);
  floor.addColorStop(0, "#272c55");
  floor.addColorStop(1, "#454c7c");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(vx - 50, vy + 34);
  ctx.lineTo(vx + 50, vy + 34);
  ctx.lineTo(b.x + b.w + 160, b.y + b.h);
  ctx.lineTo(b.x - 160, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 7; k += 1) {
    const s = 1 - k * 0.13;
    ctx.fillStyle = `rgba(250, 240, 222, ${0.85 - k * 0.1})`;
    ctx.fillRect(vx - 200 * s, vy - 250 * s, 400 * s, 8 * s + 2);
  }
  for (let k = 5; k >= 0; k -= 1) {
    const s = 1 - k * 0.15;
    for (const side of [-1, 1]) {
      const pw = 46 * s;
      const px = vx + side * 230 * s - (side < 0 ? pw : 0);
      ctx.fillStyle = "#262b52";
      ctx.fillRect(px, vy - 300 * s, pw, 640 * s);
      ctx.fillStyle = TELPARK.orange;
      ctx.fillRect(px, vy + 96 * s, pw, 34 * s);
    }
  }
  ctx.strokeStyle = TELPARK.orange;
  ctx.lineWidth = 5;
  for (let i = -4; i <= 4; i += 1) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(vx + i * 10, vy + 40);
    ctx.lineTo(vx + i * 110, b.y + b.h);
    ctx.stroke();
  }
  ctx.fillStyle = TELPARK.orange;
  ctx.beginPath();
  ctx.moveTo(vx, b.y + b.h - 80);
  ctx.lineTo(vx + 30, b.y + b.h - 26);
  ctx.lineTo(vx - 30, b.y + b.h - 26);
  ctx.closePath();
  ctx.fill();
  // The car coming up the ramp, headlights on: the space is booked, it drives straight in.
  const car = { x: vx, y: vy + 190, w: 250 };
  ctx.fillStyle = "#0c0d18";
  ctx.beginPath();
  ctx.moveTo(car.x - car.w * 0.36, car.y - 78);
  ctx.lineTo(car.x + car.w * 0.36, car.y - 78);
  ctx.lineTo(car.x + car.w * 0.46, car.y - 34);
  ctx.lineTo(car.x + car.w / 2, car.y + 26);
  ctx.lineTo(car.x - car.w / 2, car.y + 26);
  ctx.lineTo(car.x - car.w * 0.46, car.y - 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a2d48";
  ctx.beginPath();
  ctx.moveTo(car.x - car.w * 0.3, car.y - 72);
  ctx.lineTo(car.x + car.w * 0.3, car.y - 72);
  ctx.lineTo(car.x + car.w * 0.38, car.y - 40);
  ctx.lineTo(car.x - car.w * 0.38, car.y - 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = TELPARK.orange;
  ctx.fillRect(car.x - car.w * 0.2, car.y - 4, car.w * 0.4, 5);
  for (const side of [-1, 1]) {
    const hx = car.x + side * car.w * 0.36;
    const glow = ctx.createRadialGradient(hx, car.y - 10, 0, hx, car.y - 10, 70);
    glow.addColorStop(0, "rgba(255, 246, 230, 0.9)");
    glow.addColorStop(0.3, "rgba(255, 236, 205, 0.35)");
    glow.addColorStop(1, "rgba(255, 236, 205, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(hx - 70, car.y - 80, 140, 140);
    ctx.fillStyle = "#f6efe2";
    ctx.beginPath();
    ctx.ellipse(hx, car.y - 10, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The P, in the brand's orange.
  ctx.fillStyle = TELPARK.orange;
  ctx.beginPath();
  ctx.roundRect(b.x + 30, b.y + 30, 130, 130, 24);
  ctx.fill();
  ctx.fillStyle = "#161a36";
  ctx.font = `800 112px ${fonts.display()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("P", b.x + 95, b.y + 100);
  ctx.restore();
}

function pin(ctx: Ctx, x: number, y: number, colour: string) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y - 6, 14, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(x, y + 20);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 6, 5, 0, Math.PI * 2);
  ctx.stroke();
}

function calendar(ctx: Ctx, x: number, y: number, colour: string) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 16, 36, 34, 6);
  ctx.moveTo(x - 18, y - 4);
  ctx.lineTo(x + 18, y - 4);
  ctx.moveTo(x - 9, y - 24);
  ctx.lineTo(x - 9, y - 12);
  ctx.moveTo(x + 9, y - 24);
  ctx.lineTo(x + 9, y - 12);
  ctx.stroke();
}

/**
 * Telpark, parking reservations, as its booking page looks: white, its
 * orange, deep navy type. Its name in our type (no styled letter of
 * theirs), our line, the search (where, arrival, departure, the orange
 * button), one result with its price a day and the button to book, and the
 * garage the car drives out of (the 3D car parks on the ledge beside it).
 */
function telpark(ctx: Ctx, face: Face) {
  const { w, h } = FACE;
  ctx.fillStyle = TELPARK.paper;
  ctx.fillRect(0, 0, w, h);
  say(ctx, face.title.toLowerCase(), 70, 184, { size: 186, colour: TELPARK.orange, tracking: -5, maxWidth: 640 });
  // The kicker's capitals start well below the p's descender.
  say(ctx, face.lines[1] ?? "", 78, 276, { size: 40, family: fonts.mono(), colour: TELPARK.navy, tracking: 2, maxWidth: 640 });
  ctx.font = `700 54px ${fonts.body()}`;
  twoLines(ctx, face.lines[0] ?? "", 660).forEach((line, k) => say(ctx, line, 762, 128 + k * 64, { size: 54, colour: TELPARK.navy, maxWidth: 660 }));
  // The search.
  const bar = rounded(ctx, { x: 70, y: 300, w: 1350, h: 150 }, 75);
  card(ctx, bar, TELPARK.page, "rgba(29, 34, 69, 0.18)");
  const fields = face.search ?? [];
  const widths = [480, 340, 340];
  let fx = 110;
  fields.slice(0, 3).forEach(([label, value], k) => {
    if (k === 0) pin(ctx, fx + 16, 372, TELPARK.orange);
    else calendar(ctx, fx + 16, 375, TELPARK.orange);
    say(ctx, label ?? "", fx + 56, 358, { size: 32, weight: 500, colour: TELPARK.ink, maxWidth: widths[k] - 90 });
    say(ctx, value ?? "", fx + 56, 412, { size: 44, colour: TELPARK.navy, maxWidth: widths[k] - 90 });
    fx += widths[k];
    if (k < 2) {
      ctx.fillStyle = TELPARK.rule;
      ctx.fillRect(fx - 24, 326, 3, 98);
    }
  });
  ctx.fillStyle = TELPARK.orange;
  ctx.beginPath();
  ctx.arc(1346, 375, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TELPARK.page;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(1340, 369, 18, 0, Math.PI * 2);
  ctx.moveTo(1354, 383);
  ctx.lineTo(1368, 397);
  ctx.stroke();
  // One result: the car park, what it offers (as texture), its price a day, the button.
  const spot = face.spot;
  const result = rounded(ctx, { x: 70, y: 492, w: 1350, h: 312 }, 28);
  card(ctx, result, TELPARK.page, "rgba(29, 34, 69, 0.12)");
  ctx.lineWidth = 3;
  ctx.strokeStyle = TELPARK.rule;
  ctx.stroke(result);
  say(ctx, spot?.name ?? "", 116, 600, { size: 70, colour: TELPARK.navy, maxWidth: 700 });
  bars(ctx, 118, 636, [420], 18, "rgba(29, 34, 69, 0.25)");
  for (let k = 0; k < 4; k += 1) {
    const x = 118 + k * 190;
    ctx.strokeStyle = "rgba(29, 34, 69, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + 18, 726, 18, 0, Math.PI * 2);
    ctx.stroke();
    bars(ctx, x + 48, 718, [110], 16, "rgba(29, 34, 69, 0.3)");
  }
  ctx.font = `600 48px ${fonts.body()}`;
  const per = ctx.measureText(spot?.per ?? "").width;
  say(ctx, spot?.per ?? "", 1380, 614, { size: 48, weight: 600, colour: TELPARK.navy, align: "right" });
  say(ctx, spot?.price ?? "", 1380 - per - 10, 614, { size: 112, colour: TELPARK.orange, align: "right", tracking: -2 });
  ctx.fillStyle = TELPARK.orange;
  ctx.beginPath();
  ctx.roundRect(1060, 668, 320, 96, 48);
  ctx.fill();
  say(ctx, spot?.cta ?? "", 1220, 733, { size: 50, colour: TELPARK.page, align: "center", maxWidth: 270 });
  garage(ctx, { x: 1470, y: 48, w: 522, h: 756 });
}

export function paintTrivision(faces: readonly Face[], pieces: readonly string[]): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(CLOUD_ATLAS.w, CLOUD_ATLAS.h);
  const painters = [
    (c: Ctx) => naturgy(c, faces[0]),
    (c: Ctx) => pangea(c, faces[1], pieces),
    (c: Ctx) => telpark(c, faces[2]),
  ];
  const random = createRandom(2024);
  painters.forEach((paint, i) => {
    ctx.save();
    ctx.translate(0, i * FACE.h);
    ctx.beginPath();
    ctx.rect(0, 0, FACE.w, FACE.h);
    ctx.clip();
    paint(ctx);
    // Vinyl: a faint sheen and a few scuffs.
    for (let k = 0; k < 400; k += 1) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.fillRect(random() * FACE.w, random() * FACE.h, 2, 6);
    }
    ctx.restore();
  });
  return canvas;
}

/** The missing piece's picture (`PIECE_BOX` of Pangea's face, painted whole): the texture of the 3D piece that flies into the hole. */
export function paintPiece(face: Face, pieces: readonly string[]): HTMLCanvasElement {
  const [full, fctx] = makeCanvas(FACE.w, FACE.h);
  pangea(fctx, face, pieces, true);
  const [canvas, ctx] = makeCanvas(Math.ceil(PIECE_BOX.w), Math.ceil(PIECE_BOX.h));
  ctx.drawImage(full, PIECE_BOX.x, PIECE_BOX.y, PIECE_BOX.w, PIECE_BOX.h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** The nameplate under the catwalk: cream enamel with ink type. */
export function paintCloudSigns(nameplate: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(2048, 200);
  ctx.fillStyle = "#f6ead2";
  ctx.fillRect(0, 0, 2048, 200);
  ctx.fillStyle = "#1c0f33";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 92px ${fonts.mono()}`;
  const width = ctx.measureText(nameplate).width;
  ctx.save();
  ctx.translate(1024, 104);
  ctx.scale(Math.min(1, 1900 / width), 1);
  ctx.fillText(nameplate, 0, 0);
  ctx.restore();
  return canvas;
}
