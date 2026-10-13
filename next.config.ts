import type { NextConfig } from "next";

/**
 * The files in public/ the page loads: the models, the radio's tracks, the
 * line-up's renders, the cinema's plates and posters, LOAD GAME's pictures
 * and STATS's map and portrait. Served with no policy, a host revalidates
 * each one on every visit (Vercel's default is `max-age=0,
 * must-revalidate`), a round trip per file before the scene can use it,
 * seven models of them before the start menu's ways in. Their names carry
 * no hash, so a day fresh and a week served stale while the browser checks
 * behind it: a file replaced in a deploy reaches a returning visitor within
 * a day. The share cards (`og/`) keep their own `?v=` (lib/shareCard.ts).
 */
const ASSET_CACHE = "public, max-age=86400, stale-while-revalidate=604800";
const ASSET_FOLDERS = ["models", "music", "interlude", "finale", "load", "stats"] as const;

const nextConfig: NextConfig = {
  async headers() {
    return ASSET_FOLDERS.map((folder) => ({
      source: `/${folder}/:path*`,
      headers: [{ key: "Cache-Control", value: ASSET_CACHE }],
    }));
  },
};

export default nextConfig;
