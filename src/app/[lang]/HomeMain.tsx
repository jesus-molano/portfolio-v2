import { ChapterMotion } from "@/components/ChapterCard/ChapterMotion";
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
      <Suspects dict={dict.suspects} lang={lang} />
      {/*
       * The career city (#work-army ... #work-heuristik) goes here when it
       * lands; then turn on CAREER_CITY_ON_PAGE (stats/statsLayout.ts) so
       * the STATS missions link to it. It opens on its own chapter card
       * (ChapterCard, its copy in a `chapter` key of its dictionary): the
       * owner's call is TURNO DE NOCHE / NIGHT SHIFT, ribbon "El trabajo ·
       * 2018 — LIVE" (the banner's capitals table, capsFace.ts, then needs
       * the digits, the middle dot and the dash). Re-read the whole chain
       * then: LA BANDA, TURNO DE NOCHE, JUGADOR UNO, SESIÓN GOLFA, ¡Y CORTEN!
       */}
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
