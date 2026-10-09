"""Re-grooms the hero driver on the GLB: soft skin fade, short crop, full beard.

build_driver_mpfb.py makes the driver with hair and beard shells, but it
needs MPFB, the MakeHuman assets and the private params file. This script is
a deterministic post-process on its GLB that redoes the grooming only:

- a short crop, about 4 mm on top and 5 mm at the front, lying close to the
  head with the scalp showing through, a little salt and pepper at the
  front and the temples (the owner wears it between shaved and this; a
  centimetre standing up, dense and speckled with grey, read as an afro);
- a long, soft skin fade: bare skin round the ears and at the nape, then
  the shadow of the roots and the hair coming in little by little over some
  4 cm up to the top length (over a narrower band it read as a step);
- a beard fade at the sideburns: the beard runs up in front of the ears and
  thins out by their top, where the skin fade starts;
- a dense, near-black beard, full along the whole jawline to the angle of
  the jaw and under the ears, with a natural cheek line, a clean neckline
  under the jaw, short on the cheeks, longer and fuller on the chin and the
  goatee (grey strands mixed in at the chin and under the jaw);
- a full moustache over the whole upper lip, from the lip line up to the
  base of the nose (a little thinner under the nostrils), hanging over the
  lip and joined to the beard at the mouth corners.

How it works. The landmarks come from the Human mesh in its bind pose: the
ears (dense patches of short edges at the sides of the head), the eyes (the
eye mesh), the midline profile (nose tip, subnasale, lips, the mentolabial
sulcus, the chin and the cervical point where the chin turns into the
throat), the mouth corners (where the skin meets the mouth cavity) and the
lips (lip red in the skin texture). In the head frame of the build script
(theta around the vertical axis through the ear centres: 0 ahead, 90 at the
ears, 180 behind; h above the ear centres) `groom()` gives, for any point
on the skin, hair and beard density, length, grey share, comb (the way the
strands lean) and the shadow on the skin. It is evaluated at the vertices
for the shell geometry and at every texel for the textures, so the
hairline, the fade, the cheek line and the neckline are smooth curves, not
the zigzag of the 1 cm head mesh. Then:

- rebuilds the three HairShell meshes from the Human faces with density
  > 0.02 plus one ring (UV islands packed into one square, skin weights
  copied from the Human vertices, so they follow the head bone). Each mesh
  holds LAYERS_PER_SHELL layers, one glTF primitive each, twelve in all,
  sharing UVs, normals, weights and indices. A layer at the fraction f of
  the strand length stands at f times the local length along the strand
  direction: the normal leaning toward the comb (the beard hangs, the
  moustache falls down and out over the lip, the crop grows out from
  the crown). Its COLOR_0 alpha is the material's cut-off over f, which
  three.js (and Blender's importer) multiplies into the texture's alpha
  before the alpha test, so each layer shows only the strands that reach
  it; its COLOR_0 RGB darkens the inner layers. The three materials keep
  their names, get the cut-offs of their first layers and turn matte;
- regenerates the 1024 px hair texture in that square with one strand per
  texel (about 0.5 mm): every texel gets its point on the skin by
  rasterising the shell triangles in UV space (barycentric interpolation);
  hashes of the texel decide whether a strand grows there (by the
  density), its height (alpha, stored at the middle of its layer bin) and
  its colour (near black with some spread, a few brown ones, grey by the
  local share). Texels without a strand carry the colour of the skin under
  them, so mipmaps blend a sparse edge into the skin from afar;
- re-bakes the 2048 px skin texture: the old stubble and beard shadow comes
  off (the build script's mix with a dark colour, inverted against the clean
  skin around it, which keeps the skin's detail; the clean skin is filled in
  where the old shadow was too dark to invert), then the new shadow goes on:
  dark roots under the hair and the beard, a blue-grey cast at the bottom of
  the fade and bare skin round the ears.

Everything else in the GLB (body, tee, earring, eyes, brows, lashes, rig,
their materials and alpha modes) is copied byte for byte.

Usage (needs numpy and Pillow, which the Blender module venv has; Blender's
own Python has no Pillow):
    python refine_driver_hair.py <in.glb> <out.glb>
Run it on the build script's driver.glb, never on its own output (it
refuses); public/models/makehuman-driver holds the result.
"""

import io
import json
import os
import struct
import sys

import numpy as np

try:
    from PIL import Image
except ImportError:
    sys.exit("refine_driver_hair.py needs Pillow: run it with the bpy venv's Python")

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
SRC, DST = argv[0], argv[1]

HAIR_SIZE = 1024
SKIN_SIZE = 2048
# Shell layers: each of the three HairShell meshes holds LAYERS_PER_SHELL
# offset copies of the hairy skin, at these fractions of the strand length.
LAYERS_PER_SHELL = 4
LAYER_F = (np.arange(3 * LAYERS_PER_SHELL) + 0.6) / (3 * LAYERS_PER_SHELL)
# Hair is matte: a rough, weak specular, so the beard does not read as
# glossy plastic.
HAIR_ROUGHNESS = 0.82
HAIR_SPECULAR = 0.35
WEBP_QUALITY = 88  # the build script's
SKIN_WEBP_QUALITY = 84  # the re-baked skin has finer detail; keeps the GLB near its size


def log(*args):
    print("REFINE", *args, flush=True)


# ---------------------------------------------------------------- GLB I/O

COMPONENT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class Glb:
    """A GLB as JSON plus one list of buffer views, rewritten on save."""

    def __init__(self, path):
        data = open(path, "rb").read()
        json_len = struct.unpack("<I", data[12:16])[0]
        self.json = json.loads(data[20 : 20 + json_len])
        bin_len = struct.unpack("<I", data[20 + json_len : 24 + json_len])[0]
        blob = data[28 + json_len : 28 + json_len + bin_len]
        self.views = [blob[v.get("byteOffset", 0) : v.get("byteOffset", 0) + v["byteLength"]] for v in self.json["bufferViews"]]

    def node(self, name):
        return next(n for n in self.json["nodes"] if n.get("name") == name)

    def accessor(self, index):
        a = self.json["accessors"][index]
        view = self.json["bufferViews"][a["bufferView"]]
        n = WIDTH[a["type"]]
        dtype = np.dtype(COMPONENT[a["componentType"]])
        assert view.get("byteStride", n * dtype.itemsize) == n * dtype.itemsize
        arr = np.frombuffer(self.views[a["bufferView"]], dtype, a["count"] * n, a.get("byteOffset", 0))
        return arr.reshape(a["count"], n).copy() if n > 1 else arr.copy()

    def primitive(self, name):
        return self.json["meshes"][self.node(name)["mesh"]]["primitives"][0]

    def mesh(self, name):
        prim = self.primitive(name)
        out = {k: self.accessor(v) for k, v in prim["attributes"].items()}
        out["indices"] = self.accessor(prim["indices"]).reshape(-1, 3).astype(np.int64)
        return out

    def add_view(self, data, target=None):
        self.views.append(bytes(data))
        view = {"buffer": 0, "byteLength": len(data)}
        if target:
            view["target"] = target
        self.json["bufferViews"].append(view)
        return len(self.views) - 1

    def add_accessor(self, arr, component, kind, target, minmax=False):
        arr = np.ascontiguousarray(arr, dtype=COMPONENT[component])
        acc = {"bufferView": self.add_view(arr.tobytes(), target), "componentType": component,
               "count": int(arr.shape[0]), "type": kind}
        if minmax:
            acc["min"] = [float(v) for v in arr.min(axis=0)]
            acc["max"] = [float(v) for v in arr.max(axis=0)]
        self.json["accessors"].append(acc)
        return len(self.json["accessors"]) - 1

    def image(self, name):
        img = next(i for i in self.json["images"] if i.get("name") == name)
        return img, bytes(self.views[img["bufferView"]])

    def set_image(self, name, data):
        img, _ = self.image(name)
        img["bufferView"] = self.add_view(data)

    def save(self, path):
        """Drops unreferenced accessors and views, then lays the buffer out again."""
        J = self.json
        used_acc = set()
        for mesh in J["meshes"]:
            for prim in mesh["primitives"]:
                used_acc.update(prim["attributes"].values())
                if "indices" in prim:
                    used_acc.add(prim["indices"])
        for skin in J.get("skins", []):
            if "inverseBindMatrices" in skin:
                used_acc.add(skin["inverseBindMatrices"])
        acc_map = {old: new for new, old in enumerate(sorted(used_acc))}
        J["accessors"] = [J["accessors"][i] for i in sorted(used_acc)]
        for mesh in J["meshes"]:
            for prim in mesh["primitives"]:
                prim["attributes"] = {k: acc_map[v] for k, v in prim["attributes"].items()}
                if "indices" in prim:
                    prim["indices"] = acc_map[prim["indices"]]
        for skin in J.get("skins", []):
            if "inverseBindMatrices" in skin:
                skin["inverseBindMatrices"] = acc_map[skin["inverseBindMatrices"]]
        used_view = sorted({a["bufferView"] for a in J["accessors"]} | {i["bufferView"] for i in J["images"]})
        view_map = {old: new for new, old in enumerate(used_view)}
        for a in J["accessors"]:
            a["bufferView"] = view_map[a["bufferView"]]
        for i in J["images"]:
            i["bufferView"] = view_map[i["bufferView"]]
        blob = bytearray()
        views = []
        for old in used_view:
            view = dict(J["bufferViews"][old])
            blob += b"\0" * (-len(blob) % 4)
            view["byteOffset"] = len(blob)
            view["byteLength"] = len(self.views[old])
            blob += self.views[old]
            views.append(view)
        blob += b"\0" * (-len(blob) % 4)
        J["bufferViews"] = views
        J["buffers"] = [{"byteLength": len(blob)}]
        text = json.dumps(J, separators=(",", ":")).encode()
        text += b" " * (-len(text) % 4)
        out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(text) + 8 + len(blob))
        out += struct.pack("<I4s", len(text), b"JSON") + text
        out += struct.pack("<I4s", len(blob), b"BIN\0") + bytes(blob)
        with open(path, "wb") as f:
            f.write(out)


def decode_image(data):
    """WebP/PNG bytes -> float array (rows from the top, 0..1, RGB or RGBA)."""
    return np.asarray(Image.open(io.BytesIO(data)), dtype=np.float32) / 255.0


def encode_webp(arr, quality=WEBP_QUALITY):
    """float array (rows from the top, RGB or RGBA, sRGB) -> lossy WebP bytes."""
    u8 = np.clip(np.round(arr * 255), 0, 255).astype(np.uint8)
    buf = io.BytesIO()
    # exact: keep the colour under transparent texels (mipmaps blend it in).
    Image.fromarray(u8).save(buf, "WEBP", quality=quality, method=6, exact=True)
    return buf.getvalue()


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((np.maximum(c, 0.04045) + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.maximum(c, 0.0031308) ** (1 / 2.4) - 0.055)


# ---------------------------------------------------------------- helpers


def smooth(a, b, t):
    s = np.clip((t - a) / (b - a), 0, 1)
    return s * s * (3 - 2 * s)


def mix(a, b, t):
    return a + (b - a) * t


def unit(v):
    """Rows of v normalised (a zero row stays zero)."""
    n = np.linalg.norm(v, axis=1, keepdims=True)
    return v / np.maximum(n, 1e-12)


def weld(points):
    """Index of the first vertex at the same position (UV seams split vertices)."""
    key = np.round(points * 1e6).astype(np.int64)
    _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return first[inverse.ravel()]


def hash01(ix, iy, iz, seed):
    """Integer lattice hash -> uniform 0..1 (deterministic across platforms)."""
    h = (ix.astype(np.uint64) * np.uint64(73856093)) ^ (iy.astype(np.uint64) * np.uint64(19349663))
    h ^= iz.astype(np.uint64) * np.uint64(83492791)
    h ^= np.uint64((seed * 2654435761) & 0xFFFFFFFF)
    h &= np.uint64(0xFFFFFFFF)
    h ^= h >> np.uint64(13)
    h = (h * np.uint64(0x5BD1E995)) & np.uint64(0xFFFFFFFF)
    h ^= h >> np.uint64(15)
    h = (h * np.uint64(0x27D4EB2D)) & np.uint64(0xFFFFFFFF)
    h ^= h >> np.uint64(16)
    return h.astype(np.float64) / 4294967295.0


def value_noise(p, seed):
    """Smooth 3D value noise, p in lattice units (n, 3) -> 0..1."""
    base = np.floor(p)
    f = p - base
    u = f * f * (3 - 2 * f)
    i = (base.astype(np.int64) + (1 << 20)).astype(np.uint64)
    out = np.zeros(len(p))
    for dx in (0, 1):
        wx = u[:, 0] if dx else 1 - u[:, 0]
        for dy in (0, 1):
            wy = u[:, 1] if dy else 1 - u[:, 1]
            for dz in (0, 1):
                wz = u[:, 2] if dz else 1 - u[:, 2]
                out += wx * wy * wz * hash01(i[:, 0] + np.uint64(dx), i[:, 1] + np.uint64(dy), i[:, 2] + np.uint64(dz), seed)
    return out


def fbm(p, scale, seed, octaves=3):
    """Fractal value noise; `scale` is lattice cells per metre on x, y, z."""
    p = p * np.asarray(scale, dtype=np.float64)
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        total = total + amp * value_noise(p * (2.0**o) + 17.31 * o, seed + 101 * o)
        norm += amp
        amp *= 0.5
    return total / norm


def uniform(values):
    """Rank-normalise to an exact uniform 0..1 distribution (stable, deterministic)."""
    order = np.argsort(values, kind="stable")
    out = np.empty(len(values))
    out[order] = (np.arange(len(values)) + 0.5) / max(len(values), 1)
    return out


def rasterize(uv, faces, size):
    """Texels covered by triangles in UV space.

    uv: (n, 2) glTF UVs (v down the image); returns per covered texel its
    row, column, face index and barycentric weights.
    """
    px = uv * size
    rows, cols, fids, bary = [], [], [], []
    for f, (a, b, c) in enumerate(faces):
        pa, pb, pc = px[a], px[b], px[c]
        lo = np.floor(np.minimum(np.minimum(pa, pb), pc)).astype(int)
        hi = np.ceil(np.maximum(np.maximum(pa, pb), pc)).astype(int)
        lo = np.clip(lo, 0, size - 1)
        hi = np.clip(hi, 0, size - 1)
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
        qx, qy = xs.ravel() + 0.5, ys.ravel() + 0.5
        d = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1])
        if abs(d) < 1e-12:
            continue
        w0 = ((pb[1] - pc[1]) * (qx - pc[0]) + (pc[0] - pb[0]) * (qy - pc[1])) / d
        w1 = ((pc[1] - pa[1]) * (qx - pc[0]) + (pa[0] - pc[0]) * (qy - pc[1])) / d
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        rows.append(ys.ravel()[inside])
        cols.append(xs.ravel()[inside])
        fids.append(np.full(inside.sum(), f))
        bary.append(np.stack([w0[inside], w1[inside], w2[inside]], axis=1))
    rows, cols, fids, bary = map(np.concatenate, (rows, cols, fids, bary))
    # A texel on a shared edge keeps one triangle.
    key = rows * size + cols
    _, first = np.unique(key, return_index=True)
    return rows[first], cols[first], fids[first], bary[first]


def dilate(img, known, steps):
    """Spreads known texels outward `steps` texels (texture padding)."""
    img = img.copy()
    known = known.copy()
    for _ in range(steps):
        acc = np.zeros_like(img)
        cnt = np.zeros(known.shape)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(known, (dy, dx), axis=(0, 1))
            acc += np.roll(img, (dy, dx), axis=(0, 1)) * k[..., None]
            cnt += k
        grow = (~known) & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        known |= grow
    return img, known


def push_pull(img, weight):
    """Fills texels of weight 0 smoothly from the weighted ones (pyramid)."""
    h, w = weight.shape
    levels = []
    c, wt = img * weight[..., None], weight.astype(np.float64)
    while min(c.shape[:2]) > 4:
        levels.append((c, wt))
        hh, ww = c.shape[0] // 2, c.shape[1] // 2
        c = c[: hh * 2, : ww * 2].reshape(hh, 2, ww, 2, -1).sum(axis=(1, 3))
        wt = wt[: hh * 2, : ww * 2].reshape(hh, 2, ww, 2).sum(axis=(1, 3))
    est = c / np.maximum(wt, 1e-9)[..., None]
    if (wt == 0).any():
        est[wt == 0] = (c.sum(axis=(0, 1)) / max(wt.sum(), 1e-9))
    for c, wt in reversed(levels):
        up = np.repeat(np.repeat(est, 2, axis=0), 2, axis=1)
        up = np.pad(up, ((0, c.shape[0] - up.shape[0]), (0, c.shape[1] - up.shape[1]), (0, 0)), mode="edge")
        # Soften the block edges of the coarse level.
        up = (up + np.roll(up, 1, 0) + np.roll(up, -1, 0) + np.roll(up, 1, 1) + np.roll(up, -1, 1)) / 5
        own = c / np.maximum(wt, 1e-9)[..., None]
        a = np.clip(wt, 0, 1)[..., None]
        est = own * a + up * (1 - a)
    return est


# ---------------------------------------------------------------- load

glb = Glb(SRC)
J = glb.json
# The input must be the build script's GLB: this script's own output has
# several primitives per shell and its shadow baked in, which it cannot undo.
if len(J["meshes"][glb.node("HairShell0")["mesh"]]["primitives"]) > 1:
    sys.exit(f"{SRC} is already refined: run this on the build script's driver.glb")
human = glb.mesh("Human")
P = human["POSITION"].astype(np.float64)
NRM = human["NORMAL"].astype(np.float64)
UV = human["TEXCOORD_0"].astype(np.float64)
FACES = human["indices"]
NV = len(P)
joint_names = [J["nodes"][j]["name"] for j in J["skins"][0]["joints"]]
head_w = (human["WEIGHTS_0"] * (human["JOINTS_0"] == joint_names.index("head"))).sum(axis=1)
WELD = weld(P)

skin_srgb = decode_image(glb.image("skin")[1])[..., :3].astype(np.float64)
# The first layer of the input's shells (within 3 mm of the skin): the skin
# under it carries the old shadow that has to go.
OLD_SHELL = glb.mesh("HairShell0")["POSITION"].astype(np.float64)
assert skin_srgb.shape[0] == SKIN_SIZE

# ---------------------------------------------------------------- landmarks
# glTF axes: +y up, the face looks along +z, the man's left is +x.

edges = np.concatenate([FACES[:, [0, 1]], FACES[:, [1, 2]], FACES[:, [2, 0]]])
edges = np.unique(np.sort(WELD[edges], axis=1), axis=0)
edge_len = np.linalg.norm(P[edges[:, 0]] - P[edges[:, 1]], axis=1)
on_head = np.zeros(NV, bool)
np.logical_or.at(on_head, WELD, head_w > 0.3)
on_head = on_head[WELD]  # every split copy of a head vertex


def flood(seed, max_edge):
    """Welded vertices reachable from `seed` over edges shorter than max_edge."""
    short = edges[edge_len < max_edge]
    adj = {}
    for a, b in short:
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    seen, stack = {seed}, [seed]
    while stack:
        for b in adj.get(stack.pop(), ()):
            if b not in seen and on_head[b]:
                seen.add(b)
                stack.append(b)
    return np.array(sorted(seen))


# The auricle is a dense patch of short edges (< 4.5 mm) round the most
# lateral point of the head (the rim of the helix); the scalp and the cheek
# around it have 8-13 mm edges. The search band is the middle of the head's
# bounding box (the face's many small faces would pull a median forward).
ear_sets = {}
head_lo, head_hi = P[on_head].min(axis=0), P[on_head].max(axis=0)
head_mid = (head_lo + head_hi) / 2
for side in (1, -1):
    band = on_head & (WELD == np.arange(NV))
    band &= (np.abs(P[:, 1] - head_mid[1]) < 0.04) & (np.abs(P[:, 2] - head_mid[2]) < 0.05)
    seed = np.where(band)[0][np.argmax(P[band, 0] * side)]
    ear_sets[side] = flood(seed, 0.0045)
    assert len(ear_sets[side]) > 100, f"ear not found on side {side}"
ear_pts = {s: P[v] for s, v in ear_sets.items()}
O = (ear_pts[1].mean(axis=0) + ear_pts[-1].mean(axis=0)) / 2
ear_top = max(ear_pts[1][:, 1].max(), ear_pts[-1][:, 1].max())
ear_bottom = min(ear_pts[1][:, 1].min(), ear_pts[-1][:, 1].min())
is_ear = np.isin(WELD, np.concatenate(list(ear_sets.values())))

eye_mesh = glb.mesh("Human.high-poly")["POSITION"].astype(np.float64)
eye_l = eye_mesh[eye_mesh[:, 0] > 0].mean(axis=0)
eye_r = eye_mesh[eye_mesh[:, 0] < 0].mean(axis=0)
eye_c = (eye_l + eye_r) / 2

x, y, z = P[:, 0], P[:, 1], P[:, 2]
theta = np.degrees(np.arctan2(np.abs(x - O[0]), z - O[2]))
h = y - O[1]
h_ear_top = ear_top - O[1]
h_ear_bottom = ear_bottom - O[1]
h_eye = eye_c[1] - O[1]

# Outer skin: the mesh's UV islands (index connectivity) without the ones
# shut inside the head (mouth cavity, teeth, eye helpers): an island other
# than the head's own whose bounding box lies inside the head island's.
parent = np.arange(NV)


def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]
        a = parent[a]
    return a


for f in FACES:
    ra, rb, rc = find(f[0]), find(f[1]), find(f[2])
    parent[rb] = ra
    parent[find(rc)] = ra
island_of = np.array([find(i) for i in range(NV)])
head_island = np.bincount(island_of, weights=head_w).argmax()
hi_lo, hi_hi = P[island_of == head_island].min(axis=0), P[island_of == head_island].max(axis=0)
outer = np.ones(NV, bool)
for r in np.unique(island_of):
    m = island_of == r
    if r != head_island and (P[m].min(axis=0) > hi_lo).all() and (P[m].max(axis=0) < hi_hi).all():
        outer[m] = False
log("ISLANDS", len(np.unique(island_of)), "inner vertices", int((~outer).sum()))

# Midline profile, front of the face, top to bottom.
mid = outer & (np.abs(x) < 0.0015) & (z > O[2] + 0.04) & (NRM[:, 2] > -0.3)
mid_i = np.where(mid)[0]
mid_i = mid_i[np.argsort(-y[mid_i])]
band = mid_i[(h[mid_i] < h_eye) & (h[mid_i] > h_ear_bottom - 0.03)]
nose_tip = P[band[np.argmax(z[band])]]
# Subnasale: the lowest point of the nose's underside (normal facing down),
# within 2.5 cm under the tip.
under_nose = mid_i[(y[mid_i] < nose_tip[1]) & (y[mid_i] > nose_tip[1] - 0.025) & (NRM[mid_i, 1] < -0.5)]
subnasale = P[under_nose[np.argmin(y[under_nose])]]

# Lips: the reddest skin round the mouth (lip red in the skin texture).
tex_rows = np.clip((UV[:, 1] * SKIN_SIZE).astype(int), 0, SKIN_SIZE - 1)
tex_cols = np.clip((UV[:, 0] * SKIN_SIZE).astype(int), 0, SKIN_SIZE - 1)
vert_rgb = skin_srgb[tex_rows, tex_cols]
redness = (vert_rgb[:, 0] - vert_rgb[:, 1]) / np.maximum(vert_rgb[:, 0], 1e-3)
mouth_box = on_head & outer & (y < subnasale[1] - 0.004) & (y > subnasale[1] - 0.045) & (z > O[2] + 0.06) & (np.abs(x) < 0.045)
lips = mouth_box & (redness > 0.40)
mid_lips = lips & (np.abs(x) < 0.0015)
lip_top = y[mid_lips].max()
# The lips meet where the midline red is deepest.
mouth_y = y[mid_lips][np.argmax(redness[mid_lips])]
# Mouth corners: the ends of the mouth opening, where the outer skin shares
# its vertices with the mouth cavity.
inner_at = np.zeros(NV, bool)
np.logical_or.at(inner_at, WELD, ~outer)
opening = np.where(outer & inner_at[WELD] & mouth_box)[0]
mouth_corner = P[opening[np.argmax(np.abs(x[opening]))]]
mouth_half = np.abs(x[opening]).max()

# The mentolabial sulcus is the deepest midline point under the lower lip;
# the chin's front is the most prominent one under that.
below = mid_i[(y[mid_i] < mouth_y - 0.008) & (y[mid_i] > mouth_y - 0.03)]
sulcus = P[below[np.argmin(z[below])]]
lip_bottom = (mouth_y + sulcus[1]) / 2
chin_band = mid_i[(y[mid_i] < sulcus[1]) & (y[mid_i] > sulcus[1] - 0.03)]
chin_front = P[chin_band[np.argmax(z[chin_band])]]
# Under the chin the midline faces down; the throat starts where it faces
# forward again (the cervical point).
throat = outer & (np.abs(x) < 0.0015) & (z > O[2]) & (y < chin_front[1] - 0.01) & (NRM[:, 1] > -0.5) & (NRM[:, 2] > 0.3)
throat_i = np.where(throat)[0]
cervical = P[throat_i[np.argmax(y[throat_i])]]

h_sub = subnasale[1] - O[1]
h_mouth = mouth_y - O[1]
h_corner = mouth_corner[1] - O[1]
h_lip_top = lip_top - O[1]
h_lip_bottom = lip_bottom - O[1]
h_chin = chin_front[1] - O[1]

log("LANDMARKS head frame origin", O.round(4), "ear top/bottom", round(h_ear_top, 4), round(h_ear_bottom, 4),
    "ear verts", len(ear_sets[1]), len(ear_sets[-1]))
log("LANDMARKS eye", round(h_eye, 4), "nose tip", nose_tip.round(4), "subnasale", subnasale.round(4),
    "lips", round(lip_top, 4), round(mouth_y, 4), round(lip_bottom, 4), "corner", mouth_corner.round(4),
    "sulcus", sulcus.round(4),
    "chin", chin_front.round(4), "cervical", cervical.round(4))


neck_w = (human["WEIGHTS_0"] * (human["JOINTS_0"] == joint_names.index("neck_01"))).sum(axis=1)
h_sulcus = sulcus[1] - O[1]

# ---------------------------------------------------------------- grooming fields
#
# Every field is a function of a point on the skin, evaluated at the mesh
# vertices (shell geometry) and at every texel (alpha, colour, skin shadow),
# so the edges are smooth curves, not the zigzag of the 1 cm head mesh.
# Lengths in metres, densities and grey shares 0..1.


def curve(points, t):
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def frame(p):
    """Head frame: theta around the vertical axis through the ear centres
    (0 ahead, 90 at the ears, 180 behind) and height above them."""
    return np.degrees(np.arctan2(np.abs(p[:, 0] - O[0]), p[:, 2] - O[2])), p[:, 1] - O[1]


# Front hairline: where the build script put it (a little over 7 cm above
# the eye line), straight, with squared temple corners.
H_FRONT = h_eye + 0.071
HAIRLINE = [(0, H_FRONT), (22, H_FRONT), (32, H_FRONT - 0.005), (40, H_FRONT - 0.012), (46, H_FRONT - 0.02), (54, H_FRONT - 0.06), (62, -1.0), (180, -1.0)]
# Soft skin fade. Below FADE_BOTTOM the skin is bare (a faint shadow fades
# out over the last 6 mm); from there the shadow, the strands and their
# length come in gradually to the full crop at FADE_TOP. On the sides the
# bare skin reaches a few millimetres above the ears and the hair is full
# 4.8 cm above them; at the back the line follows the crown down and the
# fade runs down the nape. In front of the temples the curves sit under the
# hairline, so the hairline rules there.
FADE_BOTTOM = [(0, H_FRONT - 0.04), (35, H_FRONT - 0.035), (45, H_FRONT - 0.026), (52, h_ear_top + 0.016),
               (60, h_ear_top + 0.004), (110, h_ear_top + 0.002), (135, h_ear_top - 0.004), (180, h_ear_top - 0.008)]
FADE_TOP = [(0, H_FRONT - 0.01), (35, H_FRONT - 0.008), (45, H_FRONT - 0.002), (55, h_ear_top + 0.048),
            (110, h_ear_top + 0.046), (135, h_ear_top + 0.042), (180, h_ear_top + 0.04)]
HAIR_TOP_LEN = 0.004   # a short crop on the crown
HAIR_FRONT_LEN = 0.001  # extra at the front
HAIR_COVER = 0.72  # share of the head's texels that grow a strand: the scalp shows through a crop

# Beard. Cheek line: right up to the base of the nose (the moustache fills
# the whole upper lip, the philtrum included), out along the nostril wings,
# down a little over the cheek, then rising along the jaw to the sideburn.
# The mouth corners sit at theta ~16, the nostril wings at ~5-8.
CHEEK = [(0, h_sub + 0.0012), (4, h_sub + 0.001), (9, h_sub + 0.0008), (13, h_sub - 0.0005), (17, h_sub - 0.002),
         (21, h_sub - 0.004), (25, h_sub - 0.008), (33, h_sub - 0.010),
         (42, h_sub - 0.008), (50, h_sub - 0.003), (57, h_sub + 0.005), (63, h_sub + 0.015), (68, h_sub + 0.028),
         (73, h_sub + 0.056), (80, h_sub + 0.07)]
# Neckline: a plane across the neck through a point just above the throat's
# angle (the cervical point) and points under the ears, behind the angle of
# the jaw; the beard grows on the chin's side of it. From the side it is a
# line from under the ear lobe to the throat, from below a U under the jaw.
NECK_FRONT = cervical + np.array([0.0, 0.004, 0.006])
NECK_SIDE = np.array([0.0, O[1] + h_ear_bottom - 0.028, O[2] - 0.006])
_along = NECK_SIDE - NECK_FRONT
NECK_N = np.array([0.0, -_along[2], _along[1]]) / np.hypot(_along[1], _along[2])
if NECK_N[1] < 0:
    NECK_N = -NECK_N
# The crown, where the crop grows out from: the top of the head, a
# little behind the ears.
CROWN = np.array([O[0], P[on_head, 1].max(), O[2] - 0.035])


def groom(p, clear, rim):
    """Grooming at skin points p (n, 3).

    clear: 0..1, where hair may grow (0 on the lips, ears, eyes, nostrils);
    rim: 0..1, the top of the upper lip that the moustache hangs over.
    """
    theta, h = frame(p)
    z = p[:, 2]
    # A little low-frequency wobble so no edge is a ruled line.
    wob = (fbm(p, (90, 90, 90), 31, 2) - 0.5) * 0.004

    # -- head hair
    hairline = curve(HAIRLINE, theta) + wob
    fb = curve(FADE_BOTTOM, theta) + 0.6 * wob
    ft = curve(FADE_TOP, theta) + 0.6 * wob
    t = np.clip((h - fb) / (ft - fb), 0, 1)
    front_in = smooth(hairline - 0.002, hairline + 0.006, h)
    ramp = t * t * (3 - 2 * t)
    hair_dens = front_in * ramp
    front = smooth(O[2] - 0.01, O[2] + 0.09, z)
    hair_len = (HAIR_TOP_LEN + HAIR_FRONT_LEN * front) * (0.3 + 0.7 * front_in) * (0.04 + 0.96 * t ** 1.4)
    # Skin shadow under the hair: dark roots, and at the bottom of the fade a
    # grey cast that fades out to bare skin.
    hair_stub = 0.85 * np.minimum(smooth(hairline - 0.004, hairline + 0.004, h), smooth(fb - 0.006, fb + 0.85 * (ft - fb), h) ** 0.8)
    # Salt and pepper: some grey all over, more at the front and the temples.
    front_zone = smooth(hairline + 0.045, hairline + 0.008, h) * (1 - smooth(40, 55, theta))
    temple = smooth(32, 45, theta) * (1 - smooth(75, 95, theta))
    hair_grey = 0.02 + 0.2 * front_zone + 0.1 * temple

    # -- beard
    # The moustache: the upper lip between the mouth corners, from the lip
    # line up to the nose.
    moustache = (1 - smooth(15, 21, theta)) * smooth(h_lip_top - 0.003, h_lip_top + 0.001, h)
    moustache *= 1 - smooth(h_sub + 0.002, h_sub + 0.006, h)
    cheek = curve(CHEEK, theta) + wob * (1 - moustache)
    # A crisp top edge under the nose (1.5 mm), a soft cheek line (1.1 cm).
    soft = mix(0.010, 0.0015, moustache)
    under_cheek = 1 - smooth(cheek - soft, cheek + 0.001, h)
    # Slightly thinner right under the nostrils, not on the philtrum.
    under_cheek *= 1 - 0.3 * smooth(2.0, 4.0, theta) * (1 - smooth(9, 12, theta)) * smooth(h_sub - 0.004, h_sub - 0.001, h)
    neck_d = (p - NECK_FRONT) @ NECK_N
    above_neck = smooth(-0.003, 0.004, neck_d)
    # Back edge: in front of the ear down to the lobe, then back under it to
    # the angle of the jaw.
    back_edge = mix(91.0, 74.0, smooth(h_ear_bottom - 0.006, h_ear_bottom + 0.006, h))
    in_front = 1 - smooth(back_edge - 6, back_edge, theta)
    # Beard fade at the sideburn: full below the ear lobe, the hair gone at
    # the middle of the ear, its shadow fading out at the top of the ear,
    # where the haircut's fade starts.
    sideburn = smooth(54, 66, theta)
    sb = 1 - smooth(h_ear_bottom + 0.012, h_ear_top + 0.004, h)
    beard_cover = under_cheek * above_neck * in_front
    beard_dens = beard_cover * mix(1.0, sb, sideburn)
    # A little thinner high on the cheeks and in the middle under the lower
    # lip (the soul patch shows some skin), full everywhere else.
    beard_dens *= 0.8 + 0.2 * smooth(0.0, 0.02, cheek - h)
    soul = (1 - smooth(4, 9, theta)) * smooth(h_lip_bottom + 0.001, h_lip_bottom - 0.003, h) * smooth(h_sulcus - 0.006, h_sulcus, h)
    beard_dens *= 1 - 0.25 * soul

    # Lengths: short on the cheeks, fuller down the jaw, longest on the chin.
    depth = np.clip((cheek - h) / 0.035, 0, 1)
    beard_len = mix(0.0025, 0.0048, depth ** 0.8)
    chin = (1 - smooth(22, 38, theta)) * smooth(h_lip_bottom + 0.002, h_lip_bottom - 0.006, h)
    chin_len = 0.005 + 0.007 * smooth(h_sulcus + 0.002, h_chin - 0.006, h)
    beard_len = np.maximum(beard_len, chin * chin_len)
    # Moustache: full, its strands hang over the upper lip (see the comb in
    # the shells), joined to the beard round the mouth corners; shorter
    # right under the nose.
    moustache_len = mix(0.004, 0.0056, smooth(h_sub - 0.002, h_lip_top + 0.004, h))
    beard_len = np.maximum(beard_len, moustache * moustache_len)
    beard_len *= 0.55 + 0.45 * smooth(0.0, 0.015, neck_d)  # tapered at the neckline
    beard_len *= mix(1.0, sb ** 1.2, sideburn)  # and up the sideburn fade
    # Grey: a little all over, a clear share at the bottom of the chin and
    # some along the underside of the jaw.
    jaw_under = smooth(0.012, 0.0, neck_d) * (1 - smooth(60, 75, theta))
    beard_grey = 0.008 + 0.26 * chin * smooth(h_sulcus - 0.002, h_chin - 0.014, h) + 0.08 * jaw_under
    # Shadow under the beard, a little past its edges.
    halo = (1 - smooth(cheek - 0.001, cheek + 0.005, h)) * smooth(-0.007, 0.0, neck_d) * (1 - smooth(back_edge - 2, back_edge + 3, theta))
    beard_stub = np.maximum(0.95 * beard_cover, 0.3 * halo) * mix(1.0, sb ** 0.8, sideburn)

    # Strands also root on the top rim of the upper lip's red, so the
    # moustache stays full where it hangs over the lip.
    beard_dens = np.maximum(beard_dens * clear, rim)
    beard_len = np.maximum(beard_len * clear, 0.004 * rim)
    beard_stub = np.maximum(beard_stub * clear, 0.9 * rim)
    hair_dens, hair_len, hair_stub = hair_dens * clear, hair_len * clear, hair_stub * clear

    kind = beard_dens / np.maximum(beard_dens + hair_dens, 1e-6)

    # Comb: the direction the strands lean toward along the skin, and how far
    # they lean from the normal (radians). The crop grows out from the
    # crown and lies close to the head, a little more so on the sides.
    # The beard hangs down, a little forward on the chin; the moustache falls
    # down and out over the upper lip.
    side = 1 - smooth(h_ear_top + 0.045, h_ear_top + 0.075, h)
    hair_comb = p - CROWN
    hair_tilt = mix(1.0, 1.15, side)
    beard_comb = np.stack([np.sign(p[:, 0] - O[0]) * 0.4 * moustache, -np.ones(len(p)), 0.25 * chin], axis=1)
    beard_tilt = mix(0.95, 0.8, chin)
    beard_tilt = mix(beard_tilt, 1.0, moustache)
    return {
        "dens": np.maximum(hair_dens, beard_dens),
        "len": mix(hair_len, beard_len, kind),
        "kind": kind,
        "grey": mix(hair_grey, beard_grey, kind),
        "comb": mix(unit(hair_comb), unit(beard_comb), kind[:, None]),
        "tilt": mix(hair_tilt, beard_tilt, kind),
        "stub": np.maximum(hair_stub, beard_stub),
        "stub_kind": beard_stub / np.maximum(beard_stub + hair_stub, 1e-6),
    }


# Where hair may grow, per vertex (interpolated per texel): not on the lips
# (but over their top rim), the ears, the eyes or into the nostrils.
lip_rim = lips & (y > mouth_y + 0.62 * (lip_top - mouth_y)) & (np.abs(x) < mouth_half - 0.006)
nostrils = (h > h_sub + 0.002) & (theta < 22) & (h < h_eye)
blocked = (lips & ~lip_rim) | is_ear | nostrils | ~outer
blocked |= np.linalg.norm(P - eye_l, axis=1) < 0.03
blocked |= np.linalg.norm(P - eye_r, axis=1) < 0.03
# Equal on the split copies of a vertex, so the fields close at UV seams.
CLEAR = np.ones(NV)
np.minimum.at(CLEAR, WELD, (~blocked).astype(float))
CLEAR = CLEAR[WELD]
RIM = np.zeros(NV)
np.maximum.at(RIM, WELD, lip_rim.astype(float))
RIM = RIM[WELD]

G = groom(P, CLEAR, RIM)
log("FIELDS hair verts", int(((G["dens"] > 0.05) & (G["kind"] < 0.5)).sum()), "beard verts",
    int(((G["dens"] > 0.05) & (G["kind"] >= 0.5)).sum()), "max len mm", round(1000 * G["len"].max(), 1))
log("NECKLINE through", NECK_FRONT.round(4), NECK_SIDE.round(4))

# ---------------------------------------------------------------- shells


def spread(mask):
    """Marks the split copies of every marked vertex."""
    out = np.zeros(NV, bool)
    np.logical_or.at(out, WELD, mask)
    return out[WELD]


# Faces with hair: any vertex, edge midpoint or centre with density > 0.02
# (the per-texel fields can reach inside a face whose corners are bare).
samples = [P[FACES[:, k]] for k in range(3)]
samples += [(P[FACES[:, a]] + P[FACES[:, b]]) / 2 for a, b in ((0, 1), (1, 2), (2, 0))]
samples.append(P[FACES].mean(axis=1))
f_clear = CLEAR[FACES].max(axis=1)
f_rim = RIM[FACES].max(axis=1)
hairy = np.zeros(len(FACES), bool)
for s in samples:
    hairy |= groom(s, f_clear, f_rim)["dens"] > 0.02
on_skin = outer[FACES].all(axis=1) & ((head_w + neck_w)[FACES].min(axis=1) > 0.3)
hairy &= on_skin
# One ring of margin, so every shell ends at zero density.
ring = spread(np.isin(np.arange(NV), FACES[hairy].ravel()))
shell_faces_h = FACES[ring[FACES].any(axis=1) & on_skin]
shell_verts = np.unique(shell_faces_h)
local = np.full(NV, -1)
local[shell_verts] = np.arange(len(shell_verts))
shell_faces = local[shell_faces_h]

# UV islands (vertices are split at seams, so index connectivity is the
# island), packed into one square at one texel density.
parent = np.arange(len(shell_verts))
for a, b, c in shell_faces:
    for u, v in ((a, b), (b, c)):
        ru, rv = find(u), find(v)
        if ru != rv:
            parent[max(ru, rv)] = min(ru, rv)
island = np.array([find(i) for i in range(len(shell_verts))])
suv = UV[shell_verts]
islands = []
for r in np.unique(island):
    m = island == r
    lo, hi = suv[m].min(axis=0), suv[m].max(axis=0)
    islands.append((r, lo, hi - lo))
islands.sort(key=lambda t: (-t[2][1], t[0]))
PAD = 6 / HAIR_SIZE


def pack(scale):
    """Shelf packing; returns offsets or None when it does not fit."""
    offsets, cx, cy, shelf = {}, PAD, PAD, 0.0
    for r, lo, size in islands:
        w, hgt = size * scale
        if cx + w + PAD > 1:
            cx, cy, shelf = PAD, cy + shelf + PAD, 0.0
        if cy + hgt + PAD > 1 or cx + w + PAD > 1:
            return None
        offsets[r] = np.array([cx, cy]) - lo * scale
        cx += w + PAD
        shelf = max(shelf, hgt)
    return offsets


lo_s, hi_s = 0.1, 10.0
for _ in range(40):
    mid_s = (lo_s + hi_s) / 2
    lo_s, hi_s = (mid_s, hi_s) if pack(mid_s) else (lo_s, mid_s)
uv_scale = lo_s
offsets = pack(uv_scale)
shell_uv = np.array([suv[i] * uv_scale + offsets[island[i]] for i in range(len(shell_verts))])

S_P, S_N = P[shell_verts], NRM[shell_verts]
S_WELD = weld(S_P)
area_3d = np.linalg.norm(np.cross(S_P[shell_faces[:, 1]] - S_P[shell_faces[:, 0]], S_P[shell_faces[:, 2]] - S_P[shell_faces[:, 0]]), axis=1).sum() / 2
e1, e2 = shell_uv[shell_faces[:, 1]] - shell_uv[shell_faces[:, 0]], shell_uv[shell_faces[:, 2]] - shell_uv[shell_faces[:, 0]]
area_uv = np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]).sum() / 2
log("SHELLS verts", len(shell_verts), "faces", len(shell_faces), "islands", len(islands),
    "texels per mm", round(HAIR_SIZE * np.sqrt(area_uv / area_3d) / 1000, 2))

# The shells' own length and comb: those of the hair rooted here, also where
# nothing grows (the upper lip's red under the moustache, the ring of
# margin), so the layers run on smoothly past the last strands and the
# moustache can hang over the lip. Where the hair is, the texture decides.
GS = groom(S_P, np.ones(len(S_P)), np.zeros(len(S_P)))
S_LEN = GS["len"]


def smooth_on_shell(values, steps):
    """Averages per-vertex values with their neighbours on the welded shell."""
    edges_s = np.concatenate([shell_faces[:, [0, 1]], shell_faces[:, [1, 2]], shell_faces[:, [2, 0]]])
    a, b = S_WELD[edges_s[:, 0]], S_WELD[edges_s[:, 1]]
    out = values.copy()
    for _ in range(steps):
        acc = out.copy()
        cnt = np.ones(len(out))
        np.add.at(acc, a, out[b])
        np.add.at(acc, b, out[a])
        np.add.at(cnt, a, 1)
        np.add.at(cnt, b, 1)
        out = (acc / (cnt[:, None] if out.ndim > 1 else cnt))[S_WELD]
    return out


# Each strand is straight: from its root it leans `tilt` from the normal
# toward the comb. Where the comb runs along the normal (under the chin) it
# leans less, and the field is smoothed so the layers never shear.
lean = GS["comb"] - (GS["comb"] * S_N).sum(axis=1, keepdims=True) * S_N
lean = smooth_on_shell(lean, 4)
lean -= (lean * S_N).sum(axis=1, keepdims=True) * S_N
tilt = smooth_on_shell(GS["tilt"], 2) * smooth(0.05, 0.3, np.linalg.norm(lean, axis=1))
S_DIR = np.cos(tilt)[:, None] * S_N + np.sin(tilt)[:, None] * unit(lean)

# Layers: LAYERS_PER_SHELL primitives per HairShell mesh, one material per
# mesh. A layer at the fraction f of the strand length shows the texels
# whose strand reaches f (the texture's alpha is the strand height): its
# vertex colour's alpha is cut-off / f, which the material multiplies into
# the texture's alpha before the alpha test. The vertex colour's RGB darkens
# the inner layers (the strands shade each other toward the roots).
ARRAY, ELEMENT = 34962, 34963
acc_uv = glb.add_accessor(shell_uv, 5126, "VEC2", ARRAY)
acc_normal = glb.add_accessor(S_N, 5126, "VEC3", ARRAY)
joints_type = J["accessors"][glb.primitive("Human")["attributes"]["JOINTS_0"]]["componentType"]
acc_joints = glb.add_accessor(human["JOINTS_0"][shell_verts], joints_type, "VEC4", ARRAY)
acc_weights = glb.add_accessor(human["WEIGHTS_0"][shell_verts], 5126, "VEC4", ARRAY)
acc_index = glb.add_accessor(shell_faces.ravel(), 5123 if len(shell_verts) < 65536 else 5125, "SCALAR", ELEMENT)
for i in range(3):
    node = glb.node(f"HairShell{i}")
    template = {k: v for k, v in glb.primitive(f"HairShell{i}").items() if k not in ("attributes", "indices")}
    material = J["materials"][template["material"]]
    layer_f = LAYER_F[i * LAYERS_PER_SHELL : (i + 1) * LAYERS_PER_SHELL]
    cutoff = float(layer_f[0])
    material["alphaCutoff"] = cutoff
    material["pbrMetallicRoughness"]["roughnessFactor"] = HAIR_ROUGHNESS
    material.setdefault("extensions", {})["KHR_materials_specular"] = {"specularFactor": HAIR_SPECULAR}
    prims = []
    for k, f in enumerate(layer_f):
        n = i * LAYERS_PER_SHELL + k
        pts = S_P + S_N * (0.0004 + 0.00008 * n) + S_DIR * (f * S_LEN)[:, None]
        shade = 0.55 + 0.45 * f**0.6
        rgba = np.tile([shade, shade, shade, cutoff / f], (len(pts), 1))
        color = glb.add_accessor(np.round(rgba * 255), 5121, "VEC4", ARRAY)
        J["accessors"][color]["normalized"] = True
        prims.append(dict(template, attributes={
            "POSITION": glb.add_accessor(pts, 5126, "VEC3", ARRAY, minmax=True),
            "NORMAL": acc_normal,
            "TEXCOORD_0": acc_uv,
            "COLOR_0": color,
            "JOINTS_0": acc_joints,
            "WEIGHTS_0": acc_weights,
        }, indices=acc_index))
    J["meshes"][node["mesh"]]["primitives"] = prims
log("LAYERS at", np.round(LAYER_F, 3).tolist(), "max lean deg", round(float(np.degrees(tilt.max())), 1),
    "max thickness mm", round(1000 * float(((S_DIR * S_N).sum(axis=1) * S_LEN).max()), 1))

# ---------------------------------------------------------------- hair texture

rows, cols, fids, bary = rasterize(shell_uv, shell_faces, HAIR_SIZE)
tri = shell_faces[fids]
tp = (bary[..., None] * S_P[tri]).sum(axis=1)  # each texel's point on the skin
T = groom(tp, (bary * CLEAR[shell_verts][tri]).sum(axis=1), (bary * RIM[shell_verts][tri]).sum(axis=1))

# One strand per texel (about 0.5 mm): whether it grows, how far it reaches
# and its colour come from hashes of the texel, so the strands are as fine as
# the texture allows and every layer draws the same strands.
zero = np.zeros_like(rows)
r_grow, r_len, r_grey, r_tone, r_warm = (hash01(rows, cols, zero, seed) for seed in (41, 42, 43, 44, 45))
# The beard thins out over its edges with fewer strands than the density
# (single strands at the cheek line); the fade keeps its own ramp.
grows = r_grow < T["dens"] ** mix(1.0, 1.5, T["kind"]) * mix(HAIR_COVER, 1.0, T["kind"])
# Strand height as a fraction of the local length. The crop is even
# (clipper cut): most strands reach 60-100%. The beard is uneven: about
# 95% of its strands reach half way, 55% reach 70% and 10% the full
# length, so the inner layers hide the skin and the tips break up into
# single strands; a slow wave keeps its surface from looking moulded.
wave = fbm(tp, (180, 180, 180), 47, 2)
h_hair = 1 - 0.45 * r_len**1.3
h_beard = (1 - 0.75 * r_len**1.6) * (0.88 + 0.12 * wave)
height = mix(h_hair, h_beard, T["kind"])
# The layers only compare the height with their own fractions, so it is
# stored at the middle of its layer bin: 13 levels compress far better than
# 256 and stay clear of the 8-bit vertex alpha's rounding.
step = LAYER_F[1] - LAYER_F[0]
height = np.where(height >= LAYER_F[0], np.minimum(LAYER_F[0] + (np.floor((height - LAYER_F[0]) / step) + 0.5) * step, 1.0), 0.0)
alpha = np.where(grows, height, 0.0)

# Colour per strand: near black with some spread in tone, a few warmer
# brown strands, and the grey ones (salt and pepper) by the local share.
dark_hair = np.array([0.021, 0.0155, 0.0128])
dark_beard = np.array([0.0105, 0.0082, 0.0072])
dark = mix(dark_hair, dark_beard, T["kind"][:, None]) * (0.65 + 0.7 * r_tone[:, None])
dark = np.where((r_warm < 0.12)[:, None], dark * np.array([1.4, 1.05, 0.8]), dark)
is_grey = r_grey < T["grey"]
silver = mix(0.12, 0.45, r_tone)[:, None] * np.array([1.0, 0.985, 0.965])
silver *= mix(1.0, 0.85, T["kind"])[:, None]  # the beard's grey is a little duller
rgb = np.where(is_grey[:, None], silver, dark)

# Each texel's point in the skin texture, for the colour under the gaps.
texel_skin_uv = (bary[..., None] * UV[shell_verts][tri]).sum(axis=1)
dense = T["dens"] > 0.5
log("HAIR texels", len(rows), "grey share where dense: hair", round(float(is_grey[dense & (T["kind"] < 0.5)].mean()), 3),
    "beard", round(float(is_grey[dense & (T["kind"] >= 0.5)].mean()), 3))

# ---------------------------------------------------------------- skin texture
#
# The input's skin carries the old shadow under the old hair and beard
# (skin * (1 - f) + dark * f, baked by the build script). It comes off by
# inverting that mix against the clean skin around it, which keeps the
# skin's own detail; where the old shadow was too dark to invert, the clean
# skin is filled in. Then the new shadow goes on.

skin_lin = to_linear(skin_srgb)
s_rows, s_cols, s_fids, s_bary = rasterize(UV, FACES, SKIN_SIZE)
s_tri = FACES[s_fids]
covered_px = np.zeros((SKIN_SIZE, SKIN_SIZE), bool)
covered_px[s_rows, s_cols] = True
LUM = np.array([0.2126, 0.7152, 0.0722])
OLD_DARK = np.array([0.045, 0.035, 0.032])  # the build script's shadow colour


def nearest(points, ref):
    out = np.empty(len(points), int)
    for s in range(0, len(points), 512):
        d = ((points[s : s + 512, None, :] - ref[None]) ** 2).sum(axis=-1)
        out[s : s + 512] = d.argmin(axis=1)
    return out


def texel_mask(face_mask):
    m = np.zeros((SKIN_SIZE, SKIN_SIZE), bool)
    sel = face_mask[s_fids]
    m[s_rows[sel], s_cols[sel]] = True
    return m


def blur(img, weight, radius):
    """Box blur of img (h, w, c) normalised by weight (h, w)."""
    def box(a):
        for axis in (0, 1):
            c = np.cumsum(np.pad(a, [(radius + 1, radius) if k == axis else (0, 0) for k in range(a.ndim)]), axis=axis)
            hi = np.take(c, np.arange(2 * radius + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * radius - 1), axis=axis)
            a = hi - lo
        return a
    return box(img * weight[..., None]) / np.maximum(box(weight[..., None].astype(float)), 1e-9)


# The old shells' first layer sits within 3 mm of the skin: every vertex
# under it may carry old shadow.
uniq = np.unique(WELD)
old_cover = np.zeros(NV, bool)
old_cover[uniq[nearest(OLD_SHELL, P[uniq])]] = True
old_cover = spread(old_cover)
old_face = old_cover[FACES].any(axis=1)
features = is_ear | lips | nostrils | (np.linalg.norm(P - eye_l, axis=1) < 0.03) | (np.linalg.norm(P - eye_r, axis=1) < 0.03)
skin_face = outer[FACES].all(axis=1) & ((head_w + neck_w)[FACES].max(axis=1) > 0.3)
source_px = texel_mask(skin_face & ~old_face & ~spread(features)[FACES].any(axis=1))
work_px = texel_mask(skin_face & (old_face | spread(G["stub"] > 0.004)[FACES].any(axis=1)))
clean = push_pull(skin_lin, source_px.astype(float))

# Old shadow per texel, from the luminance against the clean skin.
lum, clean_lum = skin_lin @ LUM, clean @ LUM
dark_lum = OLD_DARK @ LUM
f_old = np.clip((clean_lum - lum) / np.maximum(clean_lum - dark_lum, 1e-4), 0, 0.98)
# The lips, ears and eyes are darker than the skin round them by nature:
# keep them (the lip rim had shadow, but the new moustache covers it).
keep_px = texel_mask(spread(features & ~lip_rim)[FACES].all(axis=1))
f_old[keep_px | ~texel_mask(skin_face & old_face)] = 0
f_soft = blur(f_old[..., None], work_px.astype(float), 3)[..., 0]
restored = (skin_lin - OLD_DARK * f_old[..., None]) / (1 - f_old[..., None])
pr, pc_ = s_rows[work_px[s_rows, s_cols]], s_cols[work_px[s_rows, s_cols]]
sel = work_px[s_rows, s_cols]
sp = (s_bary[sel][..., None] * P[s_tri[sel]]).sum(axis=1)
# Where the old shadow was too dark to invert, clean skin with some life:
# broad blotches and pores.
filled = clean[pr, pc_] * (1 + 0.05 * (fbm(sp, (180, 180, 180), 21, 2) - 0.5) + 0.05 * (value_noise(sp * 2600, 22) - 0.5))[:, None]
w_fill = smooth(0.45, 0.8, f_soft[pr, pc_])[:, None]
base = mix(restored[pr, pc_], filled, w_fill)

# New shadow: each texel darkens by a share of the local shadow (follicles).
S = groom(sp, (s_bary[sel] * CLEAR[s_tri[sel]]).sum(axis=1), (s_bary[sel] * RIM[s_tri[sel]]).sum(axis=1))
grain = uniform(value_noise(sp * 2300, 23))
f = np.clip(S["stub"] * (0.55 + 0.9 * grain), 0, 0.97)
# Beard roots are near black; the fade's stubble reads blue-grey.
shadow = mix(np.array([0.05, 0.05, 0.056]), np.array([0.03, 0.026, 0.025]), S["stub_kind"][:, None])
out_lin = skin_lin.copy()
out_lin[pr, pc_] = base * (1 - f[:, None]) + shadow * f[:, None]

# Texture padding round the rebuilt texels, like the original bake margin.
padded, _ = dilate(out_lin, covered_px.copy(), 8)
near = dilate(work_px[..., None].astype(float), work_px.copy(), 10)[1] & ~covered_px
out_lin[near] = padded[near]
glb.set_image("skin", encode_webp(to_srgb(out_lin), SKIN_WEBP_QUALITY))
log("SKIN rebuilt texels", len(pr), "clean sources", int(source_px.sum()), "filled share", round(float((w_fill > 0.5).mean()), 3))

# ---------------------------------------------------------------- hair texture, written
#
# Texels without a strand take the colour of the skin under them (after the
# new shadow). The alpha test never draws them, but mipmaps average them in:
# from afar, where the strands are too fine to see, a sparse edge then
# reads as skin with some hair on it instead of a hard black contour.

su = np.clip((texel_skin_uv * SKIN_SIZE).astype(int), 0, SKIN_SIZE - 1)
under = to_srgb(out_lin[su[:, 1], su[:, 0]])
hair_rgba = np.zeros((HAIR_SIZE, HAIR_SIZE, 4))
known = np.zeros((HAIR_SIZE, HAIR_SIZE), bool)
hair_rgba[rows, cols, :3] = np.where((alpha > 0)[:, None], to_srgb(rgb), under)
hair_rgba[rows, cols, 3] = alpha
known[rows, cols] = True
# Pad strands a few texels past the UV seams (so mipmaps keep the coverage
# there), then the colour further (so mipmaps never pull in an unrelated
# colour from the empty texels).
hair_rgba, known4 = dilate(hair_rgba, known, 4)
hair_rgb, known24 = dilate(hair_rgba[..., :3], known4, 20)
hair_rgb[~known24] = to_srgb(dark_hair)
glb.set_image("hair", encode_webp(np.dstack([hair_rgb, hair_rgba[..., 3]])))

# ---------------------------------------------------------------- save

glb.save(DST)
log("WROTE", DST, os.path.getsize(DST), "bytes")
