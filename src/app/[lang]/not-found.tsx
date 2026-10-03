import Link from "next/link";
import { lang } from "next/root-params";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import styles from "./not-found.module.css";

/** Localized 404: reads the locale from the root `[lang]` segment. */
export default async function NotFound() {
  const current = await lang();
  const locale = hasLocale(current) ? current : defaultLocale;
  const dict = await getDictionary(locale);

  return (
    <main id="main" className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.heading}>{dict.notFound.heading}</h1>
      <p>
        <Link href={`/${locale}`} className={styles.link}>
          {dict.notFound.back}
        </Link>
      </p>
    </main>
  );
}
