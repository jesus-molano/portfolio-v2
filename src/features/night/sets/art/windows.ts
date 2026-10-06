import { createRandom } from "@/features/hero/scene/world";
import { makeCanvas } from "../../artCanvas";

/**
 * The window atlas: one row of interiors, painted once and shared by every
 * set. Cafés with pendant lamps and people at the tables, hotel rooms
 * behind half-drawn curtains, office ribbons behind blinds, dark panes
 * holding a streak of the street. Warm inside, never pure white.
 */
export const WINDOW = { w: 160, h: 200 } as const;

export const PANE = {
  cafeTable: 0,
  cafeCounter: 1,
  roomLeft: 2,
  roomRight: 3,
  roomPink: 4,
  dark: 5,
  blinds: 6,
  blindsDark: 7,
} as const;

export const PANE_COUNT = 8;

type Ctx = CanvasRenderingContext2D;

function interior(ctx: Ctx, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, WINDOW.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WINDOW.w, WINDOW.h);
}

function lamp(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255, 200, 140, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.fillStyle = "#fff1d6";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A seated or standing figure, head and shoulders, in shadow. */
function person(ctx: Ctx, x: number, y: number, scale: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 11 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 22 * scale, y + 60 * scale);
  ctx.quadraticCurveTo(x - 22 * scale, y + 14 * scale, x, y + 13 * scale);
  ctx.quadraticCurveTo(x + 22 * scale, y + 14 * scale, x + 22 * scale, y + 60 * scale);
  ctx.closePath();
  ctx.fill();
}

function frame(ctx: Ctx, bars: number) {
  // The frame and its mullions.
  ctx.strokeStyle = "#1a1030";
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, WINDOW.w, WINDOW.h);
  ctx.lineWidth = 4;
  for (let i = 1; i < bars; i += 1) {
    ctx.beginPath();
    ctx.moveTo((WINDOW.w * i) / bars, 0);
    ctx.lineTo((WINDOW.w * i) / bars, WINDOW.h);
    ctx.stroke();
  }
}

function reflection(ctx: Ctx, alpha: number) {
  ctx.fillStyle = `rgba(255, 190, 230, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(WINDOW.w * 0.55, 0);
  ctx.lineTo(WINDOW.w * 0.75, 0);
  ctx.lineTo(WINDOW.w * 0.3, WINDOW.h);
  ctx.lineTo(WINDOW.w * 0.1, WINDOW.h);
  ctx.closePath();
  ctx.fill();
}

function curtain(ctx: Ctx, x0: number, x1: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, 0, x1 - x0, WINDOW.h);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 3;
  for (let x = x0 + 6; x < x1; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WINDOW.h);
    ctx.stroke();
  }
}

function blinds(ctx: Ctx, lit: boolean, random: () => number) {
  for (let y = 4; y < WINDOW.h; y += 9) {
    ctx.fillStyle = lit ? `rgba(120, 60, 40, ${0.35 + random() * 0.1})` : "rgba(10, 6, 24, 0.5)";
    ctx.fillRect(0, y, WINDOW.w, 4);
  }
}

const PAINT: ((ctx: Ctx, random: () => number) => void)[] = [
  // A café table: two people under the pendants.
  (ctx) => {
    interior(ctx, "#6a3424", "#e09a5c");
    ctx.fillStyle = "#4a2418";
    ctx.fillRect(0, 70, WINDOW.w, 10);
    lamp(ctx, 50, 40, 6, "rgba(255, 210, 150, 0.9)");
    lamp(ctx, 115, 40, 6, "rgba(255, 210, 150, 0.9)");
    person(ctx, 45, 115, 1, "#3a1a2a");
    person(ctx, 118, 120, 0.9, "#2a1426");
    ctx.fillStyle = "#24121e";
    ctx.fillRect(60, 160, 44, 6);
    ctx.fillRect(80, 166, 4, 34);
    frame(ctx, 2);
    reflection(ctx, 0.08);
  },
  // The counter: the barista, the machine's chrome, the menu board.
  (ctx) => {
    interior(ctx, "#5a2c26", "#d88a56");
    ctx.fillStyle = "#2a1626";
    ctx.fillRect(14, 30, 70, 40);
    ctx.fillStyle = "rgba(255, 236, 200, 0.6)";
    for (let i = 0; i < 4; i += 1) ctx.fillRect(22, 38 + i * 8, 40 + (i % 2) * 12, 3);
    lamp(ctx, 120, 34, 6, "rgba(255, 210, 150, 0.9)");
    person(ctx, 100, 100, 1.05, "#331626");
    ctx.fillStyle = "#3a1e2a";
    ctx.fillRect(0, 150, WINDOW.w, 50);
    ctx.fillStyle = "#c9b8c8";
    ctx.fillRect(28, 128, 36, 22);
    frame(ctx, 2);
    reflection(ctx, 0.07);
  },
  // A hotel room, the curtain drawn on the left.
  (ctx) => {
    interior(ctx, "#8a4a30", "#e8a060");
    lamp(ctx, 110, 120, 7, "rgba(255, 220, 160, 0.9)");
    curtain(ctx, 0, 62, "#6a2a4a");
    frame(ctx, 1);
    reflection(ctx, 0.06);
  },
  // Curtain on the right, a guest at the window.
  (ctx) => {
    interior(ctx, "#7a3e2c", "#dc9458");
    lamp(ctx, 40, 70, 6, "rgba(255, 220, 160, 0.8)");
    person(ctx, 60, 110, 1.1, "#3a1a30");
    curtain(ctx, 104, WINDOW.w, "#5a2440");
    frame(ctx, 1);
    reflection(ctx, 0.06);
  },
  // A pink room, both curtains half drawn.
  (ctx) => {
    interior(ctx, "#8a3a6a", "#e88ab0");
    lamp(ctx, 80, 60, 6, "rgba(255, 210, 220, 0.8)");
    curtain(ctx, 0, 40, "#5a2244");
    curtain(ctx, 120, WINDOW.w, "#5a2244");
    frame(ctx, 1);
  },
  // A dark pane holding a streak of the street.
  (ctx) => {
    interior(ctx, "#1e1636", "#2a1e46");
    reflection(ctx, 0.12);
    frame(ctx, 1);
  },
  // An office ribbon behind blinds, lit.
  (ctx, random) => {
    interior(ctx, "#a86a44", "#e0a46a");
    blinds(ctx, true, random);
    frame(ctx, 2);
  },
  // An office ribbon behind blinds, dark.
  (ctx, random) => {
    interior(ctx, "#1e1636", "#281c42");
    blinds(ctx, false, random);
    frame(ctx, 2);
    reflection(ctx, 0.08);
  },
];

export function paintWindows(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(WINDOW.w * PANE_COUNT, WINDOW.h);
  const random = createRandom(1990);
  PAINT.forEach((paint, i) => {
    ctx.save();
    ctx.translate(i * WINDOW.w, 0);
    ctx.beginPath();
    ctx.rect(0, 0, WINDOW.w, WINDOW.h);
    ctx.clip();
    paint(ctx, random);
    ctx.restore();
  });
  return canvas;
}
