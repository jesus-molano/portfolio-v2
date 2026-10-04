<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Vice Afterglow — project guide

Cinematic portfolio of Jesús Molano. The look is GTA VI key art, not synthwave:
pastel afterglow sky (lavender, pink, peach), deep-violet silhouettes instead of
black, a wet causeway over pink water, palms, birds, film grain and huge
typography. No striped suns, no neon grids. Phase 1 is the hero.

## Commands

- `pnpm dev` — Next dev server (Turbopack) on http://localhost:3000.
- `pnpm lint` — ESLint CLI (`next lint` no longer exists in Next 16).
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm test` — Vitest unit tests (`src/**/*.test.ts`): locale negotiation,
  proxy redirects, the deterministic city layout and the shader `pow()` rule.
  Add a test for every new pure function.
- `pnpm build` — production build. `next/font/google` downloads fonts at build
  time, so the build needs access to `fonts.googleapis.com` and `fonts.gstatic.com`.
- `pnpm check` — lint, typecheck, tests and build in sequence.

## Stack (pinned on purpose)

- Next 16.3 App Router, React 19.3, TypeScript 6.0 (not 7: typescript-eslint
  does not support it yet), ESLint 9 (eslint-plugin-react does not support 10).
- three `~0.186` (postprocessing requires `< 0.187`), `@react-three/fiber` 9,
  `@react-three/drei` 10, `@react-three/postprocessing` 3.
- GSAP 3 + `@gsap/react` for timelines and ScrollTrigger; Lenis for smooth scroll.

## Structure

- `src/app/[lang]` — root layout and pages. Every route lives under the locale.
- `src/proxy.ts` — redirects `/` to `/en` or `/es` from `Accept-Language`.
- `src/i18n` — locale config and JSON dictionaries. English is the default,
  Spanish is the second language. Add keys to both files.
- `src/design/tokens.ts` — single source of truth for colors, fonts, motion and
  layering. `TokensStyle` emits them as `--va-*` CSS variables; Three.js code
  imports the hex values. DOM styles never hardcode a color. In the 3D scene,
  a material colour used by one file only (car paints, signage, sand, water)
  may stay in that file; a colour shared by two scene parts goes in the tokens.
- `src/features/hero` — the hero: stage, title, canvas, scroll bridge and the
  3D scene (`scene/`), with GLSL in `shaders/`.
  - The car never moves. `scene/drive.ts` holds the shared distance that the
    road, palms, traffic and wheels read; `DriveClock` advances it.
  - Scroll cuts between the shots in `scene/shots.ts`; `CameraRig` evaluates
    the pose, `HeroStage` mirrors the shot index in the HUD and subtitles.
    DOM scroll animations use `at(progress)` in `HeroStage` so they line up
    with the camera progress.
  - The car (`Car.tsx`) and the traffic (`Traffic.tsx`) load glTF models.
    The driver (`Driver.tsx`) is a skinned Quaternius character posed with
    two-bone IK at load time: back on the backrest, right hand on the wheel,
    left arm on the door. Finger curl is negative on the right side and
    positive on the left, because the rig is mirrored.
  - The sky is a dome centred on the camera with a direction-based gradient,
    so no shot sees an edge.
- `src/features/teaser` — placeholder section after the hero. It shows the
  asset credits.
- `src/hooks` — SSR-safe media query hooks.
- `tools/blender` — headless Blender scripts that build the GLB files in
  `public/models` from the original downloads
  (`blender -b -P <script> -- <input> <output>`; set `XDG_CONFIG_HOME` to a
  temporary directory in the sandbox).

## 3D assets and licences

Each folder in `public/models` keeps its `LICENSE.txt`.

- `poly-convertible` — "Convertible" by Poly by Google, CC BY 3.0. The
  licence requires the visible credit in the teaser; keep it.
- `quaternius-cars`, `quaternius-men` — Quaternius, CC0.
- `kenney-nature` — Kenney Nature Kit palms, CC0.

## Scene coherence rules

- The world streams toward +z (`drive.distance`); nothing moves the car.
  Streamed props use `wrapZ` and `streamFade`; shaders use
  `worldZ - uDistance`.
- Same-direction traffic is never faster than the hero and keeps one speed per
  lane, so cars never pass through each other. No camera sits in a lane with
  traffic.
- Shader safety: never call `pow()` with a base that can be negative, and
  guard every `normalize()` of a vector that can be zero. One NaN pixel turns
  the whole frame black through the bloom mipmap blur.
  `shaders/shaders.test.ts` checks the `pow()` rule.

## Development hooks (dev builds only)

- `window.__vaScene` (`DevHandle.tsx`): scene, camera, raycaster, renderer and
  R3F `addAfterEffect`. Read frame pixels inside an `addAfterEffect` callback;
  outside it the drawing buffer is already cleared.
- `window.__vaCam = { position, look, fov }` (`CameraRig.tsx`) freezes the
  camera for framing work. Delete it right after use: while it exists the
  camera ignores the scroll.

## Conventions

- CSS Modules + tokens. No Tailwind.
- Three.js runs client-side only: `HeroCanvas` loads `HeroScene` with
  `next/dynamic` and `ssr: false`, inside an error boundary. The page must stay
  readable without WebGL: real text in the DOM, CSS sky as fallback.
- Scroll progress flows through `heroProgress` (a mutable object), never
  through React state. ScrollTrigger writes it, `useFrame` reads it.
- Respect `prefers-reduced-motion`: no Lenis, no intro animation, static camera,
  `frameloop="demand"`.
- Quality tiers come from `useQualityTier` (viewport + pointer heuristics, no
  network calls). The low tier drops the pier and most post-processing.
- Deterministic layouts use `createRandom(seed)` so screenshots are stable.

## Content rules

- No Rockstar assets, logos or the GTA typeface. Inspiration only.
- Nothing from Heuristik or clinical projects. Skip `atlas-habits` on purpose.
- The site never calls the Claude API. Generated data lives as JSON in the repo.
