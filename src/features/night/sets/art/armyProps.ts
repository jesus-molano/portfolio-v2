import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";
import { ARMY_STEEL } from "./army";

/**
 * The army stop's props, painted once: the hessian of the sandbags and
 * one atlas for everything a sappers' site leaves on the verge (the
 * ammunition crates, their battens, rope and ironwork, the steel ammo
 * cans, the jerrycans, the cable drum, the bridge panels' olive paint
 * and the raw timber). Every prop maps its faces into the atlas, so the
 * whole kit is one material. Stencils in condensed capitals with stencil
 * bridges, Spanish on both locales (a real depot on the island), lot
 * numbers and weights, no insignia. Deterministic (createRandom).
 */

type Ctx = CanvasRenderingContext2D;
type Random = () => number;

/** A region of the atlas, in canvas pixels. */
export type Region = { x: number; y: number; w: number; h: number };
/** A region as texture coordinates (three flips canvases: v grows up). */
export type UvRect = { u0: number; v0: number; u1: number; v1: number };

export const KIT_SIZE = 1024;

/**
 * The atlas. Each crate face keeps its own aspect (a side is 0.92 x 0.30 m,
 * an end 0.44 x 0.30, the lid 0.94 x 0.44), so planks and letters are
 * not stretched.
 */
export const KIT_ATLAS = {
  sideA: { x: 0, y: 0, w: 1024, h: 300 },
  sideB: { x: 0, y: 300, w: 1024, h: 300 },
  end: { x: 0, y: 600, w: 410, h: 280 },
  lid: { x: 410, y: 600, w: 614, h: 280 },
  batten: { x: 0, y: 880, w: 256, h: 32 },
  timber: { x: 0, y: 912, w: 256, h: 32 },
  steel: { x: 0, y: 944, w: 256, h: 80 },
  canSide: { x: 256, y: 880, w: 232, h: 144 },
  jerryFace: { x: 488, y: 880, w: 106, h: 144 },
  jerryEdge: { x: 594, y: 880, w: 46, h: 144 },
  flange: { x: 640, y: 880, w: 144, h: 144 },
  canPlain: { x: 784, y: 880, w: 80, h: 144 },
  cable: { x: 864, y: 880, w: 160, h: 72 },
  iron: { x: 864, y: 952, w: 80, h: 72 },
  rope: { x: 944, y: 952, w: 80, h: 72 },
} as const satisfies Record<string, Region>;

export type KitPart = keyof typeof KIT_ATLAS;

/** A region's texture coordinates, inset half a texel so mipmaps do not bleed the neighbours in. */
export function uvRect(region: Region, size = KIT_SIZE, inset = 1.5): UvRect {
  return {
    u0: (region.x + inset) / size,
    u1: (region.x + region.w - inset) / size,
    v0: 1 - (region.y + region.h - inset) / size,
    v1: 1 - (region.y + inset) / size,
  };
}

/** Olive drab as a depot paints it, the raw pine under it, the stencil inks. */
const PAINT = {
  // Greener than it looks by day: the sodium lamps eat the green.
  olive: "#4c5c33",
  oliveDark: "#36412a",
  pine: "#9c8058",
  pineDark: "#6e5636",
  yellow: "#e3cf72",
  white: "#e9e4cf",
  iron: "#3a3836",
  rope: "#c9b383",
  rubber: "#1d1a20",
  hessian: "#8c7d5e",
} as const;

/* ------------------------------------------------------------ helpers */

function noiseSpeckle(ctx: Ctx, r: Region, random: Random, count: number, colors: string[], size: [number, number]) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    const s = size[0] + random() * (size[1] - size[0]);
    ctx.fillRect(r.x + random() * r.w, r.y + random() * r.h, s, s);
  }
}

/** A chip of paint off, showing the wood (or the steel) under it: a ragged little polygon. */
function chip(ctx: Ctx, x: number, y: number, size: number, random: Random, under: string) {
  ctx.fillStyle = under;
  ctx.beginPath();
  const n = 6 + Math.floor(random() * 4);
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const rr = size * (0.45 + random() * 0.7);
    const px = x + Math.cos(a) * rr * 1.4;
    const py = y + Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Painted planks across a region: seams, grain, knots and nail heads near the ends. */
function planks(ctx: Ctx, r: Region, count: number, random: Random, base: string, horizontal = true) {
  ctx.fillStyle = base;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const span = horizontal ? r.h : r.w;
  const along = horizontal ? r.w : r.h;
  const step = span / count;
  for (let i = 0; i < count; i += 1) {
    const s0 = i * step;
    // Each plank a shade off the next: the paint went on board by board.
    ctx.fillStyle = `rgba(${random() < 0.5 ? "255,250,220" : "20,24,10"}, ${0.03 + random() * 0.05})`;
    if (horizontal) ctx.fillRect(r.x, r.y + s0, r.w, step);
    else ctx.fillRect(r.x + s0, r.y, step, r.h);
    // Grain under the paint: long, slightly wavy strokes.
    for (let g = 0; g < 9; g += 1) {
      const off = s0 + 3 + random() * (step - 6);
      ctx.strokeStyle = `rgba(20, 22, 8, ${0.08 + random() * 0.12})`;
      ctx.lineWidth = 0.6 + random() * 1.1;
      ctx.beginPath();
      const amp = 0.6 + random() * 1.8;
      const phase = random() * 6;
      for (let t = 0; t <= along; t += 12) {
        const w = off + Math.sin(t / (30 + g * 7) + phase) * amp;
        if (horizontal) (t === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, r.x + t, r.y + w);
        else (t === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, r.x + w, r.y + t);
      }
      ctx.stroke();
    }
    if (random() < 0.6) {
      const k = along * (0.15 + random() * 0.7);
      const c = s0 + step * (0.3 + random() * 0.4);
      ctx.fillStyle = "rgba(25, 22, 10, 0.35)";
      ctx.beginPath();
      if (horizontal) ctx.ellipse(r.x + k, r.y + c, 7 + random() * 6, 3 + random() * 2, 0, 0, Math.PI * 2);
      else ctx.ellipse(r.x + c, r.y + k, 3 + random() * 2, 7 + random() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // The seam: a dark gap and the next board's lit edge.
    if (i > 0) {
      ctx.fillStyle = "rgba(12, 12, 6, 0.75)";
      if (horizontal) ctx.fillRect(r.x, r.y + s0 - 1.5, r.w, 3);
      else ctx.fillRect(r.x + s0 - 1.5, r.y, 3, r.h);
      ctx.fillStyle = "rgba(255, 245, 200, 0.12)";
      if (horizontal) ctx.fillRect(r.x, r.y + s0 + 1.5, r.w, 1.5);
      else ctx.fillRect(r.x + s0 + 1.5, r.y, 1.5, r.h);
    }
  }
}

/** Wear on painted wood: chips to the pine along the edges and seams, scuffs, dust low down. */
function wear(ctx: Ctx, r: Region, random: Random, chips: number, under = PAINT.pine) {
  for (let i = 0; i < chips; i += 1) {
    const edge = random();
    let x: number;
    let y: number;
    if (edge < 0.55) {
      // Along the edges, where hands and forklifts hit.
      x = r.x + random() * r.w;
      y = random() < 0.5 ? r.y + random() * 10 : r.y + r.h - random() * 10;
    } else if (edge < 0.8) {
      x = random() < 0.5 ? r.x + random() * 14 : r.x + r.w - random() * 14;
      y = r.y + random() * r.h;
    } else {
      x = r.x + random() * r.w;
      y = r.y + random() * r.h;
    }
    chip(ctx, x, y, 1.2 + random() * 3.2, random, random() < 0.6 ? under : PAINT.pineDark);
  }
  for (let i = 0; i < 6; i += 1) {
    ctx.strokeStyle = `rgba(230, 220, 180, ${0.05 + random() * 0.07})`;
    ctx.lineWidth = 1 + random() * 2;
    const x = r.x + random() * r.w;
    const y = r.y + random() * r.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 60, y + (random() - 0.5) * 12);
    ctx.stroke();
  }
  // Dust and the damp of the ground on the lower third.
  const g = ctx.createLinearGradient(0, r.y + r.h * 0.6, 0, r.y + r.h);
  g.addColorStop(0, "rgba(60, 48, 30, 0)");
  g.addColorStop(1, "rgba(60, 48, 30, 0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/**
 * Stencilled capitals: the letters on a scratch canvas, cut by the
 * stencil's bridges (a gap through every letter's middle), sprayed with
 * a little overspray, then worn where the paint has flaked.
 */
function stencil(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, random: Random, align: CanvasTextAlign = "center", maxWidth?: number) {
  const font = `${size}px ${fonts.condensed()}`;
  ctx.font = font;
  const width = Math.min(maxWidth ?? Infinity, ctx.measureText(text).width);
  const pad = Math.ceil(size * 0.3);
  const [scratch, s] = makeCanvas(Math.ceil(width + pad * 2), Math.ceil(size * 1.4 + pad));
  s.font = font;
  s.textBaseline = "alphabetic";
  s.fillStyle = color;
  s.shadowColor = color;
  s.shadowBlur = size * 0.06;
  s.fillText(text, pad, pad + size, maxWidth);
  s.shadowBlur = 0;
  s.globalCompositeOperation = "destination-out";
  // The bridges: a gap through the middle of the capitals, and a few through bowls.
  s.fillRect(0, pad + size * 0.47, scratch.width, Math.max(1.5, size * 0.055));
  for (let i = 0; i < 40; i += 1) {
    s.globalAlpha = 0.5 + random() * 0.5;
    const r = 0.5 + random() * size * 0.03;
    s.beginPath();
    s.arc(random() * scratch.width, pad + random() * size, r, 0, Math.PI * 2);
    s.fill();
  }
  s.globalAlpha = 1;
  s.globalCompositeOperation = "source-over";
  const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ctx.globalAlpha = 0.86;
  ctx.drawImage(scratch, left - pad, y - size - pad);
  ctx.globalAlpha = 1;
}

/** The "this side up" mark: two arrows over a bar. */
function upArrows(ctx: Ctx, cx: number, cy: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  for (const dx of [-0.32, 0.32]) {
    const x = cx + dx * size;
    ctx.beginPath();
    ctx.moveTo(x, cy - size * 0.5);
    ctx.lineTo(x + size * 0.2, cy - size * 0.18);
    ctx.lineTo(x + size * 0.07, cy - size * 0.18);
    ctx.lineTo(x + size * 0.07, cy + size * 0.32);
    ctx.lineTo(x - size * 0.07, cy + size * 0.32);
    ctx.lineTo(x - size * 0.07, cy - size * 0.18);
    ctx.lineTo(x - size * 0.2, cy - size * 0.18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(cx - size * 0.55, cy + size * 0.4, size * 1.1, size * 0.09);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------ sandbag */

export const BURLAP = { w: 512, h: 256 } as const;

/**
 * Hessian round a bag: u runs round its girth (the sewn seam along the
 * underside, at u 0 and 1), v along its length (the tied end at v 0, the
 * sewn end at v 1). A loose plain weave, slubs, sand dust, creases where
 * the ends were gathered.
 */
export function paintBurlap(): HTMLCanvasElement {
  const { w, h } = BURLAP;
  const [canvas, ctx] = makeCanvas(w, h);
  const random = createRandom(7319);
  ctx.fillStyle = PAINT.hessian;
  ctx.fillRect(0, 0, w, h);
  // Warp and weft, every thread its own shade and weight.
  const pitch = 4;
  for (let x = 0; x < w; x += pitch) {
    ctx.fillStyle = `rgba(${random() < 0.5 ? "70,52,24" : "235,215,160"}, ${0.03 + random() * 0.05})`;
    ctx.fillRect(x, 0, 1.6 + random() * 1.2, h);
  }
  for (let y = 0; y < h; y += pitch) {
    ctx.fillStyle = `rgba(${random() < 0.5 ? "70,52,24" : "235,215,160"}, ${0.03 + random() * 0.05})`;
    ctx.fillRect(0, y, w, 1.6 + random() * 1.2);
  }
  // The over-under: a checker of tiny shadows.
  for (let y = 0; y < h; y += pitch) {
    for (let x = (y / pitch) % 2 ? 0 : pitch; x < w; x += pitch * 2) {
      ctx.fillStyle = "rgba(40, 28, 12, 0.2)";
      ctx.fillRect(x, y, pitch, pitch * 0.5);
    }
  }
  // Slubs: thick knots in the yarn.
  noiseSpeckle(ctx, { x: 0, y: 0, w, h }, random, 160, ["rgba(225, 205, 150, 0.35)", "rgba(80, 60, 30, 0.3)"], [2, 5]);
  // Blotches of sand and damp.
  for (let i = 0; i < 26; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const r = 14 + random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = random() < 0.6;
    g.addColorStop(0, dark ? "rgba(70, 50, 25, 0.22)" : "rgba(230, 210, 160, 0.18)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Folds round the girth where the sand settled: a soft shadow under a lit crest.
  for (let i = 0; i < 34; i += 1) {
    const y = random() * h;
    const x0 = random() * w;
    const len = w * (0.15 + random() * 0.35);
    const slope = (random() - 0.5) * 0.5;
    const bend = (random() - 0.5) * 14;
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(35, 24, 10, ${0.18 + random() * 0.2})`;
    ctx.lineWidth = 3 + random() * 5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(x0 + len / 2, y + slope * len * 0.5 + bend, x0 + len, y + slope * len);
    ctx.stroke();
    ctx.strokeStyle = `rgba(235, 215, 165, ${0.08 + random() * 0.1})`;
    ctx.lineWidth = 1.5 + random() * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y - 4);
    ctx.quadraticCurveTo(x0 + len / 2, y - 4 + slope * len * 0.5 + bend, x0 + len, y - 4 + slope * len);
    ctx.stroke();
  }
  // The underside (u 0 and 1): ground dirt and the stitched seam.
  for (const [x0, x1] of [
    [0, 90],
    [w, w - 90],
  ]) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "rgba(45, 32, 18, 0.55)");
    g.addColorStop(1, "rgba(45, 32, 18, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), 0, 90, h);
  }
  ctx.fillStyle = "rgba(35, 25, 12, 0.7)";
  for (let y = 4; y < h; y += 9) {
    ctx.fillRect(2, y, 2, 5);
    ctx.fillRect(w - 4, y + 4, 2, 5);
  }
  // Gathered ends: creases running in from both ends, darker at the tie.
  for (const [y0, dir, depth, alpha] of [
    [0, 1, 70, 0.5],
    [h, -1, 34, 0.35],
  ] as const) {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + dir * depth);
    g.addColorStop(0, `rgba(40, 28, 14, ${alpha})`);
    g.addColorStop(1, "rgba(40, 28, 14, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(y0, y0 + dir * depth), w, depth);
    for (let i = 0; i < 26; i += 1) {
      const x = random() * w;
      const len = depth * (0.5 + random() * 0.9);
      ctx.strokeStyle = `rgba(35, 24, 10, ${0.2 + random() * 0.25})`;
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + (random() - 0.5) * 20, y0 + (dir * len) / 2, x + (random() - 0.5) * 30, y0 + dir * len);
      ctx.stroke();
      ctx.strokeStyle = `rgba(240, 220, 170, ${0.08 + random() * 0.1})`;
      ctx.beginPath();
      ctx.moveTo(x + 3, y0);
      ctx.lineTo(x + 3 + (random() - 0.5) * 24, y0 + dir * len * 0.8);
      ctx.stroke();
    }
  }
  // The tie: a band of twine round the neck.
  ctx.fillStyle = "rgba(60, 44, 22, 0.75)";
  ctx.fillRect(0, 18, w, 7);
  ctx.fillStyle = "rgba(230, 205, 150, 0.25)";
  for (let x = 0; x < w; x += 6) ctx.fillRect(x, 19, 3, 2);
  return canvas;
}

/* ------------------------------------------------------------ the kit */

function crateSide(ctx: Ctx, r: Region, random: Random, lines: { big: string; lot: string; weight: string; band: boolean }) {
  planks(ctx, r, 3, random, PAINT.olive);
  // A coloured band (the filler's mark) toward one end, as many depots paint.
  if (lines.band) {
    ctx.fillStyle = "rgba(196, 158, 64, 0.55)";
    ctx.fillRect(r.x + r.w * 0.8, r.y + 6, r.w * 0.045, r.h - 12);
  }
  const ink = PAINT.yellow;
  stencil(ctx, lines.big, r.x + r.w * 0.44, r.y + r.h * 0.43, 104, ink, random, "center", r.w * 0.62);
  stencil(ctx, lines.lot, r.x + r.w * 0.44, r.y + r.h * 0.7, 48, ink, random, "center", r.w * 0.62);
  stencil(ctx, lines.weight, r.x + r.w * 0.44, r.y + r.h * 0.9, 38, PAINT.white, random, "center", r.w * 0.62);
  wear(ctx, r, random, 45);
}

function crateEnd(ctx: Ctx, r: Region, random: Random) {
  planks(ctx, r, 3, random, PAINT.olive);
  upArrows(ctx, r.x + r.w / 2, r.y + r.h * 0.38, 110, PAINT.yellow);
  stencil(ctx, "1 / 2", r.x + r.w / 2, r.y + r.h * 0.86, 44, PAINT.white, random);
  wear(ctx, r, random, 22);
}

function crateLid(ctx: Ctx, r: Region, random: Random) {
  planks(ctx, r, 2, random, PAINT.olive);
  stencil(ctx, "MUNICIÓN", r.x + r.w / 2, r.y + r.h * 0.42, 92, PAINT.yellow, random, "center", r.w * 0.7);
  stencil(ctx, "NO ARRASTRAR · NO VOLCAR", r.x + r.w / 2, r.y + r.h * 0.72, 40, PAINT.white, random, "center", r.w * 0.8);
  wear(ctx, r, random, 32);
  // Boot scuffs and dust on the top.
  for (let i = 0; i < 5; i += 1) {
    const x = r.x + random() * r.w;
    const y = r.y + random() * r.h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40);
    g.addColorStop(0, "rgba(150, 130, 95, 0.18)");
    g.addColorStop(1, "rgba(150, 130, 95, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, y - 40, 80, 80);
  }
}

function painted(ctx: Ctx, r: Region, random: Random, base: string, chips: number, under: string, rust = false) {
  ctx.fillStyle = base;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  noiseSpeckle(ctx, r, random, Math.round((r.w * r.h) / 30), ["rgba(255,250,220,0.05)", "rgba(10,12,4,0.08)"], [1, 3]);
  for (let i = 0; i < chips; i += 1) chip(ctx, r.x + random() * r.w, r.y + random() * r.h, 1 + random() * 3, random, under);
  if (rust) {
    for (let i = 0; i < chips / 2; i += 1) {
      const x = r.x + random() * r.w;
      const y = r.y + random() * r.h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 6 + random() * 8);
      g.addColorStop(0, "rgba(120, 60, 25, 0.45)");
      g.addColorStop(1, "rgba(120, 60, 25, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 14, y - 14, 28, 28);
    }
  }
}

function canSide(ctx: Ctx, r: Region, random: Random) {
  painted(ctx, r, random, "#56603a", 30, "#6c6a64", true);
  // Pressed ribs: a lit line over a shadow.
  for (const t of [0.22, 0.78]) {
    ctx.fillStyle = "rgba(255, 255, 240, 0.25)";
    ctx.fillRect(r.x + 8, r.y + r.h * t - 3, r.w - 16, 2);
    ctx.fillStyle = "rgba(20, 20, 10, 0.3)";
    ctx.fillRect(r.x + 8, r.y + r.h * t, r.w - 16, 3);
  }
  stencil(ctx, "7,62 · 4 × 200", r.x + r.w / 2, r.y + r.h * 0.52, 34, PAINT.yellow, random, "center", r.w * 0.8);
  stencil(ctx, "LOTE 2B-118", r.x + r.w / 2, r.y + r.h * 0.7, 22, PAINT.yellow, random, "center", r.w * 0.8);
}

function jerryFace(ctx: Ctx, r: Region, random: Random) {
  painted(ctx, r, random, "#55603a", 26, "#5e5c58", true);
  // The pressed X and the rim round it: lit on the upper left, shadow lower right.
  const m = 9;
  const x0 = r.x + m;
  const y0 = r.y + m;
  const x1 = r.x + r.w - m;
  const y1 = r.y + r.h - m;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 235, 0.35)";
  ctx.strokeRect(x0 - 1, y0 - 1, x1 - x0, y1 - y0);
  ctx.strokeStyle = "rgba(15, 15, 8, 0.4)";
  ctx.strokeRect(x0 + 2, y0 + 2, x1 - x0, y1 - y0);
  for (const [ax, ay, bx, by] of [
    [x0, y0, x1, y1],
    [x1, y0, x0, y1],
  ]) {
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(15, 15, 8, 0.32)";
    ctx.beginPath();
    ctx.moveTo(ax + 2, ay + 2);
    ctx.lineTo(bx + 2, by + 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 235, 0.3)";
    ctx.beginPath();
    ctx.moveTo(ax - 1, ay - 1);
    ctx.lineTo(bx - 1, by - 1);
    ctx.stroke();
  }
  // Fuel down the face from the spout.
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.7);
  g.addColorStop(0, "rgba(40, 30, 15, 0.35)");
  g.addColorStop(1, "rgba(40, 30, 15, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(r.x + r.w * 0.72, r.y, r.w * 0.16, r.h * 0.7);
}

function flange(ctx: Ctx, r: Region, random: Random) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rad = r.w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.clip();
  planks(ctx, r, 5, random, "#9a7a4c", false);
  // Two battens across the planks, bolted.
  ctx.fillStyle = "rgba(70, 50, 25, 0.55)";
  ctx.fillRect(r.x, cy - rad * 0.42, r.w, rad * 0.16);
  ctx.fillRect(r.x, cy + rad * 0.26, r.w, rad * 0.16);
  ctx.restore();
  ctx.fillStyle = PAINT.iron;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rad * 0.62, cy + Math.sin(a) * rad * 0.62, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The axle hole with its steel bush.
  ctx.fillStyle = "#6d6a64";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0d0b10";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.13, 0, Math.PI * 2);
  ctx.fill();
  stencil(ctx, "ZPR · 07", cx, cy + rad * 0.58, 20, PAINT.white, random);
  // Dirt along the rim, where it rolled.
  const g = ctx.createRadialGradient(cx, cy, rad * 0.75, cx, cy, rad);
  g.addColorStop(0, "rgba(40, 30, 15, 0)");
  g.addColorStop(1, "rgba(40, 30, 15, 0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

function cable(ctx: Ctx, r: Region, random: Random) {
  ctx.fillStyle = PAINT.rubber;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Turns of cable across the barrel (v runs along the drum's axis).
  const turns = 14;
  for (let i = 0; i < turns; i += 1) {
    const x = r.x + (i / turns) * r.w;
    ctx.fillStyle = "rgba(255, 240, 220, 0.16)";
    ctx.fillRect(x + 2, r.y, 3, r.h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x + r.w / turns - 2, r.y, 2, r.h);
  }
  noiseSpeckle(ctx, r, random, 60, ["rgba(150, 130, 100, 0.25)"], [1, 2]);
}

function rope(ctx: Ctx, r: Region) {
  ctx.fillStyle = PAINT.rope;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = "rgba(70, 55, 30, 0.55)";
  ctx.lineWidth = 3;
  for (let i = -r.h; i < r.w + r.h; i += 9) {
    ctx.beginPath();
    ctx.moveTo(r.x + i, r.y);
    ctx.lineTo(r.x + i + r.h * 0.6, r.y + r.h);
    ctx.stroke();
  }
}

/** The kit atlas, painted once. */
export function paintKitAtlas(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(KIT_SIZE, KIT_SIZE);
  const random = createRandom(2018);
  const A = KIT_ATLAS;
  crateSide(ctx, A.sideA, random, { big: "MUNICIÓN", lot: "LOTE ZPR-18-042", weight: "PESO BRUTO 38 KG · VOL 0,16 M³", band: true });
  crateSide(ctx, A.sideB, random, { big: "CARGAS DE DEMOLICIÓN", lot: "LOTE ZPR-19-117", weight: "PESO BRUTO 41 KG · FRÁGIL", band: false });
  crateEnd(ctx, A.end, random);
  crateLid(ctx, A.lid, random);
  planks(ctx, A.batten, 1, random, PAINT.oliveDark);
  wear(ctx, A.batten, random, 40);
  planks(ctx, A.timber, 1, random, "#7a5d3a");
  noiseSpeckle(ctx, A.timber, random, 120, ["rgba(30, 20, 10, 0.25)", "rgba(200, 170, 120, 0.15)"], [1, 3]);
  // The bridge panels: the poster girder's own olive, flat (a long chord stretches the region,
  // so no speckle that would streak into wood grain), soft weathering only.
  ctx.fillStyle = ARMY_STEEL.base;
  ctx.fillRect(A.steel.x, A.steel.y, A.steel.w, A.steel.h);
  for (let i = 0; i < 10; i += 1) {
    const x = A.steel.x + random() * A.steel.w;
    const y = A.steel.y + random() * A.steel.h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 30);
    g.addColorStop(0, random() < 0.5 ? "rgba(30, 30, 20, 0.16)" : "rgba(110, 70, 40, 0.14)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, y - 30, 60, 60);
  }
  canSide(ctx, A.canSide, random);
  jerryFace(ctx, A.jerryFace, random);
  painted(ctx, A.jerryEdge, random, "#4d5734", 10, "#5e5c58");
  flange(ctx, A.flange, random);
  painted(ctx, A.canPlain, random, "#525c36", 18, "#6c6a64", true);
  cable(ctx, A.cable, random);
  painted(ctx, A.iron, random, PAINT.iron, 0, PAINT.iron, true);
  rope(ctx, A.rope);
  return canvas;
}

/** The faces the stencils paint in, for loadFaces before the first paint. */
export function kitFaces(): string[] {
  return [`104px ${fonts.condensed()}`];
}
