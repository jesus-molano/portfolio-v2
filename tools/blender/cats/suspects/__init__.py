"""One file per cat: everything that makes a suspect itself, as data.

Each module here (kira, tom, dante, odin, and `neutral`, the reference cat
the shared code is tested on) defines:

- NAME, NUMBER (the placard), ADULT (False for a kitten: looser guards);
- EAR_TIP_CM: the posed ear-tip height; the whole cat is scaled to it, so
  the height chart reads true;
- SHAPE: proportions (shape.DEFAULT keys);
- POSE: the line-up sit and the face (pose.DEFAULT keys);
- PALETTE: {colour name: (root hex, tip hex) or hex}, the first is the
  default colour;
- markings(c): weights per palette colour for the points of a CatSpace `c`
  (coat.py has the shared helpers: tabby stripes, rings, bib, mittens,
  points, patches, the forehead M, cheek lines);
- FUR, EYES, SKIN, WHISKERS, HALO: fur.DEFAULT, eyes.DEFAULT, skin.DEFAULT,
  whiskers.DEFAULT, halo.DEFAULT keys;
- LIGHTS: gains of the shared rig's lights for this cat (key, rim, kicker,
  hair), used sparingly: the line-up is one lighting set.

Anything left out takes the shared default. Unknown keys stop the build.
Nothing here is personal data; the reference photos never enter the repo.
"""

import importlib

CATS = ("kira", "tom", "dante", "odin")
ALL = CATS + ("neutral",)


class Spec:
    def __init__(self, key, mod):
        self.key = key
        self.name = getattr(mod, "NAME", key.title())
        self.number = getattr(mod, "NUMBER", 0)
        self.adult = getattr(mod, "ADULT", True)
        self.ear_tip_cm = float(mod.EAR_TIP_CM)
        self.shape = getattr(mod, "SHAPE", {})
        self.pose = getattr(mod, "POSE", {})
        self.palette = mod.PALETTE
        self.markings = mod.markings
        self.fur = getattr(mod, "FUR", {})
        self.eyes = getattr(mod, "EYES", {})
        self.skin = getattr(mod, "SKIN", {})
        self.whiskers = getattr(mod, "WHISKERS", {})
        self.halo = getattr(mod, "HALO", {})
        self.lights = getattr(mod, "LIGHTS", {})


def load(key):
    if key not in ALL:
        raise SystemExit(f"unknown cat {key!r}; one of {', '.join(ALL)}")
    return Spec(key, importlib.import_module(f"{__name__}.{key}"))
