"""Dante, N° 03: six months old, the smallest; a cream lynx-point kitten.

From the reference photo: a pale warm cream coat, semi-long and fluffy as a
kitten's is, with the points only just coming in. The face is mostly cream:
a caramel-fawn bridge from between the eyes down to a small rose nose, a
fawn line from each inner eye corner down the side of the nose, rows of
dark whisker spots on the pads and dark grey-brown shading round the nose
and the upper lip; faint fawn tabby lines up the forehead; a thin dark
liner round each eye with a pale ring outside it (the "spectacles").
Very big, broad ears set wide, pink inside with long pale furnishings,
fawn-grey on the back darkening to near-black tips and tufts. Pale ice-blue
eyes, a little relaxed. Light fawn on the lower legs, a fawn ringed tail.

In the line-up: small and curious, head tilted, a paw up as if about to
bat at his placard, sitting soft with his tail round on the floor.
"""

import numpy as np

from ..coat import band, rings, stripes
from ..vecmath import smoothstep

NAME = "Dante"
NUMBER = 3
ADULT = False
EAR_TIP_CM = 26.4   # the smallest by a clear margin: his head at least 5 cm under the others' on the chart

# a six-month kitten of about 2.8 kg: a big head on a slight body, very big
# broad ears, big eyes, a short neck (the fluff hides it), lanky legs
SHAPE = dict(
    head=1.24, ears=1.25, ear_height=0.95, eyes=1.06,
    jowls=0.4,                               # a rounder kitten face (the cheek joints only)
    neck=dict(length=0.72, girth=1.05),
    chest=0.92, belly=0.9, haunch=1.0,
    fore=dict(length=1.0, girth=1.12), hind=dict(length=1.02, girth=1.08),   # kitten legs, not sticks
    paws=1.04,
    tail=dict(length=1.15, girth=0.85),      # a kitten's long tail: it reaches round to his paws
)

POSE = dict(
    spine=dict(slump=6.0),                   # shoulders soft, not standing to attention
    hips=dict(roll=6.0),                     # his weight a little on one haunch
    head=dict(roll=13.0, pitch=6.0),          # the curious tilt, as in the photo; chin up
    # curious but soft, as in the photo: the upper lids well down, no white
    # showing round the iris, not a matched pair
    lids=dict(L=dict(upper=0.4, lower=0.1), R=dict(upper=0.37, lower=0.1)),
    ears=dict(L=dict(back=-6.0, out=16.0), R=dict(back=-6.0, out=16.0)),   # big ears, pricked, set wide
    paws=dict(fore=dict(R=dict(lift=2.0, forward=1.5))),  # about to bat at the placard
    # on the floor from behind him round his left haunch (image right),
    # the tip curling forward toward his paws
    tail=[(2.5, 9.8, 2.0), (5.5, 7.5, 2.0), (6.6, 4.0, 2.0), (5.8, 0.5, 2.0), (3.8, -2.5, 2.2)],
)

PALETTE = {
    # hues a little yellower than the photo's: the violet set pulls cream
    # toward lilac grey
    "cream": ("#efd4a8", "#f5e3c4"),         # the body (first: the default)
    "pale": ("#ecd3ac", "#f3e0c0"),          # the cheeks under the eyes
    # the long coat of the trunk, legs and tail, and the chest and belly:
    # warmer than the head's cream because at full density the coat's
    # colour is mostly lost on the violet set (the near-white chest read as
    # cool grey, a second white cat next to Tom)
    "coat": ("#eac38c", "#f0d4a6"),
    "bib": ("#ecca96", "#f2d9b0"),
    "white": ("#f4e8d2", "#faf2e4"),         # the near-white: chin, the ring round the eyes, inside the ears
    "fawn": ("#cfb48a", "#b0956a"),          # the points' ground: bridge, ear backs, legs, tail
    "fawn_stripe": ("#957a60", "#735b47"),   # tabby lines on the points
    "mask": ("#b39470", "#9c7e5e"),          # the lynx mask: bridge and muzzle, darker than the points
    "dark": ("#45372f", "#2f2520"),          # liner, whisker spots, ear tips
}

# His eyes in head units (|hx|, hf, hu; head frame of catspace.py), measured
# on the pinned base: the eyeball centre, and its radius, 0.251 at eyes=1
# (0 at the lid edge all round the opening); the eye scale grows it about
# the centre
EYE_C = (0.47, 0.008, 0.007)
EYE_R = 0.251 * SHAPE["eyes"]
# the fawn line from the inner corner of each eye down the side of the nose
TEAR = [(0.22, 0.42, -0.02), (0.24, 0.55, -0.14), (0.27, 0.66, -0.27), (0.30, 0.72, -0.38)]


def _to_line(X, pts):
    """Distance from points X (n, 3) to a polyline, and the share along it (0 at its start)."""
    P = np.asarray(pts, float)
    seg = np.diff(P, axis=0)
    lens = np.linalg.norm(seg, axis=1)
    cum = np.concatenate([[0.0], np.cumsum(lens)])
    best = np.full(len(X), np.inf)
    along = np.zeros(len(X))
    for i in range(len(seg)):
        t = np.clip((X - P[i]) @ seg[i] / lens[i] ** 2, 0, 1)
        d = np.linalg.norm(X - P[i] - t[:, None] * seg[i], axis=1)
        m = d < best
        best[m], along[m] = d[m], (cum[i] + t[m] * lens[i]) / cum[-1]
    return best, along


def eye_gap(c):
    """Distance from the nearer eyeball's surface, in head units (0 at the lid edge)."""
    return np.sqrt((np.abs(c.hx) - EYE_C[0]) ** 2 + (c.hf - EYE_C[1]) ** 2 + (c.hu - EYE_C[2]) ** 2) - EYE_R


def markings(c):
    ax = np.abs(c.hx)
    head = c.head
    legs = (c.fore + c.hind) * (1 - c.paw)
    n_mid = c.fbm(40, 61)
    n_hi = c.fbm(150, 62)
    wob = 0.012 * (c.fbm(140, 63) - 0.5)
    nose_u = c.nose[2]

    # ---- the eyes: a thin dark liner on the lid edge, a pale ring outside
    g = eye_gap(c)
    below = smoothstep(0.05, -0.2, c.hu - EYE_C[2])
    th = 0.034 + 0.01 * below + 0.008 * smoothstep(0.6, 0.75, ax)
    liner = head * smoothstep(th + 0.012, th, g + wob)
    ring_out = 0.08 + 0.1 * below   # narrow: a wide pale ring reads as white round the iris
    ring = head * smoothstep(th, th + 0.02, g) * smoothstep(ring_out + 0.03, ring_out - 0.03, g + 2 * wob)

    # ---- fawn on the face: the bridge, the tear lines, the muzzle
    # the bridge: narrow and greyish between the eyes, a warm caramel band
    # widening down to the nose leather
    bw = np.interp(c.hu, [-0.35, -0.2, 0.0, 0.2, 0.4], [0.2, 0.17, 0.11, 0.09, 0.07])
    bridge = (head * smoothstep(bw + 0.03, bw - 0.03, ax + wob) * band(c.hu, nose_u + 0.02, 0.45, 0.06)
              * smoothstep(0.2, 0.45, c.hf))
    bridge_k = 0.62 + 0.38 * smoothstep(0.1, -0.2, c.hu)   # the lynx mask: the bridge must read at 48 px
    X = np.stack([ax, c.hf, c.hu], 1)
    d_t, t_t = _to_line(X, TEAR)
    tear = head * smoothstep(0.045, 0.02, d_t + wob) * smoothstep(1.0, 0.8, t_t)
    # the whisker pads: a fawn wash, rows of dark spots, darker toward the
    # nose and the upper lip; the chin stays pale
    lip_u = -0.62 - 0.6 * np.minimum(ax, 0.42)
    pad = (head * band(ax, 0.1, 0.48, 0.06) * smoothstep(nose_u + 0.06, nose_u - 0.04, c.hu)
           * smoothstep(lip_u - 0.04, lip_u + 0.04, c.hu) * smoothstep(0.3, 0.5, c.hf))
    rows = stripes(c.hu - nose_u + 0.03 * (n_hi - 0.5), 0.085, 0.42, soft=0.5)
    cols = stripes(ax + 0.02 * (n_mid - 0.5), 0.085, 0.5, soft=0.6)
    spots = pad * rows * cols * smoothstep(0.48, 0.3, ax) * (0.7 + 0.3 * smoothstep(0.3, 0.55, n_hi))
    nose_rim = (head * smoothstep(0.26, 0.18, ax) * band(c.hu, nose_u - 0.3, nose_u + 0.05, 0.05)
                * smoothstep(0.55, 0.75, c.hf))
    philtrum = head * smoothstep(0.04, 0.015, ax) * band(c.hu, -0.64, -0.52, 0.03) * smoothstep(0.6, 0.75, c.hf)
    # pale under the eyes and on the outer pads and the cheeks, as in the photo
    cheek = head * smoothstep(0.3, 0.55, ax) * band(c.hu, -0.75, -0.12, 0.1) * smoothstep(-0.4, 0.1, c.hf)
    chin = head * smoothstep(lip_u + 0.02, lip_u - 0.06, c.hu)
    # ---- forehead: faint fawn tabby lines up to a fawn-washed crown, faint
    # lines back from the outer eye corners
    mx = c.hx + 0.03 * (c.fbm(55, 64) - 0.5)
    lines = (head * stripes(mx, 0.15, 0.4, soft=0.6) * band(c.hu, 0.3, 1.1, 0.1)
             * smoothstep(0.5, 0.35, ax) * smoothstep(-1.4, -0.8, c.hf))
    lines = lines * (0.55 + 0.45 * smoothstep(0.35, 0.6, n_mid))
    crown = head * smoothstep(0.3, 0.75, c.hu) * smoothstep(0.9, 0.4, ax) * smoothstep(-1.6, -0.9, c.hf)
    cheek_line = (head * smoothstep(0.05, 0.02, np.abs(c.hu + 0.02 - 0.3 * (ax - 0.72) + 0.02 * (n_mid - 0.5)))
                  * smoothstep(0.7, 0.8, ax) * smoothstep(-0.5, 0.0, c.hf))

    # ---- ears: fawn-grey backs darkening to near-black tips and rims
    facing = c.n @ c.frame[:, 1]
    inner = c.ear * smoothstep(0.1, 0.4, facing)              # the opening: pale hairs over the pink
    back = c.ear * smoothstep(0.25, -0.1, facing)
    tip = c.ear * smoothstep(0.7, 0.9, c.ear_t)
    ear_fawn = c.ear * smoothstep(0.0, 0.4, c.ear_t) * (0.6 + 0.4 * back) * (1 - inner)
    ear_rim = c.ear * band(facing, -0.1, 0.25, 0.1) * smoothstep(0.35, 0.7, c.ear_t)   # grey-brown edges

    # ---- legs and tail: light fawn points, faint rings on the backs of the
    # legs; the tail fawn with darker rings and a dark tip
    lower = legs * smoothstep(0.4, 0.75, c.leg_t)
    leg_rings = lower * rings(c.leg_t, n=7, duty=0.35, soft=0.5) * smoothstep(0.2, -0.4, c.leg_front)
    paws = c.paw * 0.25
    tl = c.tail * smoothstep(0.0, 0.25, c.tail_u)
    tail_r = tl * rings(c.tail_u, n=8, duty=0.42, soft=0.45)
    tail_tip = c.tail * smoothstep(0.82, 0.97, c.tail_u)
    spine = (c.body + c.neck) * smoothstep(0.45, 0.9, c.dorsal) * 0.22

    dark = np.clip(np.maximum.reduce([liner, spots, 0.7 * nose_rim, 0.5 * philtrum, tip, 0.6 * tail_tip]), 0, 1)
    stripe = np.clip(np.maximum.reduce([0.8 * tear, 0.45 * lines, 0.35 * cheek_line, 0.55 * leg_rings, 0.7 * tail_r,
                                        0.7 * ear_rim]), 0, 1)
    near_nose = smoothstep(0.38, 0.18, ax)
    mask = np.clip(np.maximum(bridge_k * bridge, 0.6 * pad * near_nose), 0, 1)
    fawn = np.clip(np.maximum.reduce([0.22 * crown, 0.85 * ear_fawn,
                                      0.45 * lower, paws, 0.75 * tl, spine]), 0, 1)
    white = np.clip(np.maximum.reduce([0.6 * ring, 0.85 * chin, inner]), 0, 1)
    pale = np.clip(np.maximum(0.6 * cheek, _bib(c)), 0, 1)
    stripe = stripe * (1 - dark)
    mask = mask * (1 - dark) * (1 - stripe)
    fawn = fawn * (1 - dark) * (1 - stripe) * (1 - mask)
    white = white * (1 - dark) * (1 - stripe) * (1 - mask) * (1 - fawn)
    pale = pale * (1 - dark) * (1 - stripe) * (1 - mask) * (1 - fawn) * (1 - white)
    cream = np.clip(1 - dark - stripe - mask - fawn - white - pale, 0, 1)
    # off the head the long coat takes the warmer pair
    body = 1 - np.clip(head, 0, 1)
    return {"cream": cream * (1 - body), "coat": cream * body, "pale": pale * (1 - body), "bib": pale * body,
            "white": white, "fawn": fawn, "fawn_stripe": stripe, "mask": mask, "dark": dark}


def _bib(c):
    """A paler throat and chest, soft edged."""
    edge = 0.12 * (c.fbm(28, 65) - 0.5)
    under = -c.dorsal + edge
    trunk = c.body + c.neck
    return 0.5 * trunk * smoothstep(0.35, 0.65, under) * smoothstep(0.6, 0.3, c.s)


FUR = dict(
    # soft, dense, layered kitten fluff (the set's level, Kira's), not wisps:
    # less frizz and scatter, the tips lying down a little
    # the set's coverage: density x length about Kira's (120 x 38-44 mm);
    # denser, the long pale coat lost its cream under the set's lights
    density=155.0,
    points=10,
    gravity=0.18,
    clump=0.52,
    clump_size=4.2,
    frizz=0.03,
    spread=12.0,
    guard=dict(share=0.04, length=1.25, lift=6.0),
    length=dict(body=28.0, chest=32.0, belly=32.0, neck=30.0, ruff=36.0, face=6.0, muzzle=2.8, chin=5.5,
                cheek=15.0, brow=6.0, ear=3.5, ear_inner=8.0, fore=16.0, hind=21.0, britches=30.0, paw=6.0,
                toe_tuft=7.0, tail=30.0),
    lift=dict(body=(32.0, 6.0), face=(18.0, 6.0), tail=(32.0, 8.0), legs=(30.0, 6.0)),
    inner_ear_density=1.0,
    furnish=dict(length=16.0, count=7000, colour="#f1e9dc"),   # long pale furnishings fill the opening
    lynx=dict(length=16.0, count=150, colour="#2e2520"),
)
# pale ice blue, greyer than a Siamese sapphire, a darker blue-grey ring
EYES = dict(inner="#bccbd8", outer="#8a9db3", limbus="#46546a", sclera="#4a5a6e",
            pupil=dict(width=0.3, height=0.62))   # daylight pupils, as in the photo, a touch softer than slits
# a small dusky-rose nose; the skin inside the ears a muted pink under the furnishings
SKIN = dict(nose="#845654", nose_size=0.78, inner_ear="#a47f80", lips="#7e6462", rims="#3e3030")
WHISKERS = dict(forward=12.0, length=0.9)
HALO = {}
LIGHTS = dict(rim=0.4, kicker=0.55)   # a pale semi-long coat throws the pink rim back hard: keep him cream
