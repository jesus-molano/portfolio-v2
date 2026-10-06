import { notFound } from "next/navigation";
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
      <LoadingScreen dict={dict.loader} settings={dict.stats.settings} lang={lang} art={<Horizon />} />
      <HomeMain dict={dict} lang={lang} />
    </>
  );
}
