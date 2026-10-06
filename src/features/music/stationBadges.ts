/**
 * The radio's station badges (StationLogo.tsx): our own drawing and type,
 * no trademarks, no film stills or logos. One frame family for the six (an
 * enamel rim in the station's accent, a gloss, a film of grain and the
 * frequency on a tab) and, inside it, each station's illustrated mark and
 * its lockup, built to read at 44 px on a phone's wheel and to stay rich
 * at 180 px.
 *
 * Each badge is SVG markup in a 100 x 100 box clipped to a circle, made of
 * plain strings (pure, so it is tested without a DOM). Every colour is a
 * token, `--va-color-*` or `--va-radio-*` (tokens.ts), and every face a
 * `radioFonts` token or the site's mono, both set through `style` (CSS
 * variables in SVG presentation attributes are not reliable everywhere).
 * Ids carry a per-badge prefix, since several badges share one page.
 */
import type { LogoStyle } from "./stations";

type LockupOptions = {
  size: number;
  /** One of the FACES below. */
  cls: keyof typeof FACES;
  /** Squeezes the word to this width, glyphs and all. */
  len?: number;
  fill: string;
  outline?: string;
  /** Outline width; 0 for none. */
  ow?: number;
  shade?: string;
  /** Steps of the block extrusion behind the word. */
  depth?: number;
  dx?: number;
  dy?: number;
};

/** A ransom-note letter: the glyph, its face, size, chip and ink colours, chip width and height, turn and drop. */
type Chip = readonly [string, keyof typeof FACES, number, string, string, number, number, number, number];

/** A puff of smoke or spray: centre, radius and fill. */
type Puff = readonly [number, number, number, string];

/** The faces a badge sets type in, by the class name the markup uses. */
const FACES = {
  fSeventies: "font-family:var(--va-font-radio-seventies)",
  fChrome: "font-family:var(--va-font-radio-chrome);font-style:italic;font-weight:900",
  fHiphop: "font-family:var(--va-font-radio-hiphop)",
  fCaps: "font-family:var(--va-font-radio-caps);font-weight:900",
  fMono: "font-family:var(--va-font-mono);font-weight:700",
} as const;

const r2 = (n: number): number => Math.round(n * 100) / 100;
const polar = (cx: number, cy: number, deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r2(cx + r * Math.sin(a)), r2(cy - r * Math.cos(a))];
};
const INK = "var(--va-color-ink)";
const CREAM = "var(--va-color-cream)";

/* ------------------------------------------------------------------ */
/* Shared pieces                                                        */
/* ------------------------------------------------------------------ */

// A four-point sparkle with concave sides.
const spark = (x: number, y: number, r: number, fill = CREAM, extra = ""): string =>
  `<path d="M${x} ${r2(y - r)} Q${x} ${y} ${r2(x + r)} ${y} Q${x} ${y} ${x} ${r2(y + r)} Q${x} ${y} ${r2(x - r)} ${y} Q${x} ${y} ${x} ${r2(y - r)}Z" fill="${fill}" ${extra}/>`;

// A typographic lockup: an inked block extrusion in `shade`, an ink
// outline, then the face in `fill` (a colour or a gradient).
function lockup(t: string, o: LockupOptions & { x?: number; y: number; anchor?: string; g?: string; top?: string }): string {
  const { x = 50, y, size, cls, len, fill, outline = INK, ow = 2, shade, depth = 0, dx = 0.32, dy = 0.42, g = "", anchor = "middle", top = "" } = o;
  const base = `class="${cls}" font-size="${size}" text-anchor="${anchor}"${len ? ` textLength="${len}" lengthAdjust="spacingAndGlyphs"` : ""} stroke-linejoin="round"`;
  let s = "";
  for (let i = depth; i >= 1; i--)
    s += `<text ${base} x="${r2(x + i * dx)}" y="${r2(y + i * dy)}" fill="${outline}" stroke="${outline}" stroke-width="${ow}">${t}</text>`;
  for (let i = depth; i >= 1; i--)
    s += `<text ${base} x="${r2(x + i * dx)}" y="${r2(y + i * dy)}" fill="${shade}" stroke="${shade}" stroke-width="${r2(Math.max(0, ow - 1.3))}">${t}</text>`;
  if (ow) s += `<text ${base} x="${x}" y="${y}" fill="${outline}" stroke="${outline}" stroke-width="${ow}">${t}</text>`;
  s += `<text ${base} x="${x}" y="${y}" fill="${fill}">${t}</text>`;
  s += top;
  return `<g ${g}>${s}</g>`;
}

// The same lockup set on a path (textPath), for arched names.
function arcLockup(t: string, pathId: string, o: LockupOptions): string {
  const { size, cls, len, fill, outline = INK, ow = 2, shade, depth = 0, dx = 0.32, dy = 0.42 } = o;
  const tp = `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle"${len ? ` textLength="${len}" lengthAdjust="spacingAndGlyphs"` : ""}>${t}</textPath>`;
  const base = `class="${cls}" font-size="${size}" stroke-linejoin="round"`;
  let s = "";
  for (let i = depth; i >= 1; i--) s += `<text ${base} transform="translate(${r2(i * dx)} ${r2(i * dy)})" fill="${outline}" stroke="${outline}" stroke-width="${ow}">${tp}</text>`;
  for (let i = depth; i >= 1; i--) s += `<text ${base} transform="translate(${r2(i * dx)} ${r2(i * dy)})" fill="${shade}" stroke="${shade}" stroke-width="${r2(Math.max(0, ow - 1.3))}">${tp}</text>`;
  if (ow) s += `<text ${base} fill="${outline}" stroke="${outline}" stroke-width="${ow}">${tp}</text>`;
  s += `<text ${base} fill="${fill}">${tp}</text>`;
  return s;
}

// The frame family: art clipped to the badge, then grain, gloss, the
// enamel rim in the station's accent and the frequency tab.
function badge(id: string, accent: string, f: string | null, art: string, defs = ""): string {
  return `<defs>
    <clipPath id="${id}-clip"><circle cx="50" cy="50" r="49.6"/></clipPath>
    <filter id="${id}-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="${id}-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.92  0 0 0 -2.4 1.25"/>
    </filter>
    <filter id="${id}-drop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0.6" dy="1.1" stdDeviation="0.7" flood-color="var(--va-radio-shadow)" flood-opacity="0.7"/></filter>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="0.45" stop-color="var(--va-color-asphalt)"/>
      <stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </linearGradient>
    <radialGradient id="${id}-gloss" cx="0.5" cy="0" r="0.75">
      <stop offset="0" stop-color="var(--va-radio-glint)" stop-opacity="0.2"/>
      <stop offset="0.55" stop-color="var(--va-radio-glint)" stop-opacity="0.05"/>
      <stop offset="1" stop-color="var(--va-radio-glint)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-tab" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--va-color-asphalt)"/>
      <stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </linearGradient>
    ${defs}
  </defs>
  <g clip-path="url(#${id}-clip)">
    ${art}
    <rect width="100" height="100" filter="url(#${id}-grain)" opacity="0.16" style="mix-blend-mode:overlay"/>
    <ellipse cx="50" cy="12" rx="44" ry="26" fill="url(#${id}-gloss)"/>
  </g>
  <circle cx="50" cy="50" r="47.7" fill="none" stroke="url(#${id}-rim)" stroke-width="3.8"/>
  <circle cx="50" cy="50" r="45.6" fill="none" stroke="var(--va-radio-shadow)" stroke-width="0.8" opacity="0.8"/>
  <path d="M12.4 32 A41 41 0 0 1 87.6 32" fill="none" stroke="var(--va-radio-glint)" stroke-width="0.9" stroke-linecap="round" opacity="0.4" transform="translate(0 -1.4) scale(1 1)"/>
  <circle cx="50" cy="50" r="49.5" fill="none" stroke="var(--va-radio-shadow)" stroke-width="0.8"/>
  ${f ? `<g filter="url(#${id}-drop)"><rect x="36.5" y="88.2" width="27" height="9.4" rx="2.6" fill="url(#${id}-tab)" stroke="${accent}" stroke-width="0.9"/>
  <text class="fMono" font-size="6.6" x="50" y="95.1" text-anchor="middle" fill="${CREAM}" letter-spacing="0.3">${f}</text></g>` : ""}`;
}

// Round 3 (art-director pass). Changes against round 2 (logos.v2.mjs):
// BOBSLED goes cold (Calgary morning) with the sled as the hero in 3/4
// front view; RAHEEM gets a real fist; MANERO a black open collar, a
// pompadour and a comb, with the floor showing; ONE LOUDER is a chrome
// knob cranked past ten on a dial on fire; WITNESS ME trades the pin for a
// chrome spray can and sets WITNESS on one strip of tape; TOFU's car
// drifts into the hairpin with smoke off the rear tyres.

// Cartoon smoke or spray: every puff outlined in ink, then all the fills on
// top, so the outline runs round the union only.
function puffs(list: readonly Puff[], ink = INK, w = 1.4): string {
  const o = list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r2(r + w / 2)}"/>`).join("");
  const f = list.map(([x, y, r, fill]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join("");
  return `<g fill="${ink}">${o}</g>${f}`;
}

/* ------------------------------------------------------------------ */
/* BOBSLED 88.3 — reggae. Cool Runnings: a cold Calgary morning, the    */
/* four-man sled coming at us in 3/4 front view off a banked ice wall,  */
/* hull in green, gold and black, spray off the runners; name on a      */
/* ribbon.                                                              */
/* ------------------------------------------------------------------ */
function bobsled(id: string, f: string | null): string {
  const GOLD = "var(--va-radio-bobsled-gold)";
  const GREEN = "var(--va-radio-bobsled-green)";
  const DEEP = "var(--va-radio-bobsled-deep)";
  const BLACK = "var(--va-radio-bobsled-black)";
  const ICE = "var(--va-radio-bobsled-ice)";
  const SKIN = "var(--va-radio-bobsled-skin)";
  let rays = "";
  for (let i = 0; i < 16; i++) {
    const a = i * 22.5;
    const [x1, y1] = polar(25, 21, a - 4, 70);
    const [x2, y2] = polar(25, 21, a + 4, 70);
    rays += `<path d="M25 21 L${x1} ${y1} L${x2} ${y2}Z"/>`;
  }
  // The crew, back to front: helmet, shoulders, visor, chin, stripe.
  const crew = [
    [21, -18.6, 4.7],
    [11.6, -17.8, 5.3],
    [1.6, -16.6, 5.9],
    [-8.6, -15.2, 6.5],
  ]
    .map(
      ([x, y, r]) => `
      <ellipse cx="${r2(x + 1)}" cy="${r2(y + r * 1.15)}" rx="${r2(r * 1.25)}" ry="${r2(r * 0.72)}" fill="url(#${id}-suit)" stroke="${INK}" stroke-width="1"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}-helm)" stroke="${INK}" stroke-width="1.1"/>
      <path d="M${r2(x - r * 0.15)} ${r2(y - r)} Q${r2(x + r * 0.55)} ${r2(y - r * 0.55)} ${r2(x + r * 0.9)} ${r2(y + r * 0.35)}" fill="none" stroke="${GREEN}" stroke-width="${r2(r * 0.3)}"/>
      <path d="M${r2(x - r * 0.15)} ${r2(y - r)} Q${r2(x + r * 0.55)} ${r2(y - r * 0.55)} ${r2(x + r * 0.9)} ${r2(y + r * 0.35)}" fill="none" stroke="${BLACK}" stroke-width="${r2(r * 0.1)}"/>
      <path d="M${r2(x - r * 1.02)} ${r2(y - r * 0.05)} Q${r2(x - r * 0.25)} ${r2(y - r * 0.5)} ${r2(x + r * 0.42)} ${r2(y - r * 0.05)} L${r2(x + r * 0.3)} ${r2(y + r * 0.42)} Q${r2(x - r * 0.4)} ${r2(y + r * 0.2)} ${r2(x - r * 0.98)} ${r2(y + r * 0.42)}Z" fill="url(#${id}-visor)" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M${r2(x - r * 0.8)} ${r2(y + r * 0.02)} Q${r2(x - r * 0.4)} ${r2(y - r * 0.22)} ${r2(x - r * 0.05)} ${r2(y - r * 0.12)}" fill="none" stroke="${CREAM}" stroke-width="0.6" stroke-linecap="round" opacity="0.9"/>
      <path d="M${r2(x - r * 0.95)} ${r2(y + r * 0.45)} Q${r2(x - r * 0.55)} ${r2(y + r * 1.02)} ${r2(x + r * 0.1)} ${r2(y + r * 0.88)} L${r2(x + r * 0.22)} ${r2(y + r * 0.42)} Q${r2(x - r * 0.4)} ${r2(y + r * 0.24)} ${r2(x - r * 0.95)} ${r2(y + r * 0.45)}Z" fill="${SKIN}" stroke="${INK}" stroke-width="0.6"/>
      <path d="M${r2(x - r * 0.62)} ${r2(y - r * 0.62)} Q${r2(x - r * 0.2)} ${r2(y - r * 0.95)} ${r2(x + r * 0.2)} ${r2(y - r * 0.92)}" fill="none" stroke="${CREAM}" stroke-width="0.8" stroke-linecap="round"/>`,
    )
    .join("");
  const hull = "M-36 4 C-36 -3 -30 -8.6 -20 -9.4 L28 -11.4 Q33.4 -11.4 33.4 -6 L32.4 1.4 Q31.6 5 27 5.2 L-23 11.2 Q-34.4 11.6 -36 4Z";
  const art = `
    <rect width="100" height="100" fill="url(#${id}-sky)"/>
    <g fill="${CREAM}" opacity="0.32">${rays}</g>
    <circle cx="25" cy="21" r="11" fill="${GOLD}" opacity="0.55" filter="url(#${id}-soft)"/>
    <circle cx="25" cy="21" r="7.4" fill="url(#${id}-sun)" stroke="${INK}" stroke-width="1"/>
    <path d="M20.4 18.6 A5.6 5.6 0 0 1 25.4 15.6" fill="none" stroke="${CREAM}" stroke-width="1.1" stroke-linecap="round"/>
    <!-- the Rockies, snow on the peaks -->
    <path d="M-4 50 L8 40 L16 44 L30 30 L41 41 L50 35 L60 43 L74 29 L86 39 L96 34 L104 38 V70 H-4Z" fill="url(#${id}-mtn)"/>
    <path d="M30 30 L25.4 34.6 L28 34 L30 36 L32.2 33.8 L34.8 34.8Z M74 29 L69.6 33.6 L72.4 33 L74.4 35 L76.4 33 L79 34.2Z M8 40 L5 42.6 L7.6 42.2 L9.4 43.4 L11 42.4Z" fill="${CREAM}"/>
    <path d="M30 30 L41 41 M74 29 L86 39" stroke="var(--va-radio-bobsled-wall)" stroke-width="0.6" opacity="0.5"/>
    <!-- the banked ice wall, lane lines on it -->
    <path d="M-4 70 Q38 66 104 28 V104 H-4Z" fill="url(#${id}-wall)"/>
    <g fill="none" stroke-linecap="round">
      <path d="M-4 77 Q42 73 104 37" stroke="${ICE}" stroke-width="1.1" opacity="0.8"/>
      <path d="M-4 84 Q46 80 104 48" stroke="${ICE}" stroke-width="0.8" opacity="0.6"/>
      <path d="M-4 80.4 Q44 76.4 104 42.4" stroke="var(--va-radio-bobsled)" stroke-width="0.7" opacity="0.7"/>
    </g>
    <path d="M-4 70 Q38 66 104 28" fill="none" stroke="${INK}" stroke-width="1.4"/>
    <path d="M-4 68.3 Q38 64.3 104 26.3" fill="none" stroke="${CREAM}" stroke-width="2.6"/>
    <path d="M-4 66.8 Q38 62.8 104 24.8" fill="none" stroke="${INK}" stroke-width="1.1"/>
    <!-- the sled, coming at us -->
    <g transform="translate(49 50.4) rotate(-13) scale(1.07)">
      <ellipse cx="0" cy="12.4" rx="34" ry="3" fill="var(--va-radio-bobsled-wall)" opacity="0.7" filter="url(#${id}-glow)"/>
      <!-- spray off the rear runners, up the wall -->
      ${puffs(
        [
          [30, 6, 3.2, CREAM], [36, 3, 4, CREAM], [43, -1, 4.6, ICE], [40, 7.4, 3.4, CREAM], [48, 4, 3.4, CREAM], [34, 9.4, 2.4, ICE],
        ],
        INK,
        1.2,
      )}
      <g fill="${CREAM}" stroke="${INK}" stroke-width="0.5"><circle cx="50" cy="-4" r="1.3"/><circle cx="53" cy="1.6" r="1"/><circle cx="47" cy="-8.4" r="0.9"/><circle cx="54" cy="8" r="0.8"/></g>
      ${crew}
      <g clip-path="url(#${id}-hullClip)">
        <path d="${hull}" fill="${GREEN}"/>
        <path d="M-40 2.6 L40 -3.2 V20 H-40Z" fill="${GOLD}"/>
        <path d="M-40 5.6 L40 -0.6 V20 H-40Z" fill="${BLACK}"/>
        <path d="M-40 -14 L40 -14 L40 -9.6 L-40 -6Z" fill="var(--va-radio-glint)" opacity="0.18"/>
        <!-- the nose cone: a saltire in gold, rounded by light -->
        <path d="M-37 -6 L-22 12 M-37 12 L-24 -8" stroke="${GOLD}" stroke-width="2.4"/>
        <path d="M-37 -6 L-22 12 M-37 12 L-24 -8" stroke="${BLACK}" stroke-width="0.5"/>
        <ellipse cx="-27" cy="1.4" rx="10" ry="11" fill="url(#${id}-nose)"/>
      </g>
      <path d="${hull}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M-22 -11.2 Q-17 -12.4 26 -13.4" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M-31 -4.6 Q-28 -7.6 -21 -8" fill="none" stroke="${CREAM}" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M-14 -7.8 L26 -9.6" stroke="${CREAM}" stroke-width="0.7" opacity="0.7" stroke-linecap="round"/>
      <!-- runners -->
      <path d="M-20 10.8 V13.6 M18 6.6 V9.6" stroke="${INK}" stroke-width="1.4"/>
      <path d="M-33.6 10.4 Q-34 14.4 -28 14.4 L24 9.6 Q27.6 9.2 28.4 7" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M-33.6 10.4 Q-34 14.4 -28 14.4 L24 9.6 Q27.6 9.2 28.4 7" fill="none" stroke="url(#${id}-steel)" stroke-width="1" stroke-linecap="round"/>
    </g>
    <!-- the ribbon -->
    <g filter="url(#${id}-drop)">
      <path d="M15 72 L3 73.6 L8 79 L3.6 84.6 L17 84Z" fill="${DEEP}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M85 72 L97 73.6 L92 79 L96.4 84.6 L83 84Z" fill="${DEEP}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M13 70 Q50 77 87 70 L87 82 Q50 89 13 82Z" fill="url(#${id}-band)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M14.5 72 Q50 79 85.5 72 M14.5 80.2 Q50 87.2 85.5 80.2" fill="none" stroke="${GOLD}" stroke-width="0.7"/>
    </g>
    <path id="${id}-arc" d="M16 79.4 Q50 86.4 84 79.4" fill="none"/>
    ${arcLockup("BOBSLED", `${id}-arc`, { size: 11.6, cls: "fSeventies", len: 62, fill: `url(#${id}-type)`, shade: BLACK, depth: 3, ow: 1.8, dx: 0.3, dy: 0.4 })}`;
  const defs = `
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--va-radio-bobsled-sky-deep)"/><stop offset="0.55" stop-color="var(--va-radio-bobsled-sky)"/><stop offset="0.75" stop-color="${CREAM}"/>
    </linearGradient>
    <radialGradient id="${id}-sun" cx="0.38" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="var(--va-color-orange)"/>
    </radialGradient>
    <linearGradient id="${id}-mtn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--va-radio-bobsled-ice-deep)"/><stop offset="0.5" stop-color="var(--va-radio-bobsled-sky)"/>
    </linearGradient>
    <linearGradient id="${id}-wall" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0.2" stop-color="var(--va-radio-bobsled-ice-deep)"/><stop offset="0.75" stop-color="var(--va-radio-bobsled-wall)"/>
    </linearGradient>
    <clipPath id="${id}-hullClip"><path d="${hull}"/></clipPath>
    <radialGradient id="${id}-nose" cx="0.35" cy="0.3" r="0.65">
      <stop offset="0" stop-color="var(--va-radio-glint)" stop-opacity="0.55"/><stop offset="0.5" stop-color="var(--va-radio-glint)" stop-opacity="0.08"/><stop offset="1" stop-color="var(--va-radio-glint)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-helm" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.4" stop-color="${GOLD}"/><stop offset="1" stop-color="var(--va-color-orange)"/>
    </radialGradient>
    <linearGradient id="${id}-visor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--va-color-dusk)"/><stop offset="0.6" stop-color="${BLACK}"/>
    </linearGradient>
    <linearGradient id="${id}-suit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GREEN}"/><stop offset="1" stop-color="${BLACK}"/>
    </linearGradient>
    <linearGradient id="${id}-steel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="1" stop-color="${ICE}"/>
    </linearGradient>
    <linearGradient id="${id}-band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GREEN}"/><stop offset="1" stop-color="${DEEP}"/>
    </linearGradient>
    <linearGradient id="${id}-type" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.2" stop-color="${CREAM}"/><stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>`;
  return badge(id, "var(--va-radio-bobsled)", f, art, defs);
}

/* ------------------------------------------------------------------ */
/* RAHEEM 92.9 — hip-hop. Do the Right Thing: a raised fist with the    */
/* gold four-finger LOVE ring, knuckles, the thumb across, the wrist,   */
/* in front of the boombox on a heatwave; arched block name.            */
/* ------------------------------------------------------------------ */
function raheem(id: string, f: string | null): string {
  const GOLD = "var(--va-radio-raheem-gold)";
  const DEEPG = "var(--va-radio-raheem-gold-deep)";
  const BRICK = "var(--va-radio-raheem-brick)";
  const SKIN = `url(#${id}-skin)`;
  const SKIN_D = "var(--va-radio-raheem-skin-deep)";
  const SKIN_L = "var(--va-radio-raheem-skin-light)";
  const speaker = (cx: number) => `
    <circle cx="${cx}" cy="51" r="12.6" fill="url(#${id}-chrome)" stroke="${INK}" stroke-width="1"/>
    <circle cx="${cx}" cy="51" r="10.2" fill="url(#${id}-cone)" stroke="${INK}" stroke-width="0.8"/>
    <circle cx="${cx}" cy="51" r="6.9" fill="none" stroke="var(--va-color-asphalt)" stroke-width="0.8"/>
    <circle cx="${cx}" cy="51" r="3.5" fill="url(#${id}-cap)" stroke="${INK}" stroke-width="0.6"/>
    <circle cx="${r2(cx - 1.1)}" cy="49.9" r="1" fill="${CREAM}" opacity="0.8"/>`;
  // Four proximal segments, knuckles up.
  const W = 11.6;
  const X0 = 26.8;
  const tops = [50.6, 47.6, 48.2, 51.2];
  const fingers = tops
    .map((top, i) => {
      const x = r2(X0 + i * W);
      return `<path d="M${x} 74 V${r2(top + 4.6)} Q${x} ${top} ${r2(x + W / 2)} ${top} Q${r2(x + W)} ${top} ${r2(x + W)} ${r2(top + 4.6)} V74Z" fill="${SKIN}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
        <ellipse cx="${r2(x + W * 0.42)}" cy="${r2(top + 2.6)}" rx="${r2(W * 0.26)}" ry="1.3" fill="${SKIN_L}" opacity="0.9"/>
        <path d="M${r2(x + 3)} ${r2(top + 6.6)} q${r2(W / 2 - 3)} 1.3 ${r2(W - 6)} 0" fill="none" stroke="${SKIN_D}" stroke-width="0.7" stroke-linecap="round"/>`;
    })
    .join("");
  // The curled middle segments under the ring, the thumb across them.
  const curls = [0, 1, 2, 3]
    .map((i) => {
      const x = r2(X0 + 0.6 + i * W);
      return `<rect x="${x}" y="72" width="${r2(W - 1.2)}" height="10.4" rx="4" fill="${SKIN}" stroke="${INK}" stroke-width="1"/>
        <path d="M${r2(x + 2.4)} 74.4 h${r2(W - 6)}" stroke="${SKIN_L}" stroke-width="0.9" stroke-linecap="round"/>`;
    })
    .join("");
  const letters = ["L", "O", "V", "E"]
    .map((c, i) => {
      const x = r2(X0 + W / 2 + i * W);
      return `<text class="fHiphop" font-size="9" x="${x}" y="66.6" text-anchor="middle" fill="${CREAM}" opacity="0.75">${c}</text>
        <text class="fHiphop" font-size="9" x="${x}" y="66" text-anchor="middle" fill="${INK}">${c}</text>`;
    })
    .join("");
  const art = `
    <rect width="100" height="100" fill="url(#${id}-heat)"/>
    <rect width="100" height="100" fill="url(#${id}-dots)" mask="url(#${id}-fade)"/>
    <circle cx="50" cy="30" r="20" fill="var(--va-color-sodium)" opacity="0.9"/>
    <g fill="none" stroke="${CREAM}" stroke-width="1.2" stroke-linecap="round" opacity="0.55">
      <path d="M22 16 q5 -2.6 10 0 t10 0 t10 0 t10 0 t10 0 t10 0"/><path d="M14 23 q5 -2.6 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0"/>
    </g>
    <!-- the boombox behind -->
    <g filter="url(#${id}-drop)">
      <path d="M33 35 V29.5 Q33 26.5 36 26.5 H64 Q67 26.5 67 29.5 V35" fill="none" stroke="${INK}" stroke-width="3.6"/>
      <path d="M33 35 V29.5 Q33 26.5 36 26.5 H64 Q67 26.5 67 29.5 V35" fill="none" stroke="url(#${id}-chrome)" stroke-width="1.6"/>
      <rect x="4" y="34" width="92" height="33" rx="4.5" fill="url(#${id}-box)" stroke="${INK}" stroke-width="1.2"/>
      <path d="M6.5 36.3 H93.5" stroke="var(--va-color-lilac)" stroke-width="0.9" stroke-linecap="round"/>
      ${speaker(16)}${speaker(84)}
      <rect x="37" y="37.6" width="26" height="8.4" rx="1.4" fill="${INK}" stroke="url(#${id}-chrome)" stroke-width="0.8"/>
      <circle cx="44" cy="41.8" r="2.1" fill="none" stroke="${GOLD}" stroke-width="0.7"/><circle cx="56" cy="41.8" r="2.1" fill="none" stroke="${GOLD}" stroke-width="0.7"/>
    </g>
    <!-- the fist: wrist, the mass of the hand, fingers, ring, thumb -->
    <g filter="url(#${id}-drop)">
      <path d="M31 112 L33 88 H67 L70 112Z" fill="${SKIN}" stroke="${INK}" stroke-width="1.1"/>
      <path d="M66.4 92 L68.4 112" stroke="var(--va-color-lilac)" stroke-width="1.1" opacity="0.8"/>
      <path d="M24.6 60 V82 Q24.6 92 33 94 H66 Q73.6 90 74.6 80 L74.4 60Z" fill="${SKIN_D}" stroke="${INK}" stroke-width="1.1"/>
      ${fingers}
      ${curls}
      <path d="M73.6 62 Q75.6 72 72.6 82" fill="none" stroke="var(--va-color-lilac)" stroke-width="1" stroke-linecap="round" opacity="0.85"/>
      <!-- the ring: one gold plate across the four fingers -->
      <rect x="24" y="56.6" width="52" height="12.4" rx="3.2" fill="url(#${id}-gold)" stroke="${INK}" stroke-width="1.2"/>
      <rect x="25.8" y="58.1" width="48.4" height="9.4" rx="2" fill="none" stroke="${CREAM}" stroke-width="0.6" opacity="0.75"/>
      <path d="M38.4 58.2 V67.4 M50 58.2 V67.4 M61.6 58.2 V67.4" stroke="${DEEPG}" stroke-width="0.8"/>
      ${letters}
      <path d="M29 56.8 L35 56.8 L28.4 68.8 L25 68.8Z M37.5 56.8 L39.6 56.8 L33 68.8 L31 68.8Z" fill="var(--va-radio-glint)" opacity="0.4"/>
      <!-- the thumb, folded across the curled fingers -->
      <path d="M21.6 98 Q19.6 84 28.6 79.2 L51 77.4 Q57.8 77.2 57.8 81.6 Q57.8 86 51.6 86.4 L35 88 Q28.6 89.6 27.6 98Z" fill="${SKIN}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M50 78.6 Q55.6 78.6 55.8 81.6 Q55.8 84.6 50.4 84.8 Q48.4 81.8 50 78.6Z" fill="${SKIN_L}" stroke="${INK}" stroke-width="0.6"/>
      <path d="M29 81.6 Q36 80 46 79.6" fill="none" stroke="${SKIN_L}" stroke-width="1" stroke-linecap="round"/>
      <path d="M42 80 Q43.6 83 42.4 86.4" fill="none" stroke="${SKIN_D}" stroke-width="0.7"/>
    </g>
    ${spark(76, 57.6, 4.6)}${spark(23.6, 72, 2.6)}${spark(70.6, 50, 1.8)}
    <!-- the name -->
    <path id="${id}-arc" d="M15 31 Q50 16 85 31" fill="none"/>
    ${arcLockup("RAHEEM", `${id}-arc`, { size: 15.5, cls: "fHiphop", len: 66, fill: `url(#${id}-type)`, shade: BRICK, depth: 5, ow: 2.4 })}`;
  const defs = `
    <radialGradient id="${id}-heat" cx="0.5" cy="0.3" r="0.8">
      <stop offset="0" stop-color="var(--va-color-sodium)"/>
      <stop offset="0.4" stop-color="var(--va-radio-raheem)"/>
      <stop offset="1" stop-color="${BRICK}"/>
    </radialGradient>
    <pattern id="${id}-dots" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <circle cx="1.3" cy="1.3" r="0.75" fill="${BRICK}"/>
    </pattern>
    <linearGradient id="${id}-fadeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="var(--va-radio-shadow)"/><stop offset="1" stop-color="var(--va-radio-glint)"/></linearGradient>
    <mask id="${id}-fade"><rect width="100" height="100" fill="url(#${id}-fadeG)"/></mask>
    <linearGradient id="${id}-chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.5" stop-color="var(--va-color-lilac)"/><stop offset="0.55" stop-color="var(--va-color-asphalt)"/><stop offset="1" stop-color="${CREAM}"/>
    </linearGradient>
    <radialGradient id="${id}-cone" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stop-color="var(--va-color-asphalt)"/><stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </radialGradient>
    <radialGradient id="${id}-cap" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="var(--va-color-lilac)"/><stop offset="1" stop-color="${INK}"/></radialGradient>
    <linearGradient id="${id}-box" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--va-color-ink)"/><stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </linearGradient>
    <linearGradient id="${id}-skin" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="${SKIN_L}"/><stop offset="0.45" stop-color="var(--va-radio-raheem-skin)"/><stop offset="1" stop-color="${SKIN_D}"/>
    </linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.3" stop-color="${GOLD}"/><stop offset="0.62" stop-color="${GOLD}"/><stop offset="1" stop-color="${DEEPG}"/>
    </linearGradient>
    <linearGradient id="${id}-type" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.25" stop-color="${CREAM}"/><stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>`;
  return badge(id, "var(--va-radio-raheem)", f, art, defs);
}

/* ------------------------------------------------------------------ */
/* MANERO 97.7 — disco and funk. Our dancer: white suit with flares,    */
/* black shirt with its wide collar open over the lapels, a glossy      */
/* pompadour and a comb in the breast pocket ("watch the hair"), on a   */
/* lit floor under a mirror ball. Fat seventies name in cream and pink. */
/* ------------------------------------------------------------------ */
function manero(id: string, f: string | null): string {
  const NIGHT = "var(--va-radio-manero-night)";
  const SHIRT = "var(--va-radio-manero-shirt)";
  const SKIN = "var(--va-color-amber)";
  const vp = [50, 8];
  const rows = [40, 43.4, 47.6, 53, 60, 69, 81, 100];
  const xs = [-140, -96, -52, -8, 36, 80, 124, 168, 212, 256];
  const fills = ["pink", "amber", "lilac", "magenta"];
  const at = (x0: number, y: number) => r2(x0 + (vp[0] - x0) * ((100 - y) / (100 - vp[1])));
  let tiles = "";
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < xs.length - 1; c++) {
      const y0 = rows[r];
      const y1 = rows[r + 1];
      const lit = (r + c) % 2 === 0;
      const col = fills[(r * 3 + c) % fills.length];
      tiles += `<path d="M${at(xs[c], y0)} ${y0} L${at(xs[c + 1], y0)} ${y0} L${at(xs[c + 1], y1)} ${y1} L${at(xs[c], y1)} ${y1}Z" fill="${lit ? `url(#${id}-t-${col})` : NIGHT}" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>`;
    }
  }
  const bx = 77;
  const by = 15;
  const br = 10.5;
  let facets = "";
  const tones = ["var(--va-color-lilac)", CREAM, "var(--va-color-dusk)", "var(--va-color-pink)", "var(--va-color-lilac)", "var(--va-color-asphalt)"];
  let k = 0;
  for (let y = by - br; y < by + br; y += 2.4) {
    const half = Math.sqrt(Math.max(0, br * br - (y + 1.2 - by) ** 2));
    const n = Math.max(1, Math.round((half * 2) / 2.4));
    const w = (half * 2) / n;
    for (let i = 0; i < n; i++) {
      k = (k * 7 + 3) % 11;
      facets += `<rect x="${r2(bx - half + i * w + 0.2)}" y="${r2(y + 0.2)}" width="${r2(w - 0.4)}" height="2" fill="${tones[k % tones.length]}"/>`;
    }
  }
  const limb = (d: string, w: number) =>
    `<path d="${d}" fill="none" stroke="var(--va-radio-shadow)" stroke-width="${r2(w + 1.8)}" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="${d}" fill="none" stroke="url(#${id}-suitL)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const art = `
    <rect width="100" height="100" fill="${NIGHT}"/>
    <rect width="100" height="100" fill="url(#${id}-spot)"/>
    <g style="mix-blend-mode:screen">
      <path d="M${bx} ${by} L-6 40 L-6 58Z" fill="url(#${id}-beamPink)"/>
      <path d="M${bx} ${by} L6 100 L28 100Z" fill="url(#${id}-beamAmber)"/>
      <path d="M${bx} ${by} L60 100 L76 100Z" fill="url(#${id}-beamLilac)"/>
      <path d="M${bx} ${by} L106 66 L106 84Z" fill="url(#${id}-beamPink)"/>
    </g>
    ${tiles}
    <rect y="40" width="100" height="60" fill="url(#${id}-floorFade)"/>
    <path d="M0 40 H100" stroke="var(--va-radio-manero)" stroke-width="0.8" opacity="0.9"/>
    <!-- the mirror ball -->
    <path d="M${bx} 0 V${by - br}" stroke="${CREAM}" stroke-width="0.6"/>
    <circle cx="${bx}" cy="${by}" r="${br + 4}" fill="var(--va-radio-manero)" opacity="0.4" filter="url(#${id}-soft)"/>
    <g clip-path="url(#${id}-ballClip)">
      <circle cx="${bx}" cy="${by}" r="${br}" fill="var(--va-color-asphalt)"/>
      ${facets}
      <circle cx="${bx}" cy="${by}" r="${br}" fill="url(#${id}-ballShade)"/>
    </g>
    <circle cx="${bx}" cy="${by}" r="${br}" fill="none" stroke="var(--va-radio-shadow)" stroke-width="0.9"/>
    ${spark(72.6, 10.6, 4.4)}${spark(83, 20, 1.9)}
    ${spark(14, 16, 3.2, "var(--va-color-amber)")}${spark(27, 8, 1.8)}${spark(92, 34, 2.2, "var(--va-color-pink)")}${spark(10, 33, 1.6)}${spark(62, 30, 1.4, "var(--va-color-amber)")}
    <!-- his shadow and the glow under his feet -->
    <ellipse cx="46" cy="51" rx="13" ry="2.4" fill="var(--va-radio-manero)" opacity="0.7" filter="url(#${id}-glow)"/>
    <!-- trousers: bell-bottoms -->
    <g stroke="var(--va-radio-shadow)" stroke-width="0.9" stroke-linejoin="round">
      <path d="M41.2 37.8 L46.6 37.8 L43.6 45 L44.4 50.2 L35.2 50.8 L38.4 45Z" fill="url(#${id}-suit)"/>
      <path d="M45.4 37.8 L51 37.8 L51.6 44.6 L56.8 49.6 L47.8 50.4 L47.4 45Z" fill="url(#${id}-suitShade)"/>
    </g>
    <path d="M40.6 45.4 L37 50.4 M49.8 45.2 L54.4 49.8" stroke="var(--va-color-pink)" stroke-width="0.6" opacity="0.8"/>
    <g fill="var(--va-radio-shadow)"><path d="M34.8 50.6 H44.6 V52.4 H35.4Z"/><path d="M47.6 50.2 H57.2 L56.8 52 H47.8Z"/></g>
    <!-- the arm on the hip, the arm to the ball -->
    ${limb("M40.8 28 L35.6 33 L41.4 36.4", 3.4)}
    ${limb("M50.6 27.8 L57.6 21.4 L65 13.4", 3.4)}
    <circle cx="66" cy="12.2" r="1.7" fill="${SKIN}" stroke="var(--va-radio-shadow)" stroke-width="0.7"/>
    <path d="M66.8 11.2 L68.8 9.2" stroke="var(--va-radio-shadow)" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M66.8 11.2 L68.8 9.2" stroke="${SKIN}" stroke-width="0.8" stroke-linecap="round"/>
    <circle cx="41.6" cy="36.4" r="1.5" fill="${SKIN}" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
    <!-- the jacket -->
    <path d="M39.2 27.4 Q45.8 24.8 52.4 27.2 L51 38.2 L41 38.2Z" fill="url(#${id}-suit)" stroke="var(--va-radio-shadow)" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M41 38.2 H51" stroke="var(--va-radio-shadow)" stroke-width="1.2"/>
    <!-- the black shirt, open, its wide collar over the lapels -->
    <path d="M43.4 25.8 L46 34.6 L48.8 25.8Z" fill="${SHIRT}" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
    <path d="M44.6 25.8 L46 30.2 L47.6 25.8Z" fill="${SKIN}"/>
    <path d="M44.2 25.6 L39.6 30.8 L43.6 30.2 L45.4 27.2Z M47.8 25.6 L52.4 30.6 L48.4 30 L46.8 27.2Z" fill="${SHIRT}" stroke="var(--va-radio-shadow)" stroke-width="0.5" stroke-linejoin="round"/>
    <path d="M44.4 26.4 L41.6 29.6 M47.6 26.4 L50.4 29.4" stroke="var(--va-color-lilac)" stroke-width="0.4"/>
    <path d="M43.6 30.4 L45.6 35.8 M48.4 30.2 L46.4 35.8" stroke="var(--va-color-lilac)" stroke-width="0.5" fill="none"/>
    <!-- the comb in the breast pocket -->
    <path d="M48.4 32.6 H51.2" stroke="var(--va-color-lilac)" stroke-width="0.5"/>
    <rect x="49" y="29.6" width="1.7" height="3.2" rx="0.3" fill="var(--va-color-pink)" stroke="var(--va-radio-shadow)" stroke-width="0.4"/>
    <path d="M49.4 29.8 V31.4 M49.9 29.8 V31.4 M50.4 29.8 V31.4" stroke="var(--va-radio-shadow)" stroke-width="0.25"/>
    <!-- head, sideburns, the pompadour -->
    <path d="M44.8 22.6 H47.4 V26.2 H44.8Z" fill="${SKIN}" stroke="var(--va-radio-shadow)" stroke-width="0.5"/>
    <ellipse cx="46" cy="20.6" rx="3.2" ry="3.7" fill="url(#${id}-face)" stroke="var(--va-radio-shadow)" stroke-width="0.8"/>
    <path d="M43 19.4 V22.6 L43.9 22.4 V19.8Z M49 19.4 V22.6 L48.1 22.4 V19.8Z" fill="url(#${id}-hair)"/>
    <path d="M42.6 20 Q41.6 14.6 45.4 13.4 Q49.6 12 52 14.4 Q52.8 15.6 51.2 16 Q50 16.6 49.6 19 Q47.2 16.8 44.2 18 Q43.2 18.8 42.6 20Z" fill="url(#${id}-hair)" stroke="var(--va-radio-shadow)" stroke-width="0.6" stroke-linejoin="round"/>
    <path d="M44.2 15.4 Q47.4 13.4 50.6 14.8" fill="none" stroke="${CREAM}" stroke-width="0.7" stroke-linecap="round"/>
    <path d="M45 16.6 Q47.4 15.6 49.4 16.4" fill="none" stroke="var(--va-color-lilac)" stroke-width="0.4" stroke-linecap="round"/>
    <!-- the name, on a darker floor -->
    <rect y="60" width="100" height="40" fill="url(#${id}-under)"/>
    ${lockup("MANERO", { y: 82, size: 18, cls: "fSeventies", len: 68, fill: `url(#${id}-type)`, shade: "var(--va-color-magenta)", depth: 6, dx: 0.3, dy: 0.4, ow: 2.6, g: `transform="rotate(-5 50 77)"`, top: `<path d="M17 72.2 Q48 68.6 83 72.2" stroke="var(--va-radio-glint)" stroke-width="0.7" opacity="0.6" fill="none"/>` })}`;
  const tileGrad = (name: string) => `<radialGradient id="${id}-t-${name}" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="${CREAM}"/><stop offset="0.4" stop-color="var(--va-color-${name})"/><stop offset="1" stop-color="var(--va-color-${name})" stop-opacity="0.55"/></radialGradient>`;
  const beam = (name: string, c: string) => `<linearGradient id="${id}-beam${name}" gradientUnits="userSpaceOnUse" x1="${bx}" y1="${by}" x2="30" y2="90"><stop offset="0" stop-color="${c}" stop-opacity="0.7"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
  const defs = `
    <radialGradient id="${id}-spot" cx="0.45" cy="0.3" r="0.6">
      <stop offset="0" stop-color="var(--va-color-magenta)" stop-opacity="0.55"/><stop offset="1" stop-color="var(--va-color-magenta)" stop-opacity="0"/>
    </radialGradient>
    ${beam("Pink", "var(--va-color-pink)")}${beam("Amber", "var(--va-color-amber)")}${beam("Lilac", "var(--va-radio-manero)")}
    ${fills.map(tileGrad).join("")}
    <linearGradient id="${id}-floorFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NIGHT}" stop-opacity="0.5"/><stop offset="0.3" stop-color="${NIGHT}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}-under" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NIGHT}" stop-opacity="0"/><stop offset="0.3" stop-color="${NIGHT}" stop-opacity="0.88"/><stop offset="1" stop-color="${NIGHT}" stop-opacity="0.95"/></linearGradient>
    <clipPath id="${id}-ballClip"><circle cx="${bx}" cy="${by}" r="${br}"/></clipPath>
    <radialGradient id="${id}-ballShade" cx="0.32" cy="0.3" r="0.85">
      <stop offset="0" stop-color="var(--va-radio-glint)" stop-opacity="0.55"/><stop offset="0.35" stop-color="var(--va-radio-glint)" stop-opacity="0"/><stop offset="0.8" stop-color="${NIGHT}" stop-opacity="0.45"/><stop offset="1" stop-color="${NIGHT}" stop-opacity="0.85"/>
    </radialGradient>
    <linearGradient id="${id}-suitShade" x1="0" y1="0" x2="1" y2="0.2">
      <stop offset="0" stop-color="var(--va-color-pink)"/><stop offset="1" stop-color="var(--va-color-lilac)"/>
    </linearGradient>
    <linearGradient id="${id}-suit" x1="0" y1="0" x2="1" y2="0.2">
      <stop offset="0.45" stop-color="${CREAM}"/><stop offset="1" stop-color="var(--va-color-pink)"/>
    </linearGradient>
    <linearGradient id="${id}-suitL" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.3" stop-color="${CREAM}"/><stop offset="1" stop-color="var(--va-color-pink)"/>
    </linearGradient>
    <radialGradient id="${id}-face" cx="0.4" cy="0.35" r="0.8">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.45" stop-color="${SKIN}"/><stop offset="1" stop-color="var(--va-color-orange)"/>
    </radialGradient>
    <linearGradient id="${id}-hair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--va-color-dusk)"/><stop offset="0.45" stop-color="${SHIRT}"/><stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </linearGradient>
    <linearGradient id="${id}-type" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.2" stop-color="${CREAM}"/><stop offset="0.75" stop-color="var(--va-color-pink)"/>
    </linearGradient>`;
  return badge(id, "var(--va-radio-manero)", f, art, defs);
}

/* ------------------------------------------------------------------ */
/* ONE LOUDER 101.1 — metal. This Is Spinal Tap: a big chrome knob on   */
/* a dial numbered 1 to 10, cranked past it to a glowing 11 that breaks */
/* out of the plate; the dial on fire, lightning off it, the name in    */
/* chrome on an arch.                                                   */
/* ------------------------------------------------------------------ */
function oneLouder(id: string, f: string | null): string {
  const HOT = "var(--va-radio-louder-hot)";
  const BLUE = "var(--va-radio-louder)";
  const cx = 50;
  const cy = 58;
  const R = 27;
  // The flames: tongues along the bottom, tallest at the sides.
  const flame = (scale: number, fill: string) => {
    let d = "M-6 106";
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x0 = -6 + (i * 112) / n;
      const w = 112 / n;
      const side = Math.abs(x0 + w / 2 - 50) / 56;
      const h = (16 + 34 * side + ((i * 7) % 5) * 2) * scale;
      const lean = (x0 + w / 2 < 50 ? -1 : 1) * w * 0.35;
      const yb = 104;
      d += ` L${r2(x0)} ${yb} Q${r2(x0 + w * 0.15)} ${r2(yb - h * 0.55)} ${r2(x0 + w / 2 + lean)} ${r2(yb - h)} Q${r2(x0 + w * 0.7)} ${r2(yb - h * 0.45)} ${r2(x0 + w)} ${yb}`;
    }
    return `<path d="${d} L106 106Z" fill="${fill}"/>`;
  };
  let scale = "";
  for (let i = 1; i <= 10; i++) {
    const a = -150 + (i - 1) * 27;
    const [tx, ty] = polar(cx, cy, a, R - 5.2);
    const [x1, y1] = polar(cx, cy, a, R - 1.4);
    const [x2, y2] = polar(cx, cy, a, R - 2.8);
    scale += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--va-radio-shadow)" stroke-width="0.7"/>
      <text class="fCaps" font-size="5.2" x="${tx}" y="${r2(ty + 1.85)}" text-anchor="middle" fill="var(--va-radio-shadow)">${i}</text>`;
  }
  const [hx, hy] = polar(cx, cy, 125, R - 1.6);
  const [px, py] = polar(cx, cy, 125, 13);
  const bolt = (d: string) =>
    `<path d="${d}" fill="none" stroke="var(--va-radio-shadow)" stroke-width="3.4" stroke-linejoin="miter" stroke-linecap="round"/>
     <path d="${d}" fill="none" stroke="${BLUE}" stroke-width="2" stroke-linejoin="miter" stroke-linecap="round"/>
     <path d="${d}" fill="none" stroke="${CREAM}" stroke-width="0.6" stroke-linejoin="miter" stroke-linecap="round"/>`;
  const art = `
    <rect width="100" height="100" fill="var(--va-radio-louder-stage)"/>
    <rect width="100" height="100" fill="url(#${id}-tolex)" opacity="0.8"/>
    <ellipse cx="50" cy="96" rx="60" ry="34" fill="${HOT}" opacity="0.45" filter="url(#${id}-soft)"/>
    <ellipse cx="50" cy="14" rx="40" ry="14" fill="${BLUE}" opacity="0.22" filter="url(#${id}-soft)"/>
    <!-- the fire -->
    <g filter="url(#${id}-drop)">${flame(1, `url(#${id}-flame)`)}</g>
    ${flame(0.66, "var(--va-color-sodium)")}
    ${flame(0.34, CREAM)}
    <!-- lightning off the dial -->
    ${bolt("M23.6 46 L15 43.2 L18 40 L6.4 34.4")}
    ${bolt("M76.6 45 L85.4 42.4 L82.6 39 L94 33")}
    ${bolt("M24.4 70 L15.6 71.4 L18.6 74.6 L8 78.6")}
    <!-- the dial plate -->
    <circle cx="${cx}" cy="${r2(cy + 1.2)}" r="${R + 1.6}" fill="var(--va-radio-shadow)" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}-plate)" stroke="var(--va-radio-shadow)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}-brush)" opacity="0.35"/>
    <circle cx="${cx}" cy="${cy}" r="${R - 1}" fill="none" stroke="url(#${id}-chrome)" stroke-width="1.6"/>
    ${scale}
    <path d="M${polar(cx, cy, 97, R - 2.1).join(" ")} A${R - 2.1} ${R - 2.1} 0 0 1 ${polar(cx, cy, 125, R - 2.1).join(" ")}" fill="none" stroke="${HOT}" stroke-width="1.6" stroke-linecap="round"/>
    <!-- the knob: its side, a knurled skirt, the cap, the pointer at 11 -->
    <circle cx="${cx}" cy="${r2(cy + 3)}" r="15.6" fill="url(#${id}-side)" stroke="var(--va-radio-shadow)" stroke-width="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="15.6" fill="url(#${id}-skirt)" stroke="var(--va-radio-shadow)" stroke-width="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="14.6" fill="none" stroke="var(--va-radio-shadow)" stroke-width="1.6" stroke-dasharray="0.7 0.85" opacity="0.6"/>
    <circle cx="${cx}" cy="${cy}" r="10.4" fill="url(#${id}-cap)" stroke="var(--va-radio-shadow)" stroke-width="0.8"/>
    <path d="M${cx - 7.4} ${cy - 3.4} A8 8 0 0 1 ${cx + 1} ${cy - 8.2}" fill="none" stroke="${CREAM}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="var(--va-radio-shadow)" stroke-width="3" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${CREAM}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="${hx}" cy="${hy}" r="2" fill="${HOT}" stroke="var(--va-radio-shadow)" stroke-width="0.5"/>
    <!-- the 11, breaking out of the plate -->
    <g transform="rotate(-12 79 77)">
      <text class="fCaps" font-size="22" x="79" y="85" text-anchor="middle" fill="${HOT}" filter="url(#${id}-glow)">11</text>
      <text class="fCaps" font-size="22" x="79" y="85" text-anchor="middle" fill="url(#${id}-hotType)" stroke="var(--va-radio-shadow)" stroke-width="1.8" paint-order="stroke" stroke-linejoin="round">11</text>
    </g>
    <g fill="var(--va-color-sodium)"><circle cx="90" cy="64" r="0.8"/><circle cx="68" cy="70" r="0.6"/><circle cx="92" cy="74" r="0.6"/><circle cx="72" cy="88" r="0.7"/></g>
    <!-- the name -->
    <path id="${id}-arc" d="M15 33.4 Q50 10.4 85 33.4" fill="none"/>
    ${arcLockup("ONE LOUDER", `${id}-arc`, { size: 16, cls: "fCaps", len: 64, fill: `url(#${id}-letters)`, shade: "var(--va-radio-louder-deep)", depth: 4, ow: 2.2, dx: 0.28, dy: 0.42 })}`;
  const defs = `
    <pattern id="${id}-tolex" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="2.4" height="2.4" fill="var(--va-radio-louder-tolex)"/>
      <path d="M0 0 H2.4 M0 0 V2.4" stroke="var(--va-radio-weave)" stroke-width="0.5"/>
      <circle cx="1.2" cy="1.2" r="0.35" fill="var(--va-radio-shadow)"/>
    </pattern>
    <linearGradient id="${id}-flame" x1="0" y1="0.4" x2="0" y2="1">
      <stop offset="0" stop-color="${HOT}"/><stop offset="1" stop-color="var(--va-color-magenta)"/>
    </linearGradient>
    <linearGradient id="${id}-plate" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.35" stop-color="var(--va-radio-louder-panel)"/><stop offset="0.7" stop-color="var(--va-radio-louder-panel-deep)"/><stop offset="1" stop-color="var(--va-radio-louder-panel)"/>
    </linearGradient>
    <pattern id="${id}-brush" width="100" height="0.8" patternUnits="userSpaceOnUse"><rect width="100" height="0.3" fill="var(--va-radio-glint)"/></pattern>
    <linearGradient id="${id}-chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.45" stop-color="${BLUE}"/><stop offset="0.5" stop-color="var(--va-color-asphalt)"/><stop offset="0.62" stop-color="var(--va-radio-louder-chrome)"/><stop offset="1" stop-color="${CREAM}"/>
    </linearGradient>
    <linearGradient id="${id}-side" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--va-radio-shadow)"/><stop offset="0.3" stop-color="var(--va-radio-louder-chrome)"/><stop offset="0.5" stop-color="var(--va-color-asphalt)"/><stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </linearGradient>
    <radialGradient id="${id}-skirt" cx="0.38" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.45" stop-color="var(--va-radio-louder-chrome)"/><stop offset="0.8" stop-color="var(--va-color-lilac)"/><stop offset="1" stop-color="var(--va-color-asphalt)"/>
    </radialGradient>
    <radialGradient id="${id}-cap" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="var(--va-color-asphalt)"/><stop offset="1" stop-color="var(--va-radio-shadow)"/></radialGradient>
    <linearGradient id="${id}-letters" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.12" stop-color="${CREAM}"/><stop offset="0.5" stop-color="${BLUE}"/><stop offset="0.53" stop-color="var(--va-radio-louder-chrome)"/><stop offset="1" stop-color="${CREAM}"/>
    </linearGradient>
    <linearGradient id="${id}-hotType" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CREAM}"/><stop offset="0.3" stop-color="var(--va-color-sodium)"/><stop offset="0.75" stop-color="${HOT}"/></linearGradient>`;
  return badge(id, BLUE, f, art, defs);
}

/* ------------------------------------------------------------------ */
/* WITNESS ME 104.5 — punk and rock. Fury Road's cry: WITNESS cut out   */
/* in cream and yellow chips on one strip of black tape, ME! below, on  */
/* a pink spray splat over a mirror-chrome burst; a chrome spray can    */
/* mists silver over it all.                                            */
/* ------------------------------------------------------------------ */
function witnessMe(id: string, f: string | null): string {
  const YEL = "var(--va-radio-witness)";
  const MAG = "var(--va-color-magenta)";
  const STEEL = `url(#${id}-mirror)`;
  // Chips: [char, face class, size, chip fill, letter fill, w, h, rot, dy]
  const H = 12.6;
  const word1: Chip[] = [
    ["W", "fCaps", 13.4, CREAM, INK, 10.6, H, -4, 0],
    ["I", "fHiphop", 9.4, YEL, INK, 6.6, H, 4, -0.4],
    ["T", "fSeventies", 10.4, CREAM, INK, 9.4, H, -3, 0.4],
    ["N", "fChrome", 11, YEL, INK, 9.6, H, 3, -0.3],
    ["E", "fCaps", 13.4, CREAM, INK, 8.2, H, -4, 0.3],
    ["S", "fHiphop", 9.4, YEL, INK, 9.2, H, 4, -0.4],
    ["S", "fSeventies", 10.4, CREAM, INK, 9.2, H, -3, 0.3],
  ];
  const word2: Chip[] = [
    ["M", "fCaps", 24, STEEL, INK, 17, 22, -5, 0],
    ["E", "fHiphop", 18, YEL, INK, 14, 21, 4, 1],
    ["!", "fSeventies", 20, MAG, CREAM, 9, 21, 8, -0.6],
  ];
  let seed = 3;
  const jit = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return (seed / 233280 - 0.5) * 1.2;
  };
  const chips = (list: readonly Chip[], cy: number, gap: number) => {
    const total = list.reduce((s, c) => s + c[5], 0) + gap * (list.length - 1);
    let x = 50 - total / 2;
    return list
      .map(([ch, cls, size, chip, ink, w, h, rot, dy]) => {
        const cx = r2(x + w / 2);
        const y = cy + dy;
        x += w + gap;
        const x0 = cx - w / 2;
        const y0 = y - h / 2;
        const d = `M${r2(x0 + jit())} ${r2(y0 + jit())} L${r2(x0 + w / 2)} ${r2(y0 + jit() * 0.6)} L${r2(x0 + w + jit())} ${r2(y0 + jit())} L${r2(x0 + w + jit() * 0.6)} ${r2(y)} L${r2(x0 + w + jit())} ${r2(y0 + h + jit())} L${r2(x0 + w / 2)} ${r2(y0 + h + jit() * 0.6)} L${r2(x0 + jit())} ${r2(y0 + h + jit())} L${r2(x0 + jit() * 0.6)} ${r2(y)}Z`;
        return `<g transform="rotate(${rot} ${cx} ${r2(y)})">
          <path d="${d}" fill="var(--va-radio-shadow)" transform="translate(0.7 1)" opacity="0.75"/>
          <path d="${d}" fill="${chip}" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
          <text class="${cls}" font-size="${size}" x="${cx}" y="${r2(y + size * 0.36)}" text-anchor="middle" fill="${ink}">${ch}</text>
        </g>`;
      })
      .join("");
  };
  // Silver mist off the nozzle, fanning down and left.
  let mist = "";
  for (let i = 0; i < 54; i++) {
    const t = ((i * 37) % 100) / 100;
    const spread = (((i * 53) % 41) / 40 - 0.5) * 0.75;
    const dist = 3 + t * 30;
    const a = Math.atan2(0.62, -0.78) + spread;
    const x = 63 + Math.cos(a) * dist;
    const y = 11.2 + Math.sin(a) * dist;
    mist += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(0.3 + ((i * 7) % 5) * 0.14 + t * 0.3)}" fill="${i % 3 ? "var(--va-radio-witness-steel)" : CREAM}"/>`;
  }
  let pink = "";
  for (let i = 0; i < 40; i++) {
    const a = (i * 137.5 * Math.PI) / 180;
    const rr = 33 + ((i * 29) % 13);
    pink += `<circle cx="${r2(50 + Math.cos(a) * rr)}" cy="${r2(48 + Math.sin(a) * rr * 0.86)}" r="${r2(0.35 + ((i * 7) % 5) * 0.18)}"/>`;
  }
  const burst = "M50 8 L56 26 L72 12 L66 30 L88 26 L72 40 L94 50 L72 56 L86 74 L64 64 L60 86 L50 68 L38 88 L36 66 L14 76 L28 58 L6 50 L28 42 L12 24 L34 30 L32 10 L44 26Z";
  const tape = "M11 30 L89 28.4 L87.6 30.8 L89.4 33.2 L87.8 35.8 L89.6 38.4 L88 40.8 L89.2 43.2 L11.4 44.8 L12.8 42.4 L10.8 40 L12.6 37.4 L10.6 35 L12.4 32.4Z";
  const art = `
    <rect width="100" height="100" fill="var(--va-radio-witness-ink)"/>
    <rect width="100" height="100" fill="url(#${id}-hatch)" opacity="0.5"/>
    <!-- the mirror-chrome burst: a highlight streak, a violet band, a hard horizon -->
    <path d="${burst}" fill="var(--va-radio-shadow)" transform="translate(0.8 1.2)"/>
    <path d="${burst}" fill="${STEEL}" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
    <g clip-path="url(#${id}-burstClip)">
      <path d="M8 40 L30 4 L36 4 L14 40Z M18 46 L42 6 L44.6 6 L20.6 46Z" fill="${CREAM}" opacity="0.85"/>
      <path d="M60 96 L86 50 L90 50 L64 96Z" fill="${CREAM}" opacity="0.5"/>
    </g>
    <!-- the spray splat with drips -->
    <path d="M50 16 C64 14 72 22 79 26 C89 32 90 44 86 52 C91 62 83 72 73 75 C63 80 57 74 48 78 C36 82 24 76 18 66 C10 56 12 42 18 34 C24 23 36 17 50 16Z" fill="url(#${id}-spray)"/>
    <path d="M28 74 V86 Q28 89 30 89 Q32 89 32 86 V76Z M43 77 V93 Q43 96 45 96 Q47 96 47 93 V77Z M66 74 V83 Q66 86 68 86 Q70 86 70 83 V74Z" fill="${MAG}"/>
    <g fill="${MAG}">${pink}</g>
    <rect width="100" height="100" fill="url(#${id}-dots)" mask="url(#${id}-edge)"/>
    <!-- silver mist settling on the splat -->
    <ellipse cx="50" cy="26" rx="18" ry="8" fill="var(--va-radio-witness-steel)" opacity="0.35" filter="url(#${id}-soft)" transform="rotate(-38 50 26)"/>
    <g>${mist}</g>
    <!-- WITNESS on one strip of black tape -->
    <g transform="rotate(-3 50 37)">
      <path d="${tape}" fill="var(--va-radio-shadow)" transform="translate(0.8 1.2)" opacity="0.8"/>
      <path d="${tape}" fill="url(#${id}-tape)" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
      <path d="M13 31.4 L87 29.9" stroke="var(--va-radio-glint)" stroke-width="0.6" opacity="0.25"/>
      ${chips(word1, 36.9, 0.7)}
    </g>
    ${chips(word2, 62, 1.2)}
    <!-- the chrome spray can -->
    <g transform="translate(71.6 18.6) rotate(-30)" filter="url(#${id}-drop)">
      <rect x="-5" y="-4.4" width="10" height="15.4" rx="1.4" fill="url(#${id}-can)" stroke="var(--va-radio-shadow)" stroke-width="0.8"/>
      <rect x="-5" y="1.2" width="10" height="5.6" fill="${YEL}" stroke="var(--va-radio-shadow)" stroke-width="0.5"/>
      <path d="M-4.4 4 L-2.4 2.4 L-0.4 5 L1.6 2.6 L3.6 5 L4.6 3.6" fill="none" stroke="${MAG}" stroke-width="0.9" stroke-linejoin="round"/>
      <path d="M-5 -4.4 Q-5 -8.6 0 -9 Q5 -8.6 5 -4.4Z" fill="url(#${id}-can)" stroke="var(--va-radio-shadow)" stroke-width="0.8"/>
      <rect x="-1.6" y="-11.4" width="3.2" height="2.8" rx="0.5" fill="var(--va-color-asphalt)" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
      <rect x="-3.8" y="-11" width="2.6" height="1.4" rx="0.3" fill="${CREAM}" stroke="var(--va-radio-shadow)" stroke-width="0.4"/>
      <path d="M-2.8 -3.4 V10" stroke="var(--va-radio-glint)" stroke-width="0.9" opacity="0.85" stroke-linecap="round"/>
      <path d="M-5 10 H5" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
    </g>
    ${spark(14, 27, 2.8)}${spark(83, 58, 2.2)}${spark(20, 60, 1.6)}${spark(40, 20, 1.6)}`;
  const defs = `
    <linearGradient id="${id}-mirror" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="0.3" stop-color="var(--va-radio-witness-steel)"/><stop offset="0.42" stop-color="${CREAM}"/>
      <stop offset="0.47" stop-color="var(--va-color-lilac)"/><stop offset="0.5" stop-color="var(--va-color-dusk)"/><stop offset="0.5" stop-color="var(--va-radio-shadow)"/>
      <stop offset="0.58" stop-color="var(--va-color-asphalt)"/><stop offset="0.75" stop-color="var(--va-color-lilac)"/><stop offset="1" stop-color="${CREAM}"/>
    </linearGradient>
    <clipPath id="${id}-burstClip"><path d="${burst}"/></clipPath>
    <linearGradient id="${id}-can" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--va-color-asphalt)"/><stop offset="0.25" stop-color="${CREAM}"/><stop offset="0.5" stop-color="var(--va-radio-witness-steel)"/><stop offset="0.8" stop-color="var(--va-color-lilac)"/><stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </linearGradient>
    <linearGradient id="${id}-tape" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--va-color-asphalt)"/><stop offset="0.35" stop-color="var(--va-radio-shadow)"/><stop offset="1" stop-color="var(--va-radio-shadow)"/>
    </linearGradient>
    <radialGradient id="${id}-spray" cx="0.45" cy="0.4" r="0.6">
      <stop offset="0" stop-color="var(--va-color-pink)"/><stop offset="0.6" stop-color="${MAG}"/><stop offset="1" stop-color="var(--va-radio-witness-deep)"/>
    </radialGradient>
    <pattern id="${id}-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><path d="M0 1.5 H3" stroke="var(--va-radio-weave)" stroke-width="0.6"/></pattern>
    <pattern id="${id}-dots" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="1.1" cy="1.1" r="0.55" fill="var(--va-radio-witness-ink)"/></pattern>
    <radialGradient id="${id}-edgeG" cx="0.5" cy="0.47" r="0.5"><stop offset="0.6" stop-color="var(--va-radio-shadow)"/><stop offset="0.85" stop-color="var(--va-radio-glint)"/></radialGradient>
    <mask id="${id}-edge"><rect width="100" height="100" fill="url(#${id}-edgeG)"/></mask>`;
  return badge(id, YEL, f, art, defs);
}

/* ------------------------------------------------------------------ */
/* TOFU 107.6 — phonk. Initial D's run, our own drawing: an eighties    */
/* hatchback, white over ink, pop-up lamps up, yawed into the hairpin   */
/* with the front wheels counter-steered and smoke off the rear tyres,  */
/* the tofu crate on the roof; the name in a drift-edit double print.   */
/* ------------------------------------------------------------------ */
function tofu(id: string, f: string | null): string {
  const VIO = "var(--va-radio-tofu)";
  const MAG = "var(--va-color-magenta)";
  const BODY = `url(#${id}-body)`;
  const LOW = "var(--va-radio-tofu-low)";
  const road = "M104 48 Q70 57 34 59.6 Q9 61 9 67.4 Q9 74 32 74 Q66 74 104 68";
  const art = `
    <rect width="100" height="100" fill="url(#${id}-sky)"/>
    <g fill="${CREAM}"><circle cx="20" cy="14" r="0.5"/><circle cx="34" cy="8" r="0.4"/><circle cx="66" cy="10" r="0.5"/><circle cx="82" cy="18" r="0.4"/><circle cx="12" cy="26" r="0.35"/></g>
    <ellipse cx="62" cy="38" rx="34" ry="12" fill="var(--va-radio-tofu-dawn)" opacity="0.8" filter="url(#${id}-soft)"/>
    <circle cx="62" cy="38" r="5" fill="${CREAM}" opacity="0.9"/>
    <path d="M-4 40 L12 30 L22 35 L38 24 L52 34 L64 28 L80 36 L94 28 L104 34 V60 H-4Z" fill="var(--va-radio-tofu-ridge)"/>
    <path d="M-4 50 Q20 38 40 44 Q64 50 104 38 V100 H-4Z" fill="var(--va-radio-tofu-night)"/>
    <!-- the hairpin -->
    <path d="${road}" fill="none" stroke="var(--va-radio-shadow)" stroke-width="11"/>
    <path d="${road}" fill="none" stroke="var(--va-color-asphalt)" stroke-width="9.2"/>
    <path d="${road}" fill="none" stroke="${CREAM}" stroke-width="0.5" stroke-dasharray="2.4 2.4" opacity="0.7"/>
    <path d="M32 80.4 Q2 80 2.6 67" fill="none" stroke="var(--va-color-lilac)" stroke-width="1.2"/>
    <g stroke="var(--va-color-lilac)" stroke-width="0.8"><path d="M5 75 v3"/><path d="M13 78.6 v3"/></g>
    <!-- tyre marks: the arc the tail swung through -->
    <path d="M58 64.4 Q76 60 104 58.6 M66 66.6 Q82 63.4 104 62.6" fill="none" stroke="var(--va-radio-shadow)" stroke-width="1.2" opacity="0.85"/>
    <!-- the lamps' beams into the bend -->
    <path d="M22 51 L-6 40 L-6 62Z" fill="var(--va-color-sodium)" opacity="0.35" filter="url(#${id}-glowS)"/>
    <g transform="translate(0 -2)">
      <!-- smoke off the rear tyres -->
      ${puffs(
        [
          [62, 61.6, 3.6, CREAM], [68.6, 58.4, 5, CREAM], [76.6, 60.6, 6.2, "var(--va-radio-tofu-smoke)"], [84.6, 54.4, 7, CREAM], [94, 58.4, 8, "var(--va-radio-tofu-smoke)"], [90, 47.6, 6, CREAM], [100, 48, 6, "var(--va-radio-tofu-smoke)"], [72, 64.4, 3.4, "var(--va-radio-tofu-smoke)"],
        ],
        INK,
        1.3,
      )}
      <g fill="var(--va-color-lilac)" opacity="0.55"><circle cx="78" cy="63.6" r="3.4"/><circle cx="95" cy="62" r="4.6"/><circle cx="86.6" cy="58.6" r="3"/></g>
      <g fill="var(--va-radio-glint)" opacity="0.7"><circle cx="66.6" cy="56.4" r="1.4"/><circle cx="82" cy="50" r="2"/><circle cx="91.6" cy="44" r="1.6"/></g>
      <!-- the car, nose into the bend, tail out -->
      <g filter="url(#${id}-drop)">
        <ellipse cx="41" cy="66" rx="26" ry="3" fill="var(--va-radio-shadow)" opacity="0.6"/>
        <!-- side: white over ink -->
        <path d="M25 55 L65 49 L66 57.4 L64 58.4 L26 64.4 L24.6 62Z" fill="${BODY}" stroke="var(--va-radio-shadow)" stroke-width="0.9" stroke-linejoin="round"/>
        <path d="M25.4 59.8 L65.6 53.8 L65.8 57.4 L64 58.4 L26 64.4 L25 62Z" fill="${LOW}"/>
        <path d="M25.2 59.6 L65.6 53.6" stroke="var(--va-color-pink)" stroke-width="0.5"/>
        <!-- front face -->
        <path d="M16 53 L25 55 L24.6 62 L26 64.4 L17.4 62.4 L16.4 60Z" fill="url(#${id}-front)" stroke="var(--va-radio-shadow)" stroke-width="0.9" stroke-linejoin="round"/>
        <path d="M16.2 58 L25 59.8 L26 64.4 L17.4 62.4Z" fill="${LOW}"/>
        <path d="M18 57.2 L23.6 58.4" stroke="var(--va-radio-shadow)" stroke-width="0.7"/>
        <path d="M17.6 61.4 L24.8 63" stroke="${CREAM}" stroke-width="0.4" opacity="0.6"/>
        <!-- the hood -->
        <path d="M16 53 L25 55 L35 53.5 L26 51.4Z" fill="${CREAM}" stroke="var(--va-radio-shadow)" stroke-width="0.8" stroke-linejoin="round"/>
        <!-- pop-up lamps, raised and lit -->
        <path d="M16.8 52.6 L17 50 L20.6 50.8 L20.4 53.4Z M21.6 53.8 L21.8 51.2 L25.4 52 L25.2 54.6Z" fill="${CREAM}" stroke="var(--va-radio-shadow)" stroke-width="0.6" stroke-linejoin="round"/>
        <path d="M17 50.4 L17.2 52.4 L18.8 52.8 L18.6 50.8Z M21.8 51.6 L22 53.6 L23.6 54 L23.4 52Z" fill="var(--va-color-sodium)"/>
        <circle cx="18" cy="51.6" r="2.6" fill="var(--va-color-sodium)" opacity="0.6" filter="url(#${id}-glowS)"/>
        <circle cx="22.8" cy="52.8" r="2.6" fill="var(--va-color-sodium)" opacity="0.6" filter="url(#${id}-glowS)"/>
        <!-- the greenhouse -->
        <path d="M26 51.4 L35 53.5 L41 45.5 L32 43.4Z" fill="url(#${id}-glass)" stroke="var(--va-radio-shadow)" stroke-width="0.8" stroke-linejoin="round"/>
        <path d="M28.6 50.6 L34 45" stroke="${CREAM}" stroke-width="0.6" opacity="0.7"/>
        <path d="M32 43.4 L41 45.5 L57 43 L48 40.9Z" fill="${CREAM}" stroke="var(--va-radio-shadow)" stroke-width="0.8" stroke-linejoin="round"/>
        <path d="M35 53.5 L41 45.5 L57 43 L64.6 49.1Z" fill="${BODY}" stroke="var(--va-radio-shadow)" stroke-width="0.8" stroke-linejoin="round"/>
        <path d="M37 52.4 L41.8 46.6 L49.4 45.4 L49.4 51.2Z M51 51 L51 45.1 L56.4 44.3 L61.4 48.9Z" fill="url(#${id}-glass)" stroke="var(--va-radio-shadow)" stroke-width="0.5"/>
        <path d="M57 43 L64.6 49.1 L66 49 L58.4 43Z" fill="${LOW}"/>
        <path d="M44 55.4 L44.6 61.6" stroke="var(--va-radio-shadow)" stroke-width="0.5"/>
        <path d="M36.6 54 L35.4 52.2 L37.6 52.4Z" fill="var(--va-radio-shadow)"/>
        <!-- tail light -->
        <rect x="63.4" y="50" width="2.4" height="2.8" rx="0.4" fill="${MAG}" stroke="var(--va-radio-shadow)" stroke-width="0.4"/>
        <circle cx="64.6" cy="51.4" r="2.8" fill="${MAG}" opacity="0.6" filter="url(#${id}-glowS)"/>
        <!-- the tofu crate, strapped to the roof -->
        <path d="M44 41.8 V35.4 H51.6 V41.8Z" fill="${CREAM}" stroke="var(--va-radio-shadow)" stroke-width="0.6"/>
        <path d="M44 35.4 L46.6 33.4 H54.2 L51.6 35.4Z" fill="var(--va-radio-tofu-side)" stroke="var(--va-radio-shadow)" stroke-width="0.5"/>
        <path d="M51.6 35.4 L54.2 33.4 V39.6 L51.6 41.8Z" fill="var(--va-radio-tofu-shade)" stroke="var(--va-radio-shadow)" stroke-width="0.5"/>
        <path d="M47.8 41.8 V35.4 L50.4 33.4 M44 38.6 H51.6 L54.2 36.6" stroke="${INK}" stroke-width="0.7" fill="none"/>
        <!-- wheels: arches, the rear tyre smoking, the front one counter-steered -->
        <path d="M27.6 63.4 Q28 57.6 32.4 57.4 Q36.6 57.4 37 62.2Z M53 59.4 Q53.4 54.4 57.4 54.2 Q61 54.2 61.4 58.4Z" fill="var(--va-radio-shadow)"/>
        <ellipse cx="57.4" cy="58.6" rx="3" ry="4" fill="var(--va-radio-shadow)"/>
        <ellipse cx="57.6" cy="58.6" rx="1.7" ry="2.4" fill="url(#${id}-wheelRim)"/>
        <g transform="rotate(-16 32.4 62.6)">
          <ellipse cx="33.4" cy="62.6" rx="4.2" ry="4.4" fill="var(--va-radio-shadow)"/>
          <ellipse cx="32" cy="62.6" rx="3.6" ry="4.3" fill="var(--va-radio-tyre)" stroke="var(--va-radio-shadow)" stroke-width="0.4"/>
          <ellipse cx="32" cy="62.6" rx="2.1" ry="2.6" fill="url(#${id}-wheelRim)"/>
          <path d="M30.6 61 L33.4 64.2 M32 60 V65.2" stroke="var(--va-radio-shadow)" stroke-width="0.4"/>
        </g>
      </g>
    </g>
    <!-- the name: a drift-edit double print with slices -->
    <g transform="skewX(-6)">
      <text class="fChrome" font-size="29" x="52.4" y="86" text-anchor="middle" textLength="60" lengthAdjust="spacingAndGlyphs" fill="${MAG}" opacity="0.95" transform="translate(-3 0)">TOFU</text>
      <text class="fChrome" font-size="29" x="52.4" y="86" text-anchor="middle" textLength="60" lengthAdjust="spacingAndGlyphs" fill="${VIO}" opacity="0.95" transform="translate(2.6 1.4)">TOFU</text>
      <g mask="url(#${id}-slice)">
        <text class="fChrome" font-size="29" x="52.4" y="86" text-anchor="middle" textLength="60" lengthAdjust="spacingAndGlyphs" fill="var(--va-radio-shadow)" stroke="var(--va-radio-shadow)" stroke-width="2.2" stroke-linejoin="round">TOFU</text>
        <text class="fChrome" font-size="29" x="52.4" y="86" text-anchor="middle" textLength="60" lengthAdjust="spacingAndGlyphs" fill="url(#${id}-type)">TOFU</text>
      </g>
    </g>`;
  const defs = `
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--va-radio-tofu-night)"/><stop offset="0.2" stop-color="var(--va-radio-tofu-dusk)"/><stop offset="0.34" stop-color="var(--va-color-magenta)"/><stop offset="0.42" stop-color="var(--va-radio-tofu-dawn)"/>
    </linearGradient>
    <filter id="${id}-glowS" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="0.9"/></filter>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="1" stop-color="var(--va-radio-tofu-side)"/>
    </linearGradient>
    <linearGradient id="${id}-front" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--va-radio-tofu-shade)"/><stop offset="1" stop-color="var(--va-radio-tofu-side)"/>
    </linearGradient>
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${VIO}"/><stop offset="1" stop-color="var(--va-radio-tofu-night)"/></linearGradient>
    <radialGradient id="${id}-wheelRim" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="${CREAM}"/><stop offset="1" stop-color="var(--va-color-lilac)"/></radialGradient>
    <linearGradient id="${id}-type" x1="0" y1="0" x2="0" y2="1"><stop offset="0.2" stop-color="${CREAM}"/><stop offset="1" stop-color="var(--va-radio-tofu-side)"/></linearGradient>
    <mask id="${id}-slice" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect width="100" height="100" fill="var(--va-radio-glint)"/>
      <path d="M0 74.8 L100 72.4 L100 73.6 L0 76Z M0 80 L100 78.2 L100 79 L0 80.8Z" fill="var(--va-radio-shadow)"/>
    </mask>`;
  return badge(id, VIO, f, art, defs);
}

/*
 * Radio off, in the same frame (no frequency tab). The symbol fades from
 * cream into the off colour, and lights up all cream on the wheel's
 * selected sector, which sets --logo-lit (RadioWheel.module.css).
 */
function power(id: string): string {
  const art = `<rect width="100" height="100" fill="url(#${id}-bg)"/>
    <circle cx="50" cy="50" r="24" fill="var(--va-radio-off)" opacity="0.18" filter="url(#${id}-soft)"/>
    <path d="M39.4 36.4 A17 17 0 1 0 60.6 36.4 M50 29 V50" fill="none" stroke="var(--va-radio-shadow)" stroke-width="7.4" stroke-linecap="round" transform="translate(0.6 1)"/>
    <path d="M39.4 36.4 A17 17 0 1 0 60.6 36.4 M50 29 V50" fill="none" stroke="url(#${id}-p)" stroke-width="5.4" stroke-linecap="round"/>`;
  const defs = `<radialGradient id="${id}-bg" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="var(--va-color-asphalt)"/><stop offset="1" stop-color="var(--va-color-night)"/></radialGradient>
    <linearGradient id="${id}-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CREAM}"/><stop offset="1" style="stop-color:var(--logo-lit, var(--va-radio-off))"/></linearGradient>`;
  return badge(id, "var(--va-radio-off)", null, art, defs);
}


const DRAW: Record<LogoStyle, (id: string, frequency: string | null) => string> = {
  bobsled,
  raheem,
  manero,
  louder: oneLouder,
  witness: witnessMe,
  tofu,
  power: (id) => power(id),
};

/** The paint properties a badge sets to a token, moved from attributes into `style`. */
const PAINT = /\s(fill|stroke|stop-color|flood-color)="(var\(--[a-z0-9-]+\))"/g;
const FACE = /\sclass="(f[A-Za-z]+)"/;
const STYLE = /\sstyle="([^"]*)"/;

/**
 * Moves every token colour and face of each tag into one `style`
 * attribute: `fill="var(--x)"` becomes `style="fill:var(--x)"`, and a face
 * class its font declarations.
 */
export function inlineTokens(markup: string): string {
  return markup.replace(/<[a-zA-Z][^<>]*>/g, (tag) => {
    const declarations: string[] = [];
    let out = tag.replace(PAINT, (_, property: string, value: string) => {
      declarations.push(`${property}:${value}`);
      return "";
    });
    const face = out.match(FACE);
    if (face) {
      const css = FACES[face[1] as keyof typeof FACES];
      if (!css) throw new Error(`Unknown badge face ${face[1]}`);
      declarations.push(css);
      out = out.replace(FACE, "");
    }
    const style = out.match(STYLE);
    if (style) {
      declarations.unshift(style[1].replace(/;$/, ""));
      out = out.replace(STYLE, "");
    }
    if (declarations.length === 0) return tag;
    return out.replace(/(\s*\/?>)$/, ` style="${declarations.join(";")}"$1`);
  });
}

/** Stands for the badge's id prefix in the cached markup. */
const ID = "BADGE_ID";
const cache = new Map<string, string>();

/**
 * The inside of one badge's `<svg viewBox="0 0 100 100">`, its ids
 * prefixed with `id` (unique on the page). `frequency` prints on the tab
 * ("97.7"); radio off has none.
 */
export function badgeMarkup(logo: LogoStyle, id: string, frequency?: string): string {
  const key = `${logo} ${frequency ?? ""}`;
  let markup = cache.get(key);
  if (markup === undefined) {
    markup = inlineTokens(DRAW[logo](ID, frequency ?? null));
    cache.set(key, markup);
  }
  return markup.replaceAll(ID, id);
}
