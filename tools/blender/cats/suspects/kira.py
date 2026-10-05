"""Kira, N° 01: almost 4, a long-haired tortoiseshell tabby ("torbie").

From the reference photo: a light, golden-fawn brown tabby rather than a
dark one. The ground is a ticked fawn-grey; black broken stripes and spots
crowd the forehead and the back; ginger is brindled through the coat in
small patches and sprinkles (the stripes carry on through them), with a
peach flame up the middle of the forehead between two dark stripes, ginger
on the front of the forelegs and above the hind socks. A dark brown bridge
down to a small dusty-pink nose. Her "Egyptian" eyes: a crisp near-black
liner all round each lid edge, a dark Cleopatra line from the outer corner
back and a little down across the cheek with a thinner one below it, and a
pale cream ring round the liner (wider under the eye) that makes it stand
out. Buff cheeks with broken tabby marks, a fawn tabby muzzle with rows of
whisker spots, paling to cream at the upper lip; a buff chin, white under
the jaw, a white throat and a bib down the chest to the belly, white paws
and hind socks. Olive-green eyes, big upright ears with pale
furnishings, a long fluffy tail. Semi-long coat: a neck ruff and britches,
not a Persian.

In the line-up: fluffy and unimpressed, heavy-lidded, the plume wrapped
round from camera-left with its tip in front of her paws.
"""

import numpy as np

from ..coat import band, mackerel, patches, rings, stripes
from ..vecmath import smoothstep

NAME = "Kira"
NUMBER = 1
EAR_TIP_CM = 35.0   # a normal adult female (the owner: 34-35 cm); Tom stands under 3 cm over her

SHAPE = dict(
    head=1.05, ears=1.04, ear_height=1.04,       # a big fluffy head and big ears (photo)
    neck=dict(length=0.9, girth=1.08),
    chest=1.05, belly=1.06, haunch=1.1,
    tail=dict(length=1.45, girth=1.0),            # long: the plume reaches round to her paws
)

POSE = dict(
    spine=dict(slump=6.0),                   # shoulders soft, not standing to attention
    hips=dict(roll=-4.0),                    # her weight a little on one haunch
    # the face turned a little away from the others, a slight tilt; the eyes
    # still on the lens: a sideways, unimpressed look
    head=dict(pitch=-6.0, yaw=-6.0, roll=4.0),
    lids=dict(L=dict(upper=0.37, lower=0.04), R=dict(upper=0.34, lower=0.04)),  # unimpressed, heavy-lidded
    ears=dict(L=dict(out=10.0, back=5.0), R=dict(out=7.0, back=3.0, swivel=6.0)),   # not a matched pair
    # the front paws not a mirrored pair: the right one (image left) a little
    # ahead and out, the left one (behind the tail's tip) a little back
    paws=dict(fore=dict(L=dict(forward=-0.4), R=dict(forward=0.8, out=0.3))),
    # from behind her, round her right haunch (camera-left), the tip across
    # the front of her paws
    tail=[(-4.5, 11.5, 2.4), (-8.0, 6.5, 2.4), (-9.0, 0.0, 2.4), (-6.5, -6.0, 2.4), (-1.0, -8.5, 2.6),
          (3.0, -8.0, 2.8)],
)

PALETTE = {
    # hues sit about 12 degrees yellower than the photo's: the lavender key
    # and the violet world pull warm fur toward red
    "ground": ("#9e8e66", "#5f5034"),        # the ticked golden-fawn ground (first: the default)
    "ticked": ("#66583e", "#30271a"),        # darker agouti hairs mixed through it
    "black": ("#29251d", "#171410"),         # tabby stripes, the eye liner and Cleopatra lines
    "ginger": ("#dbac6e", "#b88149"),        # peach-ginger
    "ginger_stripe": ("#99663a", "#7a4a27"),
    "cream": ("#e0d6b4", "#ccbe97"),         # the pale ring round the liner, cheeks, a wash on the pads
    "white": ("#f0ede7", "#f6f3ee"),
}

# Her eyes in head units (|hx|, hf, hu; head frame of catspace.py), measured
# on the pinned base with her shape (they scale with the head): the eyeball
# centre and radius. The distance from the eyeball's surface is 0 at the lid
# edge all round the opening (the generator's own eye mask agrees to 0.9999).
EYE_C = (0.473, 0.007, 0.006)
EYE_R = 0.251
# The Cleopatra lines: points on her skin, (|hx|, hf, hu), from the visible
# outer corner of the eye out over the brow of the cheekbone and back along
# the side of the head toward the ear base, a little downhill; the second,
# thinner one starts on the cheek under the outer half of the eye.
CLEO = (
    [(0.72, 0.159, 0.05), (0.76, 0.132, 0.04), (0.80, 0.098, 0.03), (0.85, 0.008, 0.01), (0.90, -0.091, -0.015),
     (0.95, -0.199, -0.045), (1.012, -0.4, -0.09), (1.045, -0.62, -0.14), (1.068, -0.85, -0.2)],
    [(0.74, 0.33, -0.28), (0.80, 0.264, -0.29), (0.88, 0.101, -0.30), (0.95, -0.049, -0.31), (1.0, -0.244, -0.32),
     (1.06, -0.45, -0.345)],
)


def _to_line(X, pts):
    """Distance from points X (n, d) to a polyline, and the share along it (0 at its start, 1 at its end)."""
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


def _eyes(c):
    """The Egyptian eye: (dark lines, pale ring), weights in [0, 1].

    The liner covers the lid edge out to 0.065 head units under the eye
    (about 2.6 mm on her, 3 px at the line-up's 12 px/cm, before the short
    fur there carries it a little further out) and 0.05 over it (the
    lowered lid shows more of itself), heavier toward the outer corner where
    it runs into the Cleopatra line; the lines taper toward the ear; the
    ring runs from the liner to 0.15 head units, 0.2 under the eye, and is
    paler under the eye than over it.
    """
    g = eye_gap(c)
    ax = np.abs(c.hx)
    X = np.stack([ax, c.hf, c.hu], 1)
    wob = 0.01 * (c.fbm(140, 52) - 0.5)
    wing = 0.025 * smoothstep(0.55, 0.72, ax)
    th = 0.05 + 0.015 * smoothstep(0.1, -0.05, c.hu - EYE_C[2]) + wing
    liner = smoothstep(th + 0.015, th, g + wob)
    d1, t1 = _to_line(X, CLEO[0])
    w1 = 0.036 - 0.018 * t1
    cleo = smoothstep(w1 + 0.008, w1 - 0.008, d1 + wob) * smoothstep(1.0, 0.82, t1)
    d2, t2 = _to_line(X, CLEO[1])
    w2 = 0.03 - 0.012 * t2
    cleo2 = smoothstep(w2 + 0.007, w2 - 0.007, d2 + wob) * smoothstep(1.0, 0.75, t2) * smoothstep(0.0, 0.08, t2)
    lines = c.head * np.maximum.reduce([liner, cleo, cleo2])
    below = smoothstep(0.05, -0.2, c.hu - EYE_C[2])
    outer = 0.15 + 0.05 * below
    ring = c.head * smoothstep(0.06, 0.085, g) * smoothstep(outer + 0.03, outer - 0.03, g + 2 * wob)
    ring = ring * (0.5 + 0.5 * below)                        # paler under the eye than over it
    return lines, ring * (1 - lines)


def _lip_line(c):
    """Head-unit height of her mouth line at each point's |hx| (lower under the jaw), a little ragged."""
    ax = np.abs(c.hx)
    line = -0.68 - 0.55 * np.minimum(ax, 0.45) - 0.15 * smoothstep(0.5, 0.0, c.hf)
    return line + 0.05 * (c.fbm(60, 32) - 0.5)


def _white(c):
    """Chin, throat, a broad bib down the chest to the belly, paws and hind socks."""
    edge = 0.16 * (c.fbm(28, 31) - 0.5)
    under = -c.dorsal + edge                       # +1 under the trunk
    trunk = c.body + c.neck
    # how far up the sides the white climbs, along the spine: broad on the
    # throat, a bib on the upper chest narrowing to a strip between the
    # forelegs, the belly
    climb = np.interp(c.s, [-0.4, -0.25, -0.1, 0.05, 0.15, 0.3, 0.5, 0.75, 0.95],
                      [0.4, 0.45, 0.52, 0.66, 0.75, 0.8, 0.65, 0.55, 0.8])
    bib = trunk * smoothstep(climb - 0.06, climb + 0.06, under) * smoothstep(1.02, 0.9, c.s)
    # the head's underside: under the chin and the jaw back to the throat,
    # well below the lip line (which drops from -0.66 head units on the
    # midline toward the mouth corners and lower still under the jaw): the
    # upper lip and the pads above it stay fawn tabby, the chin itself is buff
    # (a white chin under the level line-up camera reads as a pout or teeth)
    ax = np.abs(c.hx)
    line = _lip_line(c)
    wide = 0.3 + 0.3 * smoothstep(0.6, -0.4, c.hf)
    jaw = (c.head * smoothstep(-0.14, -0.26, c.hu - line) * smoothstep(wide + 0.08, wide - 0.08, ax)
           * smoothstep(-1.4, -0.9, c.hf))
    # paws: front mittens over the toes, hind socks up the back of the leg
    e2 = 0.05 * (c.fbm(40, 33) - 0.5)
    fore = c.fore * smoothstep(0.8, 0.86, c.leg_t + e2)
    hind = c.hind * smoothstep(0.66, 0.72, c.leg_t + e2 + 0.06 * smoothstep(0.2, -0.6, c.leg_front))
    return np.clip(np.maximum.reduce([bib, jaw, fore, hind]), 0, 1)


def markings(c):
    ax = np.abs(c.hx)
    q = np.stack([c.hx, c.hf, c.hu], 1)
    trunk = c.body + c.neck
    legs = (c.fore + c.hind) * (1 - c.paw)
    n_lo = c.fbm(12, 41)
    n_mid = c.fbm(40, 42)
    n_hi = c.fbm(150, 43)

    # ---- black: the tabby
    mack = mackerel(c, period=0.09, duty=0.42, warp=0.9, seed=44)
    mack = mack * smoothstep(0.28, 0.46, n_mid)                          # broken, torbie style
    blotch = trunk * smoothstep(0.25, 0.7, c.dorsal) * smoothstep(0.5, 0.62, n_lo)  # dark saddle spots
    # the forehead: broken lines up from the brows over the crown (the tabby
    # M), one each side of the blaze and two more toward each ear, about 4 mm
    # wide and broken into dashes; dark spots on the crown and the nape. A
    # black share of 0.8 lets ticked hairs through, so they read as pencil
    mx = c.hx + 0.04 * (c.fbm(55, 45) - 0.5) - 0.05 * smoothstep(0.45, 0.1, c.hu) * np.sign(c.hx)
    fore_m = (c.head * stripes(mx, 0.18, 0.5, soft=0.5) * band(c.hu, 0.12, 1.4, 0.08)
              * smoothstep(0.66, 0.5, ax) * smoothstep(-1.7, -1.1, c.hf))
    dash = smoothstep(0.3, 0.45, c.fbm(90, 46)) * (0.55 + 0.45 * smoothstep(0.3, 0.5, c.fbm(240, 51)))
    fore_m = fore_m * dash
    brows = c.head * band(c.hu, 0.2, 0.4, 0.06) * band(ax, 0.25, 0.7, 0.06) * smoothstep(0.4, 0.55, n_hi) * 0.6
    crown = c.head * smoothstep(0.45, 0.7, c.hu) * smoothstep(0.42, 0.58, n_mid) * smoothstep(-1.6, -0.6, c.hf)
    tear = (c.head * smoothstep(0.05, 0.0, np.abs(ax - 0.2 - 0.25 * (0.05 - c.hu))) * band(c.hu, -0.12, 0.08)
            * smoothstep(0.3, 0.5, c.hf))                               # dark lines at the inner eye corners
    leg_r = legs * rings(c.leg_t, n=7, duty=0.38, soft=0.4) * smoothstep(0.3, 0.5, n_mid + 0.1)
    tail_r = c.tail * rings(c.tail_u, n=9, duty=0.42, soft=0.4) * (0.6 + 0.4 * smoothstep(0.3, 0.6, n_mid))
    # whisker-spot rows on the pads: the muzzle is fawn tabby, not white
    dn = np.linalg.norm((q - c.nose) * [0.85, 1.0, 1.1], axis=1)
    pad = c.head * smoothstep(0.6, 0.4, dn) * smoothstep(c.nose[2] + 0.05, c.nose[2] - 0.05, c.hu) \
        * smoothstep(0.12, 0.22, ax)
    spots = pad * stripes(c.hu - c.nose[2], 0.075, 0.35, soft=0.6) * smoothstep(0.42, 0.56, n_hi) * 0.85
    # ---- ginger: small patches and a brindle sprinkle, the forehead blaze,
    # the front of the forelegs, above the hind socks. The blaze is a soft
    # peach flame from the brows up to the crown, widest at the top, on the
    # midline and leaning to her left, with dark ticks through it
    sx = 0.05 + 0.02 * np.sin(6.0 * c.hu)
    sw = np.interp(c.hu, [0.2, 0.35, 0.55, 0.8], [0.02, 0.055, 0.07, 0.04]) * (1 + 0.7 * (c.fbm(80, 49) - 0.5))
    streak = (c.head * smoothstep(0.03, -0.03, np.abs(c.hx - sx) - sw) * band(c.hu, 0.26, 0.8, 0.1)
              * smoothstep(-0.7, -0.2, c.hf))
    # the bridge of the nose: a dark brown band from between the eyes down
    # to the nose leather
    bridge = (c.head * smoothstep(0.17, 0.07, ax) * band(c.hu, -0.25, 0.3, 0.06) * smoothstep(0.35, 0.55, c.hf)
              * (0.35 + 0.15 * smoothstep(0.3, 0.6, n_hi)))
    # the cheeks: broken dark tabby marks behind and below the pale ring
    cheek_k = (c.head * smoothstep(0.5, 0.75, ax) * band(c.hu, -0.65, -0.05, 0.08) * smoothstep(-0.7, -0.2, c.hf)
               * smoothstep(0.45, 0.58, c.fbm(70, 47)) * 0.7)
    k = np.clip(np.maximum.reduce([mack, blotch, fore_m, brows, crown, tear, bridge, spots, cheek_k, leg_r, tail_r]),
                0, 1)
    k = k * (1 - 0.35 * smoothstep(0.05, -0.2, c.hu) * c.head * (1 - spots))  # below the eyes stays lighter
    k = k * (1 - 0.8 * streak)

    g = 0.85 * patches(c, freq=13.0, cover=0.22, seed=48)
    g = np.maximum(g, 0.35 * smoothstep(0.55, 0.68, n_hi) * (trunk + legs + c.tail))
    g = np.maximum(g, 0.65 * streak)
    g = g * (1 - 0.5 * legs)                                             # the legs are mostly tabby
    g = np.maximum(g, 0.35 * c.fore * smoothstep(0.1, 0.6, c.leg_front) * band(c.leg_t, 0.5, 0.8, 0.06))
    g = np.maximum(g, 0.65 * c.hind * band(c.leg_t, 0.45, 0.68, 0.06))
    g = np.maximum(g, 0.3 * c.tail * smoothstep(0.4, 0.6, n_lo))
    g = g * (1 - 0.7 * c.head * (1 - streak))                           # little ginger on the face otherwise

    # ---- the eyes (liner, Cleopatra lines) and cream: the pale ring round
    # the liner, buff cheeks, a light wash on the pads, inside the ears
    lines, ring = _eyes(c)
    cheeks = c.head * smoothstep(0.42, 0.7, ax) * smoothstep(0.05, -0.2, c.hu) * smoothstep(-0.6, -0.1, c.hf) * 0.4
    pads = pad * (1 - spots) * 0.35
    # cream round the mouth: the upper lip pales toward it; the chin is a
    # half-cream buff (a little fawn left in it) down to where the white
    # starts under the jaw, so it reads as a chin, not a white lower lip
    dl = c.hu - _lip_line(c)
    lip = (c.head * smoothstep(0.16, 0.04, dl) * smoothstep(-0.02, 0.02, dl) * smoothstep(0.3, 0.6, c.hf)
           * smoothstep(0.5, 0.3, ax))
    chin = (c.head * smoothstep(0.02, -0.02, dl) * smoothstep(-0.3, -0.2, dl) * smoothstep(-0.3, 0.1, c.hf)
            * smoothstep(0.55, 0.35, ax))
    pads = np.maximum.reduce([pads, 0.7 * lip * (1 - 0.5 * spots), 0.5 * chin])
    ears_in = c.ear * smoothstep(0.2, 0.5, c.n @ c.frame[:, 1]) * 0.6
    cr = np.clip(np.maximum.reduce([0.8 * ring, cheeks, pads, ears_in]), 0, 1)
    k = k * (1 - cr)

    white = _white(c) * (1 - lines)
    rest = (1 - white) * (1 - lines)
    plain = rest * (1 - cr)
    ground = plain * (1 - g) * (1 - k)
    tick = (0.25 + 0.2 * smoothstep(0.2, 0.9, c.dorsal) * trunk + 0.15 * legs
            + 0.6 * c.head * smoothstep(-0.35, 0.0, c.hu) * smoothstep(0.3, 0.1, ax) * smoothstep(0.3, 0.6, c.hf)
            + 0.25 * c.head * smoothstep(0.15, 0.5, c.hu))
    return {
        "white": white,
        "cream": rest * cr,
        "ginger": plain * g * (1 - k),
        "ginger_stripe": plain * g * k,
        "black": plain * (1 - g) * k + lines,
        "ground": ground * (1 - tick),         # darker down the back and the bridge
        "ticked": ground * tick,
    }


FUR = dict(
    density=120.0,
    points=12,
    gravity=0.3,
    clump=0.6,
    clump_size=5.0,
    frizz=0.02,
    spread=11.0,
    guard=dict(share=0.03, length=1.15, lift=5.0),
    length=dict(body=38.0, chest=40.0, belly=44.0, neck=36.0, ruff=52.0, face=5.5, muzzle=3.0, chin=6.0,
                cheek=30.0, brow=6.0, ear=4.0, ear_inner=6.0, fore=14.0, hind=22.0, britches=50.0, paw=5.0,
                toe_tuft=9.0, tail=40.0),
    lift=dict(body=(36.0, 4.0), face=(20.0, 6.0), tail=(26.0, 6.0), legs=(28.0, 6.0)),
    inner_ear_density=0.7,
    furnish=dict(length=15.0, count=2400, colour="#d8cab4"),
)
EYES = dict(inner="#848565", outer="#565c3f", limbus="#30351f", pupil=dict(width=0.13, height=0.86))
SKIN = dict(nose="#704c45", nose_size=0.78, inner_ear="#8f7466")
WHISKERS = dict(forward=-10.0, dark_share=0.15)
HALO = {}
# her semi-long coat scatters the back lights far more than the short coats:
# the rim and kicker are dimmed so they draw an edge, not a purple flank
LIGHTS = dict(rim=0.2, kicker=0.3, hair=1.2)
