/**
 * Lithograph craft for the army's recruiting poster: the things that make
 * a canvas read as a 1940s stone-printed sheet blown up onto a billboard.
 * Cel shading in three inks (shape, light, shadow) with a keyline that
 * missed register by a hair, halftone screens in the shadows, paper fibre
 * and grain, ink that did not take, block shadows on hand-cut letters,
 * seams between the pasted sheets and their peeling corners. Everything
 * is deterministic: it takes the caller's `random`.
 */

type Ctx = CanvasRenderingContext2D;
export type Random = () => number;
export type Pt = { x: number; y: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** A shape and its bounds (for screens that only need to cover it). */
export type Shape = { path: Path2D; box: Box };

/** Three inks of one material: its flat colour, the side the light hits, the side it does not. */
export type Inks = { base: string; light: string; shadow: string };

/** How a shape is printed: where the light comes from, how wide its crescents are, the keyline, the screen. */
export type Print = {
  /** Unit vector toward the light. */
  light: Pt;
  /** Shadow crescent width (px): the shape shifted toward the light by this much leaves it. */
  shade: number;
  /** Light crescent width (px). */
  catch: number;
  key: string;
  keyWidth: number;
  /** Halftone dots in the shadow: the ink, the screen pitch (0 for none). */
  dots?: { ink: string; step: number; size: number };
  /** How far the colour plates sit off the keyline. */
  register?: Pt;
  /** A plate that missed register further: its ink shows as a fringe beside the keyline. */
  fringe?: { ink: string; offset: Pt };
};

export function boxOf(points: readonly Pt[], pad = 0): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** A closed curve through the points' midpoints, each point a control: a hand-drawn, never polygonal contour. */
export function smoothClosed(points: readonly Pt[]): Shape {
  const path = new Path2D();
  const n = points.length;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(points[n - 1], points[0]);
  path.moveTo(start.x, start.y);
  for (let i = 0; i < n; i += 1) {
    const p = points[i];
    const m = mid(p, points[(i + 1) % n]);
    path.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  path.closePath();
  return { path, box: boxOf(points) };
}

export function polygon(points: readonly Pt[]): Shape {
  const path = new Path2D();
  points.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  path.closePath();
  return { path, box: boxOf(points) };
}

/**
 * A limb from a to b, ra and rb thick at its ends, with round ends and a
 * belly on each side (`front` on the left of a->b, `back` on its right),
 * so a calf or a forearm swells where a muscle would.
 */
export function limb(a: Pt, b: Pt, ra: number, rb: number, front = 0, back = 0): Shape {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const d = { x: dx / len, y: dy / len };
  const n = { x: -d.y, y: d.x };
  const an = Math.atan2(n.y, n.x);
  const rm = (ra + rb) / 2;
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const path = new Path2D();
  path.moveTo(a.x + n.x * ra, a.y + n.y * ra);
  path.quadraticCurveTo(m.x + n.x * (rm + front), m.y + n.y * (rm + front), b.x + n.x * rb, b.y + n.y * rb);
  path.arc(b.x, b.y, rb, an, an - Math.PI, true);
  path.quadraticCurveTo(m.x - n.x * (rm + back), m.y - n.y * (rm + back), a.x - n.x * ra, a.y - n.y * ra);
  path.arc(a.x, a.y, ra, an + Math.PI, an, true);
  path.closePath();
  const r = Math.max(ra, rb) + Math.max(front, back, 0);
  return { path, box: boxOf([a, b], r) };
}

/**
 * One outline round a chain of joints (a whole leg, an arm): a radius at
 * each joint, a swell on each side of each segment (`[left, right]` of
 * the chain's direction), round ends. No seam at the joints, as a painter
 * draws a limb.
 */
export function chain(joints: readonly Pt[], radii: readonly number[], swell: readonly (readonly [number, number])[] = []): Shape {
  const n = joints.length;
  const dirs: Pt[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = joints[i + 1].x - joints[i].x;
    const dy = joints[i + 1].y - joints[i].y;
    const l = Math.hypot(dx, dy) || 1;
    dirs.push({ x: dx / l, y: dy / l });
  }
  const normal = (d: Pt): Pt => ({ x: -d.y, y: d.x });
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = normal(dirs[Math.max(0, i - 1)]);
    const b = normal(dirs[Math.min(n - 2, i)]);
    const m = { x: a.x + b.x, y: a.y + b.y };
    const ml = Math.hypot(m.x, m.y) || 1;
    const nn = { x: m.x / ml, y: m.y / ml };
    const j = joints[i];
    left.push({ x: j.x + nn.x * radii[i], y: j.y + nn.y * radii[i] });
    right.push({ x: j.x - nn.x * radii[i], y: j.y - nn.y * radii[i] });
    if (i < n - 1) {
      const sn = normal(dirs[i]);
      const mid = { x: (j.x + joints[i + 1].x) / 2, y: (j.y + joints[i + 1].y) / 2 };
      const rm = (radii[i] + radii[i + 1]) / 2;
      const [sl, sr] = swell[i] ?? [0, 0];
      left.push({ x: mid.x + sn.x * (rm + sl), y: mid.y + sn.y * (rm + sl) });
      right.push({ x: mid.x - sn.x * (rm + sr), y: mid.y - sn.y * (rm + sr) });
    }
  }
  const d0 = dirs[0];
  const dn = dirs[n - 2];
  const start = { x: joints[0].x - d0.x * radii[0] * 1.2, y: joints[0].y - d0.y * radii[0] * 1.2 };
  const end = { x: joints[n - 1].x + dn.x * radii[n - 1] * 1.2, y: joints[n - 1].y + dn.y * radii[n - 1] * 1.2 };
  return smoothClosed([start, ...left, end, ...right.reverse()]);
}

/**
 * Prints a shape whose path overlaps itself (a cloud bank of many
 * ellipses): the crescents are cut on layers with destination-out, so
 * the overlaps print as one solid.
 */
export function printUnion(ctx: Ctx, shape: Shape, inks: Inks, light: Pt, shade: number, lit: number): void {
  const { x0, y0, x1, y1 } = shape.box;
  const w = Math.ceil(x1 - x0);
  const h = Math.ceil(y1 - y0);
  const layer = (color: string, cut: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const l = c.getContext("2d");
    if (!l) return c;
    l.translate(-x0, -y0);
    l.fillStyle = color;
    l.fill(shape.path);
    if (cut !== 0) {
      l.globalCompositeOperation = "destination-out";
      l.translate(light.x * cut, light.y * cut);
      l.fill(shape.path);
    }
    return c;
  };
  ctx.drawImage(layer(inks.base, 0), x0, y0);
  if (shade > 0) ctx.drawImage(layer(inks.shadow, shade), x0, y0);
  if (lit > 0) ctx.drawImage(layer(inks.light, -lit), x0, y0);
}

/** The part of `shape` that the same shape shifted by (dx, dy) does not cover: a crescent on the far side. */
function clipCrescent(ctx: Ctx, shape: Shape, dx: number, dy: number): void {
  ctx.clip(shape.path);
  const both = new Path2D();
  both.addPath(shape.path);
  both.addPath(shape.path, new DOMMatrix().translate(dx, dy));
  ctx.clip(both, "evenodd");
}

/**
 * Prints one shape in three inks: keyline, flat colour (a hair off
 * register), the shadow crescent away from the light with its halftone
 * screen, and the light crescent on the lit edge.
 */
export function printShape(ctx: Ctx, shape: Shape, inks: Inks, print: Print): void {
  const { light: L, shade, key, keyWidth } = print;
  const reg = print.register ?? { x: 0, y: 0 };
  const { x0, y0, x1, y1 } = shape.box;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (print.fringe) {
    ctx.save();
    ctx.translate(print.fringe.offset.x, print.fringe.offset.y);
    ctx.strokeStyle = print.fringe.ink;
    ctx.lineWidth = keyWidth * 0.9;
    ctx.stroke(shape.path);
    ctx.restore();
  }
  ctx.strokeStyle = key;
  ctx.lineWidth = keyWidth;
  ctx.stroke(shape.path);
  ctx.translate(reg.x, reg.y);
  ctx.fillStyle = inks.base;
  ctx.fill(shape.path);
  if (shade > 0) {
    ctx.save();
    clipCrescent(ctx, shape, L.x * shade, L.y * shade);
    ctx.fillStyle = inks.shadow;
    ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
    if (print.dots && print.dots.step > 0) {
      const { ink, step, size } = print.dots;
      screen(ctx, { x0: x0 - step, y0: y0 - step, x1: x1 + step, y1: y1 + step }, step, Math.PI / 4, () => size, ink);
    }
    ctx.restore();
  }
  if (print.catch > 0) {
    ctx.save();
    clipCrescent(ctx, shape, -L.x * print.catch, -L.y * print.catch);
    ctx.fillStyle = inks.light;
    ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
    ctx.restore();
  }
  ctx.restore();
}

/** A halftone screen over a box (and whatever clip is set): dots on a turned grid, sized by `value` (0..1). */
export function screen(ctx: Ctx, box: Box, step: number, angle: number, value: (x: number, y: number) => number, ink: string): void {
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const reach = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2 + step;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  ctx.fillStyle = ink;
  ctx.beginPath();
  for (let v = -reach; v <= reach; v += step) {
    for (let u = -reach; u <= reach; u += step) {
      const x = cx + u * c - v * s;
      const y = cy + u * s + v * c;
      if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) continue;
      const k = value(x, y);
      if (k <= 0.04) continue;
      const r = Math.min(1, k) * step * 0.6;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

/** The stock: its colour and fibre. */
export function stock(ctx: Ctx, w: number, h: number, color: string, random: Random): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  const n = Math.round((w * h) / 700);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < n; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const a = random() * Math.PI;
    const l = 2 + random() * 7;
    ctx.strokeStyle = random() < 0.5 ? "rgba(255, 252, 238, 0.08)" : "rgba(70, 45, 25, 0.07)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

/** Specks of paper where the ink did not take, inside a box (call it right after that ink went down). */
export function inkVoids(ctx: Ctx, box: Box, paperColor: string, random: Random, density = 0.5, size = 2.4): void {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  ctx.save();
  ctx.fillStyle = paperColor;
  const n = Math.round(((w * h) / 150) * density);
  for (let i = 0; i < n; i += 1) {
    const r = size * (0.3 + random() * random() * 1.7);
    ctx.globalAlpha = 0.45 + random() * 0.5;
    ctx.beginPath();
    ctx.ellipse(box.x0 + random() * w, box.y0 + random() * h, r * (1 + random()), r, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Grain: every pixel nudged lighter or darker, a little more in the darks (the stone's tooth). */
export function grain(ctx: Ctx, w: number, h: number, random: Random, amount = 12): void {
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dark = 1.3 - (data[i] + data[i + 1] + data[i + 2]) / 1275;
    const n = (random() - 0.5) * amount * dark;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Hand-cut display letters: a block shadow stepped down and to the right
 * in one ink, a keyline in another, the face in a third, then the paper
 * showing through where the face did not take. `draw` sets the font and
 * places the text (fillText / strokeText at the origin it chooses).
 */
export function blockLetters(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  inks: { face: string; key: string; block: string },
  depth: number,
  keyWidth: number,
  box: Box,
  paperColor: string,
  random: Random,
): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.fillStyle = inks.block;
  ctx.strokeStyle = inks.block;
  ctx.lineWidth = keyWidth;
  for (let i = depth; i > 0; i -= 1) {
    ctx.fillText(text, x + i, y + i);
    ctx.strokeText(text, x + i, y + i);
  }
  ctx.strokeStyle = inks.key;
  ctx.lineWidth = keyWidth;
  ctx.strokeText(text, x, y);
  // The face on its own plate, so the voids land on the letters only.
  const w = Math.ceil(box.x1 - box.x0);
  const h = Math.ceil(box.y1 - box.y0);
  const plate = document.createElement("canvas");
  plate.width = w;
  plate.height = h;
  const p = plate.getContext("2d");
  if (p) {
    // The plate is in the caller's current frame, offset to the box.
    p.font = ctx.font;
    p.textAlign = ctx.textAlign;
    p.textBaseline = ctx.textBaseline;
    p.fillStyle = inks.face;
    p.fillText(text, x + 1.5 - box.x0, y - 1 - box.y0);
    p.globalCompositeOperation = "source-atop";
    inkVoids(p, { x0: 0, y0: 0, x1: w, y1: h }, paperColor, random, 0.1, 2);
    ctx.drawImage(plate, box.x0, box.y0);
  }
  ctx.restore();
}

/** Text with letterspacing, from a left origin; returns its width. */
export function spaced(ctx: Ctx, text: string, x: number, y: number, tracking: number, mode: "fill" | "stroke" = "fill"): number {
  let at = x;
  const saved = ctx.textAlign;
  ctx.textAlign = "left";
  for (const c of text) {
    if (mode === "fill") ctx.fillText(c, at, y);
    else ctx.strokeText(c, at, y);
    at += ctx.measureText(c).width + tracking;
  }
  ctx.textAlign = saved;
  return at - x - tracking;
}

export function spacedWidth(ctx: Ctx, text: string, tracking: number): number {
  let w = 0;
  for (const c of text) w += ctx.measureText(c).width + tracking;
  return w - tracking;
}

/** A ragged line from a to b: a tear's path. */
export function ragged(a: Pt, b: Pt, random: Random, rough = 8, step = 7): Pt[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(2, Math.round(length / step));
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  const points: Pt[] = [];
  let drift = 0;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    drift = (drift + (random() - 0.5) * rough * 0.6) * 0.85;
    const off = i === 0 || i === n ? 0 : drift + (random() - 0.5) * rough * 0.5;
    points.push({ x: a.x + (b.x - a.x) * t + nx * off, y: a.y + (b.y - a.y) * t + ny * off });
  }
  return points;
}

/** Paste wrinkles: soft ridges where a sheet dried over a bubble of glue. */
export function wrinkles(ctx: Ctx, w: number, h: number, random: Random, count = 8): void {
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < count; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const a = random() * Math.PI;
    const l = 20 + random() * 70;
    const bend = (random() - 0.5) * l * 0.6;
    const ax = Math.cos(a);
    const ay = Math.sin(a);
    for (const [off, style, width] of [
      [2.5, "rgba(255, 248, 235, 0.08)", 6],
      [1.2, "rgba(255, 248, 235, 0.14)", 2],
      [-1.8, "rgba(30, 12, 30, 0.14)", 3],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x - ax * l - ay * off, y - ay * l + ax * off);
      ctx.quadraticCurveTo(x - ay * (bend + off), y + ax * (bend + off), x + ax * l - ay * off, y + ay * l + ax * off);
      ctx.stroke();
    }
  }
  ctx.restore();
}
