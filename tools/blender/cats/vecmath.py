"""Small numpy helpers shared by the cat generator: vectors, rotations, colour."""

import math

import numpy as np


def nrm(v, eps=1e-12):
    """Unit vector(s); zero vectors stay zero instead of turning into NaN."""
    v = np.asarray(v, float)
    if v.ndim == 1:
        return v / max(np.linalg.norm(v), eps)
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), eps)


def smoothstep(e0, e1, x):
    """Hermite step from e0 to e1 (e0 > e1 gives a falling step)."""
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def skew(v):
    return np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]], float)


def rot_axis(axis, ang):
    """3x3 rotation by ang radians about axis (right hand)."""
    axis = nrm(axis)
    k = skew(axis)
    return np.eye(3) + math.sin(ang) * k + (1 - math.cos(ang)) * (k @ k)


def rot_between(a, b):
    """Minimal 3x3 rotation taking direction a onto direction b."""
    a, b = nrm(a), nrm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.999999:
        ax = np.cross(a, [1.0, 0, 0])
        if np.linalg.norm(ax) < 1e-6:
            ax = np.cross(a, [0, 1.0, 0])
        return rot_axis(ax, math.pi)
    k = skew(v)
    return np.eye(3) + k + (k @ k) / (1.0 + c)


def rot_angle(R):
    """Angle of a 3x3 rotation, radians."""
    return math.acos(max(-1.0, min(1.0, (np.trace(R) - 1.0) / 2.0)))


def slerp_rot(R, t):
    """Rotation R scaled to the fraction t of its angle (about the same axis)."""
    ang = rot_angle(R)
    if ang < 1e-9:
        return np.eye(3)
    w = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]])
    if np.linalg.norm(w) < 1e-9:  # 180 degrees: any perpendicular axis of R + I
        S = R + np.eye(3)
        w = S[:, int(np.argmax(np.linalg.norm(S, axis=0)))]
    return rot_axis(w, ang * t)


def mat4(R=None, t=None):
    M = np.eye(4)
    if R is not None:
        M[:3, :3] = R
    if t is not None:
        M[:3, 3] = t
    return M


def about(R, pivot):
    """4x4 rotation R about a pivot point."""
    p = np.asarray(pivot, float)
    return mat4(R, p - R @ p)


def xform(M, P):
    """Apply a 4x4 affine matrix to points (..., 3)."""
    P = np.asarray(P, float)
    return P @ M[:3, :3].T + M[:3, 3]


def srgb(*c):
    """0-255 sRGB triple (or a '#rrggbb' hex string) to linear RGB."""
    if len(c) == 1 and isinstance(c[0], str):
        h = c[0].lstrip("#")
        c = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    c = np.asarray(c, float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    """Linear RGB (any shape) to display sRGB, 0..1."""
    c = np.clip(np.asarray(c, float), 0.0, None)
    return np.clip(np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055), 0, 1)


def luminance(c):
    c = np.asarray(c, float)
    return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722


def vertex_normals(V, F):
    """Area-weighted vertex normals of a mesh with triangle or quad faces."""
    F = np.asarray(F)
    Nv = np.zeros_like(V)
    if F.shape[1] == 4:
        n = np.cross(V[F[:, 2]] - V[F[:, 0]], V[F[:, 3]] - V[F[:, 1]])
    else:
        n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    for k in range(F.shape[1]):
        np.add.at(Nv, F[:, k], n)
    return nrm(Nv)


def quads_to_tris(Q):
    Q = np.asarray(Q)
    if Q.shape[1] == 3:
        return Q
    return np.vstack([Q[:, [0, 1, 2]], Q[:, [0, 2, 3]]])
