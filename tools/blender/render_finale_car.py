"""Render the hero's convertible for the finale's dawn plates.

The end credits open on the Afterglow cinema at dawn (tools/art/finale),
with the hero's car parked at the kerb. This renders that car from the real
model, public/models/poly-convertible/convertible.glb ("Convertible" by
Poly by Google, CC BY 3.0; the end credits carry the credit), dressed the
way the hero dresses it (src/features/hero/scene/Car.tsx): the atlas
colours, with only the masked paint tinted the hero's deep blue under a
clear coat.

- Parked: top down (it is a convertible), wheels straight, no driver,
  lamps off.
- Seen from the plate's own camera. Each view mirrors a dawn plate in
  tools/art/finale/build.mjs: its camera (lib.mjs `Cam`: level, looking
  down -z, lens shift) and the car's place on the street. The render is
  that camera cropped to the car, so the flank, the tyres and the ground
  line converge on the plate's vanishing point like the pavement does. The
  crop is cut on the plate's pixel grid at the plate's resolution: the
  build draws it 1:1.
- Lit for dawn: a warm low key from the street side (the sun is low over
  the right end of the street), the plate's dawn sky as the world (violet
  overhead, pink and peach at the horizon: the fill, and what the clear
  coat mirrors) and a soft pink rim from behind, the cinema's glow, along
  the bonnet, the windscreen and the rear deck. Key and rim light the car
  only (light linking): the street gets only the sky, so a shadow catcher
  bakes a soft contact shadow into the alpha, with no hard cast shadow to
  cut at the image's edge.
- Transparent background; the tyres stand on the street (z 0 here, the
  plate's street level, y -0.15).

Writes, per view, <out>/<view>.png (RGBA, straight alpha) and
<out>/<view>.json: the plate camera and car place it was rendered for, the
frame it covers on the plate (frame units), the same window in metres on
the car's centre plane around its ground centre, and the depth of the near
tyres' contact line (the wet street mirrors the car about it). build.mjs
embeds the PNG and refuses a render made for another camera or car place:
after moving the car or a dawn camera there, update VIEWS here and
re-render.

Deterministic: fixed seed and sample count, CPU only; the PNG is written
without metadata, so the same scene writes the same bytes.

Usage (Blender 4.5, or `pip install bpy==4.5.4` in a Python 3.11 venv; in
a sandbox set XDG_CONFIG_HOME to a temporary directory):
  python tools/blender/render_finale_car.py [--views dawn-wide,dawn-tall]
      [--samples 64] [--threads 2] [--preview] [--out tools/art/finale/car]
  blender -b -P tools/blender/render_finale_car.py -- [options]
--preview renders at half size with 16 samples (still denoised), into a
folder outside the repo unless --out names one: build.mjs refuses an image
smaller than the plate's pixel grid.
"""

import argparse
import json
import math
import os
import struct
import sys
import tempfile
import zlib

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL = os.path.join(ROOT, "public/models/poly-convertible/convertible.glb")

# The dawn plates (tools/art/finale/build.mjs PLATES): the plate camera in
# world metres and frame units, the car's centre on the street, and the
# plate's pixels per frame unit (encoded width / frame width).
VIEWS = {
    "dawn-wide": {
        "cam": {"x": 5.2, "y": 2.0, "z": 27, "f": 1000, "cx": 640, "cy": 470},
        "car": {"x": 0.73, "z": 7.2},
        "density": 2560 / 1280,
    },
    "dawn-tall": {
        "cam": {"x": 0, "y": 2.4, "z": 30, "f": 790, "cx": 202.5, "cy": 300},
        "car": {"x": 0, "z": 7.2},
        "density": 1080 / 405,
    },
}
# The street's height in the plates' world (the pavement is y 0, the kerb 0.15 m).
STREET = -0.15

# Car.tsx: the model is ~10 units long, scaled to a 4.5 m roadster.
MODEL_SCALE = 0.45
# Car.tsx PAINT: deep blue under a clear coat, mostly dielectric, no base
# coat reflection (the clear coat gives the highlights).
PAINT = {"color": "#173b9e", "metalness": 0.05, "roughness": 0.5, "coat_roughness": 0.05}
# Car.tsx: the tyres, and the glass's faint tint.
TYRE = "#1d1824"
GLASS = "#dfe8ff"

# Dawn light. Directions are in the car's frame (Blender axes: x along the
# plate's x, -y toward the plate's camera, z up); colours are sRGB.
KEY = {"from": (0.75, -0.6, 0.28), "color": "#ffb98f", "strength": 5.6, "angle": 6.0}
RIM = {"at": (-0.4, 4.2, 2.8), "size": (5.0, 1.6), "color": "#ff9fd2", "power": 900.0}
# The plate's dawn sky (cinema.mjs, the "sky" gradient), by elevation of the
# view direction from -1 (straight down) to 1 (straight up); below the
# horizon a dim violet street.
SKY = [
    (0.0, "#1c1230"),
    (0.47, "#3a2a5a"),
    (0.5, "#ffcfb2"),
    (0.54, "#ffbfa8"),
    (0.6, "#e39bbd"),
    (0.72, "#8a6cc4"),
    (0.86, "#3c3290"),
    (1.0, "#1a1250"),
]
SKY_STRENGTH = 1.0

# The window around the car: the ground this far past the car's footprint
# (metres) is in the image, and the contact shadow has faded out before it.
SHADOW_MARGIN = 0.55
# The contact shadow fades out from this far past the footprint to this far (metres).
SHADOW_FADE = (0.0, 0.45)
BORDER_ALPHA = 0.08
# The outermost pixels, faded to clear (finish_png).
FEATHER = 2
# Clear pixels around the car's silhouette, so the pixel filter's soft edge stays in the image.
PAD = 4


def srgb(hex_colour):
    """sRGB hex to linear RGB."""
    c = [int(hex_colour[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def to_blender(px, py, pz):
    """Plate frame (x right, y up, z toward the camera) to Blender (z up)."""
    return Vector((px, -pz, py))


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--views", default=",".join(VIEWS))
    parser.add_argument("--samples", type=int, default=64)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--out")
    args = parser.parse_args(argv)
    if args.out is None:
        # A preview never lands on the renders the plates embed.
        if args.preview:
            args.out = os.path.join(tempfile.gettempdir(), "finale-car-preview")
        else:
            args.out = os.path.join(ROOT, "tools/art/finale/car")
    args.views = [v for v in args.views.split(",") if v]
    unknown = [v for v in args.views if v not in VIEWS]
    if unknown:
        raise SystemExit(f"unknown views {unknown}; known: {list(VIEWS)}")
    return args


# --------------------------------------------------------------- materials
def atlas_tint(nt, image):
    """Atlas colour with the paint mask tinted (Car.tsx ATLAS_MASK_FRAGMENT).

    The atlas alpha is 1 to keep the colour, 0.5 on paint and 0.25 on lamps:
    paintMask = clamp(min((1 - a) * 2, (a - 0.25) * 4), 0, 1).
    """
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Linear"

    def math_node(op, a, b=None, clamp=False):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    a = tex.outputs["Alpha"]
    lo = math_node("MULTIPLY", math_node("SUBTRACT", 1.0, a), 2.0)
    hi = math_node("MULTIPLY", math_node("SUBTRACT", a, 0.25), 4.0)
    mask = math_node("MINIMUM", lo, hi, clamp=True)
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    nt.links.new(mask, tint.inputs["Factor"])
    tint.inputs["A"].default_value = (1, 1, 1, 1)
    tint.inputs["B"].default_value = (*srgb(PAINT["color"]), 1)
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(tex.outputs["Color"], mul.inputs["A"])
    nt.links.new(tint.outputs["Result"], mul.inputs["B"])
    return mul.outputs["Result"]


def principled(material):
    material.use_nodes = True
    nt = material.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return nt, bsdf


def dress(material, atlas):
    """Car.tsx's materials, by the names refine_convertible.py gives the faces."""
    name = material.name.split(".")[0]
    if name == "Glass":
        # A faint tint looking through, a mirror toward grazing angles.
        material.use_nodes = True
        nt = material.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        clear = nt.nodes.new("ShaderNodeBsdfTransparent")
        clear.inputs["Color"].default_value = (*srgb(GLASS), 1)
        gloss = nt.nodes.new("ShaderNodeBsdfGlossy")
        gloss.inputs["Roughness"].default_value = 0.03
        edge = nt.nodes.new("ShaderNodeLayerWeight")
        edge.inputs["Blend"].default_value = 0.15
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(edge.outputs["Fresnel"], mix.inputs["Fac"])
        nt.links.new(clear.outputs[0], mix.inputs[1])
        nt.links.new(gloss.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        return
    nt, bsdf = principled(material)
    if name == "Tyre":
        bsdf.inputs["Base Color"].default_value = (*srgb(TYRE), 1)
        bsdf.inputs["Roughness"].default_value = 0.92
        # Rubber's sheen, low: at full strength the sidewalls mirror the
        # bright dawn horizon all around and read brown, not black.
        bsdf.inputs["Specular IOR Level"].default_value = 0.15
        return
    nt.links.new(atlas_tint(nt, atlas), bsdf.inputs["Base Color"])
    if name == "Paint":
        bsdf.inputs["Metallic"].default_value = PAINT["metalness"]
        bsdf.inputs["Roughness"].default_value = PAINT["roughness"]
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
        bsdf.inputs["Coat Weight"].default_value = 1.0
        bsdf.inputs["Coat Roughness"].default_value = PAINT["coat_roughness"]
    elif name == "Rim":
        bsdf.inputs["Metallic"].default_value = 0.85
        bsdf.inputs["Roughness"].default_value = 0.25
    else:  # Trim: interior and underbody
        bsdf.inputs["Metallic"].default_value = 0.1
        bsdf.inputs["Roughness"].default_value = 0.7


# ------------------------------------------------------------------- scene
def load_car():
    """The hero's car, front to the plate's left, its ground centre at the origin."""
    bpy.ops.import_scene.gltf(filepath=MODEL)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    names = sorted(o.name for o in meshes)
    if names != ["body", "wheel_front_l", "wheel_front_r", "wheel_rear_l", "wheel_rear_r"]:
        raise SystemExit(f"unexpected objects in {MODEL}: {names}")
    for o in meshes:
        if any(abs(a) > 1e-6 for a in o.rotation_euler):
            raise SystemExit(f"{o.name} is turned: the wheels must be straight")
    atlas = next((i for i in bpy.data.images if i.size[0] > 0), None)
    if atlas is None:
        raise SystemExit("the atlas did not load")
    atlas.alpha_mode = "CHANNEL_PACKED"
    for m in bpy.data.materials:
        dress(m, atlas)
    # The model's front is -y: a quarter turn puts it at -x, the plate's
    # left, and shows the car's left flank to the camera.
    root = bpy.data.objects.new("car", None)
    bpy.context.scene.collection.objects.link(root)
    root.rotation_euler = (0, 0, -math.pi / 2)
    root.scale = (MODEL_SCALE,) * 3
    for o in meshes:
        o.parent = root
    bpy.context.view_layer.update()
    lo, hi = bounds(meshes)
    root.location = (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)
    bpy.context.view_layer.update()
    collection = bpy.data.collections.new("car")
    bpy.context.scene.collection.children.link(collection)
    for o in meshes:
        collection.objects.link(o)
    return meshes, collection


def vertices(objects):
    """World-space vertices of the objects, as an (n, 3) array."""
    out = []
    for o in objects:
        co = np.empty(len(o.data.vertices) * 3)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        m = np.array(o.matrix_world)
        out.append(co @ m[:3, :3].T + m[:3, 3])
    return np.concatenate(out)


def bounds(objects):
    v = vertices(objects)
    return Vector(v.min(axis=0)), Vector(v.max(axis=0))


def sky_world(scene):
    world = bpy.data.worlds.new("dawn")
    world.use_nodes = True
    nt = world.node_tree
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    remap = nt.nodes.new("ShaderNodeMapRange")
    remap.inputs["From Min"].default_value, remap.inputs["From Max"].default_value = -1.0, 1.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    elements = ramp.color_ramp.elements
    elements[0].position, elements[0].color = SKY[0][0], (*srgb(SKY[0][1]), 1)
    elements[1].position, elements[1].color = SKY[-1][0], (*srgb(SKY[-1][1]), 1)
    for position, colour in SKY[1:-1]:
        elements.new(position).color = (*srgb(colour), 1)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], remap.inputs["Value"])
    nt.links.new(remap.outputs["Result"], ramp.inputs["Fac"])
    background = nt.nodes["Background"]
    nt.links.new(ramp.outputs["Color"], background.inputs["Color"])
    background.inputs["Strength"].default_value = SKY_STRENGTH
    scene.world = world


def aim(obj, direction):
    """Point a light's -Z along `direction`."""
    obj.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()


def lights(scene, car):
    """Key and rim, linked to the car only: the street gets the sky alone."""
    key = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
    key.data.energy = KEY["strength"]
    key.data.color = srgb(KEY["color"])
    key.data.angle = math.radians(KEY["angle"])
    aim(key, -Vector(KEY["from"]).normalized())
    rim = bpy.data.objects.new("rim", bpy.data.lights.new("rim", "AREA"))
    rim.data.shape = "RECTANGLE"
    rim.data.size, rim.data.size_y = RIM["size"]
    rim.data.energy = RIM["power"]
    rim.data.color = srgb(RIM["color"])
    rim.location = RIM["at"]
    aim(rim, Vector((0, 0, 0.8)) - Vector(RIM["at"]))
    for light in (key, rim):
        scene.collection.objects.link(light)
        light.light_linking.receiver_collection = car


def street(scene, lo, hi):
    """The street under the car, a shadow catcher: it shows only the shadow.

    The low dawn sky lights the street from the horizon, which a car shades
    for metres around it. The catcher fades to clear past the car's
    footprint (SHADOW_FADE), so the baked shadow is a contact shadow that
    is gone well inside the image's edge.
    """
    m = SHADOW_MARGIN * 2
    bpy.ops.mesh.primitive_plane_add(size=1)
    plane = bpy.context.active_object
    plane.name = "street"
    plane.scale = (hi.x - lo.x + 2 * m, hi.y - lo.y + 2 * m, 1)
    plane.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0)
    plane.is_shadow_catcher = True
    material = bpy.data.materials.new("street")
    material.use_nodes = True
    nt = material.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    # Distance from the footprint (a box around the car's ground centre).
    position = nt.nodes.new("ShaderNodeNewGeometry").outputs["Position"]
    centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0))
    half = Vector(((hi.x - lo.x) / 2, (hi.y - lo.y) / 2, 1))
    offset = nt.nodes.new("ShaderNodeVectorMath")
    offset.operation = "SUBTRACT"
    nt.links.new(position, offset.inputs[0])
    offset.inputs[1].default_value = centre
    absolute = nt.nodes.new("ShaderNodeVectorMath")
    absolute.operation = "ABSOLUTE"
    nt.links.new(offset.outputs[0], absolute.inputs[0])
    outside = nt.nodes.new("ShaderNodeVectorMath")
    outside.operation = "SUBTRACT"
    nt.links.new(absolute.outputs[0], outside.inputs[0])
    outside.inputs[1].default_value = half
    clamped = nt.nodes.new("ShaderNodeVectorMath")
    clamped.operation = "MAXIMUM"
    nt.links.new(outside.outputs[0], clamped.inputs[0])
    clamped.inputs[1].default_value = (0, 0, 0)
    distance = nt.nodes.new("ShaderNodeVectorMath")
    distance.operation = "LENGTH"
    nt.links.new(clamped.outputs[0], distance.inputs[0])
    fade = nt.nodes.new("ShaderNodeMapRange")
    fade.interpolation_type = "SMOOTHSTEP"
    nt.links.new(distance.outputs["Value"], fade.inputs["Value"])
    fade.inputs["From Min"].default_value, fade.inputs["From Max"].default_value = SHADOW_FADE
    fade.inputs["To Min"].default_value, fade.inputs["To Max"].default_value = 1.0, 0.0
    ground = nt.nodes.new("ShaderNodeBsdfDiffuse")
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fade.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(ground.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    plane.data.materials.append(material)
    return plane


# ------------------------------------------------------------------ camera
def project(view, points):
    """Plate frame units of car-frame Blender points (lib.mjs Cam.p)."""
    cam, car = view["cam"], view["car"]
    px, pz, py = points[:, 0], -points[:, 1], points[:, 2]
    X, Y, Z = car["x"] + px, STREET + py, car["z"] + pz
    d = cam["z"] - Z
    return np.stack([cam["cx"] + cam["f"] * (X - cam["x"]) / d, cam["cy"] - cam["f"] * (Y - cam["y"]) / d], axis=1)


def frame_for(view, meshes, lo, hi):
    """The plate rectangle the image covers, on the plate's pixel grid."""
    m = SHADOW_MARGIN
    ground = np.array([[x, y, 0.0] for x in (lo.x - m, hi.x + m) for y in (lo.y - m, hi.y + m)])
    pts = project(view, np.concatenate([vertices(meshes), ground]))
    d = view["density"]
    x0, y0 = (np.floor(pts.min(axis=0) * d) - PAD) / d
    x1, y1 = (np.ceil(pts.max(axis=0) * d) + PAD) / d
    return float(x0), float(y0), float(x1), float(y1)


def camera_for(scene, view, frame):
    """The plate's camera (level, looking down the plate's -z), cropped to `frame`."""
    cam, car = view["cam"], view["car"]
    x0, y0, x1, y1 = frame
    w, h = x1 - x0, y1 - y0
    if h > w:
        raise SystemExit("the crop is taller than wide: the shift below assumes width is the larger side")
    data = bpy.data.cameras.new("plate")
    data.sensor_fit = "HORIZONTAL"
    data.sensor_width = 36.0
    data.lens = data.sensor_width * cam["f"] / w
    # Blender's shift is in units of the frame's larger side.
    data.shift_x = ((x0 + x1) / 2 - cam["cx"]) / w
    data.shift_y = (cam["cy"] - (y0 + y1) / 2) / w
    data.clip_start, data.clip_end = 0.5, 200
    obj = bpy.data.objects.new("plate", data)
    obj.location = to_blender(cam["x"] - car["x"], cam["y"] - STREET, cam["z"] - car["z"])
    obj.rotation_euler = (math.pi / 2, 0, 0)  # level, looking along +y (the plate's -z)
    scene.collection.objects.link(obj)
    scene.camera = obj
    return obj


def check_camera(scene, camera, view, frame, meshes):
    """Blender's projection must agree with the plate's (lib.mjs Cam.p)."""
    bpy.context.view_layer.update()
    x0, y0, x1, y1 = frame
    pts = vertices(meshes)[::97]
    plate = project(view, pts)
    for p, q in zip(pts, plate):
        ndc = world_to_camera_view(scene, camera, Vector(p))
        sx, sy = x0 + ndc.x * (x1 - x0), y1 - ndc.y * (y1 - y0)
        if abs(sx - q[0]) > 0.02 or abs(sy - q[1]) > 0.02:
            raise SystemExit(f"camera mismatch at {tuple(p)}: blender {sx:.3f},{sy:.3f} plate {q[0]:.3f},{q[1]:.3f}")


# ------------------------------------------------------------------ render
def setup_render(scene, args):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16 if args.preview else args.samples
    scene.cycles.seed = 0
    scene.cycles.use_animated_seed = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    scene.cycles.max_bounces = 8
    scene.cycles.transparent_max_bounces = 16
    scene.render.threads_mode = "FIXED"
    scene.render.threads = args.threads
    scene.render.film_transparent = True
    scene.render.use_persistent_data = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 100
    # No stamped metadata (date, render time, host): the same input writes the same file.
    for prop in dir(scene.render):
        if prop.startswith("use_stamp"):
            setattr(scene.render, prop, False)
    scene.view_settings.view_transform = "Khronos PBR Neutral"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1


def read_png(path):
    """An 8-bit RGBA PNG Blender wrote, as a (h, w, 4) uint8 array, top row first."""
    image = bpy.data.images.load(path)
    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)  # the stored bytes / 255, straight alpha, bottom row first
    bpy.data.images.remove(image)
    return np.round(px.reshape(h, w, 4)[::-1] * 255).astype(np.uint8)


def write_png(path, rgba):
    """A plain RGBA PNG: no metadata, fixed compression, so the same pixels write the same bytes."""
    h, w, _ = rgba.shape
    rows = rgba.reshape(h, w * 4).astype(np.int16)
    # Per row, the smaller of the None, Sub and Up filters (by sum of absolute residuals).
    none = rows
    sub = rows - np.pad(rows, ((0, 0), (4, 0)))[:, :-4]
    up = rows - np.pad(rows, ((1, 0), (0, 0)))[:-1]
    options = np.stack([none, sub, up]) % 256
    cost = np.minimum(options, 256 - options).sum(axis=2)
    choice = cost.argmin(axis=0)
    data = b"".join(bytes([int(c)]) + options[c, y].astype(np.uint8).tobytes() for y, c in enumerate(choice))

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
        fh.write(chunk(b"IDAT", zlib.compress(data, 9)))
        fh.write(chunk(b"IEND", b""))


def finish_png(path):
    """Fade the outermost pixels to clear, so the image has no seam on the plate.

    Only denoiser speckle and the last of the shadow reach that far; more
    than BORDER_ALPHA there means the shadow or the car is cut by the frame.
    """
    rgba = read_png(path)
    h, w, _ = rgba.shape
    alpha = rgba[..., 3].astype(np.float32) / 255
    ring = FEATHER
    edge = max(alpha[:ring].max(), alpha[-ring:].max(), alpha[:, :ring].max(), alpha[:, -ring:].max())
    if edge > BORDER_ALPHA:
        raise SystemExit(f"{path}: alpha {edge:.3f} at the border: widen SHADOW_MARGIN or PAD")
    y, x = np.mgrid[0:h, 0:w]
    inset = np.minimum(np.minimum(x, w - 1 - x), np.minimum(y, h - 1 - y)).astype(np.float32)
    alpha *= np.clip(inset / ring, 0, 1)
    rgba[..., 3] = np.round(alpha * 255).astype(np.uint8)
    write_png(path, rgba)
    return float(edge), (w, h)


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    meshes, collection = load_car()
    lo, hi = bounds(meshes)
    sky_world(scene)
    lights(scene, collection)
    street(scene, lo, hi)
    setup_render(scene, args)
    wheels = {o.name: o for o in meshes if o.name.startswith("wheel_")}
    # The near tyres (the car's left side) touch the street on the plate's
    # z = car z + this: the line the wet street mirrors the car about.
    front, rear = (wheels[n].matrix_world.translation.y for n in ("wheel_front_l", "wheel_rear_l"))
    if abs(front - rear) > 1e-3:
        raise SystemExit("the near tyres are not on one line")
    contact_z = float(-front)
    for name in args.views:
        view = VIEWS[name]
        frame = frame_for(view, meshes, lo, hi)
        x0, y0, x1, y1 = frame
        d = view["density"]
        size = (round((x1 - x0) * d), round((y1 - y0) * d))
        scene.render.resolution_x, scene.render.resolution_y = size
        scene.render.resolution_percentage = 50 if args.preview else 100
        camera = camera_for(scene, view, frame)
        check_camera(scene, camera, view, frame, meshes)
        path = os.path.join(args.out, f"{name}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        edge, written = finish_png(path)
        # The same frame as a window in metres on the car's centre plane
        # (plate z = car z), around the car's ground centre.
        cam, car = view["cam"], view["car"]
        depth = cam["z"] - car["z"]
        window = {
            "x0": (x0 - cam["cx"]) * depth / cam["f"] + cam["x"] - car["x"],
            "x1": (x1 - cam["cx"]) * depth / cam["f"] + cam["x"] - car["x"],
            "y0": (cam["cy"] - y1) * depth / cam["f"] + cam["y"] - STREET,
            "y1": (cam["cy"] - y0) * depth / cam["f"] + cam["y"] - STREET,
        }
        meta = {
            "about": "Render of public/models/poly-convertible/convertible.glb by tools/blender/render_finale_car.py; do not edit.",
            "plate": name,
            "cam": cam,
            "car": car,
            "street": STREET,
            "density": d,
            "size": list(written),
            "frame": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0},
            "window": {k: round(v, 6) for k, v in window.items()},
            "contactZ": round(contact_z, 6),
            "length": round(hi.x - lo.x, 4),
            "samples": scene.cycles.samples,
        }
        with open(os.path.join(args.out, f"{name}.json"), "w") as fh:
            json.dump(meta, fh, indent=2)
            fh.write("\n")
        bpy.data.objects.remove(camera)
        print(f"rendered {path} {written[0]}x{written[1]} frame {frame} border alpha {edge:.4f}")


if __name__ == "__main__":
    main()
