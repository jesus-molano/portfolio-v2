# THE USUAL SUSPECTS: the line-up's cats, their refusals and player 1

The line-up after the hero (`src/features/suspects`) is a character select:
the four cats, the way each one refuses to be chosen, and the one she can
choose, as transparent images on one scale, and the manifest that places
them.

## The contract

- Layers, each as `.avif` (served first) and `.webp` (fallback): RGBA,
  straight alpha, a contact shadow baked into the alpha, no metadata. At
  most 90 KB an AVIF (160 KB for `jesus`, nine times a cat's pixels), 360 KB
  for the four cats.
  - `kira`, `tom`, `dante`, `odin`: the four suspects in their line-up sit;
  - `kira-back`, `tom-asleep`, `dante-swipe`: a cat's state when she tries
    to choose it, in its slot instead of the cat. Kira turns her back (her
    head a little short of the turn, an ear and a sliver of cheek over her
    shoulder); Tom falls asleep: every pixel is his layer's but the eyes,
    which are shut (same size, same box: the page can cross-fade the two);
    Dante strikes: crouched, his right fore paw thrown up and out toward
    the lens mid-swipe with its claws out, ears flattened back, eyes
    narrowed to slits, hissing;
  - `jesus`: player 1 in slot 5, the hero's driver model kneeling on one
    knee, his left forearm laid across the raised knee and the hand hanging
    off it, the right arm loose at his side, facing the lens; the hero's
    look (striped tee, gold aviators, earring, beard, crew cut), jeans and
    dark laced trainers. At his true size: he kneels at about 1.2 m.
- One scale for all five: every image has the same number of pixels per
  real centimetre (`pxPerCm`), so the page stands them side by side on the
  height chart at their real sizes, the cats (27 to 39 cm) small beside
  him, as in life. No scale mark: nobody is drawn at another scale.
- `manifest.json`:

  ```json
  {
    "pxPerCm": 24,
    "cats": { "kira": { "w": 0, "h": 0, "floorY": 0, "headTopY": 0, "centerX": 0, "headWidth": 0 } },
    "states": { "kira-back": { "w": 0, "h": 0, "floorY": 0, "headTopY": 0, "centerX": 0, "headWidth": 0, "cat": "kira" } },
    "jesus": { "w": 0, "h": 0, "floorY": 0, "headTopY": 0, "centerX": 0, "headWidth": 0, "heightCm": 0 }
  }
  ```

  in image pixels: `w` x `h` the image size, `floorY` the row where the cat
  meets the floor, `headTopY` the highest row of the head (ear tips
  included), `centerX` the column of the slot centre, `headWidth` the width
  of the head across the cheeks. A state names its cat (`cat`). For him,
  `floorY` is the front edge of his planted trainer's sole, `headTopY` the
  top of his hair, `headWidth` his face across the cheeks (the beard's
  skin) and `heightCm` his kneeling height, from the model (117.9 cm; read
  on the chart from the front trainer's sole, as the page places him, his
  head stands at about 125.0 cm: the sole is half a metre nearer the lens
  than his head). Nobody wears a halo, Odin included: the
  page draws none and a render must not carry one (the optional
  `"haloInImage"` flag survives from when he wore one, and the tests refuse
  a manifest that sets it on any cat).
- `src/features/suspects/lineup.test.ts` checks the manifest, the image
  sizes and the budget, that the heads keep that size order and that
  Dante's head stays the lowest on the chart.

## How they were made

Rendered in Blender 4.5 (Cycles, as the `bpy` Python module) by
`tools/blender/render_interlude.py`, which builds each cat with the shared
generator `tools/blender/build_cats.py` and its `tools/blender/cats`
package (one file per cat in `cats/suspects/`: size, build, sit, face,
coat, fur, eyes, whiskers) and shoots the four as one set:

- one camera: 135 mm, level at 26 cm, 3.2 m in front of the slot, never
  tilted, so verticals stay vertical and the chart reads true;
- one light rig for all four (a pale lavender key, a pink rim and a violet
  kicker behind, a hair light; colours from `src/design/tokens.ts`), with
  one set of gains (the rim kept low, so no coat reads magenta against
  the wall): no cat has lights of its own;
- one render setting: 64 samples with OpenImageDenoise, full fur density,
  24 px per centimetre at the slot plane, a fixed seed;
- one contact shadow: a second pass of the same camera in which the cat
  only casts shadows, onto a shadow-catcher floor under one soft light
  straight overhead. It is baked into the alpha in `night` under the cat,
  so the page needs no shadow of its own.

The layers are composed with straight alpha, cropped to what shows, and the
colour of the nearest visible pixel is carried under the transparent ones
so the encoders never pull a dark fringe into the fur. They are encoded
with Pillow (AVIF by libavif, 4:4:4; WebP by libwebp, lossless alpha)
without Exif, XMP or ICC data. `floorY` is where the front paws meet the
floor, projected through the camera, so the paws stand on the chart's
floor line; `headTopY` is the highest row of the ear tips with their fur
(alpha at least one half); `headWidth` is the head's skin across the
cheeks plus the cheek fur.

Sizes, in the owner's order (Tom the biggest, but only just; Kira, a
normal adult; Odin smaller, a little short in the leg, with a shorter tail;
Dante, a kitten of six months, the smallest). Ear tips as built: Tom
37.7 cm, Kira 35 cm, Odin 32 cm, Dante 26.4 cm. On the chart, read from the
paws with the ear fur, the heads stand at 38.5, 36.0, 32.8 and 27.2 cm.

The states (`tools/blender/cats/suspects/states.py`) are their cats built
again by the same generator under the cat's own key, so every random draw
(fur, whiskers) is the cat's: only the pose differs, deep-merged into the
cat's own. Tom asleep changes nothing but his lids (both shut: the base
clip's blink), so his strands, his box and his place on the chart are his
layer's to the pixel or two the renderer's noise moves the crop by: place
both by `centerX` and `floorY` and only the eyes change. Kira's back is her
whole sit turned half a circle about her footprint, her head 22 degrees
short of it, her ears swivelled back toward the lens and her tail path
turned with her. Dante's swipe keeps his sit and lifts the right fore paw
11 cm, forward, pads to the lens, with his ears flat sideways, his jaw
open 16 degrees and his pupils round.

Jesús (`tools/blender/lineup_man.py`) is the hero's driver model
(`public/models/makehuman-driver/driver.glb`) with his aviators
(`public/models/sunglasses/aviator.glb`), dressed and lit like his STATS
portrait (`build_stats_portrait.py`: skin, tee, hair shells, earring,
lenses) and posed on one knee with two-bone IK in his own rig: his right
knee and shin on the floor, the toes tucked; his left foot planted ahead;
the trunk leaning 36 degrees over the raised knee; his left forearm laid
across it (the wrist lowered until the forearm rests on the jeans, a few
millimetres off), turned palm down, the hand let go at the wrist so it
hangs off the knee in line with the forearm, the fingers together and
loosely curled; his right arm loose at his side, the palm to his thigh,
the hand in line; the head level, facing the lens; the whole figure
turned 14 degrees toward the cats. The jeans' crotch, which the raised
thigh folds into spikes, is relaxed by a volume-keeping smooth. The tee's neck
rib, a 4 px maroon band blurred into the stripes in the clothes' 1024 px
texture, which his close shot magnified into a magenta ring round the
neck, is repainted crisp in the stripes' own navy at twice the texture's
resolution. The model
is barefoot under its jeans and no CC0 shoe is installed here (the
MakeHuman community shoes are never used), so the script lofts a pair of
plain trainers round each foot's own skin: a white rubber sole wall with
a dark tread line, a near-black canvas upper, the weights of the foot
under each vertex.

He is at his true size, at the cats' 24 pixels to the real centimetre. The
cats' stage is built round a 40 cm subject (the lens 3.2 m off and 26 cm
up, a frame 85 cm wide, lights a metre or two away), so he is shot as they
are, scaled: built at full size, the whole rig is scaled to a 1:3
miniature and photographed by the cats' own camera, lights and contact
shadow at three times their pixel density. That is the cats' photograph of
him with everything three times as far (the lens 9.6 m off at his chest's
height, 78 cm): the same perspective and light on him as on them, and the
same pixels per real centimetre. The skin's subsurface radius and pore
bump scale with the miniature, and his render raises Cycles' transparent
bounces for the twelve stacked shells of his crew cut and beard (nothing
in a cat's layer is transparent, so the cats' setting is unchanged in
effect).

To make them again, with the Python that has `bpy` 4.5 installed
(deterministic; the base model is fetched from its pinned commit and
checked by hash; the four cats take about 40 minutes on 4 CPU threads, the
states and him about as long again). A run can redo some layers
(`--cats`): the others keep their entries in the shipped manifest.

```sh
XDG_CONFIG_HOME=$(mktemp -d) nice <python with bpy> tools/blender/render_interlude.py -- \
    --out <a folder outside the repo> --encode public/interlude --threads 4 \
    [--cats kira,tom,dante,odin,kira-back,tom-asleep,dante-swipe,jesus]
```

## Licences

- The cats are built on "Cat" from XR Blocks by Google
  (`xrblocks/assets` at commit `5582bd1`, `models/Cat`: mesh, rig, sitting
  clip and textures), under the Apache License 2.0. `LICENSE.txt` in this
  folder carries the licence text and says what was changed (re-posed,
  reshaped into four cats, new eyes, fur, coats and whiskers, rendered to
  stills). That repository has no NOTICE file, so there is no notice to
  carry. The model itself is not distributed; only these renders are.
- Everything else is original work made for this site: the generator, the
  render script, the fur, coats, eyes, whiskers and poses, the lights and
  the contact shadow.
- Jesús is a render of the site's driver model, built from the MakeHuman
  system assets (CC0 1.0; `public/models/makehuman-driver/LICENSE.txt`),
  with his aviators (an original model) and trainers made by
  `lineup_man.py`; nothing in his layer comes from the cat. No photo of
  him or of the cats is in the repository.
