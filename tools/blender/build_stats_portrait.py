"""STATS player card: a Cycles portrait of Jesús (the hero's driver model) with
Dante, his cream lynx-point kitten, as PLAYER 2 at his shoulder.

Writes the card image public/stats/portrait.{avif,webp} is encoded from.

Inputs (read only):
  public/models/makehuman-driver/driver.glb   him: body, striped tee, earring,
                                              short crop, beard and moustache
                                              (alpha-tested HairShell layers)
  public/models/sunglasses/aviator.glb        his gold aviators, in the frame
                                              of the rig's "head" bone
  tools/blender/cats                           the cats generator (Dante),
                                              imported as a package, never
                                              written to

Run with Blender 4.5 as a Python module:

  XDG_CONFIG_HOME=$(mktemp -d) nice <bpy python> tools/blender/build_stats_portrait.py -- \
      --out <dir> [--res 1200] [--samples 64] [--threads 2] \
      [--dante none|clay|test|final] [--layer all|man|dante] [--crop face|dante]

Bust portrait on a vertical 4:5 card: 85 mm on a full-frame body turned to
portrait (24 x 30 mm of it), about 2 m from him; body turned 35 degrees,
head turned back toward the lens and the chin a little down; arms down from
the bind A-pose. Light like the site's pause menu: a warm key from image
left, a hot pink rim from behind at image right, a violet kicker behind at
image left, a soft lavender fill, and a sunset world (invisible: the film is
transparent) that the mirrored lenses reflect.

Deterministic: fixed Cycles seed; the cats generator seeds itself per cat.
"""

import argparse
import json
import math
import os
import struct
import sys
import time

import numpy as np

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

T0 = time.time()
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DRIVER = os.path.join(REPO, "public/models/makehuman-driver/driver.glb")
GLASSES = os.path.join(REPO, "public/models/sunglasses/aviator.glb")
CATS = os.path.join(REPO, "tools", "blender")


def log(*a):
    print(f"[portrait {time.time() - T0:7.1f}s]", *a, flush=True)


def srgb(hex_):
    """'#rrggbb' -> linear RGB tuple."""
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# The site's palette (src/design/tokens.ts), plus the card's own warm key.
PAL = dict(
    night="#1a0d38", dusk="#6a4bc4", haze="#e39bbd", magenta="#ff2d95", pink="#ff8fd0",
    violet="#8a4dff", orange="#ff8a5c", amber="#ffd8a8", ink="#2b1848", lilac="#8c62b8",
    sodium="#ffd27a", cream="#fff4f1", text="#f6f1ff",
)

# ------------------------------------------------------------------ composition
# Every number of the shot in one place, so a tweak is one edit.
SHOT = dict(
    aspect=(4, 5),
    lens=85.0,
    sensor_w=24.0,            # full frame turned to portrait, cropped to 4:5 (24 x 30 mm)
    frame_h=0.64,             # metres of frame height at the head's depth
    azimuth=35.0,             # camera round to his left (image right = his left side)
    cam_dz=0.035,             # camera height above the head pivot (eyes a little below)
    head_at=(0.58, 0.705),    # where the head pivot lands in the frame (x, y from the bottom)
    head_yaw=19.0,            # head and neck turned back toward the lens (degrees)
    head_pitch=6.0,           # chin down
    head_roll=2.5,            # a slight tilt (+ tips the crown toward his right, image left)
    neck_share=0.45,          # share of the turn taken by the neck
    arm_out=8.0,              # upper arms hang this far out from vertical
    arm_fwd=4.0,              # and this far forward (his left arm)
    arm_fwd_r=-32.0,          # his right arm, behind Dante: back, so no skin shows under his paws
    forearm_fwd=0.12,         # forearms hang with a soft bend forward (share of the drop)
    forearm_fwd_r=-0.2,       # his right forearm a little back too, hidden by his side
    shoulder_drop=4.0,        # clavicles lowered: relaxed shoulders
)

# Dante: where he sits in the frame and how far in front of the man's shoulder.
DANTE = dict(
    centre_x=0.225,           # his body's centre, as a fraction of the frame width
    base_y=0.004,             # his lowest point just above the bottom edge (paws on the name plate)
    forward=0.14,             # metres nearer the lens than the man's right shoulder
    turn=14.0,                # body turned toward the man (degrees)
)

LIGHTS = dict(
    key=dict(colour="#ffd3ab", energy=55.0, size=0.9, at=(-1.25, -0.55, 0.62)),
    fill=dict(colour="#b7a2e8", energy=12.0, size=2.2, at=(1.30, -1.70, 0.10)),
    rim=dict(colour="#ff4fa6", energy=80.0, size=(0.22, 1.1), at=(0.85, 0.95, 0.28)),
    kicker=dict(colour="#8a4dff", energy=30.0, size=(0.22, 1.1), at=(-0.95, 1.05, 0.18)),
    top=dict(colour="#e9d8ff", energy=6.0, size=0.6, at=(0.15, 0.55, 1.05)),
    world=0.10,
    # a big sunset card behind the lens, seen only in reflections: the
    # mirrored aviators and the gold wire pick it up
    card=dict(strength=1.6, size=(3.0, 2.2), behind=1.2),
    # Dante's eye light (linked to his eyes only): metres toward the lens,
    # then image right / up of that line
    dante_eyes=dict(colour="#eee6ff", energy=2.0, size=0.25, dist=0.8, at=(-0.18, 0.22)),
)


# ------------------------------------------------------------------ glTF frames

def node_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=float).reshape(4, 4).T
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    r = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
    m = np.eye(4)
    m[:3, :3] = r @ np.diag(node.get("scale", [1, 1, 1]))
    m[:3, 3] = node.get("translation", [0, 0, 0])
    return m


def bone_rest_matrix(path, name):
    """World matrix of a GLB node at rest (bind pose), in glTF space."""
    with open(path, "rb") as f:
        data = f.read()
    (json_length,) = struct.unpack_from("<I", data, 12)
    nodes = json.loads(data[20:20 + json_length])["nodes"]
    parent = {child: i for i, n in enumerate(nodes) for child in n.get("children", [])}
    index = next(i for i, n in enumerate(nodes) if n.get("name") == name)
    m = np.eye(4)
    while index is not None:
        m = node_matrix(nodes[index]) @ m
        index = parent.get(index)
    return m


# glTF is +Y up, Blender +Z up: Blender (x, y, z) = glTF (x, -z, y).
TO_GLTF = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], dtype=float)
TO_BLENDER = np.linalg.inv(TO_GLTF)


# ------------------------------------------------------------------ the man

def import_man():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=DRIVER)
    man = [o for o in bpy.data.objects if o not in before]
    rig = next(o for o in man if o.type == "ARMATURE")
    meshes = [o for o in man if o.type == "MESH" and o.parent == rig]
    for o in man:
        # the importer's bone-shape icosphere and anything else unskinned stays out
        if o.type == "MESH" and o.parent != rig:
            o.hide_render = True
            o.hide_viewport = True
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=GLASSES)
    glasses = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    # The aviators' GLB is in the head bone's frame: put it where the head is
    # at rest, then hang it on the bone so it follows the pose.
    place = Matrix((TO_BLENDER @ bone_rest_matrix(DRIVER, "head") @ TO_GLTF).tolist())
    for o in glasses:
        o.matrix_world = place
    bpy.context.view_layer.update()
    for o in glasses:
        mw = o.matrix_world.copy()
        o.parent = rig
        o.parent_type = "BONE"
        o.parent_bone = "head"
        bpy.context.view_layer.update()
        o.matrix_world = mw
    bpy.context.view_layer.update()
    return rig, meshes, glasses


def bone_world(rig, name):
    pb = rig.pose.bones[name]
    m = rig.matrix_world @ pb.matrix
    head = m.translation.copy()
    tail = rig.matrix_world @ pb.tail
    return m, head, tail


def rotate_bone(rig, name, rot):
    """Turn a pose bone by a world-space rotation (3x3) about its head."""
    pb = rig.pose.bones[name]
    m, head, _ = bone_world(rig, name)
    r4 = rot.to_4x4()
    new = Matrix.Translation(head) @ r4 @ Matrix.Translation(-head) @ m
    pb.matrix = rig.matrix_world.inverted() @ new
    bpy.context.view_layer.update()


def aim_bone(rig, name, direction):
    _, head, tail = bone_world(rig, name)
    d0 = (tail - head).normalized()
    rotate_bone(rig, name, d0.rotation_difference(Vector(direction).normalized()).to_matrix())


def pose_man(rig):
    s = SHOT
    for side, sx in (("l", 1.0), ("r", -1.0)):
        # relaxed shoulders: the clavicle's outer end a little down
        # (+Y turns his left side's outer end down, -Y his right side's)
        axis = Vector((0, 1, 0)) if side == "l" else Vector((0, -1, 0))
        rotate_bone(rig, f"clavicle_{side}", Matrix.Rotation(math.radians(s["shoulder_drop"]), 3, axis))
        # arms down from the A-pose, a little out; the far (right) arm a
        # little back, so it stays behind his side under Dante's paws
        out = math.radians(s["arm_out"])
        fwd = math.radians(s["arm_fwd"] if side == "l" else s["arm_fwd_r"])
        aim_bone(rig, f"upperarm_{side}", (sx * math.sin(out), -math.sin(fwd), -1.0))
        # forearms hang with a soft bend forward
        ff = s["forearm_fwd"] if side == "l" else s["forearm_fwd_r"]
        aim_bone(rig, f"lowerarm_{side}", (sx * 0.04, -ff, -1.0))
    # head and neck: turn back toward the lens, chin down, a slight tilt
    share = {"neck_01": s["neck_share"], "head": 1.0 - s["neck_share"]}
    for name in ("neck_01", "head"):
        k = share[name]
        rotate_bone(rig, name, Matrix.Rotation(math.radians(s["head_yaw"] * k), 3, "Z"))
        # the head's left and forward axes from the turned face direction
        fwd = Matrix.Rotation(math.radians(s["head_yaw"]), 3, "Z") @ Vector((0, -1, 0))
        left = Vector((0, 0, 1)).cross(fwd).normalized()
        rotate_bone(rig, name, Matrix.Rotation(math.radians(s["head_pitch"] * k), 3, left))
        rotate_bone(rig, name, Matrix.Rotation(math.radians(s["head_roll"] * k), 3, fwd))


def head_pivot(rig):
    _, h, t = bone_world(rig, "head")
    return h + (t - h) * 0.45


# ------------------------------------------------------------------ materials

def principled(mat):
    return mat.node_tree.nodes["Principled BSDF"]


def style_earring(mat):
    """Dark gunmetal, the anodised blue gathering toward grazing angles (Driver.tsx)."""
    nt = mat.node_tree
    b = principled(mat)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.3
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 3.0
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 0.75
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*srgb("#3d4047"), 1)
    mix.inputs[7].default_value = (*srgb("#2f6cff"), 1)
    nt.links.new(lw.outputs["Facing"], pw.inputs[0])
    nt.links.new(pw.outputs[0], mul.inputs[0])
    nt.links.new(mul.outputs[0], mix.inputs[0])
    nt.links.new(mix.outputs[2], b.inputs["Base Color"])


def style_glasses(glasses):
    for o in glasses:
        mat = o.data.materials[0]
        nt = mat.node_tree
        b = principled(mat)
        if mat.name.startswith("Frame"):
            # pale gold wire, a little brushed (Sunglasses.tsx)
            b.inputs["Base Color"].default_value = (*srgb("#f3d38c"), 1)
            b.inputs["Metallic"].default_value = 1.0
            b.inputs["Roughness"].default_value = 0.28
            continue
        # Lens: a gradient mirror (violet top, pink bottom) over dark glass;
        # from behind, dark tinted glass. glTF t runs top (0) to bottom (1);
        # Blender's v is 1 - t.
        uv = nt.nodes.new("ShaderNodeUVMap")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*srgb("#ff6cc0"), 1)   # v = 0: bottom
        ramp.color_ramp.elements[1].color = (*srgb("#a04cf2"), 1)   # v = 1: top
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        mixc = nt.nodes.new("ShaderNodeMix")
        mixc.data_type = "RGBA"
        mixc.inputs[7].default_value = (*srgb("#2b1c33"), 1)
        mixm = nt.nodes.new("ShaderNodeMath")
        mixm.operation = "SUBTRACT"
        mixm.inputs[0].default_value = 0.9
        mixm.use_clamp = True
        nt.links.new(uv.outputs["UV"], sep.inputs[0])
        nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], mixc.inputs[6])
        nt.links.new(geo.outputs["Backfacing"], mixc.inputs[0])
        nt.links.new(mixc.outputs[2], b.inputs["Base Color"])
        nt.links.new(geo.outputs["Backfacing"], mixm.inputs[1])
        nt.links.new(mixm.outputs[0], b.inputs["Metallic"])
        b.inputs["Roughness"].default_value = 0.05
        b.inputs["Coat Weight"].default_value = 1.0
        b.inputs["Coat Roughness"].default_value = 0.04


# The MakeHuman casual suit's tee carries a small "MAKE" print on the chest
# and a thin ring beside it (texture pixels, rows from the top). The text is
# filled from the stripes on either side, row by row: the stripes run across
# the panel, so each row's colour carries straight through. The ring crosses
# the stripes, so a median along each row drops its thin strokes and keeps
# the stripes; a soft edge blends it in.
TEE_PRINT = (203, 253, 130, 151)   # x0, x1, y0, y1 in the 1024 px tee texture
TEE_RING = (252, 143, 20)          # centre x, y and radius of the ring's disc
TEE_RING_MEDIAN = 11               # row median width (px), wider than its strokes


def clean_tee(image):
    from numpy.lib.stride_tricks import sliding_window_view
    w, h = image.size
    px = np.empty(w * h * 4, np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[::-1].copy()   # Blender stores rows bottom-up
    k = w / 1024
    x0, x1, y0, y1 = (int(v * k) for v in TEE_PRINT)
    for y in range(y0, y1):
        left = px[y, x0 - 2:x0].mean(0)
        right = px[y, x1:x1 + 2].mean(0)
        t = np.linspace(0, 1, x1 - x0)[:, None]
        px[y, x0:x1] = left * (1 - t) + right * t
    cx, cy, r = (v * k for v in TEE_RING)
    width = int(TEE_RING_MEDIAN * k) | 1
    ry0, ry1, rx0, rx1 = int(cy - r - 8), int(cy + r + 8), int(cx - r - 12), int(cx + r + 12)
    region = px[ry0:ry1, rx0:rx1]
    padded = np.pad(region, ((0, 0), (width // 2, width // 2), (0, 0)), mode="edge")
    med = np.median(sliding_window_view(padded, width, axis=1), axis=-1)
    yy, xx = np.mgrid[ry0:ry1, rx0:rx1]
    a = np.clip(1 - (np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) - r) / (3 * k), 0, 1)[..., None]
    px[ry0:ry1, rx0:rx1] = region * (1 - a) + med * a
    image.pixels.foreach_set(px[::-1].ravel())
    image.update()


def style_man(meshes):
    for o in meshes:
        for mat in o.data.materials:
            b = principled(mat)
            if mat.name == "Skin":
                # living skin, not plastic: a little subsurface, a softer sheen
                b.subsurface_method = "RANDOM_WALK_SKIN"
                b.inputs["Subsurface Weight"].default_value = 0.22
                b.inputs["Subsurface Radius"].default_value = (1.0, 0.36, 0.2)
                b.inputs["Subsurface Scale"].default_value = 0.012
                b.inputs["Roughness"].default_value = 0.5
                b.inputs["Specular IOR Level"].default_value = 0.42
                # pores: a fine bump breaks the highlights up (millimetre scale)
                nt = mat.node_tree
                tc = nt.nodes.new("ShaderNodeTexCoord")
                noise = nt.nodes.new("ShaderNodeTexNoise")
                noise.inputs["Scale"].default_value = 700.0
                noise.inputs["Detail"].default_value = 3.0
                bump = nt.nodes.new("ShaderNodeBump")
                bump.inputs["Strength"].default_value = 0.12
                bump.inputs["Distance"].default_value = 0.0004
                nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
                nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
                nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
            elif mat.name == "Tee":
                tex = next(n for n in mat.node_tree.nodes if n.bl_idname == "ShaderNodeTexImage")
                clean_tee(tex.image)
                # cotton jersey: rough, with a faint fibre sheen at the edges
                b.inputs["Roughness"].default_value = 0.9
                b.inputs["Sheen Weight"].default_value = 0.35
                b.inputs["Sheen Roughness"].default_value = 0.5
                b.inputs["Sheen Tint"].default_value = (*srgb("#f6f1ff"), 1)
            elif mat.name.startswith("HairShell"):
                b.inputs["Roughness"].default_value = 0.62
                b.inputs["Specular IOR Level"].default_value = 0.3
                b.inputs["Sheen Weight"].default_value = 0.25
                b.inputs["Sheen Roughness"].default_value = 0.35
            elif mat.name == "Earring":
                style_earring(mat)


# ------------------------------------------------------------------ camera and lights

def look_at(ob, target, up=Vector((0, 0, 1))):
    d = (Vector(target) - ob.location).normalized()
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def camera_rig(scene, rig, res):
    s = SHOT
    pivot = head_pivot(rig)
    cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = s["lens"]
    cam.data.sensor_fit = "HORIZONTAL"
    cam.data.sensor_width = s["sensor_w"]
    w, h = s["aspect"]
    scene.render.resolution_x = res
    scene.render.resolution_y = int(round(res * h / w))
    sensor_h = s["sensor_w"] * h / w
    dist = s["frame_h"] * s["lens"] / sensor_h
    a = math.radians(s["azimuth"])
    cam.location = pivot + Vector((math.sin(a), -math.cos(a), 0)) * dist + Vector((0, 0, s["cam_dz"]))
    # level the camera on the head (verticals stay vertical), then frame with shift
    flat = Vector((pivot.x, pivot.y, cam.location.z))
    look_at(cam, flat)
    # frame with the lens shift (linear in it for a level camera: two steps)
    hx, hy = s["head_at"]
    cam.data.clip_start = 0.05
    for _ in range(2):
        bpy.context.view_layer.update()
        v = world_to_camera_view(scene, cam, pivot)
        cam.data.shift_x += (v.x - hx) * w / h     # shift is in units of the larger side
        cam.data.shift_y += (v.y - hy)
    bpy.context.view_layer.update()
    return cam, pivot


def cam_basis(cam):
    m = cam.matrix_world.to_3x3()
    right, up, back = m.col[0], m.col[1], m.col[2]
    return right.normalized(), up.normalized(), (-back).normalized()


def area(scene, name, colour, energy, size, location, target):
    li = bpy.data.lights.new(name, "AREA")
    li.energy = energy
    li.color = srgb(colour)
    if isinstance(size, tuple):
        li.shape = "RECTANGLE"
        li.size, li.size_y = size
    else:
        li.shape = "DISK"
        li.size = size
    ob = bpy.data.objects.new(name, li)
    scene.collection.objects.link(ob)
    ob.location = location
    look_at(ob, target)
    return ob


def light_rig(scene, cam, pivot):
    right, up, fwd = cam_basis(cam)
    # horizontal frame: forward from the lens to him, right of the image, world up
    fwd_h = Vector((fwd.x, fwd.y, 0)).normalized()
    right_h = Vector((right.x, right.y, 0)).normalized()
    z = Vector((0, 0, 1))
    target = pivot + Vector((0, 0, -0.10))
    obs = {}
    for name in ("key", "fill", "rim", "kicker", "top"):
        L = LIGHTS[name]
        x, y, h = L["at"]   # image right, away from the lens, up (metres from the head)
        loc = pivot + right_h * x + fwd_h * y + z * h
        aim = target if name not in ("rim", "kicker") else pivot + Vector((0, 0, -0.16))
        obs[name] = area(scene, name, L["colour"], L["energy"], L["size"], loc, aim)
    return obs


def reflection_card(scene, cam):
    """A sunset gradient card behind the camera, visible to glossy rays only."""
    C = LIGHTS["card"]
    right, up, fwd = cam_basis(cam)
    me = bpy.data.meshes.new("card")
    sx, sy = C["size"]
    me.from_pydata([(-sx / 2, -sy / 2, 0), (sx / 2, -sy / 2, 0), (sx / 2, sy / 2, 0), (-sx / 2, sy / 2, 0)], [],
                   [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = c
    ob = bpy.data.objects.new("card", me)
    scene.collection.objects.link(ob)
    ob.location = cam.location - fwd * C["behind"]
    # the plane's normal is its +Z: face it toward him
    d = (cam.location + fwd * 2.0 - ob.location).normalized()
    ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    mat = bpy.data.materials.new("card")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (*srgb("#ffb38a"), 1)
    els[1].position, els[1].color = 1.0, (*srgb("#8a4dff"), 1)
    e = els.new(0.45)
    e.color = (*srgb("#ff8fd0"), 1)
    nt.links.new(tc.outputs["UV"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = C["strength"]
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    me.materials.append(mat)
    ob.visible_camera = False
    ob.visible_diffuse = False
    ob.visible_shadow = False
    ob.visible_transmission = False
    ob.visible_volume_scatter = False
    ob.visible_glossy = True
    return ob


def sunset_world(scene, strength):
    """The afterglow sky the lenses mirror and the shadows are filled from:
    violet ground, peach horizon, pink, lavender zenith. The film is
    transparent, so the camera never sees it."""
    world = bpy.data.worlds.new("afterglow")
    world.use_nodes = True
    wn = world.node_tree
    coord = wn.nodes.new("ShaderNodeTexCoord")
    sep = wn.nodes.new("ShaderNodeSeparateXYZ")
    ramp = wn.nodes.new("ShaderNodeValToRGB")
    stops = [(0.0, PAL["night"]), (0.46, PAL["ink"]), (0.5, "#ffb38a"), (0.56, "#ff8fb8"),
             (0.68, "#c98ae0"), (1.0, PAL["dusk"])]
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*srgb(stops[0][1]), 1)
    els[1].position, els[1].color = stops[-1][0], (*srgb(stops[-1][1]), 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = (*srgb(col), 1)
    remap = wn.nodes.new("ShaderNodeMapRange")
    remap.inputs["From Min"].default_value = -1.0
    remap.inputs["From Max"].default_value = 1.0
    wn.links.new(coord.outputs["Generated"], sep.inputs[0])
    wn.links.new(sep.outputs["Z"], remap.inputs["Value"])
    wn.links.new(remap.outputs["Result"], ramp.inputs["Fac"])
    bg = wn.nodes["Background"]
    wn.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    scene.world = world


# ------------------------------------------------------------------ Dante

def load_cats():
    """The cats generator and its base model. base.load resets the Blender
    session, so this runs before anything else is built."""
    sys.dont_write_bytecode = True   # never write into the cats worktree
    if CATS not in sys.path:
        sys.path.insert(0, CATS)
    import build_cats  # noqa: E402
    from cats import base  # noqa: E402

    return build_cats, base.load(base.ensure(None, fetch=False), log=log)


def place_dante(scene, cam, rig, quality, work, cats):
    """Builds Dante with the cats generator and sits him at the man's right
    shoulder, in front of it, paws on the bottom edge of the frame, his eyes
    on the lens."""
    build_cats, b = cats
    stage, suspects = build_cats.stage, build_cats.suspects
    spec = suspects.load("dante")
    # Where he goes: in front of the man's right shoulder by `forward`, his
    # centre at centre_x of the frame width, his floor on the bottom edge.
    _, shoulder, _ = bone_world(rig, "upperarm_r")
    right, up, fwd = cam_basis(cam)
    depth = (shoulder - cam.location).dot(fwd) - DANTE["forward"]
    floor_pt = point_on_frame(scene, cam, DANTE["centre_x"], DANTE["base_y"], depth)
    # facing the lens (horizontal), turned a little toward the man
    to_cam = cam.location - floor_pt
    to_cam.z = 0
    yaw = math.atan2(to_cam.x, -to_cam.y)          # angle of facing from -Y toward +X
    yaw += math.radians(DANTE["turn"])
    # cat space: faces -Y, floor z = 0, slot centre at the origin
    T = Matrix.Translation(floor_pt) @ Matrix.Rotation(yaw, 4, "Z")
    # the eyes look at our lens, given in cat space
    cam_in_cat = T.inverted() @ cam.location
    stage.lens_position = lambda: np.array(cam_in_cat[:])
    log("dante floor", tuple(round(c, 3) for c in floor_pt), "yaw", round(math.degrees(yaw), 1),
        "lens in cat space", tuple(round(c, 3) for c in cam_in_cat))
    # head up toward the lens (it sits about level with his eyes in the line-up)
    eye_h = 0.20
    up_angle = math.degrees(math.atan2(cam_in_cat.z - eye_h, math.hypot(cam_in_cat.x, cam_in_cat.y)))
    pose = dict(spec.pose)
    head = dict(pose.get("head", {}))
    head["pitch"] = head.get("pitch", 0.0) + 0.6 * up_angle
    pose["head"] = head
    spec.pose = pose
    cat = build_cats.build(b, spec, quality, work, log=log)
    empty = bpy.data.objects.new("Dante", None)
    scene.collection.objects.link(empty)
    empty.matrix_world = T
    for o in cat.objects:
        o.parent = empty
    bpy.context.view_layer.update()
    return empty, cat


def dante_eye_light(scene, cam, dante, cat):
    """His eyes sit under a furry brow, away from the side key: a small soft
    light by the lens, linked to his eyes only, lifts the ice-blue irises and
    puts a catchlight in them without touching anything else."""
    E = LIGHTS["dante_eyes"]
    eyes = [o for o in cat.objects if o.name.startswith(("Eye.", "Cornea."))]
    coll = bpy.data.collections.new("DanteEyes")
    for o in eyes:
        coll.objects.link(o)
    centre = sum((o.matrix_world.translation for o in eyes if o.name.startswith("Eye.")), Vector()) / 2
    right, up, fwd = cam_basis(cam)
    to_cam = (cam.location - centre).normalized()
    loc = centre + to_cam * E["dist"] + right * E["at"][0] + up * E["at"][1]
    ob = area(scene, "dante_eyes", E["colour"], E["energy"], E["size"], loc, centre)
    ob.light_linking.receiver_collection = coll
    return ob


def point_on_frame(scene, cam, fx, fy, depth):
    """World point at frame position (fx, fy from the bottom-left, 0..1) at
    `depth` metres along the lens axis."""
    cd = cam.data
    w, h = scene.render.resolution_x, scene.render.resolution_y
    sw = cd.sensor_width
    sh = sw * h / w
    # sensor coordinates (mm) including shift (in units of the larger side, mm)
    big = max(sw, sh)
    x = (fx - 0.5) * sw + cd.shift_x * big
    y = (fy - 0.5) * sh + cd.shift_y * big
    local = Vector((x / cd.lens * depth, y / cd.lens * depth, -depth))
    return cam.matrix_world @ local


# ------------------------------------------------------------------ render

def setup_render(scene, samples, threads, transparent=True):
    scene.render.engine = "CYCLES"
    c = scene.cycles
    c.device = "CPU"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = threads
    c.seed = 0
    c.use_animated_seed = False
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    c.denoising_prefilter = "ACCURATE"
    c.max_bounces = 12
    c.diffuse_bounces = 3
    c.glossy_bounces = 4
    c.transmission_bounces = 8
    # three HairShell meshes of four alpha-tested layers each, plus the
    # cat's fur: the default 8 draws black bands
    c.transparent_max_bounces = 64
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 3.0
    scene.cycles_curves.shape = "THICK"
    scene.cycles_curves.subdivisions = 2
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Khronos PBR Neutral"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.render.use_persistent_data = False


def lowest_y(scene, cam, ob, pts):
    """Lowest frame y (from the bottom, unclamped) of an object's points."""
    Tm = np.array(ob.matrix_world)
    return min(world_to_camera_view(scene, cam, Vector(p)).y for p in pts @ Tm[:3, :3].T + Tm[:3, 3])


def frame_box(scene, cam, points, margin=0.02):
    xs, ys = [], []
    for p in points:
        v = world_to_camera_view(scene, cam, Vector(p))
        xs.append(v.x)
        ys.append(v.y)
    return (max(0.0, min(xs) - margin), min(1.0, max(xs) + margin),
            max(0.0, min(ys) - margin), min(1.0, max(ys) + margin))


def report_frame(scene, cam, rig, glasses, meshes):
    """Where the landmarks land in the frame (x, y from the top-left, 0..1)."""
    out = {}
    def at(name, p):
        v = world_to_camera_view(scene, cam, p)
        out[name] = (round(v.x, 3), round(1 - v.y, 3), round(v.z, 3))
    _, h, t = bone_world(rig, "head")
    at("head_bone_base", h)
    at("head_bone_tip", t)
    for o in meshes:
        if o.name == "Earring":
            dg = bpy.context.evaluated_depsgraph_get()
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            c = sum((o.matrix_world @ v.co for v in me.vertices), Vector()) / len(me.vertices)
            ev.to_mesh_clear()
            at("earring", c)
    for o in glasses:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        c = sum(bb, Vector()) / 8
        at(f"glasses_{o.name}", c)
    for side in ("l", "r"):
        _, h, _ = bone_world(rig, f"upperarm_{side}")
        at(f"shoulder_{side}", h)
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--name", default="portrait")
    ap.add_argument("--res", type=int, default=400, help="width in pixels (height is 5/4 of it)")
    ap.add_argument("--samples", type=int, default=24)
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--dante", default="none", choices=("none", "clay", "test", "final"))
    ap.add_argument("--layer", default="all", choices=("all", "man", "dante"))
    ap.add_argument("--crop", default=None, help="face | dante | x0,x1,y0,y1 (render border, y from the bottom)")
    ap.add_argument("--set", action="append", default=[], help="SHOT/DANTE/LIGHTS override, e.g. SHOT.azimuth=30 or LIGHTS.key.energy=200")
    ap.add_argument("--blend", action="store_true")
    args = ap.parse_args(argv)
    for kv in args.set:
        key, val = kv.split("=", 1)
        parts = key.split(".")
        d = {"SHOT": SHOT, "DANTE": DANTE, "LIGHTS": LIGHTS}[parts[0]]
        for p in parts[1:-1]:
            d = d[p]
        d[parts[-1]] = json.loads(val)
    out = os.path.abspath(args.out)
    if out.startswith(REPO + os.sep):
        raise SystemExit("render outside the repo")
    os.makedirs(out, exist_ok=True)
    work = os.path.join(out, "work")
    os.makedirs(work, exist_ok=True)

    cats = load_cats() if args.dante != "none" else None
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rig, meshes, glasses = import_man()
    style_man(meshes)
    style_glasses(glasses)
    pose_man(rig)
    setup_render(scene, args.samples, args.threads)
    cam, pivot = camera_rig(scene, rig, args.res)
    light_rig(scene, cam, pivot)
    sunset_world(scene, LIGHTS["world"])
    reflection_card(scene, cam)
    rep = dict(frame=report_frame(scene, cam, rig, glasses, meshes), shot=SHOT, lights=LIGHTS, dante=DANTE)
    log("frame", json.dumps(rep["frame"]))

    dante = None
    if args.dante != "none":
        dante, cat = place_dante(scene, cam, rig, args.dante, work, cats)
        pts = np.concatenate([p.reshape(-1, 3) for p in cat.extra_points])[::5]

        def box_now():
            Tm = np.array(dante.matrix_world)
            return frame_box(scene, cam, pts @ Tm[:3, :3].T + Tm[:3, 3], margin=0.0)

        # paws on the bottom edge: lift or drop him (in the world, so he
        # stays upright) until his lowest point meets it
        _, up_c, fwd_c = cam_basis(cam)
        depth = (dante.matrix_world.translation - cam.location).dot(fwd_c)
        frame_h_there = depth * cam.data.sensor_width * 5 / 4 / cam.data.lens
        for _ in range(3):
            y0 = lowest_y(scene, cam, dante, pts)
            dante.location.z += (DANTE["base_y"] - y0) * frame_h_there
            bpy.context.view_layer.update()
        box = box_now()
        rep["dante_box"] = [round(x, 3) for x in box]
        rep["dante_lowest_y"] = round(lowest_y(scene, cam, dante, pts), 4)
        log("dante box (x0, x1, y0, y1 from the bottom)", rep["dante_box"])
        dante_eye_light(scene, cam, dante, cat)

    if args.layer == "man" and dante is not None:
        for o in dante.children:
            o.hide_render = True
    if args.layer == "dante":
        for o in meshes + glasses:
            o.is_holdout = True

    if args.crop:
        if args.crop == "face":
            v = world_to_camera_view(scene, cam, pivot)
            box = (v.x - 0.2, v.x + 0.2, v.y - 0.19, v.y + 0.17)
        elif args.crop == "dante":
            box = rep.get("dante_box", (0, 0.45, 0, 0.6))
        else:
            box = tuple(float(x) for x in args.crop.split(","))
        r = scene.render
        r.use_border = True
        r.use_crop_to_border = True
        r.border_min_x, r.border_max_x, r.border_min_y, r.border_max_y = box

    with open(os.path.join(out, f"{args.name}-report.json"), "w") as f:
        json.dump(rep, f, indent=1, default=str)
    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"{args.name}.blend"))
    scene.render.filepath = os.path.join(out, f"{args.name}.png")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    log(f"rendered {scene.render.filepath} in {time.time() - t:.1f}s")


if __name__ == "__main__":
    main()
