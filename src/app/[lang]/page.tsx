import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { MODEL_PRELOADS } from "@/features/hero/scene/modelUrls";
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
  // The hero's models, named in the head so they download beside the page's own code: left to the
  // scene's chunk, they started only once every script had run, hydration had reached the canvas
  // and the chunk itself had come in. Asked for as three.js asks (cors, same-origin credentials), so
  // its own fetch takes the preloaded response. At low priority, behind the page's own scripts:
  // ahead of them, the driver's megabyte held up hydration and the start menu's keys on a slow link
  // (modelUrls.ts). Here, never in the layout: the 404 has no scene.
  for (const url of MODEL_PRELOADS) preload(url, { as: "fetch", crossOrigin: "anonymous", fetchPriority: "low" });
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
