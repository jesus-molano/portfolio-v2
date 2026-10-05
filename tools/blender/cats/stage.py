"""The stage every suspect is shot on: one world, one light rig, one camera.

Colours come from src/design/tokens.ts (parsed by regex at build time; the
build stops if the palette cannot be read), so the cats follow any retune of
the site's palette.

Line-up rig (metres; the cat sits at the origin facing -Y, the floor is
z = 0, image right is +X):

- world: `night` at 0.25, so shadows are violet, never black;
- key: 0.8 m square area light at (-0.6, -2.0, 1.1) aimed at chest height,
  pale lavender (`text` with 15% `dusk`, saturation held under 0.12): the
  fix for the prototype's purple coats, so ginger, cream and white read true;
- rim: 0.25 x 0.6 m strip behind the cat at image right, `pink`, hot on fur
  silhouettes (the GTA VI neon edge); far enough behind that it draws an
  edge and does not wash the flank (long fur scatters it forward);
- kicker: the same strip behind at image left, `violet`, about half the rim;
- hair: a small light high behind, lavender, to part dark fur from the wall.

Every light renders into its own light group (key, rim, kicker, hair, world;
halo for Odin), so post can rebalance them without a re-render.

Camera: 135 mm on a 36 mm sensor, 3.2 m in front of the slot, level at
26 cm and never tilted, so verticals stay vertical and the height chart reads
true. The full frame covers 85 cm square; renders are cropped to the cat's
box with a render border, which is the same as shifting the lens. Resolution
is given in pixels per centimetre at the slot plane.

Close-up views (face, face34, profile, top, back) and the neutral "studio"
lights of the clay reviews are here too.
"""

import math
import os
import re

import numpy as np

import bpy
from mathutils import Matrix, Vector

from .vecmath import nrm, srgb

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
CAM_DIST = 3.2
CAM_HEIGHT = 0.26
LENS = 135.0
SENSOR = 36.0
FRAME_M = CAM_DIST * SENSOR / LENS  # width of the full frame at the slot plane


def tokens(path=None):
    """The palette of src/design/tokens.ts as {name: '#rrggbb'}."""
    path = path or os.path.join(REPO, "src", "design", "tokens.ts")
    src = open(path, encoding="utf-8").read()
    m = re.search(r"export const palette = \{(.*?)\} as const;", src, re.S)
    if not m:
        raise SystemExit(f"could not find the palette in {path}")
    pal = dict(re.findall(r'(\w+):\s*"(#[0-9a-fA-F]{6})"', m.group(1)))
    need = ("night", "dusk", "pink", "violet", "text", "amber", "sodium", "ink", "lilac")
    missing = [k for k in need if k not in pal]
    if missing:
        raise SystemExit(f"tokens.ts palette lacks {missing}")
    return pal


def desaturate(rgb, max_sat):
    """Linear RGB with its HSV saturation clamped to max_sat."""
    rgb = np.asarray(rgb, float)
    hi, lo = rgb.max(), rgb.min()
    if hi <= 0 or (hi - lo) / hi <= max_sat:
        return rgb
    target_lo = hi * (1 - max_sat)
    return hi - (hi - rgb) * (hi - target_lo) / (hi - lo)


def link(ob):
    """Link a stage object (camera or light of the rig); `clear` removes only these."""
    bpy.context.scene.collection.objects.link(ob)
    ob["stage"] = True
    return ob


def look_at(ob, target, up=(0, 0, 1.0)):
    d = nrm(np.asarray(target, float) - np.array(ob.location))
    z = -d
    x = np.cross(up, z)
    x = nrm(x) if np.linalg.norm(x) > 1e-6 else np.array([1.0, 0, 0])
    y = np.cross(z, x)
    M = np.eye(4)
    M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = x, y, z, ob.location
    ob.matrix_world = Matrix(M.tolist())


def area_light(name, loc, target, energy, rgb, size, size_y=None, group=None):
    li = bpy.data.lights.new(name, "AREA")
    li.energy = energy
    li.color = tuple(float(c) for c in rgb)
    if size_y:
        li.shape = "RECTANGLE"
        li.size, li.size_y = size, size_y
    else:
        li.shape = "SQUARE"
        li.size = size
    ob = link(bpy.data.objects.new(name, li))
    ob.location = loc
    look_at(ob, target)
    if group:
        ob.lightgroup = group
    return ob


def setup_render(quality, threads=3, samples=None, seed=0):
    """Cycles settings per quality: clay, test or final."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    c = sc.cycles
    c.device = "CPU"
    sc.render.threads_mode = "FIXED"
    sc.render.threads = threads
    c.seed = seed
    c.use_animated_seed = False
    c.use_adaptive_sampling = True
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    c.denoising_prefilter = "ACCURATE"
    preset = {"clay": (16, 0.05), "test": (48, 0.02), "final": (256, 0.01)}[quality]
    c.samples = samples or preset[0]
    c.adaptive_threshold = preset[1]
    c.adaptive_min_samples = min(64, c.samples) if quality == "final" else 0
    c.max_bounces = 12
    c.diffuse_bounces = 3
    c.glossy_bounces = 6
    c.transmission_bounces = 10
    c.transparent_max_bounces = 16
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 3.0
    sc.cycles_curves.shape = "THICK"
    sc.cycles_curves.subdivisions = 2
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.render.use_motion_blur = False


def world(pal, strength=0.25):
    w = bpy.data.worlds.new("Night")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*srgb(pal["night"]), 1)
    bg.inputs["Strength"].default_value = strength
    bpy.context.scene.world = w
    w.lightgroup = "world"
    return w


LIGHT_GROUPS = ("key", "rim", "kicker", "hair", "world", "halo")
KEY_POS = np.array([-0.6, -2.0, 1.1])
KEY_TARGET_Z = 0.2


def lineup_lights(pal, gains=None, target_z=KEY_TARGET_Z):
    """The shared rig (module doc). gains scales each light by name."""
    g = dict(key=1.0, rim=1.0, kicker=1.0, hair=1.0)
    g.update(gains or {})
    vl = bpy.context.view_layer
    for name in LIGHT_GROUPS:
        if name not in vl.lightgroups:
            vl.lightgroups.add(name=name)
    key = 0.85 * srgb(pal["text"]) + 0.15 * srgb(pal["dusk"])
    key = desaturate(key / key.max(), 0.12)
    tgt = (0, 0, target_z)
    # Energies are calibrated: the key alone lights an 18% grey card facing
    # it to about 0.2 (scene linear), so coats keep their own values; the rim
    # and kicker are small because fur scatters back light forward and glows.
    out = [
        area_light("Key", tuple(KEY_POS), tgt, 68.0 * g["key"], key, 0.8, group="key"),
        area_light("Rim", (0.6, 0.9, 0.6), (0, 0, target_z + 0.05), 3.2 * g["rim"],
                   srgb(pal["pink"]), 0.25, 0.6, group="rim"),
        area_light("Kicker", (-0.6, 0.9, 0.5), tgt, 1.5 * g["kicker"], srgb(pal["violet"]), 0.25, 0.6,
                   group="kicker"),
        area_light("Hair", (0.0, 0.45, 1.05), (0, 0, target_z + 0.12), 3.0 * g["hair"],
                   desaturate(srgb(pal["text"]) * 0.8 + srgb(pal["lilac"]) * 0.2, 0.15), 0.3, group="hair"),
    ]
    return out


def studio_lights(target, cam_loc):
    """Neutral grey light from the camera side, for clay shape reviews."""
    t = np.asarray(target, float)
    c = np.asarray(cam_loc, float)
    d = nrm(c - t)
    side = nrm(np.cross([0, 0, 1.0], d))
    dist = np.linalg.norm(c - t)
    r = min(dist, 2.0)
    k = (r / 2.0) ** 2  # the lights sit at up to 2 m: keep the irradiance constant
    area_light("StudioKey", t + (d * 0.8 - side * 0.9 + [0, 0, 0.9]) * r, t, 110.0 * k, (1, 1, 1), 1.0 * r / 2)
    area_light("StudioFill", t + (d * 1.0 + side * 1.0 + [0, 0, 0.2]) * r, t, 30.0 * k, (1, 1, 1), 1.5 * r / 2)
    area_light("StudioBack", t + (-d * 1.0 + [0, 0, 0.8]) * r, t, 40.0 * k, (1, 1, 1), 0.6 * r / 2)


def camera(name="Cam", lens=LENS):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = SENSOR
    cd.sensor_fit = "HORIZONTAL"
    ob = link(bpy.data.objects.new(name, cd))
    bpy.context.scene.camera = ob
    return ob


def lineup_camera():
    """The level line-up camera (module doc)."""
    cam = camera("Lineup")
    cam.location = (0.0, -CAM_DIST, CAM_HEIGHT)
    look_at(cam, (0.0, 0.0, CAM_HEIGHT))
    return cam


def lens_position():
    return np.array([0.0, -CAM_DIST, CAM_HEIGHT])


def frame_lineup(px_per_cm, box_points, margin=0.03):
    """Full-frame resolution for px_per_cm, render border cropped to the points.

    box_points: (N, 3) world points the crop must hold (the cat's skin, fur
    and whisker extremes); margin in metres at the slot plane.
    Returns the crop box in slot-plane metres (x0, x1, z0, z1).
    """
    sc = bpy.context.scene
    res = int(round(FRAME_M * 100 * px_per_cm))
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    P = np.asarray(box_points, float)
    # project to the slot plane through the camera centre
    cam = np.array([0.0, -CAM_DIST, CAM_HEIGHT])
    t = CAM_DIST / np.maximum(P[:, 1] + CAM_DIST, 1e-3)
    x = cam[0] + (P[:, 0] - cam[0]) * t
    z = cam[2] + (P[:, 2] - cam[2]) * t
    x0, x1 = x.min() - margin, x.max() + margin
    z0, z1 = max(z.min() - margin, CAM_HEIGHT - FRAME_M / 2), z.max() + margin

    def u(v):
        return np.clip(v / FRAME_M + 0.5, 0, 1)

    sc.render.use_border = True
    sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x = float(u(x0)), float(u(x1))
    sc.render.border_min_y = float(u(z0 - CAM_HEIGHT))
    sc.render.border_max_y = float(u(z1 - CAM_HEIGHT))
    return (x0, x1, z0, z1)


def orbit_camera(target, az, el, dist, lens=135.0, res=640):
    """A close-up camera orbiting a target. az 0 = from the front (-Y), + to image right."""
    sc = bpy.context.scene
    sc.render.use_border = False
    sc.render.resolution_x = sc.render.resolution_y = res
    a, e = math.radians(az), math.radians(el)
    d = np.array([math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)])
    cam = camera("Orbit", lens)
    cam.location = tuple(np.asarray(target) + d * dist)
    look_at(cam, target, up=(0, 0, 1.0) if abs(e) < 1.5 else (0, 1.0, 0))
    return cam


def clear():
    """Remove the stage's cameras and lights (not the cat's own, like the halo light)."""
    for ob in list(bpy.data.objects):
        if ob.get("stage"):
            bpy.data.objects.remove(ob)


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def vec(v):
    return Vector(tuple(float(x) for x in v))
