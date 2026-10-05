"""Give the Poly convertible real materials and smooth bodywork, then export GLB.

The source model has one material and one baked 2048 px atlas, so the
paint, the windscreen and the rims all render as the same matte plastic.
This script, run on the GLB written by process_convertible.py:

- paints the badges (the roundels on the rims, the bonnet and the steering
  wheel) out of the atlas: no trademarks in the scene;
- turns the blue paint in the atlas into neutral grey that keeps the baked
  shading and panel lines, and writes a mask into the alpha channel (0.5 on
  paint, 0.25 on the tail lights and headlights, 1 elsewhere; never 0, so
  lossy WebP keeps the colour), so Car.tsx tints only the paint and lights
  only the lamps: plate and grille keep their own colours, and the clear
  coat can reflect the sky;
- splits the faces into named materials by the atlas colour under each face:
  Paint (body, lamps, plate, grille), Glass, Trim (interior, underbody),
  Rim, Tyre;
- welds the triangles (the source is flat shaded: every triangle has its own
  vertices, so nothing could be smoothed), then smooths the normals by angle
  with weighted normals, keeping every edge between two materials sharp, so
  the clear coat shows smooth highlights instead of facets. One level of
  subdivision on the paint was tried as well and left out: no visible gain
  at the hero's camera distances for a 27% larger file.

Object names (body, wheel_front_l, ...) and origins are kept: Car.tsx spins
the wheels by name.

Usage (Blender 4.5, or `pip install bpy==4.5.4` in a Python 3.11 venv):
  blender -b -P refine_convertible.py -- <in.glb> <out.glb>
  python refine_convertible.py <in.glb> <out.glb>
"""

import math
import sys

import bpy
import bmesh  # after bpy: the pip build only finds bmesh once bpy is loaded
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
src, dst = argv[0], argv[1]

# Atlas layout, in pixels of the 2048 px atlas (origin top left).
ATLAS_SIZE = 2048
BADGES = [
    # (x, y, radius, colour sample offset): filled with the colour beside them.
    (1297, 1586, 12, (0, -16)),  # rim hub
    (30, 1255, 12, (0, -18)),  # bonnet
    (1791, 93, 12, (0, -18)),  # steering wheel
]
RIM = (1290, 1582, 96)  # centre x, y and radius of the rim disc
GLASS_BOX = (620, 690, 870, 1100)  # x0, y0, x1, y1 of the windscreen block
# The grille quads (x0, y0, x1, y1): the kidney is drawn across two triangles
# per quad, and the vote would make the lower ones (mostly dark bars) Trim,
# shaded unlike the bonnet around them: pale or bright triangles around the
# grille. All of them are Paint; the alpha mask still keeps the kidney's own
# colours.
GRILLE_BOX = (28, 1228, 208, 1329)
# Lamps (x0, y0, x1, y1, kind): the red tail lights (rear and side views of
# the atlas) and the pale headlights beside the grille (front and side).
# Only the lamp pixels inside each box are marked, by colour.
LAMPS = [
    (300, 1070, 470, 1170, "tail"),
    (1450, 1390, 1560, 1480, "tail"),
    (207, 1220, 292, 1286, "head"),
    (34, 1500, 126, 1560, "head"),
]
PAINT_ALPHA = 0.5
LAMP_ALPHA = 0.25
SMOOTH_ANGLE = math.radians(60)
# Vertices closer than this (model units, the car is ~10 long) are one.
WELD_DISTANCE = 1e-4


def rgb_to_hsv(rgb: np.ndarray) -> np.ndarray:
    """Vectorised RGB (0..1) to HSV (0..1), last axis is the channel."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = rgb.max(axis=-1)
    c = v - rgb.min(axis=-1)
    s = np.where(v > 0, c / np.maximum(v, 1e-6), 0)
    safe = np.maximum(c, 1e-6)
    h = np.where(
        v == r, ((g - b) / safe) % 6, np.where(v == g, (b - r) / safe + 2, (r - g) / safe + 4)
    )
    h = np.where(c > 0, h / 6, 0)
    return np.stack([h, s, v], axis=-1)


def load_atlas(image: bpy.types.Image) -> np.ndarray:
    """Pixels as an (H, W, 4) float array with row 0 at the top."""
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(height, width, 4)[::-1].copy()


def store_atlas(image: bpy.types.Image, atlas: np.ndarray) -> None:
    image.pixels.foreach_set(atlas[::-1].ravel())
    image.update()
    image.pack()


def paint_out_badges(atlas: np.ndarray) -> None:
    height, width = atlas.shape[:2]
    ys, xs = np.mgrid[0:height, 0:width]
    for x, y, radius, (dx, dy) in BADGES:
        mask = (xs - x) ** 2 + (ys - y) ** 2 <= radius * radius
        atlas[mask, :3] = atlas[y + dy, x + dx, :3]


def neutralise_paint(atlas: np.ndarray) -> None:
    """Blue paint pixels become grey with the same relative brightness, and
    the alpha channel marks them (PAINT_ALPHA = paint, 1 = keep the atlas
    colour)."""
    hsv = rgb_to_hsv(atlas[..., :3])
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # Soft mask: antialiased edges between paint and trim blend smoothly.
    paint = np.clip((sat - 0.3) / 0.2, 0, 1) * np.clip((val - 0.12) / 0.1, 0, 1)
    paint *= ((hue > 0.53) & (hue < 0.72)).astype(np.float32)
    reference = np.median(val[paint > 0.99])
    grey = np.clip(val / reference, 0.55, 1.15) * 0.85
    for channel in range(3):
        atlas[..., channel] = atlas[..., channel] * (1 - paint) + grey * paint
    atlas[..., 3] = 1 - (1 - PAINT_ALPHA) * paint


def mark_lamps(atlas: np.ndarray, hsv: np.ndarray) -> None:
    """Lamp pixels keep their colour and get LAMP_ALPHA, so Car.tsx can make
    them glow: red tail lights, pale (warm-tinted) headlights."""
    for x0, y0, x1, y1, kind in LAMPS:
        h, s, v = (hsv[y0:y1, x0:x1, i] for i in range(3))
        if kind == "tail":
            lamp = ((h < 0.04) | (h > 0.93)) & (s > 0.45) & (v > 0.5)
        else:
            lamp = (s < 0.25) & (v > 0.55)
        alpha = atlas[y0:y1, x0:x1, 3]
        alpha[lamp] = LAMP_ALPHA


def classify(hsv: np.ndarray) -> str:
    h, s, v = hsv
    # Lamps and the plate sit on the bodywork: they share the paint material,
    # and the alpha mask keeps their own colours.
    if s > 0.45 and (h < 0.04 or h > 0.93) and v > 0.5:
        return "Paint"
    if 0.55 < h < 0.7 and s > 0.45 and v > 0.2:
        return "Paint"
    if s < 0.22 and v > 0.6:
        return "Paint"
    return "Trim"


def face_class(obj: bpy.types.Object, poly, uv_layer, hsv_atlas: np.ndarray) -> str:
    pts = [uv_layer.data[i].uv for i in poly.loop_indices]
    cu = sum(p[0] for p in pts) / len(pts)
    cv = sum(p[1] for p in pts) / len(pts)
    px = cu * ATLAS_SIZE
    py = (1 - cv) * ATLAS_SIZE
    if obj.name.startswith("wheel_"):
        x, y, r = RIM
        return "Rim" if (px - x) ** 2 + (py - y) ** 2 < r * r else "Tyre"
    x0, y0, x1, y1 = GLASS_BOX
    if x0 <= px <= x1 and y0 <= py <= y1:
        return "Glass"
    x0, y0, x1, y1 = GRILLE_BOX
    if x0 <= px <= x1 and y0 <= py <= y1:
        return "Paint"
    # Majority vote over the centroid and points between it and each corner.
    samples = [(cu, cv)] + [((2 * cu + p[0]) / 3, (2 * cv + p[1]) / 3) for p in pts]
    votes: dict[str, int] = {}
    for u, v in samples:
        ix = min(ATLAS_SIZE - 1, max(0, int(u * ATLAS_SIZE)))
        iy = min(ATLAS_SIZE - 1, max(0, int((1 - v) * ATLAS_SIZE)))
        label = classify(hsv_atlas[iy, ix])
        votes[label] = votes.get(label, 0) + 1
    return max(votes, key=votes.get)


def make_material(name: str, image: bpy.types.Image | None) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    if image is not None:
        texture = material.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = image
        material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    return material


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

image = bpy.data.images[0]
assert image.size[0] == ATLAS_SIZE, "unexpected atlas size"
atlas = load_atlas(image)
hsv_source = rgb_to_hsv(atlas[..., :3])  # classify on the original colours
paint_out_badges(atlas)
neutralise_paint(atlas)
mark_lamps(atlas, hsv_source)
store_atlas(image, atlas)
image.name = "ConvertibleAtlas"

TEXTURED = {"Paint", "Trim", "Rim"}
NAMES = ["Paint", "Glass", "Trim", "Rim", "Tyre"]
materials = {name: make_material(name, image if name in TEXTURED else None) for name in NAMES}

def weld(mesh: bpy.types.Mesh) -> None:
    """The source mesh has every triangle on its own vertices (flat shaded),
    so no edge is shared and smoothing would change nothing: merge the
    coincident vertices first. UVs live on the face corners and are kept."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD_DISTANCE)
    bm.to_mesh(mesh)
    bm.free()


def mark_sharp_edges(mesh: bpy.types.Mesh) -> None:
    """Smooth by angle, and keep every edge between two materials sharp."""
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.set_sharp_from_angle(angle=SMOOTH_ANGLE)
    edge_lookup = {tuple(sorted(e.vertices)): e.index for e in mesh.edges}
    face_materials: dict[int, set[int]] = {}
    for poly in mesh.polygons:
        for key in poly.edge_keys:
            face_materials.setdefault(edge_lookup[key], set()).add(poly.material_index)
    sharp = mesh.attributes.get("sharp_edge") or mesh.attributes.new("sharp_edge", "BOOLEAN", "EDGE")
    for edge_index, mats in face_materials.items():
        if len(mats) > 1:
            sharp.data[edge_index].value = True


counts: dict[str, int] = {}
for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
    mesh = obj.data
    uv_layer = mesh.uv_layers.active
    mesh.materials.clear()
    for name in NAMES:
        mesh.materials.append(materials[name])
    labels = [face_class(obj, poly, uv_layer, hsv_source) for poly in mesh.polygons]
    for poly, label in zip(mesh.polygons, labels):
        poly.material_index = NAMES.index(label)
        counts[label] = counts.get(label, 0) + 1

    weld(mesh)
    mark_sharp_edges(mesh)
    # Large panels stay flat and the shading turns on the narrow faces between
    # them: a crisp shoulder line instead of a gradient across every facet.
    modifier = obj.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    modifier.keep_sharp = True

print("FACES PER MATERIAL", counts)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_image_format="WEBP",
)
print("EXPORTED", dst)
