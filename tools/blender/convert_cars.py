import sys, os, bpy
argv = sys.argv[sys.argv.index("--") + 1 :]
out_dir = argv[0]
for path in argv[1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=path)
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Report where the headlight material sits to find the front.
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        for i, slot in enumerate(o.material_slots):
            vs = [o.matrix_world @ o.data.vertices[v].co for p in o.data.polygons if p.material_index == i for v in p.vertices]
            if vs:
                print("MAT", os.path.basename(path), o.name, slot.material.name, "ymean", round(sum(v.y for v in vs) / len(vs), 2), "zmean", round(sum(v.z for v in vs) / len(vs), 2), "kd", tuple(round(c, 2) for c in slot.material.diffuse_color[:3]))
    name = os.path.splitext(os.path.basename(path))[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + ".glb"), export_format="GLB", export_yup=True)
