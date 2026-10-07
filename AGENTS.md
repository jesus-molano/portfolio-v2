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
  proxy redirects, the deterministic city layout, the chapter cards'
  layout, the shader `pow()` rule, the start menu's tips, keys and
  picture (`loader/horizon.test.ts`: a whole road, lamps at their size),
  the content map (`i18n/contentMap.test.ts`), and the
  hero's scroll UX acceptance checks (`scroll/acceptance.test.ts`).
  Add a test for every new pure function.
- `pnpm build` — production build. `next/font/google` downloads fonts at build
  time, so the build needs access to `fonts.googleapis.com` and `fonts.gstatic.com`.
- `pnpm check` — lint, typecheck, tests and build in sequence.
- `node tools/capture/scrollux.mjs --url http://localhost:3000` — the
  browser half of the scroll UX acceptance (dev server running): swipes
  against the radio's long-press (and a thumb resting on the picture),
  the arrows, the hold note, the rewind hint, the long wait, the radio
  and its callout (kept off THE CREW's card after Skip), reduced motion
  (and back), the dash's gesture (no dash on a phone), focus, one-block
  caption cards, calm readers, the title (a tap while the name forms, no
  ghost after a short swipe), a resting thumb after a swipe back, a
  pinch, Esc and End twice, Back after a link and back to top's address,
  the loader on a phone, THE USUAL SUSPECTS' character select (`select`:
  its wall against the wheel, keys, the scrollbar dragged and its track
  clicked, swipes and a fling, and under reduced motion the browser's own
  momentum, until Jesús is chosen; Tab onto the locked way on; at 1366 x
  657, 960 x 600 and 844 x 390 the wall at the select's foot; links, Back and a fragment passing it, then free
  both ways, remembered for the visit; every other check starts with him
  chosen), the pedal (a thumb, the mouse, W and Space
  held, two fingers, blur, a lost keyup, Q, the end, reduced motion) and
  its layout from 360 x 640 to 1440 x 900, a phone's swipes and flings
  in the career city at a closed wall (every move gated, nothing past
  it, no wall opened), `cityloop` (a visitor drives the whole career
  city from THE USUAL SUSPECTS to STATS with every input in turn, its
  walls closed ahead, then, the city complete, back up into the hero's
  end and down again twice and fast both ways, with the hero's own back
  and forth as the run's reference: every frame read against the city's
  timeline, walls, cuts and car path loaded from `src/`; every card up
  for its reading time, every held beat at no less than half its pace,
  the car never jumping in sight, the set changing only under night, the
  walls staying open and the picture the scroll once complete; it also
  reports frame timing, long tasks and stalls, city against hero; the
  car is scored as the scene draws it, `carMotion.ts` replayed over the
  recorded picture; on a phone every flick's fling is held to twice what
  her finger's speed flings at 60 fps, and half a screen, and in the
  city's film to at least half of it where the page has room; `--cpu 4|6`
  throttles the CPU once she is in, a loaded phone;
  `--out` keeps the traces, `--replay <dir>` re-scores them), `shiftless`
  (the title hint, the dash's unit and the camera readout keep one box in
  every state, and her first input while the name forms, its answer and
  the way on log no layout shift at all), and the
  static page after
  Skip (wheel, trackpad and keys; swipes while a phone's bars come and
  go, in both motion modes: no section moves, nothing against her input,
  no scroll by script, no layout shift), on desktop and a phone in both
  languages. PASS or FAIL.
- `node tools/capture/capture.mjs --device both --progress 0.05,0.3,0.6,0.9`
  — renders hero frames at those film positions (dev server running) into
  `.captures/`. Look at the frames before calling a visual change done.
  `window.__vaJump(p)` (dev only) jumps the film for framing work.
- `node tools/loader/check.mjs` (dev server running; `--url`, `--only
  cls|fit|frames`) — the start menu's QA: layout shift from the first
  paint to the click (must be exactly 0, also through a slow load, the
  slab sliding and SETTINGS opening and closing, and for returning
  visitors whose station the client reads after the first paint), the
  fit matrix of fifteen viewports in both languages (tips, the menu's
  words, slab and lines, Next inside the tip card, no box over another), the menu's keys (↓ S W, a way in chosen
  too soon, Esc back to SETTINGS), and frames of every state (loading,
  slow, ready, CONTINUE selected, SETTINGS open, leaving, reduced motion)
  in `.captures/loader/`, and SETTINGS scrolled (`--only scroll`: a
  finger on phones, the wheel in a short window; Lenis is stopped under
  the menu and cancels every wheel and touchmove it sees, so the dialog
  carries `data-lenis-prevent`). Look at them before calling a change done.
- `node tools/capture/settings-touch.mjs --url http://localhost:3000` —
  STATS's SETTINGS tab under a finger on phones: swipes from the stations,
  the volume and the subtitle sizes scroll the page and leave the volume
  alone (`settings/rangeGuard.ts`), a tap on the track still sets it.
  PASS or FAIL.
- `node tools/capture/pause.mjs --url http://localhost:3000` (dev server
  running; `--lang`, `--device`, `--frames <dir>`) — STATS's pause in the
  browser: the world frozen and the menu settled as it crosses the middle
  of the screen and back on leaving, no layout shift, nothing animating
  once settled, reduced motion; with the radio on, the bus's cutoff and
  duck and a blip each way; with it off, no AudioContext at all. PASS or
  FAIL; `--frames` saves a strip of the entrance.
- `node tools/capture/radiowheel.mjs --url http://localhost:3000` (dev
  server running; `--lang`, `--sizes`, `--json <file>`, `--shots <dir>`)
  — the radio wheel's centre on phones, upright and on their side, from
  320 px to a big iPhone (any size under the full wheel): every
  sector selected and tuned (every track it can have on air), each line
  of text and the status pill 4 px inside the disc, no word broken, one
  name size, 44 px badges, radio off's symbol lit when selected. PASS or
  FAIL.

## Stack (pinned on purpose)

- Next 16.3 App Router, React 19.3, TypeScript 6.0 (not 7: typescript-eslint
  does not support it yet), ESLint 9 (eslint-plugin-react does not support 10).
- three `~0.186` (postprocessing requires `< 0.187`), `@react-three/fiber` 9,
  `@react-three/drei` 10, `@react-three/postprocessing` 3.
- GSAP 3 + `@gsap/react` for timelines and ScrollTrigger; Lenis for smooth scroll.

## Structure

- `src/app/[lang]` — root layout and pages. Every route lives under the locale.
  The home page runs, in order: the hero, THE USUAL SUSPECTS (`#suspects`),
  the career city (`#work`), STATS (`#stats`), the finale's cinema (`#projects`) and the end
  credits (`#credits`, with `#contact` before their fine print), each
  section after the hero headed by its chapter card (`src/components/ChapterCard`).
  `HomeMain.tsx` renders them, so `anchors.test.ts` can render the page in
  both locales: every
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
    no further, and the gate flies it itself, read at a 60 fps frame
    from the finger's own speed on the events' clock, `gate.ts`
    steadyFling, nothing once the finger lifts 40 ms after its last move:
    Lenis flings |its last frame's move|^1.7 from a velocity set in its
    frame, so on a loaded phone a frame's coalesced moves made the same
    flick fly four to seven times as far, from the career city to the top
    of the hero, and once a frame took 40 ms the lift came in the same
    task as the last moves and the flick flew almost nowhere; and every move of a stroke is cancelled, by Lenis or by
    the gate: Lenis drops a move with nothing vertical in it, a still
    finger's coalesced move or a pressure change, before it cancels it,
    and a move nobody cancels hands the rest of the stroke to the
    browser's own scrolling, past every wall; `lenisContract.test.ts`;
    below the hero, every wall open (the career city's too: a closed one
    there is gated like the hero's, and a fling's momentum within 1.5 s
    of the lift is still hers, never navigation), a stroke is the
    browser's own from its first move, `gate.ts` browserStroke: nothing
    to gate there, and
    the browser, not Lenis, owns a phone's bars and its momentum, but
    for a stroke that starts in the career city's pinned film, which
    Lenis drives as it drives the hero's, its walls open or not, so the
    film follows the finger in the frame that draws it; and with every
    wall open, a finger landing on the browser's own fling stays the
    browser's wherever it lands, or the fling ran on under Lenis' stroke
    and moved the page against her finger; a key
    that scrolls the page there stops a wheel's glide, `keyScrollsPage`,
    or Lenis swallowed it or yanked the page back),
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
    forward at a wall as a push. A finger that has come to rest (under
    3 px its way in 150 ms, on the events' own clock) lands still again,
    and moves the page again only past 12 px: after a swipe back, a thumb
    left on the glass rolls a few px as its pad flattens, and followed,
    REVERSE stayed up as long as it rested; lifted after resting, it
    flings nothing. Nothing is lost: starting, turning or going on from
    rest, the stroke scrolls the finger's whole travel. Two fingers on
    the picture (a thumb on the pedal does not count) are the browser's
    pinch zoom, never a stroke: the gate cancels none of their moves and
    Lenis drops them before it would, until every finger has lifted, and
    they are no tap on the picture either. Held input
    is never silent, and answers in the next frame: it bounces the card
    (`elastic.ts`), raises the world's pace (`throttle.ts`: the drive
    distance step runs x1 to x2; `drive.speed` stays 18 and nothing ever
    runs backwards), except while an unread line holds the film: then
    the pit limiter caps the pace at 80 km/h (x1.235, `LIMITER`; a car
    arriving faster brakes to it in under a second) and the push shows on
    the dash, the card's bounce and the note instead. Every input of hers
    shows on the dash (`scroll/dash.ts`, pure and tested; an F1 wheel
    display, `aria-hidden`): 15 shift lights for her throttle (eased up
    in 0.05 s, down in 0.3 s; a notch lights three in the next frame and
    flares the strip), the speed in km/h in three fixed cells (no leading
    zeros), and one word: YOU DRIVE, FLAT OUT, LIMITER with an 80 sign
    whose ring is the card's own reading bar (`readFill`, the same 1/50
    steps), ALL CLEAR for 0.8 s the frame the line's wall opens (the cap
    lifts with it, so a car still pushed leaves the pit lane; a rewind
    never opens a wall), REVERSE, or her gesture once the car waits for
    her (the transport's WAITING). Cyan is spent on the limiter only. On
    wide screens (`DASH_MEDIA`, the same queries in the CSS) it sits
    bottom left and wakes dimmed with the title hint; on tall screens it
    takes the sky under the page controls once the title has gone (the
    radio's one-time callout hangs below it, never in its place); other
    landscape windows put it top left. Nothing else sits in that corner:
    no name block, no site title (the owner's call). A phone
    (`DASH_MEDIA.phone`: a touch screen under 600 px wide upright, or
    under 501 px tall on its side) has no dash at all, the owner's call:
    up there it pulled her eyes off the subtitles. What it said is said
    where she looks: her turn by the read card's marker and the
    between-card cue in her input's words, "let the man finish" over the
    card, the reading bar under it, and the pedal's own treads (her foot,
    the limiter's cyan and gate while she holds it); nothing else
    replaces it (`acceptance.test.ts` runs phone visitors with
    `layout: "phone"`). Tablets and desktops keep it. Under reduced
    motion and forced colours it is not shown (its meaning is in text),
    and the camera readout is `aria-hidden` decoration like it (it
    keeps its widest shot label's width, every label in one cell, so
    anchored right it never shifts at a cut; its status line is one line
    tall, said or not, so the unit centred beside it never drops as the
    dash goes; `layoutShift.test.ts`).
    The tick only writes attributes and custom properties, and only what
    changed; Skip's patience reads her demand (`pushingHard`), not the
    capped pace, so "In a hurry?" still comes at a line. No gear letter (a
    "D" read as the WASD key) and no video-player words or glyphs anywhere
    (play, pause, fast forward, rewind, timecode): the hero must never
    read as a video playing on its own.
  - The pedal (`scroll/pedal.ts`, pure and tested; `Pedal.tsx`, a real
    `<button data-pedal>`; W or Space on a keyboard) is a second way to
    drive the same scroll, never a replacement, on the same engine: its
    push goes through the same gate and walls, and like every input of
    hers it reads where the page is before Lenis moves (`lenisMissed`, at
    its press and before each push), so a native move Lenis missed never
    sends the page back. It is not a finger's stroke: the 8 px slop is
    for touch strokes on the picture, never for its push. A press plays the next
    line exactly as Space or a tap does (a knock on an unread one), holding
    keeps driving after it (its push runs before `lenis.raf` through
    `scrollDrive`, trimmed at the frontier and at the hero's end, at up to
    0.8 screens a second, spooling up from 0.4 in 0.35 s), and letting go
    stops the picture within 0.2 s (`PEDAL.lerp`) or as the press's line
    step lands. Her foot is input every frame (`recordPedal`: never her
    turn while it is down) and drives the strip and the pace, but not the
    meter: at an unread line a held pedal knocks once on arrival and then
    rests on the limiter (armed, 80 km/h, ALL CLEAR lifting the cap as the
    line is read), so it never brings up the note or the Skip offer; taps
    and fast pumping knock like Space and do. A finger or the mouse back
    on it within 150 ms of a hold's release continues that hold (a
    tremor, a rolling thumb); a key pressed again is always a new press;
    a press under 220 ms is a tap. It lets go on pointerup, pointercancel,
    a lost capture, blur, a hidden tab, pagehide, a W or Space whose
    autorepeat went silent for 0.6 s (a lost keyup), the radio wheel
    opening, Skip and focus leaving the hero. A backward input suspends
    its push (`suspendPedal`), and her foot is no input meanwhile (the car
    coasts, the dash never reads FLAT OUT over a still picture): under a
    key or the mouse it drives again 0.3 s after she stops going back (W
    held through a tap of S), under a finger at her next press (a second
    finger went back to read; her turn comes, in that swipe's words).
    W is matched by its physical key (`code`, so AZERTY's
    Z drives; the keycaps show the layout's letter); Space keeps its
    pointer-focus rule; Enter on the focused pedal is a tap. Its six
    treads are the shift lights in miniature (`--lv`, sodium, orange,
    magenta; cyan with a gate under the limiter, a warm sweep on ALL
    CLEAR, a pink tread on her turn, HOLD / PISA on a long wait when her
    last input was not the pedal, left of the plate's lower half on a
    phone, off the marker's row; above it in landscape, and on hover with
    a mouse once the title's hint has gone). On tall
    screens it takes the thumb's corner with Skip bottom left, and the
    subtitles, the cue and the hint stand 12 px above its plate (the
    shots keep his head above a two-line card there, `shots.test.ts`);
    on compact ones the subtitles narrow between Skip and it; on wide ones
    it mirrors the dash bottom right with a W keycap on its hinge, Skip
    just left of it (`--va-pedal-fs` and its anchors per layout, in the
    `DASH_MEDIA` queries). A finger on it never scrolls (its touches are
    cancelled and stopped; `gateInput` ignores them too), never arms the
    radio's long-press and never opens a menu; at the end of the drive it
    stands over the fade to night, where the way on names it, and a press
    glides into the line-up. Held there, it rests (no input: the way on
    comes up under her foot) and after 2 s (`PEDAL.endHold`) goes on
    into the line-up as a press would. The glide lands like Skip, through
    `goTo` (`lib/navigate.ts`, with a 1.2 s glide): Lenis starts from the
    page, the walls open on the way past, the pedal lets go and the
    line-up takes the focus at once, and once the page has
    left the hero the pedal is gone and ignores presses. Hidden under
    reduced motion; kept, in system colours, under forced colours. Every
    "how to go on" speaks the pedal (its glyph, "Hold" / "Pisa") once it
    was her last input.
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
    handing over is not her turn); the transport says WAITING (the dash
    asks with her gesture), and only then does the read card's marker bob
    or a cue say how to go on, so nothing asks for more next to YOU DRIVE.
    The car brakes, from half a second into the wait, to a crawl (x0.2, 13 km/h; x0.35 still read as
    driving); after 4 s of waiting it crawls lower (x0.15, 10 km/h) and
    the marker or cue asks again. That brake, and the car getting going
    again on her next input, tells her she drives more than any label.
    Hysteresis keeps it calm: a visitor with a steady rhythm (gaps up to
    7 s) gets a little more than her own beat before WAITING
    (`waitIdleFor`, up to 5 s: a notch every 2.5 to 5 s never sees it);
    a pause she ended within 1 s of WAITING answered it and is no beat of
    hers (`rhythmAfter`), so a visitor who waits to be asked is asked
    again as soon as the first time, never later and later, a
    light push gets the car up from the crawl like a car (a hard one still
    surges at once), and FLAT OUT needs full throttle held for 0.6 s and
    lets go only under x1.45. The feedback runs on real time (only the
    reading clocks are capped), so a slow device neither scolds sooner
    nor keeps a state up longer.
  - The way on is one glyph per input type, the same in the hint, the
    card's marker, the dash, the between-card cue and the way into the
    city: up for a finger (swipe up), down for the wheel and the keys, a
    mouse with its button lit for a click on the picture (the dash shows
    the wheel as a mouse, and the keys as W and Space keycaps), bobbing
    the way it points. Each card is one solid block around the whole line
    (never a pill per line), balanced (`text-wrap: balance`, no word alone
    on a line) and as wide as its widest line (`cardFit.ts`, applied by
    `fitCards.ts`, the one fitting of every card: the hero's and the
    career city's; measured with the viewport, once
    the fonts have arrived and when the subtitle size changes, never in
    the frame); the reading bar and then the marker sit under the block,
    never in the text. Her first
    input is answered in place of the title hint ("You have the wheel",
    which replaces the "you drive" line under it: never more than two
    "you drive" messages on screen at once, counting the dash's YOU DRIVE
    and the pedal's tag) while the name forms and holds, with why the
    road still waits ("Easy, the name's still pulling in"), and 2 s
    after; Space or a tap pressed
    then plays the first line once the name has formed. Once the wheel is
    hers nothing asks her to take it again: resting on the title (after
    that answer, or rewound there) brings "keep driving" into the hint's
    place, centred in what is left of the bottom bar. The hint's
    messages hold fixed cells of one two-row box (the ask, the answer and
    the way on in the first, the model line and why the road waits in the
    second) and swap by visibility, so none re-centres another (a layout
    shift); the answer alone stands in the box's middle by a translate.
    Resting
    mid-dissolve, the title finishes its fade on time
    (`settleTitle`) instead of hanging there as a ghost. A card coming up
    hides the between-card cue at once. Cards fade on time (0.25 s in, 0.2 s out); a
    card's reading clock counts only frames that showed it fully opaque,
    and frames are capped at 0.25 s, so a device down to 4 fps reads at
    real time and a rewind never shortens a line. Wherever the picture
    rests, a card, the hint, the between-card cue or the way into the city
    says how to go on (tested), in the words of her last input (scroll,
    swipe, Space or W, a click, or the pedal). Space, PageDown, a click or
    tap on the picture or a press of the pedal play the next line (held,
    Space, W and the pedal drive on); at the end of the drive any of them
    glides on into the line-up (a control focused by a pointer,
    a press or release in the last
    second with no key since, does not keep Space, and stays so when a
    dialog hands the focus back to it, closed by a click or by Esc, until
    a Tab: the radio button clicked open never reopens on Space; one
    reached with Tab keeps it, even right after a click). Skip (shown from
    the title hint on), Esc and End cut to the end (and so do Ctrl+End
    and Cmd+Down, as Ctrl+Home and Cmd+Up act as Home: the browser
    animates those jumps, and the next section flashed before the gate
    pulled the page back): the page lands with `#suspects` at the top and
    that section takes the focus (it has `tabIndex={-1}`;
    `anchors.test.ts` checks it follows the hero). Pressed again right
    after (Esc Esc, End End) or held, they go no further than the
    line-up (`skipSwallowed`: the second End scrolled natively to the
    credits); Esc while the radio wheel is open only closes it, wherever
    the focus is, and an Esc right after that does not skip the film. Focus
    leaving the hero opens the walls, and so does any move of the page
    past it that is not her scrolling (a link, a deep link, Skip:
    `lib/navigate.ts`). A viewport change (rotation, resize) keeps the
    film where it is; a phone's bars coming and going change nothing the
    film measures (its length is the stage less one stable large screen,
    `lib/screen.ts`), so they never move the page. And reduced motion
    switched on mid-film keeps her place: the line she
    was on shows in the running script, and if motion comes back the film
    resumes exactly where it was (she has not scrolled), at the line she
    reads, or at its end once she has read past the script. The frame
    allocates nothing but the strings of what changed. The hero marks the
    scene `settled` once its first line has been read and she rests (or
    the walls open; the still hero once its title is scrolled away), and
    `quiet` while nothing on screen asks her for anything, and `onStage`
    while its film is not over (p < 1, or the still script filling most
    of the screen); `onScreen` says the hero is up in the top fifth of
    the screen (an IntersectionObserver): side hints, like the radio's,
    wait for all four, never share the screen with a prompt and never
    hang over the next section's chapter card (after the end of the
    drive, Skip or a deep link). `scroll/film.ts` only lays the cards out on the film
    (`buildTimeline`).
  - Film progress cuts between the shots in `scene/shots.ts`; `CameraRig`
    evaluates the pose. `HeroStage` draws the title, letterbox, subtitle
    cards, HUD and fade to night from the same film position every tick.
  - Subtitle cards come from `hero.lines` in the dictionaries: one array of
    cards per line, at most 64 characters each (tested). Each card is a
    complete thought in his own voice (a film nod only if it reads as plain
    speech); split a line only when the pause is the joke, since every card
    is a wall the visitor waits on. Every card shows "Jesús:"; a screen
    reader hears it once per line (the later cards' name is `aria-hidden`,
    and so is the live line a key steps to), and nothing else repeats it.
    `LINE_SHOTS` in `scroll/story.ts` says which shot each line
    plays in; card timing is computed, never hand-placed. The hero's UI copy
    (`hero.intro`, `hero.osd`, `hero.pedal`, Skip) has length caps per chip
    (`i18n/dictionaries.test.ts`), and every dash word fits its slot
    (`scroll/dash.test.ts`).
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
    his name and his role, then two ads for stations on the dial (MANERO
    97.7, TOFU 107.6), a hint at the radio; nothing else (tested), the
    same in both languages. The first two repeat the title on purpose. They
    stay unlit while the title is up and switch on one after another as it
    leaves (`neonLevel`). `sightCap` keeps every
    building under the sightlines to the boards, and the layout tests cast
    rays (`sightlines.ts`) so nothing hides a board or the tower's crown.
  - The sky is a dome centred on the camera with a direction-based gradient,
    so no shot sees an edge.
- `src/features/music` — the radio, GTA style. `stations.ts` (pure, unit
  tested) holds the genre stations, each a short playlist, in frequency
  order, each a nod to a film: BOBSLED 88.3 (reggae; Cool Runnings),
  RAHEEM 92.9 (hip-hop; Do the Right Thing), MANERO 97.7 (disco and funk,
  the default; Saturday Night Fever), ONE LOUDER 101.1 (metal; This Is
  Spinal Tap), WITNESS ME 104.5 (rock and punk; Mad Max: Fury Road), TOFU
  107.6 (drift phonk; Initial D). A station
  without tracks stays off the wheel and out of the credits. Every station
  runs on a clock (`livePosition`), so tuning in lands mid-song; the
  playlist loops. `player.ts` plays it on `<audio>` decks, fetches only the
  track on air (the next one in its last 20 s), crossfades through a Web
  Audio burst of tuning static and pauses while the tab is hidden. The
  decks play through one Web Audio bus (a low-pass and a gain, built in
  the gesture that first tunes the radio, a deck joining it only once the
  AudioContext runs: routed into a stopped one it would go silent), which
  only STATS's pause moves; without it the pause ducks the deck's own
  volume. The tracks must stay same-origin, or the bus plays silence.
  `radio.ts` is the store (useSyncExternalStore) and remembers the last
  station or "off" in localStorage. The start menu's NEW GAME plays
  `entryChoice`: what she cued in the start menu's settings
  (`cueEntry`, nothing sounds before she enters; kept for the visit in
  sessionStorage, so the other language keeps it), else `entryStation`
  (the remembered station live, or the first time MANERO from the top
  of Honeyed Sunbeams), on even if CONTINUE saved "off" last time; with the
  radio cued off it enters in silence. Its line names the same station,
  or "Radio off". `RadioWheel.tsx` opens by holding the right mouse button over
  the scene, holding or pressing Q, a long-press on touch, or the music
  button (`RadioButton.tsx`, the obvious way in on touch). The long-press
  never steals a swipe (`touchHold.ts`, tested): it arms after 0.6 s held
  within 8 px (a ring under the finger; the scroll stroke's own slop, so
  whatever the stroke scrolls is no long-press), opens as that still
  finger lifts while the ring is up, and any movement, scroll input (the
  other thumb on the pedal too), a second finger (a pinch, a thumb on the
  pedal) or a page still in motion cancels it. Held past 2.5 s it is a
  thumb resting on the picture while she reads: the ring goes, and
  lifting opens nothing. While the wheel is open it keeps every scroll and swipe to itself
  (the mouse wheel browses the dial; a finger closes it with a tap on the
  backdrop, never with a swipe), and the drive slows down
  (`hero/scene/timeScale.ts`, not under reduced motion). The long-press is
  timed by the touch events' own timestamps, so a slow frame never turns a
  tap into a hold. The button's first-visit callout waits until the hero
  has settled and is quiet (a line playing, no prompt up), steps aside
  when the hero asks her something, and hangs below the camera readout
  while the button glows (on tall screens below the dash, which stays
  up; a phone has no dash, and the callout takes the sky it left); a tap
  on it opens the wheel ("Tap here for the radio" on touch).
  It is the hero's alone (`data-side-hint`): it shows only while the hero
  runs down past its bottom edge and 8 px more (`sceneLoading.onScreen`,
  asked of the line of pixels there) and its film is not over
  (`sceneLoading.onStage`: p < 1, or the still script filling most of the
  screen), since past it (the end of the drive, Skip, a deep link, a strip
  of its night left at the top after a little scroll back) it would cover
  the next section's chapter card. Radio off sits at
  the bottom (its power symbol lit cream while selected); every sector
  stays a 44 px target on a 360 px phone and on a phone on its side,
  where the hint stands beside the wheel so it takes the height
  (`wheelGeometry.ts`, tested; its column at most a third of the
  screen, so a big text size wraps the hint instead of squeezing the
  wheel). On every wheel under the full 600 px (phones up to a big
  iPhone, short or zoomed windows) the centre's type scales with the
  disc (`CENTRE_TYPE`), one name size for every station, so the station
  on air, its track and status sit 4 px inside the rim
  (`tools/capture/radiowheel.mjs`); a rem floor there put WITNESS ME
  across it. A longer name, tagline or credit than `CENTRE_BUDGET` is
  measured again. Station
  logos (`StationLogo.tsx`, drawn by `stationBadges.ts`, pure and
  tested) are our own illustrated badges in one frame family (an enamel
  rim in the station's accent, a gloss, grain, the frequency on a tab),
  each with its own mark and lockup, readable at 44 px and rich at 180
  px; every colour a `radio` or palette token and every face a
  `radioFonts` token, set through `style`: no trademarks, no film
  stills, no copied logos. Names stay as written in both languages;
  taglines live in `radio.taglines` in the dictionaries.
- `src/features/loader` — the loading screen, made a game's start menu
  (the owner's call): no name and no role on it (the hero shows them once
  she starts), three huge items in the marquee face (`loader.menu`): NEW
  GAME / NUEVA PARTIDA (in with the radio: the station chip under it, or
  "Radio off"), CONTINUE / CONTINUAR (in without music) and SETTINGS /
  CONFIGURACIÓN; a game tip card (bottom right; under the menu on a
  phone), the languages top right, and the load as a status line, a
  percentage riding the progress line on the bottom edge, the sun
  sinking and the causeway's lamps lighting toward the city.
  - The menu (`menu.ts`, pure and tested; `LoadingScreen.tsx`) is a list
    of real buttons, each named by its word and described by its line.
    The selection is a painted slab (magenta to amber, skewed, an ink
    block shade) that slides to the item and is the keyboard focus: ↑ ↓,
    W S by their place on the keyboard (`code`, so AZERTY works), Home
    and End move the focus and the slab; a mouse over an item focuses it;
    Enter or Space (the button's own) or a tap chooses. No other key
    starts anything (no "press any key": `menuMove`). NEW GAME has the
    focus from the start. The two ways in wait for the scene ("waiting
    for the city", the slab filling with the load under a selected one);
    chosen too soon the slab shakes and the live region says "not yet". A
    slow wait (`isSlow`) offers them early ("go now", in the items' lines,
    the status line and the tip card's slow note). The slab is measured
    once the faces are in (`data-measured`) and only then shown; the
    marquee face is preloaded for it. The hero ignores the key that
    entered (KEY_GUARD_MS).
  - SETTINGS opens the same settings as STATS's pause menu
    (`features/settings/Settings.tsx`, `where="start"`) in a native modal
    dialog: focus kept inside, Esc or Back return to the menu with the
    focus on SETTINGS. All of it works before she enters: the radio is
    only cued (on or off, the station: NEW GAME's line follows), the
    volume and the subtitle size are stored as she sets them, and the
    other language reopens the settings there; it applies when she
    starts. STATS's pause-only row (its tabs' shoulder keys, `only:
    "stats"` in the dictionaries) is not shown there.
  - The picture (`horizon.ts`, pure and tested; `Horizon.tsx`, a server
    component passed in as `art`, so its geometry never ships to the
    client) is the causeway at sunset, drawn as SVG from the tokens with
    one pinhole camera 14 m over the sea, so every element has its size
    (the owner: "que tenga sentido"): a whole road from below the
    picture to the vanishing point at the city, both edges, lane marks
    and parapets; lamps every 34 m on its right parapet that shrink with
    distance, each with a pool on the road and, past the deck's edge, its
    reflection on the water; the sun and the city on the horizon; a far
    islet whose palms are a few pixels tall, in two uneven clumps leaning
    both ways, with low bushes; and two whole coconut palms on a headland
    on the right (its coast running on to the horizon under the city, lit
    sand along its waterline), their feet on the sand and their crowns
    above the city, inside every window each layout fills (the tests
    slice the picture as the CSS does: a phone on its side, a 200 %
    zoom, a 360 x 640 phone). Two layouts in the DOM, picked
    by the same media queries as the menu: `wide` (sliced from the right)
    and `tall` (as wide as the screen, its horizon placed above the menu,
    fading into the night under it). Under forced colours the picture is
    not drawn (SVG keeps its own colours there): the menu and its focus
    ring sit on the system's background. Motion is CSS on the drawing: the sun sinks and the lamps
    light with the load (`--p`), the windows come on when the city is in,
    stars twinkle, clouds drift, the water glitters, palms sway, birds
    cross, the grain steps 24 times a second; under reduced motion all of
    it rests (sun down, lamps lit).
  - No layout shift, ever: the loader is a size container and every box
    is placed against it with a fixed size (`cqw`, `cqh`: the menu's
    height is its rows', the card's its reserved lines'), every state of
    every line and every tip is in the DOM from the first paint, stacked
    in one cell, and phases switch only opacity, visibility, transform
    and inert; device and motion choices are media queries, so the
    server's HTML paints the right layout and first tip. The page under
    the screen stays `visibility: hidden` until she chooses (CSS from the
    first paint): a late web font reflows the hero's title under it, and
    Chrome counts hidden-from-view shifts too. `tools/loader/check.mjs`
    measures it.
  - Tips are `loader.tips` in the dictionaries: `{ kind, when, text }`,
    `kind` `tip` (how to drive the site) or `trivia` (a joke about the
    site or him), `when` any of `pointer`, `touch`, `motion` (all must
    hold), so a phone never reads about the mouse and reduced motion never
    reads about driving. The same kinds and conditions at every index in
    both languages, 120 characters at most (the card reserves the lines),
    `tips[0]` a tip with no device condition, all six stations named, and
    no tip retells a hero line (the film's beats are the film's) or gives
    away a later section (the cats and the character select, STATS' bars, map
    and achievement tree, the cinema, the credits; tested). Nothing promises what
    is not on the page yet: the career city's tip ("a sign for every
    employer") comes back with the city. Every trivia is true of the site
    (no photo anywhere: everything is drawn, rendered or computed; the
    driver's beard and hair groomed by a script; every city sign painted
    in the browser in the site's fonts; the sky computed every frame;
    every station keeps its own clock; every palm grown from a seed, the
    same on every visit: the owner's pick of "cooler" trivia), and so is
    every tip: the touch
    radio tip names a still finger on the picture, not the pedal, until
    the ring shows, then lifted (`touchHold.ts`; tested). Natural
    sentences, never telegraphic. `tips.ts` orders them (`tipOrder`: the
    first card, then her tips in authored order alternating with shuffled
    trivia) and times them (`tipDuration`: reading time plus 1.5 s, at
    least 5 s); hover or focus holds a tip, Next skips it.
- `src/features/work` — the career as a night drive (`#work`). A pinned stage like
  the hero's: the scroll is the picture, `workTimeline.ts` lays the beats
  out (a share of the film per natural second, cards timed by
  `readingSeconds`), `workStory.ts` holds them with the hero's walls
  (title, holds, cards). The stage writes its wall to `stageGate` and
  SmoothScroll trims input to the smaller of it and the hero's. A jump
  past the wall with no input (anchor, find in page, scrollbar, a screen
  reader) is navigation (`isNavigation` in `lib/navigate.ts`, shared with
  the hero): it opens the walls up to where it landed, never snaps back;
  the stage registers itself as a passage (key `work`), so `goTo` opens
  it up to a stop it lands on, or all of it on the way past. Every stop
  is a real article (`#work-army` ... `#work-heuristik`) placed at its
  stretch of the scroll, with heading, years, the mirror text, the
  transcript and one chip: the employer's site (`stops.ts`, per locale;
  ids, order, anchors and years come from `features/career/career.ts`)
  or, for the army, the `#service-record` popover. On a phone the chip
  stands over the stop's tallest card (`chipPlace.ts`, measured when the
  cards are fitted, written as `--cards-h`), placed from the pinned
  frame's bottom (`100dvh`), so neither the browser's bars nor a card of
  three lines at the large subtitle size ever puts it on the subtitles;
  on its side, the bottom row between Skip and the pedal. Under reduced motion
  and without JS the stage is plates. Boards arm before they open
  (`hotspot.ts`): a real pointer move, a first tap, or focus on the chip;
  the hotspot is a DOM element clipped to the board's projected quad,
  and the aim's corners follow that quad by transform only (container
  units of the frame, never `left`/`top`: a layout shift per move;
  `layoutShift.test.ts`).
  The film opens on the chapter card «Historia principal» / "Main story"
  (the game's main storyline, as STATS's main missions are; ribbon
  «Trayectoria · 2018 — LIVE» / "Career · 2018 — LIVE"), after a bridge
  card from the cats.
  The route at the top is one link per stop («PARADA 1…5»), never a video
  scrubber. While the car is stopped, the super shows «PARADA 0X/05 ·
  company» and, under it, the stop's one `line` (clients and stack); the
  years live on the board. The cues (scroll, swipe, click, pedal, Space,
  Skip) are the hero's own words, `common.cues`, shared by both stages.
  Its subtitle cards are the hero's (one block, balanced, fitted by
  `hero/fitCards.ts`, the reading bar and the marker under the block) and
  stand with their cue over the night cover and the dip, so the opening
  line, played as the night fades up, reads at full strength. The HUD
  names the section as its ribbon does («Trayectoria» / "Career"). On a
  portrait screen a stop whose art holds the top left of its shots puts
  the HUD and the super on the right (`phoneCaptions` in
  `night/direction.ts`, `data-caption-side`; copies on the right fade in as
  the left ones fade out, never moved there: a layout shift): PwC, whose blade's C stands
  over the readerboard, left of the car, in every reading shot.
  The city drives with the hero's pedal (`Pedal.tsx`, the same button,
  bottom right, Skip beside it, or bottom left on a phone): a press plays
  the next line, holding drives on through the same gate and walls, and W
  or Space held is the pedal too. The glue between the pedal's state and a
  stage is `hero/scroll/pedalDriver.ts` (`driveFrame` pure and tested,
  `createPedalDriver` for pointer capture, held keys, the watchdog and the
  push on the scroll's ticker through `addDriveStep`); the hero still
  carries its own copy of that glue until it adopts the driver. The
  stage's length is in the stable screen units (`--va-lvh`,
  `lib/screen.ts`) and its film is the stage less one stable screen, so a
  phone's bars coming and going never move it (scrollux `citybars`, at
  every stop with its walls closed ahead, and `statics`). Its frame reads
  the page as the hero's does (`pageScroll`), and a finger that lands in
  its film is Lenis' stroke even once its walls are open (`stageGate`
  `pinFrom`/`pinTo`, `gate.ts` browserStroke): the browser's own
  scrolling ran ahead of the picture on a phone and boosted flick after
  flick. Once complete (every wall open) the film is a free scrub both
  ways, 1:1: no wall, no held beat, no ride slows it; only the dip keeps
  its minimum fade times over a cut (below). The chapter card has a
  layer of its own (`will-change`), since its fade and rise as the bridge
  line plays repainted the whole sign every frame (100 to 400 ms frames
  on a slow device at every pass through the top of the city).
  - Pacing and continuity, as polished as the hero: every drive between
    two stops is held (`workTimeline.ts` BEAT_SECONDS: each stop's
    `open` is its arrival, each `leave` its departure, both `hold` beats;
    no `travel` beat is left, since at the scroll's density one was less
    than a wheel's notch and a stop changed in one frame). A held beat
    plays only while she drives into it (`workStory.ts`, tested): its
    wall creeps at the beat's pace while the page heads for it (her input
    trimmed there, the pedal, a press's carry), and stops `HOLD_LEAD`
    (0.25 s of the beat) ahead of a picture she has stopped; a wall that
    ran on while she rested at a cut, under the night, left the whole
    arrival open, and her next flick played it in a frame, the car
    jumping 10 m. A push trimmed at a held beat's wall rides it for 0.6 s
    (`RIDE_MS` in WorkStage, not under a finger): the page follows the
    wall as it creeps, so notches or flicks a moment apart drive the beat
    at its own pace instead of a step at a time. The car's mark
    is one continuous function of the film inside every stop
    (`night/carPath.ts` `carAt`, tested; the car chases it smoothly,
    `night/carMotion.ts`): on the first stop it rolls in
    under the bridge line as the night fades in, never stands at the
    board before it gets there; at every stop it cruises in, brakes to
    the line, waits with the brake lights on and pulls away. The stop
    changes under a dip to night (`dip.ts`, tested: the leave's end fades
    to night, the arrival's start up from it), a cut on action, never a
    hard cut; on screen the dip never plays faster than 0.3 s out and
    0.35 s back, and the set changes only once the screen is night
    (`stepDipView`: the old stop held at its edge till then), so a fast
    pass with the walls open still dissolves. The chapter card fades out
    over the bridge line's first 28 % and the chrome (route, HUD, super,
    chip) comes up only once it has gone (`opening.ts`, tested): the card
    scrolls up with the page, and faded over the whole line it slid over
    the route. The letterbox bars slide away as the first stop fades in,
    as in the hero, and soft night scrims at the frame's top and bottom
    carry the chrome; the cover's night starts and ends on the line-up's
    floor, the colour on both sides of the stage, so neither seam shows.
  - The city owns the career, told once and in full: company, role,
    years, clients, stack, link, and the army's battalion and Las Palmas.
    STATS only indexes it; the end credits carry no career. The
    Tenerife-versus-Gran-Canaria joke is the hero's. No visible text in
    the city repeats its own board (the service record, Heuristik's
    first card).
  - Copy rules (tested): roles in English in both languages (Frontend
    Developer, Full Stack Developer, Frontend Engineer; the army is
    «Zapador», «Soldado zapador» on the record, "Combat engineer"); no
    city next to a civilian job (no Santa Cruz, no Comunidad de Madrid,
    never Madrid), the client is «Retech»; no "remote"; LIVE in English
    in both locales and only for Heuristik, whose stop shows role and
    dates only.
- `src/features/night` — the night canvas under `#work`: mounted only near
  the stage (within 1.5 screens) and released only far from it (six
  screens: a pass back up into the hero's end keeps it, or the night came
  back under its cover, compiling, over the first stops), rendering only
  while it is on screen. Five sets (`sets/`),
  one per stop, all at the origin and only the active one visible; the
  street, sky, car, lights and post are shared and switch per stop (two
  point lights whose count never changes, so no recompile at a cut). Set
  frame: the car's stop point is the origin, the street runs along +x,
  the board stands at z < 0 and the camera at z > 0. It is one island at
  night at every stop (stars, a thin moon, one fog, palms along the kerb):
  he never moved, so no stop may read as another city. Lit windows are
  painted interiors (`parts/Windows.tsx`, `sets/art/windows.ts`), never
  flat blocks: each pane a room from its building's mix (`pickPane`:
  hotel, home or office; never the same lit room as the pane beside it,
  some left half lit), mirrored, dimmed or flickering like a television,
  and one reader in an armchair is the atlas' only person. A lobby is one
  room painted across its panes (`LOBBY`, the hotel's; `ATRIUM`, the
  landmark's), never a framed copy per pane.
  The car moves only with the scroll, but never step for step: `carAt`
  (`carPath.ts`) is its mark on the film, and the car chases that mark
  like a car driven smoothly (`carMotion.ts`, pure and tested; `CarDrive`
  steps it into `night.car` once a frame, before the camera, the street
  and the car read it). Read 1:1, every wheel notch, swipe or pause
  started and stopped the car, and its springs, fed that speed, dived and
  squatted the nose on every one. Its pace (natural seconds of the film
  a second; 1 is the beat's own pace) eases toward the speed from which
  it can still brake onto the mark (`sqrt(2 * brake * gap)`, planned from
  where its pace will have answered, on how fast car and mark close, with
  the curve's own braking fed forward), with bounded acceleration,
  braking and jerk: notches at a reading pace keep it rolling, it comes
  to rest on the mark rather than past it (never past the line: the path
  caps x at 0), a glide behind at most (the pedal's steady push about
  0.3 s, a thrown page about a second), on the line within a second of
  the picture. It starts backing up only once the film has run back more
  than 0.04 natural seconds (a wall's one-pixel trim under the pedal is
  not her turning back); a car backing up when she turns forward eases
  out of it onto its mark (never a dead stop, never parked past the
  line), and against her turn it brakes twice as hard. A long frame is
  integrated in 1/60 s steps (up to 0.25 s), so a slow device keeps real
  time. A cut (under the dip) is a cut on action: the car comes in at the
  pace it and the picture shared, the beat's own at most, a chase's lag
  behind the picture (`chaseLag`), so a fling never carries its speed
  into the next shot. A jump (`night.snap`), the frame loop waking (the
  stage back on screen: `night.woke`, set by NightScene; a long frame
  mid-drive is no waking, it is integrated, or a hitch snapped the car
  its whole lag, metres, in sight; `carDrive.test.ts`) or a gap of 10
  natural seconds put it on the picture at once; reduced motion keeps it there. Its body never reads that
  motion: it leans from the path's designed `lean` (the brake pedal goes
  down over the first 30 % of the braking and comes off over its last
  15 %, the throttle opens over the first 30 % of a leave), a dive of
  1.1 degrees where an arrival brakes to the line, a squat of 0.7 where a
  leave pulls away, one settle as it stops on the line, through a
  critically damped spring (no bounce of its own), shown only while the
  car drives forward at a pace (a slow mean: a pause of a breath changes
  nothing; a pause, a resting thumb or the film running backwards lean
  nothing) and still moves (a car standing still leans nothing, and a
  car that crept onto the line has no settle). The tests hold it:
  notches, a fling, the pedal and its one-pixel trims, a resting thumb, a
  pause, standing between notches, a rewind, a reversal mid-beat, a
  fling into the next stop, the cut, 4 to 60 frames a second, reduced
  motion. The camera shoots the car's own moment of the drive
  (`carMotion.ts` `framedAt`, `rig.ts` `stepShotClock`): the keys
  describe the car's drive, so camera and car never part, however far the
  car trails a fling (a damped pose of the picture's moment left the car
  up to 1.5 screen widths off a phone's frame); its tracking looks aim at
  the car as drawn (`rigPose`'s `carX`); `shot.test.ts` holds it on
  phones. The
  wheels turn with its distance, and its headlights' beams in the haze
  and their fans on the wet road sweep the street ahead (`Street.tsx`). The
  camera's direction is `direction.ts`: per stop, keys on the film,
  eased with a smoothstep (`frame.ts`; a `pass` key is curved through,
  not stopped at), so every change of framing is a camera move; the sets
  hold the geometry, not the shots. `rig.ts` (pure) gives the pose
  `NightRig` follows: a key's `track` pans the look with the car as it
  arrives, and on a portrait screen `fitPose` dollies back, then widens
  the lens (at most 70 degrees), then pans and tilts to the stop's subject
  (the board and the car at its line, never the moving car, so no fit
  breathes) inside `SAFE.portrait` (under the route and the super, over
  the subtitles), as much as the key's `fit` asks (a stop's own close
  framing is `fit: 0`; fits blend, never switch). `NightRig` takes the
  pose at the car's moment as it is (that moment already moves like a
  car), with the hero's hand-held life (and the pointer's parallax on the
  high tier, eased in like the hero's rig); a jump of the car's eases in
  at FOLLOW, and it cuts only at a cut, under the dip, or on a dev jump
  (`night.snap`). `direction.test.ts` holds it on a
  desktop, a phone and a small phone: no step of the film whips (0.5 m,
  2 degrees), a line moves the camera 3 m and 5 degrees at most (the
  framing lands before it), the car is on screen for most of every
  arrival and stops above the subtitles, every board, PwC's readerboard
  (a quarter of the frame wide), Logixs' snipe, ban and bills and
  Heuristik's name over its canopy are whole, the crane climbs at a
  crane's pace, the lit mast stays under the route, and PwC's blade never
  reads WC (P, W and C whole, or W cropped before P leaves: the marquee
  beat rises to the blade and reads it down). The driver sits in the car
  on every tier. Speed: the hero's dpr (`FULL_DPR`) and its one
  step down on a slow device (production, `PerformanceMonitor`); every
  stop's materials are compiled and its textures uploaded ahead of its
  cut (`Warmup` in `NightScene.tsx`), the next stop first. Board art is painted once per stop into canvases in
  the site's fonts (`sets/art/`). `palette.onAir` is the LIVE tally's red
  and nothing else's. Night shaders never call `pow()` (tested). Dev
  hooks: `window.__vaStage(at)` (a film position or a beat id, `id@t`)
  and `window.__vaArm(on)`; `tools/capture/capture-work.mjs` shoots them.
  `window.__vaCarProbe = []` logs the car every frame (picture, x, pace,
  pitch, stop, brake lights) and `window.__vaStageProbe = []` the picture
  every stage tick (with no WebGL the frame loop runs at the display's
  pace: replay that trace through `stepCarMotion` to measure the car).
  Delete them after use: they grow forever.
- `src/features/suspects` — THE USUAL SUSPECTS (`#suspects`), right after
  the hero: the police line-up of his four cats against a centimetre
  height chart, made a game's character select (the owner's idea):
  «ELIGE PERSONAJE · JUGADOR 1» / "CHOOSE YOUR CHARACTER · PLAYER 1"
  (`suspects.title`, `suspects.player`), five numbered plates, the four
  cats and, in slot 5, Jesús on one knee. No canvas and no looping
  animation; the client part is `CharacterSelect.tsx`, every word in the
  server HTML. One CSS length, `--cm`, is a centimetre of the chart;
  `lineup.ts` (pure, tested) turns the renders' manifest
  (`public/interlude/manifest.json`, contract in
  `public/interlude/README.md`: the cats under `cats`, their refusal
  renders under `states`, each naming its cat, Jesús at the top level with
  his model's kneeling `heightCm`, 118.5 cm; every image at the same 24 px
  a real centimetre, his rendered as a 1:3 miniature with the cats'
  camera; `figures`, or one `cats` map, are read too) into centimetres. One true scale for all five
  (the owner: «para que no haya tanto contraste… y sea más realista»): the
  chart runs to 140 cm with a line and a number every 10 cm (`CHART`), the
  cats stand at their real 27 to 39 cm at its foot and he kneels at his
  1.26 m beside them (read off the chart from his planted trainer, half a
  metre nearer the lens than his head), no scale of his own and no scale
  mark. The cats
  keep the owner's order (tested): Tom the biggest and a bit chubby, only
  just over Kira, a normal adult; Odin smaller than both, a little short
  in the leg, with a shorter tail; Dante, a kitten of six months, the
  smallest, his head the lowest. Odin is one more suspect: no halo, no
  glow, nothing over his head (`lineup.test.ts` refuses a render whose
  manifest sets `haloInImage`, `copy.test.ts` a halo anywhere in the
  dictionaries).
  - Wide screens (`WIDE`, mirrored by the stylesheet and tested at 1100 x
    800 to 1920 x 1080): the header painted on the wall over the cats,
    five slots across 92% of the width, his column half as wide again;
    `--cm` (`wideCm`) is the most that keeps his head and the cursor over
    it under the page controls with the plates and the foot under the
    floor on one screen (4.3 px at 1440 x 900), within his reach, never
    under 4 px (a cat's face 44 px across, tested; a shorter window
    scrolls). The numerals stand over the cats' heads, his in their row,
    on the wall clear of his left side; his height is read off the chart
    at his crown (`data-crown`). Phones and
    portrait screens: two strips of two cats (Kira and Tom, Dante and
    Odin), each to 40 cm, then his own strip to 140 cm, all at one scale
    (`phoneCm`, 4.6 px on a 390 x 844 phone: his reach in half the screen,
    his head on one screen), each strip with its own numbers; a cat too
    wide for its strip is nudged inward (`phoneNudge`). Colours are
    `lineup` tokens; nothing reflows between states (only opacity,
    visibility, transforms and filters change).
  - The select (`select.ts`, pure, tested): every slot a real button (one
    tab stop; ← → Home End step between them, Enter or Space or a click or
    a tap picks; the mouse moving onto a slot while the keyboard is in the
    roster takes the focus, so only one 1P cursor ever shows), each named
    in one `aria-label`, "<name>, <alias>. <why>" (a cat's why it is
    unavailable, `suspects.refusals.<cat>.why`), and a live region says
    each refusal, the choice and, once a push, the wall's prompt. Until he
    is chosen the way on is a locked stop for the keyboard (`data-locked`,
    `aria-disabled`, unseen until focused, then in the legend's place):
    Tab past the roster says why the story waits. Choosing him stops any
    refusal still playing. No cat can be chosen; each refuses in its own way, for
    a moment (`REFUSALS`), with a chip over its head and a lock on its
    plate for the rest of the visit: Kira turns her back (the `kira-back`
    render folds in about her axis) «No disponible · No se deja»; Tom
    falls asleep (`tom-asleep`, a nod, Zzz) «Bloqueado · Requiere: una
    lata»; Odin ducks under the floor line, the radar sweeps his empty slot
    and finds nothing «Sin señal · Nunca sale en el radar»; Dante, the
    culprit (`CULPRIT`, tested the smallest: the Usual Suspects twist is
    the one who looks least capable of it), lunges and strikes in his
    `dante-swipe` render (crouched, the paw thrown out mid-swipe with its
    claws out, `tools/blender/cats/claws.py`, the ears flat, the eyes
    narrowed, a hiss; each pose dissolves
    in over the other held at full, and every refusal render is decoded
    once it has loaded, so the first strike never paints an empty slot) and his claw swipe tears the screen:
    three marks across it (`claw.ts`, pure, tested; the pink and gash
    colours are `lineup.claw*` tokens) and a shake, «Hostil · Te acaba de
    arañar la pantalla» / "Hostile · He just clawed your screen". The
    claw is his only verdict: no GUILTY stamp, no complaint, no line to
    the officer (`copy.test.ts`). Choosing Jesús: «JUGADOR 1 ·
    SELECCIONADO» over his head, a flash from his slot, the others step
    back into the dark, and his banner «JESÚS» with «Jugador 1» (never his
    surname or role: the hero owns them) and the way on, «Historia
    principal» / "Main story" (the career city's chapter card), on the
    wall over the cats on a wide screen, in the foot on a phone. Reduced
    motion: no turn, nod, duck, lunge, shake or flash; each refusal is a
    still state (the scratches already made). Forced colours drop the
    flash and the claw.
  - The wall (`selectWall.ts`, pure, tested): until he is chosen her
    scrolling stops where the select's foot meets the bottom of the screen
    (on a phone, whose strip for him stands under the cats', no lower than
    keeps his head in view; with the five in one row, a short desktop
    window or a phone on its side, always the foot, so every plate and
    description is in reach), built into the
    engine like the career city's: the select writes `selectGate`, and
    SmoothScroll trims wheel and touch to the smallest of it, the hero's
    and the city's walls (and under reduced motion, with no Lenis, cancels
    what would pass it); held input bounces the board (the hero's
    `elastic.ts`) and brings up «Elige personaje para continuar» / "Choose
    your character to continue"; keys that scroll forward glide to it and
    hold there; whatever else of hers takes the page past it (a fling, the
    scrollbar dragged, a click on its track, whose step animates on after
    the button is up, a move within 250 ms of the wall pulling the page
    back, which is native momentum outliving every window) goes back; only
    a page at rest is navigated. Navigation passes: it registers itself
    as a passage (`registerPassage`, key `select`), so `goTo` (links, Skip
    on to it, deep links, Back and Forward, a fragment) and the focus
    moving on past it open it, and a jump with no input of hers
    (`isNavigation`) does too. Chosen, the wall is gone for the visit
    (`va-player-one` in sessionStorage) and she scrolls freely both ways.
    Without JS there is no wall: every word shows and the way on is a
    plain link. `scrollux.mjs --only select` checks it in the browser.
  - Copy in `suspects` (tested in `copy.test.ts`): the slug says
    «Rueda de reconocimiento · Tenerife» (Tenerife or no city, never
    Madrid) and "Flatmates" / «Compañeros de piso», the owner's words
    without his name; no cat gets game stat bars (STATS owns the bars);
    the eating joke belongs to STATS. The cats are the Blender renders of
    `tools/blender/render_interlude.py` (credited in the end credits with
    the XR Blocks "Cat" base, Apache-2.0), and so are Kira's back, Tom
    asleep and Jesús on one knee; until they land,
    `tools/art/suspects/select-placeholders.mjs` writes placeholders under
    the same names (`tools/art/suspects/placeholder.mjs` still writes flat
    silhouettes of the cats for layout work only).
  - Dante's wanted level (`wanted.ts`, pure part tested) is STATS's
    record, live: each try to choose him raises it (`tryDante`), see
    STATS.
- `src/features/career` — the career, written down once (`career.ts`,
  pure, tested): per job, oldest first, the employer as it writes itself
  (for the army, his unit, the Batallón de Zapadores XVI), the years, its
  stop in the career city (`#work-*`) and the role, in English in both
  languages (Frontend Developer, Full Stack Developer, Frontend Engineer)
  except the army's (Zapador / Combat engineer; the city's service record
  spells it Soldado zapador). Las Palmas de Gran Canaria is the army's
  alone: no civilian job names a city, and no copy says Madrid (tested
  over both dictionaries). Each job has its work `mode`, on site (the
  army, PwC) or remote (Cloud District, Logixs, Heuristik): STATS's main
  missions say it in the owner's words, «Presencial» / «En remoto» ("On
  site" / "Remote", `stats.missions.modes`), the one place the copy may
  say remote (the owner lifted his rule for these labels only; tested).
  Heuristik is on air, LIVE in English everywhere. STATS derives its main
  missions from it (`statsLayout.ts` adds only where each one sits on the
  map, a place for a job done on site, home base for a remote one;
  `stats.missions.items` in the dictionaries is tested to say the same),
  and the career city reads it too. It imports nothing at runtime: `statsLayout.ts` imports it by its
  `.ts` file name (`allowImportingTsExtensions`), because
  `tools/art/stats/map.mjs` loads that file in Node.
- `src/features/stats` — STATS (`#stats`), the pause menu after the
  career city. The site is a GTA-style game with film cutscenes, and here
  the game is paused: the chapter card says «Pausa» / "Paused" (ribbon
  «Ficha del jugador» / "Player profile"), and nothing in the menu says
  the word again (the menu bar shows only the paused glyph, two bars, and
  the in-game clock). Arriving feels like pressing pause in a game:
  while STATS crosses the middle of the screen (an IntersectionObserver
  on that line, never a scroll read per frame, never under the loading
  screen; `data-paused` on the section) a big pause sign (two cream bars,
  a ring and a faint flash) punches in over the middle of the screen for
  0.9 s and gets out of the way: the one moment nobody misses, whatever
  is behind (the career city has closed to flat night by then). It plays
  only when the menu came up from below (`data-pause-from-below`):
  coming back up from the cinema, the cinema's top would cut it in two.
  Then the world behind the menu dims: a veil from one screen above
  STATS down to its foot, under everything in STATS and over everything
  before it, fading out over STATS's last 10rem, so no line shows where
  the cinema (a later sibling in the same layer) starts. No backdrop
  filter: there is nothing behind to blur, and the night canvas above
  would redraw it every frame. Nothing in STATS may blend, or the section
  is isolated and the veil sees only STATS. The menu settles into place
  (a short eased rise), its glyph pulses once and stays lit, and the
  clock's colon, ticking while the game ran, stops. Leaving undoes it,
  faster. Only opacity and transforms move (no layout shift), and nothing
  animates in STATS once it has settled (but the achievement tree's glow,
  only while its tab is open); under reduced motion no sign
  shows and the paused state simply holds, dimmed and still; forced
  colours drop the veil and the sign (and ring the selected tab in
  Highlight). With the radio on, the music goes behind the menu
  (`features/music/pauseMix.ts`, pure and tested; `radio.ts`
  `setPauseMenu`): a low-pass at 800 Hz and a 10 dB duck eased in over
  0.25 s and back out over 0.38 s, with a synthesized blip each way
  (falling on pause, rising on resume, never two within 0.7 s; only on a
  running AudioContext, which her next key, click or tap, touchend
  included, wakes). On SETTINGS the music is open (no muffle, no duck):
  she picks a station and sets her volume by ear and hears what she
  gets; switching tabs inside the paused menu lets it in or out without
  a blip. Radio off: no sound and no AudioContext. `node
  tools/capture/pause.mjs` checks it in the browser (the sign, the veil,
  the sound, SETTINGS, and a fragment set on the open page landing the
  section's top). While paused the menu's glyph holds still. One screen with four tabs, the player
  profile first: STATS · MAP · ACHIEVEMENTS · SETTINGS (ESTADÍSTICAS ·
  MAPA · LOGROS · AJUSTES). A server component (`Stats.tsx`), every
  word of every tab DOM text in the server HTML; the client parts are the
  tabs and the pause (`StatsTabs.tsx`), the achievement tree's taps and
  keys (`AchievementSky.tsx`) and the settings
  (`features/settings/Settings.tsx`, shared with the start menu).
  - STATS (`#stats`, the default; `#stats-sheet` opens it too) is the
    player profile: a Cycles render of his driver model with Dante at his
    shoulder (`public/stats/portrait.{avif,webp}`,
    `tools/blender/build_stats_portrait.py`), and on its plate ABOUT ME /
    SOBRE MÍ (`stats.player.title`), headed like the panels beside it,
    never his name (the owner's call: the portrait's text alternative
    names him; `statsMarkup.test.ts`), over how he works in the owner's
    words (`stats.player.bio`, tested word for word; no "Frontend
    Engineer" or Tenerife in it, the page says both already). From 1000
    px the plate sits over the portrait, so landing on STATS shows it;
    from 1000 to 1279 px the records stand beside the skills and the
    portrait is square, so the profile fits 1100 × 800 (MAP and SETTINGS
    scroll there, and under 1000 px every tab does). Then the joke bars
    (appetite breaks out of its panel into the gap beside it; under 1280 px, where
    the panel meets the page's edge, the tracks are shorter and it breaks
    out of its track only; the section has `overflow-x: clip`) and the
    records: Dante's current wanted level, the countless "just one more
    episode" and the kilometres of Formula 1 watched a season, not one
    behind the wheel (it must never read as if he raced; "from the sofa"
    is said once, under RACECRAFT, which is F1 watched from the sofa every
    weekend). No record counts the cats and no halo shows anywhere
    (`statsCopy.test.ts`); each value's glyphs are hidden from screen
    readers, which hear `spoken` instead. The wanted
    level is live (`WantedLevel.tsx`, `features/suspects/wanted.ts`, the
    owner's idea): «nivel de búsqueda actual de Dante» / "Dante's current
    wanted level", one star until she has tried to choose him in THE
    USUAL SUSPECTS' select, one more a try up to five (localStorage
    `va-dante-tries`, in try/catch), five fixed star slots with the unlit
    ones dimmed and the server's HTML at one star (no layout shift), said
    in words («Una estrella» … «Cinco estrellas»). The record is a button:
    hover (where a pointer hovers), keyboard focus or a tap brings up its
    popup, «Prueba a seleccionarlo y vuelve aquí» / "Try choosing him,
    then come back" (at five, «Busca y captura»), its description for
    screen readers, hung under the stars (above them it covered the
    panel's heading); a level raised since STATS last showed it (one
    star, before STATS ever showed one: the select comes first) flashes
    the stars once (not under reduced motion).
  - MAP (`#stats-map`) is career geography only: where he has worked and
    where he is, on Tenerife at night under parody names (GTA-style: real
    places, renamed; Spanish in both locales, `stats.map.places`; each one
    gives the real town away at a glance, like GÜIMARCIANO for Güímar). No
    hobby blip and no hobby caption on it (the owner found the map read as
    a riddle: tested). The career is five main missions, the career index
    (with `CAREER_CITY_ON_PAGE` on in `statsLayout.ts`, links to the
    city's `#work-*` stops), each row saying how the job was done,
    «Presencial» or «En remoto» with the map's glyph for it (the ring of
    an on-site badge, home base), never a city in text. On the map: the army on site in the
    Gran Canaria box (the island and its city named, nothing more: the
    Tenerife-versus-Gran-Canaria joke is the hero's, and the army's
    road-opening is the career city's); PwC on site at the dock on the
    north-east waterfront, at the level of LAS SAHARITAS (`DOCK`, a real
    point just inland of the map's coast, tested on land and near Las
    Teresitas; its caption "The dock" / «La dársena»); and the three
    remote jobs as badges beside the HQ glyph, which sits in the Teide's
    caldera so it never points at a real home (tested). The career route
    (`careerRoute` in `statsLayout.ts`, drawn by `map.mjs`) runs from the
    box by ferry to the dock and up to home base; the ferry leaves the box
    by its right side and crosses no word on the map, LAS SAHARITAS
    standing above it north-east of the dock and SANTA CHICHARRO below it,
    and the road crosses no caption (labels may touch the road; tested at
    every wide width). Heuristik
    is the only red blip (`palette.onAir`). A key beside the map's title
    reads the badges: a ring is on site, home base is remote. The missions
    come first in the page: from 1280 px a column beside the map's frame,
    as tall as it (a subgrid), the badges on one route; from 700 to 1279
    px a row of five above the map, each under its segment of the
    progress line; on a phone a column before the map.
    `statsLayout.ts` holds the projection, every point as real longitude
    and latitude, the caption sides and the page geometry; its tests check
    that the places stand on land and that no caption, name or marker
    overlaps another at every map width the wide layout takes (1000 px and
    up). Below 1000 px the square crop shows the badges and HQ, and a
    legend under it carries the words, each row with its badges: 1 on
    Gran Canaria's, 2 on the dock's, 3 to 5 on home base's. Move a point or change a caption,
    run the tests; place a name with the box model, not by eye.
  - ACHIEVEMENTS (`#stats-achievements`; the old `#stats-favorites`
    still opens it, `PANEL_ALIASES`) is his achievement tree, the owner's
    idea for the favourites: what he has unlocked and what still holds out
    on him, as a game lists them (LOGROS / ACHIEVEMENTS: the sheet's
    panel is SKILLS / HABILIDADES, so never "skill tree"; the panel is
    headed «Árbol de logros» / "Achievement tree" with the count,
    «20/30 desbloqueados», derived from the data, never typed). Drawn as
    constellations in the island's night sky (`Achievements.tsx`, data,
    layout and tests in `achievements.ts`): him, P1, on the ridge at the
    foot of the sky, the Teide low on the right; four branches rise from
    him and fork like a game's tree. SPORT: jump rope (the basic bounce
    and the boxer step, never double unders), running (2 km, 5 km in 24
    min, 10 km in an hour; the half and the full marathon locked),
    Formula 1, watched (up at 4 a.m. for a race and back to sleep, and
    Alonso's 33rd, pending since 2013; no Box 33, the owner took it out),
    and «Dejar de comer como un cerdo», locked hardest, three padlocks on
    a crossed chain, BLOQUEO MÁXIMO, a wink at the appetite bar. GAMES:
    Metal Gear Solid 3 (its line is the only cardboard box on the site),
    Devil May Cry 3 (pizza without olives), forking to Skyrim («Eh, tú, al
    fin has despertado») toward The Elder Scrolls VI and to Red Dead
    Redemption 2 toward GTA VI, both locked. FILM: The Godfather first,
    then The Usual Suspects, Pulp Fiction («Royale con queso», the
    owner's pick over Gladiator) and The Matrix, which feeds Marvel and
    forks to
    «Ver La Odisea sin ir al baño» (unlocked) and IMAX 70 mm (locked, «un
    presupuesto que no tengo»). SERIES: The Sopranos first, forking to
    Breaking Bad and Better Call Saul (which feeds Marvel) and to Peaky
    Blinders and Chernobyl; «Ponerme al día con One Piece» (locked, «Me
    quedé en Alabasta») hangs off the hub, never on the way to Marvel. His
    two favourites, The Godfather and The Sopranos, are bigger gold stars
    with a five-pointed star on their light and FAVORITA / FAVOURITE
    under the title (in their names and details too), first from their
    hubs. The one star FILM and SERIES feed, «Estar al día con Marvel»,
    sits where their paths meet, surrendered: a ring as big as the pig's
    with a white flag planted in it, RENDIDO, and it counts in both
    branches (`branchTally`), so neither reads as finished. No radio
    winks: the owner's rule is that people may never open the radio, so
    no star names a station or the radio (`statsCopy.test.ts`): Pulp
    Fiction's line is its burger, never Mr. Wolf, and Miami Vice is out. Every locked star's line says what it
    requires («Requiere: ...», tested both ways). Each branch has its
    colour (`achievementTree` in the tokens, `--va-tree-*`, the
    favourites' gold too): lit stars glow in it, a glint each, and a soft
    pulse travels out from the player along the lit links (CSS, only
    while the tab is open, paused off screen, none under reduced motion);
    locked stars are unlit rings with a padlock, their links dotted.
    Every star is a real button in a nested list (branch, constellation,
    star) named "<title>, unlocked|locked, [its tag,] <line>" (every word
    of it on screen too), its details opening on hover, keyboard focus or
    a tap; a locked one shakes when pressed; the arrows step along its
    branch. From 1000 px the stars sit on the sky's plane (1200 × 640
    units, in percentages, the type in `cqi`, titles wrapping at 8 em),
    never taller than the screen leaves it, so the tab fits 1440 × 900 and
    1100 × 800; `achievements.test.ts` keeps every title, star, hub, name
    and link clear of the others (titles of two branches a full line
    apart) and every details card inside the sky at every width it is
    drawn at, in both languages: move a star, run the tests. Under 1000 px
    each branch is a card with its stars down a spine that breaks where a
    path forks off, every line shown (two columns on a tablet), the
    favourites headed ★ FAVORITA. Forced colours draw it in system
    colours. STATS names no side project (they are the cinema's,
    `statsMarkup.test.ts`) and links nowhere on: the page scrolls on to
    the cinema.
  - SETTINGS (`#stats-settings`) are real, GTA-style, and the same
    component the start menu opens before she enters
    (`features/settings/Settings.tsx`; `where="stats"` here: ids under
    `stats-settings-`, the radio live, the shoulder keys' row). AUDIO tunes the
    radio's own store (`radio.ts`): the radio on or off (a switch), the
    station (radio buttons; tuning crackles as on the wheel) and her
    volume (a range in 5 % steps that really sets the player's level,
    `deckVolume`, remembered as `va-volume` like the station; where the
    browser keeps the volume, iOS, it is disabled with a note). CONTROLS
    is the full reference of how to drive the site, keyboard, mouse and
    touch, true to the code (`hero/scroll/transport.ts`, the pedal, the
    radio wheel, the tabs' shoulder keys), keys as key caps; on a phone
    each action is a card, and a touch screen without a mouse (`hover:
    none` and `pointer: coarse`) shows the touch column only. DISPLAY sets the subtitle size, small, medium
    or large (`lib/subtitleSize.ts`: `data-subtitles` and
    `--va-subtitle-scale` on `<html>`, multiplied into both stages' cards
    by `globals.css`, tested against their
    stylesheets; remembered as `va-subtitles`; every card is fitted
    again), with a sample card.
    LANGUAGE links to the other locale on this very tab
    (`/es#stats-settings`), so she lands back here; while the game is
    paused the page controls' EN/ES carries the open tab's fragment too
    (for that one click), so both switches keep her place. Every control is
    native and labelled.
  - The tabs switch in place, like a game's pause menu: the tab bar (click,
    the arrows, Home, End; the WAI-ARIA tabs pattern, selection following
    focus, roving tabindex, the open panel focusable next) and `[` and `]`
    as shoulder buttons while STATS crosses the middle of the viewport or
    holds the focus (never Q or E: Q is the radio's). A switch writes the
    tab's fragment with `replaceState` (no scroll, no hashchange): `#stats`
    is STATS, `#stats-map`, `#stats-achievements` and `#stats-settings`
    the others (and `#stats-favorites`, the tree's old name, an element at
    the top of its panel that lands like it) (`statsTabs.ts`, pure, tested:
    fragments and keys). A deep link opens its tab before `PageEntry` lands, through
    `lib/reveal.ts`, and lands the section's top with the panel focused;
    so does a fragment set on the open page (the browser's own scroll to
    a panel, a frame later, lands there too: a panel's
    `scroll-margin-top` adds `--panel-rise`, its distance under the
    section's top, which `StatsTabs.tsx` measures).
    The new panel slides in from its tab's side in 0.22 s (none under
    reduced motion). Under 1000 px the paused glyph and the clock take the
    menu's first row and the tabs the second; under 560 px the tabs are
    two columns of equal cells (`PHONE_MENU`, tested from 360 px).
  - One screen on a desktop: from 1000 px the panels share one grid cell
    and the closed ones are `visibility: hidden`, so the tallest sets the
    height and a switch moves nothing (every one starts right under the
    tab bar, a shorter one too: centred, a short tab opened on a band of
    empty night under the tabs); below 1000 px only the open one is on the
    page (`display: none`), as tall as it needs. The map is never taller
    than the screen less everything around it (`MAP_CHROME_PX`, the
    paddings, menu bar, map title, source line and the room at the foot,
    `FOOT_PX`, mirrored in `Stats.module.css` and tested), and beside the
    map (1280 px up) the missions take the frame's height, so every tab,
    scrolled to the top of the screen below its chapter card, fits
    1440 × 900. A link lands the whole card
    under the page controls and the menu just under it (`scroll-margin-top`
    counts the card's rise over the section's top edge, over the career
    city's last frame).
  - Without JS (the stacking only applies under `@media (scripting:
    enabled)`) the panels stay on the page, one under the other, with four
    plain links; the tab roles come with hydration (`statsMarkup.test.ts`
    renders the server HTML). The map is a lazy `<img>`; the portrait is
    lazy too until the section is within a screen of the viewport
    (`StatsPortrait`).
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
    is open).
  - The credits roll is the page's own scroll: on wide screens the dawn
    frame is sticky and the roll scrolls over its right side. It is real
    text (`credits.ts`, tested) and tells only what is its own, the
    contact before the fine print (tested): the title and who wrote it
    (his name once more, and in the copyright), the cast (him and his four
    cats, the ones really in it, the owner's call: the driver as Himself,
    then each cat as its alias from the character select, in the line-up's
    order: La Reina / The Queen, Kira; El Gordo / Fats, Tom; Satanás /
    Satan, Dante; El Enano / Shorty, Odin), then THANKS FOR DRIVING BY and the GitHub
    and LinkedIn tickets (`#contact`, `rel="me"`, never the email), then
    the fine print: PROPS AND SETS (the CC BY 3.0 car, the CC0 traffic and
    body, the cats' Apache-2.0 base as a modified version, the map's
    public-domain relief), every radio track in its author's format, the
    typefaces, HIS TOOLKIT and BUILT WITH (no name in both: what only this
    site uses is in BUILT WITH alone; the toolkit opens on the owner's own
    list in his order, Vue, Nuxt, TypeScript, React, Next.js, Tailwind CSS,
    Claude Code, Codex, Supabase, Firebase, AWS Amplify, Docker, Linux, and
    ends on «y un largo etcétera» / "and the list goes on"), smaller and two
    credits to a row once the roll is wide enough (a container query: a
    desktop window from about 990 px, a tablet's column), every word still
    on the page, as CC BY asks. A link to `#contact` lands its head below
    the roll's sticky top fade (`scroll-margin-top`), never dimmed under it. Then THE END, the
    copyright in his name alone (no site title under it, the owner's
    call) and "Same time tomorrow?". No job and no side project is named there (tested): STATS,
    the career city and the cinema tell them.
- `src/components/ChapterCard` — the static sections' headings: one
  sign-painter's chapter card each, a word in the film's voice over a
  scroll banner that says plainly what the section is (`<section>.chapter`
  in the dictionaries, `{ word, ribbon }`; the owner's texts, tested: La
  banda · Sospechosos habituales, Pausa · Ficha del jugador, Sesión
  golfa · Proyectos personales, ¡Y corten! · Créditos y contacto; The crew
  · The usual suspects, Paused · Player profile, The late show · Side
  projects, That’s a wrap · Credits and contact; and the career city's,
  Historia principal · Trayectoria · 2018 — LIVE, Main story · Career ·
  2018 — LIVE). "El conductor" / "The driver" is his role in the credits'
  cast, never a ribbon. A short word stops growing at `CARD.maxSize`
  (Pausa, Paused), as tall as THE CREW's.
  - The look: the word in Chapter Script, cream to amber to peach, with an
    ink keyline, a magenta split shade and a dusk-to-ink block shade; under
    it a flat banner of even height on a gentle arch, its swallow-tail ends
    folded back behind it (the fold in deep rose), the band orange to peach
    to pink with an ink keyline, a cream pinstripe top and bottom and the
    same shades; the ribbon in capitals in Big Shoulders Display Black,
    night ink, evenly tracked, set on the arch. The whole card leans 5°.
    Colours are `chapterCard` tokens.
  - One server-rendered SVG per card, deterministic: `chapterLayout.ts`
    (pure, tested) lays it out in a viewBox 1000 units wide from
    checked-in metrics, never by measuring in the browser: `scriptFace.ts`
    reads `scriptMetrics.json` (advances, ink boxes, kerning and each
    glyph's lowest ink per 0.02 em column) and `capsFace.ts` holds the
    capitals' widths and kerning. The banner hangs as close under the word
    as it can: its top clears the word's body; deep descenders and swashes
    (Sesión golfa, ¡Y corten!, That’s a wrap, Main story; `DEEP` in
    `chapterLayout.test.ts`) cross in front of the band with
    their shade on it, as on a painted sign, and no ink or shade ever
    reaches a capital (tested). A new word or ribbon: `python3
    tools/chapter/fonts.py` subsets the face again with the dictionaries'
    letters and rewrites the metrics (fontTools and brotli), and `node
    tools/chapter/measure.mjs` prints Chromium's numbers for the MEASURED
    tables in `chapterLayout.test.ts`; a capital `capsFace.ts` lacks fails
    the tests.
  - The card is its section's one `h2`, named "<word>. <ribbon>"
    (`chapterName`: "La banda. Sospechosos habituales"), its SVG
    `aria-hidden`; the word and the ribbon are its only text, once each
    (the shades are `<use>` copies), so find in page finds them
    (`anchors.test.ts`). Forced colours draw it in the system's two
    colours, without shades.
  - Its faces are self-hosted in `src/app/fonts`, each beside its OFL
    licence: Chapter Script is Mr Dafoe subset to the cards' letters plus
    a safe Latin set and renamed (the OFL's Reserved Font Name), under
    16 KB and checked against the metrics' SHA-256; the capitals are a
    latin subset of Big Shoulders Display Black. Both use `font-display:
    block` and are not preloaded (the cards are below the fold, and a page
    without one, a 404, never fetches them); no box depends on them.
    `ChapterMotion` keeps a card clear until its faces are in (no card ever paints in a
    fallback face, and the layout shift stays 0 with the faces held back),
    and plays each card's entrance once as it comes up: the word fades in
    with a 2° turn, and 240 ms later the banner unfurls from its middle.
    Reduced motion plays nothing.
  - One width for every card: its band less 2rem, at most 48rem
    (`--va-chapter-span`, `chapterSpan` in the tokens; `cardWidth`). In
    rem, not in viewport widths, so a card grows with the text size and
    the browser's zoom like any heading, until the window stops it
    (tested: 1.5 times at 150%); the span is also at most 1.5 screen
    heights, which only binds on a phone on its side. Its capitals stay at
    least 11 px tall on a 360 px phone (tested). Each section places the card's band: THE
    USUAL SUSPECTS on the night over the line-up (from 64rem, 3rem of
    night under the controls' row, as in the mockup); PAUSED and THE
    LATE SHOW straddle the cut from the section before
    (`--chapter-straddle`, `STRADDLE` in `chapterLayout.ts`, mirrored and
    tested: PAUSED rises 0.8 of the way to its word's middle, over the
    career city's last frame, at most 0.124 of the card's width, set on
    the section so its scroll margin counts it; THE LATE SHOW rises only
    the top of its word, into the room at STATS's foot (`FOOT_PX`, 72 px,
    its bottom padding, where nothing else stands), 32 px or more under what ends the open tab, on the
    MAP tab the map's source line, and further under the main missions
    beside the map, which end a source line higher, `statsLayout.test.ts`;
    its box rises higher than its word (46 px at the default text size,
    still in that room) and, with a larger text size, over that last line,
    so it lets the pointer through wherever it straddles, its text still
    selectable; and the cinema's sky makes room under it). Under 1000 px
    the cinema's card does not straddle: it has a band of its own, and a
    link lands that band under the controls. The credits' card heads the
    roll, rising into its lead-in, as wide as the roll, and narrower where
    even the roll would reach the dawn marquee (under about 880 px, a
    phone on its side): it starts 1rem clear of the board (`--w-bx`,
    `--w-bw` on the section).
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
  landing) left it behind, and one notch after a link took her to the cinema the
  page flew back up to the hero's end. A move past the hero opens its
  walls first (the hero registers itself as the passage), as the focus
  moving past it does, so the frontier never pulls back a page that is
  legitimately past the hero. Focus goes with `focusInPlace` (never
  scrolls; a target that cannot take the focus can while it has it).
  An in-page link adds a history entry as the browser's jump would
  (`pushFragment`), and the entry she leaves remembers where the page
  was (`placeOf`, beside Next's own history state): Back and Forward go
  there through `goTo` (PageEntry's popstate; the browser's own scroll
  restoration is off, it moved the page behind Lenis' back), or to the
  section the address names, so Back is never dead. Back to top drops
  the old fragment from the address (`clearFragment`, replaceState), so
  a reload starts at the top, never in the cinema a link named.
- `tools/art/stats` — the STATS map. `extract.mjs` (run once, needs the
  network) turns the public-domain Terrain Tiles on AWS (zoom 8: SRTM,
  GMTED2010, ETOPO1 only; it refuses a tile with any other source) into
  `canaries.json`: the coast (the 40 m ring, after a morphological opening
  that drops resampling seams), relief and depth rings of Tenerife and Gran
  Canaria. `map.mjs` (offline, deterministic) draws `public/stats/map.svg`
  (16:11) and `map-square.svg` (1:1) from it and `statsLayout.ts`: our
  palette, terraced relief, schematic roads through the real towns
  (asserted on land), town lights, runways and the career route (the
  ferry from Las Palmas to the dock, then up to home base); no hobby and
  no text in the SVG. Each file stays under 40 KB (it refuses more).
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
  skin, fur, eyes, whiskers, claws for a strike, stage, review) and
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
source URL, licence and what was changed. Only tracks whose licence
allows this use, instrumental or sung (the owner's call): CC BY 4.0
(Kevin MacLeod, credited in his own format), CC0, or the Pixabay Content
License. No copyrighted songs, ever. Every track on air today is Pixabay.
Pixabay licence certificates name the licensee: they stay out of the repo;
LICENSE.txt gives the track page and the Pixabay ID instead.

To add a track to a station:

1. Encode it: `tools/audio/encode-track.sh <download> public/music/<slug>.mp3
   [start] [end] [fade]` (ffmpeg on PATH, or `FFMPEG=...`; `pip install
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
- A section with a looping CSS animation (bulbs, STATS's ticking clock and its achievement tree's glow) carries
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
  same way, the address naming the target as the browser's jump would,
  and Back returning to where she was. Never move the page with `scrollIntoView`, `window.scrollTo` or a bare
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
  focusable may sit under the controls in the hero's pinned frame. THE
  USUAL SUSPECTS cancels it with a negative `scroll-margin-top` (its
  chapter card's band clears the controls); STATS and the cinema add their
  card's rise over their top edge, so a link lands the whole card below
  them.
- Three.js runs client-side only: `HeroCanvas` loads `HeroScene` with
  `next/dynamic` and `ssr: false`, inside an error boundary. The page must stay
  readable without WebGL: real text in the DOM, CSS sky as fallback.
- Scroll progress flows through `heroProgress` (a mutable object), never
  through React state. `HeroStage` writes `target` from the page scroll
  (the frame reads the page's offset after Lenis has written it, and no
  element geometry; the stage is measured when the viewport changes),
  clamps it to the story frontier into `value`, and `useFrame` reads
  `value`.
- Nothing in the page flow is sized with `vh`, `svh`, `lvh` or `dvh`:
  use `--va-svh` and `--va-lvh` (one hundredth of the small and large
  screen, `lib/screen.ts`, defaults in `globals.css`), which a phone's
  bars never change. Browsers that resize their web view with the bars
  (in-app browsers, some iOS browsers) change every viewport unit, and
  the 600vh hero stage moved the whole page below by six bar heights on
  every change of direction (`lib/screenUnits.test.ts` checks the static
  sections). `dvh` stays for what follows the visible area out of the
  flow (the hero's pinned frame and its overlays). `scrollux.mjs
  --only statics` swipes the static page with the bars coming and going.
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
on Metal Gear's star in STATS's achievement tree
(`stats.achievements.nodes.metalGear.line`); "from the sofa"
once; remote only in the main missions' work-mode label
(`stats.missions.modes.remote`, the owner's «En remoto»); "off the
clock" / "fuera de horario" at most once, inside STATS (its card now
says the game is paused; the ribbons name only what their own section
owns); Madrid never. Widen an
allowance only with a comment saying why. Baked text (the
posters' billing blocks in `posters.mjs`, the city's canvases) is outside
the dictionaries and the test: hold it to the map by hand.

What each section is for, and what it owns:

- Loading screen (the start menu) — the trailer: how to drive and what
  is on the radio, one tip at a time, and trivia about the shoot that no
  other section tells; it gives nothing away, and names neither him nor
  his role. It is a game, never a film: no copy of the start menu, the
  intro's help, the settings or the description calls the site a film
  (`dictionaries.test.ts`). STATS's SETTINGS hold the full controls
  reference and the radio's controls, as a game's pause menu does.
- Hero — who he is, in six lines: his name, his role, Tenerife, and the
  army story with the Gran Canaria joke.
- THE USUAL SUSPECTS — him at home, as a game's character select: the
  four cats refusing to be chosen, Dante the culprit through his claw
  swipe, and him, player 1, the only one she can choose. No complaint,
  no verdict stamp, no line to the officer.
- The career city (`#work`) — the career, once and whole: the five
  jobs (employer, role, years, clients, stack, a link) and the army's
  facts (the unit, Las Palmas).
- STATS — the pause menu: the player profile (who he is and how he works,
  the bars, the records), the map of where he has worked (on site or
  remote), his achievement tree (the favourites, and the goals still
  locked), and the settings. The career only as an index:
  the main missions with their work modes, LIVE and, with the city, links
  to its stops.
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
- The side projects: the cinema. STATS and the credits: nothing.
- The cats: THE USUAL SUSPECTS (Dante's culprit wink is his claw swipe,
  the only cat who attacks). Winks only elsewhere: Dante as player 2 on
  the STATS sheet and in its live wanted-level record, the STEALTH bar's
  tin on the STATS sheet, the four cats by their aliases in the credits'
  cast.
- F1: STATS (the 4 a.m. race and Alonso's 33rd stars, RACECRAFT and the Grand Prix record). The
  loader: the pit-lane limiter tip only. The hero: its dashboard.
- The favourites (games, films, series) and his sporting goals: STATS's
  achievement tree. No radio winks there: no station is named.
- The cardboard box: Metal Gear's star in STATS's achievement tree. Nowhere else.
- How he works and where: STATS (the ABOUT ME bio, the work modes and
  the map). The career city: each job's facts, never "remote".
- His stack: the career city (per job) and the cinema (per project). The
  credits: one toolkit list that shares no name with BUILT WITH.
- The contact: the end credits. Elsewhere only links to `#contact` (the
  cinema's box office).

## Content rules

- No Rockstar assets, logos or the GTA typeface. Inspiration only.
- Heuristik is the current employer: show the role and dates only (no
  city), nothing from its clinical projects; its work mode («En remoto»)
  only on STATS's main missions, where the owner asked for it. Skip `atlas-habits` on purpose
  (`project-atlas` is a different repo and belongs in the projects).
- The site never calls the Claude API. Generated data lives as JSON in the repo.
