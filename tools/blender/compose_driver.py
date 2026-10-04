"""Compose the driver from the Quaternius Ultimate Modular Men master file.

- Head: the Adventurer head with ALL its hair and beard removed. A buzz cut
  and a short boxed beard are generated as thin shells over the head's own
  skin faces (duplicated, pushed out a few millimetres, Hair material), so
  they fit the skull exactly and keep the skin weights.
- Body: Suit jacket without the tie (recoloured to leather in Three.js).
- Legs/feet: Casual 2 jeans and trainers.
Exports one skinned GLB with the shared armature and no animations.
Usage: blender -b -P compose_driver.py -- <master.blend> <out.glb>
"""
import sys
import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst = argv[0], argv[1]

HAIR_OFFSET = 0.007
BEARD_OFFSET = 0.012

bpy.ops.wm.open_mainfile(filepath=src)

KEEP = {"Adventurer_Head", "Suit_Body", "Casual2_Legs", "Casual2_Feet", "CharacterArmature"}
for o in list(bpy.data.objects):
    if o.name not in KEEP:
        bpy.data.objects.remove(o, do_unlink=True)
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

arm = bpy.data.objects["CharacterArmature"]
arm.animation_data_clear()

# The master file hides most outfits; unhide and include everything we kept.
for layer_col in bpy.context.view_layer.layer_collection.children:
    layer_col.exclude = False
    layer_col.hide_viewport = False
for coll in bpy.data.collections:
    coll.hide_viewport = False
    coll.hide_render = False
for o in bpy.data.objects:
    if o.name not in bpy.context.view_layer.objects:
        bpy.context.scene.collection.objects.link(o)
    o.hide_viewport = False
    o.hide_render = False
    o.hide_set(False)


def mat_index(obj, name):
    for i, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name == name:
            return i
    return -1


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# Suit body: drop the tie.
body = bpy.data.objects["Suit_Body"]
tie = mat_index(body, "Tie")
bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == tie], context="FACES")
bm.to_mesh(body.data)
bm.free()

head = bpy.data.objects["Adventurer_Head"]
mw = head.matrix_world
inv = mw.inverted()
SKIN = mat_index(head, "Skin")
HAIR = mat_index(head, "Hair")
EYE = mat_index(head, "Eye")

eye_pts = [mw @ p.center for p in head.data.polygons if p.material_index == EYE]
eye_c = sum(eye_pts, Vector()) / len(eye_pts)
skin_pts = [mw @ head.data.vertices[i].co for p in head.data.polygons if p.material_index == SKIN for i in p.vertices]
head_c = sum(skin_pts, Vector()) / len(skin_pts)
# Characters face -Y in the master file.
FRONT = Vector((0, -1, 0))
skull_c = Vector((head_c.x, head_c.y + 0.01, eye_c.z + 0.015))
print("EYE", tuple(round(c, 3) for c in eye_c), "SKULL", tuple(round(c, 3) for c in skull_c))

bm = bmesh.new()
bm.from_mesh(head.data)
bm.faces.ensure_lookup_table()


def is_original_beard(face):
    # Measured map of the Adventurer's hair faces: the beard and moustache sit
    # in front of the face, 4.5 to 13.5 cm below the eyes, within |x| < 7.5 cm;
    # side and back faces at eye height are the long hair.
    c = mw @ face.calc_center_median()
    dz = c.z - eye_c.z
    dy = c.y - eye_c.y
    ax = abs(c.x)
    if dz < -0.135:
        return False  # the long part that falls toward the chest
    core = dz < -0.045 and ax < 0.075 and dy < 0.09
    jaw = dz < -0.075 and ax < 0.1 and dy < 0.03
    return core or jaw


# 1) Remove the long hair; keep the designed beard (trimmed below).
bmesh.ops.delete(
    bm,
    geom=[f for f in bm.faces if f.material_index == HAIR and not is_original_beard(f)],
    context="FACES",
)
bm.faces.ensure_lookup_table()
beard_verts = {v for f in bm.faces if f.material_index == HAIR for v in f.verts}


def region(face):
    c = mw @ face.calc_center_median()
    d = c - skull_c
    if d.length < 1e-6:
        return None
    n = d.normalized()
    front = n.dot(FRONT)
    up = n.z
    # Buzz cut: the scalp. Hairline is high at the forehead, lower at the
    # temples, down to the nape at the back.
    hairline = -0.32 + 0.80 * smoothstep(-0.35, 0.75, front)
    # The forehead stays clear only below a low hairline: not bald on top.
    if up > hairline and not (front > 0.6 and up < 0.42):
        return "hair"
    return None


hair_faces = []
beard_faces = []
for f in bm.faces:
    if f.material_index != SKIN:
        continue
    kind = region(f)
    if kind == "hair":
        hair_faces.append(f)
    elif kind == "beard":
        beard_faces.append(f)


def shell(faces, offset):
    if not faces:
        return 0
    result = bmesh.ops.duplicate(bm, geom=faces)
    new_faces = [g for g in result["geom"] if isinstance(g, bmesh.types.BMFace)]
    new_verts = [g for g in result["geom"] if isinstance(g, bmesh.types.BMVert)]
    for f in new_faces:
        f.material_index = HAIR
    for v in new_verts:
        world = mw @ v.co
        n = (world - skull_c).normalized()
        v.co = inv @ (world + n * offset)
    return len(new_faces)


print("HAIR shell faces", shell(hair_faces, HAIR_OFFSET))

# 2) Trim the designed beard: pull each beard vertex in toward the skin so it
# hugs the jaw at BEARD_OFFSET (never pushed outward).
from mathutils.kdtree import KDTree

skin_world = [mw @ head.data.vertices[i].co for p in head.data.polygons if p.material_index == SKIN for i in p.vertices]
tree = KDTree(len(skin_world))
for i, p in enumerate(skin_world):
    tree.insert((p - skull_c).normalized(), i)
tree.balance()
trimmed = 0
for v in beard_verts:
    if not v.is_valid:
        continue
    world = mw @ v.co
    d = world - skull_c
    n = d.normalized()
    r = max((skin_world[i] - skull_c).length for (_, i, _) in tree.find_n(n, 6))
    if d.length > r + BEARD_OFFSET:
        v.co = inv @ (skull_c + n * (r + BEARD_OFFSET))
        trimmed += 1
print("BEARD kept faces", sum(1 for f in bm.faces if f.material_index == HAIR) - len(hair_faces), "verts trimmed", trimmed)

# Eyes: the stock eyes are tiny slits that vanish at portfolio distances.
# Scale each eye island 1.5x around its own centre and nudge it forward.
bm.faces.ensure_lookup_table()
eye_faces = [f for f in bm.faces if f.material_index == EYE]
islands = {"l": [], "r": []}
for f in eye_faces:
    c = mw @ f.calc_center_median()
    islands["l" if c.x > 0 else "r"].append(f)
for side, faces in islands.items():
    verts = {v for f in faces for v in f.verts}
    if not verts:
        continue
    centre = sum((v.co for v in verts), Vector()) / len(verts)
    forward_local = (inv.to_3x3() @ FRONT).normalized()
    for v in verts:
        v.co = centre + (v.co - centre) * 1.25 + forward_local * 0.002
    print("EYE scaled", side, len(verts))
bm.to_mesh(head.data)
bm.free()
head.name = "Driver_Head"

for o in bpy.data.objects:
    if o.type == "MESH":
        print("MESH", o.name, "mats", [s.material.name for s in o.material_slots if s.material])

# Human arm proportions. The stock character has very short arms (shoulder to
# wrist 0.42 m). In the T-pose bind the arms lie along X, so we stretch the
# segment between the shoulder joint and the wrist by ARM_STRETCH, and shift
# the hands outward without scaling them. Bones and vertices get the same
# mapping, so the skin weights stay valid.
ARM_STRETCH = 1.4
amw = arm.matrix_world


def bone_head_world(name):
    return amw @ arm.data.bones[name].head_local


shoulder_x = abs(bone_head_world("UpperArm.L").x)
wrist_x = abs(bone_head_world("Wrist.L").x)
shoulder_z = bone_head_world("UpperArm.L").z
shift = (wrist_x - shoulder_x) * (ARM_STRETCH - 1)
print("ARM shoulder_x", round(shoulder_x, 3), "wrist_x", round(wrist_x, 3), "shift", round(shift, 3))


def stretch_x(x):
    a = abs(x)
    s = 1 if x >= 0 else -1
    if a <= shoulder_x:
        return x
    if a < wrist_x:
        return s * (shoulder_x + (a - shoulder_x) * ARM_STRETCH)
    return s * (a + shift)


def in_arm_band(p):
    # Only the arms: near shoulder height, or clearly outside the torso.
    return abs(p.z - shoulder_z) < 0.11 or abs(p.x) > shoulder_x + 0.05


for o in bpy.data.objects:
    if o.type != "MESH" or o.name == "Driver_Head":
        continue
    mwo = o.matrix_world
    invo = mwo.inverted()
    moved = 0
    for v in o.data.vertices:
        w = mwo @ v.co
        if abs(w.x) > shoulder_x and in_arm_band(w):
            w.x = stretch_x(w.x)
            v.co = invo @ w
            moved += 1
    print("ARM verts stretched", o.name, moved)

bpy.context.view_layer.objects.active = arm
for o in bpy.context.selected_objects:
    o.select_set(False)
arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
amw_inv = amw.inverted()
ARM_PREFIXES = ("UpperArm", "LowerArm", "Wrist", "Index", "Middle", "Ring", "Pinky", "Thumb")
# Connected bones share points: compute every new head/tail from the ORIGINAL
# positions first, then assign, so no joint is stretched twice.
targets = {}
for eb in arm.data.edit_bones:
    if not eb.name.startswith(ARM_PREFIXES):
        continue
    new = {}
    for attr in ("head", "tail"):
        w = amw @ getattr(eb, attr).copy()
        w.x = stretch_x(w.x)
        new[attr] = amw_inv @ w
    targets[eb.name] = new
for name, new in targets.items():
    eb = arm.data.edit_bones[name]
    eb.use_connect = False
for name, new in targets.items():
    eb = arm.data.edit_bones[name]
    eb.head = new["head"]
    eb.tail = new["tail"]
bpy.ops.object.mode_set(mode="OBJECT")
print("ARM wrist after", round(abs(bone_head_world("Wrist.L").x), 3))

for o in bpy.data.objects:
    if o.type == "MESH":
        print("MODIFIERS", o.name, [(m.type, m.name) for m in o.modifiers])

bpy.ops.object.select_all(action="SELECT")
# export_apply: the outfits are modelled as halves with a Mirror modifier;
# without applying modifiers the right half of the body is missing.
# The exporter keeps the Armature modifier as skinning.
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_skins=True,
    use_selection=True,
)
print("EXPORTED", dst)
