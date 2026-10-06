import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Hero.module.css";
import { HeroStage } from "./HeroStage";

type Props = { dict: Dictionary["hero"]; cues: Dictionary["common"]["cues"] };

/** Semantic wrapper for the cinematic hero. */
export function Hero({ dict, cues }: Props) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title" aria-describedby="hero-help">
      <HeroStage
        name={dict.name}
        role={dict.role}
        tagline={dict.tagline}
        intro={{ ...dict.intro, ...cues }}
        osd={dict.osd}
        pedal={dict.pedal}
        skip={cues.skip}
        skipLabel={dict.skipLabel}
        skipHurry={dict.skipHurry}
        sceneLabel={dict.sceneLabel}
        camera={dict.hud.camera}
        shots={dict.shots}
        speaker={dict.speaker}
        lines={dict.lines}
        billboards={dict.billboards}
      />
    </section>
  );
}
