/**
 * The end credits' facts (pure data and helpers, tested): the career as a
 * plain CV, the cast, the equipment, and every licence credit the site owes
 * (this is the one place on the site that carries them). The words around
 * them live in the dictionaries (`credits`); names, years, places and URLs
 * live here.
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

/** CC0 assets: nothing is owed, they are credited anyway (dictionary key of the role, then the maker). */
export const CC0_ASSETS = [
  { role: "traffic", maker: "Quaternius", licence: "CC0" },
  { role: "body", maker: "MakeHuman · MPFB 2", licence: "CC0" },
] as const;

export type CareerId = "heuristik" | "logixs" | "cloud-district" | "pwc" | "army";

export type CareerEntry = {
  id: CareerId;
  /** As the company writes itself; the army's name is translated (dictionary `credits.career.army`). */
  company: string | null;
  /** Only where he was posted, in the army: the credits name no city for a civilian job. */
  place: string | null;
  from: number;
  /** `"live"`: the job on air now (Heuristik), tagged LIVE like a broadcast in every language. */
  to: number | "live";
};

/** Newest first, like a CV. */
export const CAREER: readonly CareerEntry[] = [
  { id: "heuristik", company: "Heuristik", place: null, from: 2026, to: "live" },
  { id: "logixs", company: "Logixs", place: null, from: 2025, to: 2026 },
  { id: "cloud-district", company: "Cloud District", place: null, from: 2024, to: 2025 },
  { id: "pwc", company: "PwC España", place: null, from: 2023, to: 2024 },
  { id: "army", company: null, place: "Las Palmas de Gran Canaria", from: 2018, to: 2021 },
];

/** Heuristik's tag: always this word, in English, in every locale (the on-air tally). */
export const LIVE = "LIVE";

/** "2025 – 2026", or "2026 – LIVE" for the job on air; the dash is an en dash, as in credits. */
export function yearsLabel(entry: Pick<CareerEntry, "from" | "to">): { from: string; to: string; live: boolean } {
  const live = entry.to === "live";
  return { from: String(entry.from), to: live ? LIVE : String(entry.to), live };
}

/** The usual suspects, by name (Odin is not named in the credits: the owner's call). */
export const CAST_CATS = ["Kira", "Tom", "Dante"] as const;

export const DIRECTOR = "Jesús Molano";
export const FILM_TITLE = "VICE AFTERGLOW";
export const COPYRIGHT = "© 2026 Jesús Molano · Vice Afterglow";

/** What he works with, from the jobs and the side projects (Vue and Nuxt left out until he confirms them). */
export const EQUIPMENT = [
  "React", "Next.js", "TypeScript", "Tailwind CSS", "Zod", "React Hook Form", "Material UI", "Keycloak",
  "Veracode", "Docker", "Strapi", "Storybook", "Atomic Design", "Supabase", "Python", "Three.js",
  "React Three Fiber", "GSAP", "Scrum", "Git",
] as const;

/** What this site is made with. */
export const BUILT_WITH = [
  "Next.js", "React", "Three.js", "React Three Fiber", "drei", "postprocessing", "GSAP", "Lenis", "Blender",
] as const;

/**
 * Every typeface the site shows or bakes into its art, by use. All under
 * the SIL Open Font License except Yellowtail and Special Elite (Apache
 * License 2.0). Our own logos and posters set in them: no borrowed marks.
 */
export const TYPEFACES = {
  site: ["Unbounded", "Space Grotesk", "JetBrains Mono"],
  radio: ["Shrikhand", "Kanit", "Playfair Display", "Yellowtail", "Bowlby One", "Limelight", "Bebas Neue"],
  posters: ["Big Shoulders Display", "Cinzel", "Oswald", "Anton", "Six Caps", "Special Elite"],
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
