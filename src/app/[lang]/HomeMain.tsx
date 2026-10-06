import { ChapterMotion } from "@/components/ChapterCard/ChapterMotion";
import { PageEntry } from "@/components/PageEntry";
import { PauseOffscreen } from "@/components/PauseOffscreen";
import { EndCredits } from "@/features/finale/EndCredits";
import { Projects } from "@/features/finale/Projects";
import { Hero } from "@/features/hero/Hero";
import { Stats } from "@/features/stats/Stats";
import { Suspects } from "@/features/suspects/Suspects";
import { Work } from "@/features/work/Work";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * The home page's sections, in the order the film runs. Kept out of
 * page.tsx (a page file may only export the page) so that anchors.test.ts
 * renders exactly what the page renders and checks every in-page link.
 */
export function HomeMain({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  return (
    <main id="main">
      <Hero dict={dict.hero} cues={dict.common.cues} />
      <Suspects dict={dict.suspects} lang={lang} />
      <Work work={dict.work} common={dict.common} pedal={dict.hero.pedal} osd={dict.hero.osd} locale={lang} />
      <Stats dict={dict.stats} lang={lang} />
      <Projects dict={dict.projects} newTab={dict.common.newTab} locale={lang} />
      <EndCredits dict={dict.credits} newTab={dict.common.newTab} locale={lang} />
      {/* Plays each chapter card's entrance as it comes up (cards below the fold only). */}
      <ChapterMotion />
      {/* Stops the looping animations of the sections marked data-loops while they are off screen. */}
      <PauseOffscreen />
      {/* Where the page starts once she is in: a deep link's section, or the top for the keyboard. */}
      <PageEntry />
    </main>
  );
}
