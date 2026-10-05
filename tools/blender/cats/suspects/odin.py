"""Odin, N° 04: the little ginger tabby with the short tail, who died.

From the reference photo: a light apricot-ginger mackerel tabby, not a red
one. Mid-orange stripes (never brown) down the flanks, soft broken tabby
marks up the forehead into the crown, two faint lines back from each eye
across the cheek, faint rings on the outer faces of the legs and round the
tail. The muzzle and whisker pads are a paler ginger, not white; a small
cream chin, a pale cream rim round each eye (wider below), a paler throat,
chest and belly. A small salmon-pink nose, big upright ears pink inside.
Olive-green eyes with bronze round relaxed pupils, calm and a little
heavy-lidded, the head tilted the way he held it.

The owner: he was smaller than Kira and Tom ("era más chiquito"), a little
short-legged ("un poco paticorto") and had a shorter tail, "tampoco
exagerado, pero sí": subtle, not a caricature. So: ear tip 31 cm, forelegs
visibly shorter than hers where they leave his deeper chest (SHAPE), a tail
about half the base's with a closed, tapered tip: short but not a stump.

He sits in his slot like the others, relaxed, his weight on one haunch,
lit exactly like them. No halo: the owner decided against it.
"""

import numpy as np

from ..coat import bib, chin_white, mackerel, rings, stripes
from ..vecmath import smoothstep

NAME = "Odin"
NUMBER = 4
EAR_TIP_CM = 32.0   # visibly smaller than Kira (35) and Tom (37.7), 5 cm and more over the kitten

SHAPE = dict(
    head=1.02, jowls=1.0,                         # a tom's broad, round head, full cheeks (the short
                                                  # legs scale him up to his ear tip: 1.02 keeps it his size)
    neck=dict(length=0.88, girth=1.1),
    chest=1.14, belly=1.08, haunch=1.08,          # about 4 kg: solid, a deep chest, not chubby
    # a little short-legged. His short coat hides nothing (Kira's bib covers
    # her upper legs), so the forelegs must be visibly shorter where they
    # leave the chest: 20% shorter and stockier, the deeper chest coming
    # down onto them (spine.slump), the elbows giving a little. Measured on
    # the posed cat against his ear tip, shoulder to paw and elbow to paw
    # are about 18% shorter than Kira's; the torso is 6% shorter (it is near
    # vertical in the sit, so this lowers the chest, hardly the length you see)
    fore=dict(length=0.8, girth=1.15), hind=dict(length=0.87, girth=1.06), body_length=0.94,
    # about half the base's. The last two joints keep most of their length
    # (tip): squashing them flattens the end of the tail into a cut disc
    tail=dict(length=0.42, girth=1.0, tip=1.7),
)

POSE = dict(
    spine=dict(slump=20.0),                  # leaning in, shoulders soft: the chest down onto the short forelegs
    hips=dict(roll=10.0),                    # a lazy sit, his weight on one haunch, hind legs to one side
    head=dict(yaw=-4.0, pitch=-3.0, roll=9.0),  # toward his siblings, the head tilted as in the photo
    # both eyes turned alike in their openings (13 deg each in the report),
    # a hair off the lens: looking at it from his turned, tilted head put
    # one iris 9 deg and the other 16 deg round and read as a sideways scowl
    gaze=dict(yaw=2.5),
    # level, a little heavy: the far eye (L, turned away) opens a touch more
    # so the two read the same height; heavier lids drew a frown
    lids=dict(L=dict(upper=0.22, lower=0.06), R=dict(upper=0.25, lower=0.06)),
    # the far upper lid turned a little about the line of sight, lifting its
    # inner corner: on his tilted head it came down toward the nose (a frown)
    bones={"L_UpperEyeLid": (0.0, 0.0, -12.0)},
    ears=dict(L=dict(out=6.0, back=3.0), R=dict(out=9.0, swivel=8.0)),   # relaxed, not a matched pair
    # paws down to the floor (cm): the shorter legs fold the hind feet up and
    # leave the front ones hanging; the front ones a little ahead of the
    # elbows, so the forelegs give at the elbow, and not a mirrored pair
    paws=dict(fore=dict(L=dict(lift=-2.6, forward=1.0, out=0.3), R=dict(lift=-2.9, forward=0.3)),
              hind=dict(L=dict(lift=-1.6), R=dict(lift=-1.4))),
    tail=[(-5.5, 9.5, 2.2), (-8.5, 5.0, 2.2), (-8.0, 0.5, 2.4)],   # lying along his side, never forward
)

PALETTE = {
    # a little yellower than the photo: the lavender key pulls warm fur toward red
    "ginger": ("#dfad78", "#c68d52"),        # the light apricot ground (first: the default)
    "stripe": ("#b0652c", "#8f4f20"),        # mid-orange tabby stripes, never brown
    "pale": ("#f1d3a6", "#ebc58e"),          # muzzle, whisker pads, throat, chest, belly, inner legs
    "cream": ("#f6e9d3", "#f9eedc"),         # chin and the rims round the eyes
}

# his eyes in head units (|hx|, hf, hu; catspace.py), as on the base: the
# eyeball centre and radius scale with the head
EYE_C = (0.473, 0.007, 0.006)
EYE_R = 0.251


def markings(c):
    ax = np.abs(c.hx)
    head = c.head
    wob = 0.012 * (c.fbm(140, 41) - 0.5)
    q = np.stack([c.hx, c.hf, c.hu], 1)

    # ---- tabby: flanks, forehead lines, cheek lines, legs, tail
    flanks = 0.85 * mackerel(c, period=0.075, duty=0.38)
    # the forehead: soft tabby marks, not drawn lines. A few uneven bands up
    # into the crown (wavy, wider and narrower), broken into dashes and
    # blotches by noise, fading out at their ends and toward the brow
    mx = c.hx + 0.06 * (c.fbm(40, 42) - 0.5) + 0.03 * (c.fbm(120, 47) - 0.5)
    # (finer and denser than bars, as in the photo), kept off the brow: a
    # dark mark over the inner corners of the eyes read as a frown
    m = stripes(mx, 0.11, 0.38, soft=0.75)
    zone = head * smoothstep(0.42, 0.62, c.hu) * smoothstep(0.55, 0.38, ax) * smoothstep(-1.5, -0.6, c.hf)
    breakup = smoothstep(0.3, 0.6, c.fbm(70, 48)) * (0.7 + 0.3 * c.fbm(200, 49))
    m = 0.75 * zone * m * (0.5 + 0.5 * breakup)
    cheek = np.zeros_like(c.hx)
    for k, u0 in enumerate((-0.04, -0.3)):
        line = smoothstep(0.075, 0.01, np.abs(c.hu - u0 - 0.28 * (ax - 0.62) + 0.04 * (c.fbm(50, 43 + k) - 0.5)))
        cheek = np.maximum(cheek, line * smoothstep(0.62, 0.8, ax) * smoothstep(-0.9, -0.3, c.hf))
    cheek = head * cheek * 0.75 * (0.6 + 0.4 * c.fbm(90, 50))   # soft, broken: tabby, not ink
    legs = (c.fore + c.hind) * (1 - c.paw)
    leg_rings = (legs * rings(c.leg_t, n=6, duty=0.35, soft=0.45) * smoothstep(-0.5, 0.3, c.leg_out)
                 * smoothstep(0.15, 0.35, c.leg_t) * 0.85)
    # the short tail: his ginger with four darker rings, not a solid red-orange brush
    tail_rings = c.tail * rings(c.tail_u, n=4, duty=0.38, soft=0.35) * smoothstep(0.0, 0.15, c.tail_u)
    # a slightly darker ginger down the nose bridge, from between the eyes to the leather
    bridge = (head * smoothstep(0.16, 0.08, ax) * smoothstep(c.nose[2] + 0.02, c.nose[2] + 0.12, c.hu)
              * smoothstep(0.35, 0.2, c.hu) * smoothstep(0.3, 0.5, c.hf))
    stripe = np.maximum.reduce([flanks, m, cheek, leg_rings, 0.85 * tail_rings, 0.35 * bridge])

    # ---- pale: the muzzle and pads (paler ginger round the nose), throat,
    # chest and belly, the inner faces of the legs
    pads = head * smoothstep(0.55, 0.32, np.linalg.norm((q - c.nose) * [0.85, 1.0, 1.0], axis=1))
    pads = pads * smoothstep(0.2, 0.45, c.hf)
    pads = pads * (0.3 + 0.7 * smoothstep(c.nose[2] + 0.1, c.nose[2] - 0.05, c.hu))   # the bridge stays ginger
    spots = (pads * stripes(c.hu - c.nose[2] + 0.03 * (c.fbm(150, 44) - 0.5), 0.085, 0.35, soft=0.6)
             * stripes(ax + 0.02 * (c.fbm(40, 45) - 0.5), 0.085, 0.45, soft=0.6) * smoothstep(0.42, 0.22, ax)
             * smoothstep(0.08, 0.2, ax) * smoothstep(c.nose[2] - 0.02, c.nose[2] - 0.12, c.hu))
    inner_legs = legs * smoothstep(0.1, -0.5, c.leg_out) * 0.6
    # the paws stay ginger, the toes only a little lighter (no cream mittens)
    pale = np.maximum.reduce([0.9 * pads, bib(c, chin=False, chest=0.35, belly=0.6, width=0.4), inner_legs,
                              0.2 * c.paw])

    # ---- cream: the chin and a rim round each eye, wider below it
    g = np.sqrt((ax - EYE_C[0]) ** 2 + (c.hf - EYE_C[1]) ** 2 + (c.hu - EYE_C[2]) ** 2) - EYE_R
    below = smoothstep(0.05, -0.2, c.hu - EYE_C[2])
    rim_out = 0.05 + 0.05 * below
    rim = head * smoothstep(rim_out + 0.02, rim_out - 0.02, g + wob) * 0.9
    cream = np.maximum.reduce([0.8 * chin_white(c, up=-0.56), rim])   # a small chin, not a white goatee

    stripe = np.clip(stripe + 0.5 * spots, 0, 1) * (1 - cream)
    pale = pale * (1 - cream) * (1 - 0.7 * stripe)
    ginger = np.clip(1 - stripe - pale - cream, 0, 1)
    return {"ginger": ginger, "stripe": stripe, "pale": pale, "cream": cream}


FUR = dict(
    # short-haired, a little longer on the cheeks and the tail; soft and
    # layered like the others' coats (clumps, a little frizz, guard hairs)
    points=7,
    clump=0.5,
    clump_size=4.0,
    frizz=0.03,
    spread=12.0,
    guard=dict(share=0.05, length=1.3, lift=7.0),
    length=dict(body=12.0, chest=13.0, belly=13.0, neck=12.0, face=5.0, muzzle=2.5, chin=4.0, cheek=8.0,
                ear=3.0, fore=7.0, hind=9.0, paw=4.0, tail=11.0, tail_tip=4.0),   # his short coat on the
                                                                                   # tail too, closing over the tip
    inner_ear_density=1.0,                         # pale hairs over the pink, as on him
)
# olive green with bronze round the pupil, as in the photo; relaxed wide
# oval pupils (narrow slits read as menace)
EYES = dict(inner="#b8963f", outer="#7f914f", limbus="#3f3d27", pupil=dict(width=0.5, height=0.86))
# a small salmon-pink nose; a soft brown lip line (near-black drew a cartoon mouth on the cream chin)
SKIN = dict(nose="#df8f86", inner_ear="#cfa999", nose_size=0.88, lips="#7c5246")   # inner ears pinkish beige
WHISKERS = dict(colour="#f6eee2", droop=4.0)
HALO = {}   # the owner: no halo; he is simply one of the four, lit like the others
LIGHTS = dict(rim=0.6, kicker=0.75)   # as the other short coats: the pink rim draws an edge, not a flank
