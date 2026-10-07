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

`states.py` holds the select screen's states of three of them (Kira's back,
Tom asleep, Dante's swipe): `load("tom-asleep")` is Tom's spec with the
state's pose deep-merged in, under his own key (so his own fur), and with
`layer` set to the state's name.
"""

import copy
import importlib

from .states import STATES

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
        self.claws = getattr(mod, "CLAWS", {})   # {paw key: claws.py params}: unsheathed claws
        self.layer = key   # the files' name: the cat's key, or a state's (states.py)


def load(key):
    if key in STATES:
        state = STATES[key]
        spec = load(state["cat"])
        # the cat's own values with the state's on top; the generator merges
        # the result with its defaults, which still refuses an unknown key
        spec.pose = _over(spec.pose, state.get("pose", {}))
        spec.eyes = _over(spec.eyes, state.get("eyes", {}))
        spec.claws = state.get("claws", spec.claws)
        spec.layer = key
        return spec
    if key not in ALL:
        raise SystemExit(f"unknown cat {key!r}; one of {', '.join(ALL + tuple(STATES))}")
    return Spec(key, importlib.import_module(f"{__name__}.{key}"))


def _over(base, new):
    """base deep-updated by new (a copy; dicts merge, anything else replaces)."""
    out = copy.deepcopy(base)
    for k, v in new.items():
        out[k] = _over(out[k], v) if isinstance(out.get(k), dict) and isinstance(v, dict) else copy.deepcopy(v)
    return out
