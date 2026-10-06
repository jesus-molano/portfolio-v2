import { createRandom } from "@/features/hero/scene/world";
import { makeCanvas } from "../../artCanvas";

/**
 * The window atlas: lit interiors painted once and shared by every set, so
 * a lit window is a room, never a flat block. Cafés with pendant lamps and
 * a shelf of cups, an espresso bar, hotel rooms behind pleated curtains, a
 * floor lamp over an armchair, a room lit only by its television, offices
 * behind venetian blinds, a lobby with a chandelier, a study of books, and
 * dark panes that hold the sky. One reader in an armchair is the only
 * person: the rooms are lived in, not posed. Warm inside, violet in the
 * shadows (never black), the cool of a screen where there is one.
 *
 * Cells are painted on a grid of `ATLAS.cols` x `ATLAS.rows`; a pane picks
 * one with `cell`, and may mirror it (`flip`), dim or brighten it (`gain`)
 * or flicker like a television (`flicker`), so no two buildings repeat.
 */
export const WINDOW = { w: 256, h: 320 } as const;
export const ATLAS = { cols: 8, rows: 4 } as const;

export const PANE = {
  cafeTable: 0,
  cafeCounter: 1,
  roomLeft: 2,
  roomRight: 3,
  roomPink: 4,
  dark: 5,
  blinds: 6,
  blindsDark: 7,
  office: 8,
  roomTv: 9,
  reader: 10,
  curtained: 11,
  lobby: 12,
  study: 13,
  rollerBlind: 14,
  officeLate: 15,
  officePair: 16,
  meeting: 17,
  officeHalf: 18,
  archive: 19,
  cornerOffice: 20,
  kitchen: 21,
  records: 22,
  headboard: 23,
  /** The hotel lobby, one room across four panes, left to right. */
  lobbyA: 24,
  lobbyB: 25,
  lobbyC: 26,
  lobbyD: 27,
  /** The landmark's atrium, one space across three panes, left to right. */
  atriumA: 28,
  atriumB: 29,
  atriumC: 30,
} as const;

/** A room painted across several panes, in order: give each pane its own cell, never mirrored. */
export const LOBBY = [PANE.lobbyA, PANE.lobbyB, PANE.lobbyC, PANE.lobbyD] as const;
export const ATRIUM = [PANE.atriumA, PANE.atriumB, PANE.atriumC] as const;

export const PANE_COUNT = ATLAS.cols * ATLAS.rows;

/** How a pane shows its cell: mirrored, its own brightness, a television's flicker (0..1). */
export type PaneLook = { cell: number; flip?: boolean; gain?: number; flicker?: number };

/** What kind of building a pane is in: each draws its rooms from its own mix. */
export type Occupancy = "hotel" | "home" | "office";

/** [cell, weight] per kind of building. */
const MIX: Record<Occupancy, [number, number][]> = {
  hotel: [
    [PANE.roomLeft, 4],
    [PANE.roomRight, 4],
    [PANE.roomPink, 2],
    [PANE.curtained, 4],
    [PANE.roomTv, 2],
    [PANE.reader, 1],
    [PANE.rollerBlind, 2],
    [PANE.headboard, 3],
  ],
  home: [
    [PANE.roomRight, 3],
    [PANE.curtained, 3],
    [PANE.roomTv, 3],
    [PANE.study, 2],
    [PANE.rollerBlind, 3],
    [PANE.reader, 1],
    [PANE.roomLeft, 2],
    [PANE.kitchen, 3],
    [PANE.records, 2],
  ],
  office: [
    [PANE.office, 3],
    [PANE.blinds, 3],
    [PANE.officeLate, 2],
    [PANE.study, 1],
    [PANE.officePair, 3],
    [PANE.meeting, 2],
    [PANE.officeHalf, 2],
    [PANE.archive, 2],
    [PANE.cornerOffice, 2],
  ],
};

/** Share of lit rooms left half lit: a lamp in a corner, the rest of the room gone dim. */
export const HALF_LIT = 0.18;
/** The brightness of a lit room (a half-lit one is dimmer). */
export const GAIN = { lit: [0.78, 1.18], half: [0.5, 0.66] } as const;

/**
 * A pane's look, from a seeded random: lit (a room from the building's mix),
 * or dark (glass, or blinds down on a dark office). Some lit rooms are
 * dimmer than others, some only half lit, and televisions flicker. `beside`
 * is the room in the pane next to it: a lit room is never its twin.
 */
export function pickPane(random: () => number, occupancy: Occupancy, litShare: number, beside = -1): PaneLook {
  const flip = random() < 0.5;
  if (random() >= litShare) {
    const cell = occupancy === "office" && random() < 0.6 ? PANE.blindsDark : PANE.dark;
    return { cell, flip, gain: 0.85 + random() * 0.3, flicker: 0 };
  }
  const mix = MIX[occupancy].filter(([c]) => c !== beside);
  const total = mix.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  let cell: number = mix[mix.length - 1][0];
  for (const [c, w] of mix) {
    roll -= w;
    if (roll < 0) {
      cell = c;
      break;
    }
  }
  const [lo, hi] = random() < HALF_LIT ? GAIN.half : GAIN.lit;
  return { cell, flip, gain: lo + random() * (hi - lo), flicker: cell === PANE.roomTv ? 0.6 + random() * 0.4 : 0 };
}

type Ctx = CanvasRenderingContext2D;
const W = WINDOW.w;
const H = WINDOW.h;

/** Shadows are violet, never black. */
const INK = "#2a1530";
const INK_SOFT = "#3b1f3c";

function vertical(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function wall(ctx: Ctx, top: string, bottom: string) {
  ctx.fillStyle = vertical(ctx, 0, H, [
    [0, top],
    [1, bottom],
  ]);
  ctx.fillRect(0, 0, W, H);
}

/** A floor from `y` down. */
function floor(ctx: Ctx, y: number, near: string, far: string) {
  ctx.fillStyle = vertical(ctx, y, H, [
    [0, far],
    [1, near],
  ]);
  ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = "rgba(20, 8, 30, 0.25)";
  ctx.fillRect(0, y, W, 3);
}

/** A soft pool of light, added. */
function pool(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Darkens toward the corners: a room is lit from inside, never evenly. */
function falloff(ctx: Ctx, x: number, y: number, strength: number) {
  const g = ctx.createRadialGradient(x, y, 20, x, y, Math.max(W, H) * 0.95);
  g.addColorStop(0, "rgba(30, 10, 40, 0)");
  g.addColorStop(1, `rgba(30, 10, 40, ${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function shape(ctx: Ctx, points: [number, number][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** A pendant: its cord, a dome shade lit underneath, and the cone it throws. */
function pendant(ctx: Ctx, x: number, y: number, r: number, light: string) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, y - r * 0.6);
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = vertical(ctx, y, y + r * 9, [
    [0, light],
    [1, "rgba(0,0,0,0)"],
  ]);
  shape(ctx, [
    [x - r * 0.9, y],
    [x + r * 0.9, y],
    [x + r * 3.2, y + r * 9],
    [x - r * 3.2, y + r * 9],
  ]);
  ctx.fill();
  ctx.restore();
  pool(ctx, x, y + 2, r * 3.2, r * 2.4, light, 0.75);
  ctx.fillStyle = INK_SOFT;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff0d0";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A table lamp: a shade glowing through, its pool on the wall. */
function tableLamp(ctx: Ctx, x: number, base: number, size: number, shade: string) {
  const top = base - size * 2.1;
  pool(ctx, x, top + size * 0.4, size * 3.4, size * 3.0, "#ffcf8f", 0.85);
  ctx.fillStyle = INK;
  ctx.fillRect(x - size * 0.08, base - size * 1.1, size * 0.16, size * 1.1);
  ctx.beginPath();
  ctx.ellipse(x, base - size * 0.6, size * 0.32, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = vertical(ctx, top, top + size, [
    [0, "#fff3d8"],
    [1, shade],
  ]);
  shape(ctx, [
    [x - size * 0.45, top],
    [x + size * 0.45, top],
    [x + size * 0.75, top + size],
    [x - size * 0.75, top + size],
  ]);
  ctx.fill();
}

/** Pleated curtain from x0 to x1; gathered, it narrows to a tie-back at the window's side. */
function curtain(ctx: Ctx, x0: number, x1: number, color: string, light: string, gathered: boolean, random: () => number) {
  const folds = Math.max(3, Math.round((x1 - x0) / 11));
  const step = (x1 - x0) / folds;
  ctx.save();
  if (gathered) {
    const left = x0 < W / 2;
    const inner = left ? x1 : x0;
    const outer = left ? x0 : x1;
    ctx.beginPath();
    ctx.moveTo(outer, 0);
    ctx.lineTo(inner, 0);
    ctx.quadraticCurveTo(inner, H * 0.45, outer + (inner - outer) * 0.42, H * 0.6);
    ctx.quadraticCurveTo(inner - (inner - outer) * 0.05, H * 0.8, inner, H);
    ctx.lineTo(outer, H);
    ctx.closePath();
    ctx.clip();
  }
  for (let i = 0; i < folds; i += 1) {
    const x = x0 + i * step;
    const g = ctx.createLinearGradient(x, 0, x + step, 0);
    g.addColorStop(0, INK_SOFT);
    g.addColorStop(0.45, color);
    g.addColorStop(0.7, light);
    g.addColorStop(1, color);
    ctx.globalAlpha = 0.6 + random() * 0.4;
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, step + 1, H);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = vertical(ctx, 0, H, [
    [0, "rgba(30, 10, 40, 0.35)"],
    [0.3, "rgba(30, 10, 40, 0)"],
    [1, "rgba(30, 10, 40, 0.3)"],
  ]);
  ctx.fillRect(x0, 0, x1 - x0, H);
  ctx.restore();
}

/** A sheer: the room shows soft behind it. */
function sheer(ctx: Ctx, x0: number, x1: number, tint: string) {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = tint;
  ctx.fillRect(x0, 0, x1 - x0, H);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  for (let x = x0 + 4; x < x1; x += 9) ctx.fillRect(x, 0, 3, H);
  ctx.restore();
}

function plant(ctx: Ctx, x: number, base: number, size: number, random: () => number) {
  const top = base - size * 0.55;
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI / 2 + (random() - 0.5) * 2.4;
    const len = size * (0.6 + random() * 0.7);
    const lx = x + Math.cos(a) * len * 0.6;
    const ly = top + Math.sin(a) * len * 0.8;
    ctx.strokeStyle = "#2a2a2e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.fillStyle = random() < 0.5 ? "#2f3a34" : "#3e4c3a";
    ctx.beginPath();
    ctx.ellipse(lx, ly, size * 0.24, size * 0.1, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#4a2a2e";
  shape(ctx, [
    [x - size * 0.35, top],
    [x + size * 0.35, top],
    [x + size * 0.27, base],
    [x - size * 0.27, base],
  ]);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 210, 160, 0.35)";
  ctx.fillRect(x - size * 0.35, top, size * 0.7, 3);
}

/** A picture on the wall: frame, mount and a pastel print catching the lamp. */
function picture(ctx: Ctx, x: number, y: number, w: number, h: number, print: string) {
  ctx.fillStyle = INK_SOFT;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#e9c9a6";
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = print;
  ctx.fillRect(x + 9, y + 9, w - 18, h - 18);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  shape(ctx, [
    [x + 9, y + 9],
    [x + w * 0.6, y + 9],
    [x + 9, y + h * 0.7],
  ]);
  ctx.fill();
}

/** The glass: the sky's afterglow at the top and a diagonal sheen. */
function glass(ctx: Ctx, sheen: number) {
  ctx.fillStyle = vertical(ctx, 0, H * 0.45, [
    [0, "rgba(160, 120, 210, 0.16)"],
    [1, "rgba(160, 120, 210, 0)"],
  ]);
  ctx.fillRect(0, 0, W, H * 0.45);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(255, 200, 235, ${sheen})`;
  shape(ctx, [
    [W * 0.58, 0],
    [W * 0.72, 0],
    [W * 0.3, H],
    [W * 0.16, H],
  ]);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 200, 235, ${sheen * 0.5})`;
  shape(ctx, [
    [W * 0.78, 0],
    [W * 0.82, 0],
    [W * 0.4, H],
    [W * 0.36, H],
  ]);
  ctx.fill();
  ctx.restore();
}

type FrameStyle = { bars: number; transom?: number; colour?: string };

/** Frame, mullions and the sill catching the street light. */
function frame(ctx: Ctx, style: FrameStyle) {
  ctx.strokeStyle = style.colour ?? "#1c1030";
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, W, H);
  ctx.lineWidth = 6;
  for (let i = 1; i < style.bars; i += 1) {
    ctx.beginPath();
    ctx.moveTo((W * i) / style.bars, 0);
    ctx.lineTo((W * i) / style.bars, H);
    ctx.stroke();
  }
  if (style.transom) {
    ctx.beginPath();
    ctx.moveTo(0, style.transom);
    ctx.lineTo(W, style.transom);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 190, 140, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = "#4a3360";
  ctx.fillRect(0, H - 10, W, 10);
  ctx.fillStyle = "rgba(255, 220, 240, 0.35)";
  ctx.fillRect(0, H - 10, W, 2);
}

/** Venetian blinds over the top `down` of the pane, tilted so light leaks between the slats. */
function venetian(ctx: Ctx, down: number, lit: boolean, random: () => number) {
  const bottom = H * down;
  for (let y = 10; y < bottom; y += 11) {
    ctx.fillStyle = lit ? `rgba(${200 + random() * 30}, ${150 + random() * 20}, ${110 + random() * 10}, 0.92)` : "rgba(36, 26, 58, 0.95)";
    ctx.fillRect(0, y, W, 7);
    ctx.fillStyle = lit ? "rgba(90, 40, 40, 0.5)" : "rgba(10, 6, 24, 0.6)";
    ctx.fillRect(0, y + 6, W, 2);
  }
  ctx.fillStyle = lit ? "#b98a62" : "#2a1e44";
  ctx.fillRect(0, bottom, W, 6);
  ctx.strokeStyle = lit ? "rgba(120, 70, 50, 0.6)" : "rgba(20, 12, 36, 0.8)";
  ctx.lineWidth = 1.5;
  for (const x of [W * 0.25, W * 0.75]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
}

/** A monitor on a desk: its glow on the wall, the screen with a few lines of code, the stand. */
function monitor(ctx: Ctx, x: number, y: number, w: number, screen: string, glow: number) {
  const h = w * 0.62;
  pool(ctx, x, y + h / 2, w * 1.6, w * 1.1, screen, glow);
  ctx.fillStyle = INK;
  ctx.fillRect(x - w / 2 - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = screen;
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = "rgba(40, 30, 80, 0.45)";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(x - w / 2 + 4 + (i % 2) * 6, y + 5 + i * (h / 5), w * (0.3 + ((i * 37) % 5) / 10), 2);
  ctx.fillStyle = INK;
  ctx.fillRect(x - 2, y + h + 3, 4, 8);
  ctx.fillRect(x - 10, y + h + 10, 20, 3);
}

/** An office chair from behind. */
function chair(ctx: Ctx, x: number, base: number, s: number) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x - 16 * s, base - 62 * s, 32 * s, 40 * s, 8 * s);
  ctx.fill();
  ctx.fillRect(x - 3 * s, base - 24 * s, 6 * s, 16 * s);
  ctx.fillRect(x - 18 * s, base - 9 * s, 36 * s, 4 * s);
}

const PAINT: ((ctx: Ctx, random: () => number) => void)[] = [
  // 0 · Café: two pendants over a bistro table, a shelf of cups and jars, a plant.
  (ctx, random) => {
    wall(ctx, "#5a2722", "#c47645");
    ctx.fillStyle = "#e7b98a";
    ctx.globalAlpha = 0.22;
    for (let y = 168; y < 250; y += 12) for (let x = (y / 12) % 2 ? 0 : 12; x < W; x += 24) ctx.fillRect(x, y, 22, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK_SOFT;
    ctx.fillRect(20, 112, W - 40, 6);
    for (let x = 28; x < W - 30; x += 14 + random() * 10) {
      const h = 10 + random() * 18;
      ctx.fillStyle = random() < 0.5 ? "#f2d3a8" : "#9a5a42";
      ctx.fillRect(x, 112 - h, 9, h);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + 1, 112 - h + 2, 2, h - 4);
    }
    floor(ctx, 250, "#2c1626", "#4a2430");
    pendant(ctx, 80, 64, 15, "#ffd49a");
    pendant(ctx, 176, 70, 15, "#ffd49a");
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(128, 222, 42, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(125, 222, 6, 44);
    ctx.fillRect(108, 264, 40, 4);
    ctx.fillStyle = "rgba(255, 220, 170, 0.6)";
    ctx.fillRect(94, 216, 66, 2);
    ctx.fillStyle = "#f6e2c4";
    ctx.fillRect(116, 208, 12, 10);
    ctx.fillRect(138, 210, 10, 8);
    for (const [x, dir] of [
      [62, 1],
      [194, -1],
    ] as const) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - 14 * dir, 270);
      ctx.lineTo(x - 10 * dir, 232);
      ctx.lineTo(x + 14 * dir, 232);
      ctx.lineTo(x + 16 * dir, 270);
      ctx.moveTo(x - 10 * dir, 232);
      ctx.quadraticCurveTo(x - 22 * dir, 200, x - 12 * dir, 176);
      ctx.stroke();
    }
    plant(ctx, 228, 300, 40, random);
    falloff(ctx, 128, 140, 0.45);
    glass(ctx, 0.07);
    frame(ctx, { bars: 2, transom: 70 });
  },
  // 1 · Espresso bar: the machine's chrome, a chalk menu, a lit pastry case, stools.
  (ctx, random) => {
    wall(ctx, "#4f2424", "#b86a40");
    ctx.fillStyle = "#2b2230";
    ctx.fillRect(26, 40, 104, 76);
    ctx.strokeStyle = "#7a5a3a";
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 40, 104, 76);
    ctx.fillStyle = "rgba(250, 240, 220, 0.55)";
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect(36, 52 + i * 10, 40 + random() * 30, 2);
      ctx.fillRect(112, 52 + i * 10, 8, 2);
    }
    pendant(ctx, 186, 54, 14, "#ffd49a");
    ctx.fillStyle = vertical(ctx, 196, H, [
      [0, "#3a1d2a"],
      [1, "#24121e"],
    ]);
    ctx.fillRect(0, 196, W, H - 196);
    ctx.fillStyle = "#e8b080";
    ctx.fillRect(0, 192, W, 5);
    ctx.fillStyle = "rgba(255, 200, 150, 0.08)";
    for (let x = 6; x < W; x += 12) ctx.fillRect(x, 206, 5, H - 206);
    ctx.fillStyle = "#cdbfd0";
    ctx.fillRect(40, 144, 92, 48);
    ctx.fillStyle = "#8e7f9a";
    ctx.fillRect(40, 176, 92, 16);
    ctx.fillStyle = "#fff4e4";
    ctx.fillRect(44, 148, 84, 4);
    for (const x of [62, 104]) {
      ctx.fillStyle = INK;
      ctx.fillRect(x - 6, 176, 12, 10);
      ctx.fillStyle = "#f6e2c4";
      ctx.fillRect(x - 5, 186, 10, 6);
    }
    for (let x = 48; x < 128; x += 13) {
      ctx.fillStyle = "#f6e2c4";
      ctx.fillRect(x, 136, 9, 8);
    }
    ctx.fillStyle = "rgba(255, 236, 200, 0.85)";
    ctx.fillRect(150, 150, 84, 42);
    pool(ctx, 192, 172, 70, 30, "#ffd8a0", 0.5);
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = i % 2 ? "#b8673a" : "#d99a5a";
      ctx.beginPath();
      ctx.ellipse(160 + i * 13, 184, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(150, 150, 84, 2);
    for (const x of [60, 150, 230]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x, 252, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 2, 252, 4, 60);
      ctx.fillRect(x - 12, 290, 24, 3);
    }
    falloff(ctx, 120, 150, 0.4);
    glass(ctx, 0.06);
    frame(ctx, { bars: 2, transom: 32 });
  },
  // 2 · Hotel room: the curtain gathered on the left, a lamp by the headboard, a print.
  (ctx, random) => {
    wall(ctx, "#7a3c2c", "#d88a56");
    picture(ctx, 140, 70, 64, 50, "#7fb0b8");
    floor(ctx, 268, "#3a1c26", "#6a3030");
    ctx.fillStyle = "#4a2232";
    ctx.beginPath();
    ctx.roundRect(110, 168, 140, 72, [16, 16, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#f0d6c0";
    ctx.fillRect(104, 236, 152, 34);
    ctx.fillStyle = "#c78f80";
    ctx.fillRect(104, 252, 152, 18);
    ctx.fillStyle = "#fff1e2";
    ctx.beginPath();
    ctx.roundRect(140, 222, 48, 18, 6);
    ctx.fill();
    ctx.fillStyle = INK_SOFT;
    ctx.fillRect(84, 222, 30, 48);
    tableLamp(ctx, 99, 222, 30, "#f0a060");
    curtain(ctx, 0, 92, "#7a2a50", "#c25a7a", true, random);
    falloff(ctx, 110, 180, 0.4);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 3 · An arc lamp over an armchair, a book left on its arm, a plant, the curtain on the right.
  (ctx, random) => {
    wall(ctx, "#6e3628", "#cf8452");
    floor(ctx, 262, "#351a26", "#5e2c30");
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 286);
    ctx.quadraticCurveTo(40, 70, 128, 96);
    ctx.stroke();
    pool(ctx, 128, 130, 120, 110, "#ffd090", 0.9);
    ctx.fillStyle = INK_SOFT;
    ctx.beginPath();
    ctx.ellipse(130, 104, 22, 14, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff0d0";
    ctx.beginPath();
    ctx.ellipse(130, 104, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(40, 288, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a2436";
    ctx.beginPath();
    ctx.roundRect(88, 182, 86, 70, 18);
    ctx.fill();
    ctx.fillStyle = "#5e2e44";
    ctx.beginPath();
    ctx.roundRect(78, 216, 106, 46, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 200, 150, 0.35)";
    ctx.fillRect(92, 186, 78, 3);
    ctx.fillRect(80, 218, 102, 3);
    ctx.fillStyle = INK;
    ctx.fillRect(84, 262, 6, 12);
    ctx.fillRect(172, 262, 6, 12);
    ctx.fillStyle = "#f4e4c8";
    shape(ctx, [
      [150, 214],
      [166, 210],
      [182, 214],
      [166, 218],
    ]);
    ctx.fill();
    plant(ctx, 200, 296, 46, random);
    curtain(ctx, 214, W, "#62284a", "#a24a6a", false, random);
    falloff(ctx, 128, 160, 0.45);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 4 · A pink room behind sheers: a round mirror over a dresser.
  (ctx) => {
    wall(ctx, "#86386a", "#e690b4");
    floor(ctx, 268, "#4a1e3a", "#7a3458");
    ctx.fillStyle = "#5a2448";
    ctx.fillRect(70, 196, 116, 72);
    ctx.fillStyle = "rgba(255, 210, 230, 0.35)";
    ctx.fillRect(70, 196, 116, 3);
    ctx.fillRect(78, 222, 100, 2);
    ctx.fillRect(78, 246, 100, 2);
    pool(ctx, 128, 120, 90, 80, "#ffd0e0", 0.7);
    ctx.fillStyle = "#3a1834";
    ctx.beginPath();
    ctx.arc(128, 128, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = vertical(ctx, 84, 172, [
      [0, "#f6c0e0"],
      [1, "#b06a9a"],
    ]);
    ctx.beginPath();
    ctx.arc(128, 128, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(116, 112, 8, 18, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6d4e6";
    ctx.fillRect(84, 182, 8, 14);
    ctx.fillRect(160, 172, 12, 24);
    sheer(ctx, 0, 62, "#ffc6dc");
    sheer(ctx, 194, W, "#ffc6dc");
    falloff(ctx, 128, 140, 0.35);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#2a1234" });
  },
  // 5 · Dark: the room only just there, the glass holding the sky and a far lit window.
  (ctx, random) => {
    wall(ctx, "#1c1434", "#2a1d46");
    ctx.fillStyle = "rgba(60, 44, 96, 0.5)";
    ctx.fillRect(30, 190, 110, 80);
    ctx.fillRect(170, 120, 50, 150);
    ctx.fillStyle = vertical(ctx, 0, H, [
      [0, "rgba(140, 100, 190, 0.35)"],
      [0.5, "rgba(80, 50, 130, 0.1)"],
      [1, "rgba(255, 120, 190, 0.12)"],
    ]);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255, 200, 140, 0.18)";
    ctx.fillRect(40 + random() * 140, 60, 18, 26);
    glass(ctx, 0.12);
    frame(ctx, { bars: 1, colour: "#170c28" });
  },
  // 6 · Office behind blinds two-thirds down: a desk lamp and a screen below them.
  (ctx, random) => {
    wall(ctx, "#8a5236", "#d89a62");
    floor(ctx, 280, "#4a2a2a", "#6a3a32");
    ctx.fillStyle = "#3a2030";
    ctx.fillRect(0, 252, W, 8);
    monitor(ctx, 168, 210, 54, "#9fd8ff", 0.45);
    tableLamp(ctx, 60, 252, 26, "#e09a5a");
    chair(ctx, 120, 300, 1.1);
    venetian(ctx, 0.62, true, random);
    falloff(ctx, 128, 220, 0.35);
    glass(ctx, 0.05);
    frame(ctx, { bars: 2 });
  },
  // 7 · Blinds down on a dark office, one screen left on behind them.
  (ctx, random) => {
    wall(ctx, "#1e1636", "#281c42");
    pool(ctx, 180, 250, 60, 40, "#6fb8ff", 0.35);
    ctx.fillStyle = "rgba(111, 184, 255, 0.5)";
    ctx.fillRect(160, 248, 40, 24);
    venetian(ctx, 0.86, false, random);
    glass(ctx, 0.1);
    frame(ctx, { bars: 2, colour: "#170c28" });
  },
  // 8 · Open office: ceiling panels in perspective, a whiteboard, desks, screens, chair backs.
  (ctx, random) => {
    wall(ctx, "#6a4a5a", "#c8987a");
    for (let row = 0; row < 3; row += 1) {
      const y = 18 + row * 22;
      const w = 70 - row * 16;
      for (const cx of [64, 192]) {
        ctx.fillStyle = `rgba(255, 246, 228, ${0.9 - row * 0.2})`;
        ctx.fillRect(cx - w / 2 + (cx < 128 ? row * 12 : -row * 12), y, w, 6 - row);
      }
    }
    pool(ctx, 128, 40, 150, 50, "#fff0d8", 0.35);
    ctx.fillStyle = "#efe2dc";
    ctx.fillRect(84, 112, 92, 52);
    ctx.strokeStyle = "rgba(60, 80, 160, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(92, 150);
    ctx.lineTo(112, 128);
    ctx.lineTo(134, 140);
    ctx.lineTo(160, 120);
    ctx.stroke();
    plant(ctx, 214, 214, 38, random);
    floor(ctx, 262, "#3a2430", "#5e3a3a");
    ctx.fillStyle = "#3a2432";
    ctx.fillRect(0, 226, W, 8);
    monitor(ctx, 56, 188, 46, "#a8e0ff", 0.35);
    monitor(ctx, 142, 190, 46, "#ffd6a8", 0.25);
    chair(ctx, 64, 300, 1.15);
    chair(ctx, 168, 304, 1.25);
    falloff(ctx, 128, 120, 0.3);
    glass(ctx, 0.05);
    frame(ctx, { bars: 2, colour: "#24182e" });
  },
  // 9 · A room lit only by its television: cool light from low on the left, a sofa's back.
  (ctx) => {
    wall(ctx, "#25234e", "#3a4688");
    floor(ctx, 266, "#1c1a3a", "#2a2c5c");
    pool(ctx, 40, 230, 170, 120, "#8fb4ff", 0.75);
    ctx.fillStyle = "#1a1636";
    ctx.fillRect(140, 96, 92, 5);
    ctx.fillRect(152, 76, 10, 20);
    ctx.fillRect(170, 82, 22, 14);
    ctx.fillRect(204, 70, 8, 26);
    picture(ctx, 40, 70, 58, 44, "#3a4a7a");
    ctx.fillStyle = "#2a2a5a";
    ctx.beginPath();
    ctx.roundRect(84, 196, 40, 30, 10);
    ctx.roundRect(170, 200, 38, 28, 10);
    ctx.fill();
    ctx.fillStyle = "#1a1636";
    ctx.beginPath();
    ctx.roundRect(60, 214, 180, 70, 22);
    ctx.fill();
    ctx.fillStyle = "rgba(160, 190, 255, 0.35)";
    ctx.fillRect(70, 216, 160, 3);
    falloff(ctx, 60, 220, 0.45);
    glass(ctx, 0.06);
    frame(ctx, { bars: 1, colour: "#120c28" });
  },
  // 10 · A reader in an armchair under the floor lamp, in profile: head bowed, legs crossed, book up.
  (ctx, random) => {
    wall(ctx, "#6a3428", "#c87a4a");
    floor(ctx, 270, "#33182a", "#5a2a30");
    picture(ctx, 26, 66, 54, 70, "#d9a06a");
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(204, 290);
    ctx.lineTo(204, 112);
    ctx.stroke();
    pool(ctx, 194, 124, 130, 120, "#ffd090", 0.95);
    ctx.fillStyle = vertical(ctx, 84, 124, [
      [0, "#fff3d8"],
      [1, "#f0a060"],
    ]);
    shape(ctx, [
      [190, 84],
      [218, 84],
      [230, 124],
      [178, 124],
    ]);
    ctx.fill();
    reader(ctx);
    ctx.fillStyle = INK_SOFT;
    ctx.fillRect(28, 226, 36, 4);
    ctx.fillRect(44, 230, 4, 42);
    ctx.fillStyle = "#f2dcc0";
    ctx.fillRect(34, 216, 10, 10);
    plant(ctx, 236, 300, 30, random);
    falloff(ctx, 180, 160, 0.42);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 11 · Curtains drawn, the room glowing through them, brighter at the gap.
  (ctx, random) => {
    wall(ctx, "#a8582e", "#e8a060");
    curtain(ctx, 0, W * 0.5 - 4, "#b0603a", "#f2b070", false, random);
    curtain(ctx, W * 0.5 + 4, W, "#b0603a", "#f2b070", false, random);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = vertical(ctx, 0, H, [
      [0, "rgba(255, 220, 160, 0.2)"],
      [0.5, "rgba(255, 220, 160, 0.6)"],
      [1, "rgba(255, 220, 160, 0.25)"],
    ]);
    ctx.fillRect(W * 0.5 - 6, 0, 12, H);
    ctx.restore();
    pool(ctx, W * 0.5, H * 0.55, 80, 120, "#ffc880", 0.35);
    // A lamp's shadow on the cloth.
    ctx.fillStyle = "rgba(90, 40, 40, 0.3)";
    shape(ctx, [
      [56, 150],
      [84, 150],
      [94, 186],
      [46, 186],
    ]);
    ctx.fill();
    ctx.fillRect(68, 186, 4, 60);
    ctx.fillStyle = "#6a3030";
    ctx.fillRect(0, 10, W, 14);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 12 · Lobby: a ring chandelier, the reception desk lit along its foot, a print, potted palms, marble.
  (ctx, random) => {
    wall(ctx, "#7a4a3a", "#e0b088");
    ctx.strokeStyle = "rgba(255, 240, 220, 0.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      const x = random() * W;
      ctx.moveTo(x, 90);
      ctx.bezierCurveTo(x + 30, 130, x - 20, 160, x + 10, 210);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a2238";
    ctx.fillRect(44, 92, 168, 70);
    ctx.fillStyle = vertical(ctx, 98, 156, [
      [0, "#f0a070"],
      [0.6, "#d0607a"],
      [1, "#5a3070"],
    ]);
    ctx.fillRect(50, 98, 156, 58);
    ctx.fillStyle = "#3a2238";
    ctx.beginPath();
    ctx.arc(128, 156, 24, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const x of [96, 160]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(128 + (x - 128) * 0.9, 50);
      ctx.stroke();
    }
    pool(ctx, 128, 54, 110, 50, "#fff0d0", 0.7);
    ctx.strokeStyle = "#fff4dc";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(128, 54, 52, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    floor(ctx, 252, "#5a3436", "#a87064");
    pool(ctx, 128, 262, 110, 14, "#ffe0b0", 0.5);
    ctx.fillStyle = "#2e1828";
    ctx.beginPath();
    ctx.roundRect(56, 196, 144, 58, [10, 10, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#ffe2b0";
    ctx.fillRect(62, 244, 132, 4);
    ctx.fillStyle = "rgba(255, 220, 180, 0.45)";
    ctx.fillRect(56, 196, 144, 3);
    tableLamp(ctx, 82, 196, 18, "#f0a060");
    ctx.fillStyle = "#e8d0a0";
    ctx.beginPath();
    ctx.arc(170, 196, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    plant(ctx, 228, 300, 58, random);
    plant(ctx, 26, 300, 44, random);
    falloff(ctx, 128, 140, 0.3);
    glass(ctx, 0.06);
    frame(ctx, { bars: 2, transom: 46, colour: "#2a1834" });
  },
  // 13 · Study: books floor to ceiling, a green-shaded lamp on the desk.
  (ctx, random) => {
    wall(ctx, "#5a2c26", "#a8603e");
    const spines = ["#b8573e", "#d9a35e", "#5e7a7a", "#8a3a4a", "#e6d2a8", "#4a4a6a", "#a8784a"];
    for (let row = 0; row < 4; row += 1) {
      const y = 50 + row * 52;
      ctx.fillStyle = INK_SOFT;
      ctx.fillRect(16, y + 40, W - 32, 6);
      let x = 22;
      while (x < W - 28) {
        const w = 6 + random() * 8;
        const h = 26 + random() * 14;
        ctx.fillStyle = spines[Math.floor(random() * spines.length)];
        if (random() < 0.08) {
          ctx.save();
          ctx.translate(x, y + 40);
          ctx.rotate(-0.25);
          ctx.fillRect(0, -h, w, h);
          ctx.restore();
          x += w + 8;
        } else {
          ctx.fillRect(x, y + 40 - h, w, h);
          ctx.fillStyle = "rgba(255, 230, 190, 0.25)";
          ctx.fillRect(x + 1, y + 40 - h + 6, w - 2, 2);
          x += w + 1;
        }
        if (random() < 0.06) x += 18;
      }
    }
    ctx.fillStyle = "#2a1626";
    ctx.fillRect(0, 254, W, H - 254);
    ctx.fillStyle = "rgba(255, 210, 160, 0.4)";
    ctx.fillRect(0, 254, W, 3);
    pool(ctx, 150, 250, 100, 50, "#ffe0a0", 0.85);
    ctx.fillStyle = "#2f6a58";
    ctx.beginPath();
    ctx.ellipse(150, 232, 30, 9, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff0c8";
    ctx.fillRect(122, 232, 56, 3);
    ctx.fillStyle = "#c9a060";
    ctx.fillRect(148, 234, 4, 18);
    ctx.fillRect(138, 250, 24, 4);
    falloff(ctx, 150, 220, 0.45);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 14 · A roller blind half down, plants on the sill, a lamp lit low in the room.
  (ctx, random) => {
    wall(ctx, "#7a3e2c", "#d6905a");
    picture(ctx, 150, 150, 60, 44, "#c06a7a");
    pool(ctx, 70, 220, 120, 90, "#ffcf90", 0.7);
    ctx.fillStyle = INK_SOFT;
    ctx.fillRect(40, 262, 60, 40);
    tableLamp(ctx, 70, 262, 24, "#e8a060");
    const bottom = 118 + random() * 24;
    ctx.fillStyle = vertical(ctx, 0, bottom, [
      [0, "#c89a6a"],
      [1, "#e8bb84"],
    ]);
    ctx.fillRect(0, 0, W, bottom);
    ctx.fillStyle = "#5a3428";
    ctx.fillRect(0, bottom, W, 7);
    ctx.strokeStyle = "#5a3428";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W * 0.5, bottom + 7);
    ctx.lineTo(W * 0.5, bottom + 40);
    ctx.stroke();
    ctx.fillStyle = "#5a3428";
    ctx.beginPath();
    ctx.arc(W * 0.5, bottom + 42, 3, 0, Math.PI * 2);
    ctx.fill();
    plant(ctx, 50, H - 10, 34, random);
    plant(ctx, 124, H - 10, 24, random);
    plant(ctx, 206, H - 10, 40, random);
    falloff(ctx, 90, 220, 0.35);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 15 · Late in the office: the lights out, one screen and its desk lamp still on.
  (ctx) => {
    wall(ctx, "#1e1838", "#2c2248");
    floor(ctx, 262, "#14102a", "#221a3a");
    ctx.fillStyle = "#241c40";
    for (const x of [26, 214]) ctx.fillRect(x - 16, 176, 32, 22);
    ctx.fillStyle = "#18122c";
    ctx.fillRect(0, 226, W, 8);
    monitor(ctx, 150, 186, 56, "#8fd0ff", 0.7);
    pool(ctx, 70, 226, 60, 26, "#ffcf90", 0.6);
    ctx.fillStyle = "#3a2a4a";
    ctx.fillRect(66, 196, 3, 30);
    ctx.fillStyle = "#ffe4b0";
    shape(ctx, [
      [56, 190],
      [80, 190],
      [84, 200],
      [52, 200],
    ]);
    ctx.fill();
    chair(ctx, 150, 304, 1.3);
    glass(ctx, 0.1);
    frame(ctx, { bars: 2, colour: "#160c26" });
  },
  // 16 · Two desks face to face: an editor's dark screen, a sheet's bright one, a mug and a coat on its stand.
  (ctx, random) => {
    wall(ctx, "#5e4a62", "#b48f86");
    pool(ctx, 128, 26, 140, 40, "#fff3e0", 0.3);
    ctx.fillStyle = "rgba(255, 246, 230, 0.8)";
    ctx.fillRect(44, 12, 168, 5);
    // A pinboard with notes, a calendar.
    ctx.fillStyle = "#8a6a52";
    ctx.fillRect(150, 70, 74, 52);
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = ["#ffe27a", "#9fe0c8", "#ffb0c8"][i % 3];
      ctx.fillRect(156 + (i % 3) * 22, 76 + Math.floor(i / 3) * 22, 16 + random() * 3, 14);
    }
    floor(ctx, 270, "#33222e", "#5a3c40");
    ctx.fillStyle = "#3a2836";
    ctx.fillRect(0, 230, W, 8);
    ctx.fillRect(18, 238, 6, 34);
    ctx.fillRect(232, 238, 6, 34);
    // An editor in a dark theme: coloured lines on near black.
    ctx.fillStyle = INK;
    ctx.fillRect(40, 176, 72, 48);
    ctx.fillStyle = "#1f1830";
    ctx.fillRect(43, 179, 66, 42);
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = ["#ff8fb8", "#8fd8ff", "#ffd27a", "#b8a8ff"][i % 4];
      ctx.fillRect(47 + (i % 3) * 5, 183 + i * 5.5, 16 + ((i * 29) % 30), 2);
    }
    pool(ctx, 76, 200, 70, 46, "#8fb8ff", 0.25);
    ctx.fillStyle = INK;
    ctx.fillRect(73, 224, 6, 6);
    // A spreadsheet, bright.
    monitor(ctx, 168, 182, 58, "#e8f2ff", 0.3);
    ctx.fillStyle = "rgba(60, 90, 140, 0.35)";
    for (let i = 1; i < 6; i += 1) ctx.fillRect(140, 182 + i * 6, 56, 1);
    for (let i = 1; i < 5; i += 1) ctx.fillRect(139 + i * 12, 182, 1, 36);
    // A mug, a desk lamp, a coat on its stand.
    ctx.fillStyle = "#f2e2d0";
    ctx.fillRect(122, 216, 10, 14);
    tableLamp(ctx, 220, 230, 18, "#e8a868");
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 300);
    ctx.lineTo(20, 120);
    ctx.stroke();
    ctx.fillStyle = "#4a2c48";
    shape(ctx, [
      [12, 126],
      [30, 126],
      [36, 210],
      [6, 210],
    ]);
    ctx.fill();
    chair(ctx, 86, 304, 1.15);
    falloff(ctx, 128, 160, 0.35);
    glass(ctx, 0.05);
    frame(ctx, { bars: 2, colour: "#24182e" });
  },
  // 17 · A meeting room: a long table going away, a wall screen with a chart, a strip light, chairs.
  (ctx) => {
    wall(ctx, "#4a4a6e", "#9a90b4");
    ctx.fillStyle = "rgba(240, 248, 255, 0.85)";
    ctx.fillRect(56, 18, 144, 6);
    pool(ctx, 128, 30, 150, 60, "#eef4ff", 0.35);
    // The screen: a bar chart glowing.
    ctx.fillStyle = INK;
    ctx.fillRect(74, 70, 108, 66);
    ctx.fillStyle = "#cfe6ff";
    ctx.fillRect(78, 74, 100, 58);
    pool(ctx, 128, 104, 110, 70, "#bfe0ff", 0.35);
    const bars = [22, 30, 26, 38, 44];
    bars.forEach((h, i) => {
      ctx.fillStyle = i === bars.length - 1 ? "#ff6fae" : "#5a7ad8";
      ctx.fillRect(88 + i * 17, 126 - h, 11, h);
    });
    floor(ctx, 252, "#2c2638", "#4e4460");
    // The table in perspective, chairs either side.
    ctx.fillStyle = "#2a2036";
    shape(ctx, [
      [104, 196],
      [152, 196],
      [212, 286],
      [44, 286],
    ]);
    ctx.fill();
    ctx.fillStyle = "rgba(220, 230, 255, 0.35)";
    shape(ctx, [
      [104, 196],
      [152, 196],
      [154, 199],
      [102, 199],
    ]);
    ctx.fill();
    for (const [x, y, s] of [
      [84, 230, 0.7],
      [172, 230, 0.7],
      [58, 272, 0.95],
      [198, 272, 0.95],
    ] as const) {
      chair(ctx, x, y + 24 * s, s);
    }
    falloff(ctx, 128, 120, 0.3);
    glass(ctx, 0.06);
    frame(ctx, { bars: 2, colour: "#24182e" });
  },
  // 18 · Half lit: blinds a third of the way down, the ceiling lights off, one floor lamp left on in the corner.
  (ctx, random) => {
    wall(ctx, "#2a2040", "#43305a");
    pool(ctx, 206, 150, 120, 140, "#ffc888", 0.55);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(206, 290);
    ctx.lineTo(206, 128);
    ctx.stroke();
    ctx.fillStyle = vertical(ctx, 104, 132, [
      [0, "#fff0d0"],
      [1, "#e0a060"],
    ]);
    shape(ctx, [
      [194, 104],
      [218, 104],
      [226, 132],
      [186, 132],
    ]);
    ctx.fill();
    floor(ctx, 270, "#1c1428", "#2e2240");
    ctx.fillStyle = "rgba(60, 44, 90, 0.8)";
    ctx.fillRect(20, 214, 150, 10);
    ctx.fillRect(30, 224, 6, 46);
    ctx.fillRect(152, 224, 6, 46);
    monitor(ctx, 70, 176, 44, "#2a2a52", 0.05);
    monitor(ctx, 124, 178, 44, "#2a2a52", 0.05);
    plant(ctx, 236, 300, 34, random);
    venetian(ctx, 0.34, true, random);
    glass(ctx, 0.1);
    frame(ctx, { bars: 2, colour: "#1c1030" });
  },
  // 19 · Archive and a standing desk: binders in coloured rows, a terminal on its screen, a task light.
  (ctx, random) => {
    wall(ctx, "#5a3e4e", "#a87a6a");
    ctx.fillStyle = "#3a2634";
    ctx.fillRect(14, 40, 104, 236);
    for (let shelf = 0; shelf < 4; shelf += 1) {
      const y = 50 + shelf * 58;
      for (let x = 20; x < 112; x += 9 + random() * 3) {
        ctx.fillStyle = ["#d86a6a", "#6a8ad8", "#e8c060", "#7ab88a", "#e0e0e8"][Math.floor(random() * 5)];
        ctx.fillRect(x, y + 6 + random() * 4, 7, 44);
      }
      ctx.fillStyle = "#2a1a28";
      ctx.fillRect(14, y + 52, 104, 5);
    }
    pool(ctx, 186, 150, 100, 90, "#fff0d8", 0.45);
    ctx.fillStyle = "#2c2032";
    ctx.fillRect(140, 184, 104, 6);
    ctx.fillRect(188, 190, 8, 100);
    ctx.fillStyle = INK;
    ctx.fillRect(152, 130, 70, 46);
    ctx.fillStyle = "#0e1a18";
    ctx.fillRect(155, 133, 64, 40);
    ctx.fillStyle = "#7affc0";
    for (let i = 0; i < 5; i += 1) ctx.fillRect(159, 138 + i * 7, 10 + ((i * 23) % 40), 2);
    pool(ctx, 186, 152, 60, 40, "#6affb8", 0.18);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(236, 184);
    ctx.lineTo(244, 120);
    ctx.lineTo(220, 104);
    ctx.stroke();
    ctx.fillStyle = "#fff2d8";
    ctx.beginPath();
    ctx.arc(218, 108, 7, 0, Math.PI * 2);
    ctx.fill();
    floor(ctx, 286, "#2e1e2c", "#4e3440");
    falloff(ctx, 160, 150, 0.4);
    glass(ctx, 0.05);
    frame(ctx, { bars: 2, colour: "#24182e" });
  },
  // 20 · A corner office: a low sofa under a print, a tall plant, a spot on the wall, the desk lamp.
  (ctx, random) => {
    wall(ctx, "#6a3e48", "#c88a6e");
    picture(ctx, 60, 64, 96, 62, "#e8b0c0");
    pool(ctx, 108, 70, 90, 60, "#fff0d8", 0.55);
    floor(ctx, 262, "#36202c", "#5e3a3e");
    ctx.fillStyle = "#3e5a6a";
    ctx.beginPath();
    ctx.roundRect(36, 190, 150, 40, 12);
    ctx.fill();
    ctx.fillStyle = "#4e7084";
    ctx.beginPath();
    ctx.roundRect(28, 220, 166, 36, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 220, 190, 0.3)";
    ctx.fillRect(38, 192, 146, 3);
    ctx.fillStyle = "#f0c0a0";
    ctx.beginPath();
    ctx.roundRect(52, 204, 30, 22, 6);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(40, 256, 6, 12);
    ctx.fillRect(176, 256, 6, 12);
    plant(ctx, 222, 290, 70, random);
    falloff(ctx, 110, 140, 0.35);
    glass(ctx, 0.05);
    frame(ctx, { bars: 2, colour: "#24182e" });
  },
  // 21 · A kitchen: wall cupboards, a pendant over the counter, pans on a rail, the fridge's edge.
  (ctx, random) => {
    wall(ctx, "#6a4a3a", "#d8a274");
    ctx.fillStyle = "#e8d8c0";
    ctx.globalAlpha = 0.25;
    for (let y = 150; y < 210; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < W; x += 20) ctx.fillRect(x, y, 18, 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#5e8a84";
    for (const x of [30, 100]) {
      ctx.fillRect(x, 40, 64, 70);
      ctx.fillStyle = "rgba(255, 240, 220, 0.25)";
      ctx.fillRect(x + 30, 70, 4, 14);
      ctx.fillStyle = "#5e8a84";
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 132);
    ctx.lineTo(160, 132);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const x = 44 + i * 30;
      ctx.beginPath();
      ctx.moveTo(x, 132);
      ctx.lineTo(x, 142);
      ctx.stroke();
      ctx.fillStyle = i % 2 ? "#c07a50" : "#3a2a34";
      ctx.beginPath();
      ctx.arc(x, 150, 8 + random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    pendant(ctx, 120, 90, 14, "#ffd8a0");
    ctx.fillStyle = "#2e2028";
    ctx.fillRect(0, 210, 200, 70);
    ctx.fillStyle = "#e8c8a0";
    ctx.fillRect(0, 206, 200, 6);
    ctx.fillStyle = "#f2e6da";
    ctx.fillRect(68, 192, 14, 14);
    ctx.fillRect(90, 196, 22, 10);
    ctx.fillStyle = "#d8d4dc";
    ctx.fillRect(210, 30, 46, 250);
    ctx.fillStyle = "rgba(60, 50, 80, 0.4)";
    ctx.fillRect(210, 128, 46, 3);
    floor(ctx, 280, "#2e1c24", "#4a2e30");
    falloff(ctx, 120, 150, 0.4);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 22 · A shelf of records and plants, a string of bulbs, an armchair turned to the room.
  (ctx, random) => {
    wall(ctx, "#5a2e3a", "#b8705a");
    ctx.strokeStyle = "rgba(40, 20, 30, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.quadraticCurveTo(128, 76, W, 36);
    ctx.stroke();
    for (let i = 0; i < 9; i += 1) {
      const t = (i + 0.5) / 9;
      const x = t * W;
      const y = 40 + Math.sin(t * Math.PI) * 34 - t * 4;
      pool(ctx, x, y + 4, 12, 12, "#ffd890", 0.8);
      ctx.fillStyle = "#fff4d8";
      ctx.beginPath();
      ctx.arc(x, y + 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3a2030";
    ctx.fillRect(30, 110, 140, 6);
    ctx.fillRect(30, 170, 140, 6);
    for (let x = 34; x < 166; x += 5 + random() * 3) {
      ctx.fillStyle = ["#2a1a26", "#d86a5a", "#e8c070", "#5a6ab8"][Math.floor(random() * 4)];
      ctx.fillRect(x, 140 + random() * 4, 4, 30);
    }
    plant(ctx, 60, 110, 30, random);
    plant(ctx, 140, 110, 26, random);
    floor(ctx, 260, "#2e1824", "#52283a");
    ctx.fillStyle = "#6a3a3a";
    ctx.beginPath();
    ctx.roundRect(150, 196, 80, 62, 16);
    ctx.fill();
    ctx.fillStyle = "#7e4a44";
    ctx.beginPath();
    ctx.roundRect(142, 226, 96, 36, 10);
    ctx.fill();
    tableLamp(ctx, 112, 250, 20, "#f0a060");
    falloff(ctx, 120, 140, 0.4);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 23 · A hotel room seen square on: the headboard, a lamp each side, an abstract over the bed.
  (ctx) => {
    wall(ctx, "#4a3a5e", "#a88aa4");
    pool(ctx, 64, 160, 70, 80, "#ffd8a0", 0.6);
    pool(ctx, 192, 160, 70, 80, "#ffd8a0", 0.6);
    picture(ctx, 82, 70, 92, 54, "#f0b088");
    ctx.fillStyle = "#c86a7a";
    ctx.beginPath();
    ctx.arc(128, 104, 12, 0, Math.PI * 2);
    ctx.fill();
    floor(ctx, 272, "#2a1c2e", "#4a3448");
    ctx.fillStyle = "#3c2a44";
    ctx.beginPath();
    ctx.roundRect(70, 150, 116, 84, [14, 14, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#efe2d8";
    ctx.fillRect(62, 226, 132, 40);
    ctx.fillStyle = "#7a5a8a";
    ctx.fillRect(62, 246, 132, 20);
    for (const x of [28, 228]) {
      ctx.fillStyle = INK_SOFT;
      ctx.fillRect(x - 18, 222, 36, 44);
      tableLamp(ctx, x, 222, 20, "#f0b070");
    }
    falloff(ctx, 128, 170, 0.35);
    glass(ctx, 0.05);
    frame(ctx, { bars: 1, colour: "#22122e" });
  },
  // 24-27 · The hotel's lobby, one room across four panes (lobbyPanorama).
  (ctx) => lobbyPanorama(ctx, 0),
  (ctx) => lobbyPanorama(ctx, 1),
  (ctx) => lobbyPanorama(ctx, 2),
  (ctx) => lobbyPanorama(ctx, 3),
  // 28-30 · The landmark's atrium, one space across three panes (atriumPanorama).
  (ctx) => atriumPanorama(ctx, 0),
  (ctx) => atriumPanorama(ctx, 1),
  (ctx) => atriumPanorama(ctx, 2),
];

/**
 * The reader, facing left in a wing chair: head bowed to the book held up in
 * both hands, back to the cushion, right leg crossed over the left. Drawn as
 * one silhouette, rim-lit from the lamp behind.
 */
function reader(ctx: Ctx) {
  // The chair: wing back, seat, arm.
  ctx.fillStyle = "#3e1e30";
  ctx.beginPath();
  ctx.moveTo(186, 284);
  ctx.lineTo(186, 150);
  ctx.quadraticCurveTo(186, 128, 166, 130);
  ctx.quadraticCurveTo(152, 132, 152, 150);
  ctx.lineTo(154, 222);
  ctx.lineTo(104, 222);
  ctx.quadraticCurveTo(92, 222, 92, 234);
  ctx.lineTo(92, 268);
  ctx.lineTo(186, 268);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4e2638";
  ctx.beginPath();
  ctx.roundRect(98, 226, 70, 22, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 200, 150, 0.3)";
  ctx.fillRect(100, 226, 66, 2);
  ctx.fillStyle = INK;
  ctx.fillRect(96, 268, 6, 18);
  ctx.fillRect(178, 268, 6, 18);

  ctx.fillStyle = INK;
  // Torso: from the nape down the back to the hip, round the belly to the chest.
  ctx.beginPath();
  ctx.moveTo(140, 166);
  ctx.bezierCurveTo(156, 172, 162, 196, 158, 226);
  ctx.lineTo(126, 228);
  ctx.bezierCurveTo(120, 210, 120, 188, 128, 172);
  ctx.closePath();
  ctx.fill();
  // Thighs: the lower one forward to the knee, the crossed one rising over it.
  ctx.beginPath();
  ctx.moveTo(158, 224);
  ctx.lineTo(116, 220);
  ctx.quadraticCurveTo(104, 220, 102, 230);
  ctx.lineTo(110, 236);
  ctx.lineTo(156, 238);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150, 222);
  ctx.quadraticCurveTo(120, 206, 100, 210);
  ctx.quadraticCurveTo(92, 214, 96, 222);
  ctx.quadraticCurveTo(122, 222, 140, 232);
  ctx.closePath();
  ctx.fill();
  // Lower legs: the planted shin down to the floor, the crossed one hanging forward.
  ctx.beginPath();
  ctx.moveTo(102, 228);
  ctx.lineTo(112, 232);
  ctx.lineTo(108, 276);
  ctx.lineTo(112, 282);
  ctx.lineTo(90, 284);
  ctx.quadraticCurveTo(88, 278, 98, 276);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(96, 212);
  ctx.lineTo(104, 220);
  ctx.lineTo(84, 254);
  ctx.lineTo(74, 256);
  ctx.quadraticCurveTo(70, 252, 76, 248);
  ctx.closePath();
  ctx.fill();
  // Head bowed, a short crop, the nose and chin toward the book.
  ctx.beginPath();
  ctx.ellipse(136, 152, 12, 14, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(126, 152);
  ctx.lineTo(120, 162);
  ctx.lineTo(126, 164);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(132, 160, 10, 10);
  // Upper arm down from the shoulder, forearm up to the book.
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(140, 178);
  ctx.lineTo(132, 204);
  ctx.lineTo(114, 186);
  ctx.stroke();
  ctx.lineCap = "butt";
  // The book, open, its pages catching the lamp.
  ctx.fillStyle = "#f6e4c4";
  shape(ctx, [
    [100, 170],
    [112, 166],
    [116, 188],
    [104, 192],
  ]);
  ctx.fill();
  ctx.fillStyle = "#dcc29a";
  shape(ctx, [
    [112, 166],
    [122, 172],
    [122, 190],
    [116, 188],
  ]);
  ctx.fill();
  // Rim light from the lamp behind: crown, nape, back.
  ctx.strokeStyle = "rgba(255, 196, 130, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(136, 152, 12, 14, 0.35, -1.4, 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(142, 168);
  ctx.bezierCurveTo(156, 174, 160, 196, 157, 222);
  ctx.stroke();
}

/**
 * The hotel's lobby as one room behind four panes: a sofa and a palm under a
 * print on the left, the ring chandelier over the curved reception desk and
 * its key cubbies in the middle, the lift with its deco fan on the right.
 * Painted whole and cut into the four cells, so the panes read as one space.
 */
function lobbyPanorama(ctx: Ctx, part: number) {
  const random = createRandom(1951);
  const PW = W * 4;
  ctx.save();
  ctx.translate(-part * W, 0);
  ctx.fillStyle = vertical(ctx, 0, H, [
    [0, "#6a3a3a"],
    [1, "#e0aa82"],
  ]);
  ctx.fillRect(0, 0, PW, H);
  // Fluted pilasters, a sconce on each.
  for (const x of [150, 360, 664, 874]) {
    ctx.fillStyle = "rgba(60, 24, 40, 0.35)";
    ctx.fillRect(x - 14, 30, 28, 220);
    ctx.fillStyle = "rgba(255, 220, 190, 0.18)";
    for (let k = -10; k <= 10; k += 5) ctx.fillRect(x + k, 30, 1.5, 220);
    pool(ctx, x, 96, 60, 50, "#ffd8a8", 0.55);
    ctx.fillStyle = "#fff0d0";
    shape(ctx, [
      [x - 9, 90],
      [x + 9, 90],
      [x + 5, 104],
      [x - 5, 104],
    ]);
    ctx.fill();
  }
  // The floor: marble in a checker running away.
  ctx.fillStyle = vertical(ctx, 250, H, [
    [0, "#8a5a58"],
    [1, "#4a2a34"],
  ]);
  ctx.fillRect(0, 250, PW, H - 250);
  ctx.fillStyle = "rgba(255, 236, 220, 0.12)";
  for (let row = 0; row < 4; row += 1) {
    const y = 252 + row * row * 5 + row * 6;
    const h = 4 + row * 4;
    for (let x = (row % 2) * 32; x < PW; x += 64) ctx.fillRect(x, y, 32, h);
  }
  pool(ctx, 512, 262, 360, 20, "#ffe0b0", 0.45);
  // Left: a print over a pink velvet sofa, a floor lamp, a palm in a brass pot.
  picture(ctx, 52, 82, 120, 74, "#7fb0b8");
  ctx.fillStyle = "#a83e6a";
  ctx.beginPath();
  ctx.roundRect(44, 196, 150, 34, 14);
  ctx.fill();
  ctx.fillStyle = "#c2527e";
  ctx.beginPath();
  ctx.roundRect(36, 222, 166, 32, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 210, 225, 0.35)";
  ctx.fillRect(46, 198, 146, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(44, 254, 6, 10);
  ctx.fillRect(188, 254, 6, 10);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(222, 266);
  ctx.lineTo(222, 150);
  ctx.stroke();
  pool(ctx, 222, 150, 70, 70, "#ffd090", 0.7);
  ctx.fillStyle = vertical(ctx, 130, 154, [
    [0, "#fff0d0"],
    [1, "#e09a5a"],
  ]);
  shape(ctx, [
    [210, 130],
    [234, 130],
    [242, 154],
    [202, 154],
  ]);
  ctx.fill();
  plant(ctx, 284, 276, 74, random);
  ctx.fillStyle = "#b08040";
  ctx.fillRect(268, 262, 32, 14);
  // Middle: key cubbies and a clock behind the desk, the chandelier over it.
  ctx.fillStyle = "#4a2632";
  ctx.fillRect(408, 92, 208, 86);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 10; c += 1) {
      const x = 414 + c * 20;
      const y = 98 + r * 20;
      ctx.fillStyle = "#2e1624";
      ctx.fillRect(x, y, 16, 16);
      if (random() < 0.55) {
        ctx.fillStyle = "#e8c070";
        ctx.fillRect(x + 6, y + 4, 4, 9);
      }
    }
  }
  ctx.fillStyle = "#f2e2c8";
  ctx.beginPath();
  ctx.arc(512, 62, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(512, 62);
  ctx.lineTo(512, 51);
  ctx.moveTo(512, 62);
  ctx.lineTo(520, 66);
  ctx.stroke();
  // The ring chandelier, on two rods.
  ctx.strokeStyle = INK;
  for (const x of [470, 554]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(512 + (x - 512) * 0.9, 34);
    ctx.stroke();
  }
  pool(ctx, 512, 38, 200, 60, "#fff0d0", 0.7);
  ctx.strokeStyle = "#fff4dc";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(512, 38, 70, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The desk: curved, its front in panels, a warm line along its foot, the bell and a lamp on it.
  ctx.fillStyle = "#2e1828";
  ctx.beginPath();
  ctx.moveTo(380, 252);
  ctx.lineTo(384, 206);
  ctx.quadraticCurveTo(512, 186, 640, 206);
  ctx.lineTo(644, 252);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 220, 180, 0.5)";
  ctx.beginPath();
  ctx.moveTo(384, 206);
  ctx.quadraticCurveTo(512, 186, 640, 206);
  ctx.lineTo(640, 210);
  ctx.quadraticCurveTo(512, 190, 384, 210);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 220, 180, 0.14)";
  ctx.lineWidth = 2;
  for (let x = 410; x < 630; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 212);
    ctx.lineTo(x, 246);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffe2b0";
  ctx.fillRect(386, 244, 254, 4);
  tableLamp(ctx, 432, 200, 16, "#f0a060");
  ctx.fillStyle = "#e8d0a0";
  ctx.beginPath();
  ctx.arc(560, 197, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(552, 197, 16, 2);
  // Right: the lift's doors under a deco fan, a brass luggage cart beside them.
  ctx.fillStyle = "#3a2232";
  ctx.fillRect(734, 100, 104, 150);
  ctx.fillStyle = "#b8905a";
  ctx.fillRect(740, 112, 44, 138);
  ctx.fillRect(788, 112, 44, 138);
  ctx.fillStyle = "rgba(255, 240, 210, 0.25)";
  ctx.fillRect(742, 114, 3, 134);
  ctx.fillRect(790, 114, 3, 134);
  ctx.strokeStyle = "#e0b870";
  ctx.lineWidth = 3;
  for (let k = 0; k < 7; k += 1) {
    const a = Math.PI + (k / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(786, 96);
    ctx.lineTo(786 + Math.cos(a) * 46, 96 + Math.sin(a) * 30);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffcf8a";
  ctx.beginPath();
  ctx.arc(786, 96, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d0a050";
  ctx.lineWidth = 3;
  ctx.strokeRect(900, 170, 70, 80);
  ctx.beginPath();
  ctx.moveTo(904, 160);
  ctx.quadraticCurveTo(935, 130, 966, 160);
  ctx.stroke();
  for (const [x, y, w, h, c] of [
    [908, 208, 30, 40, "#7a3a52"],
    [940, 222, 26, 26, "#3e5a6a"],
    [912, 186, 22, 22, "#c08a5a"],
  ] as const) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = INK;
  for (const x of [906, 964]) {
    ctx.beginPath();
    ctx.arc(x, 254, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  plant(ctx, 1000, 280, 56, random);
  // The room darker toward its ends.
  const g = ctx.createLinearGradient(0, 0, PW, 0);
  g.addColorStop(0, "rgba(30, 10, 40, 0.35)");
  g.addColorStop(0.3, "rgba(30, 10, 40, 0)");
  g.addColorStop(0.7, "rgba(30, 10, 40, 0)");
  g.addColorStop(1, "rgba(30, 10, 40, 0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, H);
  ctx.restore();
  glass(ctx, 0.05);
  frame(ctx, { bars: 1, transom: 46, colour: "#2a1834" });
}

/**
 * The landmark's atrium behind three panes: a living wall of ferns on the
 * left, the long reception desk with its warm line and an art wall of
 * coloured panels in the middle, the stair rising to the mezzanine on the
 * right, lounge chairs on the stone. Painted whole and cut in three.
 */
function atriumPanorama(ctx: Ctx, part: number) {
  const random = createRandom(2026);
  const PW = W * 3;
  ctx.save();
  ctx.translate(-part * W, 0);
  ctx.fillStyle = vertical(ctx, 0, H, [
    [0, "#3a3050"],
    [1, "#a07a7e"],
  ]);
  ctx.fillRect(0, 0, PW, H);
  // The mezzanine's edge across the top, its downlights.
  ctx.fillStyle = "#2a2034";
  ctx.fillRect(0, 56, PW, 16);
  ctx.fillStyle = "rgba(220, 235, 255, 0.5)";
  ctx.fillRect(0, 70, PW, 2);
  for (let x = 40; x < PW; x += 64) pool(ctx, x, 78, 34, 40, "#fff0dc", 0.5);
  // Left: the living wall.
  for (let i = 0; i < 220; i += 1) {
    const x = 20 + random() * 200;
    const y = 90 + random() * 150;
    ctx.fillStyle = ["#2f4a3a", "#3e5e44", "#5a7a4e", "#264036"][Math.floor(random() * 4)];
    ctx.beginPath();
    ctx.ellipse(x, y, 7 + random() * 6, 3 + random() * 2, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  pool(ctx, 120, 100, 140, 60, "#fff4e0", 0.25);
  // Middle: the art wall, five coloured panels, washed from above.
  const panels = ["#ff8fb0", "#ffc070", "#7ad0d8", "#b8a0ff", "#ff7a7a"];
  panels.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(282 + i * 42, 96 + (i % 2) * 14, 34, 86 - (i % 2) * 14);
  });
  ctx.globalAlpha = 1;
  pool(ctx, 384, 92, 150, 50, "#fff4e0", 0.45);
  // The desk: long and low, stone on a warm line.
  ctx.fillStyle = "#2a1e2c";
  ctx.fillRect(270, 206, 230, 46);
  ctx.fillStyle = "#d8c8c0";
  ctx.fillRect(266, 200, 238, 8);
  ctx.fillStyle = "#ffd9a0";
  ctx.fillRect(272, 248, 226, 3);
  pool(ctx, 384, 252, 140, 14, "#ffd9a0", 0.6);
  monitor(ctx, 330, 176, 34, "#e8f2ff", 0.15);
  monitor(ctx, 440, 176, 34, "#e8f2ff", 0.15);
  // Right: the stair, its treads lit at the nosing, the glass balustrade.
  for (let i = 0; i < 9; i += 1) {
    const x = 540 + i * 22;
    const y = 252 - i * 20;
    ctx.fillStyle = "#3a2c40";
    ctx.fillRect(x, y, 26, 252 - y + 6);
    ctx.fillStyle = "rgba(255, 220, 170, 0.75)";
    ctx.fillRect(x, y, 26, 2);
  }
  ctx.strokeStyle = "rgba(200, 230, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(540, 220);
  ctx.lineTo(738, 60);
  ctx.stroke();
  // Lounge chairs and a low table on the stone floor.
  ctx.fillStyle = vertical(ctx, 254, H, [
    [0, "#6a5258"],
    [1, "#3a2a34"],
  ]);
  ctx.fillRect(0, 254, PW, H - 254);
  for (const x of [80, 176]) {
    ctx.fillStyle = "#c86a4a";
    ctx.beginPath();
    ctx.roundRect(x - 26, 230, 52, 34, 10);
    ctx.fill();
    ctx.fillStyle = "#e08a5a";
    ctx.beginPath();
    ctx.roundRect(x - 30, 252, 60, 18, 6);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(128, 268, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  plant(ctx, 236, 286, 60, random);
  plant(ctx, 520, 286, 54, random);
  ctx.restore();
  glass(ctx, 0.06);
  frame(ctx, { bars: 1, colour: "#1e1626" });
}

/** The atlas: cells on a grid of ATLAS.cols x ATLAS.rows, painted once, deterministic. */
export function paintWindows(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(WINDOW.w * ATLAS.cols, WINDOW.h * ATLAS.rows);
  const random = createRandom(1990);
  PAINT.forEach((paint, i) => {
    ctx.save();
    ctx.translate((i % ATLAS.cols) * WINDOW.w, Math.floor(i / ATLAS.cols) * WINDOW.h);
    ctx.beginPath();
    ctx.rect(0, 0, WINDOW.w, WINDOW.h);
    ctx.clip();
    paint(ctx, random);
    ctx.restore();
  });
  return canvas;
}
