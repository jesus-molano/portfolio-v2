import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Teaser.module.css";

type Props = { dict: Dictionary["teaser"] };

/** Placeholder for the next phase: gives the hero scroll a landing point. */
export function Teaser({ dict }: Props) {
  return (
    <section className={styles.teaser} aria-labelledby="teaser-title">
      <p className={styles.eyebrow}>{dict.eyebrow}</p>
      <h2 id="teaser-title" className={styles.heading}>
        {dict.heading}
      </h2>
      <p className={styles.body}>{dict.body}</p>
      <a
        className={styles.link}
        href="https://github.com/jesus-molano"
        rel="me noopener noreferrer"
        target="_blank"
      >
        {dict.github}
        <span className="sr-only"> {dict.newTab}</span>
      </a>
      {/* CC BY 3.0 asks for the source, the licence and a note of changes. */}
      <p className={styles.credits}>
        {dict.credits.label}{" "}
        <a href="https://poly.pizza/m/dggOiBLYyuR">{dict.credits.car}</a>,{" "}
        <a href="https://creativecommons.org/licenses/by/3.0/" rel="license">
          {dict.credits.license}
        </a>
        , {dict.credits.modified} · {dict.credits.others}
      </p>
    </section>
  );
}
