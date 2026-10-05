"""Fur: strands grown in numpy on the posed skin, rendered as Cycles hair curves.

The approved prototype's `grow()` (strand lift, clumps, guard hairs, per-
point root-to-tip colour) on the base's anatomy:

1. Length and density are fields on the shaped rest mesh, from cat space
   and the cat's `FUR` table (millimetres per region: body, face, muzzle,
   chin, cheek ruff, ears, neck ruff, chest, belly, legs, britches, paws,
   tail and its tip). Bare skin (nose leather, lips, eyelid rims, inner
   ears, pads) grows none; the fur shortens toward the eyes and the nose.
2. The comb (the way the coat lies) is also a rest field: each joint's flow
   (head to tail along the spine and down the flanks, down the legs, out
   along the tail and the ears) weighted by the skin weights, and on the
   face an analytic field: away from the nose over the bridge, the pads and
   the cheeks, then back over the skull, and out round each eye.
3. Roots are sampled on the posed triangles by area x density. Each root
   keeps its triangle and barycentrics: its rest coordinates (and so its
   colour) are exact, and the rest comb is carried onto the posed triangle
   by the triangle's own linear map.
4. Growth: lift from the skin (root angle to tip angle), a spread about the
   comb, gravity for long coats, clumping of neighbouring tips, frizz and a
   share of longer, stiffer guard hairs.
5. Collisions: strand points that end up inside the body are pushed back
   out along the nearest surface normal, and every point stays above the
   floor (z >= 0.2 mm).
6. Colour: each strand draws one palette colour from the markings'
   probabilities at its root (so marking edges break up hair by hair), and
   blends from a darker root to the colour's tip.

Extras: ear furnishings (pale tufts from the inner ear), lynx tips (dark
tufts on the ear tips), all in the same Curves object and material.

Units: lengths in millimetres, density in strands per square centimetre
(scaled by the build's density factor, so test renders can thin the coat).
"""

import math
import time

import numpy as np

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from .coat import probabilities, strand_colours
from .params import merged
from .rig import EARS, LEGS, TAIL, chain_dir
from .vecmath import nrm, quads_to_tris, smoothstep, srgb

DEFAULT = dict(
    density=170.0,       # strands per cm2 of skin
    radius=0.085,        # mm, strand radius at the root
    taper=0.82,          # share of the radius lost at the tip
    points=5,            # points per strand (long coats: 10 to 12)
    length=dict(
        body=12.0, chest=12.0, belly=13.0, neck=12.0, ruff=0.0,
        face=5.0, muzzle=2.5, chin=4.0, cheek=0.0, brow=4.0,
        ear=3.0, ear_inner=4.0, fore=7.0, hind=9.0, britches=0.0, paw=4.0, toe_tuft=0.0,
        tail=15.0, tail_tip=0.0,
    ),
    lift=dict(body=(30.0, 8.0), face=(16.0, 6.0), tail=(40.0, 12.0), legs=(22.0, 6.0)),
    spread=14.0,         # degrees of scatter about the comb
    clump=0.40,          # 0..1, how much neighbouring tips gather
    clump_size=3.4,      # mm, clump cell size
    frizz=0.05,          # random kinks, share of the length
    gravity=0.0,         # 0..1, long coats hang toward the floor at the tips
    guard=dict(share=0.06, length=1.45, lift=10.0),
    root_dark=0.72,      # the root point's colour factor (depth in the coat)
    jitter=0.05,         # per-strand brightness scatter
    face_density=1.25,   # density factor on the head (short dense face fur)
    ear_density=0.9,
    inner_ear_density=0.25,  # sparse hairs inside the ear (the furnishings come on top)
    furnish=dict(length=10.0, count=900, colour="#ece4de"),  # inner-ear tufts
    lynx=dict(length=0.0, count=60, colour="#2a2220"),       # ear-tip tufts
    collide=True,
    hair=dict(roughness=0.34, radial=0.45, coat=0.12, ior=1.55, random_roughness=0.15),
)


def params(spec):
    return merged(DEFAULT, spec, "fur")


# --------------------------------------------------------------- rest fields

def _joint_flows(skel):
    """Per-joint rest flow direction (B, 3): how the coat lies over each bone."""
    B = len(skel.names)
    D = np.tile(np.array([0, 1.0, -0.5]), (B, 1))
    order = ["Head", "Neck03", "Neck02", "Neck01", "Chest", "Spine03", "Spine02", "Spine01", "Pelvis"] + TAIL
    dirs = chain_dir(skel, order)
    for k, (name, d) in enumerate(zip(order, dirs)):
        if name in TAIL:
            D[skel.i(name)] = d
        else:
            D[skel.i(name)] = nrm(d + np.array([0, 0, -0.35]))
    for chain in LEGS.values():
        for name, d in zip(chain, chain_dir(skel, chain)):
            D[skel.i(name)] = d
    for chain in EARS.values():
        for name, d in zip(chain, chain_dir(skel, chain)):
            D[skel.i(name)] = d
    for name in ("L_Scapula", "R_Scapula", "L_Shoulder", "R_Shoulder"):
        if name in skel.names:
            D[skel.i(name)] = nrm(np.array([0, 0.5, -1.0]))
    return nrm(D)


def comb_field(skel, c, W, eyes):
    """Rest comb direction per vertex (unit, tangent to the rest skin)."""
    D = _joint_flows(skel)
    head_idx = [i for i in range(len(skel.names)) if _in_head(skel, i)]
    Wb = W.copy()
    Wb[:, head_idx] = 0
    comb = Wb @ D
    # the face: away from the nose, back over the skull, out round the eyes
    F = c.frame
    q = np.stack([c.hx, c.hf, c.hu], 1)
    away = nrm(q - c.nose)
    back = nrm(np.array([0, -1.0, -0.35]))
    wf = smoothstep(-0.4, 0.35, c.hf)[:, None]
    hq = nrm(wf * away + (1 - wf) * back)
    for side, e in eyes.items():
        eq = (e["centre"] - c.origin) @ F / c.E
        d = q - eq
        r = np.linalg.norm(d, axis=1)
        w = smoothstep(0.62, 0.3, r)[:, None]
        hq = nrm(hq * (1 - w) + nrm(d) * w)
    head_world = hq @ F.T
    comb = comb + (W[:, head_idx].sum(1))[:, None] * head_world
    n = c.n
    comb = comb - (comb * n).sum(1, keepdims=True) * n
    return nrm(comb)


def _in_head(skel, i):
    ears = set()
    for chain in EARS.values():
        ears.update(_subtree(skel, chain[0]))
    return i in set(_subtree(skel, "Head")) - ears


def _subtree(skel, name):
    out = [skel.i(name)]
    for j in range(len(skel.names)):
        if skel.parent[j] in out:
            out.append(j)
    return out


def length_field(c, p, masks):
    """Fur length per rest vertex (metres), a density factor and the region weights.

    masks: skin.masks() (nose, lips, rims, pads grow nothing; inner ears
    grow sparse short hair).
    """
    bare = np.maximum.reduce([masks["nose"], masks["lips"], masks["rims"], masks["pads"]])
    eye_gap = masks["eye_gap"]
    inner = np.clip(masks["inner_ear"], 0, 1)
    Lp = {k: v * 0.001 for k, v in p["length"].items()}
    q = np.stack([c.hx, c.hf, c.hu], 1)
    dn = np.linalg.norm(q - c.nose, axis=1)
    # head
    face = Lp["face"] + (Lp["brow"] - Lp["face"]) * smoothstep(0.2, 0.55, c.hu) * smoothstep(1.0, 0.4, np.abs(c.hx))
    head = face + (Lp["muzzle"] - face) * smoothstep(0.75, 0.35, dn)
    chin = smoothstep(c.nose[2] - 0.2, c.nose[2] - 0.45, c.hu) * smoothstep(-0.1, 0.3, c.hf)
    head = head + (Lp["chin"] - head) * chin
    if Lp["cheek"] > 0:
        ck = smoothstep(0.45, 0.85, np.abs(c.hx)) * smoothstep(0.25, -0.1, c.hu) * smoothstep(0.4, 0.0, c.hf)
        head = np.maximum(head, Lp["cheek"] * ck)
    head = head + (Lp["neck"] - head) * smoothstep(-0.5, -1.3, c.hf)
    # trunk
    chest = smoothstep(0.35, 0.05, c.s) * smoothstep(0.35, -0.2, c.dorsal)
    belly = smoothstep(0.25, 0.45, c.s) * smoothstep(-0.25, -0.6, c.dorsal)
    trunk = Lp["body"] + (Lp["chest"] - Lp["body"]) * chest + (Lp["belly"] - Lp["body"]) * belly
    neck = np.full(len(c.p), Lp["neck"])
    if Lp["ruff"] > 0:
        ruff = smoothstep(0.25, -0.25, c.dorsal) * smoothstep(0.3, 0.0, c.s)
        trunk = np.maximum(trunk, Lp["ruff"] * ruff)
        neck = np.maximum(neck, Lp["ruff"] * smoothstep(0.35, -0.3, c.dorsal))
    fore = np.full(len(c.p), Lp["fore"])
    hind = np.full(len(c.p), Lp["hind"])
    if Lp["britches"] > 0:
        br = smoothstep(0.0, -0.5, c.leg_front) * smoothstep(0.65, 0.3, c.leg_t)
        hind = np.maximum(hind, Lp["britches"] * br)
    tail = np.full(len(c.p), Lp["tail"])
    if Lp["tail_tip"] > 0:
        tail = tail + (Lp["tail_tip"] - tail) * smoothstep(0.55, 1.0, c.tail_u)
    regions = np.stack([c.head, c.ear, c.neck, c.body, c.fore, c.hind, c.tail], 1)
    regions = regions / np.maximum(regions.sum(1, keepdims=True), 1e-6)
    vals = np.stack([head, np.full(len(c.p), Lp["ear"]), neck, trunk, fore, hind, tail], 1)
    L = (regions * vals).sum(1)
    paw = np.full(len(c.p), Lp["paw"])
    if Lp["toe_tuft"] > 0:
        paw = np.maximum(paw, Lp["toe_tuft"] * smoothstep(0.0, -0.4, c.n[:, 2]))
    L = L + (paw - L) * c.paw
    L = L + (Lp["ear_inner"] - L) * inner
    # bare skin and the eyes
    L = L * smoothstep(0.55, 0.15, bare)
    L = L * smoothstep(0.0012, 0.0045, eye_gap)
    dens = 1.0 + (p["face_density"] - 1.0) * regions[:, 0] + (p["ear_density"] - 1.0) * regions[:, 1]
    dens = dens * (1 + (p["inner_ear_density"] - 1) * inner)
    dens = dens * (L > 0.0003) * (eye_gap > 0.0012)
    return L, dens, regions


def lift_field(p, regions):
    """(root, tip) lift angles per vertex, degrees (regions as length_field returns them)."""
    legs = regions[:, 4] + regions[:, 5]
    body = np.array(p["lift"]["body"])
    face = np.array(p["lift"]["face"])
    tail = np.array(p["lift"]["tail"])
    leg = np.array(p["lift"]["legs"])
    w_face = regions[:, 0:2].sum(1)[:, None]
    w_tail = regions[:, 6:7]
    w_leg = legs[:, None]
    w_body = np.clip(1 - w_face - w_tail - w_leg, 0, 1)
    return w_body * body + w_face * face + w_tail * tail + w_leg * leg


# --------------------------------------------------------------- sampling

def sample_tris(V, T, dens, n_total, rng):
    """Area x density weighted roots on triangles: (triangle index, barycentrics)."""
    a = V[T[:, 1]] - V[T[:, 0]]
    b = V[T[:, 2]] - V[T[:, 0]]
    area = 0.5 * np.linalg.norm(np.cross(a, b), axis=1)
    w = area * np.maximum(dens, 0)
    if n_total is None:
        n_total = int(w.sum())
    if n_total <= 0 or w.sum() <= 0:
        return np.zeros(0, int), np.zeros((0, 3))
    cdf = np.cumsum(w)
    cdf /= cdf[-1]
    ti = np.minimum(np.searchsorted(cdf, rng.random(n_total)), len(T) - 1)
    r1, r2 = rng.random(n_total), rng.random(n_total)
    s = np.sqrt(r1)
    return ti, np.stack([1 - s, s * (1 - r2), s * r2], 1)


def interp(attr, T, ti, bary):
    return np.einsum("nk,nk...->n...", bary, attr[T[ti]])


def tri_maps(Vr, Vp, T):
    """Per-triangle 3x3 linear maps carrying rest vectors onto the posed triangle."""
    def frame(V):
        e1 = V[T[:, 1]] - V[T[:, 0]]
        e2 = V[T[:, 2]] - V[T[:, 0]]
        n = np.cross(e1, e2)
        n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        return np.stack([e1, e2, n], axis=2)
    Ar, Ap = frame(Vr), frame(Vp)
    det = np.abs(np.linalg.det(Ar))
    ok = det > 1e-18
    M = np.tile(np.eye(3), (len(T), 1, 1))
    M[ok] = Ap[ok] @ np.linalg.inv(Ar[ok])
    return M


# --------------------------------------------------------------- growth

def grow(root, nrmv, comb, length, col_root, col_tip, rng, K=5, lift=None, r0=0.000085, taper=0.82,
         clump=0.35, clump_size=0.0034, spread=14.0, frizz=0.05, guard=None, gravity=0.0,
         root_dark=0.72):
    """Strand points (N, K, 3), radius (N, K), colours (N, K, 3).

    lift: (N, 2) root and tip angles in degrees (or one pair for all).
    """
    N = len(root)
    n = nrm(nrmv)
    t = comb - (comb * n).sum(1, keepdims=True) * n
    bad = np.linalg.norm(t, axis=1) < 1e-4
    if bad.any():
        alt = np.cross(n[bad], [0.0, 0.0, 1.0])
        alt[np.linalg.norm(alt, axis=1) < 1e-4] = np.array([1.0, 0, 0])
        t[bad] = alt
    t = nrm(t)
    ang = np.radians(rng.normal(0, spread, N))
    b = np.cross(n, t)
    t = nrm(t * np.cos(ang)[:, None] + b * np.sin(ang)[:, None])
    L = length * (0.72 + 0.56 * rng.random(N))
    g = guard or dict(share=0.0, length=1.0, lift=0.0)
    is_guard = rng.random(N) < g["share"]
    L = np.where(is_guard, L * g["length"], L)
    lift = np.broadcast_to(np.asarray(lift if lift is not None else (30.0, 8.0), float), (N, 2))
    a0 = np.radians(lift[:, 0] + rng.normal(0, 7, N) + is_guard * g["lift"])
    a1 = np.radians(lift[:, 1])
    s = np.linspace(0, 1, K)
    pts = np.zeros((N, K, 3))
    pts[:, 0] = root
    down = np.array([0, 0, -1.0])
    for k in range(1, K):
        sm = (s[k - 1] + s[k]) * 0.5
        al = a0 * (1 - sm) + a1 * sm
        d = t * np.cos(al)[:, None] + n * np.sin(al)[:, None]
        if gravity:
            d = nrm(d + gravity * sm * 1.6 * down)
        pts[:, k] = pts[:, k - 1] + d * (L / (K - 1))[:, None]
    if clump > 0:
        jitter = rng.random(3) * clump_size
        cell = np.floor((root + jitter) / clump_size).astype(np.int64)
        key = (cell[:, 0] * 73856093) ^ (cell[:, 1] * 19349663) ^ (cell[:, 2] * 83492791)
        _, inv = np.unique(key, return_inverse=True)
        cnt = np.bincount(inv).astype(float)
        for k in range(1, K):
            off = pts[:, k] - root
            mean = np.stack([np.bincount(inv, off[:, i]) / cnt for i in range(3)], 1)[inv]
            w = clump * s[k] ** 1.6 * (0.6 + 0.8 * rng.random(N))
            pts[:, k] = root + off * (1 - w)[:, None] + mean * w[:, None]
    for k in range(2, K):
        pts[:, k] += rng.normal(0, 1, (N, 3)) * (frizz * L * s[k])[:, None]
    rad = r0 * (1.0 - taper * s)[None, :] * (0.8 + 0.4 * rng.random(N) + 0.3 * is_guard)[:, None]
    tcol = s[None, :, None] ** 1.3
    cols = col_root[:, None, :] * (1 - tcol) + col_tip[:, None, :] * tcol
    cols[:, 0] *= root_dark
    return pts, rad, cols


def collide(pts, bvh, floor=0.0002, offset=0.0003, log=print):
    """Push strand points out of the body (BVH of the posed skin) and the floor."""
    t = time.time()
    N, K = pts.shape[:2]
    moved = 0
    for k in range(1, K):
        P = pts[:, k]
        for i in range(N):
            hit = bvh.find_nearest(Vector(P[i]), 0.02)
            if hit[0] is None:
                continue
            q, nn = hit[0], hit[1]
            d = (P[i, 0] - q.x) * nn.x + (P[i, 1] - q.y) * nn.y + (P[i, 2] - q.z) * nn.z
            if d < offset:
                push = offset - d
                pts[i, k:] += np.array([nn.x, nn.y, nn.z]) * push
                moved += 1
    below = pts[..., 2] < floor
    pts[..., 2] = np.maximum(pts[..., 2], floor)
    log(f"fur: collisions moved {moved} points, {int(below.sum())} lifted off the floor ({time.time() - t:.1f}s)")
    return pts


# --------------------------------------------------------------- the coat

def build(rng, p, c, rest_V, posed_V, Q, posed_N, comb_rest, L_rest, dens_rest, lift_rest, pal, markings,
          density_factor=1.0, inner_ear=None, ear_param=None, log=print):
    """Grow the whole coat. Returns a list of (points, radius, colours) parts."""
    T = quads_to_tris(Q)
    M = tri_maps(rest_V, posed_V, T)
    dens_t = dens_rest[T].mean(1) * (L_rest[T].min(1) > 0.0003)
    per_m2 = p["density"] * 1e4 * density_factor
    ti, bary = sample_tris(posed_V, T, dens_t * per_m2, None, rng)
    log(f"fur: {len(ti)} strands")
    root = interp(posed_V, T, ti, bary)
    nr = interp(posed_N, T, ti, bary)
    cb = np.einsum("nij,nj->ni", M[ti], interp(comb_rest, T, ti, bary))
    ln = interp(L_rest, T, ti, bary)
    lf = interp(lift_rest, T, ti, bary)
    cs = c.at(T, ti, bary)
    pal_l = pal
    probs = probabilities(pal_l, markings(cs), len(ti))
    cr, ct, _ = strand_colours(pal_l, probs, rng, p["jitter"])
    pts, rad, cols = grow(root, nr, cb, ln, cr, ct, rng, K=p["points"], lift=lf, r0=p["radius"] * 1e-3,
                          taper=p["taper"], clump=p["clump"], clump_size=p["clump_size"] * 1e-3,
                          spread=p["spread"], frizz=p["frizz"], guard=p["guard"], gravity=p["gravity"],
                          root_dark=p["root_dark"])
    parts = [(pts, rad, cols)]
    # inner-ear furnishings and lynx tips
    if inner_ear is not None:
        ear_t = ear_param
        f = p["furnish"]
        if f["length"] > 0 and f["count"] > 0:
            w = inner_ear * smoothstep(0.85, 0.2, ear_t)
            dt = w[T].mean(1)
            ti2, b2 = sample_tris(posed_V, T, dt, int(f["count"] * density_factor ** 0.5), rng)
            if len(ti2):
                r2 = interp(posed_V, T, ti2, b2)
                n2 = interp(posed_N, T, ti2, b2)
                up = np.einsum("nij,nj->ni", M[ti2], interp(comb_rest, T, ti2, b2))
                d = nrm(nrm(up) * 0.8 + n2 * 0.6)
                col = np.tile(srgb(f["colour"]), (len(ti2), 1))
                L2 = rng.uniform(0.7, 1.15, len(ti2)) * f["length"] * 1e-3
                parts.append(grow(r2, n2, d, L2, col, col, rng, K=6, lift=(40.0, 25.0), r0=0.00005,
                                  clump=0.4, clump_size=0.003, spread=20, frizz=0.08, root_dark=0.95))
        lx = p["lynx"]
        if lx["length"] > 0 and lx["count"] > 0:
            w = (c.ear > 0.5) * smoothstep(0.82, 0.97, ear_t)
            dt = w[T].mean(1)
            ti3, b3 = sample_tris(posed_V, T, dt, int(lx["count"]), rng)
            if len(ti3):
                r3 = interp(posed_V, T, ti3, b3)
                n3 = interp(posed_N, T, ti3, b3)
                up = np.einsum("nij,nj->ni", M[ti3], interp(comb_rest, T, ti3, b3))
                col = np.tile(srgb(lx["colour"]), (len(ti3), 1))
                L3 = rng.uniform(0.75, 1.1, len(ti3)) * lx["length"] * 1e-3
                parts.append(grow(r3, n3, up, L3, col, col, rng, K=6, lift=(12.0, 4.0), r0=0.00006,
                                  clump=0.7, clump_size=0.004, spread=8, frizz=0.03, root_dark=1.0))
    return parts


def bvh_of(V, Q):
    return BVHTree.FromPolygons([Vector(p) for p in V], np.asarray(Q).tolist())


def make_curves(name, parts):
    """parts: [(points (N, K, 3), radius (N, K), colours (N, K, 3))] -> a Curves object."""
    sizes, P, Rd, C = [], [], [], []
    for pts, radius, colors in parts:
        if not len(pts):
            continue
        N, K = pts.shape[:2]
        sizes += [K] * N
        P.append(pts.reshape(-1, 3))
        Rd.append(radius.ravel())
        C.append(colors.reshape(-1, 3))
    P, Rd, C = np.concatenate(P), np.concatenate(Rd), np.concatenate(C)
    cu = bpy.data.hair_curves.new(name)
    cu.add_curves(sizes)
    cu.attributes["position"].data.foreach_set("vector", P.astype(np.float32).ravel())
    r = cu.attributes.get("radius") or cu.attributes.new("radius", "FLOAT", "POINT")
    r.data.foreach_set("value", Rd.astype(np.float32))
    c = cu.attributes.new("fur_col", "FLOAT_COLOR", "POINT")
    rgba = np.ones((len(C), 4), np.float32)
    rgba[:, :3] = np.clip(C, 0, None)
    c.data.foreach_set("color", rgba.ravel())
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def material(name, hair):
    from .skin import nodes_for
    mat = bpy.data.materials.new(name)
    nt, out = nodes_for(mat)
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "fur_col"
    hb = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    hb.model = "CHIANG"
    hb.parametrization = "COLOR"
    nt.links.new(attr.outputs["Color"], hb.inputs["Color"])
    hb.inputs["Roughness"].default_value = hair["roughness"]
    hb.inputs["Radial Roughness"].default_value = hair["radial"]
    hb.inputs["Coat"].default_value = hair["coat"]
    hb.inputs["IOR"].default_value = hair["ior"]
    hb.inputs["Random Roughness"].default_value = hair["random_roughness"]
    nt.links.new(hb.outputs[0], out.inputs[0])
    return mat


def strands_count(parts):
    return int(sum(len(p[0]) for p in parts))


def angle(a, b):
    return math.degrees(math.acos(np.clip(np.dot(nrm(a), nrm(b)), -1, 1)))
