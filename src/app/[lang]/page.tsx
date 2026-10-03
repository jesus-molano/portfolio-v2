import { notFound } from "next/navigation";
import { Hero } from "@/features/hero/Hero";
import { Teaser } from "@/features/teaser/Teaser";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main id="main">
      <Hero dict={dict.hero} />
      <Teaser dict={dict.teaser} />
    </main>
  );
}
