"""Deterministic value noise for the markings (same numbers on every machine).

Integer hashing, no global random state: a marking edge drawn with
`fbm(points * 60, seed=3)` is the same in every build.
"""

import numpy as np


def _hash(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h &= 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h ^= h >> 16
    return (h & 0xFFFFFF).astype(np.float64) / float(0xFFFFFF)


def vnoise(p, seed=0):
    """Smooth value noise in [0, 1] for points (N, 3)."""
    p = np.asarray(p, float)
    pi = np.floor(p).astype(np.int64)
    pf = p - pi
    w = pf * pf * (3 - 2 * pf)
    out = np.zeros(len(p))
    for dx in (0, 1):
        wx = w[:, 0] if dx else 1 - w[:, 0]
        for dy in (0, 1):
            wy = w[:, 1] if dy else 1 - w[:, 1]
            for dz in (0, 1):
                wz = w[:, 2] if dz else 1 - w[:, 2]
                h = _hash(pi[:, 0] + dx, pi[:, 1] + dy, pi[:, 2] + dz, seed)
                out += h * wx * wy * wz
    return out


def fbm(p, octaves=3, seed=0):
    """Fractal sum of value noise, normalised to [0, 1] (mean about 0.5)."""
    p = np.asarray(p, float)
    tot, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        tot = tot + amp * vnoise(p * (2.0 ** o), seed + 17 * o)
        norm += amp
        amp *= 0.5
    return tot / norm


def cells(p, seed=0):
    """Cellular (Worley F1) distance for points (N, 3) on a unit grid, 0..~1.

    Used for blotches (Kira's tortie patches): threshold it for islands.
    """
    p = np.asarray(p, float)
    pi = np.floor(p).astype(np.int64)
    best = np.full(len(p), 9.0)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                c = pi + np.array([dx, dy, dz])
                jit = np.stack([_hash(c[:, 0], c[:, 1], c[:, 2], seed + k) for k in range(3)], 1)
                d = np.linalg.norm(c + jit - p, axis=1)
                best = np.minimum(best, d)
    return best
