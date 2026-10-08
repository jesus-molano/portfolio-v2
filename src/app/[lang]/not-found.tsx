import type { Metadata } from "next";
import { lang } from "next/root-params";
import { Horizon } from "@/features/loader/Horizon";
import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import styles from "./not-found.module.css";
import { placeHref, WRONG_EXIT_PLACES } from "./wrongExit";

/** The locale from the root `[lang]` segment, or the default for an unknown one. */
async function currentLocale(): Promise<Locale> {
  const current = await lang();
  return hasLocale(current) ? current : defaultLocale;
}

/** Its own title, so a tab or a bookmark never reads as the home page. */
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.notFound.title };
}

/**
 * The localized 404, a screen of the game like the start menu: the same
 * causeway at sunset (the start menu's picture, its lamps and windows lit),
 * a motorway exit sign that says where she is, and a menu in the start
 * menu's look back to the city or straight to a section.
 */
export default async function NotFound() {
  const locale = await currentLocale();
  const dict = await getDictionary(locale);
  const copy = dict.notFound;

  return (
    <main id="main" className={styles.page} data-wrong-exit="">
      <div className={styles.art} aria-hidden="true">
        <Horizon />
        <div className={styles.scrim} />
        <div className={styles.vignette} />
      </div>

      <div className={styles.content}>
        <div className={styles.sign}>
          <p className={styles.exit}>{copy.exit}</p>
          <h1 className={styles.heading}>{copy.heading}</h1>
          <p className={styles.line}>{copy.line}</p>
          <svg className={styles.arrow} viewBox="0 0 48 64" aria-hidden="true">
            <path d="M15 62V31c0-10 6-16 16-16h2" fill="none" stroke="currentColor" strokeWidth="7" />
            <path d="M30 3l16 12-16 12z" fill="currentColor" />
          </svg>
        </div>

        <nav className={styles.menu} aria-label={copy.routesLabel}>
          <p className={styles.kicker}>{copy.rerouting}</p>
          <a className={`${styles.item} ${styles.primary}`} href={`/${locale}`}>
            <span className={styles.word}>{copy.back}</span>
          </a>
          <p className={styles.routes}>{copy.routes}</p>
          <ul className={styles.places}>
            {WRONG_EXIT_PLACES.map((place) => (
              <li key={place}>
                <a className={styles.item} href={placeHref(locale, place)}>
                  <span className={styles.word}>{copy.places[place]}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
