"""Coat colours: a palette per cat, markings as weights, strand and skin colours.

A cat's palette names its hair colours, each a (root, tip) pair of sRGB hex
strings: the tip is the agouti band a tabby's hairs end in, or the same
colour for a solid hair. Its `markings(c)` function (suspects/<name>.py)
returns, for the points of a CatSpace `c`, a weight per palette name (any
non-negative arrays; they are normalised per point, names left out weigh 0,
and a point with no weight takes the palette's first colour).

Each strand then draws one palette colour with those probabilities, so
edges between markings break up hair by hair, as on a real coat. The skin
under the fur takes the weighted mean colour, darkened, so gaps never show a
foreign colour.

The helpers below are the building blocks the four cats share: tabby
stripes, rings, the white bib and mittens, colourpoints and tortie patches.
They all take a CatSpace and return weights in [0, 1].
"""

import numpy as np

from .vecmath import smoothstep, srgb


def palette(spec):
    """{name: (root_hex, tip_hex) or hex} -> ordered list of (name, root, tip) in linear RGB."""
    out = []
    for name, v in spec.items():
        root, tip = (v, v) if isinstance(v, str) else v
        out.append((name, srgb(root), srgb(tip)))
    return out


def probabilities(pal, weights, n):
    """Normalised weights (n, K) in palette order."""
    names = [p[0] for p in pal]
    for k in weights:
        if k not in names:
            raise KeyError(f"marking {k!r} is not in the palette {names}")
    P = np.zeros((n, len(pal)))
    for j, name in enumerate(names):
        if name in weights:
            P[:, j] = np.clip(np.broadcast_to(np.asarray(weights[name], float), (n,)), 0, None)
    tot = P.sum(1)
    P[tot < 1e-9, 0] = 1.0
    return P / np.maximum(P.sum(1, keepdims=True), 1e-9)


def strand_colours(pal, probs, rng, jitter=0.05):
    """Root and tip colours (n, 3) per strand, drawn from the probabilities."""
    n = len(probs)
    cdf = np.cumsum(probs, 1)
    pick = (rng.random(n)[:, None] > cdf).sum(1)
    pick = np.minimum(pick, len(pal) - 1)
    roots = np.array([p[1] for p in pal])[pick]
    tips = np.array([p[2] for p in pal])[pick]
    v = 1.0 + rng.normal(0, jitter, (n, 1))
    return roots * v, tips * v, pick


def mean_colour(pal, probs):
    m = np.array([0.6 * p[1] + 0.4 * p[2] for p in pal])
    return probs @ m


# ------------------------------------------------------------- the helpers

def band(x, lo, hi, soft=0.02):
    """1 between lo and hi, soft edges."""
    return smoothstep(lo - soft, lo + soft, x) * smoothstep(hi + soft, hi - soft, x)


def stripes(phase, period, duty=0.35, soft=0.25):
    """Periodic stripes along a coordinate: 1 on a stripe, 0 between.

    duty is the stripe's share of the period; soft its edge, as a share too.
    """
    f = (np.asarray(phase, float) / period) % 1.0
    d = np.minimum(f, 1 - f)  # distance to the stripe centre, in periods
    half = duty / 2
    return smoothstep(half + soft * half, half - soft * half, d)


def mackerel(c, period=0.07, duty=0.38, warp=0.6, seed=1, belly_fade=(-0.2, -0.55)):
    """Mackerel tabby on the trunk: thin stripes running down the flanks.

    The stripes cross the spine line (phase = s, bent by the angle around the
    body so they curve down and back like a fishbone), wander with noise and
    fade out toward the belly. period in units of s (0..1 withers to tail).
    """
    phi = np.arctan2(c.lateral, c.dorsal)
    bend = 0.035 * np.abs(phi)  # stripes sweep back as they run down
    wob = warp * period * (c.fbm(18, seed) - 0.5)
    m = stripes(c.s + bend + wob, period, duty)
    spine = smoothstep(0.35, 0.15, np.abs(phi))  # the dark line along the back
    out = np.maximum(m, spine) * smoothstep(belly_fade[1], belly_fade[0], c.dorsal)
    return out * smoothstep(-0.15, 0.0, c.s) * smoothstep(1.06, 0.98, c.s)


def rings(u, n=8, duty=0.4, phase=0.0, soft=0.3):
    """Rings along a 0..1 coordinate (tail_u, leg_t)."""
    return stripes(np.asarray(u) * n + phase, 1.0, duty, soft)


def bib(c, chin=True, chest=0.6, belly=0.35, width=0.55, seed=2):
    """White chin, throat, chest and belly (the ventral blaze), ragged edge.

    chest/belly: how far up the sides the white climbs (0 = a thin line,
    1 = up to the flanks); width: how wide on the chest.
    """
    edge = 0.12 * (c.fbm(30, seed) - 0.5)
    trunk = (c.body + c.neck) * smoothstep(-0.6 + chest * 0.6 - width * 0.3, -0.85 + chest * 0.6, -c.dorsal + edge)
    trunk = trunk * smoothstep(0.75, 0.45, c.s)  # chest and front belly
    belly_ = c.body * smoothstep(-0.95 + belly * 0.5, -0.75 + belly * 0.5, -c.dorsal + edge) * smoothstep(1.0, 0.7, c.s)
    out = np.maximum(trunk, belly_)
    if chin:
        out = np.maximum(out, chin_white(c))
    return np.clip(out, 0, 1)


def chin_white(c, up=-0.45, back=0.4):
    """White under the jaw and lips: below `up` (head units) ahead of `back`."""
    return c.head * smoothstep(up + 0.08, up - 0.08, c.hu) * smoothstep(back - 0.3, back + 0.1, c.hf)


def mittens(c, fore=0.82, hind=0.8, seed=3):
    """White paws up to leg_t (0 shoulder or hip, 1 toes); ragged."""
    edge = 0.04 * (c.fbm(40, seed) - 0.5)
    f = c.fore * smoothstep(fore - 0.02, fore + 0.02, c.leg_t + edge)
    h = c.hind * smoothstep(hind - 0.02, hind + 0.02, c.leg_t + edge)
    return np.clip(np.maximum(f, h) + c.paw * 0.0, 0, 1)


def points(c, mask=1.0, ears=1.0, legs=1.0, tail=1.0, leg_from=0.45, tail_from=0.25):
    """Colourpoint (Siamese) density: face mask, ears, lower legs, tail."""
    face = c.head * smoothstep(-0.3, 0.6, c.hf) * smoothstep(1.1, 0.4, np.abs(c.hx)) * smoothstep(0.9, 0.2, c.hu)
    lg = (c.fore + c.hind) * smoothstep(leg_from - 0.15, leg_from + 0.25, c.leg_t)
    tl = c.tail * smoothstep(tail_from - 0.2, tail_from + 0.4, c.tail_u)
    return np.clip(mask * face + ears * c.ear + legs * lg + tail * tl, 0, 1)


def patches(c, freq=9.0, cover=0.35, seed=4, soft=0.06):
    """Blotchy patches (tortoiseshell): about `cover` of the coat, ragged.

    The threshold comes from a fixed reference sample of the same noise, not
    from the points given, so the skin (vertices) and the strands (roots
    sampled by area) agree on where the patches are.
    """
    d = c.cells(freq, seed) + 0.35 * (c.fbm(freq * 3, seed + 9) - 0.5)
    return smoothstep(_patch_threshold(cover, seed) + soft, _patch_threshold(cover, seed) - soft, d)


_THRESHOLDS = {}


def _patch_threshold(cover, seed):
    key = (round(float(cover), 4), seed)
    if key not in _THRESHOLDS:
        from .noise import cells, fbm
        ref = np.random.default_rng(12345).random((40000, 3)) * 40.0
        d = cells(ref, seed) + 0.35 * (fbm(ref * 3, 3, seed + 9) - 0.5)
        _THRESHOLDS[key] = float(np.quantile(d, cover))
    return _THRESHOLDS[key]


def forehead_m(c, spacing=0.16, top=1.2, bottom=0.35, width=0.55, seed=5):
    """The tabby "M": thin dark lines up the forehead between the ears."""
    f = stripes(c.hx + 0.04 * (c.fbm(60, seed) - 0.5), spacing, 0.4)
    zone = c.head * band(c.hu, bottom, top, 0.08) * smoothstep(width + 0.05, width - 0.05, np.abs(c.hx))
    return f * zone * smoothstep(-0.6, -0.2, c.hf)


def cheek_lines(c, n=2, start=0.55, seed=6):
    """Lines from the outer corner of the eye back across the cheek."""
    out = np.zeros_like(c.hx)
    ax = np.abs(c.hx)
    for k in range(n):
        u0 = -0.1 - 0.28 * k
        line = smoothstep(0.07, 0.025, np.abs(c.hu - u0 - 0.25 * (ax - start) + 0.03 * (c.fbm(50, seed + k) - 0.5)))
        out = np.maximum(out, line * smoothstep(start - 0.05, start + 0.1, ax) * smoothstep(-0.9, -0.3, c.hf))
    return out * c.head
