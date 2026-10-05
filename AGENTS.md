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
  proxy redirects, the deterministic city layout, the shader `pow()` rule,
  the loading screen's tips, keys and key-art budget, the content map
  (`i18n/contentMap.test.ts`), and the hero's scroll UX acceptance checks
  (`scroll/acceptance.test.ts`).
  Add a test for every new pure function.
- `pnpm build` — production build. `next/font/google` downloads fonts at build
  time, so the build needs access to `fonts.googleapis.com` and `fonts.gstatic.com`.
- `pnpm check` — lint, typecheck, tests and build in sequence.
- `node tools/capture/scrollux.mjs --url http://localhost:3000` — the
  browser half of the scroll UX acceptance (dev server running): swipes
  against the radio's long-press, the arrows, the hold note, the rewind
  hint, the long wait, the radio and its callout, reduced motion (and back),
  focus, caption pills, calm readers, the title (a tap while the name
  forms, no ghost after a short swipe) and the loader on a phone, on
  desktop and a phone in both languages. PASS or FAIL.
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
  credits (`#credits`, with `#contact` before their fine print). `HomeMain.tsx` renders them, so
  `anchors.test.ts` can render the page in both locales: every
  `href="#..."` must reach an element id that exists (no dead links). Any
  other path under a locale (`[...rest]`) renders the localized 404
  (`not-found.tsx`), with its own title (`notFound.title`, "Wrong exit —
  Jesús Molano").
- Metadata: the layout's `generateMetadata` gives each locale its title,
  description, canonical and hreflang links and a link preview card (Open
  Graph and Twitter): `public/og/<locale>.jpg`, 1200 × 630 and under 300 KB
  (`lib/shareCard.ts`, tested), the cinema's night plate with his name and
  role on the marquee and the posters in their cases, built by
  `python3 tools/art/og/build.py` (Pillow; Bebas Neue fetched once into
  `.art-cache/fonts/`, or `--font` names a copy). Rebuild the cards when the
  plate, a poster, his name or his role changes: the script writes what it
  used to `tools/art/og/sources.json` (the words, the SHA-256 of the plate,
  each poster and the card), and `shareCard.test.ts` fails on a card left
  behind. `src/app/robots.ts` and `src/app/sitemap.ts` list
  both locales. Every absolute URL comes from `siteUrl()` (`lib/siteUrl.ts`,
  tested): `NEXT_PUBLIC_SITE_URL` if set (a custom domain), else
  `https://$VERCEL_PROJECT_PRODUCTION_URL` (Vercel sets it on every
  deployment, previews too: the production domain,
  portfolio-v2-sage-six-74.vercel.app today), else `http://localhost:3000`.
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
    be passed before it has been on screen for its reading time. The page
    is never left past the frontier (`scroll/gate.ts`): the input the gate
    passes never goes past it (a finger's fling flies up to the wall and
    no further, and every move of a stroke is cancelled, by Lenis or by
    the gate: Lenis drops a move with nothing vertical in it, a still
    finger's coalesced move or a pressure change, before it cancels it,
    and a move nobody cancels hands the rest of the stroke to the
    browser's own scrolling, past every wall; `lenisContract.test.ts`),
    and whatever else moves the page there (the scrollbar,
    find in page, an anchor, a programmatic scroll, wheel events the
    browser would not let the page cancel) goes back to it in the same
    frame, offering Skip for a jump of a viewport. Pulling back, not
    opening the walls, keeps every card and never strands her: page and
    picture agree again at once, so her next input works (focus moving
    below the hero still opens them). The frame reads where the page is
    from the page itself, never from Lenis alone: Lenis can miss a native
    scroll (it drops the one after its own landing, a whole second at
    1 fps), and once it had, every push was held while the page sat below
    the hero. Her input does the same before Lenis scrolls (`gateInput`,
    the hero's keys and taps): a native move's scroll event comes with the
    next frame, and a notch before it went on from where Lenis had the
    page, not from where it was. A finger moves the page only once it has moved 8 px, and
    turning back only once it is 8 px back from the furthest it went
    (`gate.ts` Stroke, the same in the scroller model): a resting thumb
    trembles by 0.3 to 3 px, and followed 1:1 every tremble back read as
    REVERSE (the line being read hid and its clock stopped) and every one
    forward at a wall as a push. Nothing is lost: starting or turning, the
    stroke scrolls the finger's whole travel. Held input
    is never silent, and answers in the next frame: it bounces the card
    (`elastic.ts`), raises the world's pace (`throttle.ts`: the drive
    distance step runs x1 to x2; `drive.speed` stays 18 and nothing ever
    runs backwards) and shows on the dashboard readout (`transport.ts`:
    YOU DRIVE, FLAT OUT, REVERSE or WAITING, and the speed in km/h; no
    gear letter, a "D" read as the WASD key). No video-player words or
    glyphs anywhere (play, pause, fast forward, rewind, timecode): the hero
    must never read as a video playing on its own.
  - At any moment the hero says one of two things, never both
    (`scroll/feedback.ts`, pure, stepped by HeroStage and by the scroller
    model, so `scroll/acceptance.test.ts` checks what the page does). The
    line is playing, hold on: a beat plays at the picture
    (`story.playingBeat`: an unread card that is up, the title's name
    forming and holding, the crane rising), the bar under the card fills,
    the car cruises (or surges while she pushes), and only sustained
    pushing (pushes spanning 1.2 s with no pause of 0.32 s, a viewport
    thrown at the wall; a frame is a push only if the input held at the
    wall grew in it by over 0.4 viewports a second, so a fling's momentum
    and a thumb resting on the glass never count, and two flicks or one
    trackpad fling never do; on touch the episode bridges the lift
    between strokes, up to 0.7 s, so flicks that keep coming or a finger
    dragging on do) brings up "let the man finish", gone 0.32 s after she
    stops (0.7 s on touch), on at most three lines a visit. Or it is her turn: nothing plays, she has stopped for
    her wait, the picture with her, for 0.3 s (a stalled frame or a card
    handing over is not her turn); the readout says WAITING, and only
    then does the read card's marker bob or a cue say how to go on, so
    nothing asks for more next to YOU DRIVE. The car brakes, from half a
    second into the wait, to a crawl (x0.2, 13 km/h; x0.35 still read as
    driving); after 4 s of waiting it crawls lower (x0.15, 10 km/h) and
    the marker or cue asks again. That brake, and the car getting going
    again on her next input, tells her she drives more than any label.
    Hysteresis keeps it calm: a visitor with a steady rhythm (gaps up to
    7 s) gets a little more than her own beat before WAITING
    (`waitIdleFor`, up to 5 s: a notch every 2.5 to 5 s never sees it), a
    light push gets the car up from the crawl like a car (a hard one still
    surges at once), and FLAT OUT needs full throttle held for 0.6 s and
    lets go only under x1.45. The feedback runs on real time (only the
    reading clocks are capped), so a slow device neither scolds sooner
    nor keeps a state up longer.
  - The way on is one arrow per input type, the same in the hint, the
    card's marker, the readout's WAITING, the between-card cue and the
    way into the city: up for a finger (swipe up), down for the wheel and
    the keys, bobbing the way it points. The marker is glued to the card's
    last word, so it never wraps onto a caption line of its own. Her first
    input is answered in place of the title hint ("You have the wheel")
    while the name forms and holds, with why the road still waits ("Easy,
    the name's still pulling in"), and 2 s after; Space or a tap pressed
    then plays the first line once the name has formed. Once the wheel is
    hers nothing asks her to take it again: resting on the title (after
    that answer, or rewound there) brings "keep driving" into the hint's
    place, centred in what is left of the bottom bar; resting
    mid-dissolve, the title finishes its fade on time
    (`settleTitle`) instead of hanging there as a ghost. A card coming up
    hides the between-card cue at once. Cards fade on time (0.25 s in, 0.2 s out); a
    card's reading clock counts only frames that showed it fully opaque,
    and frames are capped at 0.25 s, so a device down to 4 fps reads at
    real time and a rewind never shortens a line. Wherever the picture
    rests, a card, the hint, the between-card cue or the way into the city
    says how to go on (tested), in the words of her last input (scroll,
    swipe or Space). Space, PageDown or a tap on the picture play the next
    line (a control focused by a pointer, a press or release in the last
    second with no key since, does not keep Space, and stays so when a
    dialog hands the focus back to it, closed by a click or by Esc, until
    a Tab: the radio button clicked open never reopens on Space; one
    reached with Tab keeps it, even right after a click). Skip (shown from
    the title hint on), Esc and End cut to the end (and so do Ctrl+End
    and Cmd+Down, as Ctrl+Home and Cmd+Up act as Home: the browser
    animates those jumps, and the next section flashed before the gate
    pulled the page back): the page lands with `#suspects` at the top and
    that section takes the focus (it has `tabIndex={-1}`;
    `anchors.test.ts` checks it follows the hero). Focus
    leaving the hero opens the walls, and so does any move of the page
    past it that is not her scrolling (a link, a deep link, Skip:
    `lib/navigate.ts`). A viewport change (rotation, resize, address bar)
    keeps the film where
    it is, and so does reduced motion switched on mid-film: the line she
    was on shows in the running script, and if motion comes back the film
    resumes exactly where it was (she has not scrolled), at the line she
    reads, or at its end once she has read past the script. The frame
    allocates nothing but the strings of what changed. The hero marks the
    scene `settled` once its first line has been read and she rests (or
    the walls open; the still hero once its title is scrolled away), and
    `quiet` while nothing on screen asks her for anything: side hints,
    like the radio's, wait for both and never share the screen with a
    prompt. `scroll/film.ts` only lays the cards out on the film
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
    show `hero.billboards` from one canvas atlas drawn in the display font:
    his name and his role, then two ads for stations on the dial (BABYLON
    105.1, CROCKETT 91.4), a hint at the radio; nothing else (tested), the
    same in both languages. The first two repeat the title on purpose. They
    stay unlit while the title is up and switch on one after another as it
    leaves (`neonLevel`). `sightCap` keeps every
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
  button (`RadioButton.tsx`, the obvious way in on touch). The long-press
  never steals a swipe (`touchHold.ts`, tested): it arms after 0.6 s held
  within 8 px (a ring under the finger), opens as that still finger
  lifts, and any movement, scroll input or a page still in motion cancels
  it. While the wheel is open it keeps every scroll and swipe to itself
  (the mouse wheel browses the dial; a finger closes it with a tap on the
  backdrop, never with a swipe), and the drive slows down
  (`hero/scene/timeScale.ts`, not under reduced motion). The long-press is
  timed by the touch events' own timestamps, so a slow frame never turns a
  tap into a hold. The button's first-visit callout waits until the hero
  has settled and is quiet (a line playing, no prompt up), steps aside
  when the hero asks her something, and hangs below the HUD while the
  button glows; a tap on it opens the wheel ("Tap here for the radio" on
  touch). Radio off sits at
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
    no tip retells a hero line (the film's beats are the film's) or gives
    away a later section (the cats and their complaint, STATS' bars, map
    and favourites, the cinema, the credits; tested). Nothing promises what
    is not on the page yet: the career city's tip ("a sign for every
    employer") comes back with the city. Every trivia is true of the site
    (the aviators mirror our sky, the palms are made in code, the grain
    changes 24 times a second, every station keeps its own clock, the
    traffic going her way holds her pace). Natural sentences, never
    telegraphic. `tips.ts` orders them (`tipOrder`: the
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
    or no city, never Madrid; the slug says "Flatmates" / "Compañeros de
    piso", the owner's words without his name, which the section shows
    once, on the complaint; the complaint keeps the owner's words; the
    eating joke belongs to STATS). The Spanish line follows the Spanish
    dub of *Casablanca*: "Arresten a los sospechosos habituales." The
    cats are the Blender renders of `tools/blender/render_interlude.py`
    (credited in the end credits with the XR Blocks "Cat" base, Apache-2.0);
    `tools/art/suspects/placeholder.mjs` still writes flat silhouettes for
    layout work only.
- `src/features/career` — the career, written down once (`career.ts`,
  pure, tested): per job, oldest first, the employer as it writes itself
  (for the army, his unit, the Batallón de Zapadores XVI), the years, its
  stop in the career city (`#work-*`) and the role, in English in both
  languages (Frontend Developer, Full Stack Developer, Frontend Engineer)
  except the army's (Zapador / Combat engineer; the city's service record
  spells it Soldado zapador). Las Palmas de Gran Canaria is the army's
  alone: no civilian job names a city, and no copy says Madrid or remote
  (tested over both dictionaries). Heuristik is on air, LIVE in English
  everywhere. STATS derives its main missions from it (`statsLayout.ts`
  adds only where each one sits on the map; `stats.missions.items` in the
  dictionaries is tested to say the same), and the career city reads it
  too. It imports nothing at runtime: `statsLayout.ts` imports it by its
  `.ts` file name (`allowImportingTsExtensions`), because
  `tools/art/stats/map.mjs` loads that file in Node.
- `src/features/stats` — STATS (`#stats`), the static pause menu after the
  career city: one screen with two tabs, MAP and STATS. A server component
  (`Stats.tsx`), every word of both tabs DOM text in the server HTML; the
  tabs are its only client code (`StatsTabs.tsx`, below). Tab 1 (MAP,
  `#stats`) is Tenerife at night under parody names (GTA-style: real
  places, renamed; Spanish in both locales, `stats.map.places`; each one
  gives the real town away at a glance, like GÜIMARCIANO for Güímar). The
  career is five main missions: the army in a Gran Canaria box (the
  island and its city named, nothing more: the Tenerife-versus-Gran-Canaria
  joke is the hero's, and the army's road-opening is the career city's),
  then the four jobs since, every one done from home, as badges beside
  the HQ glyph (no job points at an office), which sits in
  the Teide's caldera so it never points at a real home (tested);
  Heuristik is the only red blip
  (`palette.onAir`). Side activities are the favourites as places a fan
  recognises, never as titles: pit lane "Box 33" at the circuit Atogo has
  been promising for decades (F1: Alonso's long-awaited 33rd win, and
  Verstappen's old number; the owner chose 33: never change it to a
  current car number, `statsCopy.test.ts` holds it), a box that moved in
  Masca (Metal Gear; the box is this blip's alone, the sheet's STEALTH bar
  is about the cats and a tin), pizza without olives in Puerto (Devil May
  Cry), the arena on the Sahara sand of Las Teresitas
  (Gladiator; "Fuerza y honor" is the Spanish dub), a cash-only car wash at
  the Malpaís de Güímar (Breaking Bad), a law office behind a nail salon
  (Better Call Saul), a betting shop with caps on in Garachico (Peaky
  Blinders), the player at the south airport ("Eh, tú, al fin has
  despertado", Skyrim's Spanish line) and the ringing booth (The Matrix),
  the only link on to `#projects` (STATS names no side project: they are
  the cinema's, `statsMarkup.test.ts`). The booth's link is named by its
  own words, the visible "Answer to continue" then an unseen ": side
  projects", never an `aria-label` that drops the words she can see
  (label in name, tested). The main missions are the career
  index (plain rows until the career city lands; turning on
  `CAREER_CITY_ON_PAGE` in `statsLayout.ts` makes them links to its
  `#work-*` stops), first in the page: from 1280 px a column beside the
  map's frame, as tall as it (a subgrid), the badges on one route; from
  700 to 1279 px a row of five above the map, each under its segment of
  the progress line; on a phone a column before the map, so the content
  comes before the map's way out. Tab 2 (STATS, `#stats-sheet`) is the
  character sheet:
  a Cycles render of his driver model with Dante at his shoulder
  (`public/stats/portrait.{avif,webp}`, `tools/blender/build_stats_portrait.py`), the joke bars (appetite breaks out of
  its panel into the gap beside it; under 1280 px, where the panel meets
  the page's edge, the tracks are shorter and it breaks out of its track
  only; the section has `overflow-x: clip`) and the records: Dante's
  wanted level (five stars since the cables), the countless "just one more
  episode" and the Grand Prix kilometres without a ticket ("from the
  sofa" is said once, under RACECRAFT). No record counts the cats and no
  halo shows anywhere (`statsCopy.test.ts`); each value's glyphs are
  hidden from screen readers, which hear `spoken` instead.
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
    other tab at the foot, which brings the tab bar back into view (on a
    phone the map runs for screens). Beside it RESUME (CONTINUAR) is a real
    link on to `#projects`, like the booth, never a button-shaped label;
    both prompts are 44 px targets that lay out as 24 px. A switch writes
    the tab's fragment with `replaceState` (no scroll, no hashchange): `#stats` is
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
    `Stats.module.css`), and beside the map (1280 px up) the missions take
    the frame's height, so the MAP tab fits 1440 × 900. The section lands
    at the viewport's top edge (a negative `scroll-margin-top` cancels the
    html scroll-padding: its own 64 px top padding clears the page
    controls).
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
    bulb strips, the poster cases and the box office in plate units. The live DOM goes on
    the plate in cqw of a container as wide as it (`finaleLayout.ts`,
    tested): changeable letters in Bebas Neue (`--va-font-marquee`; kits
    have no accents, so accents are taped on), chasing bulbs, and four
    cases. Change the art in the generators, never in the images; the
    posters' taglines come from `projects.posters` in the dictionaries.
    Each poster is encoded 432 and 216 px wide, a srcset (`links.ts`,
    `POSTER_SIZES`): a case on a 1x facade takes the small one. The dawn
    plates hang the same posters, dimmed, so a poster change rebuilds
    them too (`--only dawn-wide,dawn-tall,posters`), and then the link
    preview cards (`tools/art/og/build.py`), which hang them as well.
  - Every part of a poster has one job, and none repeats another: the
    tagline and the line under the title (`tagline`, `sub`) make the
    joke; the billing block (baked in `posters.mjs`) gives names and
    stack and opens with THE AFTERGLOW PRESENTS (the cinema presents,
    never his name); the caption under the case (`oneLiner`) says plainly
    what the project does. A poster only claims what its repository does:
    dotfiles is a fifties sci-fi bill, a saucer beaming his setup onto a
    Windows and a CachyOS machine (no heist, no Hyprland), and Expenses
    Log never promises a push reminder without a connection.
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
    on the facade and its caption in the bill below. Its name is the repo
    and the GitHub cue; its description is the genre, then the words that
    are only in the poster's image (tagline and `sub`, unseen) and the
    caption, so a screen reader gets the whole joke (`links.test.ts`).
    Hover (only where a
    pointer can hover) or keyboard focus chases its bulbs, shows the
    poster's lit state and re-letters the marquee (`ProjectsMarquee.tsx`);
    reduced motion stops the chases and cuts the letters.
  - The painted box office (TICKETS / TAQUILLA) is a link too, a plain
    same-page one to `#contact` (`PageEntry` takes it), placed from
    `plates.json` on both night plates: hover or focus lights it and shows
    where it leads; on touch that chip shows from the start. The marquee's
    second row bills the show as FREE ADMISSION / ENTRADA LIBRE (the code
    is open; "off the clock" is STATS's).
  - The credits roll is the page's own scroll: on wide screens the dawn
    frame is sticky and the roll scrolls over its right side. It is real
    text (`credits.ts`, tested) and tells only what is its own, the
    contact before the fine print (tested): the title and who wrote it
    (his name once more, and in the copyright), the cast (the driver as
    Himself; of the cats only the culprit, Dante: Odin is not named in the
    credits, the owner's call), then THANKS FOR DRIVING BY and the GitHub
    and LinkedIn tickets (`#contact`, `rel="me"`, never the email), then
    the fine print: PROPS AND SETS (the CC BY 3.0 car, the CC0 traffic and
    body, the cats' Apache-2.0 base as a modified version, the map's
    public-domain relief), every radio track in its author's format, the
    typefaces, HIS TOOLKIT and BUILT WITH (no name in both: what only this
    site uses is in BUILT WITH alone; no Vue or Nuxt), smaller and two
    credits to a row once the roll is wide enough (a container query: a
    desktop window from about 990 px, a tablet's column), every word still
    on the page, as CC BY asks. A link to `#contact` lands its head below
    the roll's sticky top fade (`scroll-margin-top`), never dimmed under it. Then THE END and "Same time
    tomorrow?". No job and no side project is named there (tested): STATS,
    the career city and the cinema tell them.
- `src/hooks` — SSR-safe media query hooks.
- `src/lib` — small shared helpers: `onScreen.ts` says what an
  IntersectionObserver counts as on screen (an edge that only touches the
  viewport does not, which is where Skip leaves the hero); `hash.ts` reads
  the id a URL fragment names; `reveal.ts` asks a deep link's target to
  show itself before the page lands on it (STATS opens the tab it is in);
  `navigate.ts` (`goTo`, tested) is the one way the page moves when it is
  not her scrolling: in-page links, deep links and fragment changes
  (`PageEntry`), back to top, the STATS tabs, Skip, Esc and End, the
  still hero keeping her place, the loading screen starting at the top.
  It moves Lenis and the page together (Lenis re-measured and stopped,
  the page moved, Lenis stood where it landed; never Lenis' own
  immediate `scrollTo`, which drops the next native scroll event): a
  native jump Lenis misses (it drops the scroll event after its own
  landing) left it behind, and one notch after the STATS booth took her to the cinema the
  page flew back up to the hero's end. A move past the hero opens its
  walls first (the hero registers itself as the passage), as the focus
  moving past it does, so the frontier never pulls back a page that is
  legitimately past the hero. Focus goes with `focusInPlace` (never
  scrolls; a target that cannot take the focus can while it has it).
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
  state (picture, scroll, the page's own offset, Lenis' target and state,
  the wall in px, frontier, active card and its opacity, the beat
  playing, pace, pressure, readout mode, the wait, its dwell and her
  rhythm, the hold note, cues, the title's settle, `quiet`, the tick's own
  cost in ms). Delete it after use: it grows
  forever.

## Conventions

- CSS Modules + tokens. No Tailwind.
- A section with a looping CSS animation (bulbs, the booth's ring) carries
  `data-loops`: `PauseOffscreen` (in `HomeMain.tsx`) pauses
  every animation in it while it is off screen, so it costs no style pass a
  frame during the hero.
- Where the page starts once she is in is `PageEntry` (in `HomeMain.tsx`),
  once the loading screen has given `<main>` back: a deep link
  (`/en#contact`) lands on its target with the focus through
  `lib/navigate.ts`, which opens the hero's walls on the way past it (a
  target in a closed tab opens it first, `lib/reveal.ts`); otherwise the
  keyboard starts at the top of the page (skip link, radio, languages,
  then Skip). It also takes every same-page link (`a[href="#..."]`, a
  plain click no handler has taken) and every later fragment change the
  same way, the address naming the target as the browser's jump would.
  Never move the page with `scrollIntoView`, `window.scrollTo` or a bare
  `lenis.scrollTo(..., { immediate })` next to a native jump: use `goTo`.
- The page controls (RADIO, EN/ES) are fixed at the top right
  (`components/PageControls.tsx`). Over the hero's picture they float on
  their own glass; anywhere else they sit on one backing (`data-backdrop`,
  the `controlsBackdrop` token, opaque, drawn around them so they never
  move), so the text of STATS and the credits never shows through. An
  IntersectionObserver whose root is the line of pixels at their bottom
  edge (`lineRootMargin`) watches the scene's wrapper (`data-scene` in
  `HeroCanvas.tsx`): no work per frame. They ask again on every new path,
  since a client-side navigation (the 404's way back) keeps the layout
  that holds them. `html`
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
  through React state. `HeroStage` writes `target` from the page scroll
  (the frame reads the page's offset after Lenis has written it, and no
  element geometry; the stage is measured when the viewport changes),
  clamps it to the story frontier into `value`, and `useFrame` reads
  `value`.
- `lenis` is pinned on purpose: `gateInput` and HeroStage's gate rely on
  1.3.26 internals, and `scroll/lenisContract.test.ts` guards them. Re-check
  them before an upgrade.
- Respect `prefers-reduced-motion`: no Lenis, no intro animation, static camera,
  `frameloop="demand"`; the hero is one still screen and the script follows
  it as running text (no scrolling over a frozen frame). Switched on or off
  mid-visit, she keeps her place.
- Quality tiers come from `useQualityTier` (viewport + pointer heuristics, no
  network calls). The low tier drops the pier, chromatic aberration,
  depth of field and the clear coat on the driver's lenses, and renders a
  smaller environment cube.
- Deterministic layouts use `createRandom(seed)` so screenshots are stable.

## Content map

Each thing is told in full in one place; everywhere else gets at most a
link or a wink (a name or a nod in passing, never a retelling). The
sections were built one task at a time, each wanting to stand on its own,
and together they told the career four times and the side projects three.
Before writing copy, find the section that owns it here.
`src/i18n/contentMap.test.ts` holds both dictionaries to the map: a side
project's repository is named only under `projects.*`; an employer or a
client only in the career index (`stats.missions.items`) and the career
city's `work.*` keys, and so is the army's unit or service (Batallón de
Zapadores XVI, Ejército de Tierra / Spanish Army); Gran Canaria only in
`hero.lines`, on the STATS map's inset (its name, and the map's text
alternative that describes it) and in the career city's `work.*` keys,
where the army's posting is a fact, not the joke; the cardboard box only
on the STATS map; "from the sofa" once; Madrid never. Widen an allowance only with a comment saying why. Baked text (the
posters' billing blocks in `posters.mjs`, the city's canvases) is outside
the dictionaries and the test: hold it to the map by hand.

What each section is for, and what it owns:

- Loading screen — the trailer: how to drive and what is on the radio. It
  owns the controls, the stations and trivia about the shoot that no other
  section tells; it gives nothing away.
- Hero — who he is, in six lines: his name, his role, Tenerife, and the
  army story with the Gran Canaria joke.
- THE USUAL SUSPECTS — him at home: the four cats, the complaint and Dante
  as the culprit.
- The career city (still to come) — the career, once and whole: the five
  jobs (employer, role, years, clients, stack, a link) and the army's
  facts (the unit, Las Palmas).
- STATS — him off the clock: the hobbies (the map's winks, the sheet, the
  bars, the records). The career only as an index: the main missions, LIVE
  and, with the city, links to its stops.
- The cinema — what he makes for fun: the four side projects, each linked
  to GitHub.
- The end credits — the close and the contact: the cast, the licences, the
  typefaces, what the site is built with, one list of his toolkit, and
  the GitHub and LinkedIn tickets.

Each subject, who tells it in full, and what the rest may do:

- The five jobs: the career city (until it lands, STATS' main missions,
  read from `src/features/career`). STATS: an index with links. The
  credits: nothing.
- The army's facts: the career city. The hero: the anecdote only. The
  STATS map: the first badge, in the Gran Canaria inset, with no joke.
- Tenerife against Gran Canaria: the hero. Nowhere else.
- The side projects: the cinema. STATS and the credits: nothing (STATS'
  ringing booth is a link to the cinema).
- The cats: THE USUAL SUSPECTS. Winks only elsewhere: Dante as player 2
  on the STATS sheet and in its wanted-level record, the STEALTH bar's tin
  on the STATS sheet, the culprit in the credits' cast.
- F1: STATS (the Box 33 blip, RACECRAFT and the Grand Prix record). The
  loader: the pit-lane limiter tip only. The hero: its dashboard.
- The cardboard box: the STATS map's Masca blip. Nowhere else.
- His stack: the career city (per job) and the cinema (per project). The
  credits: one toolkit list that shares no name with BUILT WITH.
- The contact: the end credits. Elsewhere only links to `#contact` (the
  cinema's box office).

## Content rules

- No Rockstar assets, logos or the GTA typeface. Inspiration only.
- Heuristik is the current employer: show the role and dates only (no
  city, no mention of remote work), nothing from its clinical projects. Skip `atlas-habits` on purpose
  (`project-atlas` is a different repo and belongs in the projects).
- The site never calls the Claude API. Generated data lives as JSON in the repo.
