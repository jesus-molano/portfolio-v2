import type { Locale } from "@/i18n/config";

/**
 * The career, written down once (pure data, tested): the five jobs, oldest
 * first, with the facts every section that names them reads from here:
 * the employer as it writes itself, the years, the stop in the career city
 * (`#work-…`) and the role. STATS lists them as its main missions
 * (`statsLayout.ts` MISSIONS); the career city will tell them in full; the
 * end credits leave them out.
 *
 * Facts the owner fixed (career.test.ts): no city for a civilian job, Las
 * Palmas de Gran Canaria for the army only, never Madrid; the roles in
 * English in both languages, the army's in each language; the job on air
 * (Heuristik) tagged LIVE, in English everywhere.
 *
 * Dependency-free on purpose: statsLayout.ts imports it, and
 * tools/art/stats/map.mjs imports that file with Node's type stripping
 * (a type-only import is erased there).
 */

export type JobId = "army" | "pwc" | "cloud-district" | "logixs" | "heuristik";

export type Job = {
  id: JobId;
  /** Its place in the career, oldest first: the mission number in STATS, the stop in the city. */
  number: 1 | 2 | 3 | 4 | 5;
  /** Its stop in the career city. */
  anchor: `work-${JobId}`;
  /** The employer as it writes itself, in each language; for the army, his unit. */
  name: Readonly<Record<Locale, string>>;
  /** The job title: in English in both languages, except the army's. */
  role: Readonly<Record<Locale, string>>;
  /** First and last year; `null` as the last year is the job on air. */
  years: readonly [number, number | null];
  /** Where he was posted, for the army only: no civilian job names a city. */
  place: string | null;
};

/** A name or a title written the same in every language. */
const everywhere = (text: string): Record<Locale, string> => ({ en: text, es: text });

/** The army, beyond the line in CAREER: the service as each language names it, and his rank spelt out on the city's service record. */
export const ARMY = {
  service: { en: "Spanish Army", es: "Ejército de Tierra" },
  record: { en: "Combat engineer", es: "Soldado zapador" },
} as const satisfies Record<string, Record<Locale, string>>;

/** Oldest first, like the drive through the city. */
export const CAREER: readonly Job[] = [
  {
    id: "army",
    number: 1,
    anchor: "work-army",
    // A unit's own name is never translated.
    name: everywhere("Batallón de Zapadores XVI"),
    role: { en: "Combat engineer", es: "Zapador" },
    years: [2018, 2021],
    place: "Las Palmas de Gran Canaria",
  },
  {
    id: "pwc",
    number: 2,
    anchor: "work-pwc",
    name: everywhere("PwC España"),
    role: everywhere("Frontend Developer"),
    years: [2023, 2024],
    place: null,
  },
  {
    id: "cloud-district",
    number: 3,
    anchor: "work-cloud-district",
    name: everywhere("Cloud District"),
    role: everywhere("Frontend Developer"),
    years: [2024, 2025],
    place: null,
  },
  {
    id: "logixs",
    number: 4,
    anchor: "work-logixs",
    name: everywhere("Logixs"),
    role: everywhere("Full Stack Developer"),
    years: [2025, 2026],
    place: null,
  },
  {
    id: "heuristik",
    number: 5,
    anchor: "work-heuristik",
    name: everywhere("Heuristik"),
    role: everywhere("Frontend Engineer"),
    years: [2026, null],
    place: null,
  },
];

/** The job on air: no last year yet. */
export function isLive(job: Pick<Job, "years">): boolean {
  return job.years[1] === null;
}

/** The on-air tag of the job on air (Heuristik): always this word, in English, in every language. */
export const LIVE = "LIVE";
