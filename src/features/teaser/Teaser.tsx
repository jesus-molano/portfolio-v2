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
    </section>
  );
}
