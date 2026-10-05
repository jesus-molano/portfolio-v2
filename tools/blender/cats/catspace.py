"""Anatomical coordinates for every point of the skin (the markings' canvas).

Markings are functions of these coordinates, never of UVs (the base mirrors
the head UVs, so an asymmetric blaze could not be painted there). They are
computed on the shaped rest mesh (standing, facing -Y, the cat's left +X) and
carried to the posed fur by barycentric interpolation, so the coat stays put
whatever the pose.

Fields (all arrays of length N; `CatSpace.at` resamples them anywhere):

- region weights from the skin weights: `head` (skull and face), `ear`,
  `neck`, `body`, `fore`, `hind`, `paw` (both pairs, Foot and toes), `tail`;
  `side` is +1 on the cat's left, -1 on its right (from x, or the leg);
- head frame: origin at the midpoint of the eyes, unit = the distance
  between the eye centres (E). `hx` + toward the cat's left (image right),
  `hf` + forward along the muzzle, `hu` + up the skull. The eyes are at
  hx = +-0.5, hf = hu = 0; `nose` gives the nose tip in these units;
- body: `s` along the torso's centre line, 0 at the withers (Neck01),
  1 at the tail root, below 0 up the neck; `dorsal` = cos(phi) and
  `lateral` = sin(phi) of the angle around that line (phi 0 on the back,
  +90 on the cat's left flank, 180 on the belly), `radial` = distance from
  the line over the local mean radius;
- legs: `leg_t` 0 at the shoulder or hip joint, 1 at the toe tips;
  `leg_front` +1 on the front of the leg, -1 behind; `leg_out` +1 on the
  outer face, -1 on the inner;
- tail: `tail_u` 0 at the root, 1 at the tip; `tail_dorsal` +1 on top;
- ears: `ear_t` 0 at the base of the ear, 1 at its tip (0 off the ears);
- `p` rest position (metres), `n` rest normal, `E` the head unit in metres.

Helpers for the markings: `fbm(freq, seed)` and `cells(freq, seed)` are
noise on the rest positions (freq in cycles per metre), deterministic.
"""

import numpy as np

from .noise import cells as _cells
from .noise import fbm as _fbm
from .rig import EARS, EYE_JOINT, LEGS, TAIL
from .vecmath import nrm, quads_to_tris, vertex_normals

FIELDS = ("head", "ear", "neck", "body", "fore", "hind", "paw", "tail", "side",
          "hx", "hf", "hu", "s", "dorsal", "lateral", "radial",
          "leg_t", "leg_front", "leg_out", "tail_u", "tail_dorsal", "ear_t")

BODY_JOINTS = ("Cat", "TSM3WorldJoint", "Root", "Pelvis", "Spine01", "Spine02", "Spine03", "Chest",
               "Belly_Jiggle", "L_Scapula", "R_Scapula", "L_Shoulder", "R_Shoulder")


class CatSpace:
    """Field arrays plus noise helpers. Build with `compute`, resample with `at`."""

    def __init__(self, **fields):
        self.__dict__.update(fields)

    def fbm(self, freq, seed=0, octaves=3, warp=0.0):
        """Value-noise fbm in [0, 1] on the rest positions (freq: cycles per metre)."""
        p = self.p * freq
        if warp:
            p = p + warp * (_fbm(p * 0.5, 2, seed + 101)[:, None] - 0.5)
        return _fbm(p, octaves, seed)

    def cells(self, freq, seed=0):
        """Worley distance (0 at a cell centre, about 1 at the borders)."""
        return _cells(self.p * freq, seed)

    def at(self, T, ti, bary):
        """The fields at points given by triangle index and barycentrics."""
        out = {}
        for k in FIELDS + ("p", "n"):
            a = getattr(self, k)
            out[k] = np.einsum("nk,nk...->n...", bary, a[T[ti]])
        out["n"] = nrm(out["n"])
        out["E"] = self.E
        out["nose"] = self.nose
        out["frame"] = self.frame
        out["origin"] = self.origin
        return CatSpace(**out)


def _polyline_param(P, pts):
    """Arc-length parameter of the closest point of a polyline, and that point."""
    seg = np.diff(pts, axis=0)
    lens = np.linalg.norm(seg, axis=1)
    cum = np.concatenate([[0], np.cumsum(lens)])
    best_d = np.full(len(P), np.inf)
    best_s = np.zeros(len(P))
    best_q = np.zeros_like(P)
    for i in range(len(seg)):
        a, d = pts[i], seg[i]
        t = np.clip(((P - a) @ d) / max(d @ d, 1e-12), 0, 1)
        q = a + t[:, None] * d
        dist = np.linalg.norm(P - q, axis=1)
        m = dist < best_d
        best_d[m], best_s[m], best_q[m] = dist[m], cum[i] + t[m] * lens[i], q[m]
    return best_s, best_q, cum[-1], best_d


def _smooth_line(pts, n=3):
    out = pts.copy()
    for _ in range(n):
        out[1:-1] = 0.25 * out[:-2] + 0.5 * out[1:-1] + 0.25 * out[2:]
    return out


def head_frame(skel, M=None):
    """(origin, frame columns left/fwd/up, E) of the head from the eye joints."""
    eL, eR = skel.head(EYE_JOINT["L"], M), skel.head(EYE_JOINT["R"], M)
    left = nrm(eL - eR)
    up = skel.head("Head_End", M) - skel.head("Head", M)
    up = nrm(up - np.dot(up, left) * left)
    fwd = np.cross(left, up)
    return 0.5 * (eL + eR), np.stack([left, fwd, up], axis=1), float(np.linalg.norm(eL - eR))


def compute(skel, V, Q, W):
    """CatSpace of the rest mesh V (N, 3) with quads Q and skin weights W."""
    names = skel.names
    idx = skel.i
    B = len(names)

    def subtree(name):
        out = [idx(name)]
        for j in range(B):
            if skel.parent[j] in out:
                out.append(j)
        return out

    ear = set(subtree(EARS["L"][0])) | set(subtree(EARS["R"][0]))
    head = set(subtree("Head")) - ear
    sets = dict(head=head, ear=ear, neck={idx(n) for n in ("Neck01", "Neck02", "Neck03")},
                body={idx(n) for n in BODY_JOINTS},
                fore=set(subtree(LEGS["fore.L"][0])) | set(subtree(LEGS["fore.R"][0])),
                hind=set(subtree(LEGS["hind.L"][0])) | set(subtree(LEGS["hind.R"][0])),
                paw=set().union(*[set(subtree(c[2])) for c in LEGS.values()]),
                tail={idx(n) for n in TAIL})
    f = {k: W[:, sorted(v)].sum(1) for k, v in sets.items()}
    N = len(V)
    n = vertex_normals(V, Q)

    # head frame
    origin, F, E = head_frame(skel)
    q = (V - origin) @ F / E
    f["hx"], f["hf"], f["hu"] = q[:, 0], q[:, 1], q[:, 2]
    mid = (f["head"] > 0.5) & (np.abs(f["hx"]) < 0.08)
    nose_i = np.nonzero(mid)[0][np.argmax(f["hf"][mid])]
    nose = q[nose_i]

    # torso centre line: the spine joints run along the back; drop each to
    # the centroid of its cross-section, then smooth
    spine = ["Head", "Neck03", "Neck02", "Neck01", "Chest", "Spine03", "Spine02", "Spine01", "Pelvis", "Tail01"]
    J = np.array([skel.head(x) for x in spine])
    s_j, _, _, _ = _polyline_param(V, J)
    jl = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(J, axis=0), axis=1))])
    trunk = (f["body"] + f["neck"]) > 0.5
    C = J.copy()
    for k in range(1, len(J) - 1):
        m = trunk & (np.abs(s_j - jl[k]) < 0.5 * (jl[k + 1] - jl[k - 1]) * 0.5)
        if m.sum() > 20:
            C[k] = V[m].mean(0)
    C[0] = J[0]
    C = _smooth_line(C)
    s_c, Qc, total, dist = _polyline_param(V, C)
    cl = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))])
    s0, s1 = cl[3], cl[-1]  # Neck01 .. Tail01
    f["s"] = (s_c - s0) / (s1 - s0)
    # angle around the line: tangent at the closest point, up = world Z
    tang = np.zeros_like(V)
    for i in range(len(C) - 1):
        m = (s_c >= cl[i]) & (s_c <= cl[i + 1])
        tang[m] = C[i + 1] - C[i]
    tang = nrm(tang)
    upv = nrm(np.array([0, 0, 1.0]) - (tang @ np.array([0, 0, 1.0]))[:, None] * tang)
    lat = np.cross(tang, upv)  # tangent runs head -> tail (+Y): Y x Z = +X, the cat's left
    r = V - Qc
    f["dorsal"] = np.einsum("ij,ij->i", nrm(r), upv)
    f["lateral"] = np.einsum("ij,ij->i", nrm(r), lat)
    # radial: distance over the mean distance of trunk points at that s
    bins = np.clip(((s_c / max(total, 1e-9)) * 40).astype(int), 0, 39)
    mean_r = np.ones(40)
    for k in range(40):
        m = trunk & (bins == k)
        if m.sum() > 5:
            mean_r[k] = dist[m].mean()
    f["radial"] = dist / mean_r[bins]

    # legs
    f["leg_t"] = np.zeros(N)
    f["leg_front"] = np.zeros(N)
    f["leg_out"] = np.zeros(N)
    legw = np.zeros(N)
    for key, chain in LEGS.items():
        w = W[:, sorted(set().union(*[set(subtree(chain[0]))]))].sum(1)
        J = np.array([skel.head(x) for x in chain])
        t, Qp, total, _ = _polyline_param(V, J)
        rr = nrm(V - Qp)
        sx = 1.0 if key.endswith("L") else -1.0
        f["leg_t"] += w * t / total
        f["leg_front"] += w * (rr @ np.array([0, -1.0, 0]))
        f["leg_out"] += w * (rr @ np.array([sx, 0, 0]))
        legw += w
    for k in ("leg_t", "leg_front", "leg_out"):
        f[k] = f[k] / np.maximum(legw, 1e-6)
    # tail: chain plus the farthest tail point as the tip
    J = np.array([skel.head(x) for x in TAIL])
    tw = f["tail"] > 0.5
    tip = V[tw][np.argmax(np.linalg.norm(V[tw] - J[-1], axis=1))] if tw.any() else J[-1]
    J = np.vstack([J, tip])
    t, Qp, total, _ = _polyline_param(V, J)
    f["tail_u"] = t / total
    f["tail_dorsal"] = nrm(V - Qp) @ np.array([0, 0, 1.0])
    # ears: 0 at the base, 1 at the farthest ear point along the ear's axis
    f["ear_t"] = np.zeros(N)
    for side, chain in EARS.items():
        H = np.array([skel.head(x) for x in chain])
        sel = (f["ear"] > 0.5) & (np.sign(f["hx"]) == (1 if side == "L" else -1))
        if sel.any():
            axis = H[-1] - H[0]
            t = (V[sel] - H[0]) @ axis / (axis @ axis)
            f["ear_t"][sel] = np.clip(t / max(t.max(), 1e-6), 0, 1)
    # side: +1 on the cat's left, from x relative to the midline of the trunk
    f["side"] = np.tanh((V[:, 0] - Qc[:, 0]) / 0.01)
    return CatSpace(p=V.copy(), n=n, E=E, nose=nose, frame=F, origin=origin, **f)


def triangles(Q):
    return quads_to_tris(Q)
