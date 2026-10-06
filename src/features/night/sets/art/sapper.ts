import { type Inks, type Print, type Pt, type Shape, chain, limb, polygon, printShape, screen, smoothClosed } from "./litho";

/**
 * A combat engineer for the army's poster, built like a painter builds a
 * figure: a skeleton in proportion (a head unit, seven and a half heads
 * tall), legs and arms placed by two-bone IK on where his boots stand and
 * his hands grip, then flesh, kit and light. Shirt sleeves rolled to the
 * elbow, a steel helmet with its chin strap, webbing (belt, pouches,
 * braces), a pack with the entrenching shovel strapped to it, trousers
 * bloused over laced boots. No badge, no insignia, no weapon.
 *
 * `rigSapper` is pure (tested); `paintSapper` prints the rig in three
 * inks per material with the lithograph's keyline (art/litho.ts).
 */

export type SapperPose = {
  /** The head unit, px. */
  h: number;
  /** Pelvis centre. */
  hip: Pt;
  /** Torso lean from the vertical, radians, positive toward where he faces. */
  lean: number;
  /** Head raised from the torso's line, radians (he looks ahead, not at his boots). */
  look: number;
  /** Ankles, near and far leg. */
  ankles: { near: Pt; far: Pt };
  /** Toe angle of each boot, radians: 0 flat, positive with the heel raised (pushing off the toe). */
  toes: { near: number; far: number };
  /** Wrists, near and far arm. */
  wrists: { near: Pt; far: Pt };
  /** 1 faces right, -1 faces left. */
  facing: 1 | -1;
  /** The near shoulder dropped (head units, positive down the spine): the twist of a body driving into a load. */
  drop?: number;
  /** What each hand does: grips a bar, pushes flat, or points. Default: grip. */
  hands?: { near?: Hand; far?: Hand };
};

/**
 * A hand: `grip` closes round a bar (`curl` says to which side of the
 * forearm the fingers wrap), `push` lies flat on a surface, fingers up
 * from a wrist bent back, `point` closes all but the index.
 */
export type Hand = { kind: "grip" | "push" | "point"; curl?: 1 | -1 };

export const PROPORTION = { torso: 2.5, thigh: 1.95, shin: 1.85, upper: 1.45, fore: 1.25 } as const;

export type SapperRig = {
  h: number;
  facing: 1 | -1;
  /** Up the spine, and toward his front. */
  u: Pt;
  n: Pt;
  /** The head's up and its face's direction. */
  hu: Pt;
  hf: Pt;
  hip: Pt;
  neck: Pt;
  head: Pt;
  near: Side;
  far: Side;
};

type Side = { shoulder: Pt; elbow: Pt; wrist: Pt; hip: Pt; knee: Pt; ankle: Pt; toe: number; hand: Hand };

const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Pt): number => Math.hypot(a.x, a.y);
const unit = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rotate = (a: Pt, r: number): Pt => ({ x: a.x * Math.cos(r) - a.y * Math.sin(r), y: a.x * Math.sin(r) + a.y * Math.cos(r) });

/**
 * Two-bone IK: the middle joint of a limb from `root` toward `target`,
 * bent to the side `bend` (+1 turns the root->target line clockwise on
 * screen, -1 counter-clockwise). A target out of reach is met at full
 * stretch along the line to it.
 */
export function reach(root: Pt, target: Pt, l1: number, l2: number, bend: 1 | -1): { joint: Pt; end: Pt } {
  const d = sub(target, root);
  const dist = Math.min(Math.max(len(d), Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const dir = unit(d);
  const cos = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const a = Math.acos(Math.min(1, Math.max(-1, cos)));
  const joint = add(root, rotate(dir, bend * a), l1);
  const end = add(root, dir, dist);
  return { joint, end };
}

export function rigSapper(pose: SapperPose): SapperRig {
  const { h, hip, lean, look, facing: f } = pose;
  const u = { x: Math.sin(lean) * f, y: -Math.cos(lean) };
  const n = { x: -u.y * f, y: u.x * f };
  const neck = add(hip, u, PROPORTION.torso * h);
  // The head comes back toward upright by `look`.
  const hu = rotate(u, -look * f);
  const hf = { x: -hu.y * f, y: hu.x * f };
  const head = add(add(neck, hu, 0.62 * h), hf, 0.06 * h);
  const shoulderNear = add(add(hip, u, (PROPORTION.torso * 0.86 - (pose.drop ?? 0)) * h), n, 0.02 * h);
  const shoulderFar = add(add(hip, u, (PROPORTION.torso * 0.86 + 0.05) * h), n, -0.22 * h);
  const hipNear = add(add(hip, n, 0.12 * h), u, 0.08 * h);
  const hipFar = add(hipNear, n, -0.26 * h);
  // Knees bend toward his front, elbows down and back.
  const knee = (f === 1 ? -1 : 1) as 1 | -1;
  const elbow = (f === 1 ? 1 : -1) as 1 | -1;
  const side = (shoulder: Pt, hipJ: Pt, wrist: Pt, ankle: Pt, toe: number, hand: Hand): Side => {
    const arm = reach(shoulder, wrist, PROPORTION.upper * h, PROPORTION.fore * h, elbow);
    const leg = reach(hipJ, ankle, PROPORTION.thigh * h, PROPORTION.shin * h, knee);
    return { shoulder, elbow: arm.joint, wrist: arm.end, hip: hipJ, knee: leg.joint, ankle: leg.end, toe, hand };
  };
  const grip: Hand = { kind: "grip", curl: 1 };
  return {
    h,
    facing: f,
    u,
    n,
    hu,
    hf,
    hip,
    neck,
    head,
    near: side(shoulderNear, hipNear, pose.wrists.near, pose.ankles.near, pose.toes.near, pose.hands?.near ?? grip),
    far: side(shoulderFar, hipFar, pose.wrists.far, pose.ankles.far, pose.toes.far, pose.hands?.far ?? grip),
  };
}

export type SapperInks = {
  cloth: Inks;
  clothFar: Inks;
  cuff: Inks;
  skin: Inks;
  skinFar: Inks;
  web: Inks;
  boot: Inks;
  steel: Inks;
  wood: Inks;
};

/** A point in a frame: `o` plus `x` along `ax` and `y` along `ay`, in head units. */
function framed(o: Pt, ax: Pt, ay: Pt, h: number) {
  return (x: number, y: number): Pt => ({ x: o.x + (ax.x * x + ay.x * y) * h, y: o.y + (ax.y * x + ay.y * y) * h });
}

/** A box with softened corners (a pack, a pouch) through its corner points, in order. */
function pad(points: Pt[], round = 0.22): Shape {
  const out: Pt[] = [];
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const p = points[i];
    const prev = points[(i + n - 1) % n];
    const next = points[(i + 1) % n];
    out.push({ x: p.x + (prev.x - p.x) * round, y: p.y + (prev.y - p.y) * round });
    out.push(p);
    out.push({ x: p.x + (next.x - p.x) * round, y: p.y + (next.y - p.y) * round });
  }
  return smoothClosed(out);
}

function boot(ankle: Pt, toe: number, f: 1 | -1, h: number): { boot: Shape; sole: Shape } {
  // Forward along the ground, turned by the toe angle (heel up).
  const ax = rotate({ x: f, y: 0 }, toe * f);
  const ay = rotate({ x: 0, y: -1 }, toe * f);
  const at = framed(ankle, ax, ay, h);
  const upper = [at(-0.3, 0.46), at(0.22, 0.46), at(0.3, 0.1), at(0.78, 0.0), at(1.02, -0.16), at(1.0, -0.3), at(-0.36, -0.3), at(-0.42, 0.02)];
  const sole = [at(-0.38, -0.22), at(1.02, -0.22), at(1.0, -0.38), at(-0.36, -0.38)];
  return { boot: smoothClosed(upper), sole: polygon(sole) };
}

/** Clip a drawing to a shape. */
function within(ctx: CanvasRenderingContext2D, shape: Shape, draw: () => void) {
  ctx.save();
  ctx.clip(shape.path);
  draw();
  ctx.restore();
}

/**
 * A hand at the end of a forearm running along `d`: the back of the hand,
 * then the fingers and thumb as the hand's job asks, printed like the
 * rest, with the knuckles and the gaps between fingers keyed in.
 */
function paintHand(ctx: CanvasRenderingContext2D, wrist: Pt, d: Pt, hand: Hand, skin: Inks, print: Print, h: number, f: 1 | -1): void {
  const small = (k = 1): Print => ({ ...print, shade: print.shade * 0.35 * k, catch: print.catch * 0.7, keyWidth: print.keyWidth * 0.62 });
  const m = { x: -d.y, y: d.x };
  if (hand.kind === "push") {
    // The wrist bent back, the palm flat on the load, fingers up and a little apart.
    const p = rotate(d, -f * 1.25);
    const q = { x: -p.y, y: p.x };
    const at = framed(add(wrist, d, 0.06 * h), p, q, h);
    printShape(ctx, smoothClosed([at(-0.06, -0.17), at(0.4, -0.2), at(0.46, 0.0), at(0.4, 0.2), at(-0.06, 0.18)]), skin, small(1.4));
    for (const [v, l] of [
      [-0.15, 0.3],
      [-0.05, 0.36],
      [0.05, 0.34],
      [0.15, 0.27],
    ] as const) {
      printShape(ctx, chain([at(0.36, v), at(0.38 + l * 0.5, v * 1.15), at(0.38 + l, v * 1.3)], [0.055 * h, 0.05 * h, 0.042 * h]), skin, small());
    }
    printShape(ctx, chain([at(0.06, 0.18 * -f), at(0.22, 0.3 * -f), at(0.36, 0.34 * -f)], [0.07 * h, 0.06 * h, 0.05 * h]), skin, small());
    return;
  }
  const at = framed(wrist, d, m, h);
  const c = hand.curl ?? 1;
  // The back of the hand, wider at the knuckles.
  printShape(ctx, smoothClosed([at(-0.06, -0.16), at(0.3, -0.2), at(0.5, -0.17), at(0.54, 0.0), at(0.5, 0.17), at(0.3, 0.2), at(-0.06, 0.16)]), skin, small(1.4));
  if (hand.kind === "point") {
    // Three fingers folded under, the index straight out, the thumb along it.
    printShape(ctx, smoothClosed([at(0.4, 0.02 * c), at(0.6, 0.06 * c), at(0.62, 0.2 * c), at(0.42, 0.22 * c)]), skin, small());
    printShape(ctx, chain([at(0.44, -0.08 * c), at(0.7, -0.09 * c), at(0.92, -0.09 * c)], [0.06 * h, 0.055 * h, 0.045 * h]), skin, small());
    printShape(ctx, chain([at(0.14, -0.16 * c), at(0.34, -0.2 * c), at(0.5, -0.17 * c)], [0.065 * h, 0.055 * h, 0.045 * h]), skin, small());
    return;
  }
  // Grip: the fingers hook round the bar, the gaps between them keyed, the thumb closing from the other side.
  const hook = chain([at(0.46, -0.05 * c), at(0.66, 0.08 * c), at(0.64, 0.26 * c), at(0.48, 0.32 * c)], [0.11 * h, 0.1 * h, 0.09 * h, 0.07 * h]);
  printShape(ctx, hook, skin, small());
  ctx.save();
  ctx.clip(hook.path);
  ctx.strokeStyle = print.key;
  ctx.lineWidth = print.keyWidth * 0.45;
  ctx.lineCap = "round";
  for (const k of [-0.035, 0.035]) {
    const a = at(0.5 + k, 0.0);
    const b = at(0.64 + k, 0.16 * c);
    const e = at(0.54 + k, 0.3 * c);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(b.x, b.y, e.x, e.y);
    ctx.stroke();
  }
  ctx.restore();
  // Knuckles catching the light.
  ctx.fillStyle = skin.light;
  for (const v of [-0.12, -0.04, 0.04, 0.12]) {
    const k = at(0.5, v);
    ctx.beginPath();
    ctx.arc(k.x, k.y, 0.03 * h, 0, Math.PI * 2);
    ctx.fill();
  }
  printShape(ctx, chain([at(0.1, -0.16 * c), at(0.32, -0.22 * c), at(0.46, -0.12 * c)], [0.075 * h, 0.06 * h, 0.05 * h]), skin, small());
}

export function paintSapper(ctx: CanvasRenderingContext2D, rig: SapperRig, inks: SapperInks, print: Print): void {
  const { h, u, n, hu, hf, facing: f } = rig;
  const P = (extra: Partial<Print> = {}): Print => ({ ...print, ...extra });
  const body = framed(rig.hip, n, u, h);
  const shade = print.shade;

  /** Which side of a->b (left 0, right 1) faces his front. */
  const frontSide = (a: Pt, b: Pt) => {
    const d = unit(sub(b, a));
    return -d.y * n.x + d.x * n.y > 0 ? 0 : 1;
  };
  const swell = (a: Pt, b: Pt, front: number, back: number): [number, number] =>
    frontSide(a, b) === 0 ? [front * h, back * h] : [back * h, front * h];

  const leg = (s: Side, cloth: Inks) => {
    const shinDir = unit(sub(s.ankle, s.knee));
    const foot = add(s.ankle, shinDir, -0.22 * h);
    // One trouser leg from hip to boot: the thigh's quads in front, the calf behind.
    const trouser = chain([s.hip, s.knee, foot], [0.52 * h, 0.33 * h, 0.27 * h], [swell(s.hip, s.knee, 0.08, 0.05), swell(s.knee, foot, 0.0, 0.11)]);
    printShape(ctx, trouser, cloth, P());
    // The knee's crease, where the cloth pulls.
    within(ctx, trouser, () => {
      ctx.strokeStyle = cloth.shadow;
      ctx.lineWidth = 0.05 * h;
      ctx.lineCap = "round";
      const k0 = add(s.knee, unit(sub(s.hip, s.knee)), 0.5 * h);
      const k1 = add(s.knee, shinDir, 0.2 * h);
      ctx.beginPath();
      ctx.moveTo(k0.x, k0.y);
      ctx.quadraticCurveTo(s.knee.x, s.knee.y, k1.x, k1.y);
      ctx.stroke();
    });
    // Trousers bloused over the boot top.
    const blouse = limb(add(s.ankle, shinDir, -0.38 * h), add(s.ankle, shinDir, -0.12 * h), 0.3 * h, 0.31 * h);
    printShape(ctx, blouse, cloth, P({ shade: shade * 0.7 }));
    const b = boot(s.ankle, s.toe, f, h);
    printShape(ctx, b.boot, inks.boot, P({ shade: shade * 0.6 }));
    printShape(ctx, b.sole, { base: print.key, light: inks.boot.base, shadow: print.key }, P({ shade: 0, catch: 0, keyWidth: print.keyWidth * 0.6 }));
    // Laces: three short bars up the front of the boot.
    ctx.save();
    ctx.strokeStyle = inks.boot.light;
    ctx.lineWidth = 0.05 * h;
    const at = framed(s.ankle, rotate({ x: f, y: 0 }, s.toe * f), rotate({ x: 0, y: -1 }, s.toe * f), h);
    for (let i = 0; i < 3; i += 1) {
      const a = at(0.08 + i * 0.07, 0.36 - i * 0.14);
      const c = at(0.24 + i * 0.07, 0.32 - i * 0.14);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const arm = (s: Side, cloth: Inks, skin: Inks) => {
    const upperDir = unit(sub(s.elbow, s.shoulder));
    const foreDir = unit(sub(s.wrist, s.elbow));
    // Bare forearm: the muscle full near the elbow, the wrist slim.
    const forearm = chain([add(s.elbow, upperDir, -0.1 * h), s.wrist], [0.26 * h, 0.16 * h], [swell(s.elbow, s.wrist, 0.05, 0.03)]);
    printShape(ctx, forearm, skin, P());
    paintHand(ctx, s.wrist, foreDir, s.hand, skin, P(), h, f);
    // The shirt sleeve over the shoulder and the upper arm, rolled above the elbow.
    const upper = chain([add(s.shoulder, upperDir, 0.05 * h), add(s.elbow, upperDir, -0.3 * h)], [0.34 * h, 0.27 * h], [swell(s.shoulder, s.elbow, 0.02, 0.05)]);
    printShape(ctx, upper, cloth, P());
    // The roll: a flat band, its folds as two lines.
    const un = { x: -upperDir.y * 0.29 * h, y: upperDir.x * 0.29 * h };
    const c0 = add(s.elbow, upperDir, -0.48 * h);
    const c1 = add(s.elbow, upperDir, -0.12 * h);
    const roll = polygon([add(c0, un), add(c1, un, 1.04), add(c1, un, -1.04), add(c0, un, -1)]);
    printShape(ctx, roll, inks.cuff, P({ shade: shade * 0.8 }));
    within(ctx, roll, () => {
      ctx.strokeStyle = inks.cuff.shadow;
      ctx.lineWidth = 0.04 * h;
      const m0 = add(add(s.elbow, upperDir, -0.3 * h), un);
      const m1 = add(add(s.elbow, upperDir, -0.3 * h), un, -1);
      ctx.beginPath();
      ctx.moveTo(m0.x, m0.y);
      ctx.lineTo(m1.x, m1.y);
      ctx.stroke();
    });
  };

  // Far side first: it sits in shadow, one step darker.
  leg(rig.far, inks.clothFar);
  arm(rig.far, inks.clothFar, inks.skinFar);

  // The pack and the shovel strapped to it.
  const handle = limb(body(-0.82, 1.9), body(-1.0, 3.05), 0.07 * h, 0.07 * h);
  printShape(ctx, handle, inks.wood, P({ shade: 0.05 * h, catch: 0.03 * h, keyWidth: print.keyWidth * 0.7 }));
  const grip = limb(body(-1.2, 3.05), body(-0.8, 3.08), 0.07 * h, 0.07 * h);
  printShape(ctx, grip, inks.wood, P({ shade: 0.05 * h, catch: 0.03 * h, keyWidth: print.keyWidth * 0.7 }));
  const pack = pad([body(-0.45, 1.0), body(-1.08, 1.02), body(-1.12, 2.08), body(-0.45, 2.16)]);
  printShape(ctx, pack, inks.clothFar, P());
  const blade = smoothClosed([body(-0.62, 1.15), body(-1.2, 1.12), body(-1.0, 0.62), body(-0.85, 0.52), body(-0.7, 0.66)]);
  printShape(ctx, blade, inks.steel, P({ shade: shade * 0.7 }));
  const flap = pad([body(-0.44, 1.72), body(-1.14, 1.7), body(-1.13, 2.16), body(-0.44, 2.22)], 0.3);
  printShape(ctx, flap, inks.cloth, P({ shade: shade * 0.5 }));

  leg(rig.near, inks.cloth);

  // Torso: chest forward, shoulder blades and the small of the back behind.
  const torso = smoothClosed([
    body(0.55, -0.05),
    body(0.66, 0.45),
    body(0.7, 0.95),
    body(0.84, 1.5),
    body(0.8, 1.98),
    body(0.52, 2.32),
    body(0.26, 2.52),
    body(-0.3, 2.52),
    body(-0.62, 2.36),
    body(-0.74, 1.9),
    body(-0.6, 1.3),
    body(-0.5, 0.8),
    body(-0.66, 0.3),
    body(-0.58, -0.2),
    body(0.0, -0.32),
  ]);
  printShape(ctx, torso, inks.cloth, P());
  // A crease or two where the shirt bunches over the belt, and a pocket flap on the chest.
  within(ctx, torso, () => {
    ctx.strokeStyle = inks.cloth.shadow;
    ctx.lineWidth = 0.05 * h;
    ctx.lineCap = "round";
    for (const [a, b] of [
      [body(0.1, 0.62), body(0.5, 0.95)],
      [body(-0.2, 0.7), body(0.2, 1.1)],
      [body(-0.4, 1.4), body(0.05, 1.75)],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Braces of the webbing: over the shoulder, down to the belt front and back.
    for (const [a, b] of [
      [body(0.12, 2.42), body(0.52, 0.55)],
      [body(-0.2, 2.44), body(-0.48, 0.55)],
    ] as const) {
      const d = unit(sub(b, a));
      const w = { x: -d.y * 0.1 * h, y: d.x * 0.1 * h };
      const a0 = add(a, d, -0.6 * h);
      const strap = polygon([add(a0, w), add(b, w), add(b, w, -1), add(a0, w, -1)]);
      printShape(ctx, strap, inks.web, P({ shade: 0.06 * h, catch: 0.03 * h, keyWidth: print.keyWidth * 0.6 }));
    }
    // The belt: a band round the waist.
    const belt = polygon([body(-1, 0.32), body(1, 0.32), body(1, 0.62), body(-1, 0.62)]);
    printShape(ctx, belt, inks.web, P({ shade: 0.08 * h, catch: 0.04 * h, keyWidth: print.keyWidth * 0.7 }));
  });
  // Ammunition pouches on the belt's front, the canteen at the back hip.
  const pouch = polygon([body(0.3, 0.16), body(0.72, 0.16), body(0.74, 0.74), body(0.3, 0.74)]);
  printShape(ctx, pouch, inks.web, P({ shade: 0.08 * h, keyWidth: print.keyWidth * 0.7 }));
  printShape(ctx, polygon([body(0.28, 0.5), body(0.76, 0.5), body(0.76, 0.78), body(0.28, 0.78)]), inks.web, P({ shade: 0.04 * h, catch: 0.04 * h, keyWidth: print.keyWidth * 0.7 }));

  // Neck, head, face in the shadow of the brim.
  const neck = limb(add(rig.neck, u, -0.25 * h), add(rig.neck, hu, 0.3 * h), 0.27 * h, 0.25 * h);
  printShape(ctx, neck, inks.skin, P());
  const at = framed(rig.head, hf, hu, h);
  // A hard profile: brow, a broken nose, the mouth open on gritted teeth, a square chin and jaw.
  const skull = smoothClosed([
    at(-0.08, 0.56),
    at(0.36, 0.42),
    at(0.48, 0.16),
    at(0.43, 0.05),
    at(0.5, 0.0),
    at(0.68, -0.15),
    at(0.52, -0.21),
    at(0.56, -0.26),
    at(0.47, -0.31),
    at(0.55, -0.37),
    at(0.57, -0.5),
    at(0.44, -0.6),
    at(0.12, -0.54),
    at(-0.16, -0.36),
    at(-0.34, -0.16),
    at(-0.46, 0.08),
    at(-0.38, 0.4),
  ]);
  printShape(ctx, skull, inks.skin, P({ shade: print.shade * 0.8 }));
  within(ctx, skull, () => {
    // The side of the head turned from the dawn: one flat shadow plane from the cheekbone back, screened.
    const plane = smoothClosed([at(0.3, 0.02), at(0.24, -0.2), at(0.3, -0.42), at(0.16, -0.62), at(-0.6, -0.6), at(-0.6, 0.1)]);
    ctx.fillStyle = inks.skin.shadow;
    ctx.globalAlpha = 0.82;
    ctx.fill(plane.path);
    ctx.globalAlpha = 1;
    if (print.dots) screen(ctx, plane.box, print.dots.step * 0.7, Math.PI / 4, () => print.dots?.size ?? 0.4, print.dots.ink);
    // The brim's shadow over the eyes.
    ctx.fillStyle = inks.skin.shadow;
    ctx.fill(polygon([at(-0.6, 0.4), at(0.9, 0.4), at(0.9, 0.04), at(-0.6, -0.06)]).path);
    // The eye narrowed in the shadow, a glint, the brow knotted over it.
    ctx.strokeStyle = print.key;
    ctx.lineCap = "round";
    ctx.lineWidth = 0.06 * h;
    const e0 = at(0.3, 0.07);
    const e1 = at(0.44, 0.05);
    ctx.beginPath();
    ctx.moveTo(e0.x, e0.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.stroke();
    // The cheekbone and the line from nose to mouth, lit and keyed.
    ctx.lineWidth = 0.035 * h;
    const n0 = at(0.5, -0.17);
    const n1 = at(0.42, -0.3);
    ctx.beginPath();
    ctx.moveTo(n0.x, n0.y);
    ctx.quadraticCurveTo(at(0.4, -0.22).x, at(0.4, -0.22).y, n1.x, n1.y);
    ctx.stroke();
    // The jaw muscle bunched, a hard line from the ear to the chin.
    const j0 = at(-0.02, -0.18);
    const j1 = at(0.3, -0.52);
    ctx.beginPath();
    ctx.moveTo(j0.x, j0.y);
    ctx.quadraticCurveTo(at(0.06, -0.46).x, at(0.06, -0.46).y, j1.x, j1.y);
    ctx.stroke();
  });
  // The light on the bridge of the nose and the cheek: a warm rim from the dawn.
  ctx.save();
  ctx.strokeStyle = inks.skin.light;
  ctx.lineCap = "round";
  ctx.lineWidth = 0.05 * h;
  ctx.beginPath();
  const bridge = at(0.5, -0.01);
  ctx.moveTo(bridge.x, bridge.y);
  ctx.lineTo(at(0.64, -0.14).x, at(0.64, -0.14).y);
  ctx.moveTo(at(0.56, -0.39).x, at(0.56, -0.39).y);
  ctx.lineTo(at(0.55, -0.5).x, at(0.55, -0.5).y);
  ctx.stroke();
  ctx.restore();
  // Gritted teeth in the open mouth.
  const teeth = polygon([at(0.46, -0.27), at(0.555, -0.265), at(0.55, -0.355), at(0.46, -0.345)]);
  printShape(ctx, teeth, { base: "#fbf0d8", light: "#ffffff", shadow: "#c9b08c" }, P({ shade: 0, catch: 0, keyWidth: print.keyWidth * 0.5, dots: undefined }));
  ctx.save();
  ctx.strokeStyle = print.key;
  ctx.lineWidth = 0.025 * h;
  const t0 = at(0.46, -0.31);
  const t1 = at(0.55, -0.31);
  ctx.beginPath();
  ctx.moveTo(t0.x, t0.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.stroke();
  ctx.restore();
  const ear = smoothClosed([at(-0.08, 0.06), at(0.05, 0.03), at(0.03, -0.2), at(-0.12, -0.18)]);
  printShape(ctx, ear, inks.skinFar, P({ shade: 0.05 * h, catch: 0.02 * h, keyWidth: print.keyWidth * 0.7 }));

  // The steel helmet, tipped forward a little; a plain dome with a short flared brim.
  const tip = framed(rig.head, rotate(hf, -0.12 * f), rotate(hu, -0.12 * f), h);
  const dome: Pt[] = [];
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI - (i / 10) * Math.PI;
    dome.push(tip(Math.cos(a) * 0.62, 0.14 + Math.sin(a) * 0.6));
  }
  const helmet = smoothClosed([tip(-0.74, 0.04), ...dome, tip(0.78, 0.06), tip(0.76, -0.02), tip(-0.76, -0.04)]);
  printShape(ctx, helmet, inks.steel, P({ catch: print.catch * 1.6 }));
  // The chin strap, and the brim's edge catching the sky.
  ctx.save();
  ctx.strokeStyle = inks.web.shadow;
  ctx.lineWidth = 0.06 * h;
  ctx.lineCap = "round";
  const s0 = tip(0.02, 0.02);
  const s1 = at(0.36, -0.58);
  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  ctx.quadraticCurveTo(at(0.1, -0.4).x, at(0.1, -0.4).y, s1.x, s1.y);
  ctx.stroke();
  ctx.strokeStyle = inks.steel.light;
  ctx.lineWidth = 0.05 * h;
  const r0 = tip(-0.5, 0.04);
  const r1 = tip(0.74, 0.04);
  ctx.beginPath();
  ctx.moveTo(r0.x, r0.y);
  ctx.lineTo(r1.x, r1.y);
  ctx.stroke();
  ctx.restore();

  arm(rig.near, inks.cloth, inks.skin);
}

/** Where his boots meet the ground, for a cast shadow. */
export function footprint(rig: SapperRig): { x0: number; x1: number; y: number } {
  const xs = [rig.near.ankle.x, rig.far.ankle.x];
  const pad = rig.h * 1.1;
  return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y: Math.max(rig.near.ankle.y, rig.far.ankle.y) + 0.36 * rig.h };
}
