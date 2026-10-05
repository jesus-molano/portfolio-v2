"""Per-cat proportions as a new rest pose (before any posing).

Each joint i gets a 3x3 map L_i about its own head h_i, and the shaped rest
mesh is skinned with G_i(x) = L_i (x - h_i) + h'_i, where the new head
h'_i = G_parent(h_i) + t_i: a child stays attached where its parent's map
carries it (longer legs move the paws, a wider chest moves the shoulders
out), and t_i adds an explicit move (jowls, a belly pouch). A uniform scale
given to a whole subtree (the head with its ears, eyes and lips) is then a
plain scale about the subtree's root joint.

Directions come from joint positions (rig.chain_dir), never bone axes:
"girth" scales across a chain (the plane perpendicular to it), "length"
along it. The spine joints run along the back, so a bigger chest or belly
grows down and out, not up, as on a heavier cat.

No control reaches the muzzle (nose bridge, whisker pads, nose leather, lips)
other than the uniform head scale: the base's sculpted face is what keeps it
reading as a cat at thumbnail size.

Units: factors are relative (1 = the base), moves in centimetres.
"""

import copy

import numpy as np

from .rig import EARS, EYE_JOINT, LEGS, LIDS, SPINE, TAIL, chain_dir

DEFAULT = dict(
    head=1.0,          # uniform scale of the head with ears, eyes, jaw and lips
    ears=1.0,          # uniform scale of each ear about its base
    ear_height=1.0,    # ear length along the ear (on top of `ears`)
    eyes=1.0,          # the eye region (ball and lids) about the eye centre
    neck=dict(length=1.0, girth=1.0),
    chest=1.0,         # girth of Chest and Spine03
    belly=1.0,         # girth of Spine02 and Spine01
    haunch=1.0,        # girth of the pelvis and the thighs
    body_length=1.0,   # along the spine, pelvis to chest
    fore=dict(length=1.0, girth=1.0),
    hind=dict(length=1.0, girth=1.0),
    paws=1.0,          # uniform scale of the paws and toes
    tail=dict(length=1.0, girth=1.0, tip=1.0),  # tip: extra length factor of the last two joints
    jowls=0.0,         # cm, cheeks moved outward (tomcat jowls)
    belly_drop=0.0,    # cm, the belly joint moved down (a pouch)
    belly_pouch=1.0,   # scale of the belly joint's skin
    # side-to-side breadth on top of the girths: a heavier cat gets wider
    # without its rump sinking under the paws (girth also grows downward)
    width=dict(chest=1.0, belly=1.0, haunch=1.0),
)


def merged(params):
    """DEFAULT updated by a (possibly partial, nested) params dict."""
    out = copy.deepcopy(DEFAULT)
    for k, v in (params or {}).items():
        if k not in out:
            raise KeyError(f"unknown shape parameter {k!r}")
        if isinstance(out[k], dict):
            for kk in v:
                if kk not in out[k]:
                    raise KeyError(f"unknown shape parameter {k}.{kk}")
            out[k].update(v)
        else:
            out[k] = v
    return out


def _across(d, g):
    d = d / np.linalg.norm(d)
    return np.eye(3) + (g - 1.0) * (np.eye(3) - np.outer(d, d))


def _along(d, f):
    d = d / np.linalg.norm(d)
    return np.eye(3) + (f - 1.0) * np.outer(d, d)


def build(skel, params, head_frame=None):
    """Return (shaped_rest (B,4,4), shape_maps G (B,4,4), resolved params).

    head_frame: 3x3 columns (left, forward, up) of the rest head, for the
    jowls direction; rig landmarks give it (catspace.head_frame).
    """
    p = merged(params)
    B = len(skel.names)
    L = np.tile(np.eye(3), (B, 1, 1))
    t = np.zeros((B, 3))
    idx = skel.i

    def subtree(name):
        out = [idx(name)]
        for j in range(B):
            if skel.parent[j] in out:
                out.append(j)
        return out

    def chain_maps(chain, names, fn):
        """Compose fn(direction) into the joints `names` of `chain`."""
        D = dict(zip(chain, chain_dir(skel, chain)))
        for n in names:
            L[idx(n)] = fn(D[n]) @ L[idx(n)]

    # lengths and girths along the chains
    chain_maps(SPINE, SPINE[:5], lambda d: _along(d, p["body_length"]))
    chain_maps(SPINE, ["Chest", "Spine03"], lambda d: _across(d, p["chest"]))
    chain_maps(SPINE, ["Spine02", "Spine01"], lambda d: _across(d, p["belly"]))
    chain_maps(SPINE, ["Pelvis"], lambda d: _across(d, p["haunch"]))
    neck = ["Neck01", "Neck02", "Neck03"]
    chain_maps(SPINE, neck, lambda d: _along(d, p["neck"]["length"]) @ _across(d, p["neck"]["girth"]))
    for key, chain in LEGS.items():
        q = p["fore" if key.startswith("fore") else "hind"]
        chain_maps(chain, chain[:2], lambda d, q=q: _along(d, q["length"]) @ _across(d, q["girth"]))
        if key.startswith("hind"):
            chain_maps(chain, chain[:1], lambda d: _across(d, p["haunch"]))
        for j in subtree(chain[2]):
            L[j] = p["paws"] * L[j]
    side = np.array([1.0, 0.0, 0.0])  # the cat's left in the rest frame
    breadth = dict(chest=("Chest", "Spine03"), belly=("Spine02", "Spine01"),
                   haunch=("Pelvis", LEGS["hind.L"][0], LEGS["hind.R"][0]))
    for k, names in breadth.items():
        if p["width"][k] != 1.0:
            for n in names:
                L[idx(n)] = _along(side, p["width"][k]) @ L[idx(n)]
    D = chain_dir(skel, TAIL)
    for k, (n, d) in enumerate(zip(TAIL, D)):
        f = p["tail"]["length"] * (p["tail"]["tip"] if k >= len(TAIL) - 2 else 1.0)
        L[idx(n)] = _along(d, f) @ _across(d, p["tail"]["girth"]) @ L[idx(n)]
    # the head and its parts: uniform scales of subtrees
    for j in subtree("Head"):
        L[j] = p["head"] * L[j]
    for side, chain in EARS.items():
        d = chain_dir(skel, chain)[0]
        for j in subtree(chain[0]):
            L[j] = p["ears"] * (_along(d, p["ear_height"]) @ L[j])
    for side in ("L", "R"):
        for n in (EYE_JOINT[side],) + LIDS[side]:
            L[idx(n)] = p["eyes"] * L[idx(n)]
    # explicit moves
    if head_frame is not None and p["jowls"]:
        left = head_frame[:, 0]
        t[idx("L_Cheek")] += left * p["jowls"] * 0.01
        t[idx("R_Cheek")] -= left * p["jowls"] * 0.01
    if p["belly_drop"]:
        t[idx("Belly_Jiggle")] += np.array([0, 0, -1.0]) * p["belly_drop"] * 0.01
    L[idx("Belly_Jiggle")] = p["belly_pouch"] * L[idx("Belly_Jiggle")]

    # new heads, parents first
    h = skel.rest[:, :3, 3]
    hn = np.zeros_like(h)
    G = np.tile(np.eye(4), (B, 1, 1))
    for i in range(B):
        pa = skel.parent[i]
        if pa < 0:
            hn[i] = h[i] + t[i]
        else:
            hn[i] = L[pa] @ (h[i] - h[pa]) + hn[pa] + t[i]
        G[i, :3, :3] = L[i]
        G[i, :3, 3] = hn[i] - L[i] @ h[i]
    rest = skel.rest.copy()
    rest[:, :3, 3] = hn
    return rest, G, p
