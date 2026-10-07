"""THE USUAL SUSPECTS select: Jesús, player 1, kneeling in the line-up.

The fifth slot of the character select is him: the hero's driver model
(public/models/makehuman-driver/driver.glb: body, striped tee, jeans,
earring, crew cut, beard and moustache) with his gold aviators
(public/models/sunglasses/aviator.glb), looked and dressed as in the STATS
portrait (`build_stats_portrait.py`: skin, tee, hair shells, earring and
lenses), here on one knee so he takes less height on the chart:

- his right knee on the floor, the shin back along it, the toes tucked
  under; his left foot planted ahead, that knee up; the trunk leaning
  over it, his left forearm laid across the raised knee (lowered onto the
  jeans until it rests there, `rest_forearm`), the forearm turned palm
  down and the hand let go at the wrist: it hangs off the knee in line
  with the forearm, the fingers together and loosely curled; the right
  arm loose at his side, the palm to his thigh, the hand in line; the
  head level, facing the lens like the cats; the whole figure turned a
  little toward the cats (POSE). The legs and arms are set with two-bone
  IK in his own rig, forearms turned for the palm before the wrist flexes
  (never the hand on its own), each finger closing about one axis;
- the tee's neck rib repainted crisp in the stripes' navy (COLLAR: the
  texture's blurred maroon band read as a magenta ring round his neck at
  this size) and the jeans' crotch relaxed after the pose (CROTCH);
- trainers (SHOES): the model is barefoot under the jeans. The MakeHuman
  system shoes (CC0) are not installed here and the community ones are
  never used, so they are made here: lofted round each foot's own skin
  (the weights, and so the pose, are the foot's), a white rubber sole wall
  over a dark tread line, a near-black canvas upper with off-white bar
  laces across the instep, rounded off at the toe and the heel (each end
  closes on itself, no seam), the collar up under the jeans' hem;
- at his true size on the chart, with the cats (one scale for all five:
  24 image pixels to the real centimetre, he kneeling at about 1.2 m, the
  cats 27 to 39 cm). The cats' stage is built round a 40 cm subject (the
  camera 3.2 m off and 26 cm up, a frame 85 cm wide, the lights a metre or
  two away), so he is shot as they are, scaled: built at full size, the
  whole rig object is scaled by 1 / `MINIATURE` (3) and photographed by
  the cats' own camera, lights and contact shadow at `MINIATURE` times
  their pixel density (render_interlude.py). That is the cats' photograph
  of him with everything three times as far (the lens 9.6 m off at 78 cm,
  his chest), the same perspective and light on him as on them, and the
  same pixels per real centimetre. The skin's subsurface radius and pore
  bump, millimetre-scale looks, are scaled with him.

`build()` returns what render_interlude.py needs: the objects, points that
bound him (for the crop), his floor contact (the front shoe's sole, the
lowest in the picture), his head's width across the cheeks and a report
(heights in real centimetres).

Deterministic: no random draws; the inputs are read, never written.
"""

import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import build_stats_portrait as portrait  # noqa: E402

MINIATURE = 3  # built as a 1:3 miniature, shot at 3x the pixel density: his true size in the picture

# Every number of the pose in one place (metres in his own frame at full
# size, facing -Y like the cats, +X his left = image right; degrees).
POSE = dict(
    hips_z=0.448,              # hip joints over the floor (the kneeling thigh nearly upright, the knee down)
    hips_y=0.02,               # and a little behind the rest stance
    # right leg (image left): the knee down, the shin back along the floor, toes tucked
    knee_r=(-0.165, 0.10, 0.072),
    ankle_r=(-0.175, 0.535, 0.14),
    ball_r=(-0.175, 0.605, 0.016),
    toe_r=(-0.172, 0.745, 0.012),
    # left leg (image right): foot planted ahead, shin upright, knee up
    knee_l=(0.215, -0.392, 0.512),
    ankle_l=(0.22, -0.392, 0.073),
    foot_turn=12.0,            # the planted foot turned out (degrees about Z)
    lean=36.0,                 # trunk forward over spine_01..03 (degrees): leaning on the knee
    lean_share=(0.25, 0.3, 0.45),
    twist=-6.0,                # trunk turned toward the raised knee (+ to image right)
    shoulder_drop=6.0,         # relaxed shoulders
    # his left forearm across the raised knee: the elbow out past the
    # thigh, the forearm laid over the kneecap (its underside on the jeans,
    # `forearm_gap` over the jeans: `rest_forearm` lowers the wrist until it
    # is) and the wrist just past the kneecap's front, relative to the knee
    # joint (before that drop); the forearm turned palm down,
    # then the wrist let go: the hand hangs off the knee in line with the
    # forearm, bent only at the wrist (`flex_l`), toward the palm
    wrist_l=(-0.06, -0.045, 0.14),
    elbow_pole_l=(1.0, 0.2, -0.7),
    palm_l=(0.0, 0.25, -1.0),
    forearm_gap=0.004,
    flex_l=48.0,
    deviate_l=6.0,             # a touch of ulnar drift (toward the little finger), as a loose hand falls
    # his right arm loose at his side, a soft bend, the palm to his thigh,
    # the hand in line with the forearm (a few degrees of easy flexion)
    wrist_r=(-0.255, -0.15, 0.38),
    elbow_pole_r=(-0.35, 1.0, 0.0),
    palm_r=(1.0, 0.15, 0.0),
    flex_r=12.0,
    deviate_r=0.0,
    # fingers: a relaxed hand, the fingers together (`gather`: the share of
    # their spread taken out, about the palm's normal) and loosely curled,
    # each a little more than the one before it toward the little finger
    # (MCP, PIP, DIP in degrees, then the extra per finger); the thumb
    # brought in beside the index and barely bent
    gather=0.75,
    curl_l=(12.0, 20.0, 6.0),
    curl_l_step=4.0,
    thumb_in_l=0.35,
    thumb_curl_l=(0.0, 8.0, 10.0),
    curl_r=(10.0, 18.0, 9.0),
    curl_r_step=4.0,
    thumb_in_r=0.5,
    thumb_curl_r=(0.0, 6.0, 8.0),
    # head level at the lens (cancels the lean), a slight easy tilt
    head_pitch=0.0,
    head_roll=-3.0,
    head_yaw=14.0,             # back toward the lens after the trunk's twist and the body's turn
    neck_share=0.5,
    body_yaw=-14.0,            # the whole figure turned a little to camera-left (toward the cats)
)

# The tee's neck rib (clean_collar): in the clothes' texture (1024 px for the
# whole outfit, about 7 px to the centimetre of the tee) it is a 4 px maroon
# band blurred into the stripes over a pinkish grey, against the black
# outside the UV island. Shot at 24 px to the centimetre that magnifies into
# a soft magenta ring round his neck, a stain more than a collar. It is
# repainted in the stripes' own navy, crisp, at `upscale` times the
# texture's resolution: every pixel in the top `rows` of the texture redder
# than `redness` (the rib and its blur), grown by `grow` pixels into what is
# not white (the transition, the black past the island's edge).
COLLAR = dict(upscale=2, rows=0.1, redness=12 / 255, grow=3, white=0.6)

# The jeans' crotch, relaxed after the pose (smooth_crotch): a ball between
# the thigh joints, lowered and brought forward to the fly, full strength
# within `core`, nothing past `radius` (metres, full size).
CROTCH = dict(offset=(0.0, -0.06, -0.06), core=0.05, radius=0.12, factor=0.6, iterations=6)

SHOES = dict(
    top_z=0.1,                 # the foot's skin under this height (rest pose) is what the shoe wraps
    offset=0.006,              # the upper stands this far off the skin
    sole=0.02,                # the sole under the foot (the figure stands on it)
    heel_out=0.012,            # the shoe past the heel and the toes
    toe_out=0.014,
    collar=0.088,              # the collar height behind the instep: up under the jeans' hem, no gap at the ankle
    instep=0.42,               # share of the foot from the heel the collar holds
    rings=30,
    crown=3.0,                 # superellipse exponents of the upper's cross-section: sides (2 round, more boxy)
    crown_top=2.2,             # and top
    upper_points=14,
    sole_flare=1.05,           # the sole a little wider than the upper
    band=0.027,                # height of the white sole band from the bottom
    outsole_h=0.004,           # the dark tread line under it
    upper="#1b1820",           # near-black canvas
    sole_colour="#ece7df",     # off-white rubber
    outsole="#3a3540",         # the thin tread line at the very bottom
    # bar laces across the instep, in the sole's off-white: they make it a
    # trainer (without them the plain upper read as a slip-on clog)
    laces=dict(count=5, start=0.47, end=0.74, half=0.62, radius=0.0023, lift=0.0024),
)


def log(*a):
    print("[man]", *a, flush=True)


# ------------------------------------------------------------------ bones in the armature's frame

def head_tail(rig, name):
    pb = rig.pose.bones[name]
    return Vector(pb.head), Vector(pb.tail)


def rotate(rig, name, R, pivot=None):
    """Turn a pose bone (and its children) by a 3x3 rotation in armature space about its head."""
    pb = rig.pose.bones[name]
    m = pb.matrix.copy()
    p = Vector(pb.head) if pivot is None else Vector(pivot)
    pb.matrix = Matrix.Translation(p) @ R.to_4x4() @ Matrix.Translation(-p) @ m
    bpy.context.view_layer.update()


def aim(rig, name, direction):
    h, t = head_tail(rig, name)
    d0 = (t - h).normalized()
    rotate(rig, name, d0.rotation_difference(Vector(direction).normalized()).to_matrix())


def reach(rig, name, point):
    h, _ = head_tail(rig, name)
    aim(rig, name, Vector(point) - h)


def two_bone(rig, upper, lower, target, pole):
    """Upper and lower bone so the lower's tail meets target, the bend toward pole."""
    A, B = head_tail(rig, upper)
    _, C = head_tail(rig, lower)
    a, b = (B - A).length, (C - B).length
    T = Vector(target)
    d = min(max((T - A).length, abs(a - b) + 1e-4), a + b - 1e-4)
    u = (T - A).normalized()
    w = Vector(pole)
    w = (w - u * w.dot(u)).normalized()
    x = (a * a - b * b + d * d) / (2 * d)
    elbow = A + u * x + w * math.sqrt(max(a * a - x * x, 0.0))
    reach(rig, upper, elbow)
    reach(rig, lower, T)


def palm_normal(rig, side):
    """The palm's normal from the knuckles (index, pinky) and the hand's axis."""
    h, _ = head_tail(rig, f"hand_{side}")
    i1, _ = head_tail(rig, f"index_01_{side}")
    p1, _ = head_tail(rig, f"pinky_01_{side}")
    m1, _ = head_tail(rig, f"middle_01_{side}")
    across = (i1 - p1).normalized()
    along = (m1 - h).normalized()
    n = along.cross(across) if side == "l" else across.cross(along)
    return n.normalized()


def turn_palm(rig, side, want):
    """Twist the forearm about its own axis so the palm faces `want` (as near as it can)."""
    h, t = head_tail(rig, f"lowerarm_{side}")
    ax = (t - h).normalized()
    n = palm_normal(rig, side)
    w = Vector(want).normalized()
    n_p = (n - ax * n.dot(ax)).normalized()
    w_p = (w - ax * w.dot(ax)).normalized()
    ang = math.atan2(ax.dot(n_p.cross(w_p)), n_p.dot(w_p))
    rotate(rig, f"lowerarm_{side}", Matrix.Rotation(ang, 3, ax))


def flex_wrist(rig, side, flex, deviate=0.0):
    """The hand in line with the forearm, then bent at the wrist only.

    `flex` degrees toward the palm (a hand hanging off a knee), `deviate`
    toward the little finger: about the axes the knuckles give (`palm_normal`),
    never an aim of the hand on its own.
    """
    h, t = head_tail(rig, f"lowerarm_{side}")
    aim(rig, f"hand_{side}", t - h)
    hh, ht = head_tail(rig, f"hand_{side}")
    d = (ht - hh).normalized()
    n = palm_normal(rig, side)
    rotate(rig, f"hand_{side}", Matrix.Rotation(math.radians(flex), 3, d.cross(n).normalized()))
    if deviate:
        hh, ht = head_tail(rig, f"hand_{side}")
        d = (ht - hh).normalized()
        i1, _ = head_tail(rig, f"index_01_{side}")
        p1, _ = head_tail(rig, f"pinky_01_{side}")
        toward = (p1 - i1).normalized()      # across the knuckles, to the little finger
        rotate(rig, f"hand_{side}", Matrix.Rotation(math.radians(deviate), 3, d.cross(toward).normalized()))


def gather_fingers(rig, side, share, thumb_in):
    """A relaxed hand: the fingers drawn together toward the middle finger, the thumb toward the index.

    Each finger's first bone turns about the palm's normal by `share` of its
    angle from the middle finger (so it stays in the palm's plane); the thumb
    turns `thumb_in` of the way toward the index's first bone.
    """
    n = palm_normal(rig, side)
    mh, mt = head_tail(rig, f"middle_01_{side}")
    dm = (mt - mh).normalized()
    dm_p = (dm - n * dm.dot(n)).normalized()
    for finger in ("index", "ring", "pinky"):
        h, t = head_tail(rig, f"{finger}_01_{side}")
        d = (t - h).normalized()
        d_p = (d - n * d.dot(n)).normalized()
        ang = math.atan2(n.dot(d_p.cross(dm_p)), d_p.dot(dm_p))
        rotate(rig, f"{finger}_01_{side}", Matrix.Rotation(ang * share, 3, n))
    ih, it = head_tail(rig, f"index_01_{side}")
    th, tt = head_tail(rig, f"thumb_01_{side}")
    d = (tt - th).normalized()
    want = d.lerp((it - ih).normalized(), thumb_in).normalized()
    rotate(rig, f"thumb_01_{side}", d.rotation_difference(want).to_matrix())


def curl_fingers(rig, side, curl, thumb, step=0.0):
    """Each finger closes toward the palm about one axis (across the knuckles).

    `curl` per joint for the index, `step` more per joint for each finger
    after it (a relaxed hand curls more toward the little finger).
    """
    n = palm_normal(rig, side)
    for i, finger in enumerate(("index", "middle", "ring", "pinky", "thumb")):
        angles = thumb if finger == "thumb" else [a + step * i for a in curl]
        for k, ang in zip((1, 2, 3), angles):
            name = f"{finger}_0{k}_{side}"
            h, t = head_tail(rig, name)
            d = (t - h).normalized()
            axis = d.cross(n).normalized()   # turning d toward n
            rotate(rig, name, Matrix.Rotation(math.radians(ang), 3, axis))


def pose(rig, drop=0.0):
    """The kneel, every bone from the rest pose; `drop` lowers his left wrist (rest_forearm)."""
    P = POSE
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    bpy.context.view_layer.update()
    # the hips down to the kneel
    hl, _ = head_tail(rig, "thigh_l")
    hr, _ = head_tail(rig, "thigh_r")
    mid = (hl + hr) / 2
    pb = rig.pose.bones["pelvis"]
    pb.matrix = Matrix.Translation(Vector((0, P["hips_y"] - mid.y, P["hips_z"] - mid.z))) @ pb.matrix
    bpy.context.view_layer.update()
    # legs
    reach(rig, "thigh_r", P["knee_r"])
    reach(rig, "calf_r", P["ankle_r"])
    reach(rig, "foot_r", P["ball_r"])
    reach(rig, "ball_r", P["toe_r"])
    reach(rig, "thigh_l", P["knee_l"])
    reach(rig, "calf_l", P["ankle_l"])
    # the planted foot: its rest direction, turned out a little, flat
    rz = Matrix.Rotation(math.radians(P["foot_turn"]), 3, "Z")
    for name, rest_dir in (("foot_l", (0.003, -0.128, -0.063)), ("ball_l", (-0.008, -0.142, 0.011))):
        aim(rig, name, rz @ Vector(rest_dir))
    # trunk: lean forward and turn toward the raised knee
    for name, k in zip(("spine_01", "spine_02", "spine_03"), P["lean_share"]):
        rotate(rig, name, Matrix.Rotation(math.radians(P["lean"] * k), 3, "X"))
        rotate(rig, name, Matrix.Rotation(math.radians(P["twist"] * k), 3, "Z"))
    for side, axis in (("l", Vector((0, 1, 0))), ("r", Vector((0, -1, 0)))):
        rotate(rig, f"clavicle_{side}", Matrix.Rotation(math.radians(P["shoulder_drop"]), 3, axis))
    # arms: the forearm turns the palm, then the wrist flexes (never the hand on its own)
    knee = Vector(P["knee_l"])
    two_bone(rig, "upperarm_l", "lowerarm_l", knee + Vector(P["wrist_l"]) - Vector((0, 0, drop)),
             P["elbow_pole_l"])
    two_bone(rig, "upperarm_r", "lowerarm_r", P["wrist_r"], P["elbow_pole_r"])
    for side in ("l", "r"):
        turn_palm(rig, side, P[f"palm_{side}"])
        flex_wrist(rig, side, P[f"flex_{side}"], P[f"deviate_{side}"])
        gather_fingers(rig, side, P["gather"], P[f"thumb_in_{side}"])
        curl_fingers(rig, side, P[f"curl_{side}"], P[f"thumb_curl_{side}"], P[f"curl_{side}_step"])
    # head: level at the lens whatever the trunk did
    share = {"neck_01": P["neck_share"], "head": 1.0 - P["neck_share"]}
    for name in ("neck_01", "head"):
        h, t = head_tail(rig, "head")
        up = (t - h).normalized()
        # the pitch that would make the head upright again, shared down the neck
        pitch = math.degrees(math.atan2(-up.y, up.z)) * -1.0
        k = share[name] if name == "neck_01" else 1.0
        rotate(rig, name, Matrix.Rotation(math.radians(pitch * k), 3, "X"))
    # the face's own turn and tilt
    rotate(rig, "head", Matrix.Rotation(math.radians(P["head_pitch"]), 3, "X"))
    rotate(rig, "head", Matrix.Rotation(math.radians(P["head_yaw"]), 3, "Z"))
    rotate(rig, "head", Matrix.Rotation(math.radians(P["head_roll"]), 3, "Y"))


# ------------------------------------------------------------------ trainers

def srgb(hex_):
    return portrait.srgb(hex_)


def shoe_material():
    mat = bpy.data.materials.new("Trainers")
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "va_sole"     # 0 upper, 1 sole band, 2 outsole line
    lo = nt.nodes.new("ShaderNodeMapRange")
    lo.inputs["From Min"].default_value = 0.5
    lo.inputs["From Max"].default_value = 0.6
    hi = nt.nodes.new("ShaderNodeMapRange")
    hi.inputs["From Min"].default_value = 1.5
    hi.inputs["From Max"].default_value = 1.6
    m1 = nt.nodes.new("ShaderNodeMix")
    m1.data_type = "RGBA"
    m1.inputs[6].default_value = (*srgb(SHOES["upper"]), 1)
    m1.inputs[7].default_value = (*srgb(SHOES["sole_colour"]), 1)
    m2 = nt.nodes.new("ShaderNodeMix")
    m2.data_type = "RGBA"
    m2.inputs[7].default_value = (*srgb(SHOES["outsole"]), 1)
    nt.links.new(attr.outputs["Fac"], lo.inputs["Value"])
    nt.links.new(attr.outputs["Fac"], hi.inputs["Value"])
    nt.links.new(lo.outputs["Result"], m1.inputs[0])
    nt.links.new(m1.outputs[2], m2.inputs[6])
    nt.links.new(hi.outputs["Result"], m2.inputs[0])
    nt.links.new(m2.outputs[2], b.inputs["Base Color"])
    # canvas upper, rubber sole: rough, the sole a little less
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.78
    rough.inputs["To Max"].default_value = 0.55
    nt.links.new(lo.outputs["Result"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
    b.inputs["Sheen Weight"].default_value = 0.3
    b.inputs["Sheen Roughness"].default_value = 0.5
    # a fine canvas weave in the bump
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 900.0
    noise.inputs["Detail"].default_value = 2.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    bump.inputs["Distance"].default_value = 0.0003
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return mat


def make_trainers(body):
    """Both trainers: {'l': object, 'r': object}."""
    return {side: make_trainer(body, side) for side in ("l", "r")}


def make_trainer(body, side):
    """A trainer for one foot, lofted round the foot's skin (rest pose), skinned like it.

    Rings across the foot from heel to toe: each ring is the foot's width
    and instep height there (from its skin) plus `offset`, over a flat sole
    `sole` under the foot, its sides boxy and its top round (a superellipse),
    rounded off at the heel and the toe; the collar is held under `collar`
    behind the instep, where the leg comes out. Every vertex takes the
    weights of the nearest foot vertex, so the shoe bends with the foot.
    """
    from mathutils import kdtree

    S = SHOES
    me = body.data
    names = {g.index: g.name for g in body.vertex_groups}
    nv = len(me.vertices)
    co = np.array([v.co[:] for v in me.vertices])
    foot_w = np.zeros(nv)
    for v in me.vertices:
        for g in v.groups:
            if names[g.group] in (f"foot_{side}", f"ball_{side}"):
                foot_w[v.index] += g.weight
    sel = (foot_w > 0.3) & (co[:, 2] < S["top_z"])
    F = co[sel]
    idx = np.where(sel)[0]
    y_heel, y_toe = F[:, 1].max(), F[:, 1].min()
    zb = F[:, 2].min() - S["sole"]
    n = S["rings"]
    ys = np.linspace(y_heel + S["heel_out"], y_toe - S["toe_out"], n)
    cx, hw, top = np.zeros(n), np.zeros(n), np.zeros(n)
    for i, y in enumerate(ys):
        m = np.abs(F[:, 1] - np.clip(y, y_toe + 0.01, y_heel - 0.01)) < 0.012
        cx[i] = 0.5 * (F[m, 0].min() + F[m, 0].max())
        hw[i] = 0.5 * (F[m, 0].max() - F[m, 0].min()) + S["offset"]
        top[i] = F[m, 2].max() + S["offset"]
    k = np.array([1, 2, 3, 2, 1], float)
    k /= k.sum()

    def smooth(a):
        return np.convolve(np.pad(a, 2, mode="edge"), k, mode="valid")

    cx, hw, top = smooth(cx), smooth(hw), smooth(top)
    # the collar behind the instep, the toe box's height toward the tip
    u = (y_heel - ys) / (y_heel - y_toe)     # 0 at the heel, 1 at the toe
    top = np.where(u < S["instep"], np.minimum(top, S["collar"]), top)
    top = smooth(top)
    # round off the ends: the heel over its last 2 cm, the toe over 4 cm
    d_heel = np.clip((ys - (y_heel + S["heel_out"]) + 0.02) / 0.02, 0, 1)   # 1 at the very back
    d_toe = np.clip(((y_toe - S["toe_out"]) + 0.04 - ys) / 0.04, 0, 1)      # 1 at the very tip
    # a quarter ellipse in plan at each end, down to no width at all on the
    # last ring: each end closes on itself (its mirrored points welded),
    # rounded, never on a fan to one point, which drew a seam down the toe
    shrink = np.sqrt(np.clip(1 - np.maximum(d_heel, d_toe) ** 2, 0, 1))
    shrink[0] = shrink[-1] = 0.0
    hw = hw * shrink
    height = (top - zb) * np.sqrt(np.clip(1 - d_toe ** 2 * 0.6, 0.05, 1)) * np.where(d_heel > 0, 0.5 + 0.5 * shrink, 1)
    section, value = shoe_section(S)
    M = len(section)
    verts, vals = [], []
    for i in range(n):
        flare = S["sole_flare"]
        up = max(top[i] - zb - S["band"], 0.004) * (height[i] / max(top[i] - zb, 1e-6))
        for (sx, sz), val in zip(section, value):
            if val > 0:   # the sole: its own width (a little wider), its own height
                x = cx[i] + hw[i] * flare * sx
                z = zb + sz
            else:         # the upper: from the sole's top over the instep
                x = cx[i] + hw[i] * sx
                z = zb + S["band"] + 0.001 + up * sz
            verts.append((x, ys[i], z))
            vals.append(val)
    faces = []
    for i in range(n - 1):
        for j in range(M):
            a0, a1 = i * M + j, i * M + (j + 1) % M
            faces.append((a0, a1, a1 + M, a0 + M))
    # the laces: bars across the instep over the upper's crown, each a
    # little tube following the upper's arc (its own island in the mesh)
    L = S["laces"]
    for k in range(L["count"]):
        uk = L["start"] + (L["end"] - L["start"]) * k / max(L["count"] - 1, 1)
        i = int(np.argmin(np.abs(u - uk)))
        up = max(top[i] - zb - S["band"], 0.004) * (height[i] / max(top[i] - zb, 1e-6))
        mid = np.array([cx[i], ys[i], zb + S["band"] + 0.001 + 0.45 * up])
        line = []
        for th in np.linspace(math.pi / 2 - L["half"], math.pi / 2 + L["half"], 9):
            c, sn = math.cos(th), math.sin(th)
            sx = math.copysign(abs(c) ** (2 / S["crown"]), c)
            sz = abs(sn) ** (2 / S["crown_top"])
            q = np.array([cx[i] + hw[i] * sx, ys[i], zb + S["band"] + 0.001 + up * sz])
            d = q - mid
            line.append(q + d / max(np.linalg.norm(d), 1e-9) * L["lift"])
        base = len(verts)
        sides = 6
        for a, q in enumerate(line):
            t = line[min(a + 1, len(line) - 1)] - line[max(a - 1, 0)]
            t = t / max(np.linalg.norm(t), 1e-9)
            n1 = np.array([0.0, 1.0, 0.0])
            n2 = np.cross(t, n1)
            for b in range(sides):
                ang = 2 * math.pi * b / sides
                verts.append(tuple(q + L["radius"] * (math.cos(ang) * n1 + math.sin(ang) * n2)))
                vals.append(1.0)
        for a in range(len(line) - 1):
            for b in range(sides):
                b1 = (b + 1) % sides
                faces.append((base + a * sides + b, base + a * sides + b1, base + (a + 1) * sides + b1, base + (a + 1) * sides + b))
        for end in (0, len(line) - 1):
            ring = [base + end * sides + b for b in range(sides)]
            faces.append(tuple(ring if end else reversed(ring)))
    me2 = bpy.data.meshes.new(f"Trainer.{side}")
    me2.from_pydata(verts, [], faces)
    # weld the end rings' mirrored points (no width there): each end closes on itself
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me2)
    bm.verts.ensure_lookup_table()
    ends = [bm.verts[i] for i in list(range(M)) + list(range((n - 1) * M, n * M))]
    bmesh.ops.remove_doubles(bm, verts=ends, dist=1e-6)
    bm.to_mesh(me2)
    bm.free()
    me2.validate()
    keep = np.array([v.co[:] for v in me2.vertices])
    ob = bpy.data.objects.new(f"Trainer.{side}", me2)
    body.users_collection[0].objects.link(ob)
    ob.parent = body.parent
    ob.matrix_parent_inverse = body.matrix_parent_inverse.copy()
    ob.matrix_world = body.matrix_world.copy()
    # weights from the nearest foot vertex
    tree = kdtree.KDTree(len(F))
    for i, p in enumerate(F):
        tree.insert(p, i)
    tree.balance()
    groups = {}
    for vi, p in enumerate(keep):
        _, i, _ = tree.find(p)
        src = me.vertices[int(idx[i])]
        for g in src.groups:
            name = names[g.group]
            if name not in groups:
                groups[name] = ob.vertex_groups.new(name=name)
            groups[name].add([vi], g.weight, "REPLACE")
    arm = ob.modifiers.new("Armature", "ARMATURE")
    arm.object = body.parent
    # each kept vertex's colour value from the original point it stands on
    orig = kdtree.KDTree(len(verts))
    for i, p in enumerate(verts):
        orig.insert(p, i)
    orig.balance()
    band = np.array([vals[orig.find(p)[1]] for p in keep], float)
    attr = me2.attributes.new("va_sole", "FLOAT", "POINT")
    attr.data.foreach_set("value", band)
    mat = bpy.data.materials.get("Trainers") or shoe_material()
    me2.materials.append(mat)
    for p in me2.polygons:
        p.use_smooth = True
    sub = ob.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = sub.render_levels = 2
    return ob


def shoe_section(S):
    """One ring of the trainer, counter-clockwise from the middle of the tread.

    Points (x in half-widths, z) with a value: 2 the dark tread line, 1 the
    white sole wall (z in metres above the tread), 0 the upper (z as a share
    of the upper's height over the sole). Each colour edge is a pair of
    points a millimetre apart, so the subdivided surface keeps it crisp.
    """
    t, b = S["outsole_h"], S["band"]
    right = [((0.0, 0.0), 2), ((0.8, 0.0), 2), ((1.0, t * 0.6), 2), ((1.0, t), 2), ((1.0, t + 0.001), 1),
             ((1.0, b * 0.6), 1), ((1.0, b), 1)]
    k = S["upper_points"]
    arc = []
    for j in range(k + 1):
        th = math.pi * j / k
        c, sn = math.cos(th), math.sin(th)
        x = math.copysign(abs(c) ** (2 / S["crown"]), c)
        z = abs(sn) ** (2 / S["crown_top"])
        arc.append(((x, z), 0))
    left = [((-x, z), v) for (x, z), v in reversed(right)]
    ring = right + arc + left[:-1]   # the tread's middle point is not repeated
    return [p for p, _ in ring], [v for _, v in ring]


# ------------------------------------------------------------------ build

class Man:
    """What render_interlude.py needs of him."""


def rest_forearm(rig, body, jeans):
    """Pose him with his left forearm resting on the raised knee; returns the wrist's drop.

    The wrist is lowered (bisection, deterministic) until the forearm's skin
    comes within `forearm_gap` of the jeans: the arm lies on the knee, not
    over it, and never sinks into it.
    """
    gi = body.vertex_groups["lowerarm_l"].index
    arm = np.array([any(g.group == gi and g.weight > 0.3 for g in v.groups) for v in body.data.vertices])

    def gap(drop):
        """The forearm's skin over the jeans' surface: signed, negative inside."""
        from mathutils.bvhtree import BVHTree
        pose(rig, drop)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = jeans.evaluated_get(dg)
        me = ev.to_mesh()
        M = jeans.matrix_world
        tree = BVHTree.FromPolygons([M @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
        ev.to_mesh_clear()
        A = evaluated_points([body])[body.name][arm]
        k = np.array(rig.pose.bones["calf_l"].head)
        best = np.inf
        for p in A[np.linalg.norm(A - k, axis=1) < 0.25]:
            hit, normal, _, dist = tree.find_nearest(Vector(p))
            if hit is None:
                continue
            best = min(best, dist if (Vector(p) - hit).dot(normal) >= 0 else -dist)
        return best

    lo, hi = 0.0, 0.1
    if gap(lo) < POSE["forearm_gap"]:
        raise SystemExit("his forearm starts inside the knee: raise POSE['wrist_l']")
    for _ in range(14):
        mid = 0.5 * (lo + hi)
        if gap(mid) < POSE["forearm_gap"]:
            hi = mid
        else:
            lo = mid
    pose(rig, lo)
    return lo


def clean_collar(node):
    """Repaint the tee's neck rib in the stripes' navy, crisp (COLLAR); the node gets a new image."""
    from PIL import Image as PImage
    C = COLLAR
    image = node.image
    w, h = image.size
    px = np.empty(w * h * 4, np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[::-1]          # rows top-down
    k = C["upscale"]
    big = np.stack([np.asarray(PImage.fromarray(np.ascontiguousarray(px[..., c])).resize((w * k, h * k),
                                                                                      PImage.BICUBIC))
                    for c in range(4)], -1).clip(0, 1)
    rgb = big[..., :3]
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722])
    red = rgb[..., 0] - np.maximum(rgb[..., 1], rgb[..., 2])
    rows = int(C["rows"] * h * k)
    mask = np.zeros(luma.shape, bool)
    mask[:rows] = red[:rows] > C["redness"]
    # the stripes' navy: the dark pixels of the tee's body under the collar
    body = rgb[rows:4 * rows, : w * k // 2]
    navy = np.median(body[body.sum(-1) < 0.8], axis=0)
    grow = C["grow"] * k
    for _ in range(grow):
        m = mask.copy()
        m[1:] |= mask[:-1]
        m[:-1] |= mask[1:]
        m[:, 1:] |= mask[:, :-1]
        m[:, :-1] |= mask[:, 1:]
        mask = mask | (m & (luma < C["white"]))
        mask[rows:] = False
    # a one-pixel soft edge, so the band is crisp but not aliased
    f = mask.astype(np.float32)
    soft = f.copy()
    soft[1:-1, 1:-1] = sum(f[1 + dy:f.shape[0] - 1 + dy, 1 + dx:f.shape[1] - 1 + dx]
                           for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0
    a = soft[..., None]
    big[..., :3] = rgb * (1 - a) + navy * a
    big[..., 3] = np.maximum(big[..., 3], soft)
    new = bpy.data.images.new(image.name + ".collar", w * k, h * k, alpha=True)
    new.colorspace_settings.name = image.colorspace_settings.name
    new.pixels.foreach_set(np.ascontiguousarray(big[::-1]).astype(np.float32).ravel())
    new.update()
    node.image = new


def smooth_crotch(rig, jeans):
    """Iron out the jeans' crotch, which the raised thigh folds into spikes.

    The clothes are skinned for standing: with the left thigh swung up to
    the knee, the cloth between the thighs creases into sharp, interpenetrating
    folds. A Laplacian smooth after the armature, keeping the volume,, on the posed cloth near the
    crotch (`CROTCH`: weights falling off from its centre), relaxes them.
    """
    C = CROTCH
    hl, _ = head_tail(rig, "thigh_l")
    hr, _ = head_tail(rig, "thigh_r")
    centre = np.array((hl + hr) / 2) + np.array(C["offset"])
    V = evaluated_points([jeans])[jeans.name]
    d = np.linalg.norm(V - centre, axis=1)
    w = np.clip((C["radius"] - d) / (C["radius"] - C["core"]), 0, 1)
    w = w * w * (3 - 2 * w)
    g = jeans.vertex_groups.new(name="va_crotch")
    for i in np.where(w > 0)[0]:
        g.add([int(i)], float(w[i]), "REPLACE")
    m = jeans.modifiers.new("Crotch", "LAPLACIANSMOOTH")
    m.vertex_group = g.name
    m.lambda_factor = C["factor"]
    m.lambda_border = 0.0
    m.iterations = C["iterations"]
    m.use_volume_preserve = True
    m.use_normalized = True


def evaluated_points(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        M = np.array(o.matrix_world)
        V = np.array([v.co[:] for v in me.vertices])
        out[o.name] = V @ M[:3, :3].T + M[:3, 3] if len(V) else np.zeros((0, 3))
        ev.to_mesh_clear()
    return out


def build(log=log):
    rig, meshes, glasses = portrait.import_man()
    portrait.style_man(meshes)
    tee = next(o for o in meshes if o.name.endswith("casualsuit06"))
    clean_collar(next(n for n in tee.data.materials["Tee"].node_tree.nodes if n.bl_idname == "ShaderNodeTexImage"))
    portrait.style_glasses(glasses)
    body = next(o for o in meshes if o.name == "Human")
    shoes = make_trainers(body)
    jeans = next(o for o in meshes if o.name.endswith("casualsuit06"))
    drop = rest_forearm(rig, body, jeans)
    smooth_crotch(rig, jeans)
    # the whole figure: turned a little, built as a 1:MINIATURE miniature
    rig.rotation_mode = "XYZ"
    rig.rotation_euler = (0, 0, math.radians(POSE["body_yaw"]))
    rig.scale = (1 / MINIATURE,) * 3
    rig.location = (0, 0, 0)
    bpy.context.view_layer.update()
    objs = [o for o in meshes + list(shoes.values()) + glasses if not o.hide_render]
    pts = evaluated_points(objs)
    allp = np.concatenate(list(pts.values()))
    # the floor at z = 0 under his lowest point; the slot centre x in the
    # middle of his width, y in the middle of his footprint (knee to toe)
    z0 = allp[:, 2].min()
    cx = 0.5 * (allp[:, 0].min() + allp[:, 0].max())
    low = allp[allp[:, 2] < z0 + 0.03 / MINIATURE]
    cy = 0.5 * (low[:, 1].min() + low[:, 1].max())
    rig.location = (-cx, -cy, -z0)
    bpy.context.view_layer.update()
    pts = evaluated_points(objs)
    allp = np.concatenate(list(pts.values()))
    # the skin's millimetre-scale looks shrink with him
    for o in meshes:
        for mat in o.data.materials:
            if mat.name == "Skin":
                b = portrait.principled(mat)
                b.inputs["Subsurface Scale"].default_value /= MINIATURE
                for n in mat.node_tree.nodes:
                    if n.bl_idname == "ShaderNodeBump":
                        n.inputs["Distance"].default_value /= MINIATURE
                    if n.bl_idname == "ShaderNodeTexNoise":
                        n.inputs["Scale"].default_value *= MINIATURE
    man = Man()
    man.rig, man.objects, man.glasses, man.shoes = rig, objs, glasses, shoes
    man.points = pts
    man.extra_points = [allp]
    # the floor contact: the planted (left) trainer's sole
    s = pts["Trainer.l"]
    man.floor_contact = s[s[:, 2] < s[:, 2].min() + 0.003 / MINIATURE]
    man.head_band = head_band(body, pts["Human"])
    top = float(allp[:, 2].max())
    lows = {k: round(float(v[:, 2].min()) * 100 * MINIATURE, 2) for k, v in pts.items() if len(v)}
    man.report = dict(
        miniature=MINIATURE,
        head_top_cm=round(top * 100 * MINIATURE, 1),
        head_top_built_cm=round(top * 100, 2),
        width_cm=round(float(np.ptp(allp[:, 0])) * 100 * MINIATURE, 1),
        depth_cm=round(float(np.ptp(allp[:, 1])) * 100 * MINIATURE, 1),
        lowest_cm=lows,
        knee_r_cm=round(float(knee_low(rig, pts["Human.male_casualsuit06"])) * 100 * MINIATURE, 2),
        wrist_drop_cm=round(drop * 100, 2),
        pose=POSE,
        shoes=SHOES,
    )
    log(f"kneeling height {man.report['head_top_cm']} cm (built at 1:{MINIATURE}: {man.report['head_top_built_cm']} cm), "
        f"lowest {lows}, kneeling knee {man.report['knee_r_cm']} cm")
    return man


def knee_low(rig, V):
    """The lowest point of the jeans near the kneeling (right) knee."""
    k = rig.matrix_world @ rig.pose.bones["calf_r"].head
    near = np.linalg.norm(V - np.array(k[:]), axis=1) < 0.12 / MINIATURE
    return V[near, 2].min() if near.any() else float("nan")


def head_band(body, V):
    """Points of the head's skin at cheek height (between the nose tip and the ear lobes)."""
    me = body.data
    gi = body.vertex_groups["head"].index
    w = np.zeros(len(me.vertices))
    for v in me.vertices:
        for g in v.groups:
            if g.group == gi:
                w[v.index] = g.weight
    head = w > 0.9
    if not head.any():
        return V[:0]
    z = V[head, 2]
    lo, hi = np.percentile(z, 30), np.percentile(z, 45)
    sel = head & (V[:, 2] > lo) & (V[:, 2] < hi)
    return V[sel]
