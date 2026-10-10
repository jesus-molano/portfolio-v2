import { notFound } from "next/navigation";
import { LoadGame } from "@/features/load/LoadGame";
import { slotWords } from "@/features/load/slotWords";
import { Horizon } from "@/features/loader/Horizon";
import { LoadingScreen } from "@/features/loader/LoadingScreen";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { HomeMain } from "./HomeMain";

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      {/* Outside <main>: main is inert while the loading screen is up. */}
      <LoadingScreen
        dict={dict.loader}
        settings={dict.stats.settings}
        load={dict.load}
        words={slotWords(dict)}
        lang={lang}
        art={<Horizon />}
      />
      {/* Before <main>: focus in it never counts as having left the hero forward. */}
      <LoadGame dict={dict.load} words={slotWords(dict)} lang={lang} tips={dict.loader.tips} labels={dict.loader.labels} />
      <HomeMain dict={dict} lang={lang} />
    </>
  );
}
