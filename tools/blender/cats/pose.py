"""The line-up pose: an upright sit facing the lens, then each cat's deltas.

Start: the bundled clip's sit (frame 160 by default: upright, compact, front
paws together), with the face joints (lids, brows, lips, jaw, cheeks) back
at rest, because that frame has the eyes shut and the brows down. Then:

1. the whole cat turns about the vertical so its shoulders and hips face the
   camera (the camera looks along +Y; the cat faces -Y, its left is +X);
2. body deltas: `spine.slump` + rounds the back over Spine01..Chest (the
   chest comes forward and down), `hips.roll` / `hips.yaw` turn the pelvis
   with the hind legs and tail (a lazy sit; roll + swings the hind legs to
   image left), `body.yaw` + turns the whole cat to image right;
3. the head is levelled and aimed at the lens (its natural pitch from the
   standing frame 0), then `head.pitch/yaw/roll` are added. Every head
   rotation is spread over Neck01-03 and Head (`neck_share`), so the neck
   bends instead of the head pivoting on a stiff neck;
4. ears: `swivel` (about the head's up axis, + turns the opening outward),
   `back` (about the head's left axis, + lays the ear back), `out` (about
   the head's forward axis, + drops the ear sideways: "airplane ears");
5. lids: 0 = open (rest), 1 = shut (the clip's blink at frame 160), per lid;
6. `bones`: any joint, world-axis degrees (pitch, yaw, roll), for what the
   named controls do not cover;
7. paws stay planted: each paw is locked where step 1 left it, and two-bone
   IK on the upper and lower leg brings it back after the body edits, plus
   its own offset (`paws.fore.R.lift` lifts it, in cm), `tilt` (about the
   image's horizontal, + turns the pads up toward the lens), `roll` (about
   the lens axis, + tips the paw's top toward image right, seen from the
   camera) and `yaw` (about the vertical);
8. after the floor is known (see build_cats.py), the tail follows a path in
   floor coordinates (cm, origin at the footprint centre on the floor, x to
   image right, y away from the camera, z up): each tail joint is aimed at
   the point of the path one joint length further on. The build report
   (`<cat>-report.json`) lists the tail root and the paws in these
   coordinates, so a path can be written against them;
9. `gaze`: the eyes look at the lens, then turn by yaw / pitch (eyes.py);
10. `relax.belly`: iterations of a smoothing of the posed skin under the
   trunk, from the chest to the belly (`relax`, `belly_weights`). A heavy
   cat's chest skin folds over its belly in the sit and reads as a ledge
   between the forelegs; this irons it out. 0 (the default) leaves the
   skin as skinned.

Angles are degrees. Signs, seen from the camera: pitch + raises the nose,
yaw + turns the face to image right (toward slots 3 and 4), roll + tilts
the top of the head to image right.
"""

import copy
import math

import numpy as np

from .rig import EARS, EYE_JOINT, FACE, LEGS, LIDS, TAIL
from .vecmath import nrm, rot_axis, rot_between, slerp_rot, smoothstep

DEFAULT = dict(
    clip_frame=160,
    neck_share=[0.2, 0.25, 0.25, 0.3],
    body=dict(yaw=0.0),
    spine=dict(slump=0.0),
    hips=dict(roll=0.0, yaw=0.0),
    head=dict(pitch=0.0, yaw=0.0, roll=0.0),
    ears=dict(L=dict(swivel=0.0, back=0.0, out=0.0), R=dict(swivel=0.0, back=0.0, out=0.0)),
    lids=dict(L=dict(upper=0.2, lower=0.0), R=dict(upper=0.2, lower=0.0)),
    bones={},
    paws=dict(
        fore=dict(L=dict(lift=0.0, forward=0.0, out=0.0, tilt=0.0, roll=0.0, yaw=0.0),
                  R=dict(lift=0.0, forward=0.0, out=0.0, tilt=0.0, roll=0.0, yaw=0.0)),
        hind=dict(L=dict(lift=0.0, forward=0.0, out=0.0, tilt=0.0, roll=0.0, yaw=0.0),
                  R=dict(lift=0.0, forward=0.0, out=0.0, tilt=0.0, roll=0.0, yaw=0.0)),
    ),
    # tail path in floor cm (see the module doc); None keeps the clip's tail
    tail=None,
    tail_tip_lift=0.0,  # cm, raises the last joints off the floor (a flicked tip)
    gaze=dict(yaw=0.0, pitch=0.0),  # degrees from looking at the lens (eyes.py)
    relax=dict(belly=0),  # smoothing iterations of the posed skin under the trunk (step 10)
)


def merged(params):
    """DEFAULT deep-updated by a partial params dict (unknown keys are errors)."""
    def upd(base, new, path):
        for k, v in new.items():
            if k not in base:
                if path.endswith("bones"):
                    base[k] = v
                    continue
                raise KeyError(f"unknown pose parameter {path}.{k}")
            if isinstance(base[k], dict) and isinstance(v, dict):
                upd(base[k], v, f"{path}.{k}")
            else:
                base[k] = v
    out = copy.deepcopy(DEFAULT)
    upd(out, params or {}, "pose")
    return out


def belly_weights(cs):
    """0..1 over the underside of the trunk from the chest to the belly (CatSpace fields)."""
    return (np.clip(cs.body, 0, 1) * smoothstep(-0.15, -0.55, cs.dorsal)
            * smoothstep(0.1, 0.22, cs.s) * smoothstep(0.62, 0.5, cs.s))


def relax(V, Q, w, iterations, lam=0.5):
    """Laplacian smoothing of the vertices V (quads Q), each step scaled by w.

    A fold pulls in and flattens out (the skin there loses a few millimetres
    of girth, which the shape's girths make up). Where w is 0 nothing moves.
    """
    if iterations <= 0:
        return V
    E = np.concatenate([Q[:, [0, 1]], Q[:, [1, 2]], Q[:, [2, 3]], Q[:, [3, 0]]])
    E = np.concatenate([E, E[:, ::-1]])
    deg = np.maximum(np.bincount(E[:, 0], minlength=len(V)), 1).astype(float)[:, None]
    step = lam * np.asarray(w, float)[:, None]
    V = V.copy()
    for _ in range(int(iterations)):
        S = np.stack([np.bincount(E[:, 0], V[E[:, 1], k], len(V)) for k in range(3)], 1)
        V += step * (S / deg - V)
    return V


def head_frame(skel, P):
    """Columns (left, forward, up) of the head from the eyes and the skull."""
    eL = P[skel.i(EYE_JOINT["L"]), :3, 3]
    eR = P[skel.i(EYE_JOINT["R"]), :3, 3]
    left = nrm(eL - eR)
    up = P[skel.i("Head_End"), :3, 3] - P[skel.i("Head"), :3, 3]
    up = nrm(up - np.dot(up, left) * left)
    fwd = np.cross(left, up)
    return np.stack([left, fwd, up], axis=1)


def body_facing(skel, P):
    """Horizontal facing of the body from its shoulders and hips."""
    lat = (P[skel.i(LEGS["fore.L"][0]), :3, 3] - P[skel.i(LEGS["fore.R"][0]), :3, 3]
           + P[skel.i(LEGS["hind.L"][0]), :3, 3] - P[skel.i(LEGS["hind.R"][0]), :3, 3])
    lat[2] = 0
    return nrm(np.cross(nrm(lat), [0, 0, 1.0]))


def footprint(skel, P):
    """Mean of the four paw (Foot) joints."""
    return np.mean([P[skel.i(c[2]), :3, 3] for c in LEGS.values()], axis=0)


def _spread(skel, basis, R, share, chain):
    for name, k in zip(chain, share):
        basis = skel.rotate(basis, name, slerp_rot(R, k))
    return basis


def two_bone_ik(skel, basis, chain, target):
    """Bend chain[0] and chain[1] so chain[2]'s head reaches target; keep the bend plane."""
    P = skel.fk(basis)
    A, Bp, C = (P[skel.i(n), :3, 3] for n in chain[:3])
    a, b = np.linalg.norm(Bp - A), np.linalg.norm(C - Bp)
    T = np.asarray(target, float)
    d = np.clip(np.linalg.norm(T - A), abs(a - b) + 1e-6, a + b - 1e-6)
    u = nrm(T - A)
    pole = Bp - A - np.dot(Bp - A, u) * u
    if np.linalg.norm(pole) < 1e-6:
        pole = np.cross(u, [1.0, 0, 0])
    w = nrm(pole)
    x = (a * a - b * b + d * d) / (2 * d)
    Bn = A + u * x + w * math.sqrt(max(a * a - x * x, 0.0))
    basis = skel.rotate(basis, chain[0], rot_between(Bp - A, Bn - A))
    P = skel.fk(basis)
    Bq, Cq = P[skel.i(chain[1]), :3, 3], P[skel.i(chain[2]), :3, 3]
    return skel.rotate(basis, chain[1], rot_between(Cq - Bq, T - Bq))


def sit(skel, clip, params, unit=1.0, log=print):
    """Steps 1 to 7 of the module doc. Returns the basis matrices.

    unit: pose-frame metres per final metre (the build scales the posed cat
    to its ear-tip height afterwards; it passes 1 / that scale so the paw
    offsets come out in final centimetres).
    """
    p = merged(params)
    f = int(p["clip_frame"])
    basis = clip[f].copy()
    for n in FACE:
        basis[skel.i(n)] = np.eye(4)
    # lids: a fraction of the clip's blink
    for side, (up, low) in LIDS.items():
        for name, key in ((up, "upper"), (low, "lower")):
            i = skel.i(name)
            R = clip[160][i][:3, :3]
            basis[i][:3, :3] = slerp_rot(R, float(p["lids"][side][key]))
    P = skel.fk(basis)
    # 1. face the camera
    face = body_facing(skel, P)
    yaw0 = math.atan2(face[0], -face[1])  # angle of the facing from -Y toward +X
    R = rot_axis([0, 0, 1.0], math.radians(p["body"]["yaw"]) - yaw0)
    basis = skel.transform_root(basis, _about(R, footprint(skel, P)))
    locks = {k: skel.fk(basis)[skel.i(c[2])].copy() for k, c in LEGS.items()}
    # 2. body
    P = skel.fk(basis)
    if p["spine"]["slump"]:
        R = rot_axis([1.0, 0, 0], math.radians(p["spine"]["slump"]) / 4)
        for n in ("Spine01", "Spine02", "Spine03", "Chest"):
            basis = skel.rotate(basis, n, R)
    if p["hips"]["roll"] or p["hips"]["yaw"]:
        R = rot_axis([0, 0, 1.0], math.radians(p["hips"]["yaw"])) @ rot_axis(
            [0, 1.0, 0], math.radians(p["hips"]["roll"]))
        basis = skel.rotate(basis, "Pelvis", R)
    # 3. head: level at the lens, then the cat's own turn
    F = head_frame(skel, skel.fk(clip[0]))
    pitch0 = math.asin(np.clip(F[2, 1], -1, 1))  # natural pitch of the forward axis
    chain = ["Neck01", "Neck02", "Neck03", "Head"]
    share = np.asarray(p["neck_share"], float)
    share = share / share.sum()

    def target_frame(yaw, pitch, roll):
        Rt = rot_axis([0, 0, 1.0], math.radians(yaw)) @ rot_axis([1.0, 0, 0], -(pitch0 + math.radians(pitch)))
        Rt = Rt @ rot_axis([0, -1.0, 0], -math.radians(roll))
        return Rt @ np.stack([[1.0, 0, 0], [0, -1.0, 0], [0, 0, 1.0]], axis=1)

    for _ in range(3):  # the spread rotations interact a little; converge
        F = head_frame(skel, skel.fk(basis))
        Ft = target_frame(p["head"]["yaw"], p["head"]["pitch"], p["head"]["roll"])
        basis = _spread(skel, basis, Ft @ F.T, share, chain)
    # 4. ears
    P = skel.fk(basis)
    F = head_frame(skel, P)
    left, fwd, up = F[:, 0], F[:, 1], F[:, 2]
    for side, c in EARS.items():
        e = p["ears"][side]
        s = 1.0 if side == "L" else -1.0
        R = (rot_axis(fwd, -s * math.radians(e["out"])) @ rot_axis(left, -math.radians(e["back"]))
             @ rot_axis(up, s * math.radians(e["swivel"])))
        basis = skel.rotate(basis, c[0], R)
    # 6. free edits
    for name, (pi, ya, ro) in p["bones"].items():
        R = rot_axis([0, 0, 1.0], math.radians(ya)) @ rot_axis([1.0, 0, 0], -math.radians(pi)) @ rot_axis(
            [0, 1.0, 0], math.radians(ro))
        basis = skel.rotate(basis, name, R)
    # 7. paws back to their locks (plus offsets)
    for key, c in LEGS.items():
        kind, side = key.split(".")
        o = p["paws"][kind][side]
        s = 1.0 if side == "L" else -1.0
        T = locks[key][:3, 3] + 0.01 * unit * np.array([s * o["out"], -o["forward"], o["lift"]])
        basis = two_bone_ik(skel, basis, c, T)
        P = skel.fk(basis)
        i = skel.i(c[2])
        Rk = locks[key][:3, :3] @ np.linalg.inv(P[i, :3, :3])
        Rk = (rot_axis([0, 0, 1.0], math.radians(o["yaw"])) @ rot_axis([0, 1.0, 0], math.radians(o["roll"]))
              @ rot_axis([1.0, 0, 0], -math.radians(o["tilt"])) @ _orth(Rk))
        basis = skel.rotate(basis, c[2], Rk)
    return basis


def tail_path(skel, basis, points, M, tip_lift=0.0, tip_len=None):
    """Aim the tail joints along a Catmull-Rom path given in floor cm.

    M maps the pose frame to the floor frame (metres); points are converted
    back with its inverse. tip_lift (cm) raises the last two joints' targets.
    """
    Minv = np.linalg.inv(M)
    P = skel.fk(basis)
    root = P[skel.i(TAIL[0]), :3, 3]
    pts = np.asarray(points, float) * 0.01
    pts = pts @ Minv[:3, :3].T + Minv[:3, 3]
    path = spline(np.vstack([root, pts]))
    lengths = [np.linalg.norm(P[skel.i(b), :3, 3] - P[skel.i(a), :3, 3]) for a, b in zip(TAIL, TAIL[1:])]
    lengths.append(tip_len or lengths[-1])
    lift = np.zeros(3)
    lift[2] = tip_lift * 0.01 / M[2, 2]
    for k, name in enumerate(TAIL):
        P = skel.fk(basis)
        h = P[skel.i(name), :3, 3]
        if k + 1 < len(TAIL):
            child = P[skel.i(TAIL[k + 1]), :3, 3]
        else:
            prev = P[skel.i(TAIL[k - 1]), :3, 3]
            child = h + nrm(h - prev) * lengths[k]
        tgt = _follow(path, h, lengths[k])
        if k >= len(TAIL) - 2:
            tgt = nrm(tgt * lengths[k] + lift * (k - len(TAIL) + 3) / 2)
        basis = skel.rotate(basis, name, rot_between(child - h, tgt))
    return basis


def spline(pts, n=400):
    """Catmull-Rom through pts, resampled densely."""
    P = np.asarray(pts, float)
    if len(P) < 2:
        return P
    P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    seg = max(n // (len(P) - 3), 2)
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, seg, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out)


def _follow(path, h, length):
    """Direction from h to the first path point at least `length` away, ahead."""
    d = np.linalg.norm(path - h, axis=1)
    i0 = int(np.argmin(d))
    for j in range(i0, len(path)):
        if d[j] >= length:
            return nrm(path[j] - h)
    return nrm(path[-1] - path[-2])


def _about(R, pivot):
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = pivot - R @ pivot
    return M


def _orth(R):
    u, _, vt = np.linalg.svd(R)
    return u @ vt
