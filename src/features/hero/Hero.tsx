import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Hero.module.css";
import { HeroStage } from "./HeroStage";

type Props = { dict: Dictionary["hero"] };

/** Semantic wrapper for the cinematic hero. */
export function Hero({ dict }: Props) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <HeroStage
        name={dict.name}
        role={dict.role}
        tagline={dict.tagline}
        scrollHint={dict.scrollHint}
        sceneLabel={dict.sceneLabel}
      />
    </section>
  );
}
