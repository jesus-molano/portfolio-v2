/**
 * Print craft for the paper on the night's walls: the things that make a
 * painted rectangle read as a printed, pasted, rained-on sheet. Paper
 * fibre and grain, halftone screens, plates printed slightly off register,
 * wood type that did not take all its ink, folds, paste wrinkles, staples,
 * rain stains and torn edges with the white core of the paper showing.
 * Everything is deterministic (it takes the caller's `random`).
 */

type Ctx = CanvasRenderingContext2D;
export type Random = () => number;

/** A plain sheet: the stock's colour, its fibre, a slightly darker rim where the paste soaked in. */
export function paper(ctx: Ctx, w: number, h: number, color: string, random: Random, soak = 0.16): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  // Fibre: short hairlines in both directions, lighter and darker than the stock.
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const a = random() * Math.PI;
    const l = 2 + random() * 7;
    ctx.strokeStyle = random() < 0.5 ? "rgba(255, 255, 255, 0.07)" : "rgba(60, 30, 20, 0.07)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  edgeSoak(ctx, w, h, soak);
}

/** The rim of a pasted sheet, darker where the glue soaked through. */
export function edgeSoak(ctx: Ctx, w: number, h: number, amount: number): void {
  if (amount <= 0) return;
  const r = Math.min(w, h);
  const sides: [number, number, number, number][] = [
    [0, 0, 0, r * 0.08],
    [0, h, 0, h - r * 0.08],
    [0, 0, r * 0.08, 0],
    [w, 0, w - r * 0.08, 0],
  ];
  for (const [x0, y0, x1, y1] of sides) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(70, 40, 30, ${amount})`);
    g.addColorStop(1, "rgba(70, 40, 30, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * A halftone screen over the current clip: dots on a grid turned by
 * `angle`, each sized by `value(x, y)` (0 none, 1 touching).
 */
export function halftone(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  step: number,
  angle: number,
  value: (x: number, y: number) => number,
  color: string,
): void {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const reach = Math.hypot(x1 - x0, y1 - y0) / 2 + step;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  ctx.fillStyle = color;
  for (let v = -reach; v <= reach; v += step) {
    for (let u = -reach; u <= reach; u += step) {
      const x = cx + u * c - v * s;
      const y = cy + u * s + v * c;
      if (x < x0 - step || x > x1 + step || y < y0 - step || y > y1 + step) continue;
      const k = value(x, y);
      if (k <= 0.03) continue;
      ctx.beginPath();
      ctx.arc(x, y, Math.min(1, k) * step * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Ink that did not take everywhere: specks of paper showing through what
 * was just printed (wood type, rubber stamps, a worn screen). Works on the
 * pixels inside the rectangle, so call it right after the ink went down
 * and before anything else is printed over it.
 */
export function inkVoids(ctx: Ctx, x: number, y: number, w: number, h: number, paperColor: string, random: Random, density = 0.5, size = 2.2): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = paperColor;
  const n = Math.round(((w * h) / 140) * density);
  for (let i = 0; i < n; i += 1) {
    const px = x + random() * w;
    const py = y + random() * h;
    const r = size * (0.3 + random() * random() * 1.6);
    ctx.globalAlpha = 0.5 + random() * 0.5;
    ctx.beginPath();
    ctx.ellipse(px, py, r * (1 + random()), r, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Grain over a cell: every pixel nudged a little, lighter or darker. */
export function grain(ctx: Ctx, x: number, y: number, w: number, h: number, random: Random, amount = 10): void {
  const image = ctx.getImageData(x, y, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const n = (random() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(image, x, y);
}

/** A fold: a crease that caught the light on one side and the shadow on the other. */
export function crease(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, random: Random, strength = 1): void {
  const steps = 12;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push([x0 + (x1 - x0) * t + (random() - 0.5) * 3, y0 + (y1 - y0) * t + (random() - 0.5) * 3]);
  }
  const nx = -(y1 - y0) / Math.hypot(x1 - x0, y1 - y0);
  const ny = (x1 - x0) / Math.hypot(x1 - x0, y1 - y0);
  const line = (dx: number, dy: number, style: string, width: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
    ctx.stroke();
  };
  line(nx * 2, ny * 2, `rgba(255, 250, 240, ${0.22 * strength})`, 3);
  line(-nx * 1.5, -ny * 1.5, `rgba(30, 10, 20, ${0.28 * strength})`, 2);
}

/** Paste wrinkles: soft short ridges where the sheet dried over a bubble of glue. */
export function wrinkles(ctx: Ctx, w: number, h: number, random: Random, count = 6): void {
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < count; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const a = random() * Math.PI;
    const l = (0.04 + random() * 0.1) * Math.min(w, h) + 6;
    const bend = (random() - 0.5) * l * 0.6;
    const ax = Math.cos(a);
    const ay = Math.sin(a);
    for (const [off, style, width] of [
      [2.5, "rgba(255, 248, 235, 0.07)", 6],
      [1.2, "rgba(255, 248, 235, 0.12)", 2],
      [-1.8, "rgba(20, 8, 20, 0.12)", 3],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x - ax * l + -ay * off, y - ay * l + ax * off);
      ctx.quadraticCurveTo(x + -ay * (bend + off), y + ax * (bend + off), x + ax * l + -ay * off, y + ay * l + ax * off);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Rain: a tide mark along the foot of the sheet and a few runs down from it. */
export function rainStain(ctx: Ctx, w: number, h: number, random: Random, depth = 0.22): void {
  const top = h * (1 - depth);
  const g = ctx.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, "rgba(120, 80, 40, 0)");
  g.addColorStop(0.35, "rgba(120, 80, 40, 0.1)");
  g.addColorStop(1, "rgba(80, 50, 30, 0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h - top);
  // The tide mark: a wavering darker line.
  ctx.strokeStyle = "rgba(90, 55, 30, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) {
    const y = top + h * 0.05 + Math.sin(x * 0.03 + random()) * 4 + random() * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i < Math.round(w / 60); i += 1) {
    const x = random() * w;
    const y = top + random() * h * 0.1;
    const l = h * (0.05 + random() * 0.2);
    const run = ctx.createLinearGradient(0, y, 0, y + l);
    run.addColorStop(0, "rgba(90, 55, 30, 0.16)");
    run.addColorStop(1, "rgba(90, 55, 30, 0)");
    ctx.fillStyle = run;
    ctx.fillRect(x, y, 2 + random() * 3, l);
  }
}

/** Abrasion: patches where the ink rubbed off and the stock shows. */
export function scuffs(ctx: Ctx, w: number, h: number, paperColor: string, random: Random, count = 14): void {
  ctx.save();
  ctx.fillStyle = paperColor;
  for (let i = 0; i < count; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const r = 2 + random() * 9;
    for (let k = 0; k < 7; k += 1) {
      ctx.globalAlpha = 0.25 + random() * 0.4;
      ctx.beginPath();
      ctx.ellipse(x + (random() - 0.5) * r * 2, y + (random() - 0.5) * r, r * random(), r * 0.4 * random() + 0.5, random(), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A staple: a short bright bar with the dark holes at each end and its shadow. */
export function staple(ctx: Ctx, x: number, y: number, angle: number, length = 16): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(20, 10, 20, 0.45)";
  ctx.fillRect(-length / 2 + 1, 1.5, length, 3);
  ctx.fillStyle = "#c9c4cf";
  ctx.fillRect(-length / 2, -1.5, length, 3);
  ctx.fillStyle = "#f4f1f6";
  ctx.fillRect(-length / 2 + 2, -1.5, length - 4, 1);
  ctx.fillStyle = "#2a2230";
  ctx.fillRect(-length / 2 - 1, -1.5, 2, 3);
  ctx.fillRect(length / 2 - 1, -1.5, 2, 3);
  ctx.restore();
}

/** A ragged line from a to b: a tear's path, with its own small zigzag and drift. */
export function raggedLine(x0: number, y0: number, x1: number, y1: number, random: Random, roughness = 10, step = 7): [number, number][] {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.round(length / step));
  const nx = -(y1 - y0) / length;
  const ny = (x1 - x0) / length;
  const points: [number, number][] = [];
  let drift = 0;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    drift += (random() - 0.5) * roughness * 0.6;
    drift *= 0.85;
    const jag = (random() - 0.5) * roughness * 0.5;
    const off = i === 0 || i === n ? 0 : drift + jag;
    points.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off]);
  }
  return points;
}

/**
 * Tears away the part of the cell on one side of a ragged edge (the
 * polygon `away`, closed on the cell's border), then draws the torn
 * paper's white core along the edge, the way a ripped poster shows it.
 */
export function tearAway(ctx: Ctx, edge: [number, number][], away: [number, number][], random: Random, core = "rgba(236, 228, 212, 0.85)"): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  [...edge, ...away].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The white core: wider in places, where the tear split the sheet's layers.
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.strokeStyle = core;
  ctx.lineCap = "round";
  for (let i = 1; i < edge.length; i += 1) {
    ctx.lineWidth = 2 + random() * random() * 6;
    ctx.beginPath();
    ctx.moveTo(edge[i - 1][0], edge[i - 1][1]);
    ctx.lineTo(edge[i][0], edge[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}

/** A printer's registration mark: a circle with its cross hairs. */
export function registrationMark(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.moveTo(x - r * 1.6, y);
  ctx.lineTo(x + r * 1.6, y);
  ctx.moveTo(x, y - r * 1.6);
  ctx.lineTo(x, y + r * 1.6);
  ctx.stroke();
  ctx.restore();
}

/** Letterspaced text: `align` places the whole run like fillText would. */
export function tracked(ctx: Ctx, text: string, x: number, y: number, tracking: number, align: "left" | "center" | "right" = "center"): number {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let at = align === "left" ? x : align === "right" ? x - total : x - total / 2;
  const saved = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, at, y);
    at += widths[i] + tracking;
  });
  ctx.textAlign = saved;
  return total;
}

/** The width a letterspaced run takes. */
export function trackedWidth(ctx: Ctx, text: string, tracking: number): number {
  const chars = [...text];
  return chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) + tracking * (chars.length - 1);
}

/** The largest size (at most `size`) at which a letterspaced run fits `width`. */
export function fitTracked(ctx: Ctx, text: string, font: (size: number) => string, size: number, width: number, tracking: (size: number) => number): number {
  ctx.font = font(size);
  const w = trackedWidth(ctx, text, tracking(size));
  const fitted = w > width ? (size * width) / w : size;
  ctx.font = font(fitted);
  return fitted;
}

/** Text along an arc, centred on the angle `mid` (radians, 0 = right, clockwise), reading clockwise. */
export function arcText(ctx: Ctx, text: string, cx: number, cy: number, r: number, mid: number, tracking = 0): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = mid - total / r / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((c, i) => {
    const half = widths[i] / r / 2;
    a += half;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    a += half;
  });
  ctx.restore();
}

/** Text along the lower part of an arc, reading left to right (counter-clockwise from the viewer's left). */
export function arcTextBelow(ctx: Ctx, text: string, cx: number, cy: number, r: number, tracking = 0): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = Math.PI / 2 + total / r / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((c, i) => {
    const half = widths[i] / r / 2;
    a -= half;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    a -= half;
  });
  ctx.restore();
}

/** Wraps words into lines no wider than `width` in the current font. */
export function wrap(ctx: Ctx, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}
