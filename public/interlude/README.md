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

## What is here now

Placeholders: flat violet silhouettes made by
`node tools/art/suspects/placeholder.mjs` (signed distance fields, no
inputs, deterministic; encoded by `tools/art/suspects/encode.py` with
Pillow), at seated heights in the cats' real size order: Tom the biggest
and a bit chubby (31 cm, only just over Kira), Kira a normal adult (30),
Odin smaller than both, a little short in the leg and with a shorter tail
(27), and Dante, a kitten of six months, the smallest (20). They are
original work made for this site and need no licence.

The Blender renders of the four cats (`tools/blender/build_cats.py`, the
cats package) replace them under the same file names, with their own
manifest and this README rewritten to say how they were made and the
licence of every input.
