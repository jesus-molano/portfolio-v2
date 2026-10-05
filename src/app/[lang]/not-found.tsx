import type { Metadata } from "next";
import { lang } from "next/root-params";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import styles from "./not-found.module.css";

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

/** Localized 404: reads the locale from the root `[lang]` segment. */
export default async function NotFound() {
  const locale = await currentLocale();
  const dict = await getDictionary(locale);

  return (
    <main id="main" className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.heading}>{dict.notFound.heading}</h1>
      <p>
        <ButtonLink href={`/${locale}`} size="md">
          {dict.notFound.back}
        </ButtonLink>
      </p>
    </main>
  );
}
