"""Builds the driver's sunglasses: classic gold aviators, fitted to his head.

An original, generic aviator made for this site, after the style the owner
picked (no brand, no logo, no borrowed mesh): a thin gold wire frame with a
double bridge (the brow bar over a lower bridge), teardrop lenses with a
slight spherical curvature, nose pads on short arms, and temples that run
back over the ears and bend down behind them. About 2.7k triangles.

Fitting. The script loads driver.glb and measures its bind pose: the eye
centres (the Eyes mesh), the lashes and brows, the nose bridge and the sides
of the nose, the tops of the ears and the sides of the head (the Skin mesh).
The lenses, the bridge and the temples are sized and placed from those
numbers, then every part is kept at least CLEARANCE off the skin, the eyes,
the lashes, the brows and the hair shells: the front moves forward as a
whole until it clears, the pads back off the nose, the temples are pushed
out point by point. A last pass measures every piece against every surface,
at rest and with the head turned as far as Driver.tsx turns it, and stops
the build if anything comes closer than CLEARANCE. Nothing is random: the
same driver.glb gives the same glasses.

Frame. The GLB is written in the frame of the rig's "head" bone, read from
the driver GLB's node hierarchy (+x the driver's left, +y up the bone, +z
out of the face), so Sunglasses.tsx adds the glasses as a child of that bone
and they follow the head. Two meshes with one material each, Frame and Lens.
Each lens has UVs across its own box, v from bottom (0) to top (1) in
Blender, which glTF stores as t from top (0) to bottom (1).

Usage (Blender 4.5, or `pip install bpy==4.5.4` in a Python 3.11 venv):
    blender -b -P build_sunglasses.py -- <driver.glb> <aviator.glb> [renders_dir]
    python build_sunglasses.py -- <driver.glb> <aviator.glb> [renders_dir]

With renders_dir (keep it outside the repository): small Cycles check
renders of the head wearing the glasses: front, three-quarter, profile and
a close look at the temple over the ear.
"""

import json
import math
import os
import struct
import sys

import bpy
import bmesh  # after bpy: as a Python module, bpy is what makes bmesh importable
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
DRIVER, OUT = os.path.abspath(argv[0]), os.path.abspath(argv[1])
RENDERS = os.path.abspath(argv[2]) if len(argv) > 2 else None

# Every part stays this far off the skin, eyes, lashes, brows and hair shells
# (surface to surface). The temples cross the hair at the sides of the head,
# where the hair shells may grow thicker, so they are pushed out aiming for
# TEMPLE_CLEARANCE; over the ear, between it and the hair, they settle nearer
# CLEARANCE (3.2-3.5 mm), and the final check holds them to CLEARANCE only.
CLEARANCE = 0.003
TEMPLE_CLEARANCE = 0.004

# Sizes in metres, relative to the measured head where they depend on it.
LENS = {
    "width_per_ipd": 0.95,  # lens box width over the distance between the eyes
    "aspect": 0.86,  # box height over width: a full, classic teardrop
    "outset": 0.0065,  # lens centre outboard of the pupil (frame PD > IPD)
    "drop": 0.006,  # lens centre below the pupil: the eye sits in the upper half
    "vertex": 0.010,  # lens front ahead of the lashes at the lens centre
    "radius": 0.09,  # front curvature (about a base 6 curve)
    "wrap": math.radians(6),  # face form: outer edges back
    "tilt": math.radians(7),  # pantoscopic tilt: bottom edges toward the cheeks
}
RIM = {"inplane": 0.0007, "depth": 0.0011, "sides": 6, "points": 40}
BAR = {"radius": 0.0008, "sides": 6}
TEMPLE = {"hinge": 0.0012, "wire": 0.0008, "tip": 0.0013, "sides": 6, "samples": 26}
# Pads rest on the steep sides of the nose, a centimetre below the eyes and
# clear of the inner corners and their lashes.
PAD = {"half_height": 0.0055, "half_width": 0.0036, "half_thickness": 0.0009, "x": 0.0085, "drop": 0.010}

# Aviator lens outline on its box: u from the nose (-0.5) to the temple
# (+0.5), v from the bottom (-0.5) to the top (+0.5). A long, nearly flat
# top; a round, full temple side; the bottom sweeps down to the lowest point
# just nasal of centre, and the nasal edge climbs steeply to the bridge.
OUTLINE = [
    (-0.44, 0.42), (-0.25, 0.49), (0.00, 0.50), (0.22, 0.48), (0.38, 0.42),
    (0.47, 0.30), (0.50, 0.12), (0.48, -0.08), (0.40, -0.26), (0.25, -0.41),
    (0.06, -0.50), (-0.12, -0.49), (-0.28, -0.40), (-0.39, -0.22), (-0.46, 0.00),
    (-0.49, 0.20), (-0.48, 0.34),
]


def log(*args):
    print("[sunglasses]", *args, flush=True)


# ---------------------------------------------------------------- head frame


def node_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=float).reshape(4, 4).T
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    rotation = np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )
    m = np.eye(4)
    m[:3, :3] = rotation @ np.diag(node.get("scale", [1, 1, 1]))
    m[:3, 3] = node.get("translation", [0, 0, 0])
    return m


def bone_rest_matrix(path, name):
    """World matrix of a node of a GLB at rest (the bind pose), in glTF space."""
    with open(path, "rb") as f:
        data = f.read()
    (json_length,) = struct.unpack_from("<I", data, 12)
    nodes = json.loads(data[20 : 20 + json_length])["nodes"]
    parent = {child: i for i, n in enumerate(nodes) for child in n.get("children", [])}
    index = next(i for i, n in enumerate(nodes) if n.get("name") == name)
    m = np.eye(4)
    while index is not None:
        m = node_matrix(nodes[index]) @ m
        index = parent.get(index)
    return m


HEAD = bone_rest_matrix(DRIVER, "head")
HEAD_INV = np.linalg.inv(HEAD)
# glTF is +Y up, Blender +Z up: the exporter maps Blender (x, y, z) to glTF
# (x, z, -y). Geometry is built in head coordinates and stored in Blender as
# (x, -z, y), so the export lands it back in head coordinates.
TO_GLTF = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], dtype=float)
TO_BLENDER = np.linalg.inv(TO_GLTF)


def to_blender(points):
    return np.stack([points[:, 0], -points[:, 2], points[:, 1]], axis=1)


# ---------------------------------------------------------------- the driver

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=DRIVER)
depsgraph = bpy.context.evaluated_depsgraph_get()


def head_weight(obj):
    """Share of each vertex that follows the head bone (the rest follows the neck)."""
    head = obj.vertex_groups.get("head")
    weights = np.zeros(len(obj.data.vertices))
    for v in obj.data.vertices:
        total = sum(g.weight for g in v.groups)
        if head is not None and total > 0:
            weights[v.index] = sum(g.weight for g in v.groups if g.group == head.index) / total
    return weights


def head_mesh(material):
    """Vertices (head frame), triangles and head weights of every skinned mesh
    with this material prefix."""
    verts, tris, weights = [], [], []
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not obj.data.materials or obj.data.materials[0] is None:
            continue
        if not obj.data.materials[0].name.startswith(material):
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        co = np.empty(len(mesh.vertices) * 3)
        mesh.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        world = np.array(obj.matrix_world)
        co = co @ world[:3, :3].T + world[:3, 3]
        gltf = np.c_[co, np.ones(len(co))] @ TO_GLTF.T
        local = (gltf @ HEAD_INV.T)[:, :3]
        mesh.calc_loop_triangles()
        t = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int64)
        mesh.loop_triangles.foreach_get("vertices", t)
        tris.append(t.reshape(-1, 3) + sum(len(v) for v in verts))
        verts.append(local)
        weights.append(head_weight(obj))
        evaluated.to_mesh_clear()
    return np.concatenate(verts), np.concatenate(tris), np.concatenate(weights)


def bvh(*parts):
    verts = np.concatenate([p[0] for p in parts])
    offsets = np.cumsum([0] + [len(p[0]) for p in parts[:-1]])
    tris = np.concatenate([p[1] + o for p, o in zip(parts, offsets)])
    return BVHTree.FromPolygons([tuple(v) for v in verts], [tuple(int(i) for i in t) for t in tris])


skin = head_mesh("Skin")
eyes = head_mesh("Eyes")
lashes = head_mesh("Lashes")
brows = head_mesh("Brows")
hair = head_mesh("HairShell")
SKIN = bvh(skin)
# Eyes, lashes, brows and hair shells. Lashes and brows are open cards, so
# only the skin (a closed, outward-facing surface) tells inside from outside.
EXTRAS = bvh(eyes, lashes, brows, hair)
HAIR = bvh(hair)


def clearance(points):
    """Distance of each point to the nearest skin, eye, lash, brow or hair surface.

    Unsigned: the skin is open at the eyes and the mouth, so the side of the
    nearest face does not tell inside from outside there. The front is built
    in front of the face, and the temples check the side of the head with
    `inside_side` instead.
    """
    return np.array([min(SKIN.find_nearest(Vector(p))[3], EXTRAS.find_nearest(Vector(p))[3]) for p in points])


def nearest(point):
    """Nearest point on the skin or the extras."""
    a, b = SKIN.find_nearest(Vector(point)), EXTRAS.find_nearest(Vector(point))
    return np.array((a if a[3] <= b[3] else b)[0])


def ray(origin, direction, tree=SKIN):
    """First hit of a ray, with the surface normal turned toward the ray's origin."""
    location, normal, _index, _distance = tree.ray_cast(Vector(origin), Vector(direction))
    if location is None:
        raise RuntimeError(f"no hit from {origin} toward {direction}")
    if normal.dot(Vector(direction)) > 0:
        normal = -normal
    return np.array(location), np.array(normal)


# ---------------------------------------------------------------- measurements

ev = eyes[0]
eye_l = (ev[ev[:, 0] > 0].min(0) + ev[ev[:, 0] > 0].max(0)) / 2
eye_r = (ev[ev[:, 0] < 0].min(0) + ev[ev[:, 0] < 0].max(0)) / 2
# The glasses are symmetric: average the two sides.
EYE = np.array([(eye_l[0] - eye_r[0]) / 2, (eye_l[1] + eye_r[1]) / 2, (eye_l[2] + eye_r[2]) / 2])
IPD = 2 * EYE[0]
LASH_FRONT = lashes[0][:, 2].max()
BRIDGE = ray((0, EYE[1], 0.3), (0, 0, -1))[0]  # the nose bridge at eye height


def side_of_head(y, z):
    """x of the skin at the side of the head (the driver's left), ears excluded:
    cast from the middle of the head outward, the first hit is the skull."""
    return ray((0.0, y, z), (1, 0, 0))[0][0]


def inside_side(point):
    """True when a point at the side of the head is inside the skull."""
    side = 1 if point[0] > 0 else -1
    return abs(point[0]) < abs(ray((0.0, point[1], point[2]), (side, 0, 0))[0][0])


# Ear top: the highest skin point under rays cast down just outside the
# skull (which is at most ~73 mm from the middle at ear height).
ear_top = max(
    (ray((x, 0.12, z), (0, -1, 0))[0] for x in np.arange(0.078, 0.09, 0.001) for z in np.arange(-0.02, 0.02, 0.001)),
    key=lambda p: p[1] if 0.0 < p[1] < 0.07 else -1,
)
log("eye", EYE.round(4), "ipd", round(IPD, 4), "lash front", round(LASH_FRONT, 4))
log("nose bridge", BRIDGE.round(4), "ear top", ear_top.round(4))


# ---------------------------------------------------------------- curves


def catmull_rom(points, samples, closed):
    """Centripetal Catmull-Rom through `points`, resampled evenly by arc length."""
    p = np.asarray(points, dtype=float)
    if closed:
        p = np.vstack([p[-1], p, p[0], p[1]])
    else:
        p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    dense = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        t0 = 0.0
        t1 = t0 + np.linalg.norm(p1 - p0) ** 0.5
        t2 = t1 + np.linalg.norm(p2 - p1) ** 0.5
        t3 = t2 + np.linalg.norm(p3 - p2) ** 0.5
        for t in np.linspace(t1, t2, 40, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            dense.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    dense.append(p[-2] if not closed else p[1])
    dense = np.array(dense)
    seg = np.linalg.norm(np.diff(dense, axis=0), axis=1)
    s = np.r_[0, np.cumsum(seg)]
    targets = np.linspace(0, s[-1], samples, endpoint=not closed)
    return np.stack([np.interp(targets, s, dense[:, k]) for k in range(dense.shape[1])], axis=1)


def normalize(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def rotation_minimizing_frames(path, up):
    """Normal vectors along an open path, twisting as little as possible (double reflection)."""
    tangents = normalize(np.gradient(path, axis=0))
    n = normalize(up - np.dot(up, tangents[0]) * tangents[0])
    normals = [n]
    for i in range(len(path) - 1):
        v1 = path[i + 1] - path[i]
        c1 = v1 @ v1
        r = normals[-1] - (2 / c1) * (v1 @ normals[-1]) * v1
        t = tangents[i] - (2 / c1) * (v1 @ tangents[i]) * v1
        v2 = tangents[i + 1] - t
        c2 = v2 @ v2
        normals.append(normalize(r - (2 / c2) * (v2 @ r) * v2) if c2 > 1e-16 else r)
    return tangents, np.array(normals)


class MeshData:
    """Vertices, triangles and optional UVs accumulated for one Blender mesh,
    piece by piece; each piece keeps a name for the clearance report."""

    def __init__(self):
        self.verts, self.tris, self.uvs, self.names = [], [], [], []

    def add(self, name, verts, tris, uvs=None):
        base = sum(len(v) for v in self.verts)
        self.names.append(name)
        self.verts.append(np.asarray(verts, dtype=float))
        self.tris.append(np.asarray(tris, dtype=np.int64) + base)
        self.uvs.append(np.zeros((len(verts), 2)) if uvs is None else np.asarray(uvs, dtype=float))

    def pieces(self, *names):
        """Vertices of the pieces with these names (all pieces when none is given)."""
        chosen = [v for n, v in zip(self.names, self.verts) if not names or n in names]
        return np.concatenate(chosen)

    def arrays(self):
        return np.concatenate(self.verts), np.concatenate(self.tris), np.concatenate(self.uvs)


def tube(path, radii, sides, closed=False, frames=None, caps=True):
    """A tube along `path`. radii: (n,) round or (n, 2) elliptical (along normal, binormal)."""
    n = len(path)
    radii = np.asarray(radii, dtype=float)
    if radii.ndim == 1:
        radii = np.stack([radii, radii], axis=1)
    if frames is None:
        tangents, normals = rotation_minimizing_frames(path, np.array([0.0, 1.0, 0.0]))
    else:
        tangents, normals = frames
    binormals = normalize(np.cross(tangents, normals))
    angles = np.linspace(0, 2 * math.pi, sides, endpoint=False) + math.pi / sides
    ring = np.stack([np.cos(angles), np.sin(angles)], axis=1)
    verts = (
        path[:, None, :]
        + ring[None, :, 0:1] * radii[:, None, 0:1] * normals[:, None, :]
        + ring[None, :, 1:2] * radii[:, None, 1:2] * binormals[:, None, :]
    ).reshape(-1, 3)
    tris = []
    rings = n if closed else n - 1
    for i in range(rings):
        j = (i + 1) % n
        for k in range(sides):
            k1 = (k + 1) % sides
            a, b, c, d = i * sides + k, i * sides + k1, j * sides + k1, j * sides + k
            tris += [(a, b, c), (a, c, d)]
    verts = list(verts)
    if caps and not closed:
        for end, ring_start, flip in ((0, 0, True), (n - 1, (n - 1) * sides, False)):
            centre = len(verts)
            verts.append(path[end])
            for k in range(sides):
                a, b = ring_start + k, ring_start + (k + 1) % sides
                tris.append((centre, b, a) if flip else (centre, a, b))
    return np.array(verts), np.array(tris)


def ellipsoid(centre, axes, radii, segments=10, rings=5):
    """A small ellipsoid: axes are three unit vectors, radii their half lengths."""
    verts, tris = [], []
    for i in range(1, rings):
        phi = math.pi * i / rings
        for k in range(segments):
            theta = 2 * math.pi * k / segments
            local = np.array([math.sin(phi) * math.cos(theta), math.sin(phi) * math.sin(theta), math.cos(phi)])
            verts.append(centre + sum(local[a] * radii[a] * axes[a] for a in range(3)))
    top, bottom = len(verts), len(verts) + 1
    verts += [centre + radii[2] * axes[2], centre - radii[2] * axes[2]]
    for i in range(rings - 2):
        for k in range(segments):
            k1 = (k + 1) % segments
            a, b = i * segments + k, i * segments + k1
            c, d = a + segments, b + segments
            tris += [(a, c, d), (a, d, b)]
    last = (rings - 2) * segments
    for k in range(segments):
        k1 = (k + 1) % segments
        tris.append((top, k, k1))
        tris.append((bottom, last + k1, last + k))
    return np.array(verts), np.array(tris)


# ---------------------------------------------------------------- the front

WIDTH = LENS["width_per_ipd"] * IPD
HEIGHT = LENS["aspect"] * WIDTH
outline_box = catmull_rom(OUTLINE, RIM["points"], closed=True)  # (u, v) on the unit box
# Counter-clockwise seen from the front of the left lens (u to the temple is +x).
area = 0.5 * np.sum(outline_box[:, 0] * np.roll(outline_box[:, 1], -1) - np.roll(outline_box[:, 0], -1) * outline_box[:, 1])
if area < 0:
    outline_box = outline_box[::-1]


def lens_frame(side, z):
    """Centre and axes of one lens: e_u to the temple, e_v up, e_n forward."""
    centre = np.array([side * (EYE[0] + LENS["outset"]), EYE[1] - LENS["drop"], z])
    w, t = LENS["wrap"], LENS["tilt"]
    e_u = np.array([side * math.cos(w), 0.0, -math.sin(w)])
    e_n0 = np.array([side * math.sin(w), 0.0, math.cos(w)])
    up = np.array([0.0, 1.0, 0.0])
    e_v = math.cos(t) * up + math.sin(t) * e_n0
    e_n = math.cos(t) * e_n0 - math.sin(t) * up
    return centre, e_u, e_v, e_n


def lens_point(frame, u, v):
    """A point of the curved lens front at box coordinates (metres from the centre)."""
    centre, e_u, e_v, e_n = frame
    r2 = u * u + v * v
    sag = LENS["radius"] - math.sqrt(LENS["radius"] ** 2 - r2)
    return centre + u * e_u + v * e_v - sag * e_n


def lens_normal(frame, u, v):
    centre, e_u, e_v, e_n = frame
    p = lens_point(frame, u, v)
    sphere_centre = centre - LENS["radius"] * e_n
    return normalize(p - sphere_centre)


def build_front(z):
    """Lenses, rims, brow bar, lower bridge, pad arms and pads for a lens front at depth z."""
    frame_mesh, lens_mesh = MeshData(), MeshData()
    parts = {}
    for side in (1, -1):
        frame = lens_frame(side, z)
        e_n = frame[3]
        outline = outline_box * [WIDTH, HEIGHT]
        rim = np.array([lens_point(frame, u, v) for u, v in outline])
        # Lens: a fan of rings from the centre of the box out to the outline.
        rings = (0.0, 0.4, 0.75, 1.0)
        verts, uvs = [], []
        for f in rings:
            pts = outline * f if f > 0 else np.zeros((1, 2))
            for u, v in pts:
                verts.append(lens_point(frame, u, v))
                uvs.append((u / WIDTH + 0.5, v / HEIGHT + 0.5))
        m = len(outline)
        tris = [(0, 1 + k, 1 + (k + 1) % m) for k in range(m)]
        for r in range(1, len(rings) - 1):
            a0, b0 = 1 + (r - 1) * m, 1 + r * m
            for k in range(m):
                k1 = (k + 1) % m
                tris += [(a0 + k, b0 + k, b0 + k1), (a0 + k, b0 + k1, a0 + k1)]
        lens_mesh.add("lens", verts, tris, uvs)
        # Rim: an elliptical wire around the lens edge, flat along the lens.
        tangents = normalize(np.roll(rim, -1, axis=0) - np.roll(rim, 1, axis=0))
        normals = np.array([lens_normal(frame, u, v) for u, v in outline])
        rv, rt = tube(rim, np.tile([RIM["depth"], RIM["inplane"]], (m, 1)), RIM["sides"], closed=True, frames=(tangents, normals))
        frame_mesh.add("rim", rv, rt)
        parts[side] = {"frame": frame, "rim": rim, "outline": outline}

    # Brow bar: from each rim's top, a quarter of the lens in from the nose,
    # straight across in front view, following the wrap in depth.
    def rim_at(side, u_box, top):
        outline = parts[side]["outline"]
        candidates = [i for i in range(len(outline)) if (outline[i, 1] > 0) == top]
        i = min(candidates, key=lambda i: abs(outline[i, 0] / WIDTH - u_box))
        return parts[side]["rim"][i]

    left, right = rim_at(1, -0.22, True), rim_at(-1, -0.22, True)
    lift = np.array([0.0, 0.0012, 0.0006])
    mid = (left + right) / 2 + np.array([0.0, 0.0, 0.0035]) + lift
    brow = catmull_rom([left, left + lift * 0.8 - [0.004, 0, 0], mid, right + lift * 0.8 + [0.004, 0, 0], right], 18, closed=False)
    bv, bt = tube(brow, np.full((len(brow), 1), BAR["radius"]) * [[1.15, 0.85]], BAR["sides"])
    frame_mesh.add("brow bar", bv, bt)

    # Lower bridge: joins the nasal rims in their upper third, arching up.
    def nasal(side, v_box):
        outline = parts[side]["outline"]
        candidates = [i for i in range(len(outline)) if outline[i, 0] < 0]
        i = min(candidates, key=lambda i: abs(outline[i, 1] / HEIGHT - v_box))
        return parts[side]["rim"][i]

    a, b = nasal(1, 0.22), nasal(-1, 0.22)
    top = (a + b) / 2 + np.array([0.0, 0.0028, 0.0025])
    bridge = catmull_rom([a, (a + top) / 2 + [0, 0.0006, 0], top, (b + top) / 2 + [0, 0.0006, 0], b], 14, closed=False)
    gv, gt = tube(bridge, np.full(len(bridge), BAR["radius"]), BAR["sides"])
    frame_mesh.add("bridge", gv, gt)
    parts["bridge"] = bridge

    # Nose pads on short arms from the nasal rims, resting on the sides of the nose.
    for side in (1, -1):
        hit, normal = ray((side * PAD["x"], EYE[1] - PAD["drop"], 0.3), (0, 0, -1))
        # The pad faces the nose: its thin axis along the skin normal; it
        # stands a little tilted, top toward the nose, as pads do.
        n_axis = normalize(normal)
        up = normalize(np.array([0.0, 1.0, 0.0]) - n_axis[1] * n_axis)
        across = normalize(np.cross(up, n_axis))
        centre = hit + n_axis * (CLEARANCE + PAD["half_thickness"] + 0.0002)
        # The nose curves under the pad: back it off until its whole face clears.
        for _ in range(10):
            pv, pt = ellipsoid(centre, (up, across, n_axis), (PAD["half_height"], PAD["half_width"], PAD["half_thickness"]), 10, 5)
            gap = clearance(pv).min()
            if gap >= CLEARANCE:
                break
            centre = centre + n_axis * (CLEARANCE - gap + 0.0002)
        frame_mesh.add("pad", pv, pt)
        start = nasal(side, -0.02)
        back = centre + n_axis * PAD["half_thickness"] * 0.6
        e_n = parts[side]["frame"][3]
        arm = catmull_rom([start, start - e_n * 0.003 - [side * 0.0005, 0, 0], back + n_axis * 0.0025, back], 8, closed=False)
        av, at = tube(arm, np.full(len(arm), 0.00045), 5)
        frame_mesh.add("pad arm", av, at)
        parts[side]["pad"] = centre

    return frame_mesh, lens_mesh, parts


def front_clearance(frame_mesh, lens_mesh):
    """Smallest clearance of the lenses, rims and bridges. The pads sit on
    the nose at their own clearance, wherever the front ends up."""
    front = np.concatenate([lens_mesh.pieces(), frame_mesh.pieces("rim", "brow bar", "bridge")])
    return clearance(front).min()


z = LASH_FRONT + LENS["vertex"]
for attempt in range(20):
    frame_mesh, lens_mesh, parts = build_front(z)
    gap = front_clearance(frame_mesh, lens_mesh)
    log(f"  try z {z:.4f}: clearance {gap * 1000:.1f} mm")
    if gap >= CLEARANCE:
        break
    z += CLEARANCE - gap + 0.0003
log(f"front at z {z:.4f}: clearance {gap * 1000:.1f} mm")

# ---------------------------------------------------------------- temples


def temple_path(side):
    """Hinge at the lens's top outer corner, back over the ear, down behind it."""
    frame = parts[side]["frame"]
    outline, rim = parts[side]["outline"], parts[side]["rim"]
    # Top outer corner of the rim: the point furthest out and up.
    corner = rim[np.argmax(outline[:, 0] / WIDTH + 0.8 * outline[:, 1] / HEIGHT)]
    e_u, e_n = frame[1], frame[3]
    hinge = corner + e_u * 0.0035 - e_n * 0.002
    ear = ear_top * [side, 1, 1]
    y_ear = ear[1] + 0.006
    over = np.array([side * (side_of_head(y_ear, ear[2]) + TEMPLE_CLEARANCE + TEMPLE["wire"]), y_ear, ear[2]])
    front = np.array([side * (side_of_head(hinge[1], 0.03) + TEMPLE_CLEARANCE + TEMPLE["wire"]), (hinge[1] * 2 + y_ear) / 3, 0.03])
    behind = over + np.array([-side * 0.0015, -0.007, -0.016])
    low = over + np.array([-side * 0.0035, -0.022, -0.026])
    tip = over + np.array([-side * 0.004, -0.034, -0.025])
    path = catmull_rom([corner, hinge, front, over, behind, low, tip], TEMPLE["samples"], closed=False)
    # Push out, point by point, where the temple comes within its clearance
    # of the head or the hair, smoothing the path between passes; the last
    # pass pushes, so the clearance holds everywhere.
    need = TEMPLE_CLEARANCE + TEMPLE["tip"]
    for _ in range(12):
        gaps = clearance(path[2:])
        if gaps.min() >= need and not any(inside_side(p) for p in path[2:]):
            break
        path[2:-1] = (path[1:-2] + 2 * path[2:-1] + path[3:]) / 4
        gaps = clearance(path[2:])
        for i, g in enumerate(gaps, start=2):
            if inside_side(path[i]):
                path[i][0] = side * (side_of_head(path[i][1], path[i][2]) + need)
            elif g < need:
                path[i] += normalize(path[i] - nearest(path[i])) * (need - g)
    return path, over


def temple_radii(path, over):
    """Thick at the hinge, a thin wire along the head, a sleeve from just before the ear."""
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
    s_ear = s[np.argmin(np.linalg.norm(path - over, axis=1))]
    return np.interp(
        s,
        [0, 0.006, 0.012, s_ear - 0.03, s_ear - 0.018, s[-1] - 0.003, s[-1]],
        [TEMPLE["hinge"], TEMPLE["hinge"], TEMPLE["wire"], TEMPLE["wire"], TEMPLE["tip"], TEMPLE["tip"], TEMPLE["tip"] * 0.8],
    )


frame_mesh_final = frame_mesh
for side in (1, -1):
    path, over = temple_path(side)
    radii = temple_radii(path, over)
    tv, tt = tube(path, radii, TEMPLE["sides"])
    frame_mesh_final.add("temple", tv, tt)
    gaps = clearance(path[2:]) - radii[2:]
    log(f"temple {'left' if side > 0 else 'right'}: length {np.sum(np.linalg.norm(np.diff(path, axis=0), axis=1)) * 1000:.0f} mm, clearance {gaps.min() * 1000:.1f} mm")

# ---------------------------------------------------------------- verification
#
# Measured on the finished pieces, surface by surface, vertex to surface: at
# rest, and with the head turned as far as Driver.tsx turns it (the mirror
# glance, about the head bone's +y, plus its sway). The glasses turn with the
# head bone; the skin low on the back of the head is partly weighted to the
# neck and turns less, so it is checked in the frame of the turned head.

GLANCE = (-0.57, 0.02)  # radians: Driver.tsx turns the head by up to -0.55 - 0.02 and +0.02
SURFACES = {"skin": skin, "eyes": eyes, "lashes": lashes, "brows": brows, "hair": hair}


def rotation_y(angle):
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]])


def turned(part, angle):
    """A driver mesh in the frame of the head turned by `angle`: the head's
    share of each vertex stays put, the neck's share turns back."""
    verts, _tris, weights = part
    back = verts @ rotation_y(-angle).T
    return weights[:, None] * verts + (1 - weights[:, None]) * back


def inside(tree, points):
    """True for each point inside the closed, outward-facing skin: the first
    surface a ray meets on its way out of the head faces away from it."""
    result = []
    for p in points:
        direction = Vector((p[0], 0.0, p[2])).normalized()
        location, normal, _i, _d = tree.ray_cast(Vector(p), direction)
        result.append(location is not None and normal.dot(direction) > 0)
    return np.array(result)


PARTS = {name: frame_mesh_final.pieces(name) for name in dict.fromkeys(frame_mesh_final.names)}
PARTS["lens"] = lens_mesh.pieces()
worst = {}
for angle in (0.0, *GLANCE):
    trees = {}
    for name, part in SURFACES.items():
        trees[name] = BVHTree.FromPolygons([tuple(v) for v in turned(part, angle)], [tuple(int(i) for i in t) for t in part[1]])
    for part_name, verts in PARTS.items():
        gaps = {name: min(tree.find_nearest(Vector(p))[3] for p in verts) for name, tree in trees.items()}
        if inside(trees["skin"], verts).any():
            raise RuntimeError(f"{part_name} goes into the head at a turn of {angle} rad")
        worst[part_name] = min(worst.get(part_name, 1.0), *gaps.values())
        log(f"  turn {angle:+.2f} {part_name:>8}: " + ", ".join(f"{k} {v * 1000:.1f}" for k, v in gaps.items()) + " mm")
log("clearance (mm, worst over the turns):", {k: round(v * 1000, 1) for k, v in worst.items()})
assert min(worst.values()) >= CLEARANCE, "the glasses come too close to the head"

# ---------------------------------------------------------------- Blender objects


def make_object(name, data, material):
    verts, tris, uvs = data.arrays()
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in to_blender(verts)], [], [tuple(int(i) for i in t) for t in tris])
    mesh.update()
    # Smooth shading; fix_winding turns the faces outward afterwards.
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    if name == "Lens":
        layer = mesh.uv_layers.new(name="UVMap")
        for loop in mesh.loops:
            layer.data[loop.index].uv = tuple(uvs[loop.vertex_index])
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def fix_winding(obj, forward_for_lens=False):
    """Every face looks out of its piece (tubes, pads) or forward (lenses)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if forward_for_lens:
        for face in bm.faces:
            # Blender -y is the head's forward (+z).
            if face.normal.y > 0:
                face.normal_flip()
    else:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


def principled(name, color, metallic, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return material


# Shown as is in any glTF viewer; Sunglasses.tsx replaces both with its own.
frame_material = principled("Frame", (0.83, 0.6, 0.25), 1.0, 0.3)
lens_material = principled("Lens", (0.55, 0.12, 0.6), 0.9, 0.05)
frame_obj = make_object("Frame", frame_mesh_final, frame_material)
lens_obj = make_object("Lens", lens_mesh, lens_material)
fix_winding(frame_obj)
fix_winding(lens_obj, forward_for_lens=True)

triangles = sum(len(p.vertices) - 2 for o in (frame_obj, lens_obj) for p in o.data.polygons)
log("triangles", triangles, "frame", len(frame_obj.data.polygons), "lens", len(lens_obj.data.polygons))
assert triangles < 3000, "keep the glasses under 3k triangles"

for obj in bpy.data.objects:
    obj.select_set(obj in (frame_obj, lens_obj))
bpy.context.view_layer.objects.active = frame_obj
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_texcoords=True,
    export_materials="EXPORT",
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_extras=False,
)
log("exported", OUT, os.path.getsize(OUT), "bytes")

if not RENDERS:
    sys.exit(0)

# ---------------------------------------------------------------- check renders

os.makedirs(RENDERS, exist_ok=True)
# Back in the driver's world: head frame -> glTF world -> Blender world.
place = Matrix((TO_BLENDER @ HEAD @ TO_GLTF).tolist())
for obj in (frame_obj, lens_obj):
    obj.matrix_world = place

# The mirror shows a sunset: a gradient world (violet ground, peach horizon,
# pink, lavender zenith) and a low warm sun.
nodes_lens = lens_material.node_tree
uv = nodes_lens.nodes.new("ShaderNodeUVMap")
split = nodes_lens.nodes.new("ShaderNodeSeparateXYZ")
ramp = nodes_lens.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.95, 0.3, 0.55, 1)
ramp.color_ramp.elements[1].color = (0.45, 0.12, 0.75, 1)
nodes_lens.links.new(uv.outputs["UV"], split.inputs[0])
nodes_lens.links.new(split.outputs["Y"], ramp.inputs["Fac"])
nodes_lens.links.new(ramp.outputs["Color"], nodes_lens.nodes["Principled BSDF"].inputs["Base Color"])

scene = bpy.context.scene
world = bpy.data.worlds.new("sunset")
world.use_nodes = True
wn = world.node_tree
coord = wn.nodes.new("ShaderNodeTexCoord")
sep = wn.nodes.new("ShaderNodeSeparateXYZ")
sky = wn.nodes.new("ShaderNodeValToRGB")
stops = [(0.0, (0.12, 0.06, 0.18)), (0.47, (0.35, 0.2, 0.35)), (0.5, (1.0, 0.62, 0.42)), (0.58, (0.95, 0.5, 0.62)), (1.0, (0.55, 0.5, 0.85))]
sky.color_ramp.elements[0].position, sky.color_ramp.elements[0].color = stops[0][0], (*stops[0][1], 1)
sky.color_ramp.elements[1].position, sky.color_ramp.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
for position, color in stops[1:-1]:
    element = sky.color_ramp.elements.new(position)
    element.color = (*color, 1)
remap = wn.nodes.new("ShaderNodeMapRange")
remap.inputs["From Min"].default_value, remap.inputs["From Max"].default_value = -1.0, 1.0
wn.links.new(coord.outputs["Generated"], sep.inputs[0])
wn.links.new(sep.outputs["Z"], remap.inputs["Value"])
wn.links.new(remap.outputs["Result"], sky.inputs["Fac"])
wn.links.new(sky.outputs["Color"], wn.nodes["Background"].inputs["Color"])
wn.nodes["Background"].inputs["Strength"].default_value = 1.0
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.data.color = (1.0, 0.75, 0.55)
sun.rotation_euler = (math.radians(70), 0, math.radians(-35))
scene.collection.objects.link(sun)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
camera.data.lens = 85
scene.collection.objects.link(camera)
scene.camera = camera
head_centre = Vector((place @ Vector(tuple(to_blender(np.array([[0.0, 0.035, 0.06]]))[0]))))
for name, yaw, pitch, distance in (("front", 0, 4, 0.62), ("three_quarter", 38, 6, 0.62), ("profile", 90, 2, 0.62), ("ear", 115, 18, 0.42)):
    a, p = math.radians(yaw), math.radians(pitch)
    offset = Vector((math.sin(a) * math.cos(p), -math.cos(a) * math.cos(p), math.sin(p))) * distance
    camera.location = head_centre + offset
    camera.rotation_euler = (head_centre - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(RENDERS, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    log("rendered", scene.render.filepath)
