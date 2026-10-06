import { fonts, makeCanvas } from "../../artCanvas";

/**
 * PwC's blade sign: deep-violet enamel, a cyan double border tube, P, W and
 * C stacked in pink outline neon (our type, never the firm's mark), each
 * tube with a white-hot core, and a stepped deco crown with a sunburst fan.
 * One ray is dying: it is drawn dim here, with orange electrode ends, and
 * struck by its own overlay (PwcSet) when the board is armed.
 */
export const BLADE = { w: 440, h: 2600, metresW: 3.4, metresH: 20 } as const;

const PINK = "#ff5fb4";
const CYAN = "#3be8ff";
const SODIUM = "#ffc46b";
const ENAMEL = "#1c0d33";

function tube(ctx: CanvasRenderingContext2D, color: string, width: number, path: () => void) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 3;
  ctx.lineWidth = width;
  path();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 245, 250, 0.9)";
  ctx.lineWidth = width * 0.38;
  path();
  ctx.stroke();
  ctx.restore();
}

/** The fan rays of the crown, from a hub at the top of the blade: [angle, colour]. */
export const RAYS: [number, string][] = [-62, -40, -20, 0, 20, 40, 62].map((deg, i) => [
  (deg * Math.PI) / 180,
  i % 2 ? SODIUM : PINK,
]);
/** The ray that flickers. */
export const DYING_RAY = 4;
export const HUB = { x: BLADE.w / 2, y: 470 } as const;
const RAY_FROM = 70;
const RAY_TO = 300;

function rayPath(ctx: CanvasRenderingContext2D, angle: number) {
  return () => {
    ctx.beginPath();
    ctx.moveTo(HUB.x + Math.sin(angle) * RAY_FROM, HUB.y - Math.cos(angle) * RAY_FROM);
    ctx.lineTo(HUB.x + Math.sin(angle) * RAY_TO, HUB.y - Math.cos(angle) * RAY_TO);
  };
}

export function paintBlade(letters: readonly string[]): HTMLCanvasElement {
  const { w, h } = BLADE;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  // The crown: stepped deco tiers (transparent around them).
  ctx.fillStyle = ENAMEL;
  const steps = [
    [40, 520, w - 80, 2080],
    [90, 470, w - 180, 60],
    [140, 430, w - 280, 50],
  ];
  for (const [x, y, sw, sh] of steps) ctx.fillRect(x, y, sw, sh);
  // The fan behind the crown.
  RAYS.forEach(([angle, color], i) => {
    if (i === DYING_RAY) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      tube(ctx, color, 14, rayPath(ctx, angle));
      ctx.restore();
      // Its electrode ends still glow orange.
      for (const r of [RAY_FROM, RAY_TO]) {
        ctx.fillStyle = "#ff8a3c";
        ctx.shadowColor = "#ff8a3c";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(HUB.x + Math.sin(angle) * r, HUB.y - Math.cos(angle) * r, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      return;
    }
    tube(ctx, color, 14, rayPath(ctx, angle));
  });
  // Cyan double border round the blade.
  for (const inset of [22, 46]) {
    tube(ctx, CYAN, 10, () => {
      ctx.beginPath();
      ctx.roundRect(40 + inset, 520 + inset, w - 80 - inset * 2, 2080 - inset * 2, 26);
    });
  }
  // P, W, C stacked, pink outline neon.
  const family = fonts.display();
  const cell = 2080 / letters.length;
  letters.forEach((letter, i) => {
    const size = Math.min(cell * 0.72, (w - 160) * 1.05);
    ctx.font = `800 ${size}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cy = 520 + cell * (i + 0.5);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = PINK;
    ctx.shadowColor = PINK;
    ctx.shadowBlur = 34;
    ctx.lineWidth = 16;
    ctx.strokeText(letter, w / 2, cy);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 240, 248, 0.92)";
    ctx.lineWidth = 6;
    ctx.strokeText(letter, w / 2, cy);
    ctx.restore();
  });
  return canvas;
}

/** The dying ray alone, struck at full: an additive overlay over the blade. */
export function paintDyingRay(): HTMLCanvasElement {
  const { w, h } = BLADE;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  const [angle, color] = RAYS[DYING_RAY];
  tube(ctx, color, 14, rayPath(ctx, angle));
  return canvas;
}

/** Lit glass: the crossbar's role, the two plaques and the hotel's strips, in rows. */
export const GLASS = { w: 1024, h: 1024 } as const;
export const GLASS_ROWS = {
  crossbar: [0, 0, 1024, 260],
  plaque0: [0, 280, 1024, 140],
  plaque1: [0, 440, 1024, 140],
  amenities: [0, 600, 1024, 120],
  door: [0, 740, 1024, 120],
  lobby: [0, 880, 1024, 120],
} as const;

type GlassCopy = {
  crossbar: readonly string[];
  plaques: readonly string[];
  amenities: string;
  door: string;
  lobby: string;
};

export function paintGlass(copy: GlassCopy): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(GLASS.w, GLASS.h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, GLASS.w, GLASS.h);
  const centre = (row: readonly number[]) => [row[0] + row[2] / 2, row[1] + row[3] / 2] as const;
  // Crossbar: the neon script over spaced caps.
  {
    const r = GLASS_ROWS.crossbar;
    ctx.fillStyle = ENAMEL;
    ctx.fillRect(r[0], r[1], r[2], r[3]);
    const [cx] = centre(r);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 128px ${fonts.script()}`;
    ctx.fillStyle = "#fff0f8";
    ctx.shadowColor = PINK;
    ctx.shadowBlur = 26;
    ctx.fillText(copy.crossbar[0], cx, r[1] + 100);
    ctx.shadowBlur = 0;
    ctx.font = `700 54px ${fonts.mono()}`;
    ctx.fillStyle = "#c9f6ff";
    const caps = copy.crossbar[1].split("").join(" ");
    const width = ctx.measureText(caps).width;
    ctx.save();
    ctx.translate(cx, r[1] + 205);
    ctx.scale(Math.min(1, 940 / width), 1);
    ctx.fillText(caps, 0, 0);
    ctx.restore();
  }
  const plate = (row: readonly number[], text: string, fill: string, ink: string, size: number) => {
    ctx.fillStyle = fill;
    ctx.fillRect(row[0] + 20, row[1] + 10, row[2] - 40, row[3] - 20);
    ctx.fillStyle = ink;
    ctx.font = `700 ${size}px ${fonts.mono()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const [cx, cy] = centre(row);
    const width = ctx.measureText(text).width;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.min(1, (row[2] - 90) / width), 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  plate(GLASS_ROWS.plaque0, copy.plaques[0], "#fbe7c4", "#2a1745", 64);
  plate(GLASS_ROWS.plaque1, copy.plaques[1], "#fbe7c4", "#2a1745", 64);
  plate(GLASS_ROWS.amenities, copy.amenities, "#2a1745", "#ffd8ef", 56);
  plate(GLASS_ROWS.door, copy.door, "#c99a52", "#2a1745", 56);
  plate(GLASS_ROWS.lobby, copy.lobby, "#2a1745", "#bdf3ff", 56);
  return canvas;
}
