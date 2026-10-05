"""Whiskers: the mystacial rows from the base's follicles, brows and cheeks added.

The base modelled its whiskers as flat ribbons; base.py keeps each one's
root, tip and the skin weights at its root. Here every pad whisker starts
at that root (snapped onto the posed skin) and leaves in the base's own
direction, then the cat's mood turns the fan:

- `forward` (degrees) swings every whisker about the head's up axis toward
  the nose (+: curious, alert) or back along the cheeks (-: annoyed, calm);
- `droop` (degrees) tilts them down (+) or up (-);
- `curl` bends each whisker down and slightly forward toward its tip;
- `length` scales them (the base's are about 5 to 7 cm on a 5 kg cat).

Brows (superciliary whiskers, above each eye) and cheek (genal) whiskers
are added in head coordinates (see catspace: hx, hf, hu in eye spacings).
Colours: `colour`, with a `dark_share` of strands in `dark` (a tortie's or
a tabby's mixed whiskers).
"""

import math

import numpy as np

from mathutils import Vector

from .params import merged
from .rig import skin_point
from .vecmath import nrm, rot_axis, srgb

DEFAULT = dict(
    colour="#f2efe9",
    dark="#3a3230",
    dark_share=0.0,
    length=1.0,
    forward=0.0,
    droop=0.0,
    curl=1.0,
    radius=0.11,     # mm at the root
    points=12,
    brows=dict(count=3, length=24.0, colour=None),   # mm
    cheeks=dict(count=2, length=28.0, colour=None),
    roughness=0.22,
)


def params(spec):
    return merged(DEFAULT, spec, "whiskers")


def build(anchors, K, head0, head_posed, bvh, p, rng, scale):
    """Whisker curves as one part: (points (N, K, 3), radius (N, K), colours (N, K, 3)).

    anchors: base whisker anchors (base rest frame); K: skinning matrices
    from the base rest to the world; head0 = (origin, frame, E) of the base
    rest head, head_posed = the same for the posed head; scale: the cat's
    overall scale (base to final).
    """
    O0, F0, E0 = head0
    Op, Fp, Ep = head_posed
    left, fwd, up = Fp[:, 0], Fp[:, 1], Fp[:, 2]
    strands = []
    for a in anchors:
        q = (a["root"] - O0) @ F0 / E0
        if q[1] < 0.3 or q[2] > 0.0:
            continue  # only the pads' rows come from the base
        r = skin_point(a["root"], a["weights"], K)
        t = skin_point(a["tip"], a["weights"], K)
        side = 1.0 if (r - Op) @ left > 0 else -1.0
        strands.append(dict(root=r, d=nrm(t - r), L=np.linalg.norm(t - r) * p["length"], side=side, kind="pad"))
    for side in (1.0, -1.0):
        for i in range(p["brows"]["count"]):
            q = np.array([side * (0.32 + 0.13 * i), 0.18 - 0.05 * i, 0.46 + 0.02 * i])
            root = Op + Fp @ (q * Ep)
            d = nrm(Fp @ np.array([side * 0.55, 0.5, 0.7]))
            L = p["brows"]["length"] * 1e-3 * (1 + 0.12 * i) * rng.uniform(0.92, 1.08)
            strands.append(dict(root=root, d=d, L=L, side=side, kind="brow"))
        for i in range(p["cheeks"]["count"]):
            q = np.array([side * 0.98, -0.25 - 0.12 * i, -0.3 - 0.08 * i])
            root = Op + Fp @ (q * Ep)
            d = nrm(Fp @ np.array([side * 1.0, 0.15, 0.05]))
            L = p["cheeks"]["length"] * 1e-3 * rng.uniform(0.9, 1.1)
            strands.append(dict(root=root, d=d, L=L, side=side, kind="cheek"))
    n = len(strands)
    Kp = p["points"]
    pts = np.zeros((n, Kp, 3))
    cols = np.zeros((n, Kp, 3))
    base_col = srgb(p["colour"])
    dark = srgb(p["dark"])
    for k, s in enumerate(strands):
        hit = bvh.find_nearest(Vector(s["root"]), 0.05)
        root = np.array(hit[0]) - np.array(hit[1]) * 0.0003 if hit[0] is not None else s["root"]
        d = s["d"]
        if s["kind"] == "pad":
            d = rot_axis(up, math.radians(s["side"] * p["forward"])) @ d
            d = rot_axis(nrm(np.cross(up, d)), math.radians(p["droop"])) @ d  # + tilts down
        bend = (-up * 0.8 + fwd * 0.3) * p["curl"] / Kp
        x = root.copy()
        pts[k, 0] = x
        seg = s["L"] / (Kp - 1)
        for j in range(1, Kp):
            d = nrm(d + bend * (0.6 + 0.8 * j / Kp))
            x = x + d * seg
            pts[k, j] = x
        colour = s["kind"] != "pad" and p[s["kind"] + "s"]["colour"]
        c = srgb(colour) if colour else (dark if rng.random() < p["dark_share"] else base_col)
        cols[k] = c
    s = np.linspace(0, 1, Kp)
    rad = np.tile(p["radius"] * 1e-3 * (1 - 0.85 * s), (n, 1))
    return pts, rad, cols, strands
