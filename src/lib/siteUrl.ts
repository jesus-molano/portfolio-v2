/**
 * Where the site lives, for every absolute URL it prints: the canonical
 * link and the hreflang alternates, the link preview cards, robots.txt and
 * the sitemap. In order: `NEXT_PUBLIC_SITE_URL` (set it on a custom
 * domain), else `https://` + `VERCEL_PROJECT_PRODUCTION_URL` (Vercel sets
 * it on every deployment, previews included, to the production domain),
 * else the dev server. No trailing slash.
 */
export const LOCAL_SITE_URL = "http://localhost:3000";

/** The environment it reads: `NEXT_PUBLIC_SITE_URL` and `VERCEL_PROJECT_PRODUCTION_URL`. */
type SiteEnv = Readonly<Record<string, string | undefined>>;

export function siteUrl(env: SiteEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (vercel) return `https://${vercel}`;
  return LOCAL_SITE_URL;
}

/** An absolute URL for a path on the site: `absoluteUrl("/en", base)` → "https://…/en". */
export function absoluteUrl(path: string, base: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
