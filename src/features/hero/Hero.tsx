import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Hero.module.css";
import { HeroStage } from "./HeroStage";

type Props = { dict: Dictionary["hero"]; cues: Dictionary["common"]["cues"] };

/**
 * Semantic wrapper for the cinematic hero. `data-loops`: its looping cues
 * (the hint's blink, the way-on glyph's bob) are paused while it is off
 * screen (PauseOffscreen), or they restyled the page every frame wherever
 * she was, down to the credits.
 */
export function Hero({ dict, cues }: Props) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title" aria-describedby="hero-help" data-loops>
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
