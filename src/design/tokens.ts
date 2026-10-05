/**
 * Vice Afterglow design tokens.
 *
 * Single source of truth for the palette, typography, motion and layering.
 * - CSS reads them as custom properties emitted by `TokensStyle` (`--va-*`).
 * - Three.js materials and shaders import the hex values directly.
 */

export const palette = {
  /** Deep violet: page bottom, the finale's night, shadows. */
  night: "#1a0d38",
  /** Upper sky lavender. */
  dusk: "#6a4bc4",
  /** Pink afterglow haze, also the fog color. */
  haze: "#e39bbd",
  /** Primary hot pink accent. */
  magenta: "#ff2d95",
  /** Soft pink for highlights. */
  pink: "#ff8fd0",
  /** Cool accent, used sparingly. */
  cyan: "#19e6ff",
  /** Violet accents. */
  violet: "#8a4dff",
  /** Low sun orange. */
  orange: "#ff8a5c",
  /** Peach: sunlit edges, lines. */
  amber: "#ffd8a8",
  /** Silhouettes: buildings, palms. Deep violet, never black. */
  ink: "#2b1848",
  /** Sunlit top of the city silhouettes (skyline and landmark tower). */
  lilac: "#8c62b8",
  /** Asphalt and dark street furniture (lamp poles, tower frames). */
  asphalt: "#3a2a5c",
  /** Warm sodium yellow: lane lines, lamp light, trims. */
  sodium: "#ffd27a",
  /** Warm off-white for display type. */
  cream: "#fff4f1",
  /** Body text. */
  text: "#f6f1ff",
  /** Secondary text. */
  textMuted: "rgba(246, 241, 255, 0.72)",
  /** Hairline borders on controls. */
  line: "rgba(246, 241, 255, 0.25)",
  /** Frosted control background over the scene. */
  glass: "rgba(6, 3, 13, 0.45)",
  /** Fill of the selected segment in a segmented control. */
  selected: "rgba(246, 241, 255, 0.14)",
  /**
   * Backing of the hero's on-screen display: transport, Skip, captions,
   * cues and the touch hint. Cream on it stays above 7.5:1 over any part
   * of the scene, the pink accents above 3.9:1.
   */
  osd: "rgba(18, 10, 38, 0.72)",
  /**
   * The same backing, denser, for longer reading over the loading screen's
   * key art (its tip card): cream on it stays above 12:1 over the sun.
   */
  osdDense: "rgba(18, 10, 38, 0.88)",
  /** The cinematic letterbox bars. */
  letterbox: "#000000",
  /**
   * The on-air tally: Heuristik's LIVE, and nothing else on the site. The
   * only red, so it always reads as "this one is running now".
   */
  onAir: "#ff2b3a",
} as const;

export type PaletteKey = keyof typeof palette;

/**
 * The radio (src/features/music): one accent per station, for its wedge on
 * the wheel and its frequency on the music button, and the colours of the
 * station logos. Our own logos and colours; no trademarks. Emitted as
 * `--va-radio-*`.
 */
export const radio = {
  /** K-CALIMA 87.9: sunset orange; its logo uses the sky palette. */
  calima: palette.orange,
  /** CROCKETT 91.4: teal and pink speed stripes, chrome type, a Miami night. */
  crockett: "#22d8c3",
  crockettNight: "#140a33",
  crockettChrome: "#9cc2ff",
  crockettHorizon: "#3b2a78",
  /** MR. WOLF 94.7: white tie on a black tux. */
  wolf: "#f5f1e8",
  wolfTux: "#0b0a10",
  wolfSatin: "#2a2733",
  /** LEAVE THE GUN 99.2: deli paper, red script, green trim, a cannoli. */
  gun: "#2fae66",
  gunRed: "#d8343a",
  gunPaper: "#fbf0dc",
  gunShell: "#d9963f",
  gunCrust: "#8a5524",
  /** LOVE DADDY 102.5: a boombox on a brick wall, yellow block letters. */
  daddy: "#ffd23a",
  daddyBrick: "#b0302a",
  daddyMortar: "#7d1f1c",
  daddyBox: "#1d1418",
  /** BABYLON 105.1: pink disco neon, a mirror ball, deco gold. */
  babylon: "#ff4fd8",
  babylonNight: "#12081f",
  babylonGold: "#f0c36a",
  /** Radio off: quiet lavender grey. */
  off: "#9d90bf",
} as const;

export type RadioColor = keyof typeof radio;

/**
 * THE USUAL SUSPECTS (src/features/suspects): the police line-up wall
 * after the hero. The wall starts on `night` (where the hero fades out)
 * and eases into violet; his complaint is warm paper in `ink`.
 * Emitted as `--va-lineup-*`.
 */
export const lineup = {
  /** The wall under the chart, high (dark) and low (lit by the booking light). */
  wallHigh: "#1f1243",
  wallLow: "#33255f",
  /** The floor in front of the wall, under the plates. */
  floor: "#150b2e",
  /** The letter-board plates. */
  plate: "#120a26",
  /** The complaint: warm paper, its shaded edge, and the pen ticks on it. */
  paper: "#f2e6dd",
  paperShade: "#e6d7ce",
  stamp: "#7a1f4c",
  /**
   * The culprit's GUILTY stamp on his plate: rubber-stamp ink on the
   * berry side of red, so it never reads as the on-air tally
   * (`palette.onAir`, the site's one true red).
   */
  verdict: "#ff4d7a",
  /** The strip of tape that holds the slip to the wall (used translucent). */
  tape: "#a99fc4",
} as const;

export type LineupColor = keyof typeof lineup;

export const typography = {
  /** CSS variable names assigned by `next/font` in the root layout. */
  display: "var(--font-display), 'Arial Black', Impact, sans-serif",
  body: "var(--font-body), system-ui, sans-serif",
  mono: "var(--font-mono), ui-monospace, 'JetBrains Mono', monospace",
  /** The cinema's changeable letters and the ticket stubs (src/features/finale): a condensed poster face. */
  marquee: "var(--font-marquee), 'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
  /** Fluid sizes. */
  heroName: "clamp(2.7rem, 9.4vw, 10.5rem)",
  heroRole: "clamp(0.72rem, 1.05vw, 0.95rem)",
  bodySize: "clamp(1rem, 1.1vw, 1.125rem)",
} as const;

/**
 * Faces of the radio station logos, loaded by next/font in the root layout
 * without preloading: the browser fetches them when the wheel first shows.
 */
export const radioFonts = {
  /** K-CALIMA: a fat, soft seventies display face. */
  seventies: "var(--font-radio-seventies), var(--font-display), 'Arial Black', sans-serif",
  /** CROCKETT: a heavy italic for chrome eighties TV titles. */
  chrome: "var(--font-radio-chrome), var(--font-display), 'Arial Black', sans-serif",
  /** MR. WOLF: a high-contrast tuxedo serif. */
  tux: "var(--font-radio-tux), Didot, Georgia, serif",
  /** LEAVE THE GUN: a bold deli-window script. */
  deli: "var(--font-radio-deli), 'Brush Script MT', cursive",
  /** LOVE DADDY: chunky late-eighties block letters. */
  hiphop: "var(--font-radio-hiphop), var(--font-display), Impact, sans-serif",
  /** BABYLON: an art-deco display face for the neon. */
  deco: "var(--font-radio-deco), Didot, Georgia, serif",
} as const;

/**
 * Controls (buttons, button links, segmented switches) share one set of
 * metrics, in three sizes: `sm` for page chrome, `md` for calls to action,
 * `lg` for a full-screen choice such as the loading screen.
 */
export const controls = {
  heightSm: "2rem",
  heightMd: "2.75rem",
  heightLg: "3.5rem",
  paddingSm: "0 0.95rem",
  paddingMd: "0 1.6rem",
  paddingLg: "0 2.25rem",
  fontSm: "0.68rem",
  fontMd: "0.78rem",
  fontLg: "0.9375rem",
  tracking: "0.22em",
  radius: "999px",
  transition: "180ms ease",
} as const;

export const motion = {
  /** Seconds. */
  revealDuration: 1.6,
  revealStagger: 0.06,
  ease: "power3.out",
  /** Lenis interpolation factor. */
  scrollLerp: 0.09,
  /** Lenis touch inertia interpolation (syncTouch). */
  touchLerp: 0.08,
  /**
   * Hero stage height, in viewport heights (a scroll range of five). The
   * story's walls pace the cards, so a shorter scroll skips nothing: one
   * wheel notch is about 2% of the film.
   */
  heroScrollVh: 600,
} as const;

/**
 * The finale (src/features/finale): The Afterglow, a deco picture palace
 * at night, then the end credits at dawn. The plates are pre-drawn
 * (tools/art/finale); these are the colours of the live DOM laid on them.
 * Emitted as `--va-finale-*`.
 */
export const finale = {
  /** Changeable letters: black condensed caps on the milk-white board. */
  letterInk: "#1a0b2c",
  /** The edge of each letter's clear tile, catching the board's light. */
  tileEdge: "rgba(122, 106, 138, 0.16)",
  tileFace: "rgba(255, 255, 255, 0.05)",
  /** A lit bulb's filament, and its warm halo (sodium, fading to orange). */
  bulb: "#fffaf0",
  bulbHalo: "rgba(255, 210, 122, 0.5)",
  bulbHaloEdge: "rgba(255, 138, 92, 0)",
  /** A cold bulb in its socket. */
  bulbCold: "#5a4a6a",
  /** Chrome of the poster cases, from highlight to shadow. */
  chromeLight: "#fff6ea",
  chromeMid: "#b9a0c8",
  chromeDark: "#3a2050",
  chromeDeep: "#4a2a6a",
  /** The case's black backing behind the poster, and the glare across its glass. */
  caseBack: "#12061f",
  glassSheen: "rgba(255, 255, 255, 0.09)",
  /** Vitrolite: the black glass of the ground floor, where the portrait layout hangs the cases. */
  vitrolite: "#140a26",
  vitroliteDeep: "#0d0619",
  /** Brass trim: the cases' name plates, the terrazzo's inlay. */
  brass: "#e8b860",
  /** A case's light on the pavement, warm. */
  pool: "rgba(255, 216, 168, 0.5)",
  poolEdge: "rgba(255, 138, 122, 0)",
  /** A lit case burns pink (hover, focus). */
  hotGlow: "rgba(255, 45, 149, 0.55)",
  hotHalo: "rgba(255, 143, 208, 0.35)",
  /** The credits' scrim over the dawn plate, and the night under the roll. */
  scrim: "rgba(11, 6, 25, 0.82)",
  scrimClear: "rgba(11, 6, 25, 0)",
  /** Mask stops (only their alpha counts): the soft edges of the scrim and its fades, the tickets' notches. */
  mask: "#000000",
  maskClear: "rgba(0, 0, 0, 0)",
  /** The contact tickets: GitHub on sodium card, LinkedIn on pink, printed in ink. */
  ticketCode: "#ffd27a",
  ticketRecord: "#ff9ad0",
  ticketInk: "#2b1848",
  ticketPerforation: "rgba(43, 24, 72, 0.5)",
  /** Speaker cards (the hero's subtitle style): a dark band under cream. */
  card: "rgba(11, 6, 25, 0.72)",
} as const;

export const layers = {
  canvas: 0,
  haze: 1,
  title: 2,
  ui: 3,
  /** The fade to night at the end of the hero covers everything in it. */
  fade: 4,
  /** Page controls (music, language) stay above the fade. */
  chrome: 5,
  /** The radio wheel dims everything under it, the page controls too. */
  radio: 6,
  /** The loading screen covers everything until the visitor enters. */
  loader: 7,
} as const;

export const breakpoints = {
  /** Below this width the light scene tier is used. */
  mobile: 768,
} as const;

/** Flattened CSS custom properties, emitted once in the root layout. */
export function tokensToCssVariables(): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(palette)) {
    entries.push(`--va-color-${kebab(key)}: ${value};`);
  }
  entries.push(`--va-font-display: ${typography.display};`);
  entries.push(`--va-font-body: ${typography.body};`);
  entries.push(`--va-font-mono: ${typography.mono};`);
  entries.push(`--va-font-marquee: ${typography.marquee};`);
  for (const [key, value] of Object.entries(radioFonts)) {
    entries.push(`--va-font-radio-${kebab(key)}: ${value};`);
  }
  entries.push(`--va-size-hero-name: ${typography.heroName};`);
  entries.push(`--va-size-hero-role: ${typography.heroRole};`);
  entries.push(`--va-size-body: ${typography.bodySize};`);
  entries.push(`--va-motion-reveal: ${motion.revealDuration}s;`);
  entries.push(`--va-hero-scroll: ${motion.heroScrollVh}vh;`);
  for (const [key, value] of Object.entries(radio)) {
    entries.push(`--va-radio-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(lineup)) {
    entries.push(`--va-lineup-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(finale)) {
    entries.push(`--va-finale-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(controls)) {
    entries.push(`--va-control-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(layers)) {
    entries.push(`--va-z-${kebab(key)}: ${value};`);
  }
  return `:root{${entries.join("")}}`;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
