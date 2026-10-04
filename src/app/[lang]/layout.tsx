import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk, Unbounded } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "../globals.css";
import styles from "./layout.module.css";
import { TokensStyle } from "@/design/TokensStyle";
import { SmoothScroll } from "@/features/hero/scroll/SmoothScroll";
import { MusicToggle } from "@/features/music/MusicToggle";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import { defaultLocale, hasLocale, localeNames, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const displayFont = Unbounded({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Without JS the title reveal never runs, so its hidden start state is
 * undone, and the loading screen (which only JS can dismiss) is hidden.
 */
const NO_JS_STYLE = "[data-letter],[data-line]{opacity:1}[data-loader]{display:none}";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Params = Promise<{ lang: string }>;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    metadataBase: new URL(siteUrl),
    title: dict.meta.title,
    description: dict.meta.description,
    icons: { icon: "/favicon.svg" },
    alternates: {
      canonical: `/${lang}`,
      languages: {
        ...Object.fromEntries(locales.map((locale) => [locale, `/${locale}`])),
        "x-default": `/${defaultLocale}`,
      },
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <head>
        <TokensStyle />
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: NO_JS_STYLE }} />
        </noscript>
      </head>
      <body>
        <a className="skip-link" href="#main">
          {dict.nav.skipToContent}
        </a>
        <div className={styles.controls} data-page-controls>
          <MusicToggle label={dict.nav.music} />
          <SegmentedNav
            label={dict.nav.languageLabel}
            segments={locales.map((locale) => ({
              key: locale,
              label: locale,
              name: localeNames[locale],
              href: `/${locale}`,
              current: locale === lang,
              lang: locale,
            }))}
          />
        </div>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
