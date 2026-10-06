import type { CSSProperties } from "react";
import { ChapterCard } from "@/components/ChapterCard/ChapterCard";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import manifest from "../../../public/interlude/manifest.json";
import { CulpritPlate } from "./CulpritPlate";
import { FitLine } from "./FitLine";
import { CULPRIT, isCatId, parseManifest, placeLineup, placementStyle, plateNumber, PHONE_CHART, WIDE_CHART } from "./lineup";
import styles from "./Suspects.module.css";

type Props = { dict: Dictionary["suspects"]; lang: Locale };

/** Every cat on the chart, from the renders' manifest (checked at build time). */
const LINEUP = new Map(placeLineup(parseManifest(manifest)).map((p) => [p.id, p]));

/** Chart labels every 10 cm: the wide wall's and a phone strip's. */
const WIDE_MARKS = marks(WIDE_CHART.topCm);
const STRIP_MARKS = marks(PHONE_CHART.topCm);

function marks(topCm: number): number[] {
  return Array.from({ length: Math.floor(topCm / 10) }, (_, i) => (i + 1) * 10);
}

/**
 * THE USUAL SUSPECTS: a police line-up of Jesús's four cats against a
 * height chart, right after the hero. A server component with no canvas
 * and no looping animation; its script is the culprit's plate
 * (CulpritPlate), whose GUILTY stamp hover, focus or a tap brings up, and
 * the fit of his line's card (FitLine). The cats are images on one scale
 * (lineup.ts), the wall, chart, plates and his complaint are HTML, and
 * every word is real text. It ends on his line to the officer, pointing at
 * number 3, in the hero's subtitle card.
 *
 * It opens on its chapter card, THE CREW, the payoff of the hero's last
 * line ("Come and meet the crew"), over the wall's night lead-in; the
 * line-up (the board) keeps its one-screen sizing under it.
 */
export function Suspects({ dict, lang }: Props) {
  return (
    <section id="suspects" className={styles.suspects} aria-labelledby="suspects-title" tabIndex={-1}>
      <ChapterCard id="suspects-title" chapter={dict.chapter} lang={lang} className={styles.chapter} />

      <div className={styles.board}>
        {/* The wall and its height chart, read from the floor line. */}
        <div className={styles.wall} aria-hidden="true">
          {WIDE_MARKS.map((cm) => (
            <span key={cm} className={styles.mark} style={{ "--mark": cm } as CSSProperties}>
              <span>{cm}</span>
              <span>{cm}</span>
            </span>
          ))}
        </div>

        {/* The case label on the wall: the card above is the heading. */}
        <p className={styles.slug}>
          <span className={styles.place}>{dict.place}</span>{" "}
          <span className={styles.associates}>{dict.associates}</span>
        </p>

        <p className="sr-only">{dict.description}</p>

        <ol className={styles.lineup}>
          {dict.cats.map((cat, index) => {
            const placement = isCatId(cat.id) ? LINEUP.get(cat.id) : undefined;
            if (!placement) return null;
            return (
              <li
                key={cat.id}
                className={styles.suspect}
                data-cat={cat.id}
                style={placementStyle(placement) as CSSProperties}
              >
                <div className={styles.spot} aria-hidden="true">
                  <span className={styles.stripMarks}>
                    {STRIP_MARKS.map((cm) => (
                      <span key={cm} style={{ "--mark": cm } as CSSProperties}>
                        {cm}
                      </span>
                    ))}
                  </span>
                  <span className={styles.numeral}>{index + 1}</span>
                  <picture>
                    <source type="image/avif" srcSet={`/interlude/${cat.id}.avif`} />
                    <img
                      className={styles.cat}
                      src={`/interlude/${cat.id}.webp`}
                      width={placement.w}
                      height={placement.h}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </div>
                <div className={styles.tag}>
                  {cat.id === CULPRIT ? (
                    <CulpritPlate number={`${dict.numberPrefix} ${plateNumber(index)}`} name={cat.name} alias={cat.alias} stamp={dict.stamp} />
                  ) : (
                    <p className={styles.plate}>
                      <span className={styles.number} aria-hidden="true">
                        {dict.numberPrefix} {plateNumber(index)}
                      </span>
                      <span className={styles.name}>{cat.name}</span>
                      <span className="sr-only">, </span>
                      <span className={styles.alias}>{cat.alias}</span>
                    </p>
                  )}
                  <p className={styles.description}>{cat.description}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/*
          His complaint, taped to the wall: the damage ticked off like a report,
          then the tally. Part of the line-up, not a landmark of its own: its
          heading is enough to reach it.
        */}
        <div className={styles.slip}>
          <h3 className={styles.slipTitle}>
            <span>{dict.complaint.title}</span>
            <span className="sr-only">, </span>
            <span className={styles.slipOwner}>{dict.complaint.owner}</span>
          </h3>
          <ul className={styles.damages}>
            {dict.complaint.items.map((item) => (
              <li key={item}>
                {/*
                  The printed box and the pen's tick, drawn: a ✓ glyph came
                  from whatever fallback face the system had, each at its own
                  height. The box stands in the item's first line, on its
                  x-height centre (Suspects.module.css).
                */}
                <span aria-hidden="true">
                  <svg className={styles.box} viewBox="0 0 16 16" focusable="false">
                    <rect className={styles.boxLine} x="0.5" y="0.5" width="15" height="15" />
                    <path className={styles.pen} d="M3.4 8.4c1.3.9 2.4 2.2 3.3 3.9C8.9 7.6 12 3 16.4-1.4" />
                  </svg>
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className={styles.tally}>{dict.complaint.tally}</p>
        </div>

        {/* His line to the officer, on a row of its own: the hero's subtitle card, as wide as its widest line,
            at the subtitle size she picked (data-captions, lib/subtitleSize.ts). */}
        <p className={styles.caption} data-captions>
          <FitLine className={styles.captionText}>
            <span className={styles.speaker}>{dict.speaker}:</span> {dict.line}
          </FitLine>
        </p>
      </div>
    </section>
  );
}
