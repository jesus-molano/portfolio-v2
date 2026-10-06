/**
 * The end credits' facts (pure data and helpers, tested): the cast, his
 * toolkit, what the site is built with, and every licence credit the site
 * owes (this is the one place on the site that carries them). The career
 * is not here: STATS and the career city tell it (src/features/career).
 * The words around them live in the dictionaries (`credits`); names and
 * URLs live here.
 */
import { stationCredits, type Credit } from "@/features/music/stations";

/**
 * "Convertible" by Poly by Google, CC BY 3.0: the licence asks for the
 * source, the licence and a note that it was modified (refine_convertible.py
 * paints the badges out and splits the materials).
 */
export const CAR_CREDIT = {
  title: "Convertible",
  author: "Poly by Google",
  sourceUrl: "https://poly.pizza/m/dggOiBLYyuR",
  licence: "CC BY 3.0",
  licenceUrl: "https://creativecommons.org/licenses/by/3.0/",
  modified: true,
} as const;

/** The cats' base mesh: Apache-2.0 asks for the licence and a note of changes (public/interlude/LICENSE.txt holds the text). */
export const CAT_BASE_CREDIT = {
  title: "Cat",
  author: "XR Blocks · Google",
  sourceUrl: "https://github.com/google/xrblocks",
  licence: "Apache-2.0",
  licenceUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  modified: true,
} as const;

/** CC0 assets: nothing is owed, they are credited anyway (dictionary key of the role, then the maker). */
export const CC0_ASSETS = [
  { role: "traffic", maker: "Quaternius", licence: "CC0" },
  { role: "body", maker: "MakeHuman · MPFB 2", licence: "CC0" },
] as const;

/**
 * The STATS map's relief and coast: public-domain elevation data, through
 * the Terrain Tiles on AWS Open Data (public/stats/LICENSE.txt). Nothing
 * is owed; it is credited anyway.
 */
export const RELIEF_CREDIT = {
  datasets: ["SRTM", "GMTED2010", "ETOPO1"],
  makers: ["NASA", "USGS", "NOAA"],
  sourceUrl: "https://registry.opendata.aws/terrain-tiles/",
} as const;

/**
 * The cast: him and his four cats, the ones who are really in it (the
 * owner's call). He plays himself; each cat plays its alias from the
 * character select (`credits.cast.roles`), in the line-up's order.
 */
export const CAST_CATS = [
  { id: "kira", name: "Kira" },
  { id: "tom", name: "Tom" },
  { id: "dante", name: "Dante" },
  { id: "odin", name: "Odin" },
] as const;

export const DIRECTOR = "Jesús Molano";
export const FILM_TITLE = "VICE AFTERGLOW";
export const COPYRIGHT = "© 2026 Jesús Molano";

/**
 * His toolkit: what he works with, the owner's list first in his order,
 * then the rest from the jobs and the side projects; the roll ends it on
 * "and the list goes on" (`credits.toolkitMore`), as he put it. No name
 * here is in BUILT_WITH: the libraries only this site uses are listed
 * there alone.
 */
export const TOOLKIT = [
  "Vue", "Nuxt", "TypeScript", "React", "Next.js", "Tailwind CSS", "Claude Code", "Codex", "Supabase", "Firebase",
  "AWS Amplify", "Docker", "Linux", "Zod", "React Hook Form", "Material UI", "Keycloak", "Veracode", "Strapi",
  "Storybook", "Atomic Design", "Python", "Scrum", "Git",
] as const;

/** What this site is made with, beyond his toolkit. */
export const BUILT_WITH = [
  "Three.js", "React Three Fiber", "drei", "postprocessing", "GSAP", "Lenis", "Blender",
] as const;

/**
 * Every typeface the site shows or bakes into its art, by use. All under
 * the SIL Open Font License except Yellowtail and Special Elite (Apache
 * License 2.0). Our own logos and posters set in them: no borrowed marks.
 */
export const TYPEFACES = {
  /**
   * Mr Dafoe and Big Shoulders Display: the chapter cards' words and their
   * banners' capitals (Big Shoulders is a poster face too; each face is
   * credited once).
   */
  site: ["Unbounded", "Space Grotesk", "JetBrains Mono", "Mr Dafoe", "Big Shoulders Display"],
  radio: ["Shrikhand", "Kanit", "Playfair Display", "Yellowtail", "Bowlby One", "Limelight", "Bebas Neue"],
  posters: ["Cinzel", "Oswald", "Anton", "Six Caps", "Special Elite"],
} as const;

/**
 * A list as the roll prints it, "React · Next.js · …". The space before each
 * dot does not break, so a wrapped line ends on a dot and the next never
 * starts with one.
 */
export function creditList(items: readonly string[]): string {
  return items.join("\u00a0· ");
}

export const OFL_URL = "https://openfontlicense.org/";

/**
 * How a track's author is named after its title, in the author's own
 * format where they ask for one: "Kevin MacLeod (incompetech.com)" for his
 * CC BY 4.0 tracks, otherwise "by <artist>" (`by` from the dictionary).
 */
export function trackByline(credit: Pick<Credit, "artist" | "artistSite">, by: string): string {
  return credit.artistSite ? `${credit.artist} (${credit.artistSite})` : `${by} ${credit.artist}`;
}

/** The music credits, by station on the wheel (stations.ts): every track on air, nothing else. */
export function musicCredits() {
  return stationCredits();
}
