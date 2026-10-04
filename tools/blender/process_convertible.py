"""Split the Poly convertible into a body and four wheel objects, then export GLB.

Wheels are the four 61-vertex loose parts at the corners. Each wheel gets its
origin at the centre of its bounds so it can spin around its axle in Three.js.
Usage: blender -b -P process_convertible.py -- <in.obj> <out.glb>
"""
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src)
obj = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")

parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]


def bounds(o):
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


wheels = {}
body = []
SEAT_CUT = 1.75  # Blender units; seat backs above this get compressed
for o in parts:
    x0, x1, y0, y1, z0, z1 = bounds(o)
    # Front seats (34 verts, backrest up to z 2.84): backrests a little lower so the driver's
    # shoulders show from the chase camera, and both seats slid 0.44 units
    # (0.2 m) forward on their rails, like a real seat adjustment. The
    # steering wheel stays where the model has it, on the dashboard.
    if len(o.data.vertices) == 34 and z1 > 2.6:
        for v in o.data.vertices:
            if v.co.z > SEAT_CUT:
                v.co.z = SEAT_CUT + (v.co.z - SEAT_CUT) * 0.72
            v.co.y -= 0.44
        print("SEAT lowered and slid forward", o.name)
    is_wheel = (
        len(o.data.vertices) == 61
        and z0 < 0.05
        and 1.6 < (z1 - z0) < 1.8
        and abs((x0 + x1) / 2) > 1.4
        and abs((y0 + y1) / 2) > 2.5
    )
    if is_wheel:
        side = "l" if (x0 + x1) / 2 > 0 else "r"
        # Blender -Y is the car front.
        end = "front" if (y0 + y1) / 2 < 0 else "rear"
        wheels[f"wheel_{end}_{side}"] = o
    else:
        body.append(o)

print("WHEELS", sorted(wheels.keys()), "BODY PARTS", len(body))
assert len(wheels) == 4, "expected four wheels"

bpy.ops.object.select_all(action="DESELECT")
for o in body:
    o.select_set(True)
bpy.context.view_layer.objects.active = body[0]
bpy.ops.object.join()
bpy.context.active_object.name = "body"

for name, o in wheels.items():
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    o.name = name
    print("WHEEL", name, tuple(round(c, 3) for c in o.location))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_yup=True)
print("EXPORTED", dst)
