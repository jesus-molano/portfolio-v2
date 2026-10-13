import type { NextConfig } from "next";

/**
 * How long the browser keeps the files in public/ the page loads. Served
 * with no policy, a host revalidates each one on every visit (Vercel's
 * default is `max-age=0, must-revalidate`), a round trip per file before
 * the scene can use it, seven models of them before the start menu's ways
 * in. None of their names carries a hash, and a week of
 * stale-while-revalidate served a replaced file to a returning visitor for
 * a whole visit, under code written for the new one: the cinema's cases
 * and its box office placed from the new plates.json over the old plate.
 *
 * - The models' addresses end in their content's hash (`?v=`,
 *   hero/scene/modelUrls.ts, held to the files by its test): a new model
 *   is a new address, so the browser keeps them a year without asking.
 * - The cinema's plates and posters, the line-up's renders and STATS's map
 *   have their layout in the page's code (finale/plates.json, the
 *   interlude's manifest.json, stats/statsLayout.ts): the browser asks
 *   again on every visit (a 304 when nothing changed, for pictures that
 *   load lazily far down the page), so a picture never meets another
 *   one's layout.
 * - The radio's tracks and LOAD GAME's pictures stand alone: a day fresh,
 *   so a replaced one reaches a returning visitor within a day.
 *
 * The share cards (`og/`) keep their own `?v=` (lib/shareCard.ts). In
 * development the browser asks for every file again (the server's own
 * `max-age=0`): a model or a plate rebuilt there shows on the next reload,
 * its `?v=` still to be updated.
 */
const ASSET_CACHE = {
  models: "public, max-age=31536000, immutable",
  finale: "public, no-cache",
  interlude: "public, no-cache",
  stats: "public, no-cache",
  music: "public, max-age=86400",
  load: "public, max-age=86400",
} as const;

const nextConfig: NextConfig = {
  async headers() {
    if (process.env.NODE_ENV === "development") return [];
    return Object.entries(ASSET_CACHE).map(([folder, value]) => ({
      source: `/${folder}/:path*`,
      headers: [{ key: "Cache-Control", value }],
    }));
  },
};

export default nextConfig;
