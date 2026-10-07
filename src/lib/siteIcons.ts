import type { Metadata, MetadataRoute } from "next";

/**
 * The site's icons, drawn and rendered by `tools/art/favicon/build.mjs`
 * into `public/`: an enamel badge, a deep-violet palm leaning over a plain
 * afterglow sun on pink water. The .ico (16, 32, 48) is listed with its
 * sizes: Chrome then draws its exact entry in the tab, the 16 and 32 pixel
 * drawings (an SVG it rasterises at 32 and halves, soft at 1x). Firefox
 * and Safari take the SVG, the same two drawings, the 16 under 24 px. iOS's
 * home screen gets the 180 px PNG, the web manifest the 192 and 512.
 */
export const SITE_ICONS = {
  icon: [
    { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    { url: "/favicon.svg", type: "image/svg+xml" },
  ],
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
} satisfies NonNullable<Metadata["icons"]>;

/** The web manifest's icons (src/app/manifest.ts): Android's home screen and an install. */
export const MANIFEST_ICONS = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
] satisfies NonNullable<MetadataRoute.Manifest["icons"]>;
