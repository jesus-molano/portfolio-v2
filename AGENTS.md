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

Phase 2 (planned) continues the drive into the city at night. First the
work, in order, each employer with its own visual language: the army
(2018-2021, combat engineer, Batallón de Zapadores XVI, Las Palmas) as a
war-propaganda roadside billboard; PwC (2023-2024) as a
vertical hotel neon sign; Cloud District (2024-2025; Naturgy, Pangea,
Telpark) as a rotating trivision billboard; Logixs (2025-2026;
Bytetravel, Retech) as torn wheat-paste posters on a wall,
like the Rolling Stones "Angry" video; Heuristik (2026-now).
Content may break out of the board's frame. Then the personal projects,
faster: dotfiles, tessera-studio, project-atlas, Expenses-Log-App. Every
billboard, sign and poster is a link with a hover state, and its text
also exists as real DOM for keyboard and screen-reader users.

## Commands

- `pnpm dev` — Next dev server (Turbopack) on http://localhost:3000.
- `pnpm lint` — ESLint CLI (`next lint` no longer exists in Next 16).
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm test` — Vitest unit tests (`src/**/*.test.ts`): locale negotiation,
  proxy redirects, the deterministic city layout, the shader `pow()` rule
  and the loading screen's tips, keys and key-art budget.
  Add a test for every new pure function.
- `pnpm build` — production build. `next/font/google` downloads fonts at build
  time, so the build needs access to `fonts.googleapis.com` and `fonts.gstatic.com`.
- `pnpm check` — lint, typecheck, tests and build in sequence.
- `node tools/capture/capture.mjs --device both --progress 0.05,0.3,0.6,0.9`
  — renders hero frames at those film positions (dev server running) into
  `.captures/`. Look at the frames before calling a visual change done.
  `window.__vaJump(p)` (dev only) jumps the film for framing work.
- `node tools/loader/check.mjs` (dev server running; `--url`, `--only
  cls|fit|frames`) — the loading screen's QA: layout shift from the first
  paint to the click (must be exactly 0, also through a slow load), the
  fit matrix of eleven viewports in both languages, and frames of every
  state in `.captures/loader/`. Look at them before calling a change done.

## Stack (pinned on purpose)

- Next 16.3 App Router, React 19.3, TypeScript 6.0 (not 7: typescript-eslint
  does not support it yet), ESLint 9 (eslint-plugin-react does not support 10).
- three `~0.186` (postprocessing requires `< 0.187`), `@react-three/fiber` 9,
  `@react-three/drei` 10, `@react-three/postprocessing` 3.
- GSAP 3 + `@gsap/react` for timelines and ScrollTrigger; Lenis for smooth scroll.

## Structure

- `src/app/[lang]` — root layout and pages. Every route lives under the locale.
  The home page runs, in order: the hero, THE USUAL SUSPECTS (`#suspects`),
  the career city (still to come: a comment in `HomeMain.tsx` marks its
  place), STATS (`#stats`), the finale's cinema (`#projects`) and the end
  credits (`#credits`, ending on `#contact`). `HomeMain.tsx` renders them, so
  `anchors.test.ts` can render the page in both locales: every
  `href="#..."` must reach an element id that exists (no dead links).
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
  - The hero is a film the visitor scrubs (`scroll/story.ts`, unit tested
    with a model of real scrollers in `scroll/testing/scrollerModel.ts`).
    The page scroll is the picture: camera, cuts, title, bars, cards and
    fade follow it 1:1 (Lenis-smoothed) and stop when it stops. The story
    paces it with creeping walls: the title (until the name has formed and
    held 1.2 s), every subtitle card (its reading time: 17 characters a
    second plus 0.6 s) and the crane reveal (1.5 s). The wall of the first
    unfinished beat moves through that beat at the beat's own pace. The
    picture is `min(scroll, frontier)`, and `gateInput` (SmoothScroll)
    trims the scroll there, so nothing plays without input and no card can
    be passed before it has been on screen for its reading time. Held input
    is never silent, and answers in the next frame: it bounces the card
    (`elastic.ts`), raises the world's pace (`throttle.ts`: the drive
    distance step runs x1 to x2; `drive.speed` stays 18 and nothing ever
    runs backwards), brings up "let the man finish" the first times she
    pushes into an unread line, and shows on the dashboard readout
    (`transport.ts`: YOU DRIVE, FLAT OUT, REVERSE or
    WAITING, and the speed in km/h). No video-player words or glyphs
    anywhere (play, pause, fast forward, rewind, timecode): the hero must
    never read as a video playing on its own. While the film waits for her
    (the title once its hint asks, or once she and the picture have been
    still for 1 s) the car slows to a crawl (x0.2, 13 km/h; x0.35 still
    read as driving) and surges back on her next input: that, more than any
    label, tells her she drives. Her first input is answered in place of
    the title hint ("You have the wheel"). Cards fade on time (0.25 s in,
    0.2 s out); a card's reading clock counts only frames that showed it
    fully opaque, and frames are capped at 0.25 s, so a device down to
    4 fps reads at real time and a rewind never shortens a line. A bar
    under the card fills while it is read; then a marker bobs once she
    waits. Wherever the picture rests, a card, the hint, the between-card
    cue or the way into the city says how to go on (tested), in the words
    of her last input (scroll, swipe or Space). Space, PageDown or a tap
    on the picture play the next line (a control focused by a pointer,
    like the radio button its wheel hands the focus back to, does not keep
    Space; one reached with the keyboard does). Skip (shown from the title
    hint on), Esc and End cut to the end: the page lands with
    `#suspects` at the top and that section takes the focus (it has
    `tabIndex={-1}`; `anchors.test.ts` checks it follows the hero). Focus
    leaving the hero opens the walls. A viewport change (rotation, resize, address bar) keeps the
    film where it is. `scroll/film.ts` only lays the cards out on the film
    (`buildTimeline`).
  - Film progress cuts between the shots in `scene/shots.ts`; `CameraRig`
    evaluates the pose. `HeroStage` draws the title, letterbox, subtitle
    cards, HUD and fade to night from the same film position every tick.
  - Subtitle cards come from `hero.lines` in the dictionaries: one array of
    cards per line, at most 64 characters each (tested). Each card is a
    complete thought in his own voice (a film nod only if it reads as plain
    speech); split a line only when the pause is the joke, since every card
    is a wall the visitor waits on. `LINE_SHOTS` in `scroll/story.ts` says which shot each line
    plays in; card timing is computed, never hand-placed. The hero's UI copy
    (`hero.intro`, `hero.osd`, Skip) has length caps per chip
    (`i18n/dictionaries.test.ts`).
  - The car (`Car.tsx`) and the traffic (`Traffic.tsx`) load glTF models.
    The driver (`Driver.tsx`) is Jesús, built with MakeHuman / MPFB from
    CC0 assets by `tools/blender/build_driver_mpfb.py` (body, striped tee,
    earring, first hair and beard; `Driver.tsx` gives the earring its look:
    dark gunmetal, blue toward grazing angles, like his anodised hoop),
    then re-groomed on that GLB by `tools/blender/refine_driver_hair.py`:
    a crew cut with a high skin
    fade, a beard fade at the sideburns, a full beard and a moustache over
    the whole upper lip. It finds the head frame from the mesh (ear
    centres, nose, lips, chin; it prints the landmarks), describes the
    grooming as fields on the skin (density, length, grey share, comb),
    re-bakes the stubble shadow into the skin texture and rebuilds the
    three `HairShell` meshes: four alpha-tested layers each, one glTF
    primitive per layer, whose `COLOR_0` alpha (cut-off over the layer's
    height) scales the texture alpha, and one strand per texel in the
    hair texture. Change the grooming there, never in the GLB: run it with
    the bpy venv's Python on the build script's output, never on its own
    (it refuses). The build output in use is in Git, in the parent of the
    commit that added the script (found by path, so it survives a history
    rewrite): `git show "$(git log --diff-filter=A --format=%h --
    tools/blender/refine_driver_hair.py)^:public/models/makehuman-driver/driver.glb"
    > /tmp/driver.build.glb`, then run `python
    tools/blender/refine_driver_hair.py /tmp/driver.build.glb
    public/models/makehuman-driver/driver.glb`; it is deterministic. In
    Cycles check renders raise `cycles.transparent_max_bounces` (twelve
    stacked layers; the default 8 draws black bands). It is posed with
    two-bone IK at load time
    (`driverPose.ts`, unit tested) on the `game_engine` rig: back on the
    backrest, right hand on the wheel, left arm on the door. Every bone has
    +Y along the bone; no other local axis is assumed: the palm normal
    comes from the knuckles (`palmNormal`) and each finger closes about one
    world axis (`curlFinger`). Hands stay in line with the forearm: turn
    the forearm for the palm, then flex the wrist; never aim the hand on
    its own.
  - His gold aviators (`Sunglasses.tsx`) are a separate GLB in the frame
    of the head bone, added as that bone's child, so they follow the
    glance. The lenses mirror the environment map through a violet-to-pink
    reflectance and read as dark glass from behind. If `driver.glb`
    changes, rebuild them (`tools/blender/build_sunglasses.py`): the script
    fits them to the new head and stops if any piece comes within 3 mm of
    the skin, eyes, lashes, brows or hair shells.
  - Light: the canvas stays `flat` (linear materials) so bloom sees HDR
    values; `SkyEnvironment.tsx` renders our own sky (uniforms from
    `skyUniforms.ts`, shared with `Sky.tsx`), a ground, a horizon strip and
    a hot sun disc into `scene.environment`, so every standard material
    reflects this sky. A warm key comes from the sun direction; sunlit faces
    get about five times the light of shaded ones (keep it above 3:1).
  - Post-processing (`Effects.tsx`) on both tiers: SMAA, bloom on the HDR
    frame, Khronos neutral tone mapping (exposure is
    `gl.toneMappingExposure`), a slight vignette, then one last pass with
    the colour grade (`grade.ts`, mirrored on the CPU and unit tested) and
    35 mm film grain (`FilmGrain.tsx`, `shaders/filmGrain.ts`, 24 grain
    frames a second). High tier only: chromatic aberration and depth of
    field (`LensDepthOfField.tsx`), which reads `lens.ts` every frame and
    does no work while `bokehScale` is 0. In production a slow device steps
    down (`degrade.ts`): depth of field off, then dpr 1, never back up.
  - Palms are procedural (`palmGeometry.ts`): pinnate fronds, ringed curved
    trunks, rendered as violet silhouettes by `shaders/palm.ts`.
  - The city waterfront (`Waterfront.tsx`, layout in `waterfrontLayout.ts`)
    puts a promenade and a row of pastel art-deco hotels in front of the
    towers; the skyline starts behind that row.
  - Behind the hotels the road runs up a street canyon (`AVENUE` and
    `buildFrontage` in `cityLayout.ts`, drawn by `Skyline.tsx`) to a plaza
    and the landmark that closes the vista: an art-deco tower on the axis
    (`Landmark.tsx`, layout in `landmarkLayout.ts`). `world.road.zEnd`
    equals `AVENUE.zTo`. Skyline and landmark share the silhouette shader
    (`createSilhouetteUniforms`: violet ramp, warm sun-side rim).
  - Rooftop billboards (`Billboards.tsx`, layout in `billboardLayout.ts`)
    show `hero.billboards`, site facts only, from one canvas atlas drawn in
    the display font. They stay unlit while the title is up and switch on
    one after another as it leaves (`neonLevel`). `sightCap` keeps every
    building under the sightlines to the boards, and the layout tests cast
    rays (`sightlines.ts`) so nothing hides a board or the tower's crown.
  - The sky is a dome centred on the camera with a direction-based gradient,
    so no shot sees an edge.
- `src/features/music` — the radio, GTA style. `stations.ts` (pure, unit
  tested) holds the genre stations, each a short playlist, in frequency
  order: K-CALIMA 87.9 (classic and garage rock), CROCKETT
  91.4 (80s synth), MR. WOLF 94.7 (hard rock), LEAVE THE GUN 99.2 (funk),
  LOVE DADDY 102.5 (90s hip-hop beats), BABYLON 105.1 (disco, the default). A station
  without tracks stays off the wheel and out of the credits. Every station
  runs on a clock (`livePosition`), so tuning in lands mid-song; the
  playlist loops. `player.ts` plays it on `<audio>` decks, fetches only the
  track on air (the next one in its last 20 s), crossfades through a Web
  Audio burst of tuning static and pauses while the tab is hidden.
  `radio.ts` is the store (useSyncExternalStore) and remembers the last
  station or "off" in localStorage. The loader's "enter with music" plays
  `entryStation` (the remembered station live, or the first time BABYLON
  from the top of Disco Music); its button names the same station. `RadioWheel.tsx` opens by holding the right mouse button over
  the scene, holding or pressing Q, a long-press on touch, or the music
  button (`RadioButton.tsx`); the drive slows down while it is open
  (`hero/scene/timeScale.ts`, not under reduced motion). Radio off sits at
  the bottom; every sector stays a 44 px target on a 360 px phone
  (`wheelGeometry.ts`, tested). Station logos (`StationLogo.tsx`) are our
  own SVG typography in `radio` tokens and `radioFonts`: no trademarks,
  no copied logos. Names stay as written in both languages; taglines live
  in `radio.taglines` in the dictionaries.
- `src/features/loader` — the loading screen, a cold open in the
  open-world genre: painted key art, his name as the game logo
  (`hero.name`, `hero.role` as the kicker), a tip card bottom left, an
  action slot bottom right (progress, then "enter with music" or
  "without"; any printable key enters with music, never a shortcut:
  `entersOnKey`) and a progress line on the bottom edge. A slow wait
  (`isSlow`) says so in the card and offers the way in early. No layout
  shift, ever: every box is placed against the viewport with a fixed
  size, both states of the slot and every tip are in the DOM from the
  first paint, stacked in one cell, and phases switch only opacity,
  visibility, transform and inert; device and motion choices are media
  queries, so the server's HTML paints the right first tip. The page
  under the screen stays `visibility: hidden` until she chooses (CSS
  from the first paint): a late web font reflows the hero's title under
  it, and Chrome counts hidden-from-view shifts too.
  `tools/loader/check.mjs` measures it.
  - No picture behind it (the owner rejected a drawn key art): a dusk
    gradient over night in the tokens, film grain, his name and the tips.
  - Tips are `loader.tips` in the dictionaries: `{ kind, when, text }`,
    `kind` `tip` (how to drive the site) or `trivia` (a joke about the
    site or him), `when` any of `pointer`, `touch`, `motion` (all must
    hold), so a phone never reads about the mouse and reduced motion never
    reads about driving. The same kinds and conditions at every index in
    both languages, 120 characters at most (the card reserves the lines),
    `tips[0]` a tip with no device condition, all six stations named, and
    no tip retells a hero line (the film's beats are the film's). Natural
    sentences, never telegraphic. `tips.ts` orders them (`tipOrder`: the
    first card, then her tips in authored order alternating with shuffled
    trivia) and times them (`tipDuration`: reading time plus 1.5 s, at
    least 5 s); hover or focus holds a tip, Next skips it.
- `src/features/suspects` — THE USUAL SUSPECTS (`#suspects`), right after
  the hero: a police line-up of his four cats against a centimetre height
  chart, a server component with no canvas and no looping animation; its
  one piece of script is the culprit's plate (`CulpritPlate.tsx`). One CSS
  length, `--cm`, is a centimetre of the chart; `lineup.ts` (pure, tested)
  turns the renders' manifest (`public/interlude/manifest.json`, contract
  in `public/interlude/README.md`) into centimetres, so every cat keeps
  its real size, in the owner's order (tested): Tom the biggest and a bit
  chubby, only just over Kira, a normal adult; Odin smaller than both, a
  little short in the leg, with a shorter tail; Dante, a kitten of six
  months, the smallest, his head the lowest. Odin sits in slot 4 as one
  more suspect, described like the others: no halo, no glow, nothing over
  his head and no pass from upstairs on his plate (the owner's call;
  `lineup.test.ts` refuses a render whose manifest sets `haloInImage`,
  `copy.test.ts` a halo anywhere in the dictionaries).
  - The slip taped to the wall is his complaint against the cats
    (DENUNCIA / COMPLAINT · J. MOLANO), not a list of his things: his gear
    and hobbies live in STATS. It ticks off the damage like a police form
    (scratched wardrobes, chewed cables, every bowl licked clean) and ends
    on the owner's tally, "Sospechosos: 4. Culpable: 1."
  - The culprit is Dante (`CULPRIT`, tested to be the smallest: the Usual
    Suspects twist is the one who looks least capable of it), and the
    reveal stays quiet: his plate is a real button that looks like the
    others, and the GUILTY / CULPABLE stamp (`suspects.stamp`, real text,
    `lineup.verdict` ink, never the on-air red) shows nowhere at first
    sight; it sits out of the flow, so even hidden it never widens his
    plate. Pointer hover (only under `hover: hover`) and keyboard focus
    bring it up in CSS, so they work before hydration; a click or a tap
    pins it (`aria-expanded`; `aria-controls` names the stamp). It slams down
    under `prefers-reduced-motion: no-preference` and simply appears
    otherwise. `verdict.test.ts` checks the button, its name in both
    languages, the stamp's place and that the stylesheet hides it.
  - Wide screens: one wall, slots at 36/52/68/84% of the width, the
    complaint on the left, never over the slug (a short window grows the
    wall instead). Landscape phones and windows under 32rem tall keep the
    chart at a readable scale over the full width, with the complaint
    under the line-up. Phones and portrait screens: two strips of two at
    one scale (Kira and Tom, Dante and Odin), then the complaint; a cat too
    wide for its strip is nudged inward (`phoneNudge`). Colours are
    `lineup` tokens.
  - Copy in `suspects` (tested in `copy.test.ts`: the header says Tenerife
    or no city, never Madrid; the complaint keeps the owner's words; the
    eating joke belongs to STATS). The Spanish line follows the Spanish
    dub of *Casablanca*: "Arresten a los sospechosos habituales." The
    cats are the Blender renders of `tools/blender/render_interlude.py`
    (credited in the end credits with the XR Blocks "Cat" base, Apache-2.0);
    `tools/art/suspects/placeholder.mjs` still writes flat silhouettes for
    layout work only.
- `src/features/stats` — STATS (`#stats`), the static pause menu after the
  career city: one screen with two tabs, MAP and STATS. A server component
  (`Stats.tsx`), every word of both tabs DOM text in the server HTML; the
  tabs are its only client code (`StatsTabs.tsx`, below). Tab 1 (MAP,
  `#stats`) is Tenerife at night under parody names (GTA-style: real
  places, renamed; Spanish in both locales, `stats.map.places`). The
  career is five main missions: the army in a Gran Canaria box ("enemy
  territory"), then the four jobs since, every one done from home, as
  badges beside the HQ glyph (no job points at an office), which sits in
  the Teide's caldera so it never points at a real home (tested);
  Heuristik is the only red blip
  (`palette.onAir`). Side activities are the favourites as places a fan
  recognises, never as titles: pit lane "Box 33" at the circuit Atogo has
  been promising for decades (F1: Alonso's long-awaited 33rd win, and
  Verstappen's old number; the owner chose 33: never change it to a
  current car number, `statsCopy.test.ts` holds it), a box that moved in Masca (Metal Gear), pizza without olives in
  Puerto (Devil May Cry), the arena on the Sahara sand of Las Teresitas
  (Gladiator; "Fuerza y honor" is the Spanish dub), a cash-only car wash at
  the Malpaís de Güímar (Breaking Bad), a law office behind a nail salon
  (Better Call Saul), a betting shop with caps on in Garachico (Peaky
  Blinders), the player at the south airport ("Eh, tú, al fin has
  despertado", Skyrim's Spanish line) and the ringing booth (The Matrix),
  the only link on to `#projects`. Beside the map, the main missions
  (plain rows until the career city lands; turning on
  `CAREER_CITY_ON_PAGE` in `statsLayout.ts` makes them links to its
  `#work-*` stops) and the saved games (The Sopranos, Severance,
  Succession). Tab 2 (STATS, `#stats-sheet`) is the character sheet:
  a Cycles render of his driver model with Dante at his shoulder
  (`public/stats/portrait.{avif,webp}`, `tools/blender/build_stats_portrait.py`), the joke bars (appetite breaks out of
  its panel into the gap beside it; under 1280 px, where the panel meets
  the page's edge, the tracks are shorter and it breaks out of its track
  only; the section has `overflow-x: clip`) and the records (the cats
  are "3 + 1" in words alone, with no halo over the 1).
  `statsLayout.ts` holds the projection, every point as real longitude
  and latitude, the caption sides and the page geometry; its tests check
  that the blips stand on land and that no caption, name or marker
  overlaps another at every map width the wide layout takes (1000 px and
  up). Below 1000 px the square crop shows keyed pins and the legend
  carries the words. Move a blip or change a caption, run the tests;
  place a name with the box model, not by eye.
  - The tabs switch in place, like a game's pause menu: the tab bar (click,
    the arrows, Home, End; the WAI-ARIA tabs pattern, selection following
    focus, roving tabindex, the open panel focusable next), `[` and `]` as
    shoulder buttons while STATS crosses the middle of the viewport or
    holds the focus (never Q or E: Q is the radio's), and a prompt to the
    other tab at the foot beside RESUME, which brings the tab bar back into
    view (on a phone the map runs for screens). A switch writes the tab's
    fragment with `replaceState` (no scroll, no hashchange): `#stats` is
    MAP, `#stats-sheet` is STATS (`statsTabs.ts`, pure, tested: fragments
    and keys). A deep link opens its tab before `PageEntry` lands, through
    `lib/reveal.ts`, and lands the section's top with the panel focused.
    The new panel slides in from its tab's side in 0.22 s (none under
    reduced motion).
  - One screen on a desktop: from 1000 px both panels share one grid cell
    and the closed one is `visibility: hidden`, so the taller sets the
    height and a switch moves nothing (the shorter centres in the part of
    that cell the screen shows, not below the fold where the MAP tab runs
    past a short screen); below 1000 px only the open one is
    on the page (`display: none`), as tall as it needs. The map is never
    taller than the screen less everything around it (`MAP_CHROME_PX`, the
    paddings, menu bar, map title, source line and prompts, mirrored in
    `Stats.module.css`), and beside the map (1280 px up) the missions and
    saved games use tighter rows, so the MAP tab fits 1440 × 900. The
    section lands at the viewport's top edge (a negative `scroll-margin-top`
    cancels the html scroll-padding: its own 64 px top padding clears the
    page controls).
  - Without JS (the stacking only applies under `@media (scripting:
    enabled)`) both panels stay on the page, one under the other, with two
    plain links; the tab roles come with hydration (`statsMarkup.test.ts`
    renders the server HTML). The map is a lazy `<img>`; the portrait is
    lazy too until the section is within a screen of the viewport or its
    tab opens (`StatsPortrait`).
- `src/features/finale` — the last two stops, static (no canvas, no
  scroll-driven motion): The Afterglow, a beach-deco picture palace at
  night with the side projects (`Projects.tsx`), then the end credits at
  dawn (`EndCredits.tsx`).
  - The cinema is a pre-drawn plate per mood (night, dawn), layout (wide
    for landscape, tall for portrait: `TALL_MEDIA`) and locale, from
    `tools/art/finale/build.mjs` (`node tools/art/finale/build.mjs [--only
    night-wide,posters]`; Playwright's Chromium, Google Fonts cached in
    `.art-cache/`, Pillow AVIF + WebP via `tools/art/encode.py`). It writes
    `public/finale/*` and `plates.json`: the marquee board, its rails, the
    bulb strips and the poster cases in plate units. The live DOM goes on
    the plate in cqw of a container as wide as it (`finaleLayout.ts`,
    tested): changeable letters in Bebas Neue (`--va-font-marquee`; kits
    have no accents, so accents are taped on), chasing bulbs, and four
    cases. Change the art in the generators, never in the images; the
    posters' taglines come from `projects.posters` in the dictionaries.
    Each poster is encoded 432 and 216 px wide, a srcset (`links.ts`,
    `POSTER_SIZES`): a case on a 1x facade takes the small one.
  - The car parked at the kerb on the dawn plates is not drawn: it is a
    Cycles render of the hero's own `convertible.glb`
    (`tools/blender/render_finale_car.py`: the hero's paint, top down,
    wheels straight, no driver, dawn light, a baked contact shadow) from
    each plate's own camera, cropped to the car on the plate's pixel grid.
    It writes `tools/art/finale/car/<plate>.png` and `.json`; `build.mjs`
    embeds the PNG where the plate's camera projects it, mirrors it in the
    wet street about the near tyres, and refuses a render made for another
    camera or car place: after moving a dawn camera or the car, update
    `VIEWS` in the script and re-render before rebuilding the plates.
  - Each side project is one link (`links.ts`, `PosterCase.tsx`): its case
    on the facade and its caption in the bill below. Hover (only where a
    pointer can hover) or keyboard focus chases its bulbs, shows the
    poster's lit state and re-letters the marquee (`ProjectsMarquee.tsx`);
    reduced motion stops the chases and cuts the letters.
  - The credits roll is the page's own scroll: on wide screens the dawn
    frame is sticky and the roll scrolls over its right side. It is real
    text and a plain CV (`credits.ts`, tested): no city for the civilian
    jobs, Las Palmas for the army, Heuristik as Frontend
    Engineer, 2026 to LIVE (in English everywhere). It keeps every licence
    credit (the CC BY 3.0 car, every radio track in its author's format,
    the CC0 assets) and the typefaces, and ends on the GitHub and LinkedIn
    tickets (`rel="me"`, never the email). Odin is not named in the
    credits (the owner's call).
- `src/hooks` — SSR-safe media query hooks.
- `src/lib` — small shared helpers: `onScreen.ts` says what an
  IntersectionObserver counts as on screen (an edge that only touches the
  viewport does not, which is where Skip leaves the hero); `hash.ts` reads
  the id a URL fragment names; `reveal.ts` asks a deep link's target to
  show itself before the page lands on it (STATS opens the tab it is in).
- `tools/art/stats` — the STATS map. `extract.mjs` (run once, needs the
  network) turns the public-domain Terrain Tiles on AWS (zoom 8: SRTM,
  GMTED2010, ETOPO1 only; it refuses a tile with any other source) into
  `canaries.json`: the coast (the 40 m ring, after a morphological opening
  that drops resampling seams), relief and depth rings of Tenerife and Gran
  Canaria. `map.mjs` (offline, deterministic) draws `public/stats/map.svg`
  (16:11) and `map-square.svg` (1:1) from it and `statsLayout.ts`: our
  palette, terraced relief, schematic roads through the real towns
  (asserted on land), town lights, runways, the circuit and the career
  route; no text in the SVG. Each file stays under 40 KB (it refuses more).
- `tools/blender` — headless Blender scripts that build the GLB files in
  `public/models` from the original downloads
  (`blender -b -P <script> -- <input> <output>`; set `XDG_CONFIG_HOME` to a
  temporary directory in the sandbox). `build_driver_mpfb.py` needs the
  MPFB 2 extension and the MakeHuman system assets installed in that
  profile; it writes the GLB, its textures and check renders to an output
  folder outside the repo. Its body and face values live in
  `tools/blender/driver.params.json`, which Git ignores: keep personal
  data out of the published script. `build_sunglasses.py` runs on
  `driver.glb` and writes `public/models/sunglasses/aviator.glb`, with
  optional Cycles check renders of the head to a folder outside the repo.
  `render_finale_car.py` renders the hero's car for the finale's dawn
  plates (see `src/features/finale`).
  `build_cats.py` builds the four cats of THE USUAL SUSPECTS interlude
  (Cycles stills, one transparent layer per cat) on the XR Blocks "Cat":
  `cats/` is the shared generator (base, shape, pose, cat-space markings,
  skin, fur, eyes, whiskers, stage, review) and
  `cats/suspects/<cat>.py` holds everything that makes one cat itself
  (size, proportions, pose, palette and markings, fur, eyes, skin,
  whiskers; Odin has no halo), so each cat is tuned in its own file. Run it
  with the bpy venv's Python: `build_cats.py -- --cat tom --render <folder
  outside the repo> [--quality clay|test|final] [--views ...] [--field
  coat]`. It writes the views, a review sheet (every view at full size,
  96 px, 48 px and as a silhouette), a report (sizes, paw and ear-tip
  heights, joints in floor cm for tail paths, the muzzle guards) and, with
  `--cat all`, the line-up on a mock height chart. Shape never reaches the
  muzzle: the base's sculpted face keeps every cat reading as a cat. The
  light rig's energies are calibrated (the key lights an 18% grey card to
  about 0.2) and its colours come from `tokens.ts`. `render_interlude.py`
  renders the four shipping layers in `public/interlude` together with one
  light rig, one camera and one setting, so they read as one set.

## 3D assets and licences

Each folder in `public/models` keeps its `LICENSE.txt`.

- `poly-convertible` — "Convertible" by Poly by Google, CC BY 3.0. The
  licence requires the visible credit in the end credits; keep it.
  `tools/blender/refine_convertible.py` (runs on the GLB) paints the badges
  out, splits Paint / Glass / Trim / Rim / Tyre materials, smooths the
  bodywork and writes a paint mask into the atlas alpha; `Car.tsx` tints
  only the masked paint. The end credits' dawn plates show a render of
  it (`render_finale_car.py`), dressed the same way. Blender is also
  available as `pip install bpy==4.5.4` in a Python 3.11 venv (no
  download.blender.org needed); never name a script `inspect.py` (it
  shadows the module bpy imports).
- `quaternius-cars` — Quaternius, CC0.
- `makehuman-driver` — built from the MakeHuman system assets, CC0. Never
  use the community beards bundled with MPFB (`wdg_scruffy_beard`,
  `grinsegold_beard_sigmund_wip`): they are AGPL. The reference photos of
  Jesús never go into the repo.
- `sunglasses` — the driver's aviators, an original model made for this
  site by `tools/blender/build_sunglasses.py` (generic style: no brand, no
  logo, no borrowed mesh); materials Frame and Lens, under 3k triangles.
- XR Blocks "Cat" (an American Shorthair) by Google, Apache-2.0
  (`xrblocks/assets` at a pinned commit): the base of the four cats.
  `tools/blender/cats/base.py` downloads it, checks its SHA-256 and keeps
  it outside the repo; no GLB of it ships, only rendered stills, which
  carry the licence text, say what was changed and credit the source
  without implying endorsement. The owner's cat photos never go into the
  repo.
- Palms, buildings and props are procedural; they need no licence.
- `public/stats` — the STATS map (public-domain SRTM, GMTED2010 and ETOPO1
  relief, drawn by `tools/art/stats`) and the rendered portrait; its
  `LICENSE.txt` gives the sources.

## Radio music and licences

`public/music/<slug>.mp3` holds the radio's tracks, and
`public/music/LICENSE.txt` lists each one by station: title, artist,
source URL, licence and what was changed. Only instrumental tracks whose
licence allows this use: CC BY 4.0 (Kevin MacLeod, credited in his own
format), CC0, or the Pixabay Content License. No copyrighted songs, ever.
Pixabay licence certificates name the licensee: they stay out of the repo;
LICENSE.txt gives the track page and the Pixabay ID instead.

To add a track to a station:

1. Encode it: `tools/audio/encode-track.sh <download> public/music/<slug>.mp3
   [start] [end]` (ffmpeg on PATH, or `FFMPEG=...`; `pip install
   imageio-ffmpeg` ships one). It trims, fades out a mid-track cut, strips
   silence, normalises to -16 LUFS / -1.5 dBTP, writes MP3 128 kbps 44.1 kHz
   stereo without tags, and prints the duration. Cap a track at about 3:45,
   ending on a phrase; drop long fade-ins and ring-outs.
2. Add `{ url, duration, credit }` to the station's `tracks` in
   `src/features/music/stations.ts`, with the printed duration and a credit
   from `macleod()`, `holizna()`, `cc0()` or `pixabay()`.
3. Add the track to `public/music/LICENSE.txt`, and its title to the
   agreed playlists and the credit count in `stations.test.ts`. The end
   credits and the wheel pick it up from the data; a station's first track
   puts it on air.

## Scene coherence rules

- The world streams toward +z (`drive.distance`); nothing moves the car.
  Streamed props use `wrapZ` and `streamFade`; shaders use
  `worldZ - uDistance`. Traffic wraps in `STREAM`; the roadside (layout in
  `scene/roadside.ts`) wraps in the longer `ROADSIDE` window, where palms
  and lamps come in at full size over a static twin on the city beach and
  the towers and the pier rise out of the sand: nothing there grows in.
- Same-direction traffic is never faster than the hero and keeps one speed per
  lane, so cars never pass through each other. No camera sits in a lane with
  traffic.
- Shader safety: never call `pow()` with a base that can be negative, and
  guard every `normalize()` of a vector that can be zero. One NaN pixel turns
  the whole frame black through the bloom mipmap blur.
  `shaders/shaders.test.ts` checks the `pow()` rule.
- Depth precision: at 300 m the depth buffer resolves a few centimetres.
  Windows, signs and neon on a far facade stand at least 0.1 m off it, or
  they shimmer.

## Development hooks (dev builds only)

- `window.__vaScene` (`DevHandle.tsx`): scene, camera, raycaster, renderer and
  R3F `addAfterEffect`. Read frame pixels inside an `addAfterEffect` callback;
  outside it the drawing buffer is already cleared.
- `window.__vaCam = { position, look, fov }` (`CameraRig.tsx`) freezes the
  camera for framing work. Delete it right after use: while it exists the
  camera ignores the scroll.
- `window.__vaLens = { focusDistance, focusRange, bokehScale }`
  (`lensBlur.ts`) overrides the lens for depth-of-field work, in metres
  from the camera. Delete it after use.
- `window.__vaJump(p)` (`HeroStage.tsx`) opens the story up to `p` and jumps
  the picture and the page scroll there; `tools/capture` uses it.
- `window.__vaProbe = []` (`HeroStage.tsx`) makes every hero frame push its
  state (picture, scroll, frontier, active card and its opacity, pace,
  pressure, readout mode, cues, the tick's own cost in ms). Delete it after
  use: it grows forever.

## Conventions

- CSS Modules + tokens. No Tailwind.
- A section with a looping CSS animation (bulbs, the booth's ring) carries
  `data-loops`: `PauseOffscreen` (in `HomeMain.tsx`) pauses
  every animation in it while it is off screen, so it costs no style pass a
  frame during the hero.
- Where the page starts once she is in is `PageEntry` (in `HomeMain.tsx`),
  once the loading screen has given `<main>` back: a link to a section
  after the hero (`/en#contact`, or an in-page link) cuts the film the way
  Skip does (`hero/heroEnd.ts`, registered by `HeroStage`) and lands on
  that section with the focus (a target in a closed tab opens it first,
  `lib/reveal.ts`); otherwise the keyboard starts at the top of the page
  (skip link, radio, languages, then Skip).
- The page controls (RADIO, EN/ES) are fixed at the top right, so `html`
  has a `scroll-padding-top` (their inset, height and a 1rem gap,
  `globals.css`): a section reached by a link or by keyboard focus stops
  below them. Scripted scrolls (`scrollTo`, Lenis) ignore it; nothing
  focusable may sit under the controls in the hero's pinned frame. STATS
  cancels it with a negative `scroll-margin-top`: its own top padding
  clears the controls, and its one screen shows whole.
- Three.js runs client-side only: `HeroCanvas` loads `HeroScene` with
  `next/dynamic` and `ssr: false`, inside an error boundary. The page must stay
  readable without WebGL: real text in the DOM, CSS sky as fallback.
- Scroll progress flows through `heroProgress` (a mutable object), never
  through React state. `HeroStage` writes `target` from the Lenis scroll
  (the frame reads no layout; the stage is measured when the viewport
  changes), clamps it to the story frontier into `value`, and `useFrame`
  reads `value`.
- `lenis` is pinned on purpose: `gateInput` relies on 1.3.26 internals, and
  `scroll/lenisContract.test.ts` guards them. Re-check them before an upgrade.
- Respect `prefers-reduced-motion`: no Lenis, no intro animation, static camera,
  `frameloop="demand"`; the hero is one still screen and the script follows
  it as running text (no scrolling over a frozen frame).
- Quality tiers come from `useQualityTier` (viewport + pointer heuristics, no
  network calls). The low tier drops the pier, chromatic aberration,
  depth of field and the clear coat on the driver's lenses, and renders a
  smaller environment cube.
- Deterministic layouts use `createRandom(seed)` so screenshots are stable.

## Content rules

- No Rockstar assets, logos or the GTA typeface. Inspiration only.
- Heuristik is the current employer: show the role and dates only (no
  city, no mention of remote work), nothing from its clinical projects. Skip `atlas-habits` on purpose
  (`project-atlas` is a different repo and belongs in the projects).
- The site never calls the Claude API. Generated data lives as JSON in the repo.
