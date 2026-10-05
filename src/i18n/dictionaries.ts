import type { LoaderTip } from "@/features/loader/tips";
import type { Locale } from "./config";
import type en from "./dictionaries/en.json";

type Json = typeof en;

/**
 * The dictionaries' shape, from the English file. JSON types its strings
 * as `string`, so the loader's tips get their real type here; the
 * dictionary tests check every kind and condition at run time.
 */
export type Dictionary = Omit<Json, "loader"> & {
  loader: Omit<Json["loader"], "tips"> & { tips: LoaderTip[] };
};

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default as Dictionary),
  es: () => import("./dictionaries/es.json").then((m) => m.default as Dictionary),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
