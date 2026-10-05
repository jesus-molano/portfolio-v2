import type { Dictionary } from "@/i18n/dictionaries";
import { cq, PLATES } from "./finaleLayout";
import { FEATURES } from "./links";
import { BulbStrips, marqueeSizes, rowsTiles, rowVars, type PlatePair, type Vars } from "./Marquee";
import { PlatePicture } from "./PlatePicture";
import { PosterCase } from "./PosterCase";
import { ProjectsMarquee } from "./ProjectsMarquee";
import styles from "./Projects.module.css";

const NIGHT: PlatePair = { wide: "night-wide", tall: "night-tall" };

type Props = {
  dict: Dictionary["projects"];
  newTab: string;
  locale: string;
};

/**
 * The side projects: The Afterglow, a beach-deco picture palace at night,
 * the last stop of the drive. A pre-drawn plate with live DOM on it: the
 * changeable letters of the marquee, its chasing bulbs, and four poster
 * cases, one per repository, each a link to it on GitHub. Static: no
 * canvas, no scroll-driven motion, only hover and focus effects.
 */
export function Projects({ dict, newTab, locale }: Props) {
  const titles = FEATURES.map((feature) => dict.posters[feature.id].title);
  const showingText = (title: string) => `${dict.marquee.showing} ${title}`;
  const [top, bottom] = dict.marquee.rows;
  // One letter kit for both rows, big enough for the longest text either row can show.
  const sizes = marqueeSizes(NIGHT, [[top], [bottom, ...titles.map(showingText)]], true);
  const [idleTop, idleBottom] = rowsTiles([top, bottom]);
  const showing = Object.fromEntries(
    FEATURES.map((feature, i) => [feature.id, rowsTiles([showingText(titles[i])], 1)[0]]),
  );
  const wide = PLATES["night-wide"];
  // The speaker card stands on the terrazzo, under the entrance.
  const lineStyle: Vars = { "--line-y": cq(wide, 676) };

  return (
    <section id="projects" className={styles.projects} aria-labelledby="projects-title" data-loops>
      <h2 id="projects-title" className="sr-only">
        {dict.title}
      </h2>
      <div className={styles.cinema}>
        <PlatePicture mood="night" locale={locale} className={styles.plate} />
        <ProjectsMarquee
          idle={[idleTop, idleBottom]}
          showing={showing}
          rowStyles={[rowVars(NIGHT, 0, sizes), rowVars(NIGHT, 1, sizes)]}
        />
        <div className={styles.strips} aria-hidden="true">
          <BulbStrips plates={NIGHT} />
        </div>
        <p className={styles.line} style={lineStyle}>
          <span className={styles.speaker}>{dict.speaker}:</span> {dict.line}
        </p>
        <ol className={styles.bill}>
          {FEATURES.map((feature, index) => (
            <PosterCase
              key={feature.id}
              feature={feature}
              index={index}
              copy={dict.posters[feature.id]}
              github={dict.github}
              onGithub={dict.onGithub}
              newTab={newTab}
              locale={locale}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
