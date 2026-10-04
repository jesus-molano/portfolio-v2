"""Builds the hero driver from MakeHuman / MPFB CC0 assets.

Usage:
    blender -b -P build_driver_mpfb.py -- <out_dir> [params.json]

The body and face values (MakeHuman macro sliders, face targets, smirk) come
from the optional params file; tools/blender/driver.params.json holds the
shipped ones and stays out of Git. Without it the script builds a neutral
MakeHuman man with the same hair, beard, tee and earring.

Needs MPFB 2.0.x enabled in the Blender profile (set XDG_CONFIG_HOME) with the
MakeHuman system assets installed. Only CC0 assets are used: the base mesh,
targets, skin, eyes, eyebrows, eyelashes and male_casualsuit06. The hair, the
beard, the striped tee and the earring are made here (no community assets:
the bundled beards are AGPL).

Writes <out_dir>/driver.blend, <out_dir>/driver.glb, textures in
<out_dir>/tex and check renders in <out_dir>/renders. Use an out_dir outside
the repository; only driver.glb is copied to public/models/makehuman-driver.
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1 :]
OUT = os.path.abspath(argv[0])
PARAMS = json.load(open(argv[1])) if len(argv) > 1 else {}
os.makedirs(os.path.join(OUT, "tex"), exist_ok=True)
os.makedirs(os.path.join(OUT, "renders"), exist_ok=True)

from bl_ext.user_default.mpfb.services import AssetService, TargetService  # noqa: E402
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402

scene = bpy.context.scene
view_layer = bpy.context.view_layer


def param(name, default):
    return PARAMS.get(name, default)


def log(*args):
    print("DRIVER", *args, flush=True)


for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

# ---------------------------------------------------------------- body + face

# MakeHuman macro sliders and face targets come from the params file (see the
# module docstring); without it the man keeps MakeHuman's default shape.
macro = TargetService.get_default_macro_info_dict()
macro["gender"] = 1.0
for key, value in param("macro", {}).items():
    macro[key] = value
basemesh = HumanService.create_human(macro_detail_dict=macro)

FACE = dict(param("face", {}))
for name, value in FACE.items():
    if value:
        try:
            TargetService.set_target_value(basemesh, name, value)
        except Exception as error:  # an unknown target name must not stop the build
            log("TARGET-FAIL", name, error)


def vertex_groups_of(obj):
    names = {g.index: g.name for g in obj.vertex_groups}
    members = {}
    for v in obj.data.vertices:
        for g in v.groups:
            if g.weight > 0.5:
                members.setdefault(names[g.group], []).append(v.index)
    return {k: np.array(v) for k, v in members.items()}


def mixed_coords(obj):
    keys = obj.data.shape_keys.key_blocks
    n = len(obj.data.vertices)
    basis = np.empty(n * 3, dtype=np.float64)
    keys[0].data.foreach_get("co", basis)
    out = basis.copy()
    tmp = np.empty(n * 3, dtype=np.float64)
    for key in keys[1:]:
        if key.mute or key.value == 0:
            continue
        key.data.foreach_get("co", tmp)
        out += key.value * (tmp - basis)
    return basis.reshape(-1, 3), out.reshape(-1, 3)


GROUPS = vertex_groups_of(basemesh)

# Smirk: the left mouth corner (+x) lifts and pulls back.
smirk = param("smirk", 0.0)
if smirk:
    basis, mixed = mixed_coords(basemesh)
    lips = GROUPS["lips"]
    corner = mixed[lips[np.argmax(mixed[lips, 0])]]
    d = np.linalg.norm(mixed - corner, axis=1)
    w = np.clip(1 - d / 0.02, 0, 1) ** 2
    w[GROUPS["HelperGeometry"]] = 0
    delta = np.outer(w, np.array([0.0012, 0.0012, 0.0028]) * smirk)
    # The cheek above the corner bunches a little.
    cheek = corner + np.array([0.008, -0.002, 0.014])
    wc = np.clip(1 - np.linalg.norm(mixed - cheek, axis=1) / 0.018, 0, 1) ** 2
    wc[GROUPS["HelperGeometry"]] = 0
    delta += np.outer(wc, np.array([0.0, -0.0012, 0.0012]) * smirk)
    key = basemesh.shape_key_add(name="smirk", from_mix=False)
    key.data.foreach_set("co", (basis + delta).ravel())
    key.value = 1.0

HumanService.add_builtin_rig(basemesh, "game_engine")
rig = basemesh.parent
log("RIG", rig.name if rig else None)


def asset(fragment, subdir):
    return AssetService.find_asset_absolute_path(fragment, subdir)


def add(fragment, subdir, kind):
    HumanService.add_mhclo_asset(asset(fragment, subdir), basemesh, asset_type=kind, subdiv_levels=0, material_type="MAKESKIN")


add("high-poly/high-poly.mhclo", "eyes", "Eyes")
add(param("eyebrows", "eyebrow008") + "/" + param("eyebrows", "eyebrow008") + ".mhclo", "eyebrows", "Eyebrows")
add("eyelashes01/eyelashes01.mhclo", "eyelashes", "Eyelashes")
add("male_casualsuit06/male_casualsuit06.mhclo", "clothes", "Clothes")

# The fitted assets are in place: freeze the face shape into the mesh.
for obj in (basemesh,):
    view_layer.objects.active = obj
    for o in scene.objects:
        o.select_set(o == obj)
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)

children = [o for o in bpy.data.objects if o.type == "MESH" and o != basemesh]
for obj in children:
    for mod in list(obj.modifiers):
        if mod.type == "SUBSURF":
            obj.modifiers.remove(mod)


def child(fragment):
    return next(o for o in children if fragment in o.name)


eyes, brows, lashes, clothes = child("high-poly"), child("eyebrow"), child("eyelashes"), child("casualsuit06")

# ---------------------------------------------------------------- landmarks

me = basemesh.data
N_VERTS = len(me.vertices)
P = np.empty(N_VERTS * 3)
me.vertices.foreach_get("co", P)
P = P.reshape(-1, 3)
NRM = np.empty(N_VERTS * 3)
me.vertices.foreach_get("normal", NRM)
NRM = NRM.reshape(-1, 3)
BODY = np.zeros(N_VERTS, bool)
BODY[GROUPS["body"]] = True
x, y, z = P[:, 0], P[:, 1], P[:, 2]


def centre(group):
    return P[GROUPS[group]].mean(axis=0)


ears = GROUPS["ears"]
ear_l = ears[P[ears, 0] > 0]
ear_r = ears[P[ears, 0] < 0]
O = (P[ear_l].mean(axis=0) + P[ear_r].mean(axis=0)) / 2
ear_top = P[ears, 2].max()
ear_bottom = P[ears, 2].min()
eye_c = (centre("joint-l-eye") + centre("joint-r-eye")) / 2
lips = GROUPS["lips"]
mouth_corner_z = P[lips[np.argmax(np.abs(P[lips, 0]))], 2]
mid = BODY & (np.abs(x) < 0.004)
upper_lip_top = P[lips[np.abs(P[lips, 0]) < 0.004], 2].max()
lower_lip_bottom = P[lips[np.abs(P[lips, 0]) < 0.004], 2].min()
nose_band = mid & (z > upper_lip_top) & (z < eye_c[2]) & (y < O[1] - 0.05)
nose_tip = P[np.where(nose_band)[0][np.argmin(y[nose_band])]]
# The nose base sits a little over halfway from the lip to the nose tip; the
# deepest midline point in that band is the nostril floor, too close to the tip.
subnasale = np.array([0.0, nose_tip[1], nose_tip[2] - 0.55 * (nose_tip[2] - upper_lip_top)])
chin_band = mid & (z < lower_lip_bottom) & (z > lower_lip_bottom - 0.06) & (y < O[1] - 0.04)
chin_front = P[np.where(chin_band)[0][np.argmin(y[chin_band])]]
head_top = z[BODY].max()
neck_z = centre("joint-neck")[2]
log("LANDMARKS", {k: [round(float(c), 4) for c in v] for k, v in {
    "O": O, "eye": eye_c, "nose_tip": nose_tip, "subnasale": subnasale, "chin": chin_front,
}.items()}, "ear_top", round(ear_top, 4), "ear_bottom", round(ear_bottom, 4), "head_top", round(head_top, 4),
    "upper_lip", round(upper_lip_top, 4), "corner", round(mouth_corner_z, 4), "neck", round(neck_z, 4))

# Head frame: angle around the vertical axis through the ear centres (0 is
# straight ahead, 90 at the ears, 180 at the back) and height above them.
theta = np.degrees(np.arctan2(np.abs(x - O[0]), -(y - O[1])))
h = z - O[2]
h_eye = eye_c[2] - O[2]
h_ear_top = ear_top - O[2]
h_ear_bottom = ear_bottom - O[2]
h_ear_mid = (h_ear_top + h_ear_bottom) / 2
h_sub = subnasale[2] - O[2]
h_corner = mouth_corner_z - O[2]
h_chin = chin_front[2] - O[2] - 0.022
h_nape = h_ear_bottom - 0.03


def smooth(a, b, t):
    s = np.clip((t - a) / (b - a), 0, 1)
    return s * s * (3 - 2 * s)


def curve(points):
    xs, ys = zip(*points)
    return np.interp(theta, xs, ys)


hp = param("hair", {})
# Full, straight hairline with rounded temple corners (no recession): it sits
# where the forehead starts to curve back, a touch below MakeHuman's scalp
# group (which starts at ~0.09 m above the ear centres on this head).
h_front = h_eye + 0.022 + hp.get("forehead", 0.044)
hairline = curve([
    (0, h_front), (20, h_front), (32, h_front - 0.004), (42, h_front - 0.016), (52, h_ear_top + 0.02),
    (60, h_ear_top + 0.006), (68, h_ear_top - 0.006), (74, h_ear_mid), (80, h_ear_mid + 0.004),
    (86, h_ear_top + 0.008), (100, h_ear_top + 0.004), (115, h_ear_bottom - 0.004), (140, h_nape), (180, h_nape),
])
fade_w = smooth(40, 56, theta)
fade_bottom = curve([(0, h_ear_top), (60, h_ear_top + 0.012), (110, h_ear_top + 0.006), (135, h_nape + 0.018), (180, h_nape + 0.018)])
fade_top = curve([(0, h_ear_top + 0.05), (60, h_ear_top + hp.get("fade", 0.05)), (130, h_ear_top + 0.04), (180, h_ear_top + 0.035)])
length_mult = (1 - fade_w) + fade_w * smooth(fade_bottom, fade_top, h)
hair_in = smooth(hairline - 0.001, hairline + 0.005, h)
L_TOP = hp.get("length", 0.008)
hair_len = L_TOP * length_mult * hair_in
hair_dens = hair_in * (0.4 + 0.6 * length_mult)

bp = param("beard", {})
cheek_line = curve([
    (0, h_sub - 0.001), (18, h_sub + 0.002), (26, h_corner + bp.get("cheek", 0.018)), (45, h_corner + bp.get("cheek", 0.018) + 0.014),
    (65, h_ear_mid - 0.008), (78, h_ear_mid + 0.006), (84, h_ear_top), (90, h_ear_top),
])
# The neckline stays just under the jaw: the beard must not run down the throat.
neck_line = curve([(0, h_chin - bp.get("neck", 0.004)), (30, h_chin + 0.002), (55, h_ear_bottom - 0.035), (75, h_ear_bottom - 0.022), (86, h_ear_bottom)])
front = 1 - smooth(82, 88, theta)
beard_dens = smooth(neck_line, neck_line + 0.008, h) * (1 - smooth(cheek_line - 0.01, cheek_line, h)) * front
moustache_goatee = (theta < 28) & (h < h_sub) & (h > h_chin - 0.01)
beard_dens = np.where(moustache_goatee, np.minimum(1, beard_dens * 1.3), beard_dens * bp.get("cheek_density", 0.75))
beard_len = np.full(N_VERTS, bp.get("length", 0.0035))
# A thick moustache: dense, long enough to cover the top of the upper lip.
beard_len[moustache_goatee & (h > h_corner - 0.004)] = bp.get("moustache", 0.008)
beard_len[moustache_goatee & (h <= h_corner - 0.004)] = bp.get("goatee", 0.007)
beard_len[theta > 68] = 0.003
beard_len[h < h_chin] = 0.003
beard_len *= np.clip(beard_dens * 1.3, 0, 1)

# Lips, ears, eyes and anything that is not skin stay clean.
excluded = np.zeros(N_VERTS, bool)
for group in ("lips", "ears", "HelperGeometry", "JointCubes"):
    excluded[GROUPS[group]] = True
excluded |= ~BODY
excluded |= np.linalg.norm(P - eye_c, axis=1) < 0.045
# The moustache hangs over the top rim of the upper lip.
lip_rim = lips[(P[lips, 2] > upper_lip_top - 0.004) & (P[lips, 2] > mouth_corner_z + 0.001) & (P[lips, 1] < O[1] - 0.09)]
excluded[lip_rim] = False
beard_dens[lip_rim] = 1.0
beard_len[lip_rim] = 0.004
hair_dens[lip_rim] = 0
for arr in (hair_len, hair_dens, beard_len, beard_dens):
    arr[excluded] = 0

is_beard = beard_dens > hair_dens
DENS = np.where(is_beard, beard_dens, hair_dens)
LEN = np.where(is_beard, beard_len, hair_len)
KIND = is_beard.astype(float)
# Hair flow: on top and at the back the strand lines run along y or fall in
# planes across x; on the sides they fall in planes across y.
FLOW = smooth(45, 75, theta) * (1 - smooth(120, 150, theta))
log("MASKS", "hair verts", int((hair_dens > 0.05).sum()), "beard verts", int((beard_dens > 0.05).sum()))


def set_attr(mesh, name, values):
    attr = mesh.attributes.get(name) or mesh.attributes.new(name, "FLOAT", "POINT")
    attr.data.foreach_set("value", np.asarray(values, dtype=np.float32))


set_attr(me, "va_dens", DENS)
set_attr(me, "va_kind", KIND)
# Skin under the hair and the beard darkens: roots and shadow.
set_attr(me, "va_stubble", np.clip(np.maximum(hair_dens * 0.9, beard_dens), 0, 1))

# ---------------------------------------------------------------- hair shells

SHELL_LAYERS = param("layers", [(0.3, 0.32), (0.62, 0.5), (0.95, 0.68)])
covered = DENS > 0.02
# One ring of margin so every shell ends at zero density.
grow = covered.copy()
for poly in me.polygons:
    vs = poly.vertices
    if any(covered[i] for i in vs):
        for i in vs:
            grow[i] = True
grow &= BODY


def shell(index, along, base_offset):
    bm = bmesh.new()
    bm.from_mesh(me)
    orig = bm.verts.layers.int.new("orig")
    for v in bm.verts:
        v[orig] = v.index
    kill = [f for f in bm.faces if not all(grow[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context="FACES_ONLY")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    ids = []
    for v in bm.verts:
        i = v[orig]
        ids.append(i)
        v.co = Vector(P[i] + NRM[i] * (base_offset + along * LEN[i]))
    uv = bm.loops.layers.uv.active
    us = np.array([[l[uv].uv[0], l[uv].uv[1]] for f in bm.faces for l in f.loops])
    lo, hi = us.min(axis=0) - 0.002, us.max(axis=0) + 0.002
    for f in bm.faces:
        f.smooth = True
        for l in f.loops:
            u = (np.array(l[uv].uv) - lo) / (hi - lo)
            l[uv].uv = (float(u[0]), float(u[1]))
    mesh = bpy.data.meshes.new(f"HairShell{index}")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(f"HairShell{index}", mesh)
    scene.collection.objects.link(obj)
    for g in basemesh.vertex_groups:
        obj.vertex_groups.new(name=g.name)
    obj.parent = basemesh.parent
    obj.matrix_parent_inverse = basemesh.matrix_parent_inverse.copy()
    obj.matrix_world = basemesh.matrix_world.copy()
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    ids = np.array(ids)
    set_attr(mesh, "va_dens", DENS[ids])
    set_attr(mesh, "va_kind", KIND[ids])
    set_attr(mesh, "va_flow", FLOW[ids])
    return obj


shells = [shell(i, along, 0.0005 * (i + 1)) for i, (along, _cutoff) in enumerate(SHELL_LAYERS)]

# ---------------------------------------------------------------- earring

ear_l_pts = P[ear_l]
lobe = ear_l_pts[np.argmin(ear_l_pts[:, 2])] + np.array([0.0015, -0.002, 0.004])
bpy.ops.mesh.primitive_torus_add(major_radius=0.0042, minor_radius=0.0012, major_segments=20, minor_segments=8, location=(0, 0, 0))
earring = bpy.context.active_object
earring.name = "Earring"
earring.rotation_euler = (math.radians(90), 0, math.radians(-12))
bpy.ops.object.transform_apply(rotation=True)
earring.data.transform(basemesh.matrix_world.inverted() @ basemesh.matrix_world)
for v in earring.data.vertices:
    v.co += Vector(lobe)
earring.matrix_world = basemesh.matrix_world.copy()
earring.parent = rig
earring.matrix_parent_inverse = rig.matrix_world.inverted()
group = earring.vertex_groups.new(name="head")
group.add(list(range(len(earring.data.vertices))), 1.0, "REPLACE")
mod = earring.modifiers.new("Armature", "ARMATURE")
mod.object = rig

# ---------------------------------------------------------------- tee stripes

cme = clothes.data
CP = np.empty(len(cme.vertices) * 3)
cme.vertices.foreach_get("co", CP)
CP = CP.reshape(-1, 3)
arm = rig.data.bones
shoulder = {s: np.array(rig.matrix_world @ arm[f"upperarm_{s}"].head_local) for s in "lr"}
elbow = {s: np.array(rig.matrix_world @ arm[f"lowerarm_{s}"].head_local) for s in "lr"}
inv = np.array(basemesh.matrix_world.inverted())
stripe_u = CP[:, 2].copy()
cgroups = {g.index: g.name for g in clothes.vertex_groups}
arm_weight = {s: np.zeros(len(CP)) for s in "lr"}
for v in cme.vertices:
    for g in v.groups:
        name = cgroups[g.group]
        for s in "lr":
            if name in (f"upperarm_{s}", f"lowerarm_{s}"):
                arm_weight[s][v.index] += g.weight
for s in "lr":
    a = (inv[:3, :3] @ shoulder[s]) + inv[:3, 3]
    b = (inv[:3, :3] @ elbow[s]) + inv[:3, 3]
    axis = (b - a) / np.linalg.norm(b - a)
    t = (CP - a) @ axis
    # Sleeve = skinned to the arm: one consistent region, so no face mixes
    # the torso height with the arm coordinate (that made a moire).
    sleeve = arm_weight[s] > 0.5
    stripe_u[sleeve] = a[2] - t[sleeve]  # continues the torso phase at the shoulder
# Collar: the band along the neck opening.
bmc = bmesh.new()
bmc.from_mesh(cme)
neck_ring = [v.co.copy() for v in bmc.verts if v.is_boundary and v.co.z > neck_z - 0.06 and abs(v.co.x) < 0.11]
bmc.free()
collar = np.zeros(len(CP))
if neck_ring:
    tree = KDTree(len(neck_ring))
    for i, co in enumerate(neck_ring):
        tree.insert(co, i)
    tree.balance()
    for i, co in enumerate(CP):
        _, _, dist = tree.find(Vector(co))
        collar[i] = 1.0 if dist < 0.016 else 0.0
log("COLLAR", len(neck_ring), int(collar.sum()))
set_attr(cme, "va_stripe", stripe_u)
set_attr(cme, "va_collar", collar)

# ---------------------------------------------------------------- baking

DATA = os.path.dirname(asset("young_caucasian_male/young_caucasian_male.mhmat", "skins"))
SKIN_SRC = bpy.data.images.load(os.path.join(DATA, "young_lightskinned_male_diffuse.png"))
TEE_SRC = bpy.data.images.load(os.path.join(os.path.dirname(asset("male_casualsuit06/male_casualsuit06.mhclo", "clothes")), "male_casualsuit06_diffuse.png"))

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 4
scene.render.bake.margin = 6


def new_image(name, size, data=None, non_color=False):
    img = bpy.data.images.new(name, size, size, alpha=False)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    if data is not None:
        img.pixels.foreach_set(data)
    return img


def pixels(img):
    arr = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(arr)
    return arr.reshape(img.size[1], img.size[0], 4)


class Nodes:
    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.tree = self.mat.node_tree
        self.tree.nodes.clear()

    def node(self, kind, **inputs):
        n = self.tree.nodes.new(kind)
        for key, value in inputs.items():
            if key.startswith("_"):
                setattr(n, key[1:], value)
            else:
                n.inputs[key].default_value = value
        return n

    def link(self, a, out, b, inp):
        self.tree.links.new(a.outputs[out], b.inputs[inp])

    def attr(self, name):
        return self.node("ShaderNodeAttribute", _attribute_name=name)

    def math(self, op, a=None, b=None, clamp=False):
        n = self.node("ShaderNodeMath", _operation=op, _use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if isinstance(v, tuple):
                self.link(v[0], v[1], n, i)
            elif v is not None:
                n.inputs[i].default_value = v
        return n

    def emit(self, color_src, target):
        em = self.node("ShaderNodeEmission")
        self.link(color_src[0], color_src[1], em, "Color")
        out = self.node("ShaderNodeOutputMaterial")
        self.link(em, "Emission", out, "Surface")
        img = self.node("ShaderNodeTexImage", _image=target)
        self.tree.nodes.active = img
        return self


def bake(obj, material, clear):
    saved = [s.material for s in obj.material_slots]
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for o in scene.objects:
        o.select_set(o == obj)
    view_layer.objects.active = obj
    bpy.ops.object.bake(type="EMIT", use_clear=clear, margin=6)
    obj.data.materials.clear()
    for m in saved:
        obj.data.materials.append(m)


def noise(nodes, scale, stretch, seed_offset):
    coords = nodes.node("ShaderNodeTexCoord")
    mapping = nodes.node("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale * stretch[0], scale * stretch[1], scale * stretch[2])
    mapping.inputs["Location"].default_value = (seed_offset, seed_offset * 0.7, seed_offset * 0.3)
    nodes.link(coords, "Object", mapping, "Vector")
    tex = nodes.node("ShaderNodeTexNoise", Detail=3.0, Roughness=0.6)
    nodes.link(mapping, "Vector", tex, "Vector")
    return tex


# Skin: warmer, olive tint; roots and beard shadow under the hair shells.
tint = param("skin_tint", (0.97, 0.82, 0.68))
skin_img = new_image("va_skin", 2048, pixels(SKIN_SRC).ravel())
n = Nodes("bake_skin")
src = n.node("ShaderNodeTexImage", _image=SKIN_SRC)
mul = n.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=1.0)
mul.inputs[7].default_value = (*tint, 1)
n.link(src, "Color", mul, 6)
stub = n.attr("va_stubble")
fine = noise(n, 900, (1, 1, 0.35), 3.1)
shade = n.math("MULTIPLY", (stub, "Fac"), param("stubble_strength", 0.72))
grain = n.math("MULTIPLY", (shade, 0), (fine, "Fac"))
grain2 = n.math("MULTIPLY", (grain, 0), 1.6, clamp=True)
dark = n.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MIX")
n.link(grain2, 0, dark, "Factor")
n.link(mul, 2, dark, 6)
dark.inputs[7].default_value = (0.045, 0.035, 0.032, 1)
n.emit((dark, 2), skin_img)
bake(basemesh, n.mat, clear=False)

# Hair and beard colour + alpha, in the shells' own UV square.
hair_rgb = new_image("va_hair_rgb", 1024)
hair_a = new_image("va_hair_a", 1024, non_color=True)
#
# Head hair is straight and short: fine parallel strand lines (wave bands,
# slightly distorted) that follow the comb, almost opaque in the middle and
# thinning out at the hairline and in the fade. The beard is coarser: noise
# streaks that hang down.


def strands(nodes, direction, seed):
    coords = nodes.node("ShaderNodeTexCoord")
    mapping = nodes.node("ShaderNodeMapping")
    mapping.inputs["Location"].default_value = (seed, seed * 0.6, seed * 0.3)
    nodes.link(coords, "Object", mapping, "Vector")
    # Band period = 0.314 / Scale metres: ~1.2 mm, above the texel size.
    wave = nodes.node("ShaderNodeTexWave", _wave_type="BANDS", _bands_direction=direction, _wave_profile="SIN",
                      Scale=param("strand_scale", 260.0), Distortion=4.0, Detail=2.0, **{"Detail Scale": 1.2})
    nodes.link(mapping, "Vector", wave, "Vector")
    # Lengthwise variation, so the lines break up like real strands.
    along = noise(nodes, 120, (1, 1, 1), seed + 0.5)
    s = nodes.math("ADD", (nodes.math("MULTIPLY", (wave, "Fac"), 0.65), 0), (nodes.math("MULTIPLY", (along, "Fac"), 0.45), 0))
    return nodes.math("SUBTRACT", (s, 0), 0.1, clamp=True)


for target, kind in ((hair_rgb, "rgb"), (hair_a, "alpha")):
    n = Nodes(f"bake_hair_{kind}")
    kind_attr = n.attr("va_kind")
    dens = n.attr("va_dens")
    flow = n.attr("va_flow")
    hair_s = n.node("ShaderNodeMix", _data_type="FLOAT", _blend_type="MIX")
    n.link(flow, "Fac", hair_s, "Factor")
    n.link(strands(n, "X", 1.7), 0, hair_s, 2)   # top and back: lines along y / falling
    n.link(strands(n, "Y", 2.9), 0, hair_s, 3)   # sides: falling lines
    beard_s = noise(n, 800, (1, 1, 0.22), 5.3)
    if kind == "alpha":
        # Hair: dens 1 keeps the two inner layers solid and ~85% of the outer
        # one; lower density (hairline, fade) leaves single strands.
        ha = n.math("ADD", (n.math("MULTIPLY", (dens, "Fac"), 1.4), 0), (n.math("MULTIPLY", (hair_s, 0), 0.85), 0))
        hair_a2 = n.math("SUBTRACT", (ha, 0), 0.85, clamp=True)
        ramp = n.node("ShaderNodeMapRange", **{"From Min": 0.38, "From Max": 0.66})
        n.link(beard_s, "Fac", ramp, "Value")
        beard_a = n.math("MULTIPLY", (n.math("MULTIPLY", (ramp, "Result"), (dens, "Fac")), 0), 1.25, clamp=True)
        a = n.node("ShaderNodeMix", _data_type="FLOAT", _blend_type="MIX")
        n.link(kind_attr, "Fac", a, "Factor")
        n.link(hair_a2, 0, a, 2)
        n.link(beard_a, 0, a, 3)
        rgb = n.node("ShaderNodeCombineColor")
        for i in range(3):
            n.link(a, 0, rgb, i)
        n.emit((rgb, 0), target)
    else:
        s = n.node("ShaderNodeMix", _data_type="FLOAT", _blend_type="MIX")
        n.link(kind_attr, "Fac", s, "Factor")
        n.link(hair_s, 0, s, 2)
        n.link(beard_s, "Fac", s, 3)
        base = n.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MIX")
        n.link(s, 0, base, "Factor")
        base.inputs[6].default_value = (0.01, 0.0075, 0.0065, 1)
        base.inputs[7].default_value = (0.05, 0.036, 0.028, 1)
        # Salt and pepper on top only.
        grey = noise(n, 700, (1, 0.2, 1), 9.1)
        greys = n.node("ShaderNodeMapRange", **{"From Min": 0.6, "From Max": 0.62})
        n.link(grey, "Fac", greys, "Value")
        amount = n.math("MULTIPLY", (greys, "Result"), param("grey", 0.6))
        top_only = n.math("SUBTRACT", 1.0, (kind_attr, "Fac"))
        g = n.math("MULTIPLY", (amount, 0), (top_only, 0))
        mixc = n.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MIX")
        n.link(g, 0, mixc, "Factor")
        n.link(base, 2, mixc, 6)
        mixc.inputs[7].default_value = (0.3, 0.29, 0.28, 1)
        n.emit((mixc, 2), target)
    bake(shells[0], n.mat, clear=True)
rgba = pixels(hair_rgb)
rgba[..., 3] = pixels(hair_a)[..., 0]
hair_img = bpy.data.images.new("va_hair", 1024, 1024, alpha=True)
hair_img.pixels.foreach_set(rgba.ravel())

# Tee: white with navy stripes and a burgundy collar.
tee_img = new_image("va_tee", 2048)
n = Nodes("bake_tee")
src = n.node("ShaderNodeTexImage", _image=TEE_SRC)
hsv = n.node("ShaderNodeSeparateColor", _mode="HSV")
n.link(src, "Color", hsv, "Color")
# Everything that is not the blue denim is the tee (this also paints over
# the printed chest logo of the original texture).
blue_lo = n.node("ShaderNodeMapRange", **{"From Min": 0.5, "From Max": 0.53})
n.link(hsv, 0, blue_lo, "Value")
blue_hi = n.node("ShaderNodeMapRange", **{"From Min": 0.7, "From Max": 0.73, "To Min": 1.0, "To Max": 0.0})
n.link(hsv, 0, blue_hi, "Value")
blue_sat = n.node("ShaderNodeMapRange", **{"From Min": 0.12, "From Max": 0.22})
n.link(hsv, 1, blue_sat, "Value")
denim = n.math("MULTIPLY", (n.math("MULTIPLY", (blue_lo, "Result"), (blue_hi, "Result")), 0), (blue_sat, "Result"))
white = n.math("SUBTRACT", 1.0, (denim, 0))
stripe = n.attr("va_stripe")
period = n.math("DIVIDE", (stripe, "Fac"), 0.05)
phase = n.math("FRACT", (period, 0))
ramp = n.node("ShaderNodeValToRGB")
cr = ramp.color_ramp
cr.interpolation = "CONSTANT"
navy, cream = (0.006, 0.007, 0.02, 1), (0.86, 0.85, 0.82, 1)
cr.elements[0].position, cr.elements[0].color = 0.0, navy
cr.elements[1].position, cr.elements[1].color = 0.2, cream
for pos, col in ((0.32, navy), (0.42, cream), (0.68, navy), (0.82, cream)):
    e = cr.elements.new(pos)
    e.color = col
n.link(phase, 0, ramp, "Fac")
collar_attr = n.attr("va_collar")
coll = n.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MIX")
n.link(collar_attr, "Fac", coll, "Factor")
n.link(ramp, "Color", coll, 6)
coll.inputs[7].default_value = (0.11, 0.018, 0.03, 1)
# Keep the fold shading, but not the old print (darker than the folds).
shading = n.math("MINIMUM", (n.math("MAXIMUM", (n.math("DIVIDE", (hsv, 2), 0.82), 0), 0.8), 0), 1.0)
shaded = n.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=1.0)
n.link(coll, 2, shaded, 6)
sh_rgb = n.node("ShaderNodeCombineColor")
for i in range(3):
    n.link(shading, 0, sh_rgb, i)
n.link(sh_rgb, 0, shaded, 7)
final = n.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MIX")
n.link(white, 0, final, "Factor")
n.link(src, "Color", final, 6)
n.link(shaded, 2, final, 7)
n.emit((final, 2), tee_img)
bake(clothes, n.mat, clear=True)


def save(img, name, size, fmt="PNG"):
    if img.size[0] != size:
        img.scale(size, size)
    path = os.path.join(OUT, "tex", name)
    img.filepath_raw = path
    img.file_format = fmt
    img.save()
    return bpy.data.images.load(path, check_existing=False)


skin_tex = save(skin_img, "skin.png", 2048)
hair_tex = save(hair_img, "hair.png", 1024)
tee_tex = save(tee_img, "tee.png", 1024)


def recolor(path, name, rgb, size, alpha_gain=1.0):
    img = bpy.data.images.load(path)
    px = pixels(img)
    px[..., 0], px[..., 1], px[..., 2] = rgb
    px[..., 3] = np.clip(px[..., 3] * alpha_gain, 0, 1)
    out = bpy.data.images.new(name, img.size[0], img.size[1], alpha=True)
    out.pixels.foreach_set(px.ravel())
    return save(out, name + ".png", size)


brow_name = param("eyebrows", "eyebrow008")
brow_tex = recolor(os.path.join(os.path.dirname(asset(f"{brow_name}/{brow_name}.mhclo", "eyebrows")), f"{brow_name}.png"), "brows", (0.022, 0.016, 0.013), 512, alpha_gain=1.9)
lash_tex = recolor(os.path.join(os.path.dirname(asset("eyelashes01/eyelashes01.mhclo", "eyelashes")), "eyelashes01.png"), "lashes", (0.01, 0.008, 0.008), 256)
eye_src = bpy.data.images.load(os.path.join(os.path.dirname(os.path.dirname(asset("high-poly/high-poly.mhclo", "eyes"))), "materials", "brown_eye.png"))
eye_tex = save(eye_src, "eye.png", 512)

# ---------------------------------------------------------------- materials


def material(name, texture, roughness, cutoff=None, color=None, metallic=0.0, specular=0.5, blend=False):
    """cutoff -> glTF alphaMode MASK; blend -> BLEND (alpha wired straight in).

    Backface culling exports as doubleSided false: the shells and the skin
    are closed or face outward; only the flat brow and lash cards need both sides.
    """
    m = Nodes(name)
    m.mat.use_backface_culling = not blend
    bsdf = m.node("ShaderNodeBsdfPrincipled", Roughness=roughness, Metallic=metallic)
    bsdf.inputs["Specular IOR Level"].default_value = specular
    out = m.node("ShaderNodeOutputMaterial")
    m.link(bsdf, "BSDF", out, "Surface")
    if texture is not None:
        tex = m.node("ShaderNodeTexImage", _image=texture)
        m.link(tex, "Color", bsdf, "Base Color")
        if cutoff is not None:
            gt = m.math("GREATER_THAN", (tex, "Alpha"), cutoff)
            m.link(gt, 0, bsdf, "Alpha")
        elif blend:
            m.link(tex, "Alpha", bsdf, "Alpha")
    elif color is not None:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
    return m.mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.material_index = 0


assign(basemesh, material("Skin", skin_tex, 0.52, specular=0.4))
assign(eyes, material("Eyes", eye_tex, 0.15, cutoff=0.5))
assign(brows, material("Brows", brow_tex, 0.9, specular=0.2, blend=True))
assign(lashes, material("Lashes", lash_tex, 0.9, specular=0.2, blend=True))
assign(clothes, material("Tee", tee_tex, 0.85, specular=0.3))
for (along, cutoff), obj in zip(SHELL_LAYERS, shells):
    assign(obj, material(obj.name, hair_tex, 0.48, cutoff=cutoff, specular=0.45))
assign(earring, material("Earring", None, 0.28, color=(0.012, 0.012, 0.014), metallic=0.85))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "driver.blend"))
log("SAVED blend")

# ---------------------------------------------------------------- export

export_objects = [rig, basemesh, eyes, brows, lashes, clothes, earring, *shells]
for o in scene.objects:
    o.select_set(o in export_objects)
view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "driver.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_skins=True,
    export_morph=False,
    export_animations=False,
    export_image_format="WEBP",
    export_image_quality=88,
    export_yup=True,
)
log("EXPORTED", os.path.getsize(os.path.join(OUT, "driver.glb")))

# ---------------------------------------------------------------- renders

scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE_NEXT"
scene.render.resolution_x, scene.render.resolution_y = 640, 760
world = bpy.data.worlds.new("w")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.42, 0.42, 0.44, 1)
bg.inputs[1].default_value = 0.8
scene.world = world
key = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
key.data.energy = 3.2
key.rotation_euler = (math.radians(58), 0, math.radians(-28))
scene.collection.objects.link(key)
fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
fill.data.energy = 0.8
fill.rotation_euler = (math.radians(70), 0, math.radians(120))
scene.collection.objects.link(fill)
world_head = basemesh.matrix_world @ Vector((0, O[1] - 0.02, O[2] + 0.02))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 85
scene.collection.objects.link(cam)
scene.camera = cam
for name, yaw, dist in (("front", 0, 0.95), ("three_quarter", 35, 0.95), ("profile", 90, 0.95), ("left", -60, 0.95), ("bust", 20, 2.2)):
    a = math.radians(yaw)
    target = world_head if name != "bust" else world_head - Vector((0, 0, 0.25))
    cam.location = target + Vector((math.sin(a) * dist, -math.cos(a) * dist, 0.03))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, "renders", f"{name}.png")
    bpy.ops.render.render(write_still=True)
log("RENDERED")
