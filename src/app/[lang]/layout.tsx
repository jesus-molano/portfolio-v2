import type { Metadata } from "next";
import {
  Bebas_Neue,
  Bowlby_One,
  JetBrains_Mono,
  Kanit,
  Limelight,
  Playfair_Display,
  Shrikhand,
  Space_Grotesk,
  Unbounded,
  Yellowtail,
} from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "../globals.css";
import styles from "./layout.module.css";
import { TokensStyle } from "@/design/TokensStyle";
import { SmoothScroll } from "@/features/hero/scroll/SmoothScroll";
import { RadioButton } from "@/features/music/RadioButton";
import { RadioWheel } from "@/features/music/RadioWheel";
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

/*
 * Radio station logos (radioFonts in the tokens). Not preloaded: the
 * browser fetches each face when the wheel first draws it, so the faces of
 * stations not on air yet are never fetched.
 */
const radioSeventiesFont = Shrikhand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-radio-seventies",
  display: "swap",
  preload: false,
});

const radioChromeFont = Kanit({
  weight: "900",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-radio-chrome",
  display: "swap",
  preload: false,
});

const radioTuxFont = Playfair_Display({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-radio-tux",
  display: "swap",
  preload: false,
});

const radioDeliFont = Yellowtail({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-radio-deli",
  display: "swap",
  preload: false,
});

const radioHiphopFont = Bowlby_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-radio-hiphop",
  display: "swap",
  preload: false,
});

const radioDecoFont = Limelight({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-radio-deco",
  display: "swap",
  preload: false,
});

/*
 * The finale's changeable marquee letters and ticket stubs. Not preloaded,
 * so it never competes with the hero's faces; the cinema's letters are in
 * the first HTML, so the browser still fetches it early in the first load
 * (about 9 KB). `block`: the letters are decoration (the headings carry
 * the words), and a fallback face of other widths would hang off the board.
 */
const marqueeFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marquee",
  display: "block",
  preload: false,
});

const fontVariables = [
  displayFont,
  bodyFont,
  monoFont,
  radioSeventiesFont,
  radioChromeFont,
  radioTuxFont,
  radioDeliFont,
  radioHiphopFont,
  radioDecoFont,
  marqueeFont,
]
  .map((font) => font.variable)
  .join(" ");

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
    <html lang={lang} className={fontVariables}>
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
        {/* Inside SmoothScroll so the radio wheel can hold the scroll while it is open. */}
        <SmoothScroll>
          <div className={styles.controls} data-page-controls>
            <RadioButton dict={dict.radio} />
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
          {/* Outside the page controls: they are inert while the wheel is open. */}
          <RadioWheel dict={dict.radio} />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
