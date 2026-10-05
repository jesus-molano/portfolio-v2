/**
 * Every external address the finale links to. Never an email address: the
 * owner is reached through GitHub and LinkedIn only (links.test.ts).
 */

export const GITHUB_PROFILE = "https://github.com/jesus-molano";
export const LINKEDIN_PROFILE = "https://www.linkedin.com/in/jesus-molano-perdomo";

/** The profiles as the contact tickets print them. */
export const PROFILE_LABELS = {
  github: "github.com/jesus-molano",
  linkedin: "in/jesus-molano-perdomo",
} as const;

/** Dictionary key of a feature on the bill (`projects.posters.<id>`). */
export type FeatureId = "dotfiles" | "tessera-studio" | "project-atlas" | "expenses-log-app";

export type Feature = {
  id: FeatureId;
  /** The repository's name on GitHub, as written there. */
  repo: string;
  /** The page anchor of its poster case (language-neutral, the same in /en and /es). */
  anchor: string;
  href: string;
};

const feature = (id: FeatureId, repo: string, anchor: string): Feature => ({
  id,
  repo,
  anchor,
  href: `${GITHUB_PROFILE}/${repo}`,
});

/**
 * The side projects on The Afterglow's bill, left to right, as their cases
 * hang on the plate (tools/art/finale/cinema.mjs, BILL). `atlas-habits` is
 * left out on purpose: project-atlas is a different repository.
 */
export const FEATURES: readonly Feature[] = [
  feature("dotfiles", "dotfiles", "project-dotfiles"),
  feature("tessera-studio", "tessera-studio", "project-tessera-studio"),
  feature("project-atlas", "project-atlas", "project-atlas"),
  feature("expenses-log-app", "Expenses-Log-App", "project-expenses-log-app"),
];

/**
 * The posters' encoded widths (tools/art/finale/build.mjs): the full one,
 * sharp on a 2x phone, and half of it for a case on the facade, about 108
 * css px wide on a 1440 px screen.
 */
export const POSTER_WIDTHS = { small: 216, full: 432 } as const;

/**
 * How wide a poster shows, for the srcset: in its case on the facade, 7.6 %
 * of the plate; on portrait screens in the list beside its caption, about
 * a third of a phone, and at most 13rem from 600 px up (Projects.module.css).
 */
export const POSTER_SIZES = "(max-aspect-ratio: 5/6) and (min-width: 600px) 13rem, (max-aspect-ratio: 5/6) 32vw, (max-width: 640px) 32vw, 7.6vw";

/** The poster image of a feature (public/finale, built by tools/art/finale/build.mjs), full size or small. */
export function posterSrc(feature: Feature, locale: string, format: "avif" | "webp", hot = false, small = false): string {
  return `/finale/poster-${feature.repo.toLowerCase()}-${locale}${hot ? "-hot" : ""}${small ? `-${POSTER_WIDTHS.small}` : ""}.${format}`;
}

/** Both sizes of a poster as a srcset. */
export function posterSrcSet(feature: Feature, locale: string, format: "avif" | "webp", hot = false): string {
  return [
    `${posterSrc(feature, locale, format, hot, true)} ${POSTER_WIDTHS.small}w`,
    `${posterSrc(feature, locale, format, hot)} ${POSTER_WIDTHS.full}w`,
  ].join(", ");
}
