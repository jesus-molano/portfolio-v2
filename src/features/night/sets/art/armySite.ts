import { createRandom } from "@/features/hero/scene/world";
import { fitText, fonts, makeCanvas } from "../../artCanvas";
import {
  APRON,
  APRON_OUTLINE,
  DAMP,
  RAMP,
  ROAD,
  TRACK,
  TRACK_LENGTH,
  TRACK_LINE,
  type Vec2,
  pointAlong,
} from "../army/siteLayout";

/**
 * The army site's surfaces, painted once: the apron's packed dirt and
 * volcanic gravel (colour, and a surface map whose red is the bump height
 * and whose green the roughness, so the puddles and the damp shine under
 * the sodium and the dry gravel does not), a dry grass tuft, the warning
 * sign, the boom's red-and-white sleeve and its ALTO disc, the sentry
 * box's panels and its lit window, and the floodlights' cabinet door.
 * Generic: no real insignia, no real unit, no logos.
 */

type Ctx = CanvasRenderingContext2D;

/** The apron's canvas: one pixel is about 1.3 cm (2.6 on the low tier). */
export function apronSize(low: boolean): { w: number; h: number } {
  return low ? { w: 1024, h: 620 } : { w: 2048, h: 1240 };
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, angle: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), angle, 0, Math.PI * 2);
}

/** Painted in set metres: canvas x along +x, canvas y along +z (the texture's v runs the other way). */
function apronTransform(ctx: Ctx, w: number, h: number) {
  ctx.setTransform(w / (APRON.x1 - APRON.x0), 0, 0, h / (APRON.z1 - APRON.z0), (-APRON.x0 * w) / (APRON.x1 - APRON.x0), (-APRON.z0 * h) / (APRON.z1 - APRON.z0));
}

function offsetLine(offset: number, step = 0.08): Vec2[] {
  const out: Vec2[] = [];
  for (let at = 0; at <= TRACK_LENGTH; at += step) {
    const { p, dir } = pointAlong(TRACK_LINE, at);
    out.push([p[0] - dir[1] * offset, p[1] + dir[0] * offset]);
  }
  return out;
}

/** A slow random walk in 0..1, for strokes that thicken and fade along their length. */
function smoothNoise(random: () => number, floor: number): () => number {
  let v = 0.5;
  return () => {
    v = Math.min(1, Math.max(0, v + (random() - 0.5) * 0.18));
    return floor + (1 - floor) * v;
  };
}

/** Strokes a rut-following line in short pieces, fading out over the track's last metres. */
function strokeAlong(ctx: Ctx, line: Vec2[], width: number, style: string, alpha: number, jitter?: () => number) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  const step = TRACK_LENGTH / Math.max(1, line.length - 1);
  for (let i = 0; i < line.length - 1; i += 1) {
    const left = TRACK_LENGTH - i * step;
    ctx.globalAlpha = alpha * Math.min(1, Math.max(0, left / TRACK.fade)) * (jitter ? jitter() : 1);
    ctx.beginPath();
    ctx.moveTo(line[i][0], line[i][1]);
    ctx.lineTo(line[i + 1][0], line[i + 1][1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function isKerbEdge(a: Vec2, b: Vec2): boolean {
  const kerb = ROAD.kerbBack - 0.04;
  const onRamp = (p: Vec2) => p[0] > RAMP.x0 - 0.5 && p[0] < RAMP.x1 + 0.5 && p[1] > kerb - 0.01;
  return (a[1] >= kerb && b[1] >= kerb) || (onRamp(a) && onRamp(b));
}

/**
 * The apron: packed reddish dirt under a scatter of black picón and grey
 * gravel, the track's two ruts with their tread and their pushed-up
 * berms, a puddle in the rut, the road's runoff along the kerb, an oil
 * stain where the lorry stands, and a ragged edge where it thins into the
 * lot (alpha, cut at 0.5).
 */
export function paintApron(low: boolean): { color: HTMLCanvasElement; surface: HTMLCanvasElement } {
  const { w, h } = apronSize(low);
  const [color, c] = makeCanvas(w, h);
  const [surface, s] = makeCanvas(w, h);
  const random = createRandom(1521);
  const m = w / (APRON.x1 - APRON.x0);
  apronTransform(c, w, h);
  apronTransform(s, w, h);

  // Base: packed dirt; the surface map's red is height (128 = the apron), green roughness.
  c.fillStyle = "#4b3d34";
  c.fillRect(APRON.x0, APRON.z0, APRON.x1 - APRON.x0, APRON.z1 - APRON.z0);
  s.fillStyle = "rgb(128, 228, 0)";
  s.fillRect(APRON.x0, APRON.z0, APRON.x1 - APRON.x0, APRON.z1 - APRON.z0);

  // Mottling: reddish soil, grey dust, black picón drifts.
  const mottles = ["#6e5442", "#68625a", "#463a38", "#352c31", "#77604c", "#5a4d45"];
  for (let i = 0; i < 320; i += 1) {
    const x = APRON.x0 + random() * (APRON.x1 - APRON.x0);
    const z = APRON.z0 + random() * (APRON.z1 - APRON.z0);
    const r = 0.25 + random() * random() * 1.8;
    // A soft elliptical blot: the gradient is drawn in the blot's own squashed frame, so it has no edge.
    const tone = mottles[Math.floor(random() * mottles.length)];
    c.save();
    c.translate(x, z);
    c.rotate(random() * Math.PI);
    c.scale(r, r * (0.5 + random() * 0.5));
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, tone);
    g.addColorStop(1, `${tone}00`);
    c.globalAlpha = 0.1 + random() * 0.2;
    c.fillStyle = g;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
  }
  c.globalAlpha = 1;

  // The berms (gravel pushed up beside the ruts), then the ruts, compacted and darker.
  for (const side of [-1, 1]) {
    const line = offsetLine((side * TRACK.gauge) / 2);
    for (const dx of [-1, 1]) {
      const berm = line.map(([x, z], i) => {
        const next = line[Math.min(line.length - 1, i + 1)];
        const prev = line[Math.max(0, i - 1)];
        const len = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;
        const nx = -(next[1] - prev[1]) / len;
        const nz = (next[0] - prev[0]) / len;
        return [x + nx * dx * TRACK.width * 0.85, z + nz * dx * TRACK.width * 0.85] as Vec2;
      });
      // Broken, uneven: gravel pushed aside, not a painted line.
      const wobble = smoothNoise(random, 0.35);
      strokeAlong(c, berm, TRACK.width * 0.5, "#6f604f", 0.32, wobble);
      strokeAlong(s, berm, TRACK.width * 0.5, "rgb(150, 232, 0)", 0.7, wobble);
    }
    const depth = smoothNoise(random, 0.5);
    strokeAlong(c, line, TRACK.width, "#3b2f31", 0.55, depth);
    strokeAlong(s, line, TRACK.width, "rgb(90, 200, 0)", 0.85);
    strokeAlong(c, line, TRACK.width * 0.4, "#2a2129", 0.4, smoothNoise(random, 0.9));
    // Tread: short bars across the rut every 7 cm.
    for (let i = 0; i < line.length - 1; i += 1) {
      const fade = Math.min(1, Math.max(0, (TRACK_LENGTH - (i * TRACK_LENGTH) / line.length) / TRACK.fade));
      const [x, z] = line[i];
      const [nx, nz] = line[i + 1];
      const len = Math.hypot(nx - x, nz - z) || 1;
      const ax = -(nz - z) / len;
      const az = (nx - x) / len;
      if (random() < 0.3) continue;
      c.globalAlpha = (0.1 + random() * 0.18) * fade;
      c.strokeStyle = i % 2 ? "#24191f" : "#58463f";
      c.lineWidth = 0.025;
      c.beginPath();
      c.moveTo(x - ax * TRACK.width * 0.38, z - az * TRACK.width * 0.38);
      c.lineTo(x + ax * TRACK.width * 0.38, z + az * TRACK.width * 0.38);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // Gravel: black picón, grey and red stone chips, lit from the floods' side.
  const chips = Math.round((w * h) / 34);
  const chipTones = ["#2a2329", "#352c31", "#857868", "#6c5b4d", "#4f3832", "#968672", "#3f3434"];
  const px = 1 / m;
  for (let i = 0; i < chips; i += 1) {
    const x = APRON.x0 + random() * (APRON.x1 - APRON.x0);
    const z = APRON.z0 + random() * (APRON.z1 - APRON.z0);
    const size = px * (0.8 + random() * random() * 3.2);
    c.fillStyle = chipTones[Math.floor(random() * chipTones.length)];
    c.globalAlpha = 0.55 + random() * 0.45;
    c.fillRect(x, z, size, size * (0.6 + random() * 0.6));
    if (size > px * 1.8) {
      s.fillStyle = `rgb(${150 + Math.floor(random() * 70)}, ${200 + Math.floor(random() * 40)}, 0)`;
      s.fillRect(x, z, size, size);
    }
  }
  c.globalAlpha = 1;
  // Drifts of black picón, where the wind has left it.
  for (let d = 0; d < 14; d += 1) {
    const cx = APRON.x0 + random() * (APRON.x1 - APRON.x0);
    const cz = APRON.z0 + random() * (APRON.z1 - APRON.z0);
    const r = 0.6 + random() * 1.4;
    for (let i = 0; i < (low ? 500 : 2000) * r; i += 1) {
      // Thinning out from the middle: no edge to the drift.
      const a = random() * Math.PI * 2;
      const q = random() * random() * r * 1.6 * (0.75 + 0.25 * Math.sin(a * 3 + d));
      c.fillStyle = random() < 0.7 ? "#231d24" : "#3a2a2a";
      c.globalAlpha = 0.5 + random() * 0.5;
      const size = px * (1 + random() * 2.2);
      c.fillRect(cx + Math.cos(a) * q, cz + Math.sin(a) * q * 0.6, size, size);
    }
  }
  c.globalAlpha = 1;
  // Pebbles: a lit top and a shadowed foot.
  for (let i = 0; i < (low ? 700 : 2000); i += 1) {
    const x = APRON.x0 + random() * (APRON.x1 - APRON.x0);
    const z = APRON.z0 + random() * (APRON.z1 - APRON.z0);
    const r = px * (1.6 + random() * 2.6);
    c.fillStyle = "rgba(20, 12, 24, 0.45)";
    ellipse(c, x + r * 0.35, z + r * 0.4, r, r * 0.8, 0);
    c.fill();
    c.fillStyle = chipTones[[0, 1, 3, 4, 5, 6][Math.floor(random() * 6)]];
    ellipse(c, x, z, r, r * 0.8, random() * Math.PI);
    c.fill();
    c.fillStyle = "rgba(225, 210, 190, 0.12)";
    ellipse(c, x - r * 0.3, z - r * 0.3, r * 0.45, r * 0.35, 0);
    c.fill();
    s.fillStyle = "rgb(176, 215, 0)";
    ellipse(s, x, z, r, r * 0.8, 0);
    s.fill();
  }

  // Damp ground, then the puddle: dark, smooth and flat.
  for (const patch of DAMP) {
    const [cx, cz] = patch.c;
    c.save();
    s.save();
    for (const ctx of [c, s]) {
      ctx.translate(cx, cz);
      ctx.rotate(patch.angle);
      ctx.scale(patch.r[0], patch.r[1]);
    }
    const dark = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    dark.addColorStop(0, `rgba(28, 18, 34, ${0.62 * patch.wet})`);
    dark.addColorStop(0.6, `rgba(32, 22, 38, ${0.4 * patch.wet})`);
    dark.addColorStop(1, "rgba(32, 22, 38, 0)");
    c.fillStyle = dark;
    c.fillRect(-1, -1, 2, 2);
    const smooth = s.createRadialGradient(0, 0, 0, 0, 0, 1);
    smooth.addColorStop(0, `rgba(118, ${Math.round(228 - 140 * patch.wet)}, 0, 0.95)`);
    smooth.addColorStop(1, "rgba(118, 228, 0, 0)");
    s.fillStyle = smooth;
    s.fillRect(-1, -1, 2, 2);
    if (patch.wet >= 1) {
      // Standing water: a hard-edged, still pool with a lighter wet rim.
      const lobes: [number, number, number, number][] = [
        [0, 0, 0.5, 0.42],
        [0.32, 0.12, 0.34, 0.3],
        [-0.36, -0.08, 0.3, 0.26],
        [0.12, -0.22, 0.26, 0.2],
      ];
      for (const [x, y, rx, ry] of lobes) {
        c.fillStyle = "rgba(120, 100, 96, 0.2)";
        ellipse(c, x, y, rx + 0.06, ry + 0.07, 0);
        c.fill();
      }
      for (const [x, y, rx, ry] of lobes) {
        c.fillStyle = "#1d1626";
        ellipse(c, x, y, rx, ry, 0.2);
        c.fill();
        s.fillStyle = "rgb(110, 120, 0)";
        ellipse(s, x, y, rx, ry, 0.2);
        s.fill();
      }
    }
    c.restore();
    s.restore();
  }
  // An oil stain where the lorry stands.
  {
    const g = c.createRadialGradient(9.4, -9.15, 0, 9.4, -9.15, 0.55);
    g.addColorStop(0, "rgba(16, 10, 20, 0.7)");
    g.addColorStop(1, "rgba(16, 10, 20, 0)");
    c.fillStyle = g;
    ellipse(c, 9.4, -9.15, 0.55, 0.36, 0.3);
    c.fill();
    s.fillStyle = "rgba(128, 90, 0, 0.7)";
    ellipse(s, 9.4, -9.15, 0.4, 0.26, 0.3);
    s.fill();
  }
  // The strip by the kerb: grit and road dust.
  {
    const g = c.createLinearGradient(0, ROAD.kerbBack - 0.9, 0, ROAD.kerbBack);
    g.addColorStop(0, "rgba(150, 140, 135, 0)");
    g.addColorStop(1, "rgba(150, 140, 135, 0.22)");
    c.fillStyle = g;
    c.fillRect(APRON.x0, ROAD.kerbBack - 0.9, APRON.x1 - APRON.x0, 0.9);
  }

  // The outline: solid along the kerb, ragged where the gravel thins out into the lot.
  const [mask, k] = makeCanvas(w, h);
  apronTransform(k, w, h);
  k.fillStyle = "#fff";
  k.beginPath();
  APRON_OUTLINE.forEach(([x, z], i) => (i ? k.lineTo(x, z) : k.moveTo(x, z)));
  k.closePath();
  k.fill();
  for (let i = 0; i < APRON_OUTLINE.length; i += 1) {
    const a = APRON_OUTLINE[i];
    const b = APRON_OUTLINE[(i + 1) % APRON_OUTLINE.length];
    if (isKerbEdge(a, b)) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / len;
    const nz = -(b[0] - a[0]) / len;
    for (let n = 0; n < len * 70; n += 1) {
      const t = random();
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const d = (random() - 0.62) * 0.7;
      const r = 0.02 + random() * random() * 0.12;
      k.globalCompositeOperation = d < 0 ? "destination-out" : "source-over";
      ellipse(k, x + nx * d, z + nz * d, r, r * 0.8, random() * Math.PI);
      k.fill();
    }
  }
  k.globalCompositeOperation = "source-over";
  for (const ctx of [c, s]) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  return { color, surface };
}

/** A dry grass tuft for crossed cards: straw blades fanning out of a dark base, on transparency. */
export function paintTuft(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 256);
  const random = createRandom(77);
  const tones = ["#cbb98a", "#a9925f", "#e0d3a5", "#8e8268", "#b8a878", "#7d8050"];
  for (let i = 0; i < 70; i += 1) {
    const base = 128 + (random() - 0.5) * 70;
    const lean = (base - 128) * 1.6 + (random() - 0.5) * 120;
    const height = 110 + random() * 140;
    const tipX = base + lean;
    const tipY = 256 - height;
    const width = 2 + random() * 3.5;
    ctx.fillStyle = tones[Math.floor(random() * tones.length)];
    ctx.globalAlpha = 0.85 + random() * 0.15;
    ctx.beginPath();
    ctx.moveTo(base - width, 256);
    ctx.quadraticCurveTo(base + lean * 0.2, 256 - height * 0.6, tipX, tipY);
    ctx.quadraticCurveTo(base + lean * 0.2 + width, 256 - height * 0.6, base + width, 256);
    ctx.closePath();
    ctx.fill();
  }
  // Darker, denser at the base.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-atop";
  const g = ctx.createLinearGradient(0, 160, 0, 256);
  g.addColorStop(0, "rgba(40, 30, 30, 0)");
  g.addColorStop(1, "rgba(40, 30, 30, 0.6)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/** The sign's face, 0.9 x 0.6 m: the same Spanish sign in both locales, as it stands on the island. */
export const SIGN_TEXT = { top: "ZONA MILITAR", bottom: "PROHIBIDO EL PASO" } as const;
export const SIGN_RED = "#b1282c";

export function paintSign(): HTMLCanvasElement {
  const W = 512;
  const H = 338;
  const [canvas, ctx] = makeCanvas(W, H);
  const random = createRandom(1957);
  // Enamelled steel, gone a little yellow.
  ctx.fillStyle = "#ebe4d4";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = SIGN_RED;
  ctx.lineWidth = 16;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = SIGN_RED;
  ctx.fillRect(22, 22, W - 44, 128);
  const condensed = (size: number) => `400 ${size}px ${fonts.condensed()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f6f0e4";
  let size = fitText(ctx, SIGN_TEXT.top, condensed, 112, W - 90);
  ctx.font = condensed(size);
  ctx.fillText(SIGN_TEXT.top, W / 2, 22 + 64 + size * 0.36);
  ctx.fillStyle = "#1c1620";
  size = fitText(ctx, SIGN_TEXT.bottom, condensed, 96, W - 90);
  ctx.font = condensed(size);
  ctx.fillText(SIGN_TEXT.bottom, W / 2, 150 + (H - 22 - 150) / 2 + size * 0.36);
  // Bolts, their rust running down, chips in the enamel, road dust from below.
  for (const [x, y] of [
    [34, 36],
    [W - 34, 36],
    [34, H - 36],
    [W - 34, H - 36],
  ]) {
    const g = ctx.createLinearGradient(x, y, x, y + 90);
    g.addColorStop(0, "rgba(120, 60, 30, 0.55)");
    g.addColorStop(1, "rgba(120, 60, 30, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 3, y, 6 + random() * 3, 60 + random() * 40);
    ctx.fillStyle = "#5a5560";
    ellipse(ctx, x, y, 6, 6, 0);
    ctx.fill();
  }
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = random() < 0.5 ? "#3a3440" : "#6a4a3a";
    ellipse(ctx, random() * W, random() * H, 1 + random() * 4, 1 + random() * 3, random() * 3);
    ctx.fill();
  }
  const dust = ctx.createLinearGradient(0, H * 0.55, 0, H);
  dust.addColorStop(0, "rgba(120, 100, 80, 0)");
  dust.addColorStop(1, "rgba(120, 100, 80, 0.28)");
  ctx.fillStyle = dust;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

/** The boom's sleeve: red and white bands (eight over the arm), scuffed. Runs along the canvas's height. */
export const BOOM_BANDS = 8;
export function paintBoom(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64, 512);
  const random = createRandom(4);
  const band = 512 / BOOM_BANDS;
  for (let i = 0; i < BOOM_BANDS; i += 1) {
    ctx.fillStyle = i % 2 ? "#ece6dc" : SIGN_RED;
    ctx.fillRect(0, i * band, 64, band);
  }
  for (let i = 0; i < 60; i += 1) {
    ctx.fillStyle = `rgba(40, 30, 40, ${0.1 + random() * 0.25})`;
    ctx.fillRect(random() * 64, random() * 512, 1 + random() * 5, 1 + random() * 3);
  }
  return canvas;
}

/** The ALTO disc that hangs from the boom. */
export function paintAlto(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = "#ece6dc";
  ellipse(ctx, 128, 128, 126, 126, 0);
  ctx.fill();
  ctx.fillStyle = SIGN_RED;
  ellipse(ctx, 128, 128, 114, 114, 0);
  ctx.fill();
  ctx.fillStyle = "#f6f0e4";
  ctx.textAlign = "center";
  const font = (size: number) => `400 ${size}px ${fonts.condensed()}`;
  const size = fitText(ctx, "ALTO", font, 110, 170);
  ctx.font = font(size);
  ctx.fillText("ALTO", 128, 128 + size * 0.36);
  return canvas;
}

/** The sentry box's lower panels: sand over an olive skirt, seams, rust under the rivets, splash at the foot. */
export function paintBoothPanel(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 256);
  const random = createRandom(62);
  ctx.fillStyle = "#b4a47c";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#5c6340";
  ctx.fillRect(0, 150, 256, 106);
  for (let x = 0; x <= 256; x += 64) {
    ctx.fillStyle = "rgba(40, 30, 30, 0.45)";
    ctx.fillRect(x - 1, 0, 3, 256);
    for (let y = 16; y < 256; y += 40) {
      ctx.fillStyle = "rgba(110, 60, 30, 0.35)";
      ctx.fillRect(x + 3, y, 2, 14 + random() * 20);
    }
  }
  const splash = ctx.createLinearGradient(0, 196, 0, 256);
  splash.addColorStop(0, "rgba(60, 45, 40, 0)");
  splash.addColorStop(1, "rgba(60, 45, 40, 0.55)");
  ctx.fillStyle = splash;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `rgba(50, 40, 40, ${0.1 + random() * 0.2})`;
    ctx.fillRect(random() * 256, random() * 256, 1 + random() * 4, 1 + random() * 8);
  }
  return canvas;
}

/**
 * The sentry box's window, seen from outside at night: a dim room lit by
 * a desk lamp. A duty roster and a calendar on the wall, a field radio
 * with one lit dial, a cap on its hook, a mug and the logbook on the
 * desk. Nobody in: the guard is at the boom.
 */
export function paintBoothWindow(): HTMLCanvasElement {
  const W = 256;
  const H = 200;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.fillStyle = "#4a4f3c";
  ctx.fillRect(0, 0, W, H);
  // The lamp's pool on the wall.
  const pool = ctx.createRadialGradient(70, 150, 4, 70, 150, 170);
  pool.addColorStop(0, "rgba(255, 200, 120, 0.85)");
  pool.addColorStop(0.45, "rgba(220, 150, 80, 0.35)");
  pool.addColorStop(1, "rgba(40, 30, 50, 0)");
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, W, H);
  // Roster and calendar.
  ctx.fillStyle = "#d8cfb8";
  ctx.fillRect(120, 36, 56, 70);
  ctx.fillStyle = "rgba(60, 50, 50, 0.6)";
  for (let y = 46; y < 100; y += 8) ctx.fillRect(126, y, 44, 2);
  ctx.fillStyle = "#e6dcc6";
  ctx.fillRect(190, 30, 44, 54);
  ctx.fillStyle = "#a83030";
  ctx.fillRect(190, 30, 44, 12);
  ctx.fillStyle = "rgba(60, 50, 50, 0.5)";
  for (let r = 0; r < 4; r += 1) for (let col = 0; col < 5; col += 1) ctx.fillRect(194 + col * 8, 48 + r * 8, 5, 5);
  // The cap on its hook.
  ctx.fillStyle = "#3e4630";
  ellipse(ctx, 34, 60, 20, 12, 0);
  ctx.fill();
  ctx.fillRect(14, 60, 40, 6);
  // Desk, radio, mug, logbook, lamp.
  ctx.fillStyle = "#5a3e2c";
  ctx.fillRect(0, 158, W, 42);
  ctx.fillStyle = "#2c2e26";
  ctx.fillRect(150, 118, 70, 40);
  ctx.fillStyle = "#ffcf7a";
  ellipse(ctx, 166, 132, 5, 5, 0);
  ctx.fill();
  ctx.fillStyle = "#6a6e5a";
  ctx.fillRect(180, 126, 32, 4);
  ctx.fillRect(180, 136, 32, 4);
  ctx.fillStyle = "#d9d2c4";
  ctx.fillRect(110, 140, 14, 18);
  ctx.fillStyle = "#2a3550";
  ctx.fillRect(126, 150, 30, 8);
  ctx.fillStyle = "#3a3a36";
  ctx.beginPath();
  ctx.moveTo(52, 158);
  ctx.lineTo(60, 120);
  ctx.lineTo(84, 106);
  ctx.lineTo(88, 112);
  ctx.lineTo(66, 124);
  ctx.lineTo(60, 158);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff0c8";
  ellipse(ctx, 88, 116, 10, 6, 0.5);
  ctx.fill();
  // Glass: a faint sheen across the pane.
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, "rgba(180, 160, 220, 0.12)");
  sheen.addColorStop(0.5, "rgba(180, 160, 220, 0)");
  sheen.addColorStop(1, "rgba(180, 160, 220, 0.08)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

/** The floodlights' cabinet door: galvanised grey, a generic high-voltage triangle, vents and a lock. */
export function paintCabinet(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(128, 192);
  const random = createRandom(380);
  ctx.fillStyle = "#8b8a90";
  ctx.fillRect(0, 0, 128, 192);
  ctx.strokeStyle = "rgba(30, 25, 35, 0.6)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 112, 176);
  ctx.fillStyle = "#e8c53a";
  ctx.beginPath();
  ctx.moveTo(64, 34);
  ctx.lineTo(96, 88);
  ctx.lineTo(32, 88);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#1c1820";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#1c1820";
  ctx.beginPath();
  ctx.moveTo(68, 48);
  ctx.lineTo(56, 68);
  ctx.lineTo(66, 68);
  ctx.lineTo(58, 82);
  ctx.lineTo(74, 62);
  ctx.lineTo(64, 62);
  ctx.closePath();
  ctx.fill();
  for (let y = 120; y < 160; y += 7) {
    ctx.fillStyle = "rgba(30, 25, 35, 0.55)";
    ctx.fillRect(36, y, 56, 3);
  }
  ctx.fillStyle = "#3a3640";
  ctx.fillRect(104, 92, 6, 16);
  for (let i = 0; i < 30; i += 1) {
    ctx.fillStyle = `rgba(110, 70, 40, ${0.1 + random() * 0.25})`;
    ctx.fillRect(random() * 128, 150 + random() * 42, 1 + random() * 3, 2 + random() * 10);
  }
  return canvas;
}
