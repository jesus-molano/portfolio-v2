import { ButtonLink } from "@/components/ui/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Teaser.module.css";
import { TeaserReveal } from "./TeaserReveal";

type Props = { dict: Dictionary["teaser"] };

/** Placeholder for the next phase: gives the hero scroll a landing point. */
export function Teaser({ dict }: Props) {
  return (
    <TeaserReveal className={styles.teaser} labelledBy="teaser-title">
      <p className={styles.eyebrow} data-reveal>
        {dict.eyebrow}
      </p>
      <h2 id="teaser-title" className={styles.heading} data-reveal>
        {dict.heading}
      </h2>
      <p className={styles.body} data-reveal>
        {dict.body}
      </p>
      <p className={styles.cta} data-reveal>
        <ButtonLink
          href="https://github.com/jesus-molano"
          variant="primary"
          size="md"
          external
          rel="me noopener noreferrer"
        >
          {dict.github}
          <span className="sr-only"> {dict.newTab}</span>
        </ButtonLink>
      </p>
      {/* CC BY 3.0 asks for the source, the licence and a note of changes. */}
      <p className={styles.credits} data-reveal>
        {dict.credits.label}{" "}
        <a href="https://poly.pizza/m/dggOiBLYyuR">{dict.credits.car}</a>,{" "}
        <a href="https://creativecommons.org/licenses/by/3.0/" rel="license">
          {dict.credits.license}
        </a>
        , {dict.credits.modified} · {dict.credits.others}
      </p>
    </TeaserReveal>
  );
}
