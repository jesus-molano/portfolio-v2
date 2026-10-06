# Vice Afterglow

The portfolio of Jesús Molano, Frontend Engineer from Tenerife, as one page
you drive: a sunset film that moves only when you do, then his cats, a pause
menu, his side projects in a cinema at night and the end credits at dawn.

**Live:** https://portfolio-v2-sage-six-74.vercel.app, in English (`/en`)
and Spanish (`/es`).

## The page, in order

1. **Loading screen.** A cold open: his name as the game logo, a card of
   tips and trivia, and the way in, with the radio on or off.
2. **The hero.** A WebGL drive over a causeway at sunset toward an art-deco
   skyline. Scrolling, swiping or the keys move the film, and every subtitle
   waits until you have read it. A radio wheel with six stations of licensed
   instrumental music opens with a held right-click, Q, a long-press or the
   RADIO button.
3. **The Usual Suspects.** A police line-up of his four cats against a
   height chart, and one complaint.
4. **The career city.** La carrera: the car drives on through the island
   at night, and every job has its own sign (a war-propaganda billboard, a
   hotel's neon blade, a rotating trivision, torn wheat-paste posters and
   an art-deco tower on air), each one a link.
5. **STATS.** The game pauses: a pause menu with his player profile, a map
   of where he has worked (on site or remote), his favourites and real
   settings (the radio, the controls, the subtitle size, the language).
6. **The Afterglow.** A beach-deco cinema at night, his side projects on the
   posters.
7. **The end credits.** The roll at dawn: the cast, then GitHub and
   LinkedIn, then every licence credit, the typefaces and what the site is
   built with.

With reduced motion the hero is one still frame and its script runs as text;
without WebGL the page stays readable over a CSS sky.

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000; the root redirects to `/en` or `/es` from the
browser's language.

## Check

| Command          | What it runs                                |
| ---------------- | ------------------------------------------- |
| `pnpm lint`      | ESLint                                      |
| `pnpm typecheck` | `tsc --noEmit`                              |
| `pnpm test`      | Vitest unit tests                           |
| `pnpm build`     | The production build (fetches Google Fonts) |
| `pnpm check`     | All four, in that order                     |

With the dev server running, `tools/capture` and `tools/loader` hold the
browser checks: the hero's scroll behaviour, frames of the film and the
loading screen's layout. `AGENTS.md` explains each one.

## Deploy

Absolute URLs (canonical and language links, link previews, `robots.txt`,
the sitemap) use `NEXT_PUBLIC_SITE_URL` when it is set, for a custom domain.
Otherwise they use the production domain Vercel sets on every deployment
(`VERCEL_PROJECT_PRODUCTION_URL`), and `http://localhost:3000` in
development.

## Stack

Next 16 (App Router) · React 19 · TypeScript · Three.js with React Three
Fiber, drei and postprocessing · GSAP · Lenis · CSS Modules on design tokens.
`AGENTS.md` is the project guide: structure, conventions and the rules each
section follows.

## Licences

Everything the page uses from elsewhere keeps its licence next to it, and
the end credits name every author:

- 3D models: `public/models/*/LICENSE.txt` (the convertible is CC BY 3.0,
  Poly by Google; the traffic and the driver's assets are CC0).
- Radio music: `public/music/LICENSE.txt`, track by track.
- The cats: `public/interlude/LICENSE.txt` (built on the XR Blocks "Cat",
  Apache-2.0).
- The STATS map's relief: `public/stats/LICENSE.txt` (public-domain SRTM,
  GMTED2010 and ETOPO1 data).

Inspired by open-world game key art; no game assets, logos or typefaces are
used.
