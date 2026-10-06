import { createRandom } from "@/features/hero/scene/world";
import { family, fonts, makeCanvas } from "../../artCanvas";
import {
  type Inks,
  type Print,
  type Pt,
  type Random,
  type Shape,
  blockLetters,
  grain,
  inkVoids,
  polygon,
  printShape,
  printUnion,
  screen,
  smoothClosed,
  spaced,
  spacedWidth,
  stock,
  wrinkles,
} from "./litho";
import { type SapperInks, type SapperRig, footprint, paintSapper, rigSapper } from "./sapper";

/**
 * The army's roadside billboard: a 1940s-50s recruiting poster, drawn on
 * the stone and printed in a few inks on cream stock, blown up to 4 x 2
 * pasted sheets. The slogan runs across the top beside our own engineers'
 * tower; under it, at dawn, two sappers launch a Bailey-type girder across
 * a river gorge: one drives its tail over the rollers, the other, at the
 * edge, points to the far bank where the landing roller waits. Behind
 * them a truck and a file of men wait to cross. The girder's nose runs
 * into a tear in the paper over the far bank and comes out of the board
 * in 3D (ArmySet), on the same line, with the same depth and bays. Hand-cut
 * capitals with keylines and block shadows, halftone in the shadows,
 * plates off register, seams and peeled corners. Painted once,
 * deterministic (createRandom).
 */
export const ARMY_POSTER = { w: 2048, h: 896 } as const;

/** Where the girder tears through the paper, in poster pixels (the 3D nose comes out here). */
export const ARMY_HOLE = { x: 1872, y: 500, r: 132 } as const;

const TAIL: Pt = { x: 548, y: 598 };
const SPAN = Math.hypot(ARMY_HOLE.x - TAIL.x, ARMY_HOLE.y - TAIL.y);

/**
 * The painted girder: its axis from the tail to the hole's centre, six
 * bays long, a Bailey panel's depth (half a bay), the far truss's offset
 * and the nose-up pitch, in poster pixels and radians. ArmySet builds the
 * 3D nose from the same numbers, so paper and steel are one girder.
 */
export const ARMY_GIRDER: {
  readonly tail: Pt;
  readonly bays: number;
  readonly bay: number;
  readonly depth: number;
  readonly far: Pt;
  readonly pitch: number;
} = {
  tail: TAIL,
  bays: 6,
  bay: SPAN / 6,
  depth: SPAN / 12,
  far: { x: -7, y: -15 },
  pitch: Math.atan2(TAIL.y - ARMY_HOLE.y, ARMY_HOLE.x - TAIL.x),
};

const INK = {
  paper: "#efe2c0",
  paperBack: "#d9cba8",
  key: "#24123a",
  violet: "#2c1a4f",
  red: "#c23a2b",
  redDeep: "#8e2427",
  cream: "#f7ecd2",
  sodium: "#f6c35a",
  magenta: "#d2457e",
  cyan: "#3f8fa6",
} as const;

const HORIZON = 540;
const FOOT_TOP = 738;

/** The light: the afterglow low at the end of the gorge. */
const SUN: Pt = { x: 1196, y: HORIZON + 2 };

type Copy = { kicker: string; headline: readonly string[]; foot: readonly string[] };

const caps = () => family("--font-chapter-caps", `'Big Shoulders Display', ${fonts.condensed()}`);

/** The faces the poster paints in, for loadFaces before the first paint. */
export function armyFaces(): string[] {
  return [`900 160px ${caps()}`];
}

/* ----------------------------------------------------------------- sky */

function sky(ctx: CanvasRenderingContext2D, random: Random) {
  const { w } = ARMY_POSTER;
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, "#2e1f58");
  g.addColorStop(0.22, "#583a80");
  g.addColorStop(0.46, "#a5598c");
  g.addColorStop(0.68, "#e5837d");
  g.addColorStop(0.86, "#f6b070");
  g.addColorStop(1, "#fde3a4");
  ctx.fillStyle = g;
  ctx.fillRect(-8, -8, w + 16, HORIZON + 12);
  // The afterglow pooled where the sun went down, at the end of the gorge.
  const glow = ctx.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 820);
  glow.addColorStop(0, "rgba(255, 246, 206, 0.95)");
  glow.addColorStop(0.18, "rgba(255, 220, 150, 0.55)");
  glow.addColorStop(1, "rgba(255, 190, 140, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-8, -8, w + 16, HORIZON + 12);
  // Long rays fanned from the gorge, drawn lighter on the stone: a dawn, not a striped sun.
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#fff3d6";
  for (let i = 0; i < 15; i += 1) {
    const a = -Math.PI + 0.12 + i * 0.205 + (random() - 0.5) * 0.04;
    const spread = 0.04 + random() * 0.035;
    ctx.beginPath();
    ctx.moveTo(SUN.x, SUN.y);
    ctx.lineTo(SUN.x + Math.cos(a) * 2600, SUN.y + Math.sin(a) * 2600);
    ctx.lineTo(SUN.x + Math.cos(a + spread) * 2600, SUN.y + Math.sin(a + spread) * 2600);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  clouds(ctx, random);
  // The stone's coarse screen in the upper sky: violet dots, big enough to read from the road.
  ctx.save();
  ctx.globalAlpha = 0.55;
  screen(ctx, { x0: -8, y0: -8, x1: w + 8, y1: 330 }, 22, Math.PI / 4, (x, y) => (1 - y / 330) * 0.62 * (0.82 + 0.18 * Math.sin(x * 0.004)), "#1c0f3e");
  ctx.restore();
  birds(ctx);
}

/** Cloud banks lit from underneath by the sun below the horizon. */
function clouds(ctx: CanvasRenderingContext2D, random: Random) {
  const banks: { x0: number; x1: number; y: number; t: number; inks: Inks }[] = [
    { x0: -140, x1: 900, y: 330, t: 46, inks: { base: "#7a4a8c", light: "#f39aa0", shadow: "#4a3070" } },
    { x0: 1340, x1: 2200, y: 300, t: 54, inks: { base: "#84508e", light: "#f8a98c", shadow: "#4f3576" } },
    { x0: 560, x1: 1020, y: 420, t: 26, inks: { base: "#c27792", light: "#ffd2a0", shadow: "#8a5281" } },
    { x0: 1420, x1: 2160, y: 470, t: 22, inks: { base: "#df9488", light: "#fff0b8", shadow: "#a86880" } },
    { x0: -100, x1: 420, y: 498, t: 18, inks: { base: "#d88d8c", light: "#ffe2a8", shadow: "#9c6080" } },
  ];
  for (const bank of banks) {
    const path = new Path2D();
    const step = bank.t * 1.3;
    for (let x = bank.x0; x <= bank.x1; x += step * (0.5 + random() * 0.6)) {
      const edge = Math.min(x - bank.x0, bank.x1 - x) / ((bank.x1 - bank.x0) / 2);
      const r = bank.t * (0.6 + random() * 0.8) * (0.35 + 0.65 * Math.min(1, edge * 2.2));
      const cy = bank.y - r * 0.55 + (random() - 0.5) * bank.t * 0.2;
      path.ellipse(x, cy, r * (1.4 + random() * 0.8), r, 0, 0, Math.PI * 2);
    }
    path.ellipse((bank.x0 + bank.x1) / 2, bank.y, (bank.x1 - bank.x0) / 2, bank.t * 0.32, 0, 0, Math.PI * 2);
    const box = { x0: bank.x0 - 200, y0: bank.y - bank.t * 3.4, x1: bank.x1 + 200, y1: bank.y + bank.t * 1.2 };
    // Lit from below and toward the gorge.
    const toward = Math.sign(SUN.x - (bank.x0 + bank.x1) / 2) * 0.35;
    printUnion(ctx, { path, box }, bank.inks, { x: toward, y: 0.94 }, bank.t * 0.6, bank.t * 0.34);
  }
}

function birds(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = INK.violet;
  ctx.lineCap = "round";
  for (const [x, y, s] of [
    [1290, 372, 15],
    [1336, 350, 12],
    [1384, 384, 10],
    [1250, 404, 9],
    [1420, 362, 8],
  ]) {
    ctx.lineWidth = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.2);
    ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.6, x, y);
    ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.6, x + s, y - s * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- land */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const depthOf = (y: number) => Math.min(1, Math.max(0, (y - HORIZON) / (FOOT_TOP - HORIZON)));

/** The gorge's edges at a height: where the near bank drops and where the far bluff begins. */
function gorgeAt(y: number): { near: number; far: number } {
  const t = depthOf(y);
  return {
    near: lerp(1124, 994, t) - Math.sin(t * 3.1) * 14,
    far: lerp(1268, 1700, Math.pow(t, 0.85)) + Math.sin(t * 2.4) * 16,
  };
}

/** The ground's height under the girder line at a depth: the near bank where the rollers stand. */
const GROUND_AT_GIRDER = 650;

function land(ctx: CanvasRenderingContext2D, random: Random) {
  const { w } = ARMY_POSTER;
  // Far headlands of the island, hazed by the afterglow, parted where the river comes out.
  for (const [base, amp, colour, seed] of [
    [HORIZON - 6, 52, "#b8789a", 0.3],
    [HORIZON + 2, 30, "#8a5a8e", 1.7],
  ] as const) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-8, HORIZON + 10);
    for (let x = -8; x <= w + 8; x += 16) {
      const notch = Math.exp(-Math.pow((x - SUN.x) / 150, 2));
      const y = base - amp * (0.5 + 0.5 * Math.sin(x * 0.0042 + seed)) * (0.6 + 0.4 * Math.sin(x * 0.011 + seed * 3)) * (1 - notch * 0.85);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 8, HORIZON + 10);
    ctx.closePath();
    ctx.fill();
  }
  // The river down the gorge: the sky again, gold under the sun, mauve toward us.
  const near: Pt[] = [];
  const far: Pt[] = [];
  for (let y = HORIZON - 2; y <= FOOT_TOP + 4; y += 6) {
    const r = gorgeAt(y);
    near.push({ x: r.near - 30, y });
    far.push({ x: r.far + 10, y });
  }
  const water = polygon([...near, ...far.reverse()]);
  const wg = ctx.createLinearGradient(0, HORIZON, 0, FOOT_TOP);
  wg.addColorStop(0, "#fff0b8");
  wg.addColorStop(0.3, "#f4a77a");
  wg.addColorStop(1, "#8c4f88");
  ctx.fillStyle = wg;
  ctx.fill(water.path);
  ctx.save();
  ctx.clip(water.path);
  // The sun's path on the water, straight down the gorge, under the girder.
  for (let y = HORIZON + 2; y < FOOT_TOP + 4; y += 3 + depthOf(y) * 8) {
    const t = depthOf(y);
    const half = 18 + t * 150;
    for (let k = 0; k < 5; k += 1) {
      const x = SUN.x - half + random() * half * 2;
      const l = 12 + t * 60 * random();
      ctx.fillStyle = `rgba(255, 248, 214, ${0.75 - t * 0.35})`;
      ctx.fillRect(x - l / 2, y, l, 1.6 + t * 3.4);
    }
    // Dark ripples across the rest.
    const r = gorgeAt(y);
    for (let k = 0; k < 3; k += 1) {
      const x = r.near + random() * (r.far - r.near);
      ctx.fillStyle = "rgba(60, 30, 80, 0.32)";
      ctx.fillRect(x, y, 10 + t * 50 * random(), 1.4 + t * 2.6);
    }
  }
  ctx.restore();

  // The far bluff: backlit, its face to us in shadow, its lip catching the sky.
  const farEdge: Pt[] = [];
  for (let y = HORIZON - 2; y <= FOOT_TOP + 4; y += 8) farEdge.push({ x: gorgeAt(y).far + (random() - 0.5) * 8, y });
  const farBank = polygon([{ x: w + 8, y: HORIZON - 4 }, ...farEdge, { x: w + 8, y: FOOT_TOP + 4 }]);
  const fg = ctx.createLinearGradient(0, HORIZON, 0, FOOT_TOP);
  fg.addColorStop(0, "#8c6478");
  fg.addColorStop(0.5, "#6a4a66");
  fg.addColorStop(1, "#3e2a48");
  ctx.fillStyle = fg;
  ctx.fill(farBank.path);
  // Its face, dropping to the water: a band of rock in shadow under the lip.
  const face: Pt[] = [];
  for (const p of farEdge) {
    const t = depthOf(p.y);
    face.push({ x: p.x - 16 - t * 46, y: p.y + 10 + t * 56 });
  }
  const faceShape = polygon([...farEdge, ...face.reverse()]);
  ctx.fillStyle = "#3a2440";
  ctx.fill(faceShape.path);
  ctx.save();
  ctx.clip(faceShape.path);
  screen(ctx, faceShape.box, 14, Math.PI / 4, () => 0.55, INK.key);
  // Strata in the rock.
  ctx.strokeStyle = "rgba(255, 190, 150, 0.22)";
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 7; k += 1) {
    ctx.beginPath();
    for (let i = 0; i < farEdge.length; i += 1) {
      const a = farEdge[i];
      const b = face[farEdge.length - 1 - i];
      const u = (k + 1) / 8;
      const x = lerp(a.x, b.x, u);
      const y = lerp(a.y, b.y, u) + Math.sin(i * 0.9 + k) * 2;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // The lip, rimmed by the afterglow.
  ctx.save();
  ctx.strokeStyle = "#ffc98e";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  farEdge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();

  // The near bank: the ground the sappers hold, cut down to the river.
  const nearEdge: Pt[] = [];
  for (let y = HORIZON - 2; y <= FOOT_TOP + 4; y += 8) nearEdge.push({ x: gorgeAt(y).near + (random() - 0.5) * 7, y });
  const nearBank = polygon([{ x: -8, y: HORIZON - 4 }, ...nearEdge, { x: -8, y: FOOT_TOP + 4 }]);
  const ng = ctx.createLinearGradient(0, HORIZON, 0, FOOT_TOP);
  ng.addColorStop(0, "#b49a5c");
  ng.addColorStop(0.28, "#857a44");
  ng.addColorStop(1, "#4a4232");
  ctx.fillStyle = ng;
  ctx.fill(nearBank.path);
  // The cut face where the near bank drops, a sliver in shadow, its edge lit.
  ctx.fillStyle = "#3a2638";
  ctx.beginPath();
  nearEdge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  for (let i = nearEdge.length - 1; i >= 0; i -= 1) {
    const p = nearEdge[i];
    const t = depthOf(p.y);
    ctx.lineTo(p.x + 10 + t * 30, p.y + 8 + t * 40);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f0c47e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  nearEdge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  // The road down to the bank, a pale track out of the haze.
  ctx.save();
  ctx.clip(nearBank.path);
  ctx.fillStyle = "#c9a878";
  ctx.beginPath();
  ctx.moveTo(-8, HORIZON + 22);
  ctx.bezierCurveTo(200, HORIZON + 30, 420, HORIZON + 70, 620, GROUND_AT_GIRDER + 6);
  ctx.lineTo(860, GROUND_AT_GIRDER + 40);
  ctx.bezierCurveTo(500, HORIZON + 120, 200, HORIZON + 66, -8, HORIZON + 70);
  ctx.closePath();
  ctx.fill();
  // Ruts.
  ctx.strokeStyle = "rgba(90, 64, 52, 0.35)";
  ctx.lineWidth = 3;
  for (const off of [14, 34]) {
    ctx.beginPath();
    ctx.moveTo(-8, HORIZON + 30 + off * 0.6);
    ctx.bezierCurveTo(200, HORIZON + 40 + off * 0.7, 420, HORIZON + 78 + off, 700, GROUND_AT_GIRDER + 12 + off * 0.9);
    ctx.stroke();
  }
  // Grass: short lit strokes, thicker toward us, leaning in the dawn wind.
  ctx.lineCap = "round";
  for (let i = 0; i < 640; i += 1) {
    const y = HORIZON + Math.pow(random(), 0.7) * (FOOT_TOP - HORIZON);
    const x = random() * gorgeAt(y).near;
    const t = depthOf(y);
    const l = 4 + t * 20;
    ctx.strokeStyle = random() < 0.6 ? `rgba(236, 210, 132, ${0.35 + t * 0.35})` : "rgba(48, 40, 40, 0.42)";
    ctx.lineWidth = 1 + t * 2.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l * 0.4, y - l);
    ctx.stroke();
  }
  // The screen in the foreground's shadow, coarse.
  ctx.globalAlpha = 0.5;
  screen(ctx, { x0: -8, y0: 640, x1: 1100, y1: FOOT_TOP + 4 }, 18, Math.PI / 4, (_, y) => ((y - 640) / (FOOT_TOP - 640)) * 0.62, INK.key);
  ctx.restore();
  // A little grass on the far bluff too.
  ctx.save();
  ctx.clip(farBank.path);
  ctx.lineCap = "round";
  for (let i = 0; i < 160; i += 1) {
    const y = HORIZON + Math.pow(random(), 0.8) * (FOOT_TOP - HORIZON);
    const x = gorgeAt(y).far + random() * (w - gorgeAt(y).far);
    const t = depthOf(y);
    ctx.strokeStyle = random() < 0.5 ? "rgba(255, 196, 150, 0.28)" : "rgba(30, 18, 40, 0.35)";
    ctx.lineWidth = 1 + t * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (3 + t * 10) * 0.3, y - 3 - t * 12);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------------------------- the column waits */

const COLUMN_PRINT = (h: number): Print => ({
  light: { x: 0.95, y: -0.3 },
  shade: h * 0.3,
  catch: h * 0.1,
  key: INK.key,
  keyWidth: Math.max(1.6, h * 0.12),
  register: { x: 1.5, y: -1 },
});

/** The canvas-topped truck at the head of the column, nose to the bank. */
function truck(ctx: CanvasRenderingContext2D, x: number, ground: number) {
  const s = 1;
  const at = (u: number, v: number): Pt => ({ x: x + u * s, y: ground - v * s });
  const print: Print = { light: { x: 0.95, y: -0.3 }, shade: 10, catch: 4, key: INK.key, keyWidth: 3, register: { x: 2, y: -1.2 } };
  const olive: Inks = { base: "#6b6a3c", light: "#e2c27e", shadow: "#33284a" };
  const canvas: Inks = { base: "#8a7a4c", light: "#f0cf8c", shadow: "#3e3048" };
  const dark: Inks = { base: "#2c2236", light: "#6a5a6a", shadow: "#1a1224" };
  // Chassis and the bed.
  printShape(ctx, polygon([at(0, 22), at(150, 22), at(150, 46), at(0, 46)]), olive, print);
  // The tilt over its hoops.
  printShape(ctx, smoothClosed([at(-2, 44), at(-4, 96), at(6, 112), at(70, 116), at(132, 112), at(142, 100), at(142, 44)]), canvas, print);
  ctx.save();
  ctx.strokeStyle = "rgba(51, 40, 74, 0.6)";
  ctx.lineWidth = 2.5;
  for (const u of [36, 72, 108]) {
    const a = at(u, 46);
    const b = at(u, 114);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
  // The cab, its rounded hood and the windscreen catching the dawn.
  printShape(ctx, smoothClosed([at(146, 24), at(146, 88), at(152, 94), at(184, 94), at(190, 66), at(222, 62), at(234, 50), at(236, 24)]), olive, print);
  printShape(ctx, polygon([at(156, 66), at(182, 66), at(186, 88), at(158, 88)]), { base: "#f6c98a", light: "#fff2c6", shadow: "#b8806a" }, { ...print, shade: 3 });
  // Fenders and wheels.
  for (const u of [40, 116, 202]) {
    printShape(ctx, smoothClosed([at(u - 24, 22), at(u - 22, 40), at(u, 46), at(u + 22, 40), at(u + 24, 22)]), olive, { ...print, shade: 5 });
    const c = at(u, 16);
    const wheel = new Path2D();
    wheel.arc(c.x, c.y, 17, 0, Math.PI * 2);
    printShape(ctx, { path: wheel, box: { x0: c.x - 18, y0: c.y - 18, x1: c.x + 18, y1: c.y + 18 } }, dark, { ...print, shade: 6 });
    ctx.fillStyle = "#8a7a5c";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A sapper on the march, small in the column: walking toward the bank, shovel on his pack. */
function marcher(ctx: CanvasRenderingContext2D, x: number, ground: number, h: number, step: number): void {
  const stride = h * (1.0 + step * 0.4);
  const rig = rigSapper({
    h,
    hip: { x, y: ground - h * 4.0 },
    lean: 0.08,
    look: 0.05,
    ankles: { near: { x: x + stride * 0.55, y: ground - h * 0.4 }, far: { x: x - stride * 0.5, y: ground - h * 0.45 } },
    toes: { near: -0.1, far: 0.45 },
    wrists: { near: { x: x - h * 0.7, y: ground - h * 3.7 }, far: { x: x + h * 0.8, y: ground - h * 3.8 } },
    facing: 1,
  });
  paintSapper(ctx, rig, COLUMN_INKS, COLUMN_PRINT(h));
}

const COLUMN_INKS: SapperInks = {
  cloth: { base: "#6c6a46", light: "#e6c584", shadow: "#36294c" },
  clothFar: { base: "#55543c", light: "#a89464", shadow: "#2c2442" },
  cuff: { base: "#8c8456", light: "#ecd394", shadow: "#46384a" },
  skin: { base: "#b77a5a", light: "#f6c492", shadow: "#62384a" },
  skinFar: { base: "#94604e", light: "#cf9469", shadow: "#4f2c3a" },
  web: { base: "#a8946a", light: "#f1dea4", shadow: "#5a4a4c" },
  boot: { base: "#45282c", light: "#9a6444", shadow: "#22141f" },
  steel: { base: "#5a6038", light: "#f6d890", shadow: "#2b2538" },
  wood: { base: "#8a5a36", light: "#d39c62", shadow: "#3c2430" },
};

/** Down the road behind the sappers: a truck and a file of men, waiting for the bridge. */
function column(ctx: CanvasRenderingContext2D) {
  ctx.save();
  // Their shadows, long on the road away from the dawn.
  ctx.fillStyle = "rgba(40, 22, 60, 0.35)";
  ctx.beginPath();
  ctx.ellipse(150, 640, 200, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  truck(ctx, 18, 622);
  // The file, from the truck to the sappers' backs, each a step further along.
  for (let i = 0; i < 5; i += 1) {
    marcher(ctx, 58 + i * 40, 640 + i * 1.5, 12.5 + i * 0.2, i % 2);
  }
}

/* ------------------------------------------------------------- girder */

/** A point on the girder: `t` px along its axis from the tail, `off` px across it (positive down). */
function onGirder(t: number, off: number): Pt {
  const dx = ARMY_HOLE.x - TAIL.x;
  const dy = ARMY_HOLE.y - TAIL.y;
  const d = { x: dx / SPAN, y: dy / SPAN };
  const n = { x: -d.y, y: d.x };
  return { x: TAIL.x + d.x * t + n.x * off, y: TAIL.y + d.y * t + n.y * off };
}

/** Where along the girder a vertical line at `x` meets its axis. */
const alongAt = (x: number) => ((x - TAIL.x) / (ARMY_HOLE.x - TAIL.x)) * SPAN;

/** A steel bar of width `w` between two points, square-ended. */
function bar(a: Pt, b: Pt, w: number): Shape {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (-(b.y - a.y) / l) * (w / 2);
  const ny = ((b.x - a.x) / l) * (w / 2);
  return polygon([
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ]);
}

/** The girder's olive: the same three inks the 3D nose is matched to (ArmySet). */
export const ARMY_STEEL = { base: "#6a7340", light: "#ecd690", shadow: "#33294a" } as const;
const STEEL: Inks = ARMY_STEEL;
const STEEL_FAR: Inks = { base: "#4c5236", light: "#a8946a", shadow: "#2a2140" };

/**
 * A Bailey-type girder nearly side on: the far truss panel, the transoms
 * between, then the near panel bay by bay (chords, end and middle posts,
 * the V of its braces), pinned at the joints. Lit from the gorge.
 */
function girder(ctx: CanvasRenderingContext2D) {
  const { depth, bay, far, bays } = ARMY_GIRDER;
  const half = depth / 2;
  const length = SPAN + 60;
  const light = { x: 0.9, y: -0.44 };
  const print = (w: number): Print => ({
    light,
    shade: w * 0.45,
    catch: w * 0.3,
    key: INK.key,
    keyWidth: 3.4,
    register: { x: 3, y: -2 },
    fringe: { ink: INK.magenta, offset: { x: -2.5, y: 2 } },
  });
  const shift = (p: Pt): Pt => ({ x: p.x + far.x, y: p.y + far.y });
  const panel = (inks: Inks, move: (p: Pt) => Pt, scale: number) => {
    for (let i = 0; i < bays + 1; i += 1) {
      const t0 = i * bay;
      const t1 = t0 + bay;
      const tm = t0 + bay / 2;
      for (const [a, b] of [
        [onGirder(t0, half), onGirder(tm, -half)],
        [onGirder(tm, -half), onGirder(t1, half)],
      ]) {
        printShape(ctx, bar(move(a), move(b), 13 * scale), inks, print(13 * scale));
      }
      printShape(ctx, bar(move(onGirder(tm, -half)), move(onGirder(tm, half)), 11 * scale), inks, print(11 * scale));
      printShape(ctx, bar(move(onGirder(t0, -half - 6)), move(onGirder(t0, half + 6)), (i === 0 ? 26 : 16) * scale), inks, print(16 * scale));
    }
    for (const off of [-half, half]) {
      printShape(ctx, bar(move(onGirder(-10, off)), move(onGirder(length, off)), 24 * scale), inks, print(24 * scale));
    }
    // Panel pins, a bright bolt head each.
    ctx.fillStyle = inks.light;
    for (let i = 0; i <= bays + 1; i += 1) {
      for (const off of [-half, half]) {
        const p = move(onGirder(i * bay, off));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.6 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  panel(STEEL_FAR, shift, 0.9);
  // The transoms between the two trusses, top and bottom, in shadow.
  for (let i = 0; i <= (bays + 1) * 2; i += 1) {
    for (const off of [-half, half]) {
      const a = onGirder((i * bay) / 2, off);
      printShape(ctx, bar(a, shift(a), 9), STEEL_FAR, print(9));
    }
  }
  panel(STEEL, (p) => p, 1);
  // The top chord catches the sky along its whole length.
  ctx.save();
  ctx.strokeStyle = "rgba(255, 236, 170, 0.75)";
  ctx.lineWidth = 3;
  const a = onGirder(-10, -half - 9);
  const b = onGirder(length, -half - 9);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Launching rollers: a drum in a cradle on a base plate. One under the
 * tail, one on the lip of the near bank, and the landing roller waiting on
 * the far bluff, staked out with a pennant.
 */
function rollers(ctx: CanvasRenderingContext2D, under: boolean) {
  const print: Print = { light: { x: 0.9, y: -0.44 }, shade: 7, catch: 3, key: INK.key, keyWidth: 3, register: { x: 2.5, y: -1.5 } };
  const cradle: Inks = { base: "#4f4a3a", light: "#d8b27a", shadow: "#271c33" };
  const drum: Inks = { base: "#7a6a5a", light: "#f4d79c", shadow: "#2f2440" };
  const roller = (x: number, top: number, s: number) => {
    const r = 13 * s;
    const ground = top + r * 2 + 8 * s;
    printShape(ctx, polygon([{ x: x - 40 * s, y: ground - 7 * s }, { x: x + 40 * s, y: ground - 7 * s }, { x: x + 44 * s, y: ground }, { x: x - 44 * s, y: ground }]), cradle, print);
    printShape(ctx, polygon([{ x: x - 26 * s, y: ground - 6 * s }, { x: x - 20 * s, y: top + r }, { x: x + 20 * s, y: top + r }, { x: x + 26 * s, y: ground - 6 * s }]), cradle, print);
    const path = new Path2D();
    path.ellipse(x, top + r, r * 1.6, r, 0, 0, Math.PI * 2);
    printShape(ctx, { path, box: { x0: x - r * 1.7, y0: top - 2, x1: x + r * 1.7, y1: top + r * 2 + 2 } }, drum, print);
  };
  const tBank = alongAt(gorgeAt(GROUND_AT_GIRDER).near - 24);
  const tTail = alongAt(690);
  if (under) {
    for (const t of [tTail, tBank]) {
      const p = onGirder(t, ARMY_GIRDER.depth / 2 + 12);
      roller(p.x, p.y, 1);
    }
    return;
  }
  // The landing roller on the far bluff, under the nose's line, and the stakes and tape round it.
  const land = { x: 1560, y: 600 };
  roller(land.x, land.y, 0.85);
  ctx.save();
  ctx.lineCap = "round";
  for (const [x, y] of [
    [1494, 646],
    [1632, 642],
  ]) {
    ctx.strokeStyle = INK.key;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - 62);
    ctx.stroke();
    ctx.strokeStyle = "#e9c88c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 4);
    ctx.lineTo(x + 2.5, y - 60);
    ctx.stroke();
  }
  // White tape between them, and a red pennant on the far stake.
  ctx.strokeStyle = INK.cream;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1496, 606);
  ctx.quadraticCurveTo(1565, 618, 1634, 602);
  ctx.stroke();
  ctx.fillStyle = INK.red;
  ctx.strokeStyle = INK.key;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(1634, 580);
  ctx.lineTo(1672, 590);
  ctx.lineTo(1634, 600);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------------------------------------- sappers */

const SAPPER_INKS: SapperInks = {
  cloth: { base: "#6c7240", light: "#eccb7e", shadow: "#33284a" },
  clothFar: { base: "#535734", light: "#b49862", shadow: "#2a2240" },
  cuff: { base: "#9b955a", light: "#f4dc98", shadow: "#46384a" },
  skin: { base: "#c07a54", light: "#ffd09a", shadow: "#5e3044" },
  skinFar: { base: "#99604a", light: "#e0a274", shadow: "#4a2838" },
  web: { base: "#b6a06a", light: "#f6e2a8", shadow: "#5a4650" },
  boot: { base: "#4a2c2c", light: "#b0744c", shadow: "#20121e" },
  steel: { base: "#5c6537", light: "#ffe29a", shadow: "#272236" },
  wood: { base: "#8a5a36", light: "#e0a466", shadow: "#3a2230" },
};

const SAPPER_LIGHT: Pt = { x: 0.92, y: -0.4 };

/**
 * The two sappers. The pusher, big in front, drives the girder's tail
 * over the rollers: one hand on the end post, one gripping the bottom
 * chord, back leg dug in. The pointer, on the lip of the bank behind the
 * girder, a hand on the top chord, shows the way to the far bank.
 */
export function armySappers(): { pusher: SapperRig; pointer: SapperRig } {
  const { depth } = ARMY_GIRDER;
  const g = (t: number, off: number) => onGirder(t, off);
  const pusher = rigSapper({
    h: 60,
    hip: { x: 336, y: 606 },
    lean: 0.98,
    look: 0.62,
    drop: 0.18,
    ankles: { near: { x: 420, y: 700 }, far: { x: 176, y: 712 } },
    toes: { near: 0.1, far: 0.8 },
    wrists: { near: g(-26, 4), far: g(64, -depth / 2 + 2) },
    hands: { near: { kind: "push" }, far: { kind: "grip", curl: 1 } },
    facing: 1,
  });
  const pointer = rigSapper({
    h: 46,
    hip: { x: 958, y: 524 },
    lean: 0.16,
    look: -0.05,
    drop: -0.1,
    ankles: { near: { x: 1018, y: 622 }, far: { x: 906, y: 640 } },
    toes: { near: -0.1, far: 0.35 },
    wrists: { near: { x: 1132, y: 372 }, far: g(alongAt(948), -depth / 2 - 4) },
    hands: { near: { kind: "point" }, far: { kind: "grip", curl: 1 } },
    facing: 1,
  });
  return { pusher, pointer };
}

function sapperPrint(rig: SapperRig, fringe: boolean): Print {
  return {
    light: SAPPER_LIGHT,
    shade: rig.h * 0.3,
    catch: rig.h * 0.09,
    key: INK.key,
    keyWidth: rig.h * 0.08,
    dots: { ink: "rgba(28, 14, 50, 0.6)", step: rig.h * 0.24, size: 0.45 },
    register: { x: 3.5, y: -2.4 },
    fringe: fringe ? { ink: INK.magenta, offset: { x: -3, y: 2.4 } } : undefined,
  };
}

/** Dust kicked up behind a boot dug into the bank: soft puffs thrown back and up, thinning out. */
function dust(ctx: CanvasRenderingContext2D, at: Pt, random: Random) {
  ctx.save();
  for (let i = 0; i < 14; i += 1) {
    const u = i / 13;
    const r = 7 + u * 22 + random() * 6;
    const x = at.x - 10 - u * 130 - random() * 14;
    const y = at.y - 4 - u * u * 36 - random() * 10;
    ctx.globalAlpha = 0.75 - u * 0.5;
    ctx.fillStyle = "#c8a274";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Lit on the side toward the dawn.
    ctx.fillStyle = "#fbe2a8";
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y - r * 0.3, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Clods thrown back.
  ctx.fillStyle = "#4a3428";
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.arc(at.x - 30 - random() * 140, at.y - 10 - random() * 60, 2 + random() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function castShadow(ctx: CanvasRenderingContext2D, rig: SapperRig) {
  const f = footprint(rig);
  ctx.save();
  ctx.fillStyle = "rgba(36, 18, 58, 0.5)";
  ctx.beginPath();
  ctx.ellipse((f.x0 + f.x1) / 2 - rig.h * 0.9, f.y, (f.x1 - f.x0) / 2 + rig.h, rig.h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* -------------------------------------------------------------- type */

/** Our engineers' tower: a castle keep with two lower towers, gate and slits, in a roundel. No official insignia. */
function emblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = INK.key;
  ctx.beginPath();
  ctx.arc(6, 7, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK.redDeep;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK.cream;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = INK.key;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  // Rivets round the ring.
  ctx.fillStyle = INK.sodium;
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93, r * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  const s = (r * 0.86) / 100;
  const tower = (x0: number, x1: number, top: number, merlons: number) => {
    ctx.fillRect(x0 * s, top * s, (x1 - x0) * s, (52 - top) * s);
    const mw = (x1 - x0) / (merlons * 2 - 1);
    for (let i = 0; i < merlons; i += 1) ctx.fillRect((x0 + i * mw * 2) * s, (top - 12) * s, mw * s, 13 * s);
  };
  ctx.fillStyle = INK.key;
  tower(-58, -24, -14, 2);
  tower(24, 58, -14, 2);
  tower(-30, 30, -44, 3);
  ctx.fillRect(-58 * s, 4 * s, 116 * s, 48 * s);
  ctx.fillStyle = INK.cream;
  ctx.beginPath();
  ctx.moveTo(-12 * s, 52 * s);
  ctx.lineTo(-12 * s, 26 * s);
  ctx.arc(0, 26 * s, 12 * s, Math.PI, 0);
  ctx.lineTo(12 * s, 52 * s);
  ctx.closePath();
  ctx.fill();
  for (const x of [-41, 41, -9, 9]) ctx.fillRect((x - 3) * s, (x === -9 || x === 9 ? -26 : 0) * s, 6 * s, 16 * s);
  ctx.strokeStyle = INK.cream;
  ctx.lineWidth = 1.8 * s;
  for (const y of [18, 34]) {
    ctx.beginPath();
    ctx.moveTo(-58 * s, y * s);
    ctx.lineTo(-14 * s, y * s);
    ctx.moveTo(14 * s, y * s);
    ctx.lineTo(58 * s, y * s);
    ctx.stroke();
  }
  ctx.fillStyle = INK.red;
  ctx.fillRect(-66 * s, 56 * s, 132 * s, 9 * s);
  ctx.restore();
}

/** The unit's name on a ribbon with folded swallow-tail ends, on a gentle arch. */
function ribbon(ctx: CanvasRenderingContext2D, text: string, random: Random, x0: number, x1: number, y0: number) {
  const height = 70;
  const y1 = y0 + height;
  const tail = (x: number, dir: 1 | -1) => {
    const back = x + dir * 70;
    ctx.fillStyle = INK.redDeep;
    ctx.beginPath();
    ctx.moveTo(x - dir * 10, y0 + 16);
    ctx.lineTo(back, y0 + 16);
    ctx.lineTo(back - dir * 24, (y0 + y1) / 2 + 16);
    ctx.lineTo(back, y1 + 16);
    ctx.lineTo(x - dir * 10, y1 + 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK.key;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = INK.key;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x + dir * 16, y1 + 16);
    ctx.lineTo(x, y1 + 16);
    ctx.closePath();
    ctx.fill();
  };
  tail(x1, 1);
  tail(x0, -1);
  // Its shadow on the sky, then the band.
  ctx.fillStyle = "rgba(28, 12, 44, 0.45)";
  ctx.fillRect(x0 + 8, y0 + 9, x1 - x0, height);
  ctx.fillStyle = INK.red;
  ctx.fillRect(x0, y0, x1 - x0, height);
  // Lighter along the top, the fold of the cloth.
  ctx.fillStyle = "rgba(255, 200, 160, 0.25)";
  ctx.fillRect(x0, y0, x1 - x0, height * 0.28);
  ctx.strokeStyle = INK.key;
  ctx.lineWidth = 4;
  ctx.strokeRect(x0, y0, x1 - x0, height);
  ctx.strokeStyle = INK.cream;
  ctx.lineWidth = 2.5;
  for (const y of [y0 + 8, y1 - 8]) {
    ctx.beginPath();
    ctx.moveTo(x0 + 6, y);
    ctx.lineTo(x1 - 6, y);
    ctx.stroke();
  }
  inkVoids(ctx, { x0, y0, x1, y1 }, INK.paper, random, 0.14, 2.2);
  let size = 58;
  const tracking = (s: number) => s * 0.09;
  ctx.font = `900 ${size}px ${caps()}`;
  const room = x1 - x0 - 60;
  const wNow = spacedWidth(ctx, text, tracking(size));
  if (wNow > room) size *= room / wNow;
  ctx.font = `900 ${size}px ${caps()}`;
  const width = spacedWidth(ctx, text, tracking(size));
  ctx.textBaseline = "alphabetic";
  const bx = x0 + (x1 - x0 - width) / 2;
  const by = (y0 + y1) / 2 + size * 0.38;
  ctx.fillStyle = INK.key;
  spaced(ctx, text, bx + 3, by + 3, tracking(size));
  ctx.fillStyle = INK.cream;
  spaced(ctx, text, bx, by, tracking(size));
}

/** The slogan in one line across the top, hand-cut capitals with a keyline and a block shadow. */
function headline(ctx: CanvasRenderingContext2D, copy: Copy, random: Random, left: number, right: number): number {
  const text = copy.headline.join(" ");
  const inks = { face: INK.cream, key: INK.key, block: INK.redDeep };
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let size = 214;
  const tracking = 0.02;
  ctx.font = `900 ${size}px ${caps()}`;
  const natural = ctx.measureText(text).width + text.length * size * tracking;
  size = Math.min(size, (size * (right - left)) / natural);
  ctx.font = `900 ${size}px ${caps()}`;
  const m = ctx.measureText("H");
  const base = 40 + m.actualBoundingBoxAscent;
  const depth = Math.round(size * 0.07);
  // Word by word, so the comma's word can take the red.
  let x = left;
  const words = text.split(" ");
  words.forEach((word, i) => {
    const wm = ctx.measureText(word);
    const lead = i === 0;
    blockLetters(
      ctx,
      word,
      x,
      base,
      lead ? { face: INK.sodium, key: INK.key, block: INK.redDeep } : inks,
      depth,
      size * 0.075,
      { x0: x - 20, y0: base - m.actualBoundingBoxAscent - 30, x1: x + wm.width + 30, y1: base + 40 },
      INK.paper,
      random,
    );
    x += wm.width + ctx.measureText(" ").width * 0.9 + size * tracking * word.length;
  });
  return base + depth;
}

/** The foot band: the call to enlist on the left, place and years on the right, both big enough for a phone. */
function foot(ctx: CanvasRenderingContext2D, copy: Copy, random: Random) {
  const { w, h } = ARMY_POSTER;
  ctx.fillStyle = INK.violet;
  ctx.fillRect(-8, FOOT_TOP, w + 16, h - FOOT_TOP + 8);
  ctx.fillStyle = INK.red;
  ctx.fillRect(-8, FOOT_TOP, w + 16, 10);
  ctx.fillStyle = INK.cream;
  ctx.fillRect(-8, FOOT_TOP + 10, w + 16, 3);
  // The band's own coarse screen.
  ctx.save();
  ctx.globalAlpha = 0.35;
  screen(ctx, { x0: 0, y0: FOOT_TOP + 14, x1: w, y1: h }, 16, Math.PI / 4, () => 0.4, "#160a2e");
  ctx.restore();
  inkVoids(ctx, { x0: 0, y0: FOOT_TOP, x1: w, y1: h }, INK.paper, random, 0.05, 2);
  const [call, place] = copy.foot;
  const [where, when] = place.split(" · ");
  const top = FOOT_TOP + 13;
  const mid = top + (h - top) / 2;
  const tracking = (s: number) => s * 0.05;
  const fit = (text: string, start: number, room: number) => {
    let size = start;
    ctx.font = `900 ${size}px ${caps()}`;
    const width = spacedWidth(ctx, text, tracking(size));
    if (width > room) size *= room / width;
    ctx.font = `900 ${size}px ${caps()}`;
    return size;
  };
  ctx.textBaseline = "alphabetic";
  // The call, in sodium, with a hard shadow.
  const s1 = fit(call, 112, 860);
  const capOf = (s: number) => s * 0.8;
  const callBase = mid + capOf(s1) / 2;
  ctx.fillStyle = INK.key;
  spaced(ctx, call, 64 + 4, callBase + 4, tracking(s1));
  ctx.fillStyle = INK.sodium;
  const callW = spaced(ctx, call, 64, callBase, tracking(s1));
  // Three chevrons point on toward the road.
  ctx.fillStyle = INK.red;
  for (let i = 0; i < 3; i += 1) {
    const x = 64 + callW + 28 + i * 30;
    ctx.beginPath();
    ctx.moveTo(x, mid - 22);
    ctx.lineTo(x + 20, mid);
    ctx.lineTo(x, mid + 22);
    ctx.lineTo(x + 9, mid);
    ctx.closePath();
    ctx.fill();
  }
  // Place over years, stacked flush right, both as big as the band allows.
  const right = w - 64;
  const start = 64 + callW + 150;
  const lines = when ? [where, when] : [place];
  const gap = 14;
  const room = (h - top - 36 - gap * (lines.length - 1)) / lines.length;
  let size = room / 0.8;
  ctx.font = `900 ${size}px ${caps()}`;
  const widest = Math.max(...lines.map((line) => spacedWidth(ctx, line, tracking(size))));
  if (widest > right - start) size *= (right - start) / widest;
  ctx.font = `900 ${size}px ${caps()}`;
  const block = lines.length * capOf(size) + gap * (lines.length - 1);
  lines.forEach((line, i) => {
    const base = mid - block / 2 + capOf(size) * (i + 1) + gap * i;
    const lw = spacedWidth(ctx, line, tracking(size));
    ctx.fillStyle = INK.key;
    spaced(ctx, line, right - lw + 3, base + 3, tracking(size));
    ctx.fillStyle = i === 1 ? INK.sodium : INK.cream;
    spaced(ctx, line, right - lw, base, tracking(size));
  });
}

/* ------------------------------------------------------------- paper */

/**
 * The 4 x 2 sheets as a billposter hangs them: each pasted a few px off
 * its neighbour (the picture jogs at the seams), each a shade apart, the
 * overlaps a lit edge over a shadow, a few corners peeled back to the
 * board, rain streaks and a tide mark.
 */
function sheets(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, random: Random) {
  const { w, h } = ARMY_POSTER;
  const sw = w / 4;
  const sh = h / 2;
  // Hang each sheet a little off: copy the picture and paste it back shifted.
  const copy = document.createElement("canvas");
  copy.width = w;
  copy.height = h;
  copy.getContext("2d")?.drawImage(canvas, 0, 0);
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const dx = Math.round((random() - 0.5) * 6);
      const dy = Math.round((random() - 0.5) * 5);
      if (dx || dy) ctx.drawImage(copy, c * sw, r * sh, sw, sh, c * sw + dx, r * sh + dy, sw, sh);
      const k = random();
      ctx.fillStyle = k < 0.5 ? `rgba(255, 240, 205, ${0.03 + k * 0.1})` : `rgba(90, 55, 35, ${(k - 0.5) * 0.14})`;
      ctx.fillRect(c * sw, r * sh, sw, sh);
    }
  }
  // Overlaps: each sheet's edge lies over the next, a lit lip and its shadow, a little wavy where the paste ran.
  const seam = (a: Pt, b: Pt, nx: number, ny: number) => {
    const steps = 40;
    for (const [off, style, width] of [
      [3.5, "rgba(30, 14, 30, 0.42)", 5],
      [-1.5, "rgba(255, 246, 226, 0.4)", 3],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const wob = Math.sin(t * 17 + a.x * 0.01) * 1.2 + (random() - 0.5) * 0.8;
        const x = lerp(a.x, b.x, t) + nx * (off + wob);
        const y = lerp(a.y, b.y, t) + ny * (off + wob);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  };
  for (let c = 1; c < 4; c += 1) seam({ x: c * sw, y: 0 }, { x: c * sw, y: h }, 1, 0);
  seam({ x: 0, y: sh }, { x: w, y: sh }, 0, 1);
  // Corners peeled where the paste gave: the board's grey timber under, the curl the sheet's plain back.
  for (const [x, y, dx, dy, size] of [
    [0, 0, 1, 1, 70],
    [w, h, -1, -1, 64],
    [0, sh, 1, -1, 92],
    [sw * 3, sh, 1, -1, 84],
    [w, 0, -1, 1, 44],
  ] as const) {
    peel(ctx, { x, y }, dx, dy, size, random);
  }
}

/** A sheet corner lifted off the board and curled back on itself. */
function peel(ctx: CanvasRenderingContext2D, at: Pt, dx: number, dy: number, size: number, random: Random) {
  const b = { x: at.x + dx * size, y: at.y };
  const c = { x: at.x, y: at.y + dy * size * 0.9 };
  // What shows under it: the sheet below, or the timber.
  const bare = polygon([at, b, c]);
  ctx.save();
  ctx.fillStyle = "#3a3038";
  ctx.fill(bare.path);
  ctx.clip(bare.path);
  ctx.strokeStyle = "rgba(160, 140, 130, 0.35)";
  ctx.lineWidth = 2;
  for (let i = -size; i < size * 2; i += 12) {
    ctx.beginPath();
    ctx.moveTo(at.x - size, at.y + i);
    ctx.lineTo(at.x + size, at.y + i + (random() - 0.5) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(220, 200, 160, 0.35)";
  for (let i = 0; i < 10; i += 1) ctx.fillRect(at.x + dx * random() * size * 0.7, at.y + dy * random() * size * 0.6, 6 + random() * 10, 2 + random() * 3);
  ctx.restore();
  // The curl: the sheet's back, folded over the diagonal, its shadow on the print.
  const tip = { x: at.x + dx * size * 0.72, y: at.y + dy * size * 0.64 };
  const ctrl = { x: (b.x + c.x) / 2 + dx * size * 0.1, y: (b.y + c.y) / 2 + dy * size * 0.12 };
  const flap = new Path2D();
  flap.moveTo(b.x, b.y);
  flap.quadraticCurveTo(ctrl.x + dx * size * 0.2, ctrl.y, tip.x, tip.y);
  flap.quadraticCurveTo(ctrl.x, ctrl.y + dy * size * 0.2, c.x, c.y);
  flap.closePath();
  ctx.save();
  ctx.translate(dx * 6, dy * 8);
  ctx.fillStyle = "rgba(24, 10, 26, 0.45)";
  ctx.fill(flap);
  ctx.restore();
  const grad = ctx.createLinearGradient(b.x, b.y + (c.y - b.y) / 2, tip.x, tip.y);
  grad.addColorStop(0, "#b8aa88");
  grad.addColorStop(0.45, INK.paperBack);
  grad.addColorStop(1, "#f6eedb");
  ctx.fillStyle = grad;
  ctx.fill(flap);
  ctx.strokeStyle = "rgba(60, 40, 30, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke(flap);
  // The fold: a hard lit line along the crease.
  ctx.strokeStyle = "rgba(255, 252, 240, 0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
}

function weather(ctx: CanvasRenderingContext2D, random: Random) {
  const { w, h } = ARMY_POSTER;
  wrinkles(ctx, w, h, random, 22);
  // Rain runs down from the top edge and from the seam, dirty and visible from the road.
  for (let i = 0; i < 30; i += 1) {
    const x = random() * w;
    const y0 = random() < 0.3 ? h / 2 : 0;
    const l = 120 + random() * 420;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + l);
    g.addColorStop(0, "rgba(64, 40, 38, 0.3)");
    g.addColorStop(1, "rgba(64, 40, 38, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 3 + random() * 7, l);
  }
  const tide = ctx.createLinearGradient(0, h - 190, 0, h);
  tide.addColorStop(0, "rgba(110, 70, 40, 0)");
  tide.addColorStop(0.5, "rgba(110, 70, 40, 0.1)");
  tide.addColorStop(1, "rgba(70, 40, 30, 0.24)");
  ctx.fillStyle = tide;
  ctx.fillRect(0, h - 190, w, 190);
  // Foxing.
  for (let i = 0; i < 36; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const r = 8 + random() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(140, 95, 45, 0.18)");
    g.addColorStop(1, "rgba(140, 95, 45, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/**
 * The tear the girder comes through, over the far bluff where it will
 * land: a jagged hole along the girder's line, the paper's white fibrous
 * core on every edge, an older poster showing in a ring under it, the
 * gap behind the board dark in the middle, and three big flaps curled
 * back toward us, lit on their backs by the floods.
 */
function tear(ctx: CanvasRenderingContext2D, random: Random) {
  const { x, y, r } = ARMY_HOLE;
  const a = ARMY_GIRDER.pitch;
  const along = { x: Math.cos(a), y: -Math.sin(a) };
  const across = { x: -along.y, y: along.x };
  const ring = (scale: number, rough: number): Pt[] => {
    const points: Pt[] = [];
    const n = 46;
    let drift = 0;
    for (let i = 0; i < n; i += 1) {
      const t = (i / n) * Math.PI * 2;
      drift = drift * 0.6 + (random() - 0.5) * rough;
      const jag = (i % 2 ? 1 : -1) * rough * 0.4 * random();
      const rr = r * scale * (1 + drift + jag);
      const u = Math.cos(t) * rr * 1.24;
      const v = Math.sin(t) * rr * 0.86;
      points.push({ x: x + along.x * u + across.x * v, y: y + along.y * u + across.y * v });
    }
    return points;
  };
  const outer = polygon(ring(1, 0.22));
  const inner = polygon(ring(0.8, 0.18));
  // The older poster under ours: a red and cream stripe and a big black letter, torn too.
  ctx.save();
  ctx.clip(outer.path);
  ctx.fillStyle = "#c9b48a";
  ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.fillStyle = "#a33a2c";
  ctx.fillRect(x - r * 2, y - r * 0.5, r * 4, r * 0.6);
  ctx.fillStyle = "#2a2230";
  ctx.font = `900 ${r * 1.6}px ${caps()}`;
  ctx.fillText("R", x - r * 1.1, y + r * 0.9);
  ctx.fillStyle = "rgba(255, 250, 235, 0.3)";
  ctx.fillRect(x - r * 2, y + r * 0.1, r * 4, 6);
  // The core of our paper round the edge: white, fibrous.
  ctx.strokeStyle = "rgba(250, 245, 232, 0.95)";
  ctx.lineWidth = 9;
  ctx.stroke(outer.path);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgba(250, 245, 232, 0.85)";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  const o = ring(1, 0);
  for (let i = 0; i < 160; i += 1) {
    const p = o[Math.floor(random() * o.length)];
    const dx = p.x - x;
    const dy = p.y - y;
    const l = Math.hypot(dx, dy) || 1;
    const k = (random() - 0.3) * 8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + (dx / l) * k + (random() - 0.5) * 3, p.y + (dy / l) * k + (random() - 0.5) * 3);
    ctx.stroke();
  }
  ctx.restore();
  // The gap behind the board: the backing's timber in deep shadow.
  ctx.save();
  ctx.clip(inner.path);
  const gap = ctx.createRadialGradient(x, y, 0, x, y, r);
  gap.addColorStop(0, "#120a1c");
  gap.addColorStop(1, "#2a1e2c");
  ctx.fillStyle = gap;
  ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.strokeStyle = "rgba(120, 100, 110, 0.25)";
  ctx.lineWidth = 2;
  for (let k = -r; k < r; k += 22) {
    ctx.beginPath();
    ctx.moveTo(x - r * 2, y + k);
    ctx.lineTo(x + r * 2, y + k + 4);
    ctx.stroke();
  }
  ctx.restore();
  // Inner edge of the old poster: its own white core, thinner.
  ctx.save();
  ctx.strokeStyle = "rgba(236, 226, 205, 0.8)";
  ctx.lineWidth = 3.5;
  ctx.stroke(inner.path);
  ctx.restore();
  // Three big flaps of our sheet, peeled back over the print: broad, ragged at the torn edge,
  // the paper's plain back lit by the floods, rolled and shadowed where they leave the rim.
  for (const [angle, length, width] of [
    [-2.25, 70, 120],
    [2.0, 64, 112],
    [-0.75, 52, 84],
  ] as const) {
    const dir = { x: Math.cos(angle) * along.x - Math.sin(angle) * along.y, y: Math.cos(angle) * along.y + Math.sin(angle) * along.x };
    const side = { x: -dir.y, y: dir.x };
    const rim = { x: x + dir.x * r * 1.1, y: y + dir.y * r * 0.8 };
    const p = (u: number, v: number): Pt => ({ x: rim.x + dir.x * u + side.x * v, y: rim.y + dir.y * u + side.y * v });
    const edge: Pt[] = [p(-6, -width / 2)];
    // The torn edge, from one corner round to the other, jagged.
    const n = 9;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const v = lerp(-width * 0.42, width * 0.36, t);
      const u = length * (0.55 + 0.45 * Math.sin(t * Math.PI)) * (0.85 + random() * 0.3);
      edge.push(p(u, v));
    }
    edge.push(p(-6, width / 2));
    const flap = polygon(edge);
    ctx.save();
    ctx.translate(dir.x * 8 + 4, dir.y * 8 + 7);
    ctx.fillStyle = "rgba(20, 8, 24, 0.5)";
    ctx.fill(flap.path);
    ctx.restore();
    const g = ctx.createLinearGradient(rim.x, rim.y, rim.x + dir.x * length, rim.y + dir.y * length);
    g.addColorStop(0, "#6e604e");
    g.addColorStop(0.22, "#b4a684");
    g.addColorStop(0.6, "#efe4c8");
    g.addColorStop(1, "#fbf4e2");
    ctx.fillStyle = g;
    ctx.fill(flap.path);
    ctx.save();
    ctx.clip(flap.path);
    // Ink bled through from the front, and the fibres of the torn edge.
    ctx.fillStyle = "rgba(120, 70, 90, 0.1)";
    ctx.fillRect(rim.x - 200, rim.y - 200, 400, 400);
    ctx.restore();
    ctx.strokeStyle = "rgba(255, 252, 244, 0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    edge.slice(1, -1).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    ctx.strokeStyle = "rgba(60, 40, 30, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke(flap.path);
    // The roll at the rim: a dark crease and its lit lip.
    ctx.strokeStyle = "rgba(40, 24, 30, 0.6)";
    ctx.lineWidth = 5;
    const c0 = p(4, -width * 0.48);
    const c1 = p(4, width * 0.48);
    ctx.beginPath();
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 248, 230, 0.8)";
    ctx.lineWidth = 2.5;
    const l0 = p(12, -width * 0.46);
    const l1 = p(12, width * 0.46);
    ctx.beginPath();
    ctx.moveTo(l0.x, l0.y);
    ctx.lineTo(l1.x, l1.y);
    ctx.stroke();
  }
}

/** One ink pass, nudged off register. */
function pass(ctx: CanvasRenderingContext2D, dx: number, dy: number, draw: () => void) {
  ctx.save();
  ctx.translate(dx, dy);
  draw();
  ctx.restore();
}

export function paintArmyPoster(copy: Copy): HTMLCanvasElement {
  const { w, h } = ARMY_POSTER;
  const [canvas, ctx] = makeCanvas(w, h);
  const random = createRandom(1821);
  stock(ctx, w, h, INK.paper, random);
  pass(ctx, 4, -2, () => sky(ctx, random));
  pass(ctx, -2, 2, () => land(ctx, random));
  column(ctx);
  const { pusher, pointer } = armySappers();
  // The pointer stands behind the girder; his boots are on the lip of the bank.
  castShadow(ctx, pointer);
  paintSapper(ctx, pointer, SAPPER_INKS, sapperPrint(pointer, false));
  rollers(ctx, true);
  girder(ctx);
  rollers(ctx, false);
  castShadow(ctx, pusher);
  dust(ctx, { x: pusher.far.ankle.x - 10, y: pusher.far.ankle.y + 10 }, random);
  paintSapper(ctx, pusher, SAPPER_INKS, sapperPrint(pusher, true));
  emblem(ctx, 122, 128, 100);
  const under = headline(ctx, copy, random, 252, w - 64);
  ribbon(ctx, copy.kicker, random, 330, 1090, under + 20);
  foot(ctx, copy, random);
  sheets(canvas, ctx, random);
  weather(ctx, random);
  grain(ctx, w, h, random, 20);
  tear(ctx, random);
  return canvas;
}
