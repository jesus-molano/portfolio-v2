"""The neutral cat: every shared default, a plain grey mackerel tabby.

Not a suspect. It is the reference the shared generator is tested on, and
the template for the four cats: copy a block from here into a cat's file
and change only what makes that cat itself.
"""

import numpy as np

from ..coat import bib, cheek_lines, forehead_m, mackerel, rings

NAME = "Neutral"
NUMBER = 0
EAR_TIP_CM = 35.0

SHAPE = dict(chest=1.1, belly=1.1, haunch=1.12, neck=dict(girth=1.08))
POSE = dict(
    lids=dict(L=dict(upper=0.25, lower=0.05), R=dict(upper=0.25, lower=0.05)),
)

PALETTE = {
    "ground": ("#9a948c", "#6a645d"),   # ticked grey: pale root, darker agouti tip
    "stripe": ("#45403b", "#2c2926"),
    "white": ("#ecebe6", "#f3f2ee"),
}


def markings(c):
    stripe = np.maximum.reduce([
        mackerel(c, period=0.075),
        forehead_m(c),
        cheek_lines(c),
        (c.fore + c.hind) * (1 - c.paw) * rings(c.leg_t, n=6, duty=0.35) * 0.9,
        c.tail * rings(c.tail_u, n=9, duty=0.45),
    ])
    white = bib(c, chest=0.35, belly=0.3, width=0.4)
    return {"ground": 1.0 - np.maximum(stripe, white), "stripe": stripe * (1 - white), "white": white}


FUR = {}
EYES = dict(inner="#c9c06a", outer="#8a9a4c", limbus="#38422a")
SKIN = dict(nose="#b98585")
WHISKERS = {}
HALO = {}
LIGHTS = {}
