import { ChapterCard, chapterVars } from "@/components/ChapterCard/ChapterCard";
import type { Dictionary } from "@/i18n/dictionaries";
import { cq, PLATES, rectCq } from "./finaleLayout";
import { FEATURES } from "./links";
import { BulbStrips, marqueeSizes, rowsTiles, rowVars, type PlatePair, type Vars } from "./Marquee";
import { PlatePicture } from "./PlatePicture";
import { PosterCase } from "./PosterCase";
import { ProjectsMarquee } from "./ProjectsMarquee";
import styles from "./Projects.module.css";

const NIGHT: PlatePair = { wide: "night-wide", tall: "night-tall" };

/** Where the box office stands on both night plates, in cqw (Projects.module.css picks the layout's). */
function boothVars(): Vars {
  const vars: Vars = {};
  for (const [layout, name] of Object.entries(NIGHT) as ["wide" | "tall", keyof typeof PLATES][]) {
    const plate = PLATES[name];
    const box = rectCq(plate, plate.booth);
    const p = layout === "wide" ? "w" : "t";
    vars[`--${p}-x`] = box.x;
    vars[`--${p}-y`] = box.y;
    vars[`--${p}-w`] = box.w;
    vars[`--${p}-h`] = box.h;
  }
  return vars;
}

type Props = {
  dict: Dictionary["projects"];
  newTab: string;
  locale: string;
};

/**
 * The side projects: The Afterglow, a beach-deco picture palace at night,
 * the last stop of the drive. A pre-drawn plate with live DOM on it: the
 * changeable letters of the marquee, its chasing bulbs, and four poster
 * cases, one per repository, each a link to it on GitHub. The painted box
 * office is a link too, a plain one to the contact in the end credits.
 * Static: no canvas, no scroll-driven motion, only hover and focus
 * effects.
 *
 * Its chapter card, THE LATE SHOW (the pause clock says Sunday 23:47),
 * straddles the cut from STATS and stands in the night over the cinema,
 * clear of the AFTERGLOW sign.
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
    <section
      id="projects"
      className={styles.projects}
      style={chapterVars(dict.chapter, locale)}
      aria-labelledby="projects-title"
      data-loops
    >
      <ChapterCard id="projects-title" chapter={dict.chapter} lang={locale} className={styles.chapter} />
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
        {/* The box office sells the tickets: the contact's, at the end of the credits. */}
        <a className={styles.booth} href="#contact" style={boothVars()}>
          <span className="sr-only">{dict.boxOffice.sign}: </span>
          <span className={styles.boothChip}>
            {dict.boxOffice.contact}
            <span aria-hidden="true"> ↓</span>
          </span>
        </a>
      </div>
    </section>
  );
}
