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
   * The page controls' backing off the hero's picture: opaque, so the text
   * scrolling under them never shows through (at 0.9 it still ghosted).
   */
  controlsBackdrop: "rgb(18, 10, 38)",
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
  /** Night fog over the island at every stop (src/features/night). */
  nightFog: "#241a4a",
  /** Cool white LED, the newest light in the city. */
  led: "#eef4ff",
  /** The thin moon over the island. */
  moon: "#f3eeff",
  /** Sodium street light at night, deeper than the daytime trim. */
  sodiumNight: "#ffb347",
} as const;

export type PaletteKey = keyof typeof palette;

/**
 * The radio (src/features/music): one accent per station, for its wedge on
 * the wheel and its frequency on the music button, and the colours of the
 * station logos. Our own logos and colours; no trademarks. Emitted as
 * `--va-radio-*`.
 */
export const radio = {
  /** Shared by every badge: the frame's deepest shadow, a white glint, a fabric weave and a tyre. */
  shadow: "#0b0614",
  glint: "#ffffff",
  weave: "#2a1d3d",
  tyre: "#140a22",
  /** BOBSLED 88.3: a four-man sled off a banked ice wall on a cold, sunny morning; green, gold and black. */
  bobsled: "#3ddc84",
  bobsledGold: "#ffc93c",
  bobsledGreen: "#1f9e5a",
  bobsledDeep: "#0f5a3a",
  bobsledBlack: "#120a1c",
  bobsledIce: "#bfe9f2",
  bobsledIceDeep: "#6fb3d6",
  bobsledSky: "#cfe8f7",
  bobsledSkyDeep: "#7fb2e8",
  bobsledWall: "#2d5f9e",
  bobsledSkin: "#8a4f36",
  /** RAHEEM 92.9: a fist with a gold LOVE ring over a boombox, on a heatwave. */
  raheem: "#ff9a3c",
  raheemGold: "#f0c36a",
  raheemGoldDeep: "#a9741f",
  raheemBrick: "#b0302a",
  raheemSkin: "#8a4c34",
  raheemSkinLight: "#c07a55",
  raheemSkinDeep: "#4a2027",
  /** MANERO 97.7: a white suit on a lit floor under a mirror ball. */
  manero: "#ff4fd8",
  maneroNight: "#12081f",
  maneroShirt: "#1a0d2e",
  /** ONE LOUDER 101.1: a chrome knob cranked past ten, an amp's gold panel, black tolex. */
  louder: "#9cc2ff",
  louderHot: "#ff6a2b",
  louderTolex: "#120a1c",
  louderChrome: "#b8a8d8",
  louderStage: "#0d0716",
  louderDeep: "#2b4f9e",
  louderPanel: "#e6c27a",
  louderPanelDeep: "#a8803e",
  /** WITNESS ME 104.5: ransom-note tape over a pink spray splat and a chrome can. */
  witness: "#ffe14d",
  witnessInk: "#160a24",
  witnessSteel: "#d9d4e8",
  witnessDeep: "#7a0f4e",
  /** TOFU 107.6: a hatchback drifting a hairpin before dawn, a tofu box on the roof. */
  tofu: "#8f6bff",
  tofuNight: "#0d0618",
  tofuDusk: "#3b1a66",
  tofuDawn: "#ffb48a",
  tofuRidge: "#4a2a7a",
  tofuLow: "#1a0f2a",
  tofuSide: "#e9dccf",
  tofuShade: "#c7b5c9",
  tofuSmoke: "#d9cdf0",
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
  /**
   * The chapter cards (src/components/ChapterCard): the word in Chapter
   * Script, our subset of Mr Dafoe, a sign-painter's brush script; the
   * banner's capitals in Big Shoulders Display Black, a condensed face from
   * 1930s Chicago signage, kin to the deco hotels and the cinema.
   */
  chapterScript: "var(--font-chapter-script), 'Brush Script MT', cursive",
  chapterCaps: "var(--font-chapter-caps), 'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
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
  /** BOBSLED and MANERO: a fat, soft seventies display face. */
  seventies: "var(--font-radio-seventies), var(--font-display), 'Arial Black', sans-serif",
  /** TOFU: a heavy italic, like a drift video's title. */
  chrome: "var(--font-radio-chrome), var(--font-display), 'Arial Black', sans-serif",
  /** RAHEEM: chunky late-eighties block letters (the night city's ban notice too). */
  hiphop: "var(--font-radio-hiphop), var(--font-display), Impact, sans-serif",
  /** ONE LOUDER and WITNESS ME: the chapter cards' condensed capitals, Big Shoulders Display Black. */
  caps: "var(--font-chapter-caps), 'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
} as const;

/**
 * Sign-painter's faces of the night city's boards (src/features/night) and
 * the credits' THE END, loaded like the radio's: never preloaded.
 */
export const signFonts = {
  /** A high-contrast serif. */
  serif: "var(--font-sign-serif), Didot, Georgia, serif",
  /** A bold shop-window script. */
  script: "var(--font-sign-script), 'Brush Script MT', cursive",
  /** An art-deco display face. */
  deco: "var(--font-sign-deco), Didot, Georgia, serif",
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
  /** The same ease for CSS transitions (the chapter cards' entrance). */
  easeCss: "cubic-bezier(0.215, 0.61, 0.355, 1)",
  /** Lenis interpolation factor. */
  scrollLerp: 0.09,
  /** Lenis touch inertia interpolation (syncTouch). */
  touchLerp: 0.08,
  /**
   * Hero stage height, in hundredths of the large viewport height
   * (`--va-lvh`, held still through a phone's bars; a scroll range of five). The
   * story's walls pace the cards, so a shorter scroll skips nothing: one
   * wheel notch is about 2% of the film.
   */
  heroScrollVh: 600,
} as const;

/**
 * STATS's achievement tree (src/features/stats/Achievements.tsx): one
 * colour per constellation, the colour its lit stars and links glow in.
 * Locked stars are drawn from `locked`; the white flag of the one he gave
 * up on is `flag`. Never the on-air red, which is Heuristik's alone.
 * Emitted as `--va-tree-*`.
 */
export const achievementTree = {
  /** SPORT: the track's sodium lights. */
  sport: palette.sodium,
  /** GAMES: a console's standby glow. */
  games: palette.cyan,
  /** FILM: the projector's warm beam. */
  film: palette.orange,
  /** SERIES: the late-night pink of the TV. */
  series: palette.pink,
  /** A locked star: unlit lilac. */
  locked: palette.lilac,
  /** The white flag. */
  flag: palette.cream,
  /** His two favourites (The Godfather, The Sopranos): a deeper gold than SPORT's sodium. */
  favourite: palette.sodiumNight,
  /** The sky behind the constellations, a shade deeper than the menu's panels. */
  sky: mixHex(palette.night, palette.letterbox, 0.32),
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

/** A colour `t` of the way from `a` to `b` (both #rrggbb), for the tokens derived below. */
export function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** The back of the banner's ribbon: a tail is the band turned from the light, toward magenta and a little ink. */
export function tailOf(colour: string): string {
  return mixHex(mixHex(colour, palette.magenta, 0.3), palette.ink, 0.105);
}

/**
 * The chapter cards (src/components/ChapterCard): a sign-painter's word
 * over a scroll banner. The word's fill from its top to its foot, the ink
 * keyline round every piece, the magenta split shade and the dusk-to-ink
 * block shade; the band's fill from left to right (the tails a shade
 * deeper), the fold where the ribbon turns over, the cream pinstripe and
 * the capitals on the band; the night haze under the card. Emitted as
 * `--va-chapter-*`.
 */
export const chapterCard = {
  wordTop: palette.cream,
  wordMid: palette.amber,
  /** A warm peach the word's descenders end in. */
  wordFoot: "#ffb894",
  keyline: palette.ink,
  split: palette.magenta,
  block: palette.dusk,
  blockDeep: palette.ink,
  bandStart: palette.orange,
  /** Peach, between the low sun's orange and the pink. */
  bandMid: "#ffa48c",
  bandEnd: palette.pink,
  tailStart: tailOf(palette.orange),
  tailMid: tailOf("#ffa48c"),
  tailEnd: tailOf(palette.pink),
  fold: mixHex(palette.magenta, palette.ink, 0.5),
  pin: palette.cream,
  caps: palette.night,
  haze: palette.night,
} as const;

/**
 * The chapter cards' width (ChapterCard.module.css): their band less 2rem,
 * at most `rem` rem, emitted with the cap below as --va-chapter-span. In
 * rem, not in viewport widths, so a card grows with the text size and the
 * browser's zoom like any other heading, until the window stops it. Never
 * wider than `perHeight` times the screen's height either: that only binds
 * under 512 px of height (a phone on its side), where a card would
 * otherwise fill the screen.
 */
export const chapterSpan = { rem: 48, perHeight: 1.5 } as const;

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
  entries.push(`--va-font-chapter-script: ${typography.chapterScript};`);
  entries.push(`--va-font-chapter-caps: ${typography.chapterCaps};`);
  for (const [key, value] of Object.entries(radioFonts)) {
    entries.push(`--va-font-radio-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(signFonts)) {
    entries.push(`--va-font-sign-${kebab(key)}: ${value};`);
  }
  entries.push(`--va-size-hero-name: ${typography.heroName};`);
  entries.push(`--va-size-hero-role: ${typography.heroRole};`);
  entries.push(`--va-size-body: ${typography.bodySize};`);
  entries.push(`--va-motion-reveal: ${motion.revealDuration}s;`);
  entries.push(`--va-motion-ease: ${motion.easeCss};`);
  // In stable screens (lib/screen.ts): the stage never grows or shrinks with a phone's bars.
  entries.push(`--va-hero-scroll: calc(${motion.heroScrollVh} * var(--va-lvh));`);
  for (const [key, value] of Object.entries(radio)) {
    entries.push(`--va-radio-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(lineup)) {
    entries.push(`--va-lineup-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(achievementTree)) {
    entries.push(`--va-tree-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(finale)) {
    entries.push(`--va-finale-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(chapterCard)) {
    entries.push(`--va-chapter-${kebab(key)}: ${value};`);
  }
  entries.push(`--va-chapter-span: min(${chapterSpan.rem}rem, ${chapterSpan.perHeight * 100}svh);`);
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
