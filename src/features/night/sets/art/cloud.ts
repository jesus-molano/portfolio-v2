import { createRandom } from "@/features/hero/scene/world";
import { fonts, makeCanvas } from "../../artCanvas";

/**
 * The Cloud District trivision: three client faces, each a few words and
 * one big graphic, the client's name in our type and in its own colours
 * (no logo files). Rows top to bottom: Naturgy, Pangea, Telpark. Plus the
 * nameplate and the café's neon script.
 */
export const FACE = { w: 2048, h: 852 } as const;
export const CLOUD_ATLAS = { w: 2048, h: FACE.h * 3 } as const;

type Face = { title: string; lines: readonly string[] };

function mono(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, maxWidth: number) {
  ctx.font = `700 ${size}px ${fonts.mono()}`;
  const width = ctx.measureText(text).width;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.min(1, maxWidth / width), 1);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * The clients' own colours, as published (Naturgy's navy and orange,
 * Telpark's orange). Names in our type: no logo files are copied here.
 * Pangea, a travel agency, shows the world as one supercontinent in our
 * palette until its colours are confirmed.
 */
const BRAND = {
  naturgyNavy: "#004571",
  naturgyDeep: "#00284a",
  naturgyOrange: "#fd7e14",
  telparkOrange: "#ff9903",
  telparkBlack: "#141414",
} as const;

function serifTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string, maxWidth: number) {
  ctx.font = `700 ${size}px ${fonts.serif()}`;
  const width = ctx.measureText(text).width;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.min(1, maxWidth / width), 1);
  ctx.fillStyle = colour;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Naturgy, an energy supplier: dashboards of the grid, a kWh gauge into the red, pylons at dusk. */
function naturgy(ctx: CanvasRenderingContext2D, face: Face) {
  const { w, h } = FACE;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, BRAND.naturgyDeep);
  sky.addColorStop(0.6, BRAND.naturgyNavy);
  sky.addColorStop(0.86, "#3d5f86");
  sky.addColorStop(1, BRAND.naturgyOrange);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // The grid at dusk: town lights on the horizon, pylons and their wires.
  ctx.fillStyle = "#001c35";
  ctx.fillRect(0, h - 70, w, 70);
  for (let x = 20; x < w; x += 23) {
    ctx.fillStyle = (x * 7) % 3 === 0 ? "#ffd29a" : "#ffb25c";
    ctx.fillRect(x, h - 76 - ((x * 13) % 9), 4, 4);
  }
  const pylons = [80, 520, 1000, 1880];
  ctx.strokeStyle = "#001c35";
  for (const x of pylons) {
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x - 70, h - 70);
    ctx.lineTo(x, h - 470);
    ctx.lineTo(x + 70, h - 70);
    ctx.moveTo(x - 110, h - 410);
    ctx.lineTo(x + 110, h - 410);
    ctx.moveTo(x - 80, h - 330);
    ctx.lineTo(x + 80, h - 330);
    ctx.stroke();
    ctx.lineWidth = 5;
    for (let k = 0; k < 4; k += 1) {
      ctx.beginPath();
      ctx.moveTo(x - 60 + k * 10, h - 70 - k * 95);
      ctx.lineTo(x + 50 - k * 10, h - 160 - k * 95);
      ctx.stroke();
    }
  }
  ctx.lineWidth = 3;
  for (const dy of [-410, -330]) {
    ctx.beginPath();
    for (let i = 0; i < pylons.length - 1; i += 1) {
      const a = pylons[i] + 110;
      const b = pylons[i + 1] - 110;
      ctx.moveTo(a, h + dy);
      ctx.quadraticCurveTo((a + b) / 2, h + dy + 60, b, h + dy);
    }
    ctx.stroke();
  }
  // The gauge: a navy dial, cream ticks, the needle up in the orange.
  const cx = 1460;
  const cy = 560;
  const r = 330;
  ctx.fillStyle = "#001c35";
  ctx.beginPath();
  ctx.arc(cx, cy, r + 30, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 34;
  ctx.strokeStyle = "#0b3a63";
  ctx.beginPath();
  ctx.arc(cx, cy, r - 30, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = BRAND.naturgyOrange;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 30, Math.PI * 1.72, 0);
  ctx.stroke();
  ctx.strokeStyle = "#f3ead8";
  ctx.fillStyle = "#f3ead8";
  ctx.font = `700 34px ${fonts.mono()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 20; i += 1) {
    const a = Math.PI + (i / 20) * Math.PI;
    const major = i % 5 === 0;
    ctx.lineWidth = major ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 70), cy + Math.sin(a) * (r - 70));
    ctx.lineTo(cx + Math.cos(a) * (r - (major ? 110 : 92)), cy + Math.sin(a) * (r - (major ? 110 : 92)));
    ctx.stroke();
    if (major) ctx.fillText(String(i * 5), cx + Math.cos(a) * (r - 150), cy + Math.sin(a) * (r - 150));
  }
  ctx.font = `700 44px ${fonts.mono()}`;
  ctx.fillText("kW·h", cx, cy - 110);
  const needle = Math.PI + 0.86 * Math.PI;
  ctx.save();
  ctx.shadowColor = BRAND.naturgyOrange;
  ctx.shadowBlur = 30;
  ctx.strokeStyle = BRAND.naturgyOrange;
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needle) * (r - 90), cy + Math.sin(needle) * (r - 90));
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#f3ead8";
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();
  // The client's name in our type, in its colours, then the product and the stack.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = BRAND.naturgyOrange;
  ctx.beginPath();
  ctx.arc(108, 128, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 110px ${fonts.body()}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(face.title.toLowerCase(), 150, 166);
  const [product, stack] = face.lines;
  const [first, ...rest] = product.split(" & ");
  serifTitle(ctx, first, 90, 340, 150, "#f6e8d3", 920);
  if (rest.length) serifTitle(ctx, `& ${rest.join(" & ")}`, 90, 490, 150, "#f6e8d3", 920);
  mono(ctx, stack, 96, 590, 54, BRAND.naturgyOrange, 880);
}

/** Pangea, a travel agency: the world as one supercontinent of pieces, routes flown across it. */
function pangea(ctx: CanvasRenderingContext2D, face: Face, pieces: readonly string[]) {
  const { w, h } = FACE;
  const sea = ctx.createRadialGradient(1400, 420, 60, 1400, 420, 1100);
  sea.addColorStop(0, "#17507a");
  sea.addColorStop(1, "#0a2240");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);
  // A navigator's graticule.
  ctx.strokeStyle = "rgba(214, 233, 255, 0.12)";
  ctx.lineWidth = 2;
  for (let x = 80; x < w; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 60; y < h; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // The supercontinent: one organic outline, cut into five pieces; the last is missing.
  const cx = 1440;
  const cy = 430;
  const outline = (a: number) =>
    300 * (1 + 0.16 * Math.sin(3 * a + 0.6) + 0.09 * Math.cos(5 * a) + 0.05 * Math.sin(9 * a + 1.3));
  const cuts = [-2.3, -1.0, 0.2, 1.3, 2.4];
  const colours = ["#f2c38a", "#ef8f6e", "#f6e2b6", "#d9a7d8", "#9fd4b8"];
  cuts.forEach((from, i) => {
    const to = i === cuts.length - 1 ? cuts[0] + Math.PI * 2 : cuts[i + 1];
    const path = new Path2D();
    path.moveTo(cx, cy);
    for (let a = from; a <= to + 1e-6; a += 0.02) path.lineTo(cx + Math.cos(a) * outline(a) * 1.45, cy + Math.sin(a) * outline(a));
    path.closePath();
    if (i === cuts.length - 1) {
      ctx.save();
      ctx.setLineDash([24, 18]);
      ctx.strokeStyle = "#f6e8d3";
      ctx.lineWidth = 7;
      ctx.stroke(path);
      ctx.restore();
    } else {
      ctx.fillStyle = colours[i];
      ctx.fill(path);
      ctx.strokeStyle = "#0a2240";
      ctx.lineWidth = 8;
      ctx.stroke(path);
    }
    // A knob on each cut, so the pieces read as a jigsaw.
    const mid = from;
    const kx = cx + Math.cos(mid) * outline(mid) * 0.75;
    const ky = cy + Math.sin(mid) * outline(mid) * 0.5;
    ctx.fillStyle = colours[i];
    if (i !== cuts.length - 1) {
      ctx.beginPath();
      ctx.arc(kx, ky, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    // The destination's name on its piece.
    const la = (from + to) / 2;
    const lx = cx + Math.cos(la) * outline(la) * 0.85;
    const ly = cy + Math.sin(la) * outline(la) * 0.62;
    ctx.font = `italic 600 40px ${fonts.serif()}`;
    ctx.textAlign = "center";
    ctx.fillStyle = i === cuts.length - 1 ? "#f6e8d3" : "#1c1430";
    ctx.fillText(pieces[i] ?? "", lx, ly + 12);
  });
  // Routes flown across the world, dotted, each ending on a pin.
  ctx.save();
  ctx.setLineDash([4, 16]);
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#ffffff";
  const routes: [number, number, number, number][] = [
    [1090, 330, 1700, 260],
    [1180, 560, 1790, 520],
    [1300, 190, 1560, 640],
  ];
  for (const [x0, y0, x1, y1] of routes) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 160, x1, y1);
    ctx.stroke();
  }
  ctx.restore();
  for (const [, , x1, y1] of routes) {
    ctx.fillStyle = "#ff5a3c";
    ctx.beginPath();
    ctx.arc(x1, y1 - 18, 16, Math.PI, 0);
    ctx.lineTo(x1, y1 + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.textAlign = "left";
  serifTitle(ctx, face.title, 90, 300, 220, "#f6e8d3", 820);
  // The brand's own full name: PANGEA The Travel Store.
  mono(ctx, "THE TRAVEL STORE", 100, 362, 34, "#f6e8d3", 600);
  ctx.font = `italic 600 64px ${fonts.serif()}`;
  ctx.fillStyle = "#ffd2c2";
  const line = face.lines[0];
  const lw = ctx.measureText(line).width;
  ctx.save();
  ctx.translate(96, 452);
  ctx.scale(Math.min(1, 820 / lw), 1);
  ctx.fillText(line, 0, 0);
  ctx.restore();
  mono(ctx, face.lines[1], 96, 560, 38, "#9fd4ff", 820);
}

/** Telpark, parking reservations: a garage ramp in one-point perspective, in the brand's orange on black. */
function telpark(ctx: CanvasRenderingContext2D, face: Face) {
  const { w, h } = FACE;
  ctx.fillStyle = BRAND.telparkBlack;
  ctx.fillRect(0, 0, w, h);
  const vx = 1500;
  const vy = 400;
  // Floor and ceiling converging on the ramp's mouth.
  const floor = ctx.createLinearGradient(0, vy, 0, h);
  floor.addColorStop(0, "#1f1f22");
  floor.addColorStop(1, "#38363a");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(vx - 90, vy + 50);
  ctx.lineTo(vx + 90, vy + 50);
  ctx.lineTo(w, h);
  ctx.lineTo(980, h);
  ctx.closePath();
  ctx.fill();
  // Ceiling light strips.
  for (let k = 0; k < 7; k += 1) {
    const s = 1 - k * 0.13;
    ctx.fillStyle = `rgba(255, 250, 240, ${0.9 - k * 0.1})`;
    ctx.fillRect(vx - 260 * s, vy - 330 * s, 520 * s, 10 * s + 2);
  }
  // Pillars with orange bands, both sides, receding.
  for (let k = 0; k < 6; k += 1) {
    const s = 1 - k * 0.16;
    for (const side of [-1, 1]) {
      const px = vx + side * 470 * s - (side < 0 ? 64 * s : 0);
      ctx.fillStyle = "#2b2a2e";
      ctx.fillRect(px, vy - 360 * s, 64 * s, 820 * s);
      ctx.fillStyle = BRAND.telparkOrange;
      ctx.fillRect(px, vy + 120 * s, 64 * s, 46 * s);
    }
  }
  // Bay lines and the lane's arrows, in orange.
  ctx.strokeStyle = BRAND.telparkOrange;
  ctx.lineWidth = 6;
  for (let i = -5; i <= 5; i += 1) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(vx + i * 14, vy + 60);
    ctx.lineTo(vx + i * 150, h);
    ctx.stroke();
  }
  ctx.fillStyle = BRAND.telparkOrange;
  for (const [y, s] of [
    [700, 1],
    [560, 0.6],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(vx, y - 70 * s);
    ctx.lineTo(vx + 40 * s, y);
    ctx.lineTo(vx - 40 * s, y);
    ctx.closePath();
    ctx.fill();
  }
  // Headlights coming up the ramp.
  for (const dx of [-55, 55]) {
    const g = ctx.createRadialGradient(vx + dx, vy + 90, 0, vx + dx, vy + 90, 120);
    g.addColorStop(0, "#fffaf0");
    g.addColorStop(1, "rgba(255, 250, 240, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(vx + dx - 120, vy - 30, 240, 240);
  }
  // A P sign in the brand's orange.
  ctx.fillStyle = BRAND.telparkOrange;
  ctx.beginPath();
  ctx.roundRect(1790, 80, 190, 190, 30);
  ctx.fill();
  ctx.fillStyle = BRAND.telparkBlack;
  ctx.font = `800 170px ${fonts.display()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("P", 1885, 185);
  // The name in our type, in its colours, then the line and the product.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 190px ${fonts.body()}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(face.title.toLowerCase(), 84, 290);
  ctx.font = `italic 600 64px ${fonts.serif()}`;
  ctx.fillStyle = "#ffd29a";
  const line = face.lines[0];
  const lw = ctx.measureText(line).width;
  ctx.save();
  ctx.translate(92, 420);
  ctx.scale(Math.min(1, 820 / lw), 1);
  ctx.fillText(line, 0, 0);
  ctx.restore();
  mono(ctx, face.lines[1], 92, 540, 56, BRAND.telparkOrange, 820);
}

export function paintTrivision(faces: readonly Face[], pieces: readonly string[]): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(CLOUD_ATLAS.w, CLOUD_ATLAS.h);
  const painters = [
    (c: CanvasRenderingContext2D) => naturgy(c, faces[0]),
    (c: CanvasRenderingContext2D) => pangea(c, faces[1], pieces),
    (c: CanvasRenderingContext2D) => telpark(c, faces[2]),
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

/** The nameplate under the catwalk, cream with ink type, and the café's script, in two rows. */
export function paintCloudSigns(nameplate: string, cafe: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(2048, 512);
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
  ctx.clearRect(0, 256, 2048, 256);
  ctx.font = `400 200px ${fonts.script()}`;
  ctx.fillStyle = "#ffe6f4";
  ctx.shadowColor = "#ff4fa8";
  ctx.shadowBlur = 36;
  ctx.fillText(cafe, 1024, 384);
  return canvas;
}
