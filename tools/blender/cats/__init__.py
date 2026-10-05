"""The cat generator behind THE USUAL SUSPECTS interlude.

`tools/blender/build_cats.py` is the entry point; this package does the work.
One shared pipeline turns the XR Blocks "Cat" (Apache-2.0, fetched and
hash-checked by `base.py`, never stored in the repo) into each of the four
suspects. What makes a cat itself (size, proportions, pose, coat, eyes, fur,
whiskers, halo) is data in `suspects/<name>.py`, one file per cat, so each
cat can be tuned on its own.

Modules (none shadows a standard-library module):

- `params`    deep-merged parameter dicts (unknown keys stop the build);
- `suspects`  one file per cat (kira, tom, dante, odin) and `neutral`, the
              shared defaults the generator is tested on;
- `base`      fetch, verify, import and take the base model apart;
- `vecmath`   small numpy helpers: rotations, frames, smoothstep;
- `noise`     deterministic value noise and fbm for the markings;
- `rig`       the skeleton, forward kinematics and skinning in numpy;
- `shape`     per-cat proportions as rest-pose bone transforms;
- `pose`      the line-up sit, lids, head, paws (IK) and tail;
- `catspace`  anatomical coordinates for every skin point (no UVs);
- `coat`      palette, markings helpers, strand and skin colours;
- `skin`      the body mesh, bare skin (nose, lips, rims, inner ears);
- `fur`       strands: roots, comb, length, clumps, collisions;
- `eyes`      eyeballs with a painted iris and a glass cornea;
- `whiskers`  whiskers from the base's anchors, brows and cheeks;
- `halo`      Odin's golden ring and its light;
- `stage`     tokens, world, lights, line-up camera, render settings;
- `review`    face sheets, silhouettes and the numeric muzzle guards.
"""
