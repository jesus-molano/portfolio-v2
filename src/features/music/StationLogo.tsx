import { type ReactNode, useId } from "react";
import styles from "./StationLogo.module.css";
import type { LogoStyle } from "./stations";

type Props = { logo: LogoStyle; frequency?: string; className?: string };

/** LOVE DADDY's brick wall: courses 8 units high, every other one offset by half a brick. */
const BRICKS = (() => {
  const lines: string[] = [];
  for (let row = 0; row < 13; row++) {
    const y = row * 8;
    lines.push(`M0 ${y}H100`);
    const shift = row % 2 === 0 ? 0 : 8;
    for (let x = shift; x <= 100; x += 16) lines.push(`M${x} ${y}V${y + 8}`);
  }
  return lines.join("");
})();

/**
 * One round badge per station, our own typographic logos drawn in SVG with
 * the colours of the `radio` tokens (StationLogo.module.css) and the faces
 * of `radioFonts`. Decorative: the wheel names every station in text.
 */
export function StationLogo({ logo, frequency, className }: Props) {
  // Gradient, filter and path ids must be unique per badge on the page.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svg = (children: ReactNode) => (
    <svg
      className={[styles.logo, className].filter(Boolean).join(" ")}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>{children}</g>
    </svg>
  );
  const glow = `url(#${id}-glow)`;

  switch (logo) {
    // K-CALIMA: a seventies call-sign arched over a hazy sunset sky.
    case "calima":
      return svg(
        <>
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.calimaSky0} />
              <stop offset="0.42" className={styles.calimaSky1} />
              <stop offset="0.72" className={styles.calimaSky2} />
              <stop offset="1" className={styles.calimaSky3} />
            </linearGradient>
            <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" className={styles.calimaSun0} />
              <stop offset="1" className={styles.calimaSun1} />
            </radialGradient>
            <path id={`${id}-arc`} d="M15 58 A35 35 0 0 1 85 58" />
          </defs>
          <rect width="100" height="100" fill={`url(#${id}-sky)`} />
          <circle cx="50" cy="66" r="30" fill={`url(#${id}-sun)`} />
          <path className={styles.calimaHaze} d="M-4 76 Q8.5 71 21 76 T46 76 T71 76 T96 76 T121 76" />
          <path className={styles.calimaHazeFar} d="M-16 85 Q-3.5 80.5 9 85 T34 85 T59 85 T84 85 T109 85" />
          <text className={styles.calimaShadow} transform="translate(1.4 1.8)">
            <textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">
              K-CALIMA
            </textPath>
          </text>
          <text className={styles.calimaCall}>
            <textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">
              K-CALIMA
            </textPath>
          </text>
          <rect className={styles.calimaPill} x="31" y="55" width="38" height="15" rx="7.5" />
          <text className={styles.calimaFreq} x="50" y="66.2" textAnchor="middle">
            {frequency}
          </text>
        </>,
      );

    // CROCKETT: an eighties TV title of our own, chrome italic over pink
    // and teal speed stripes on a Miami night. Nothing of the show's logo.
    case "crockett":
      return svg(
        <>
          <defs>
            <linearGradient id={`${id}-night`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.35" className={styles.crockettNight0} />
              <stop offset="1" className={styles.crockettNight1} />
            </linearGradient>
            <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.12" className={styles.chrome0} />
              <stop offset="0.5" className={styles.chrome1} />
              <stop offset="0.5" className={styles.chrome2} />
              <stop offset="0.62" className={styles.chrome3} />
              <stop offset="0.95" className={styles.chrome4} />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#${id}-night)`} />
          {/* Speed stripes, slanted like the type, running out of the left edge. */}
          <g transform="skewX(-14)">
            <rect className={styles.stripePink} x="-10" y="58" width="104" height="4.2" />
            <rect className={styles.stripeHot} x="-10" y="64.2" width="98" height="2.6" />
            <rect className={styles.stripeTeal} x="-10" y="68.8" width="92" height="4.2" />
            <rect className={styles.stripeTealPale} x="-10" y="75" width="86" height="1.8" />
          </g>
          {/* Squeezed into its width, glyphs and all: spacing alone made the letters overlap ("CROCKEIT"). */}
          <text
            className={styles.crockettShadow}
            x="51.5"
            y="53.5"
            textAnchor="middle"
            textLength="80"
            lengthAdjust="spacingAndGlyphs"
          >
            CROCKETT
          </text>
          <text
            className={styles.crockettChrome}
            x="50"
            y="52"
            textAnchor="middle"
            textLength="80"
            lengthAdjust="spacingAndGlyphs"
            fill={`url(#${id}-chrome)`}
          >
            CROCKETT
          </text>
          <path className={styles.crockettSpark} d="M79 30 l1.1 4.4 4.4 1.1 -4.4 1.1 -1.1 4.4 -1.1 -4.4 -4.4 -1.1 4.4 -1.1Z" />
          <text className={styles.crockettFreq} x="50" y="88" textAnchor="middle">
            {frequency}
          </text>
        </>,
      );

    // MR. WOLF: white serif on a black tux, a bow tie, nothing else.
    case "wolf":
      return svg(
        <>
          <rect className={styles.wolfTux} width="100" height="100" />
          <circle className={styles.wolfRing} cx="50" cy="50" r="45" />
          <line className={styles.wolfRule} x1="27" y1="33" x2="73" y2="33" />
          <text className={styles.wolfName} x="50" y="49.5" textAnchor="middle">
            MR. WOLF
          </text>
          <line className={styles.wolfRule} x1="27" y1="56" x2="73" y2="56" />
          {/* Satin lapels, edged so they read on the black jacket, over a pressed shirt. */}
          <path className={styles.wolfSatin} d="M22 100 L50 72 L78 100 Z" />
          <path className={styles.wolfLapel} d="M22 100 L50 72 L78 100" />
          <path className={styles.wolfShirt} d="M38 100 L50 76 L62 100 Z" />
          <circle className={styles.wolfStud} cx="50" cy="86" r="1.1" />
          <circle className={styles.wolfStud} cx="50" cy="93" r="1.1" />
          <path className={styles.wolfShirt} d="M50 69 L39 63.5 V74.5 Z M50 69 L61 63.5 V74.5 Z" />
          <circle className={styles.wolfShirt} cx="50" cy="69" r="2.4" />
        </>,
      );

    // LEAVE THE GUN: a Little Italy deli stamp, red script and a cannoli.
    case "deli":
      return svg(
        <>
          <rect className={styles.gunPaper} width="100" height="100" />
          <circle className={styles.gunRingGreen} cx="50" cy="50" r="46" />
          <circle className={styles.gunRingRed} cx="50" cy="50" r="42.5" />
          <text className={styles.gunScript} x="49" y="38" textAnchor="middle" transform="rotate(-8 50 40)">
            Leave the
          </text>
          <text className={styles.gunScriptBig} x="52" y="58" textAnchor="middle" transform="rotate(-8 50 40)">
            Gun
          </text>
          <g transform="rotate(-14 50 72)">
            <rect className={styles.gunShell} x="28" y="65" width="44" height="13" rx="6.5" />
            <path className={styles.gunRidge} d="M36 65.5 V77.5 M43 65 V78 M50 65 V78 M57 65 V78 M64 65.5 V77.5" />
            <ellipse className={styles.gunCream} cx="28" cy="71.5" rx="4.6" ry="6.5" />
            <ellipse className={styles.gunCream} cx="72" cy="71.5" rx="4.6" ry="6.5" />
            <circle className={styles.gunPistachio} cx="27" cy="69.5" r="1.1" />
            <circle className={styles.gunPistachio} cx="29" cy="73.5" r="1.1" />
            <circle className={styles.gunPistachio} cx="71" cy="70" r="1.1" />
            <circle className={styles.gunPistachio} cx="73" cy="73.8" r="1.1" />
          </g>
        </>,
      );

    // LOVE DADDY: block letters over a boombox on a brick wall.
    case "boombox":
      return svg(
        <>
          <rect className={styles.daddyBrick} width="100" height="100" />
          <path className={styles.daddyMortar} d={BRICKS} />
          <g transform="rotate(-6 50 34)">
            <text className={styles.daddyBlock} x="51.6" y="31.6" textAnchor="middle">
              LOVE
            </text>
            <text className={styles.daddyBlock} x="51.6" y="49.6" textAnchor="middle" textLength="70">
              DADDY
            </text>
            <text className={styles.daddyLetters} x="50" y="30" textAnchor="middle">
              LOVE
            </text>
            <text className={styles.daddyLetters} x="50" y="48" textAnchor="middle" textLength="70">
              DADDY
            </text>
          </g>
          {/* The boombox: handle, body, two speakers and the tape deck. */}
          <path className={styles.daddyHandle} d="M30 60 V55.5 Q30 53 32.5 53 H67.5 Q70 53 70 55.5 V60" />
          <rect className={styles.daddyBox} x="12" y="59" width="76" height="31" rx="4" />
          <circle className={styles.daddySpeaker} cx="27" cy="75" r="10" />
          <circle className={styles.daddyCone} cx="27" cy="75" r="4" />
          <circle className={styles.daddySpeaker} cx="73" cy="75" r="10" />
          <circle className={styles.daddyCone} cx="73" cy="75" r="4" />
          <rect className={styles.daddyDeck} x="40" y="70" width="20" height="12" rx="1.5" />
          <circle className={styles.daddyReel} cx="46" cy="76" r="2.4" />
          <circle className={styles.daddyReel} cx="54" cy="76" r="2.4" />
          <text className={styles.daddyFreq} x="50" y="67.4" textAnchor="middle">
            {frequency}
          </text>
        </>,
      );

    // BABYLON: a mirror ball over art-deco neon, gold rules either side.
    case "babylon":
      return svg(
        <>
          <defs>
            <radialGradient id={`${id}-ball`} cx="0.36" cy="0.32" r="0.75">
              <stop offset="0" className={styles.ball0} />
              <stop offset="0.45" className={styles.ball1} />
              <stop offset="1" className={styles.ball2} />
            </radialGradient>
            <radialGradient id={`${id}-haze`} cx="0.5" cy="0.36" r="0.6">
              <stop offset="0" className={styles.babylonHaze0} />
              <stop offset="1" className={styles.babylonHaze1} />
            </radialGradient>
            <clipPath id={`${id}-ball-clip`}>
              <circle cx="50" cy="35" r="17" />
            </clipPath>
          </defs>
          <rect className={styles.babylonNight} width="100" height="100" />
          <rect width="100" height="100" fill={`url(#${id}-haze)`} />
          {/* Deco sunburst behind the ball. */}
          <path
            className={styles.babylonRays}
            d="M50 35 L22 4 M50 35 L36 0 M50 35 L50 -2 M50 35 L64 0 M50 35 L78 4 M50 35 L12 22 M50 35 L88 22"
          />
          <line className={styles.babylonCord} x1="50" y1="0" x2="50" y2="18" />
          <circle cx="50" cy="35" r="17" fill={`url(#${id}-ball)`} />
          <g clipPath={`url(#${id}-ball-clip)`} className={styles.ballFacets}>
            <path d="M33 29 H67 M33 35 H67 M33 41 H67 M33 47 H67 M33 23 H67" />
            <ellipse cx="50" cy="35" rx="6" ry="17" />
            <ellipse cx="50" cy="35" rx="12" ry="17" />
            <line x1="50" y1="18" x2="50" y2="52" />
          </g>
          <g className={styles.ballGlints}>
            <rect x="42" y="24" width="4" height="4" />
            <rect x="51" y="30" width="4" height="4" />
            <rect x="45" y="36" width="4" height="4" />
          </g>
          <path className={styles.babylonSpark} d="M74 22 l1 3.6 3.6 1 -3.6 1 -1 3.6 -1 -3.6 -3.6 -1 3.6 -1Z" />
          <path className={styles.babylonSpark} d="M25 44 l.7 2.6 2.6 .7 -2.6 .7 -.7 2.6 -.7 -2.6 -2.6 -.7 2.6 -.7Z" />
          <path className={styles.babylonRule} d="M14 61 H86 M20 82 H80" />
          <path className={styles.babylonDiamond} d="M50 58.6 L52.4 61 L50 63.4 L47.6 61Z" />
          <text
            className={styles.babylonGlow}
            x="50"
            y="76.5"
            textAnchor="middle"
            textLength="70"
            lengthAdjust="spacingAndGlyphs"
            filter={glow}
          >
            BABYLON
          </text>
          <text
            className={styles.babylonTube}
            x="50"
            y="76.5"
            textAnchor="middle"
            textLength="70"
            lengthAdjust="spacingAndGlyphs"
          >
            BABYLON
          </text>
        </>,
      );

    // Radio off: a plain power symbol.
    case "power":
      return svg(
        <>
          <rect className={styles.offGround} width="100" height="100" />
          <circle className={styles.offRing} cx="50" cy="50" r="45" />
          <path className={styles.offSymbol} d="M39.4 36.4 A17 17 0 1 0 60.6 36.4 M50 29 V50" />
        </>,
      );
  }
}
