# THE USUAL SUSPECTS: the line-up's cats

The four cats of the line-up after the hero (`src/features/suspects`), as
transparent images on one scale, and the manifest that places them.

## The contract

- `kira`, `tom`, `dante`, `odin`, each as `.avif` (served first) and
  `.webp` (fallback): RGBA, straight alpha, a contact shadow baked into the
  alpha, no metadata. At most 90 KB an AVIF, 360 KB for the four.
- One camera and one scale for all four: every image has the same number
  of pixels per centimetre, so the page can stand them side by side on the
  height chart at their real sizes.
- `manifest.json`:

  ```json
  { "pxPerCm": 24, "cats": { "kira": { "w": 0, "h": 0, "floorY": 0, "headTopY": 0, "centerX": 0, "headWidth": 0 } } }
  ```

  in image pixels: `w` x `h` the image size, `floorY` the row where the cat
  meets the floor, `headTopY` the highest row of the head (ear tips
  included), `centerX` the column of the slot centre, `headWidth` the width
  of the head across the cheeks. Nobody wears a halo, Odin included: the
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

To make them again, with the Python that has `bpy` 4.5 installed
(deterministic; the base model is fetched from its pinned commit and
checked by hash; about 40 minutes on 4 CPU threads):

```sh
XDG_CONFIG_HOME=$(mktemp -d) nice <python with bpy> tools/blender/render_interlude.py -- \
    --out <a folder outside the repo> --encode public/interlude --threads 4
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
