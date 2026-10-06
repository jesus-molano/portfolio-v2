import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";
import type { Random } from "./print";

/**
 * Cloud District Coffee, the café on the ground floor of the corner block:
 * its neon sign and the room behind its windows, painted once. The room is
 * one long interior behind the whole run of glass (never a tile repeated
 * per pane): the bar with its espresso machine and the barista at it,
 * shelves of cups, pendant lamps, a chalkboard with the island's coffees,
 * and the tables, where two people sit over a laptop and a cup. People are
 * drawn as people (posture, a chair under them, something in their hands),
 * backlit by the lamps.
 */

/** The room, in metres: as wide as the café's run of glass and as tall as its panes. */
export const ROOM = { w: 24.1, h: 2.3 } as const;
const PX = 170;
export const ROOM_CANVAS = { w: Math.round(ROOM.w * PX), h: Math.round(ROOM.h * PX) } as const;

/** The sign, in metres, and its canvas. */
export const SIGN = { w: 12, h: 2.4 } as const;
export const SIGN_CANVAS = { w: 2048, h: Math.round((2048 * SIGN.h) / SIGN.w) } as const;

type Ctx = CanvasRenderingContext2D;

const SHADOW = "#2b1219";
const RIM = "#ffcf94";

/** Draws `shape` lit from the lamps: a warm rim offset up and toward the light, then the silhouette. */
function lit(ctx: Ctx, shape: () => void, toward = -1): void {
  ctx.save();
  ctx.translate(toward * 2.5, -2.5);
  ctx.fillStyle = RIM;
  ctx.strokeStyle = RIM;
  shape();
  ctx.restore();
  ctx.fillStyle = SHADOW;
  ctx.strokeStyle = SHADOW;
  shape();
}

function limb(ctx: Ctx, points: [number, number][], width: number): void {
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

/**
 * Someone seated, side on, facing `dir` (-1 left, 1 right): hip on the seat
 * at (x, seat), leaning in over the table; `hands` is where the forearms rest.
 */
function seated(ctx: Ctx, x: number, seat: number, dir: number, hands: [number, number], hair: "short" | "long"): void {
  const m = PX;
  const hipX = x;
  const hipY = seat - 0.06 * m;
  const lean = 0.2;
  const shoulderX = hipX + dir * Math.sin(lean) * 0.5 * m;
  const shoulderY = hipY - Math.cos(lean) * 0.5 * m;
  const headX = shoulderX + dir * 0.06 * m;
  const headY = shoulderY - 0.19 * m;
  lit(ctx, () => {
    // Legs: thigh along the seat, shin down to the floor, the foot.
    const knee: [number, number] = [hipX + dir * 0.44 * m, hipY + 0.02 * m];
    const ankle: [number, number] = [knee[0] - dir * 0.04 * m, knee[1] + 0.44 * m];
    limb(ctx, [[hipX, hipY], knee, ankle], 0.14 * m);
    limb(ctx, [ankle, [ankle[0] + dir * 0.17 * m, ankle[1] + 0.02 * m]], 0.07 * m);
    // Torso: a rounded wedge from the hips to the shoulders, a little back to it.
    ctx.beginPath();
    ctx.moveTo(hipX - dir * 0.12 * m, hipY + 0.04 * m);
    ctx.quadraticCurveTo(hipX - dir * 0.2 * m, (hipY + shoulderY) / 2, shoulderX - dir * 0.13 * m, shoulderY + 0.02 * m);
    ctx.quadraticCurveTo(shoulderX, shoulderY - 0.06 * m, shoulderX + dir * 0.1 * m, shoulderY + 0.04 * m);
    ctx.quadraticCurveTo(hipX + dir * 0.16 * m, (hipY + shoulderY) / 2 + 0.05 * m, hipX + dir * 0.12 * m, hipY + 0.05 * m);
    ctx.closePath();
    ctx.fill();
    // Neck and head, a slight chin, and the hair.
    limb(ctx, [[shoulderX + dir * 0.02 * m, shoulderY], [headX, headY + 0.08 * m]], 0.08 * m);
    ctx.beginPath();
    ctx.ellipse(headX, headY, 0.095 * m, 0.115 * m, dir * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX + dir * 0.07 * m, headY + 0.05 * m, 0.04 * m, 0.03 * m, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hair === "long") {
      ctx.beginPath();
      ctx.moveTo(headX + dir * 0.06 * m, headY - 0.11 * m);
      ctx.quadraticCurveTo(headX - dir * 0.2 * m, headY - 0.1 * m, headX - dir * 0.14 * m, headY + 0.2 * m);
      ctx.lineTo(headX - dir * 0.04 * m, headY + 0.16 * m);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(headX - dir * 0.02 * m, headY - 0.05 * m, 0.1 * m, 0.08 * m, 0, Math.PI, 0);
      ctx.fill();
    }
    // The arm: upper arm down from the shoulder, forearm out to the table.
    const elbow: [number, number] = [shoulderX + dir * 0.06 * m, shoulderY + 0.27 * m];
    limb(ctx, [[shoulderX, shoulderY + 0.04 * m], elbow, hands], 0.08 * m);
  }, -dir);
}

/** A bentwood chair, side on, its back on the side away from `dir`. */
function chair(ctx: Ctx, x: number, floor: number, dir: number): void {
  const m = PX;
  ctx.strokeStyle = "#3a1c1c";
  limb(ctx, [[x - dir * 0.2 * m, floor], [x - dir * 0.18 * m, floor - 0.45 * m], [x + dir * 0.2 * m, floor - 0.45 * m], [x + dir * 0.22 * m, floor]], 0.035 * m);
  limb(ctx, [[x - dir * 0.18 * m, floor - 0.45 * m], [x - dir * 0.24 * m, floor - 0.9 * m]], 0.035 * m);
  ctx.lineWidth = 0.03 * m;
  ctx.beginPath();
  ctx.ellipse(x - dir * 0.22 * m, floor - 0.72 * m, 0.06 * m, 0.16 * m, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** A café table on its pedestal, and what is on it. */
function table(ctx: Ctx, x: number, floor: number, top: "laptop" | "cups"): number {
  const m = PX;
  const y = floor - 0.74 * m;
  ctx.fillStyle = "#3a1c1c";
  ctx.fillRect(x - 0.36 * m, y, 0.72 * m, 0.04 * m);
  ctx.fillRect(x - 0.025 * m, y, 0.05 * m, 0.74 * m);
  ctx.fillRect(x - 0.22 * m, floor - 0.03 * m, 0.44 * m, 0.03 * m);
  if (top === "laptop") {
    // The open lid, its screen lighting the table.
    const g = ctx.createRadialGradient(x + 0.05 * m, y, 2, x + 0.05 * m, y, 0.5 * m);
    g.addColorStop(0, "rgba(200, 220, 255, 0.35)");
    g.addColorStop(1, "rgba(200, 220, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 0.5 * m, y - 0.5 * m, m, 0.6 * m);
    ctx.fillStyle = "#1a1220";
    ctx.save();
    ctx.translate(x + 0.12 * m, y);
    ctx.rotate(-0.25);
    ctx.fillRect(-0.015 * m, -0.24 * m, 0.03 * m, 0.24 * m);
    ctx.restore();
    ctx.fillRect(x - 0.12 * m, y - 0.015 * m, 0.25 * m, 0.015 * m);
  } else {
    for (const dx of [-0.15, 0.14]) {
      ctx.fillStyle = "#f4e6d0";
      ctx.fillRect(x + dx * m - 0.04 * m, y - 0.08 * m, 0.08 * m, 0.08 * m);
      ctx.fillRect(x + dx * m - 0.07 * m, y - 0.012 * m, 0.14 * m, 0.012 * m);
    }
  }
  return y;
}

function pendant(ctx: Ctx, x: number, drop: number): void {
  const m = PX;
  ctx.strokeStyle = "#2a1418";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, drop);
  ctx.stroke();
  // The pool of light under it.
  const cone = ctx.createRadialGradient(x, drop + 0.05 * m, 4, x, drop + 0.6 * m, 1.1 * m);
  cone.addColorStop(0, "rgba(255, 214, 150, 0.4)");
  cone.addColorStop(1, "rgba(255, 214, 150, 0)");
  ctx.fillStyle = cone;
  ctx.fillRect(x - 1.1 * m, drop, 2.2 * m, 1.8 * m);
  ctx.fillStyle = "#6a4a2a";
  ctx.beginPath();
  ctx.moveTo(x - 0.16 * m, drop + 0.13 * m);
  ctx.quadraticCurveTo(x - 0.15 * m, drop, x, drop);
  ctx.quadraticCurveTo(x + 0.15 * m, drop, x + 0.16 * m, drop + 0.13 * m);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c8a060";
  ctx.fillRect(x - 0.16 * m, drop + 0.12 * m, 0.32 * m, 0.012 * m);
  ctx.fillStyle = "#fff4dc";
  ctx.beginPath();
  ctx.ellipse(x, drop + 0.14 * m, 0.07 * m, 0.035 * m, 0, 0, Math.PI);
  ctx.fill();
}

function espressoMachine(ctx: Ctx, x: number, top: number): void {
  const m = PX;
  const w = 0.8 * m;
  const h = 0.48 * m;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "#5a4a52");
  g.addColorStop(0.3, "#e8dccc");
  g.addColorStop(0.5, "#9a8a8a");
  g.addColorStop(1, "#4a3a42");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top - h, w, h, 10);
  ctx.fill();
  ctx.fillStyle = "#2a1418";
  ctx.fillRect(x - w / 2 + 8, top - h * 0.45, w - 16, 5);
  for (const k of [-1, 0, 1]) {
    ctx.fillStyle = "#2a1418";
    ctx.fillRect(x + k * 0.24 * m - 8, top - h * 0.42, 16, 14);
    ctx.fillRect(x + k * 0.24 * m - 3, top - h * 0.42 + 14, 6, 10);
  }
  // Cups warming on top.
  for (let k = 0; k < 6; k += 1) {
    ctx.fillStyle = "#f4e6d0";
    ctx.fillRect(x - w / 2 + 10 + k * 0.12 * m, top - h - 0.07 * m, 0.08 * m, 0.07 * m);
  }
  ctx.fillStyle = "#ff8a5a";
  ctx.beginPath();
  ctx.arc(x + w / 2 - 14, top - h + 16, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** The barista at the machine, from the counter up, side on, facing it. */
function barista(ctx: Ctx, x: number, counter: number, dir: number): void {
  const m = PX;
  const waist = counter + 0.05 * m;
  const shoulderY = waist - 0.5 * m;
  lit(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x - dir * 0.13 * m, waist);
    ctx.quadraticCurveTo(x - dir * 0.16 * m, shoulderY + 0.2 * m, x - dir * 0.11 * m, shoulderY);
    ctx.quadraticCurveTo(x, shoulderY - 0.05 * m, x + dir * 0.1 * m, shoulderY + 0.03 * m);
    ctx.quadraticCurveTo(x + dir * 0.16 * m, shoulderY + 0.25 * m, x + dir * 0.13 * m, waist);
    ctx.closePath();
    ctx.fill();
    limb(ctx, [[x + dir * 0.02 * m, shoulderY], [x + dir * 0.05 * m, shoulderY - 0.1 * m]], 0.08 * m);
    ctx.beginPath();
    ctx.ellipse(x + dir * 0.05 * m, shoulderY - 0.2 * m, 0.095 * m, 0.115 * m, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hair up in a bun.
    ctx.beginPath();
    ctx.arc(x - dir * 0.05 * m, shoulderY - 0.29 * m, 0.06 * m, 0, Math.PI * 2);
    ctx.fill();
    // Arms bent forward to the machine.
    limb(ctx, [[x + dir * 0.03 * m, shoulderY + 0.05 * m], [x + dir * 0.1 * m, shoulderY + 0.3 * m], [x + dir * 0.36 * m, shoulderY + 0.26 * m]], 0.075 * m);
  }, -dir);
  // The apron's strap and its tie, catching the light.
  ctx.strokeStyle = "rgba(255, 207, 148, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + dir * 0.06 * m, shoulderY + 0.03 * m);
  ctx.lineTo(x + dir * 0.12 * m, waist - 0.12 * m);
  ctx.stroke();
}

function plant(ctx: Ctx, x: number, floor: number, random: Random): void {
  const m = PX;
  ctx.fillStyle = "#c86a4a";
  ctx.beginPath();
  ctx.moveTo(x - 0.16 * m, floor - 0.36 * m);
  ctx.lineTo(x + 0.16 * m, floor - 0.36 * m);
  ctx.lineTo(x + 0.12 * m, floor);
  ctx.lineTo(x - 0.12 * m, floor);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI / 2 + (random() - 0.5) * 2.2;
    const l = (0.35 + random() * 0.45) * m;
    const tx = x + Math.cos(a) * l;
    const ty = floor - 0.36 * m + Math.sin(a) * l;
    ctx.strokeStyle = "#1f3a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, floor - 0.36 * m);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.3, floor - 0.36 * m + Math.sin(a) * l * 0.7, tx, ty);
    ctx.stroke();
    ctx.fillStyle = i % 2 ? "#2d5a3a" : "#24482f";
    ctx.beginPath();
    ctx.ellipse(tx, ty, 0.12 * m, 0.07 * m, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The room behind the café's glass, as one canvas across the whole run. */
export function paintCafeRoom(): HTMLCanvasElement {
  const { w, h } = ROOM_CANVAS;
  const [canvas, ctx] = makeCanvas(w, h);
  const random = createRandom(1994);
  const m = PX;
  const floor = h - 0.12 * m;
  // The back wall, warm under the lamps; a band of tiles behind the bar.
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, "#4a1d24");
  wall.addColorStop(0.45, "#a2553a");
  wall.addColorStop(1, "#6a3026");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 220, 190, 0.12)";
  ctx.lineWidth = 1;
  for (let y = 0.95 * m; y < 1.45 * m; y += 0.075 * m) {
    ctx.beginPath();
    ctx.moveTo(0.8 * m, y);
    ctx.lineTo(12.2 * m, y);
    ctx.stroke();
  }
  for (let x = 0.8 * m; x < 12.2 * m; x += 0.15 * m) {
    ctx.beginPath();
    ctx.moveTo(x, 0.95 * m);
    ctx.lineTo(x, 1.45 * m);
    ctx.stroke();
  }
  // Shelves of cups and jars over the bar.
  for (const sy of [0.5, 0.8]) {
    ctx.fillStyle = "#3a1a16";
    ctx.fillRect(1.2 * m, sy * m, 4.2 * m, 0.035 * m);
    ctx.fillRect(8.6 * m, sy * m, 3.2 * m, 0.035 * m);
    for (let x = 1.3; x < 11.7; x += 0.17 + random() * 0.08) {
      if (x > 5.3 && x < 8.7) continue;
      const jar = random() < 0.3;
      ctx.fillStyle = jar ? "rgba(255, 200, 140, 0.55)" : random() < 0.5 ? "#f2e2c8" : "#d9805a";
      const ih = jar ? 0.16 : 0.08;
      ctx.fillRect(x * m, (sy - ih) * m, (jar ? 0.1 : 0.09) * m, ih * m);
    }
  }
  // The chalkboard with the island's coffees.
  const bx = 5.5 * m;
  const by = 0.22 * m;
  ctx.fillStyle = "#4a2a1a";
  ctx.fillRect(bx - 6, by - 6, 3.0 * m + 12, 0.66 * m + 12);
  ctx.fillStyle = "#1e1a1c";
  ctx.fillRect(bx, by, 3.0 * m, 0.66 * m);
  ctx.fillStyle = "rgba(240, 232, 220, 0.85)";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `400 ${Math.round(0.13 * m)}px ${fonts.script()}`;
  ctx.fillText("Barraquito", bx + 0.14 * m, by + 0.2 * m);
  ctx.fillText("Leche y leche", bx + 0.14 * m, by + 0.38 * m);
  ctx.fillText("Cortado", bx + 0.14 * m, by + 0.56 * m);
  ctx.font = `700 ${Math.round(0.08 * m)}px ${fonts.mono()}`;
  ctx.textAlign = "right";
  ["1,80", "1,40", "1,30"].forEach((price, i) => ctx.fillText(price, bx + 2.86 * m, by + (0.2 + i * 0.18) * m));
  // Lamps along the whole room.
  for (let x = 0.9; x < ROOM.w; x += 1.75) pendant(ctx, x * m, (0.18 + (Math.round(x * 3) % 2) * 0.06) * m);
  // The bar: the barista behind it, at the machine; the machine, a grinder, the cake stand, the till.
  const counter = 1.45 * m;
  barista(ctx, 9.25 * m, counter, -1);
  ctx.fillStyle = "#3a1a16";
  ctx.fillRect(0.8 * m, counter - 0.03 * m, 11.6 * m, 0.05 * m);
  espressoMachine(ctx, 8.2 * m, counter - 0.03 * m);
  ctx.fillStyle = "#2a1418";
  ctx.fillRect(7.15 * m, counter - 0.42 * m, 0.16 * m, 0.39 * m);
  ctx.beginPath();
  ctx.moveTo(7.08 * m, counter - 0.42 * m);
  ctx.lineTo(7.38 * m, counter - 0.42 * m);
  ctx.lineTo(7.3 * m, counter - 0.58 * m);
  ctx.lineTo(7.16 * m, counter - 0.58 * m);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 236, 214, 0.35)";
  ctx.beginPath();
  ctx.arc(3.4 * m, counter - 0.06 * m, 0.24 * m, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#e9a0a8";
  ctx.fillRect(3.25 * m, counter - 0.16 * m, 0.3 * m, 0.1 * m);
  ctx.fillStyle = "#2a1418";
  ctx.fillRect(10.9 * m, counter - 0.22 * m, 0.34 * m, 0.19 * m);
  // The bar's front: fluted wood, a brass foot rail.
  ctx.fillStyle = "#5e2b1f";
  ctx.fillRect(0.8 * m, counter + 0.02 * m, 11.6 * m, floor - counter);
  for (let x = 0.85 * m; x < 12.4 * m; x += 0.09 * m) {
    ctx.fillStyle = "rgba(255, 200, 150, 0.08)";
    ctx.fillRect(x, counter + 0.05 * m, 0.03 * m, floor - counter - 0.05 * m);
  }
  ctx.fillStyle = "#c8a060";
  ctx.fillRect(0.8 * m, floor - 0.2 * m, 11.6 * m, 0.025 * m);
  // The tables: a plant at the end of the bar, then the guests.
  plant(ctx, 13.1 * m, floor, random);
  chair(ctx, 15.0 * m, floor, 1);
  table(ctx, 15.8 * m, floor, "cups");
  chair(ctx, 16.6 * m, floor, -1);
  chair(ctx, 18.2 * m, floor, 1);
  const laptop = table(ctx, 19.0 * m, floor, "laptop");
  seated(ctx, 18.25 * m, floor - 0.47 * m, 1, [18.86 * m, laptop - 0.02 * m], "short");
  chair(ctx, 22.3 * m, floor, -1);
  const cups = table(ctx, 21.5 * m, floor, "cups");
  seated(ctx, 22.25 * m, floor - 0.47 * m, -1, [21.68 * m, cups - 0.03 * m], "long");
  plant(ctx, 23.6 * m, floor, random);
  // The floor: terrazzo catching the lamps.
  ctx.fillStyle = "#3a1c1c";
  ctx.fillRect(0, floor, w, h - floor);
  for (let i = 0; i < 400; i += 1) {
    ctx.fillStyle = random() < 0.5 ? "rgba(255, 210, 170, 0.18)" : "rgba(20, 8, 10, 0.25)";
    ctx.fillRect(random() * w, floor + random() * (h - floor), 2, 2);
  }
  // The glass: the street's reflection in long slanted sheens.
  for (let i = 0; i < 9; i += 1) {
    const x = random() * w;
    const g = ctx.createLinearGradient(x, 0, x + 0.6 * m, 0);
    g.addColorStop(0, "rgba(255, 190, 230, 0)");
    g.addColorStop(0.5, "rgba(255, 190, 230, 0.09)");
    g.addColorStop(1, "rgba(255, 190, 230, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + 0.4 * m, 0);
    ctx.lineTo(x + 1.0 * m, 0);
    ctx.lineTo(x + 0.4 * m, h);
    ctx.lineTo(x - 0.2 * m, h);
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

/** Neon on a raceway: the halo on the plate, the coloured tube, its hot core. */
function tube(ctx: Ctx, draw: (mode: "fill" | "stroke") => void, color: string, core: string, width: number, mode: "fill" | "stroke"): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 5;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(mode);
  draw(mode);
  ctx.shadowBlur = 0;
  ctx.fillStyle = core;
  ctx.strokeStyle = core;
  ctx.lineWidth = width * 0.4;
  if (mode === "fill") {
    ctx.globalAlpha = 0.75;
    draw("fill");
  } else draw("stroke");
  ctx.restore();
}

/**
 * The café's sign: a plum enamel raceway, a cup in pink tube with its
 * steam, the house name in cream script and the last word in amber capitals.
 */
export function paintCafeSign(name: string): HTMLCanvasElement {
  const { w, h } = SIGN_CANVAS;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  const split = name.lastIndexOf(" ");
  const script = split > 0 ? name.slice(0, split) : name;
  const caps = split > 0 ? name.slice(split + 1).toUpperCase() : "";
  // The raceway: a rounded plate with a chrome lip and its four standoffs.
  ctx.fillStyle = "#1b1028";
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 60);
  ctx.fill();
  ctx.strokeStyle = "#6a5a80";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = "#2c1e3c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(28, 28, w - 56, h - 56, 44);
  ctx.stroke();
  ctx.fillStyle = "#8a7aa0";
  for (const [x, y] of [
    [60, 60],
    [w - 60, 60],
    [60, h - 60],
    [w - 60, h - 60],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // The cup, its saucer and three curls of steam.
  const cx = 230;
  const cy = h * 0.6;
  tube(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 95, cy - 70);
      ctx.lineTo(cx + 95, cy - 70);
      ctx.quadraticCurveTo(cx + 90, cy + 60, cx, cy + 62);
      ctx.quadraticCurveTo(cx - 90, cy + 60, cx - 95, cy - 70);
      ctx.moveTo(cx + 92, cy - 40);
      ctx.bezierCurveTo(cx + 160, cy - 46, cx + 150, cy + 20, cx + 80, cy + 18);
      ctx.moveTo(cx - 140, cy + 90);
      ctx.lineTo(cx + 140, cy + 90);
      ctx.stroke();
    },
    "#ff4fa8",
    "#ffe2f2",
    15,
    "stroke",
  );
  tube(
    ctx,
    () => {
      ctx.beginPath();
      for (const dx of [-45, 0, 45]) {
        ctx.moveTo(cx + dx, cy - 95);
        ctx.bezierCurveTo(cx + dx + 30, cy - 125, cx + dx - 30, cy - 155, cx + dx, cy - 190);
      }
      ctx.stroke();
    },
    "#ffcf94",
    "#fff6e6",
    10,
    "stroke",
  );
  // The name in script, as big as the plate allows, and the last word in tracked capitals under it.
  const left = 440;
  const room = w - left - 90;
  let size = 260;
  ctx.font = `400 ${size}px ${fonts.script()}`;
  const sw = ctx.measureText(script).width;
  if (sw > room) size = (size * room) / sw;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const tx = left + room / 2;
  tube(
    ctx,
    (mode) => {
      ctx.font = `400 ${size}px ${fonts.script()}`;
      if (mode === "fill") ctx.fillText(script, tx, h * 0.56);
      else ctx.strokeText(script, tx, h * 0.56);
    },
    "#ffd8ee",
    "#fffaf4",
    6,
    "fill",
  );
  if (caps) {
    const capSize = Math.min(96, h * 0.22);
    ctx.font = `600 ${capSize}px ${fonts.body()}`;
    const tracking = capSize * 0.5;
    const chars = [...caps];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    tube(
      ctx,
      () => {
        ctx.font = `600 ${capSize}px ${fonts.body()}`;
        ctx.textAlign = "left";
        let at = tx - total / 2;
        chars.forEach((c, i) => {
          ctx.strokeText(c, at, h * 0.86);
          at += widths[i] + tracking;
        });
      },
      "#ffb347",
      "#fff1d0",
      7,
      "stroke",
    );
    // The rules either side of the word.
    tube(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(tx - total / 2 - 200, h * 0.86 - capSize * 0.36);
        ctx.lineTo(tx - total / 2 - 50, h * 0.86 - capSize * 0.36);
        ctx.moveTo(tx + total / 2 + 50, h * 0.86 - capSize * 0.36);
        ctx.lineTo(tx + total / 2 + 200, h * 0.86 - capSize * 0.36);
        ctx.stroke();
      },
      "#ffb347",
      "#fff1d0",
      7,
      "stroke",
    );
  }
  return canvas;
}
