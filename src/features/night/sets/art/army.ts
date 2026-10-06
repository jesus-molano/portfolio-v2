import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";

/**
 * The army poster, as the approved concept: a 1940s propaganda poster on
 * yellowed paper, pasted as 4 x 2 sheets a hair off register, in a bold
 * limited palette (vermilion sky, olive, khaki, violet as the black). Two
 * combat engineers, heroic silhouettes leaning into it, push a bridge
 * girder up a hard diagonal toward the top-right corner, which is torn
 * open: the girder comes out of it in 3D (ArmySet). No insignia, badge,
 * crest, flag or weapon: helmets, a shovel and the girder, the unit's name
 * in our type.
 */
export const ARMY_POSTER = { w: 2048, h: 896 } as const;

/** Where the torn hole is, in poster pixels (the 3D nose comes out here). */
export const ARMY_HOLE = { x: 1888, y: 128, r: 118 } as const;

const INK = {
  olive: "#5d6a33",
  oliveDark: "#3f4a22",
  khaki: "#b39b5e",
  violet: "#2a1745",
  paper: "#e9dbb4",
  paperDark: "#cdb98b",
  vermilion: "#d4472a",
  ember: "#e8833a",
} as const;

type Copy = { kicker: string; headline: readonly string[]; foot: readonly string[] };

function paper(ctx: CanvasRenderingContext2D, random: () => number) {
  const { w, h } = ARMY_POSTER;
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, 0, w, h);
  // Fibres and dirt.
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillStyle = random() < 0.5 ? "rgba(120, 96, 50, 0.08)" : "rgba(255, 250, 230, 0.1)";
    ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
  }
  // Foxing.
  for (let i = 0; i < 40; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const r = 6 + random() * 28;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(150, 105, 50, 0.18)");
    g.addColorStop(1, "rgba(150, 105, 50, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Rain runs from the top edge.
  for (let i = 0; i < 26; i += 1) {
    const x = random() * w;
    const len = 120 + random() * 520;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, "rgba(90, 70, 40, 0.16)");
    g.addColorStop(1, "rgba(90, 70, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + random() * 6, len);
  }
}

/** One ink pass, nudged off register. */
function ink(ctx: CanvasRenderingContext2D, dx: number, dy: number, draw: () => void) {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.globalAlpha = 0.94;
  draw();
  ctx.restore();
}

type P = { x: number; y: number };

/**
 * A sapper pushing, drawn once as an outline in a 230 x 300 box (facing
 * right, the ground at y = 300, the hands at HANDS): back leg driving
 * straight from the toe, front knee bent, the body leaning into the push,
 * arms locked out ahead, head down under a plain steel helmet, a pack on
 * the back. No badge, no weapon.
 */
const BODY: [number, number][] = [
  [0, 300], [44, 300], [46, 290], [70, 236], [94, 202],
  [108, 222], [112, 288], [110, 300], [162, 300], [160, 290], [142, 284],
  [146, 222], [138, 200], [132, 170], [146, 140], [160, 116],
  [188, 88], [210, 66], [222, 54], [226, 44], [218, 36], [206, 40],
  [184, 56], [166, 66], [158, 70],
  [150, 62], [136, 64], [120, 76], [100, 88], [88, 104], [80, 126],
  [76, 150], [66, 176], [58, 198], [30, 284], [8, 290],
];
const HEAD = { x: 160, y: 58, r: 15 } as const;
const HELMET = { x: 156, y: 50, r: 22, tilt: 0.55 } as const;
const HANDS = { x: 222, y: 46 } as const;

/** The two sappers: the lead at the girder's end, the second behind on the chord, smaller with the distance. */
const SOLDIERS = [
  { hands: { x: 900, y: 365 }, scale: 1.6 },
  { hands: { x: 570, y: 442 }, scale: 1.29 },
] as const;
const GROUND_Y = 772;

/** The girder runs from behind the second sapper's grip, through the lead's, to the torn corner. */
const BEAM = { from: { x: 500, y: 458 }, to: { x: 1900, y: 132 } } as const;



function along(t: number, offset = 0): P {
  const dx = BEAM.to.x - BEAM.from.x;
  const dy = BEAM.to.y - BEAM.from.y;
  const len = Math.hypot(dx, dy);
  const nx = dy / len;
  const ny = -dx / len;
  return { x: BEAM.from.x + dx * t + nx * offset, y: BEAM.from.y + dy * t + ny * offset };
}

/** The vermilion sky, falling into an ember horizon, with a halftone sun-less glow and grain. */
function sky(ctx: CanvasRenderingContext2D, random: () => number) {
  const { w } = ARMY_POSTER;
  const g = ctx.createLinearGradient(0, 0, 0, 700);
  g.addColorStop(0, INK.vermilion);
  g.addColorStop(0.75, INK.ember);
  g.addColorStop(1, "#efb35a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, 700);
  // Rays from the low left, like the posters' searchlight fans.
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = INK.paper;
  for (let i = 0; i < 9; i += 1) {
    const a0 = -0.95 + i * 0.12;
    ctx.beginPath();
    ctx.moveTo(380, 700);
    ctx.lineTo(380 + Math.cos(a0) * 2400, 700 + Math.sin(a0) * 2400);
    ctx.lineTo(380 + Math.cos(a0 + 0.05) * 2400, 700 + Math.sin(a0 + 0.05) * 2400);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Ink speckle, so the red reads as printed, not as a gradient.
  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = random() < 0.5 ? "rgba(120, 30, 20, 0.12)" : "rgba(255, 210, 150, 0.08)";
    ctx.fillRect(random() * w, random() * 700, 2, 2);
  }
}

/** The ground: an olive bank with tufts, under the soldiers' boots. */
function ground(ctx: CanvasRenderingContext2D) {
  const { w } = ARMY_POSTER;
  ctx.fillStyle = INK.oliveDark;
  ctx.beginPath();
  ctx.moveTo(0, 700);
  ctx.quadraticCurveTo(420, 676, 820, 712);
  ctx.quadraticCurveTo(1300, 748, w, 704);
  ctx.lineTo(w, 790);
  ctx.lineTo(0, 790);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK.olive;
  ctx.lineWidth = 4;
  for (let x = 20; x < w; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 716);
    ctx.lineTo(x + 8, 694);
    ctx.moveTo(x + 10, 716);
    ctx.lineTo(x + 22, 700);
    ctx.stroke();
  }
}

/** A Bailey-type panel girder along the diagonal, olive with violet shadow, panel by panel. */
function girder(ctx: CanvasRenderingContext2D) {
  const depth = 96;
  const bays = 10;
  // The shadow side first, offset, then the lit face.
  for (const [colour, dx, dy] of [
    [INK.violet, 10, 12],
    [INK.olive, 0, 0],
  ] as const) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.strokeStyle = colour;
    ctx.lineCap = "square";
    ctx.lineWidth = 20;
    for (const off of [0, depth]) {
      const a = along(0, off);
      const b = along(1, off);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.lineWidth = 11;
    for (let i = 0; i <= bays; i += 1) {
      const t0 = i / bays;
      const a = along(t0, 0);
      const b = along(t0, depth);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (i < bays) {
        const c = along((i + 1) / bays, i % 2 ? 0 : depth);
        const d = along(t0, i % 2 ? depth : 0);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // Rivets of light along the top chord.
  ctx.fillStyle = "#c9c27a";
  for (let i = 0; i <= 26; i += 1) {
    const p = along(i / 26, depth);
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
}

/** One sapper as a filled silhouette, its hands at `hands`, its feet on the ground line. */
function sapper(ctx: CanvasRenderingContext2D, hands: P, scale: number, colour: string, dx = 0, dy = 0) {
  ctx.save();
  // Placed by the hands; the feet land on (or near) the ground line.
  ctx.translate(hands.x - HANDS.x * scale + dx, hands.y - HANDS.y * scale + dy);
  ctx.scale(scale, scale);
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  BODY.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(HEAD.x, HEAD.y, HEAD.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(HELMET.x, HELMET.y);
  ctx.rotate(HELMET.tilt);
  ctx.beginPath();
  ctx.arc(0, 0, HELMET.r, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-HELMET.r - 5, -2, HELMET.r * 2 + 10, 5);
  ctx.restore();
  ctx.restore();
}

function soldiers(ctx: CanvasRenderingContext2D) {
  // A rim of the sky on their backs, printed as a second, offset ink; then the figures.
  for (const { hands, scale } of SOLDIERS) sapper(ctx, hands, scale, INK.ember, -6, -5);
  for (const { hands, scale } of SOLDIERS) sapper(ctx, hands, scale, INK.violet);
  // Their shadows on the bank.
  ctx.fillStyle = "rgba(42, 23, 69, 0.45)";
  for (const { hands, scale } of SOLDIERS) {
    const x = hands.x - HANDS.x * scale;
    ctx.beginPath();
    ctx.ellipse(x + 90 * scale, GROUND_Y - 300 * scale + 300 * scale + 4, 110 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function headline(ctx: CanvasRenderingContext2D, copy: Copy) {
  const { w } = ARMY_POSTER;
  const condensed = 0.8;
  const [first, ...rest] = copy.headline;
  // The first word over the red sky, in paper outlined in the violet ink (a sign painter's
  // keyline, so it reads against the sky at any distance); the rest bottom right, in the ink.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let size = 190;
  ctx.font = `800 ${size}px ${fonts.display()}`;
  size = Math.min(size, (size * 880) / (ctx.measureText(first).width * condensed));
  ctx.font = `800 ${size}px ${fonts.display()}`;
  ctx.save();
  ctx.translate(76, 196 + size * 0.86);
  ctx.scale(condensed, 1);
  ctx.fillStyle = INK.violet;
  ctx.fillText(first, 10, 10);
  ctx.lineJoin = "round";
  ctx.lineWidth = 16;
  ctx.strokeStyle = INK.violet;
  ctx.strokeText(first, 0, 0);
  ctx.fillStyle = INK.paper;
  ctx.fillText(first, 0, 0);
  ctx.restore();
  let big = 200;
  ctx.font = `800 ${big}px ${fonts.display()}`;
  const widest = Math.max(...rest.map((line) => ctx.measureText(line).width * condensed));
  big = Math.min(big, (big * 1060) / widest, 600 / Math.max(1, rest.length) / 0.92);
  ctx.font = `800 ${big}px ${fonts.display()}`;
  ctx.textAlign = "right";
  const bottom = 742;
  rest.forEach((line, i) => {
    const y = bottom - (rest.length - 1 - i) * big * 0.92;
    ctx.save();
    ctx.translate(w - 70, y);
    ctx.scale(condensed, 1);
    ctx.fillStyle = INK.paper;
    ctx.fillText(line, 7, 7);
    ctx.fillStyle = INK.violet;
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });
}

export function paintArmyPoster(copy: Copy): HTMLCanvasElement {
  const { w, h } = ARMY_POSTER;
  const [canvas, ctx] = makeCanvas(w, h);
  const random = createRandom(1821);
  paper(ctx, random);
  // The red, a hair off register.
  ink(ctx, 3, -2, () => sky(ctx, random));
  ink(ctx, -2, 2, () => {
    ground(ctx);
    girder(ctx);
  });
  ink(ctx, 0, 0, () => {
    soldiers(ctx);
    // Kicker: the unit's name knocked out of a violet band.
    ctx.fillStyle = INK.violet;
    ctx.fillRect(70, 56, 980, 92);
    ctx.fillStyle = INK.paper;
    ctx.font = `700 50px ${fonts.mono()}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const kickerWidth = ctx.measureText(copy.kicker).width;
    ctx.save();
    ctx.translate(100, 104);
    ctx.scale(Math.min(1, 920 / kickerWidth), 1);
    ctx.fillText(copy.kicker, 0, 0);
    ctx.restore();
    headline(ctx, copy);
    // Foot band: rank and trade, place and years.
    ctx.fillStyle = INK.violet;
    ctx.fillRect(0, 790, w, h - 790);
    ctx.fillStyle = INK.paper;
    ctx.font = `700 40px ${fonts.mono()}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(copy.foot[0], 70, 843);
    ctx.textAlign = "right";
    ctx.fillText(copy.foot[1], w - 70, 843);
  });
  seams(ctx, random);
  tear(ctx, random);
  return canvas;
}

function seams(ctx: CanvasRenderingContext2D, random: () => number) {
  const { w, h } = ARMY_POSTER;
  ctx.strokeStyle = "rgba(90, 70, 40, 0.35)";
  ctx.lineWidth = 2;
  for (const x of [512, 1024, 1536]) {
    const j = (random() - 0.5) * 4;
    ctx.beginPath();
    ctx.moveTo(x + j, 0);
    ctx.lineTo(x - j, h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 448);
  ctx.lineTo(w, 450);
  ctx.stroke();
}

function tear(ctx: CanvasRenderingContext2D, random: () => number) {
  const { x, y, r } = ARMY_HOLE;
  const points: [number, number][] = [];
  for (let i = 0; i < 22; i += 1) {
    const a = (i / 22) * Math.PI * 2;
    const rr = r * (0.75 + random() * 0.45);
    points.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9]);
  }
  // Curled flaps round the hole: the plain back of the paper.
  ctx.fillStyle = "#d8c79c";
  ctx.strokeStyle = "rgba(60, 40, 20, 0.45)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    const [px, py] = points[(i * 4 + 1) % points.length];
    const a = Math.atan2(py - y, px - x);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a + 0.5) * 70, py + Math.sin(a + 0.5) * 70);
    ctx.lineTo(px + Math.cos(a - 0.3) * 54, py + Math.sin(a - 0.3) * 54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The crate by the posts: olive slats, XVI stencilled. */
export function paintCrate(label: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = INK.olive;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(20, 20, 10, 0.35)";
  ctx.lineWidth = 4;
  for (let y = 0; y < 256; y += 52) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  ctx.fillStyle = INK.paper;
  ctx.font = `800 96px ${fonts.display()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 128, 132);
  return canvas;
}
