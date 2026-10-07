"""Unsheathed claws: a cat striking shows its claws (the select's dante-swipe).

The base cat has no claws (at rest they are sheathed in the fur). For a paw
named in a spec's `claws` (e.g. "fore.R"), four claws come out of the toe
tips: each a curved, laterally flattened keratin hook, rooted inside the
toe (so the fur closes round its base), leaving the toe along the paw's
own direction and hooking toward the pad side, as a real claw does.

Placed on the posed, scaled skin (world metres), from the paw's own
geometry: its direction (Toe to Toe_end), its pad side (the pads mask, the
bare skin under the toes) and its width (the distal toe vertices across the
paw). Nothing here is random: the same pose gives the same claws.
"""

import math

import bpy
import numpy as np

from .rig import LEGS
from .skin import make_mesh, nodes_for
from .vecmath import nrm

DEFAULT = dict(
    length_cm=1.35,   # out of the toe; a kitten's claw is about 1 cm, a touch more so it reads at the page's scale
    buried_cm=0.35,   # inside the toe, under the fur
    radius_cm=0.13,   # at the root, across the paw (flattened to `flat` along it)
    flat=0.62,
    hook_deg=72.0,    # how far the claw turns toward the pad from root to tip
    splay=0.18,       # the claws fan out across the paw (share of its width added at the tips)
    across=(0.14, 0.38, 0.62, 0.86),  # where the four sit across the paw's distal edge
    colour="#efe6d6",  # keratin: ivory, translucent at the tip
)


def place(V, Pw, names, toe_weight, pads, key, p=None):
    """The claws of one paw as (root, tangent, side, pad) frames, world metres.

    V: posed vertices; Pw: posed joint world matrices; names: joint names;
    toe_weight: per-vertex weight of the paw's Toe subtree; pads: the pads
    mask (0..1) per vertex.
    """
    p = dict(DEFAULT, **(p or {}))
    chain = LEGS[key]
    toe = Pw[names.index(chain[3]), :3, 3]
    end = Pw[names.index(chain[4]), :3, 3]
    d = nrm(end - toe)
    sel = toe_weight > 0.5
    P = V[sel]
    if len(P) < 12:
        raise SystemExit(f"claws: the {key} paw has too few toe vertices ({len(P)})")
    c = P.mean(0)
    w = np.clip(pads[sel], 0, 1)
    pad_c = (P * w[:, None]).sum(0) / max(w.sum(), 1e-9) if w.sum() > 0.5 else c - np.cross(d, [0, 0, 1.0])
    n = pad_c - c
    n = nrm(n - (n @ d) * d)                 # toward the pads, across the paw's direction
    side = nrm(np.cross(d, n))               # across the paw
    along = (P - c) @ d
    distal = P[along > np.percentile(along, 70)]
    lat = (distal - c) @ side
    lo, hi = np.percentile(lat, 4), np.percentile(lat, 96)
    width = hi - lo
    claws = []
    for a in p["across"]:
        t = lo + a * width
        near = distal[np.abs(((distal - c) @ side) - t) < 0.14 * width]
        if not len(near):
            near = distal
        tip = near[np.argmax((near - c) @ d)]
        # the claw leaves the toe at the front of its pad, a little toward the pad side
        root = tip - d * (p["buried_cm"] * 0.01) + n * (0.25 * p["radius_cm"] * 0.01)
        fan = side * ((a - 0.5) * p["splay"])
        claws.append(dict(root=root, d=nrm(d + fan), n=n, side=side))
    return claws, p


def _claw_mesh(frame, p, rings=14, around=10):
    """One hook: a tapered, flattened tube bent toward the pad, closed at the tip."""
    L = (p["length_cm"] + p["buried_cm"]) * 0.01
    r0 = p["radius_cm"] * 0.01
    hook = math.radians(p["hook_deg"])
    d0, n0, s0 = frame["d"], frame["n"], nrm(np.cross(frame["d"], frame["n"]))
    pos = frame["root"].copy()
    verts, rings_at = [], []
    step = L / rings
    for i in range(rings + 1):
        u = i / rings
        # the bend grows toward the tip (a claw is straighter at its root)
        ang = hook * u ** 1.6
        t = nrm(math.cos(ang) * d0 + math.sin(ang) * n0)
        nn = nrm(np.cross(s0, t))
        if i:
            pos = pos + t * step
        r = r0 * (1.0 - u) ** 0.85 + 0.00002
        rings_at.append(len(verts))
        for k in range(around):
            a = 2 * math.pi * k / around
            # deeper toward the pad than across: a claw is a blade seen from the side
            verts.append(pos + s0 * (math.cos(a) * r * p["flat"]) + nn * (math.sin(a) * r))
    faces = []
    for i in range(rings):
        a0, a1 = rings_at[i], rings_at[i + 1]
        for k in range(around):
            k1 = (k + 1) % around
            faces.append((a0 + k, a0 + k1, a1 + k1, a1 + k))
    return np.array(verts), faces


def material(colour):
    mat = bpy.data.materials.get("Claw")
    if mat:
        return mat
    mat = bpy.data.materials.new("Claw")
    nt, out = nodes_for(mat)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    rgb = tuple(int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in rgb)
    bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.32
    bsdf.inputs["Subsurface Weight"].default_value = 0.35
    bsdf.inputs["Subsurface Radius"].default_value = (0.6, 0.5, 0.4)
    bsdf.inputs["Subsurface Scale"].default_value = 0.002
    bsdf.inputs["Coat Weight"].default_value = 0.4
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return mat


def build(claws, p):
    """One object holding every claw. Returns (object, points for the crop)."""
    Vs, Fs, off = [], [], 0
    for frame in claws:
        V, F = _claw_mesh(frame, p)
        Vs.append(V)
        Fs += [tuple(i + off for i in f) for f in F]
        off += len(V)
    V = np.concatenate(Vs)
    me = make_mesh("Claws", V, np.array(Fs, np.int32))
    me.materials.append(material(p["colour"]))
    ob = bpy.data.objects.new("Claws", me)
    bpy.context.scene.collection.objects.link(ob)
    return ob, V
