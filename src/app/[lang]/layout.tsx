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
  Special_Elite,
  Unbounded,
  Yellowtail,
} from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "../globals.css";
import { TokensStyle } from "@/design/TokensStyle";
import { PageControls } from "@/components/PageControls";
import { SmoothScroll } from "@/features/hero/scroll/SmoothScroll";
import { LoadButton } from "@/features/load/LoadButton";
import { RadioButton } from "@/features/music/RadioButton";
import { RadioWheel } from "@/features/music/RadioWheel";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import { defaultLocale, hasLocale, localeNames, locales, openGraphLocales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SHARE_CARD, shareCardUrl } from "@/lib/shareCard";
import { SITE_ICONS } from "@/lib/siteIcons";
import { siteUrl } from "@/lib/siteUrl";

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
 * Radio station logos (radioFonts in the tokens; ONE LOUDER and WITNESS ME
 * borrow the chapter cards' capitals). Not preloaded: the browser fetches
 * each face when the wheel first draws it. Bowlby One also letters a board
 * in the night city.
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

const radioHiphopFont = Bowlby_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-radio-hiphop",
  display: "swap",
  preload: false,
});

/*
 * Sign-painter's faces (signFonts in the tokens): the night city's boards
 * paint with them, and the credits' THE END is set in the deco one. Not
 * preloaded: each is fetched when a board or the end of the roll needs it.
 */
const signSerifFont = Playfair_Display({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-sign-serif",
  display: "swap",
  preload: false,
});

const signScriptFont = Yellowtail({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sign-script",
  display: "swap",
  preload: false,
});

const signDecoFont = Limelight({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sign-deco",
  display: "swap",
  preload: false,
});

/*
 * The marquee face: the start menu's huge items (NEW GAME, CONTINUE,
 * SETTINGS), the finale's changeable marquee letters and ticket stubs.
 * Preloaded: the start menu is the first thing on screen, and its words
 * are drawn in it (about 9 KB). `block`: a fallback face of other widths
 * would paint the menu (and hang off the cinema's board) in the wrong
 * shape; the menu's slab is measured once the faces are in.
 */
const marqueeFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marquee",
  display: "block",
  preload: true,
});

/*
 * The army's service record in the career city (typewriter in the tokens):
 * Special Elite, a worn typewriter face. Not preloaded: the record is a
 * popover, so the browser fetches it the first time the record opens.
 */
const typewriterFont = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-typewriter",
  display: "swap",
  preload: false,
});

/*
 * The chapter cards (src/components/ChapterCard), each a checked-in subset
 * beside its OFL licence in src/app/fonts: the word in Chapter Script (Mr
 * Dafoe, subset and renamed by tools/chapter/fonts.py, which also reads
 * the metrics the cards are laid out with) and the banner's capitals in
 * Big Shoulders Display Black (next/font/google only serves the merged
 * variable family, heavier, with other widths than capsFace.ts measured).
 * About 14 KB each. Not preloaded, like the marquee's face: the cards are
 * below the fold, so they never compete with the hero's faces, and a page
 * without a card (a 404) never fetches them. The cards are in the first
 * HTML, so the home page still fetches both early, and ChapterMotion holds
 * a card clear until they are in. `block`: a card's drawing is laid out on
 * the server for these exact faces and its box never changes, but a
 * fallback face must never paint in it.
 */
const chapterScriptFont = localFont({
  src: [{ path: "../fonts/ChapterScript-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-chapter-script",
  display: "block",
  preload: false,
  adjustFontFallback: false,
});

const chapterCapsFont = localFont({
  src: [{ path: "../fonts/BigShouldersDisplay-Black.latin.woff2", weight: "900", style: "normal" }],
  variable: "--font-chapter-caps",
  display: "block",
  preload: false,
  adjustFontFallback: false,
});

const fontVariables = [
  displayFont,
  bodyFont,
  monoFont,
  radioSeventiesFont,
  radioChromeFont,
  radioHiphopFont,
  signSerifFont,
  signScriptFont,
  signDecoFont,
  marqueeFont,
  chapterScriptFont,
  chapterCapsFont,
  typewriterFont,
]
  .map((font) => font.variable)
  .join(" ");

/**
 * Without JS the title reveal never runs, so its hidden start state is
 * undone, and the loading screen (which only JS can dismiss) is hidden.
 */
const NO_JS_STYLE = "[data-letter],[data-line]{opacity:1}[data-loader]{display:none}";

type Params = Promise<{ lang: string }>;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return { icons: SITE_ICONS };
  const dict = await getDictionary(lang);
  // The link preview card: a game cover of the site's own frames (tools/art/og/keyart).
  const card = { url: shareCardUrl(lang), alt: dict.meta.imageAlt };
  return {
    metadataBase: new URL(siteUrl()),
    title: dict.meta.title,
    description: dict.meta.description,
    icons: SITE_ICONS,
    alternates: {
      canonical: `/${lang}`,
      languages: {
        ...Object.fromEntries(locales.map((locale) => [locale, `/${locale}`])),
        "x-default": `/${defaultLocale}`,
      },
    },
    openGraph: {
      type: "website",
      url: `/${lang}`,
      siteName: dict.hero.name,
      title: dict.meta.title,
      description: dict.meta.description,
      locale: openGraphLocales[lang],
      alternateLocale: locales.filter((locale) => locale !== lang).map((locale) => openGraphLocales[locale]),
      images: [{ ...card, width: SHARE_CARD.width, height: SHARE_CARD.height, type: SHARE_CARD.type }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: [card],
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
          <PageControls>
            <LoadButton dict={dict.load} lang={lang} />
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
          </PageControls>
          {/* Outside the page controls: they are inert while the wheel is open. */}
          <RadioWheel dict={dict.radio} />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
