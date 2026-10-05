import { PageEntry } from "@/components/PageEntry";
import { PauseOffscreen } from "@/components/PauseOffscreen";
import { EndCredits } from "@/features/finale/EndCredits";
import { Projects } from "@/features/finale/Projects";
import { Hero } from "@/features/hero/Hero";
import { Stats } from "@/features/stats/Stats";
import { Suspects } from "@/features/suspects/Suspects";
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
      <Hero dict={dict.hero} />
      <Suspects dict={dict.suspects} />
      {/*
       * The career city (#work-army ... #work-heuristik) goes here when it
       * lands; then turn on CAREER_CITY_ON_PAGE (stats/statsLayout.ts) so
       * the STATS missions link to it.
       */}
      <Stats dict={dict.stats} />
      <Projects dict={dict.projects} newTab={dict.common.newTab} locale={lang} />
      <EndCredits dict={dict.credits} newTab={dict.common.newTab} locale={lang} />
      {/* Stops the looping animations of the sections marked data-loops while they are off screen. */}
      <PauseOffscreen />
      {/* Where the page starts once she is in: a deep link's section, or the top for the keyboard. */}
      <PageEntry />
    </main>
  );
}
