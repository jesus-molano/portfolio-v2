import type { CSSProperties } from "react";
import { chapterLayout, chapterName, ribbonCaps, shadeLayers, type ChapterLayout } from "./chapterLayout";
import styles from "./ChapterCard.module.css";

/** A chapter in the dictionaries (`<section>.chapter`): the painted word as it is read, and the ribbon under it. */
export type Chapter = { word: string; ribbon: string };

type Props = {
  /** The section's heading id (its aria-labelledby). */
  id: string;
  chapter: Chapter;
  lang: string;
  /** The section's placement of the card (its band: room above and below, a straddle). */
  className?: string;
};

/** The shade, back to front, the same for every card. */
const SHADE = shadeLayers();

function layoutOf(chapter: Chapter, lang: string): ChapterLayout {
  return chapterLayout(chapter.word, ribbonCaps(chapter.ribbon, lang));
}

/**
 * The CSS lengths a section reads to place a card, as shares of the card's
 * width: its height (`--chapter-h`) and its rise over a section's top edge
 * when it straddles it (`--chapter-edge`, the word's middle). A section
 * whose scroll-margin counts the rise sets them on itself too.
 */
export function chapterVars(chapter: Chapter, lang: string): CSSProperties {
  return layoutVars(layoutOf(chapter, lang));
}

function layoutVars(layout: ChapterLayout): CSSProperties {
  return {
    "--chapter-edge": (layout.edge / 1000).toFixed(4),
    "--chapter-h": (layout.height / 1000).toFixed(4),
  } as CSSProperties;
}

/**
 * A chapter card, the heading of a static section: a sign-painter's word
 * (the film's voice paying off the beat before it) over a scroll banner
 * that says plainly what the section is. One server-drawn SVG, laid out by
 * chapterLayout.ts; the word and the ribbon are its text, once each (the
 * shades are <use> copies), selectable and found by find in page. The SVG
 * is hidden from assistive technology and the heading is named
 * "<word>. <ribbon>". The entrance is ChapterMotion's, once for every card
 * on the page.
 */
export function ChapterCard({ id, chapter, lang, className }: Props) {
  const layout = layoutOf(chapter, lang);
  const { word, ribbon, banner } = layout;
  const ids = {
    word: `${id}-word`,
    shape: `${id}-shape`,
    baseline: `${id}-baseline`,
    wordFill: `${id}-word-fill`,
    bandFill: `${id}-band-fill`,
    tailFill: `${id}-tail-fill`,
  };
  const shade = (href: string) =>
    SHADE.map(({ dx, dy, tone }) => <use key={`${dx} ${dy}`} href={`#${href}`} className={styles[tone]} transform={`translate(${dx} ${dy})`} />);
  const bandStops = (fill: "band" | "tail") =>
    (["Start", "Mid", "End"] as const).map((stop, i) => <stop key={stop} offset={i / 2} className={styles[`${fill}${stop}`]} />);

  return (
    <div className={className ? `${styles.band} ${className}` : styles.band} style={layoutVars(layout)} data-chapter="">
      <h2 id={id} className={styles.card} aria-label={chapterName(chapter.word, chapter.ribbon)}>
        <svg
          className={styles.sign}
          viewBox={`0 ${layout.minY} 1000 ${layout.height}`}
          width={1000}
          height={layout.height}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={ids.wordFill} gradientUnits="userSpaceOnUse" x1={0} y1={layout.wordFill.y1} x2={0} y2={layout.wordFill.y2}>
              <stop offset={0.25} className={styles.wordTop} />
              <stop offset={0.7} className={styles.wordMid} />
              <stop offset={1} className={styles.wordFoot} />
            </linearGradient>
            <linearGradient id={ids.bandFill} gradientUnits="userSpaceOnUse" x1={layout.bannerFill.x1} y1={0} x2={layout.bannerFill.x2} y2={0}>
              {bandStops("band")}
            </linearGradient>
            <linearGradient id={ids.tailFill} gradientUnits="userSpaceOnUse" x1={layout.bannerFill.x1} y1={0} x2={layout.bannerFill.x2} y2={0}>
              {bandStops("tail")}
            </linearGradient>
            <path id={ids.baseline} d={ribbon.path} />
            <g id={ids.shape}>
              <path d={banner.tails[0]} />
              <path d={banner.tails[1]} />
              <path d={banner.main} />
            </g>
          </defs>
          <g transform={`rotate(${layout.tilt} ${layout.pivot.x} ${layout.pivot.y})`}>
            {/* The banner and its shade, behind the word; it unfurls from its middle (ChapterMotion). */}
            <g className={styles.banner}>
              <g className={styles.shade}>{shade(ids.shape)}</g>
              <g className={styles.piece} fill={`url(#${ids.tailFill})`}>
                <path d={banner.tails[0]} />
                <path d={banner.tails[1]} />
              </g>
              <g className={`${styles.piece} ${styles.fold}`}>
                <path d={banner.folds[0]} />
                <path d={banner.folds[1]} />
              </g>
              <path className={styles.piece} fill={`url(#${ids.bandFill})`} d={banner.main} />
              <path className={styles.pin} d={banner.pins[0]} />
              <path className={styles.pin} d={banner.pins[1]} />
              <text className={styles.caps} fontSize={ribbon.size} letterSpacing={ribbon.letterSpacing}>
                <textPath
                  href={`#${ids.baseline}`}
                  startOffset={ribbon.startOffset}
                  textAnchor="middle"
                  textLength={ribbon.textLength}
                  lengthAdjust="spacingAndGlyphs"
                >
                  {ribbon.text}
                </textPath>
              </text>
            </g>
            {/* The word and its shade, which falls on the banner where a descender crosses it. It turns into place about the pivot. */}
            <g className={styles.word} style={{ transformOrigin: `${layout.pivot.x}px ${layout.pivot.y}px` }}>
              <g className={styles.shade}>{shade(ids.word)}</g>
              <g className={`${styles.piece} ${styles.letters}`} fill={`url(#${ids.wordFill})`}>
                <text
                  id={ids.word}
                  x={word.x}
                  y={0}
                  fontSize={word.size}
                  wordSpacing={word.wordSpacing}
                  textLength={word.textLength}
                  lengthAdjust="spacingAndGlyphs"
                >
                  {word.text}
                </text>
              </g>
            </g>
          </g>
        </svg>
      </h2>
    </div>
  );
}
