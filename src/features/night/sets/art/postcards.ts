/**
 * Pangea's destination cards: five painted "photos" in warm, slightly
 * faded travel tones, one per continent, each drawn into a box. Our own
 * drawing; no photograph is copied.
 */

export type Box = { x: number; y: number; w: number; h: number };

function sky(ctx: CanvasRenderingContext2D, b: Box, stops: [number, string][], until = 1) {
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h * until);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

function ridge(ctx: CanvasRenderingContext2D, b: Box, points: [number, number][], colour: string | CanvasGradient) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.h);
  for (const [u, v] of points) ctx.lineTo(b.x + u * b.w, b.y + v * b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.closePath();
  ctx.fill();
}

function palm(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, lean: number, colour: string) {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = "round";
  ctx.lineWidth = height * 0.03;
  const tx = x + lean * height;
  const ty = y - height;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * height * 0.2, y - height * 0.6, tx, ty);
  ctx.stroke();
  for (let k = 0; k < 7; k += 1) {
    const a = -Math.PI + (k / 6) * Math.PI + (k % 2 ? 0.15 : -0.1);
    const len = height * (0.45 + (k % 3) * 0.06);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.35 + len * 0.3;
    ctx.lineWidth = height * 0.016;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo((tx + ex) / 2, Math.min(ty, ey) - len * 0.18, ex, ey);
    ctx.stroke();
  }
}

/** Oceania: an overwater pier at sunset, palms, the sun low over a turquoise lagoon at the pier's end (`sunAt`, a share of the box's width). */
export function lagoon(ctx: CanvasRenderingContext2D, b: Box, sunAt = 0.42) {
  const horizon = b.y + b.h * 0.5;
  sky(ctx, b, [
    [0, "#d9a7a0"],
    [0.3, "#efc3a0"],
    [0.5, "#f6d9b0"],
  ]);
  const sun = ctx.createRadialGradient(b.x + b.w * sunAt, horizon - b.h * 0.06, 0, b.x + b.w * sunAt, horizon - b.h * 0.06, b.w * 0.5);
  sun.addColorStop(0, "rgba(255, 238, 200, 0.95)");
  sun.addColorStop(0.12, "rgba(255, 228, 180, 0.8)");
  sun.addColorStop(0.13, "rgba(255, 214, 170, 0.45)");
  sun.addColorStop(1, "rgba(255, 200, 160, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(b.x, b.y, b.w, b.h * 0.5);
  const sea = ctx.createLinearGradient(0, horizon, 0, b.y + b.h);
  sea.addColorStop(0, "#9cc7c0");
  sea.addColorStop(0.35, "#5fb3b0");
  sea.addColorStop(1, "#3c8f98");
  ctx.fillStyle = sea;
  ctx.fillRect(b.x, horizon, b.w, b.h * 0.5);
  // The sun's road on the water.
  ctx.fillStyle = "rgba(255, 236, 200, 0.5)";
  for (let k = 0; k < 9; k += 1) {
    const y = horizon + 8 + k * k * 4;
    const half = 10 + k * 7;
    ctx.fillRect(b.x + b.w * sunAt - half, y, half * 2, 3 + k * 0.6);
  }
  // The pier: planks running to the bungalows on the horizon.
  const vx = b.x + b.w * sunAt;
  ctx.fillStyle = "#b07a5c";
  ctx.beginPath();
  ctx.moveTo(vx - 6, horizon + 4);
  ctx.lineTo(vx + 6, horizon + 4);
  ctx.lineTo(b.x + b.w * 0.62, b.y + b.h);
  ctx.lineTo(b.x + b.w * 0.18, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 50, 40, 0.45)";
  ctx.lineWidth = 2;
  for (let k = 1; k < 14; k += 1) {
    const t = (k / 14) ** 1.8;
    const y = horizon + 4 + t * (b.h * 0.5 - 4);
    const l = vx - 6 + (b.x + b.w * 0.18 - vx + 6) * t;
    const r = vx + 6 + (b.x + b.w * 0.62 - vx - 6) * t;
    ctx.beginPath();
    ctx.moveTo(l, y);
    ctx.lineTo(r, y);
    ctx.stroke();
  }
  for (const [u, s] of [
    [0.3, 1],
    [0.42, 1.2],
    [0.54, 0.9],
  ] as const) {
    const x = b.x + b.w * u;
    ctx.fillStyle = "#7a5048";
    ctx.fillRect(x - 22 * s, horizon - 14 * s, 44 * s, 14 * s);
    ctx.fillStyle = "#5b3a3a";
    ctx.beginPath();
    ctx.moveTo(x - 30 * s, horizon - 12 * s);
    ctx.lineTo(x, horizon - 34 * s);
    ctx.lineTo(x + 30 * s, horizon - 12 * s);
    ctx.closePath();
    ctx.fill();
  }
  palm(ctx, b.x + b.w * 0.1, b.y + b.h * 0.62, b.h * 0.34, 0.16, "#4a3442");
  palm(ctx, b.x + b.w * 0.9, b.y + b.h * 0.6, b.h * 0.28, -0.2, "#4a3442");
  // The beach in the corners.
  ctx.fillStyle = "#e9d2ae";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + b.h * 0.64, b.w * 0.2, b.h * 0.04, 0, 0, Math.PI * 2);
  ctx.ellipse(b.x + b.w, b.y + b.h * 0.62, b.w * 0.18, b.h * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** America: a green peak over terraced ruins, clouds in the valley. */
export function andes(ctx: CanvasRenderingContext2D, b: Box) {
  sky(ctx, b, [
    [0, "#c9d3d6"],
    [0.6, "#efe2d0"],
  ]);
  ridge(ctx, b, [[0, 0.55], [0.18, 0.42], [0.3, 0.5], [0.45, 0.38], [0.7, 0.48], [1, 0.36]], "#9db0a8");
  const peak = ctx.createLinearGradient(0, b.y + b.h * 0.15, 0, b.y + b.h);
  peak.addColorStop(0, "#5f7a5a");
  peak.addColorStop(1, "#3f5a44");
  ridge(ctx, b, [[0.2, 1], [0.38, 0.4], [0.5, 0.2], [0.56, 0.16], [0.66, 0.3], [0.74, 0.5], [0.9, 0.62], [1, 0.66]], peak);
  // Terraces and walls.
  ctx.fillStyle = "#a89a84";
  for (let k = 0; k < 6; k += 1) ctx.fillRect(b.x + b.w * (0.08 + k * 0.06), b.y + b.h * (0.72 + k * 0.035), b.w * (0.5 - k * 0.03), b.h * 0.018);
  ctx.fillStyle = "#c4b59a";
  for (let k = 0; k < 5; k += 1) ctx.fillRect(b.x + b.w * (0.12 + k * 0.09), b.y + b.h * 0.67, b.w * 0.05, b.h * 0.05);
  // Mist.
  ctx.fillStyle = "rgba(245, 240, 232, 0.7)";
  for (const [u, v, r] of [
    [0.18, 0.6, 0.16],
    [0.35, 0.63, 0.12],
    [0.82, 0.55, 0.18],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * u, b.y + b.h * v, b.w * r, b.h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Asia: rice terraces stepping down a hill, their water catching the sky, a pagoda on the ridge in the haze. */
export function terraces(ctx: CanvasRenderingContext2D, b: Box) {
  sky(ctx, b, [
    [0, "#d9d3c4"],
    [0.45, "#ecdcc0"],
  ]);
  ridge(ctx, b, [[0, 0.34], [0.2, 0.26], [0.42, 0.33], [0.62, 0.22], [0.85, 0.3], [1, 0.27]], "#b3bca8");
  ridge(ctx, b, [[0, 0.46], [0.25, 0.4], [0.5, 0.47], [0.72, 0.38], [1, 0.44]], "#8fa286");
  // The pagoda on the ridge: five tiers, each a red storey under a dark roof whose eaves turn up.
  const px = b.x + b.w * 0.72;
  const base = b.y + b.h * 0.42;
  const unit = b.h * 0.042;
  for (let k = 0; k < 5; k += 1) {
    const y = base - k * unit * 1.25;
    const half = unit * (2.3 - k * 0.32);
    ctx.fillStyle = "#9a4334";
    ctx.fillRect(px - half * 0.62, y - unit * 0.9, half * 1.24, unit * 0.9);
    ctx.fillStyle = "#3e2a30";
    ctx.beginPath();
    ctx.moveTo(px - half * 1.25, y - unit * 1.05);
    ctx.quadraticCurveTo(px - half * 0.8, y - unit * 0.75, px - half * 0.5, y - unit * 1.3);
    ctx.lineTo(px + half * 0.5, y - unit * 1.3);
    ctx.quadraticCurveTo(px + half * 0.8, y - unit * 0.75, px + half * 1.25, y - unit * 1.05);
    ctx.lineTo(px + half * 0.9, y - unit * 0.78);
    ctx.lineTo(px - half * 0.9, y - unit * 0.78);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "#3e2a30";
  ctx.lineWidth = Math.max(2, unit * 0.18);
  ctx.beginPath();
  ctx.moveTo(px, base - unit * 6.4);
  ctx.lineTo(px, base - unit * 7.6);
  ctx.stroke();
  // The terraces: bands of green down the hill, each edged by the water held on it, bowed like contour lines.
  const greens = ["#9db06a", "#86a15a", "#93aa62", "#7a9652", "#8aa45c", "#6f8c4c", "#7f9a54", "#66834a"];
  const curve = (k: number) => {
    const y = b.y + b.h * (0.5 + k * 0.064 + k * k * 0.0018);
    const sag = b.h * (k % 2 ? 0.05 : -0.035);
    return { y, sag };
  };
  for (let k = 0; k < greens.length; k += 1) {
    const top = curve(k);
    ctx.fillStyle = greens[k];
    ctx.beginPath();
    ctx.moveTo(b.x, top.y);
    ctx.quadraticCurveTo(b.x + b.w * 0.45, top.y + top.sag, b.x + b.w, top.y - top.sag * 0.4);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 236, 214, 0.85)";
    ctx.lineWidth = Math.max(2, b.h * 0.009);
    ctx.beginPath();
    ctx.moveTo(b.x, top.y);
    ctx.quadraticCurveTo(b.x + b.w * 0.45, top.y + top.sag, b.x + b.w, top.y - top.sag * 0.4);
    ctx.stroke();
  }
}

/** Africa: the savannah at golden hour, an acacia and a giraffe against the sun. */
export function savannah(ctx: CanvasRenderingContext2D, b: Box) {
  sky(ctx, b, [
    [0, "#e7b38a"],
    [0.55, "#f3d29c"],
    [0.7, "#e9c48c"],
  ]);
  ctx.fillStyle = "rgba(255, 240, 200, 0.85)";
  ctx.beginPath();
  ctx.arc(b.x + b.w * 0.3, b.y + b.h * 0.5, b.w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ridge(ctx, b, [[0, 0.66], [0.4, 0.62], [0.7, 0.66], [1, 0.63]], "#b98a5c");
  ridge(ctx, b, [[0, 0.78], [0.5, 0.74], [1, 0.8]], "#9a6e48");
  ctx.fillStyle = "#4a3030";
  // The acacia: a trunk and a flat crown.
  const tx = b.x + b.w * 0.72;
  const ty = b.y + b.h * 0.66;
  ctx.fillRect(tx - 4, ty - b.h * 0.2, 8, b.h * 0.2);
  ctx.beginPath();
  ctx.ellipse(tx, ty - b.h * 0.22, b.w * 0.2, b.h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  // The giraffe: a sloping body on four thin legs, the long neck, the head and its horns.
  const gx = b.x + b.w * 0.36;
  const gy = b.y + b.h * 0.8;
  const u = b.h * 0.0028;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#4a3030";
  ctx.lineWidth = 7 * u;
  for (const [x0, x1] of [
    [-30, -34],
    [-20, -16],
    [22, 20],
    [32, 38],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(gx + x0 * u, gy - 70 * u);
    ctx.lineTo(gx + x1 * u, gy);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(gx - 40 * u, gy - 64 * u);
  ctx.lineTo(gx - 36 * u, gy - 86 * u);
  ctx.lineTo(gx + 30 * u, gy - 104 * u);
  ctx.lineTo(gx + 44 * u, gy - 84 * u);
  ctx.lineTo(gx + 36 * u, gy - 66 * u);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 13 * u;
  ctx.beginPath();
  ctx.moveTo(gx + 30 * u, gy - 96 * u);
  ctx.lineTo(gx + 64 * u, gy - 190 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(gx + 74 * u, gy - 192 * u, 16 * u, 8 * u, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(gx + 62 * u, gy - 198 * u);
  ctx.lineTo(gx + 60 * u, gy - 212 * u);
  ctx.moveTo(gx + 68 * u, gy - 200 * u);
  ctx.lineTo(gx + 68 * u, gy - 214 * u);
  ctx.stroke();
}

/** Europe: a white village stacked over a blue bay, one dome. */
export function village(ctx: CanvasRenderingContext2D, b: Box) {
  sky(ctx, b, [
    [0, "#b9cbd8"],
    [0.5, "#e7e2d6"],
  ]);
  const sea = ctx.createLinearGradient(0, b.y + b.h * 0.5, 0, b.y + b.h);
  sea.addColorStop(0, "#6f9cb8");
  sea.addColorStop(1, "#3f6f92");
  ctx.fillStyle = sea;
  ctx.fillRect(b.x, b.y + b.h * 0.5, b.w, b.h * 0.5);
  ridge(ctx, b, [[0, 0.36], [0.3, 0.3], [0.62, 0.42], [0.8, 0.62], [1, 0.7]], "#b49478");
  // White houses stepping down the hill in rows, a few in ochre, their windows and doors dark.
  for (let row = 0; row < 4; row += 1) {
    const v = 0.36 + row * 0.1;
    const count = 3 + row;
    for (let k = 0; k < count; k += 1) {
      const u = 0.03 + k * (0.62 / count) + (row % 2) * 0.04;
      const s = 0.62 / count - 0.02;
      ctx.fillStyle = (row + k) % 5 === 2 ? "#ecd3b4" : "#f3efe6";
      ctx.fillRect(b.x + b.w * u, b.y + b.h * v, b.w * s, b.h * 0.085);
      ctx.fillStyle = "rgba(70, 90, 120, 0.5)";
      ctx.fillRect(b.x + b.w * (u + s * 0.35), b.y + b.h * (v + 0.035), b.w * s * 0.25, b.h * 0.035);
    }
  }
  ctx.fillStyle = "#3f6f9e";
  ctx.beginPath();
  ctx.arc(b.x + b.w * 0.3, b.y + b.h * 0.36, b.w * 0.06, Math.PI, 0);
  ctx.fill();
}

export const POSTCARDS = { lagoon, andes, terraces, savannah, village } as const;
