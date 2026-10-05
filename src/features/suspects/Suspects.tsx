import type { CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import manifest from "../../../public/interlude/manifest.json";
import { isCatId, parseManifest, placeLineup, placementStyle, plateNumber, PHONE_CHART, WIDE_CHART } from "./lineup";
import styles from "./Suspects.module.css";

type Props = { dict: Dictionary["suspects"] };

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
 * height chart, right after the hero. Static: a server component with no
 * script, no canvas and one CSS effect (Odin's halo bobs, except under
 * reduced motion). The cats are images on one scale (lineup.ts), the
 * wall, chart, plates and slip are HTML, and every word is real text.
 */
export function Suspects({ dict }: Props) {
  return (
    <section id="suspects" className={styles.suspects} aria-labelledby="suspects-title" tabIndex={-1} data-loops>
      {/* The wall and its height chart, read from the floor line. */}
      <div className={styles.wall} aria-hidden="true">
        {WIDE_MARKS.map((cm) => (
          <span key={cm} className={styles.mark} style={{ "--mark": cm } as CSSProperties}>
            <span>{cm}</span>
            <span>{cm}</span>
          </span>
        ))}
      </div>

      <header className={styles.slug}>
        <h2 id="suspects-title" className={styles.title}>
          {dict.title}
        </h2>
        <p className={styles.slugLine}>
          <span className={styles.place}>{dict.place}</span>{" "}
          <span className={styles.associates}>{dict.associates}</span>
        </p>
      </header>

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
              data-halo={placement.halo ? "" : undefined}
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
                {placement.halo ? <span className={styles.halo} /> : null}
              </div>
              <div className={styles.tag}>
                <p className={styles.plate}>
                  <span className={styles.number} aria-hidden="true">
                    {dict.numberPrefix} {plateNumber(index)}
                  </span>
                  <span className={styles.name}>{cat.name}</span>
                  <span className="sr-only">, </span>
                  <span className={styles.alias}>{cat.alias}</span>
                </p>
                <p className={styles.description}>{cat.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Part of the line-up, not a landmark of its own: its heading is enough to reach it. */}
      <div className={styles.slip}>
        <h3 className={styles.slipTitle}>
          <span>{dict.effects.title}</span>
          <span className="sr-only">, </span>
          <span className={styles.slipOwner}>{dict.effects.owner}</span>
        </h3>
        <ol className={styles.effects}>
          {dict.effects.items.map((item, index) => (
            <li key={item}>
              <span className={styles.effectNumber} aria-hidden="true">
                {plateNumber(index)}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className={styles.caption}>
        <span className={styles.captionText}>
          <span className={styles.speaker}>{dict.speaker}:</span> {dict.line}
        </span>
      </p>
    </section>
  );
}
