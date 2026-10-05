import { palette } from "@/design/tokens";
import { AVENUE, type Block } from "./cityLayout";
import { createRandom } from "./world";

/** A self-lit block (neon, lobby, lamp head): its colour and HDR intensity. */
export type Glow = Block & { color: string; intensity: number };
/** A window pane facing +z, origin at its centre. */
export type Pane = { x: number; y: number; z: number; w: number; h: number; color: string; intensity: number };
/** A box lit by the scene (paving, lamp posts), with its colour. */
export type Solid = Block & { color: string };

/** One stacked tier of the tower: centred on the axis, from `y` to `top`. */
export type Tier = { w: number; d: number; y: number; top: number };

export type LandmarkLayout = {
  /** Tiers, crown, fins and spire, in the skyline's silhouette style. */
  blocks: Block[];
  glows: Glow[];
  panes: Pane[];
  /** Sidewalks along the avenue, the plaza, and lamp posts. */
  ground: Solid[];
};

/**
 * The landmark that closes the vista: an art-deco tower on the avenue axis
 * just beyond the skyline, where the road ends. Miami's Freedom Tower and
 * the Chrysler crown in spirit: a podium on the plaza, a shaft with piers,
 * setback tiers, a crown of stacked setbacks with vertical fins and neon
 * bands, and a spire. World metres; the city ground is at y 0.3.
 */
export const LANDMARK = {
  x: 0,
  z: -318,
  /** Podium, shaft, two setbacks and four crown steps, bottom to top. */
  tiers: [
    { w: 46, d: 30, y: 0, top: 12 },
    { w: 28, d: 22, y: 12, top: 64 },
    { w: 22, d: 17.5, y: 64, top: 76 },
    { w: 17, d: 13.5, y: 76, top: 85 },
    { w: 13, d: 10.5, y: 85, top: 90 },
    { w: 10, d: 8, y: 90, top: 94 },
    { w: 7.2, d: 5.8, y: 94, top: 97 },
    { w: 4.6, d: 3.8, y: 97, top: 99.5 },
  ] as readonly Tier[],
  spire: { w: 1.1, top: 110, needle: 0.45, tip: 118 },
} as const;

/** Top of the crown, without the spire. */
export const CROWN_TOP = LANDMARK.tiers[LANDMARK.tiers.length - 1].top;

/** The plaza at the tower's foot, where the avenue ends. */
export const PLAZA = {
  halfWidth: 30,
  zFrom: AVENUE.zTo,
  zTo: LANDMARK.z + LANDMARK.tiers[0].d / 2,
} as const;

/** Sidewalks between the curb and the building line, from the promenade to the plaza. */
export const SIDEWALK = { inner: 8.6, zFrom: -184.5, top: 0.36 } as const;

const NEON = { pink: palette.pink, magenta: palette.magenta };
const NEON_INTENSITY = 3.4;
const LIT_WINDOW = "#ffd9a0";
/** Unlit glass catches the afterglow: lighter than the facade, not lit. */
const SKY_GLASS = "#a07ac8";
const PAVING = "#dcc0d2";
const PLAZA_STONE = "#ecd2dc";
const FLOOR = 3;
/**
 * Panes, signs and neon stand this far proud of the face behind them: at
 * 330 m the depth buffer resolves about 3.5 cm, and a thinner gap shimmers.
 */
const PROUD = 0.18;

/** How far the fins stand out of the faces; they sink a little into them too. */
const FIN_DEPTH = 1.1;
const FIN_SINK = 0.4;
const FIN_WIDTH = 1.1;

function face(tier: Tier): number {
  return LANDMARK.z + tier.d / 2;
}

/** Vertical fins on a tier's front face at the given x offsets, rising `rise` above it. */
function frontFins(blocks: Block[], tier: Tier, xs: number[], rise: number) {
  for (const x of xs) {
    blocks.push({
      x: LANDMARK.x + x,
      y: tier.y,
      z: face(tier) + (FIN_DEPTH - FIN_SINK) / 2,
      w: FIN_WIDTH,
      h: tier.top - tier.y + rise,
      d: FIN_DEPTH + FIN_SINK,
    });
  }
}

/** One fin in the middle of each side face, so the crown's outline is serrated. */
function sideFins(blocks: Block[], tier: Tier, rise: number) {
  for (const s of [-1, 1]) {
    blocks.push({
      x: LANDMARK.x + s * (tier.w / 2 + (FIN_DEPTH - FIN_SINK) / 2),
      y: tier.y,
      z: LANDMARK.z,
      w: FIN_DEPTH + FIN_SINK,
      h: tier.top - tier.y + rise,
      d: FIN_WIDTH,
    });
  }
}

/** A neon band wrapped around the top of a tier. */
function band(glows: Glow[], tier: Tier, color: string) {
  glows.push({
    x: LANDMARK.x,
    y: tier.top - 1.3,
    z: LANDMARK.z,
    w: tier.w + 0.5,
    h: 1.05,
    d: tier.d + 0.5,
    color,
    intensity: NEON_INTENSITY,
  });
}

/** Window bays on a tier's front face, between its fins. */
function bays(panes: Pane[], random: () => number, tier: Tier, centres: number[], width: number, from: number) {
  for (let y = from; y + 1.8 < tier.top; y += FLOOR) {
    const floorLit = random() < 0.5;
    for (const x of centres) {
      const lit = floorLit ? random() < 0.8 : random() < 0.15;
      panes.push({
        x: LANDMARK.x + x,
        y: y + 0.9,
        z: face(tier) + PROUD,
        w: width,
        h: 1.7,
        color: lit ? LIT_WINDOW : SKY_GLASS,
        intensity: lit ? 1.7 : 0.85,
      });
    }
  }
}

export function buildLandmark(seed = 1959): LandmarkLayout {
  const random = createRandom(seed);
  const blocks: Block[] = [];
  const glows: Glow[] = [];
  const panes: Pane[] = [];
  const ground: Solid[] = [];
  const [podium, shaft, setback, upper, ...crown] = LANDMARK.tiers;

  for (const tier of LANDMARK.tiers) {
    blocks.push({ x: LANDMARK.x, y: tier.y, z: LANDMARK.z, w: tier.w, h: tier.top - tier.y, d: tier.d });
  }
  // Podium cornice and a lit lobby on the plaza.
  blocks.push({ x: LANDMARK.x, y: podium.top, z: LANDMARK.z, w: podium.w + 0.8, h: 0.8, d: podium.d + 0.8 });
  glows.push({
    x: LANDMARK.x,
    y: 0.6,
    z: face(podium) + PROUD,
    w: 30,
    h: 5.4,
    d: 0.15,
    color: palette.sodium,
    intensity: 1.4,
  });
  glows.push({
    x: LANDMARK.x,
    y: podium.top - 1.4,
    z: face(podium) + 0.6,
    w: podium.w + 1.2,
    h: 0.7,
    d: 0.15,
    color: NEON.pink,
    intensity: NEON_INTENSITY,
  });

  // Piers up the shaft and the setbacks, a little above each roof line.
  frontFins(blocks, shaft, [-13.5, -8.1, -2.7, 2.7, 8.1, 13.5], 2.5);
  frontFins(blocks, setback, [-10.4, -3.5, 3.5, 10.4], 2);
  frontFins(blocks, upper, [-8, 0, 8], 1.8);
  sideFins(blocks, shaft, 2.5);
  sideFins(blocks, setback, 2);

  // Crown: fins up every step, a vertical neon line on each front fin and
  // a neon band at every roof line.
  crown.slice(0, 3).forEach((tier, i) => {
    const half = tier.w / 2 - 0.3;
    const xs = [-half, 0, half];
    frontFins(blocks, tier, xs, 1.4 - i * 0.2);
    sideFins(blocks, tier, 1.4 - i * 0.2);
    for (const x of xs) {
      glows.push({
        x: LANDMARK.x + x,
        y: tier.y + 0.6,
        z: face(tier) + FIN_DEPTH + PROUD,
        w: 0.3,
        h: tier.top - tier.y,
        d: 0.1,
        color: NEON.pink,
        intensity: NEON_INTENSITY,
      });
    }
  });
  [setback, upper, ...crown.slice(0, 3)].forEach((tier, i) => band(glows, tier, i % 2 === 0 ? NEON.magenta : NEON.pink));

  // Spire, its rings, and a beacon at the tip.
  const { spire } = LANDMARK;
  const crownTop = crown[crown.length - 1].top;
  blocks.push({ x: LANDMARK.x, y: crownTop, z: LANDMARK.z, w: spire.w, h: spire.top - crownTop, d: spire.w });
  blocks.push({ x: LANDMARK.x, y: spire.top, z: LANDMARK.z, w: spire.needle, h: spire.tip - spire.top, d: spire.needle });
  for (const y of [102, 105, 108]) {
    glows.push({ x: LANDMARK.x, y, z: LANDMARK.z, w: 1.9, h: 0.3, d: 1.9, color: NEON.pink, intensity: NEON_INTENSITY });
  }
  glows.push({ x: LANDMARK.x, y: spire.tip - 0.3, z: LANDMARK.z, w: 0.75, h: 0.75, d: 0.75, color: NEON.magenta, intensity: 4 });

  // Windows: five bays up the shaft, fewer up the setbacks.
  bays(panes, random, shaft, [-10.8, -5.4, 0, 5.4, 10.8], 3.4, shaft.y + 2);
  bays(panes, random, setback, [-6.95, 0, 6.95], 4.4, setback.y + 1);
  bays(panes, random, upper, [-4, 4], 5.2, upper.y + 1);

  // Sidewalks from the promenade to the plaza, then the plaza itself.
  const sidewalkWidth = AVENUE.halfWidth - SIDEWALK.inner;
  const sidewalkLength = SIDEWALK.zFrom - AVENUE.zTo;
  for (const s of [-1, 1]) {
    ground.push({
      x: s * (SIDEWALK.inner + sidewalkWidth / 2),
      y: 0.05,
      z: (SIDEWALK.zFrom + AVENUE.zTo) / 2,
      w: sidewalkWidth,
      h: SIDEWALK.top - 0.05,
      d: sidewalkLength,
      color: PAVING,
    });
  }
  ground.push({
    x: 0,
    y: 0.05,
    z: (PLAZA.zFrom + PLAZA.zTo) / 2,
    w: PLAZA.halfWidth * 2,
    h: SIDEWALK.top - 0.05,
    d: PLAZA.zFrom - PLAZA.zTo,
    color: PLAZA_STONE,
  });

  // Street lamps down both sidewalks and around the plaza: a line of warm
  // points that leads the eye to the tower.
  const lamps: Array<[number, number]> = [];
  for (let z = -192; z > AVENUE.zTo; z -= 15) for (const s of [-1, 1]) lamps.push([s * (SIDEWALK.inner + 1), z]);
  for (const z of [PLAZA.zFrom - 4, PLAZA.zTo + 4]) for (const s of [-1, 1]) lamps.push([s * (PLAZA.halfWidth - 6), z]);
  for (const [x, z] of lamps) {
    ground.push({ x, y: SIDEWALK.top, z, w: 0.2, h: 5.6, d: 0.2, color: palette.asphalt });
    glows.push({ x, y: SIDEWALK.top + 5.6, z, w: 0.55, h: 0.45, d: 0.55, color: palette.sodium, intensity: 2.2 });
  }

  return { blocks, glows, panes, ground };
}
