import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";
import {
  arcText,
  arcTextBelow,
  crease,
  edgeSoak,
  fitTracked,
  grain,
  halftone,
  inkVoids,
  paper,
  raggedLine,
  rainStain,
  type Random,
  registrationMark,
  scuffs,
  tearAway,
  tracked,
  wrap,
  wrinkles,
} from "./print";

/**
 * The Logixs wall's paper, in one atlas. A wheat-paste wall the way the
 * street builds one: years of bills scraped and pasted over (the collage),
 * and on top this season's run. Bytetravel's travel poster and its three
 * extras (visas, eSIM, lounges) as a series; Retech's official portal as a
 * two-colour riso bill; and the newest sheet, pasted during the second
 * card, a letterpress gig bill for the headliner, FULL STACK, drawn as the
 * other full stack: an amp stack whose cabinets are the front end and the
 * back end. The snipe with the role and the years over the run, and the
 * street's own painted ban above it. Our type, no logos.
 */
export const LOGIXS_ATLAS = { w: 4096, h: 2048 } as const;

/** Atlas rectangles in pixels: x, y, w, h. */
export const RECTS = {
  collage: [0, 0, 4096, 748],
  /** 7.6 x 0.35 m and 7.2 x 0.6 m on the wall (LogixsSet), at the same 263 and 250 px a metre as the bills. */
  snipe: [0, 760, 2000, 92],
  ban: [0, 862, 1800, 150],
  bytetravel: [0, 1024, 760, 975],
  retech: [770, 1024, 760, 975],
  gig: [1540, 1024, 730, 975],
  visa: [2280, 1024, 350, 474],
  esim: [2640, 1024, 350, 474],
  lounge: [3000, 1024, 350, 474],
  /** The lounge bill's top-right corner alone: the flap that folds into the paper plane. */
  corner: [3360, 1024, 350, 474],
} as const;

/** The wall the collage covers, in metres (x from, x to, y from, y to). */
export const COLLAGE = { x0: -10.6, x1: 8.6, y0: 0.4, y1: 3.9 } as const;

/** The plane's flap: the corner's legs, as a share of the bill's width. */
export const FLAP = 0.36;

type Extra = { word: string; line: string; stamp: string };

export type LogixsCopy = {
  snipe: string;
  ban: string;
  banSmall: string;
  bytetravel: { name: string; ask: string; answer: string; extras: string };
  extras: readonly Extra[];
  retech: { name: string; portal: string; programme: string };
  gig: { presents: string; headliner: string; acts: readonly string[]; tour: string; tagline: string };
  printer: string;
};

type Ctx = CanvasRenderingContext2D;

const INK = {
  night: "#1d1238",
  violet: "#3b1f66",
  cream: "#f3e7cc",
  gold: "#f0c46a",
  coral: "#ef5a6f",
  teal: "#2f9e97",
} as const;

function fitFont(ctx: Ctx, text: string, font: (size: number) => string, size: number, width: number): number {
  ctx.font = font(size);
  const w = ctx.measureText(text).width;
  const fitted = w > width ? (size * width) / w : size;
  ctx.font = font(fitted);
  return fitted;
}

/** Weathering every bill on the wall gets: paste wrinkles, a fold or two, rain at the foot, rubbed ink, grain. */
function weather(ctx: Ctx, w: number, h: number, stock: string, random: Random, folds: "none" | "half" | "quarters" = "half"): void {
  wrinkles(ctx, w, h, random, 3 + Math.round(random() * 4));
  if (folds !== "none") crease(ctx, w / 2 + (random() - 0.5) * 4, 0, w / 2 + (random() - 0.5) * 4, h, random, 0.8);
  if (folds === "quarters") crease(ctx, 0, h / 2, w, h / 2 + (random() - 0.5) * 4, random, 0.6);
  rainStain(ctx, w, h, random, 0.14 + random() * 0.1);
  scuffs(ctx, w, h, stock, random, 8 + Math.round(random() * 8));
  edgeSoak(ctx, w, h, 0.14);
}

// ——— Bytetravel: the travel poster ———

/** A streamlined airliner in side view, nose along +x, length 1 (the caller scales and turns it). */
function airliner(ctx: Ctx, fill: string): void {
  ctx.fillStyle = fill;
  // Far wing, behind the fuselage, swept back and up.
  ctx.beginPath();
  ctx.moveTo(0.04, -0.02);
  ctx.lineTo(-0.2, -0.27);
  ctx.lineTo(-0.27, -0.27);
  ctx.lineTo(-0.14, -0.02);
  ctx.closePath();
  ctx.fill();
  // Fuselage: a long tube, rounded nose, the tail swept up.
  ctx.beginPath();
  ctx.moveTo(0.5, 0.012);
  ctx.bezierCurveTo(0.5, -0.03, 0.46, -0.05, 0.4, -0.052);
  ctx.lineTo(-0.36, -0.05);
  ctx.bezierCurveTo(-0.43, -0.052, -0.47, -0.07, -0.5, -0.09);
  ctx.lineTo(-0.5, -0.06);
  ctx.bezierCurveTo(-0.46, -0.0, -0.42, 0.04, -0.34, 0.048);
  ctx.lineTo(0.4, 0.05);
  ctx.bezierCurveTo(0.46, 0.05, 0.5, 0.04, 0.5, 0.012);
  ctx.closePath();
  ctx.fill();
  // Fin and tailplane.
  ctx.beginPath();
  ctx.moveTo(-0.33, -0.05);
  ctx.lineTo(-0.45, -0.2);
  ctx.lineTo(-0.5, -0.2);
  ctx.lineTo(-0.47, -0.07);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.38, -0.02);
  ctx.lineTo(-0.5, 0.06);
  ctx.lineTo(-0.53, 0.06);
  ctx.lineTo(-0.47, -0.04);
  ctx.closePath();
  ctx.fill();
  // Near wing, toward us and down, with its two engines.
  ctx.beginPath();
  ctx.moveTo(0.08, 0.03);
  ctx.lineTo(-0.16, 0.36);
  ctx.lineTo(-0.24, 0.36);
  ctx.lineTo(-0.13, 0.04);
  ctx.closePath();
  ctx.fill();
  for (const [x, y] of [
    [-0.02, 0.13],
    [-0.1, 0.25],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x + 0.02, y, 0.055, 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bytetravel(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  const stock = "#efe2c4";
  paper(ctx, w, h, stock, random, 0);
  const m = 24;
  const ix = m;
  const iy = m;
  const iw = w - 2 * m;
  const ih = Math.round(h * 0.68);
  const horizon = iy + ih * 0.66;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  // The sky in flat screen-printed steps, each step dissolving into the next through a halftone.
  const steps = ["#24124a", "#3b1a63", "#5f2277", "#93307f", "#cf4a7e", "#f37479", "#ffa27f", "#ffcb94"];
  const bandH = (horizon - iy) / steps.length;
  steps.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(ix, iy + i * bandH, iw, bandH + 1);
  });
  steps.forEach((color, i) => {
    if (i === 0) return;
    const top = iy + i * bandH - bandH * 0.55;
    halftone(ctx, ix, top, ix + iw, top + bandH * 0.55, 7, 0.26, (_, y) => (y - top) / (bandH * 0.55), color);
  });
  // The sun, half set: one solid disc, never striped.
  const sunX = ix + iw * 0.64;
  ctx.fillStyle = "#ffe7b8";
  ctx.beginPath();
  ctx.arc(sunX, horizon, 104, Math.PI, 0);
  ctx.fill();
  // Deco clouds: stacked rounded bands, lit from below.
  const cloud = (cx: number, cy: number, s: number) => {
    ctx.fillStyle = "#f59a8b";
    ctx.beginPath();
    ctx.roundRect(cx - 120 * s, cy, 240 * s, 22 * s, 11 * s);
    ctx.roundRect(cx - 70 * s, cy - 18 * s, 170 * s, 22 * s, 11 * s);
    ctx.roundRect(cx - 30 * s, cy - 36 * s, 90 * s, 22 * s, 11 * s);
    ctx.fill();
    ctx.fillStyle = "#ffc9a0";
    ctx.fillRect(cx - 110 * s, cy + 16 * s, 220 * s, 4 * s);
  };
  cloud(ix + iw * 0.22, horizon - 70, 0.9);
  cloud(ix + iw * 0.86, horizon - 150, 0.7);
  // The sea, and a far volcano island on the horizon.
  const sea = ctx.createLinearGradient(0, horizon, 0, iy + ih);
  sea.addColorStop(0, "#3a2266");
  sea.addColorStop(1, "#160c33");
  ctx.fillStyle = sea;
  ctx.fillRect(ix, horizon, iw, iy + ih - horizon);
  ctx.fillStyle = "#2a1650";
  ctx.beginPath();
  ctx.moveTo(ix - 4, horizon + 1);
  ctx.lineTo(ix + 40, horizon - 22);
  ctx.lineTo(ix + 120, horizon - 70);
  ctx.lineTo(ix + 140, horizon - 74);
  ctx.lineTo(ix + 160, horizon - 66);
  ctx.lineTo(ix + 250, horizon - 18);
  ctx.lineTo(ix + 300, horizon + 1);
  ctx.closePath();
  ctx.fill();
  // The sun's road on the water: short dashes narrowing toward us.
  for (let k = 0; k < 16; k += 1) {
    const y = horizon + 8 + k * k * 1.15 + k * 4;
    if (y > iy + ih) break;
    const half = 80 - k * 3.5 + random() * 12;
    for (let s = -1; s <= 1; s += 2) {
      const len = 10 + random() * 30;
      const x = sunX + s * random() * half;
      ctx.fillStyle = `rgba(255, 214, 160, ${0.85 - k * 0.04})`;
      ctx.fillRect(x - len / 2, y, len, 2.5 + k * 0.25);
    }
  }
  // The airliner climbing out over the sea, and its contrail from the lower left.
  ctx.save();
  ctx.strokeStyle = "rgba(255, 236, 214, 0.85)";
  ctx.lineCap = "round";
  for (const [dy, lw] of [
    [0, 5],
    [12, 3],
  ]) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(ix - 10, iy + ih * 0.62 + dy);
    ctx.quadraticCurveTo(ix + iw * 0.25, iy + ih * 0.48 + dy, ix + iw * 0.43, iy + ih * 0.33 + dy * 0.5);
    ctx.stroke();
  }
  ctx.restore();
  const planeX = ix + iw * 0.62;
  const planeY = iy + ih * 0.27;
  const planeL = iw * 0.58;
  const turn = -0.2;
  for (const [dx, dy, color] of [
    [5, 4, "#5a2a7c"],
    [0, 0, INK.night],
  ] as const) {
    ctx.save();
    ctx.translate(planeX + dx, planeY + dy);
    ctx.rotate(turn);
    ctx.scale(planeL, planeL);
    airliner(ctx, color);
    ctx.restore();
  }
  // Its windows and the light along its back.
  ctx.save();
  ctx.translate(planeX, planeY);
  ctx.rotate(turn);
  ctx.fillStyle = "#ffd9a8";
  for (let k = 0; k < 15; k += 1) ctx.fillRect(planeL * (0.3 - k * 0.042), -planeL * 0.012, planeL * 0.016, planeL * 0.014);
  ctx.fillStyle = "rgba(255, 190, 170, 0.55)";
  ctx.fillRect(-planeL * 0.36, -planeL * 0.052, planeL * 0.74, planeL * 0.008);
  ctx.restore();
  ctx.restore();

  // The name across the top of the sky.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK.gold;
  const nameSize = fitTracked(ctx, copy.bytetravel.name, (s) => `400 ${s}px ${fonts.deco()}`, 92, iw - 70, (s) => s * 0.08);
  tracked(ctx, copy.bytetravel.name, w / 2, iy + 96, nameSize * 0.08);
  ctx.fillRect(ix + 60, iy + 116, iw - 120, 3);
  ctx.fillRect(ix + 60, iy + 124, iw - 120, 1.5);

  // The panel under the picture: the question, the answer, what is on offer.
  const py = iy + ih;
  ctx.fillStyle = INK.violet;
  ctx.fillRect(ix, py, iw, 4);
  ctx.textAlign = "center";
  ctx.fillStyle = INK.violet;
  fitTracked(ctx, copy.bytetravel.ask, (s) => `700 ${s}px ${fonts.serif()}`, 30, iw - 80, () => 5);
  tracked(ctx, copy.bytetravel.ask, w / 2, py + 58, 5);
  ctx.fillStyle = "#c93a59";
  fitFont(ctx, copy.bytetravel.answer, (s) => `italic 700 ${s}px ${fonts.serif()}`, 70, iw - 60);
  ctx.fillText(copy.bytetravel.answer, w / 2, py + 138);
  ctx.fillStyle = INK.violet;
  ctx.fillRect(w / 2 - 120, py + 162, 240, 2);
  ctx.beginPath();
  ctx.arc(w / 2, py + 163, 5, 0, Math.PI * 2);
  ctx.fill();
  fitTracked(ctx, copy.bytetravel.extras, (s) => `700 ${s}px ${fonts.mono()}`, 26, iw - 80, () => 4);
  tracked(ctx, copy.bytetravel.extras, w / 2, py + 204, 4);
  ctx.font = `600 13px ${fonts.mono()}`;
  ctx.fillStyle = "rgba(59, 31, 102, 0.7)";
  tracked(ctx, copy.printer, w - m - 6, h - 9, 2, "right");
  weather(ctx, w, h, stock, random, "quarters");
}

// ——— Bytetravel's extras: a series of three ———

function extraFrame(ctx: Ctx, w: number, h: number, field: string, copy: LogixsCopy, extra: Extra, random: Random, art: (cx: number, cy: number) => void): void {
  const stock = "#f1e6cc";
  paper(ctx, w, h, stock, random, 0);
  const m = 14;
  ctx.fillStyle = field;
  ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
  // The series' head: the name on a night band.
  ctx.fillStyle = INK.night;
  ctx.fillRect(m, m, w - 2 * m, 44);
  ctx.fillStyle = INK.gold;
  ctx.textBaseline = "alphabetic";
  fitTracked(ctx, copy.bytetravel.name, (s) => `400 ${s}px ${fonts.deco()}`, 28, w - 80, () => 5);
  tracked(ctx, copy.bytetravel.name, w / 2, m + 32, 5);
  art(w / 2, 200);
  // The word, big, and its line.
  ctx.fillStyle = INK.night;
  ctx.textAlign = "center";
  fitFont(ctx, extra.word, (s) => `400 ${s}px ${fonts.condensed()}`, 104, w - 56);
  ctx.fillText(extra.word, w / 2 + 2, h - 74);
  ctx.fillStyle = "#fff4e0";
  ctx.fillText(extra.word, w / 2, h - 76);
  ctx.strokeStyle = INK.night;
  ctx.lineWidth = 2;
  ctx.strokeText(extra.word, w / 2, h - 76);
  ctx.fillStyle = INK.night;
  fitFont(ctx, extra.line, (s) => `italic 700 ${s}px ${fonts.serif()}`, 25, w - 56);
  ctx.fillText(extra.line, w / 2, h - 36);
  weather(ctx, w, h, stock, random, "half");
}

function visa(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  const extra = copy.extras[0];
  extraFrame(ctx, w, h, "#f2876c", copy, extra, random, (cx, cy) => {
    // A passport, closed, with its crest.
    ctx.save();
    ctx.translate(cx - 22, cy);
    ctx.rotate(-0.12);
    ctx.fillStyle = "rgba(29, 18, 56, 0.35)";
    ctx.fillRect(-62, -82, 132, 172);
    ctx.fillStyle = "#26245e";
    ctx.beginPath();
    ctx.roundRect(-68, -90, 132, 172, 8);
    ctx.fill();
    ctx.strokeStyle = INK.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-2, -20, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-2, -20, 12, 30, 0, 0, Math.PI * 2);
    ctx.moveTo(-32, -20);
    ctx.lineTo(28, -20);
    ctx.stroke();
    ctx.fillStyle = INK.gold;
    ctx.fillRect(-36, 34, 68, 4);
    ctx.fillRect(-26, 46, 48, 3);
    ctx.restore();
    // The rubber stamp over it, in red, the ink patchy as a stamp's is.
    ctx.save();
    ctx.translate(cx + 40, cy + 34);
    ctx.rotate(0.3);
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "#c0163f";
    ctx.fillStyle = "#c0163f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `700 17px ${fonts.mono()}`;
    arcText(ctx, extra.stamp, 0, 0, 56, -Math.PI / 2, 3);
    arcTextBelow(ctx, "★ 2025 ★", 0, 0, 56, 3);
    ctx.font = `400 46px ${fonts.condensed()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OK", 0, 2);
    ctx.restore();
    inkVoids(ctx, cx - 40, cy - 40, 150, 150, "#f2876c", random, 0.9, 1.6);
  });
}

function esim(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  extraFrame(ctx, w, h, "#43b3a6", copy, copy.extras[1], random, (cx, cy) => {
    // A SIM, its corner clipped, the gold chip; and the signal coming up beside it.
    ctx.save();
    ctx.translate(cx - 30, cy);
    ctx.rotate(-0.08);
    const card = () => {
      ctx.beginPath();
      ctx.moveTo(-56, -80);
      ctx.lineTo(30, -80);
      ctx.lineTo(56, -54);
      ctx.lineTo(56, 80);
      ctx.lineTo(-56, 80);
      ctx.closePath();
    };
    ctx.translate(6, 5);
    card();
    ctx.fillStyle = "rgba(29, 18, 56, 0.35)";
    ctx.fill();
    ctx.translate(-6, -5);
    card();
    ctx.fillStyle = "#1f1a4c";
    ctx.fill();
    ctx.fillStyle = INK.gold;
    ctx.beginPath();
    ctx.roundRect(-30, -28, 60, 66, 9);
    ctx.fill();
    ctx.strokeStyle = "#1f1a4c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, -6);
    ctx.lineTo(30, -6);
    ctx.moveTo(-30, 16);
    ctx.lineTo(30, 16);
    ctx.moveTo(0, -28);
    ctx.lineTo(0, -6);
    ctx.moveTo(0, 16);
    ctx.lineTo(0, 38);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#fff1d6";
    for (let i = 0; i < 4; i += 1) {
      const bh = 26 + i * 26;
      ctx.fillRect(cx + 50 + i * 22, cy + 70 - bh, 15, bh);
    }
    halftone(ctx, cx - 120, cy - 100, cx + 130, cy + 100, 8, 0.4, (x, y) => Math.max(0, 0.55 - Math.hypot(x - cx - 90, y - cy + 70) / 240), "rgba(16, 60, 70, 0.5)");
  });
}

function lounge(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  extraFrame(ctx, w, h, "#f2b84f", copy, copy.extras[2], random, (cx, cy) => {
    // An arched window on the apron, a plane lifting off in it; in front, the club chair and a drink.
    ctx.fillStyle = "#ffd9a0";
    ctx.beginPath();
    ctx.moveTo(cx - 84, cy + 40);
    ctx.lineTo(cx - 84, cy - 40);
    ctx.arc(cx, cy - 40, 84, Math.PI, 0);
    ctx.lineTo(cx + 84, cy + 40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK.night;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#e9925e";
    ctx.fillRect(cx - 90, cy + 8, 180, 40);
    ctx.translate(cx + 14, cy - 52);
    ctx.rotate(-0.32);
    ctx.scale(110, 110);
    airliner(ctx, "#5a3a7a");
    ctx.restore();
    ctx.fillStyle = INK.night;
    // The chair: a deep seat, a rounded back, the arm toward us, short legs.
    ctx.beginPath();
    ctx.moveTo(cx - 104, cy + 90);
    ctx.lineTo(cx - 104, cy + 10);
    ctx.quadraticCurveTo(cx - 104, cy - 22, cx - 70, cy - 22);
    ctx.lineTo(cx - 6, cy - 22);
    ctx.quadraticCurveTo(cx + 26, cy - 22, cx + 26, cy + 10);
    ctx.lineTo(cx + 26, cy + 90);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3b2a6e";
    ctx.beginPath();
    ctx.roundRect(cx - 118, cy + 26, 40, 66, 14);
    ctx.roundRect(cx + 4, cy + 26, 40, 66, 14);
    ctx.fill();
    ctx.fillStyle = INK.night;
    ctx.fillRect(cx - 108, cy + 92, 8, 16);
    ctx.fillRect(cx + 28, cy + 92, 8, 16);
    ctx.strokeStyle = INK.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 88, cy - 8);
    ctx.lineTo(cx + 8, cy - 8);
    ctx.stroke();
    // The side table and a coupe glass with its cherry.
    ctx.fillStyle = INK.night;
    ctx.fillRect(cx + 58, cy + 52, 52, 6);
    ctx.fillRect(cx + 81, cy + 58, 6, 50);
    ctx.fillRect(cx + 66, cy + 104, 36, 4);
    ctx.beginPath();
    ctx.moveTo(cx + 64, cy + 12);
    ctx.quadraticCurveTo(cx + 84, cy + 34, cx + 104, cy + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx + 83, cy + 22, 3, 28);
    ctx.fillRect(cx + 74, cy + 48, 21, 3);
    ctx.fillStyle = "#c0163f";
    ctx.beginPath();
    ctx.arc(cx + 92, cy + 10, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ——— Retech: the official portal, a two-colour riso bill ———

function retech(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  const stock = "#f2eadb";
  const red = "#ff4a6b";
  const blue = "#22307a";
  paper(ctx, w, h, stock, random, 0);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  // The red plane, printed first and a hair off register: the growth curve and its field of dots.
  ctx.save();
  ctx.translate(5, -3);
  ctx.fillStyle = red;
  ctx.fillRect(40, 236, w - 80, 22);
  const x0 = 400;
  const y0 = h - 110;
  const x1 = w - 70;
  const y1 = 330;
  const curve = (t: number): [number, number] => [x0 + (x1 - x0) * t, y0 - (y0 - y1) * ((Math.exp(3.2 * t) - 1) / (Math.exp(3.2) - 1))];
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= 40; i += 1) ctx.lineTo(...curve(i / 40));
  ctx.lineTo(x1, y0);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  halftone(ctx, x0, y1, x1, y0, 11, 0.79, (x, y) => 0.25 + 0.75 * ((x - x0) / (x1 - x0)) * (1 - (y0 - y) / (y0 - y1) * 0.4), red);
  ctx.restore();
  ctx.strokeStyle = red;
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= 40; i += 1) ctx.lineTo(...curve(i / 40));
  ctx.stroke();
  const tip = curve(1);
  const before = curve(0.96);
  const a = Math.atan2(tip[1] - before[1], tip[0] - before[0]);
  ctx.beginPath();
  ctx.moveTo(tip[0] + Math.cos(a) * 30, tip[1] + Math.sin(a) * 30);
  ctx.lineTo(tip[0] + Math.cos(a + 2.4) * 34, tip[1] + Math.sin(a + 2.4) * 34);
  ctx.lineTo(tip[0] + Math.cos(a - 2.4) * 34, tip[1] + Math.sin(a - 2.4) * 34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The blue plane: the portal's window, the name, the programme, startups growing along the curve.
  ctx.strokeStyle = blue;
  ctx.fillStyle = blue;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(28, 28, w - 56, h - 56, 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, 104);
  ctx.lineTo(w - 28, 104);
  ctx.stroke();
  [56, 86, 116].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 66, 10, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(150, 46, w - 200, 40, 20);
  ctx.stroke();
  // The padlock in the address bar.
  ctx.fillRect(170, 64, 16, 13);
  ctx.beginPath();
  ctx.arc(178, 64, 6, Math.PI, 0);
  ctx.stroke();
  ctx.textBaseline = "alphabetic";
  fitTracked(ctx, copy.retech.portal, (s) => `700 ${s}px ${fonts.mono()}`, 24, w - 290, () => 4);
  tracked(ctx, copy.retech.portal, 200, 75, 4, "left");
  // The name, as tall as the band under the address bar allows, tracked out to the window's width.
  fitFont(ctx, copy.retech.name, (s) => `400 ${s}px ${fonts.condensed()}`, 172, w - 110);
  const letters = [...copy.retech.name].length;
  const spread = Math.max(0, (w - 110 - ctx.measureText(copy.retech.name).width) / Math.max(1, letters - 1));
  tracked(ctx, copy.retech.name, 52, 226, spread, "left");
  inkVoids(ctx, 40, 100, w - 80, 140, stock, random, 0.35, 1.8);
  // Startups along the curve, from seed to scale.
  ctx.save();
  ctx.translate(5, -3);
  for (let i = 0; i < 7; i += 1) {
    const t = 0.08 + i * 0.145;
    const [x, y] = curve(t);
    ctx.beginPath();
    ctx.arc(x, y, 5 + 4 * i * i * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The programme, in at most three stacked lines on the left, as big as they go.
  let size = 120;
  let lines: string[] = [];
  for (; size > 40; size -= 2) {
    ctx.font = `400 ${size}px ${fonts.condensed()}`;
    lines = wrap(ctx, copy.retech.programme, 345);
    if (lines.length <= 3 && lines.every((line) => ctx.measureText(line).width <= 345) && lines.length * size * 0.95 <= 430) break;
  }
  lines.forEach((line, i) => ctx.fillText(line, 50, 340 + size * 0.8 + i * size * 0.95));
  ctx.restore();
  // The press furniture: registration marks and the colour bar in the margin.
  registrationMark(ctx, w / 2, h - 14, 6, blue);
  registrationMark(ctx, 14, h / 2, 6, blue);
  [red, blue, "#7a2a6a"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(40 + i * 18, h - 20, 14, 10);
  });
  ctx.font = `600 13px ${fonts.mono()}`;
  ctx.fillStyle = blue;
  tracked(ctx, copy.printer, w - 40, h - 11, 2, "right");
  weather(ctx, w, h, stock, random, "half");
}

// ——— The headliner: a letterpress gig bill ———

function woodType(ctx: Ctx, text: string, x: number, y: number, size: number, width: number, color: string, stock: string, random: Random, tracking = 0): number {
  const s = fitTracked(ctx, text, (z) => `400 ${z}px ${fonts.condensed()}`, size, width, (z) => tracking * z);
  ctx.fillStyle = color;
  const tw = tracked(ctx, text, x, y, tracking * s);
  inkVoids(ctx, x - tw / 2 - 4, y - s * 0.78, tw + 8, s * 0.82, stock, random, 0.5, Math.max(1.2, s / 60));
  return s;
}

function speaker(ctx: Ctx, cx: number, cy: number, r: number, cream: string): void {
  ctx.strokeStyle = cream;
  ctx.lineWidth = 2.5;
  for (const k of [1, 0.78, 0.5]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // The carved light on the cone's upper left.
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.88, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
}

function cabinet(ctx: Ctx, x: number, y: number, w: number, h: number, label: string, ink: string, cream: string, accent: string, random: Random): void {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  // The grille cloth, carved as a fine cross-hatch.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 14, y + 14, w - 28, h - 28);
  ctx.clip();
  ctx.strokeStyle = "rgba(243, 230, 196, 0.22)";
  ctx.lineWidth = 1.2;
  for (let k = -h; k < w + h; k += 9) {
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + k + h, y + h);
    ctx.moveTo(x + k + h, y);
    ctx.lineTo(x + k, y + h);
    ctx.stroke();
  }
  const r = Math.min((w - 40) / 4.4, (h - 40) / 4.4);
  for (const [fx, fy] of [
    [0.27, 0.3],
    [0.73, 0.3],
    [0.27, 0.74],
    [0.73, 0.74],
  ]) speaker(ctx, x + w * fx, y + h * fy, r, cream);
  ctx.restore();
  ctx.strokeStyle = cream;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
  // The cabinet's name plate, in the middle, over the cloth.
  const pw = w * 0.74;
  const ph = 66;
  const px = x + (w - pw) / 2;
  const py = y + h / 2 - ph / 2;
  ctx.fillStyle = accent;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(px + 5, py + 5, pw - 10, ph - 10);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  woodType(ctx, label, x + w / 2, py + ph - 12, 58, pw - 34, ink, accent, random, 0.06);
}

function gig(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  const stock = "#f4e5bf";
  const ink = "#1b1424";
  const red = "#d8283f";
  paper(ctx, w, h, stock, random, 0);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // Who presents, between rules with diamonds.
  woodType(ctx, copy.gig.presents, w / 2, 78, 50, w - 120, red, stock, random, 0.12);
  ctx.fillStyle = ink;
  for (const y of [96, 104]) ctx.fillRect(40, y, w - 80, y === 96 ? 4 : 1.5);
  // The headliner, knocked out of a split-fountain block: magenta into orange into yellow.
  const by = 118;
  const bh = 190;
  const fountain = ctx.createLinearGradient(30, 0, w - 30, 0);
  fountain.addColorStop(0, "#e8246e");
  fountain.addColorStop(0.5, "#ff7a2f");
  fountain.addColorStop(1, "#ffcf3a");
  ctx.fillStyle = fountain;
  ctx.fillRect(30, by, w - 60, bh);
  inkVoids(ctx, 30, by, w - 60, bh, stock, random, 0.25, 2.4);
  const s = fitTracked(ctx, copy.gig.headliner, (z) => `400 ${z}px ${fonts.condensed()}`, 220, w - 110, (z) => z * 0.02);
  ctx.fillStyle = ink;
  tracked(ctx, copy.gig.headliner, w / 2 + 6, by + bh / 2 + s * 0.36 + 6, s * 0.02);
  ctx.fillStyle = stock;
  tracked(ctx, copy.gig.headliner, w / 2, by + bh / 2 + s * 0.36, s * 0.02);
  // The other full stack: the amp head, its knobs, and two cabinets, front end over back end.
  const sx = 120;
  const sw = w - 240;
  const head = { y: 336, h: 74 };
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(sx + 6, head.y, sw - 12, head.h, 8);
  ctx.fill();
  ctx.fillStyle = "#e9c46a";
  ctx.fillRect(sx + 22, head.y + 16, sw - 44, 26);
  ctx.fillStyle = ink;
  for (let k = 0; k < 8; k += 1) {
    ctx.beginPath();
    ctx.arc(sx + 48 + k * ((sw - 96) / 7), head.y + 29, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.arc(sx + sw - 34, head.y + 57, 6, 0, Math.PI * 2);
  ctx.fill();
  // The handle on top.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 50, head.y);
  ctx.quadraticCurveTo(w / 2, head.y - 22, w / 2 + 50, head.y);
  ctx.stroke();
  const [front, back] = copy.gig.acts;
  cabinet(ctx, sx, 420, sw, 196, front, ink, stock, "#ffcf3a", random);
  cabinet(ctx, sx, 626, sw, 196, back, ink, stock, "#ff7a2f", random);
  // The stage floor under it.
  ctx.fillStyle = ink;
  ctx.fillRect(60, 826, w - 120, 6);
  // The tour, and the joke in small type.
  woodType(ctx, copy.gig.tour, w / 2, 900, 66, w - 120, ink, stock, random, 0.04);
  ctx.fillStyle = red;
  fitFont(ctx, copy.gig.tagline, (z) => `italic 700 ${z}px ${fonts.serif()}`, 28, w - 140);
  ctx.fillText(copy.gig.tagline, w / 2, 944);
  ctx.font = `600 11px ${fonts.mono()}`;
  ctx.fillStyle = ink;
  tracked(ctx, copy.printer, w - 30, h - 10, 2, "right");
  weather(ctx, w, h, stock, random, "none");
}

// ——— The snipe and the street's ban ———

function snipe(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  const stock = "#f6dd52";
  paper(ctx, w, h, stock, random, 0.1);
  ctx.fillStyle = "#16101f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = fitTracked(ctx, copy.snipe, (s) => `800 ${s}px ${fonts.display()}`, 64, w - 160, (s) => s * 0.12);
  tracked(ctx, copy.snipe, w / 2, h / 2 + 3, size * 0.12);
  inkVoids(ctx, 0, 0, w, h, stock, random, 0.12, 1.6);
  wrinkles(ctx, w, h, random, 10);
  grain(ctx, 0, 0, w, h, random, 8);
}

function ban(ctx: Ctx, w: number, h: number, copy: LogixsCopy, random: Random): void {
  // Black paint through a stencil on the plaster: soft overspray, drips, worn where the rain runs.
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#231824";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const big = fitTracked(ctx, copy.ban, (s) => `400 ${s}px ${fonts.block()}`, 92, w - 60, (s) => s * 0.08);
  const banWidth = tracked(ctx, copy.ban, w / 2, 86, big * 0.08);
  fitTracked(ctx, copy.banSmall, (s) => `400 ${s}px ${fonts.block()}`, 40, w * 0.62, (s) => s * 0.1);
  tracked(ctx, copy.banSmall, w / 2, 134, 4);
  // Paint run down from the big letters' feet, never from bare plaster.
  for (let i = 0; i < 9; i += 1) {
    const x = w / 2 - banWidth / 2 + random() * banWidth;
    const l = 6 + random() * 18;
    ctx.fillRect(x, 84, 2 + random() * 2, l);
  }
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 2600; i += 1) {
    ctx.globalAlpha = random();
    ctx.beginPath();
    ctx.arc(random() * w, random() * h, 0.6 + random() * random() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ——— The collage: years of bills scraped and pasted over ———

const OLD_INKS = ["#b77f86", "#7f92b8", "#c8b16e", "#8fa98f", "#a58fbb", "#c99a7a", "#6f6a8f"];
const OLD_STOCK = ["#ddd2bd", "#d4c8b2", "#e3d9c6", "#cfc4b4"];
const OLD_GLYPHS = "AEKMORSTVZ0123456789&";
/** An old sheet's torn edge: its paper core, as greyed as the rest of it. */
const OLD_CORE = "rgba(214, 204, 190, 0.6)";

/** One old bill, faded: a field, a cropped giant glyph, a halftone fade, a rule or two; then torn. */
function oldBill(w: number, h: number, random: Random): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(Math.round(w), Math.round(h));
  const stock = OLD_STOCK[Math.floor(random() * OLD_STOCK.length)];
  paper(ctx, w, h, stock, random, 0.12);
  const ink = OLD_INKS[Math.floor(random() * OLD_INKS.length)];
  const ink2 = OLD_INKS[Math.floor(random() * OLD_INKS.length)];
  const kind = Math.floor(random() * 3);
  if (kind === 0) {
    ctx.fillStyle = ink;
    ctx.fillRect(0, h * (0.1 + random() * 0.3), w, h * (0.2 + random() * 0.3));
  } else if (kind === 1) {
    halftone(ctx, 0, 0, w, h, 6 + random() * 5, random(), (_, y) => y / h, ink);
  } else {
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = kind === 2 ? stock : ink2;
  // A ghost of its headline: faint, so the run on top reads first and no torn giant letter competes with it.
  ctx.globalAlpha = 0.3;
  ctx.font = `800 ${Math.round(h * (0.35 + random() * 0.35))}px ${fonts.display()}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(OLD_GLYPHS[Math.floor(random() * OLD_GLYPHS.length)], w * (random() * 0.5 - 0.2), h * (0.45 + random() * 0.45));
  ctx.globalAlpha = 1;
  for (let i = 0; i < 1 + Math.floor(random() * 3); i += 1) {
    ctx.fillStyle = ink2;
    ctx.fillRect(w * 0.08, h * (0.7 + random() * 0.25), w * (0.3 + random() * 0.6), 3 + random() * 8);
  }
  // Sun and rain have had them for years.
  ctx.fillStyle = `rgba(235, 225, 205, ${0.12 + random() * 0.22})`;
  ctx.fillRect(0, 0, w, h);
  rainStain(ctx, w, h, random, 0.3);
  wrinkles(ctx, w, h, random, 4);
  // Older and dirtier than this season's run, so the new bills read first.
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = `rgb(${170 + Math.round(random() * 30)}, ${158 + Math.round(random() * 25)}, ${165 + Math.round(random() * 25)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Torn: a strip ripped off a side or a corner gone.
  const side = Math.floor(random() * 4);
  const t0 = 0.2 + random() * 0.5;
  const t1 = 0.2 + random() * 0.5;
  if (side === 0) tearAway(ctx, raggedLine(w * t0, -4, w * t1, h + 4, random, 26, 9), [[w + 4, h + 4], [w + 4, -4]], random, OLD_CORE);
  else if (side === 1) tearAway(ctx, raggedLine(-4, h * t0, w + 4, h * t1, random, 26, 9), [[w + 4, -4], [-4, -4]], random, OLD_CORE);
  else if (side === 2) tearAway(ctx, raggedLine(w * (0.4 + t0 * 0.6), -4, w + 4, h * t1, random, 20, 8), [[w + 4, -4]], random, OLD_CORE);
  else tearAway(ctx, raggedLine(-4, h * (1 - t0 * 0.5), w * t1, h + 4, random, 20, 8), [[-4, h + 4]], random, OLD_CORE);
  return canvas;
}

/** Scraped residue: the paper a scraper left behind, pale and fibrous. */
function residue(ctx: Ctx, x: number, y: number, r: number, random: Random): void {
  ctx.fillStyle = OLD_STOCK[Math.floor(random() * OLD_STOCK.length)];
  ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.55 + random() * 0.55);
    const px = x + Math.cos(a) * rr * 1.6;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function collage(ctx: Ctx, w: number, h: number, random: Random): void {
  ctx.clearRect(0, 0, w, h);
  // The scraped first layer, over most of the run.
  for (let i = 0; i < 70; i += 1) residue(ctx, random() * w, h * (0.15 + random() * 0.75), 40 + random() * 90, random);
  // Old bills, pasted every which way and torn since.
  for (let i = 0; i < 64; i += 1) {
    const bw = 120 + random() * 280;
    const bh = bw * (1.2 + random() * 0.4);
    const bill = oldBill(bw, Math.min(bh, h * 0.95), random);
    const x = random() * (w - 60) - 40;
    const y = h * 0.04 + random() * (h - bill.height - h * 0.04);
    ctx.save();
    ctx.translate(x + bw / 2, y + bill.height / 2);
    ctx.rotate((random() - 0.5) * 0.06);
    ctx.drawImage(bill, -bw / 2, -bill.height / 2);
    ctx.restore();
  }
  // The edges of the run: ragged, top and bottom, as a scraper and the rain leave them.
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const top = raggedLine(-10, h * 0.03, w + 10, h * 0.05, random, 40, 14);
  ctx.beginPath();
  top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineTo(w + 10, -10);
  ctx.lineTo(-10, -10);
  ctx.closePath();
  ctx.fill();
  const foot = raggedLine(-10, h * 0.9, w + 10, h * 0.93, random, 60, 14);
  ctx.beginPath();
  foot.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineTo(w + 10, h + 10);
  ctx.lineTo(-10, h + 10);
  ctx.closePath();
  ctx.fill();
  // Holes where whole sheets came away to the brick.
  for (let i = 0; i < 9; i += 1) {
    const x = random() * w;
    const y = h * (0.55 + random() * 0.4);
    const r = 30 + random() * 70;
    ctx.beginPath();
    for (let k = 0; k <= 16; k += 1) {
      const a = (k / 16) * Math.PI * 2;
      const rr = r * (0.6 + random() * 0.5);
      ctx.lineTo(x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The collage's pixels a metre, and a wall point (metres) in the collage's cell. */
const COLLAGE_PX = RECTS.collage[2] / (COLLAGE.x1 - COLLAGE.x0);
function collageAt(x: number, y: number): [number, number] {
  return [RECTS.collage[0] + (x - COLLAGE.x0) * COLLAGE_PX, RECTS.collage[1] + (COLLAGE.y1 - y) * COLLAGE_PX];
}

/**
 * The end of the run, past Retech: last season's copies of the same bills,
 * a gig bill and a Bytetravel bill a month of sun and rain older, half torn
 * down by the next crew. Copied from this season's cells, so the wall says
 * the same thing twice, the way a street does, and nothing new.
 */
function lastRun(ctx: Ctx, random: Random): void {
  const sheets: { rect: readonly number[]; x: number; y: number; w: number; turn: number; tear: "left" | "top" | "corner" }[] = [
    { rect: RECTS.bytetravel, x: 7.75, y: 2.05, w: 1.85, turn: 0.02, tear: "top" },
    { rect: RECTS.gig, x: 6.9, y: 2.3, w: 1.8, turn: -0.012, tear: "corner" },
  ];
  for (const sheet of sheets) {
    const [sx, sy, sw, sh] = sheet.rect;
    const w = sheet.w * COLLAGE_PX;
    const h = (w * sh) / sw;
    const [old, o] = makeCanvas(Math.round(w), Math.round(h));
    o.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, w, h);
    // Sun-bleached and dirty: older than the run beside it, so the new bills read first.
    o.globalCompositeOperation = "source-atop";
    o.fillStyle = "rgba(232, 222, 204, 0.38)";
    o.fillRect(0, 0, w, h);
    o.globalCompositeOperation = "multiply";
    o.fillStyle = "rgb(176, 162, 170)";
    o.fillRect(0, 0, w, h);
    o.globalCompositeOperation = "source-over";
    rainStain(o, w, h, random, 0.4);
    if (sheet.tear === "top") {
      tearAway(o, raggedLine(-4, h * 0.42, w + 4, h * 0.3, random, 30, 9), [[w + 4, -4], [-4, -4]], random, OLD_CORE);
    } else {
      tearAway(o, raggedLine(w * 0.25, -4, w + 4, h * 0.55, random, 30, 9), [[w + 4, -4]], random, OLD_CORE);
    }
    const [cx, cy] = collageAt(sheet.x, sheet.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(RECTS.collage[0], RECTS.collage[1], RECTS.collage[2], RECTS.collage[3]);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(sheet.turn);
    ctx.drawImage(old, -w / 2, -h / 2);
    ctx.restore();
  }
}

export function paintLogixs(copy: LogixsCopy): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(LOGIXS_ATLAS.w, LOGIXS_ATLAS.h);
  ctx.clearRect(0, 0, LOGIXS_ATLAS.w, LOGIXS_ATLAS.h);
  const random = createRandom(2025);
  const cell = (rect: readonly number[], paint: (ctx: Ctx, w: number, h: number) => void, noise = 9) => {
    ctx.save();
    ctx.translate(rect[0], rect[1]);
    ctx.beginPath();
    ctx.rect(0, 0, rect[2], rect[3]);
    ctx.clip();
    paint(ctx, rect[2], rect[3]);
    ctx.restore();
    if (noise > 0) grain(ctx, rect[0], rect[1], rect[2], rect[3], random, noise);
  };
  cell(RECTS.collage, (c, w, h) => collage(c, w, h, random), 7);
  cell(RECTS.snipe, (c, w, h) => snipe(c, w, h, copy, random), 0);
  cell(RECTS.ban, (c, w, h) => ban(c, w, h, copy, random), 0);
  cell(RECTS.bytetravel, (c, w, h) => bytetravel(c, w, h, copy, random));
  cell(RECTS.retech, (c, w, h) => retech(c, w, h, copy, random));
  cell(RECTS.gig, (c, w, h) => gig(c, w, h, copy, random));
  cell(RECTS.visa, (c, w, h) => visa(c, w, h, copy, random));
  cell(RECTS.esim, (c, w, h) => esim(c, w, h, copy, random));
  cell(RECTS.lounge, (c, w, h) => lounge(c, w, h, copy, random));
  lastRun(ctx, random);
  // The lounge bill's corner: copied to its own cell (the flap), then cut from the bill along the fold.
  const [lx, ly, lw, lh] = RECTS.lounge;
  const [cx, cy] = RECTS.corner;
  const leg = lw * FLAP;
  ctx.drawImage(canvas, lx, ly, lw, lh, cx, cy, lw, lh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy, lw, lh);
  ctx.moveTo(cx + lw - leg, cy);
  ctx.lineTo(cx + lw, cy);
  ctx.lineTo(cx + lw, cy + leg);
  ctx.closePath();
  ctx.clip("evenodd");
  ctx.clearRect(cx, cy, lw, lh);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(lx + lw - leg, ly);
  ctx.lineTo(lx + lw, ly);
  ctx.lineTo(lx + lw, ly + leg);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The fold's white edge, where the paper split as it came away.
  ctx.strokeStyle = "#f4ecdc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(lx + lw - leg, ly);
  ctx.lineTo(lx + lw, ly + leg);
  ctx.stroke();
  return canvas;
}
