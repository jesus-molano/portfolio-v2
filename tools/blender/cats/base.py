"""The base model: the XR Blocks "Cat" (an American Shorthair), Apache-2.0.

Source: https://github.com/xrblocks/assets/tree/<COMMIT>/models/Cat
(committed by Google, 2025-09-26; the repository's LICENSE is Apache-2.0 and
covers its assets; see public/interlude/LICENSE.txt). It stays outside the
repo: `ensure()` downloads the five files of the pinned commit into a cache
folder and refuses any file whose SHA-256 differs from FILES.

`load()` imports it and takes it apart into plain numpy data, then clears the
Blender scene:

- the skeleton (91 joints, hierarchy order) with rest matrices in metres and
  the bundled 15 s clip sampled per frame as local "basis" matrices. The glTF
  stores the rest pose in centimetres under a 0.01 scale on the `Cat` root;
  here every translation is divided by 100 and that scale is dropped, so
  forward kinematics gives metres directly (checked against Blender's own
  pose matrices to 1e-7 when this was written);
- the body: the skin pieces (head, torso with forelegs, tail, hind legs,
  ears, a top and a pad per toe, belly and chest fills, the mouth lining:
  every piece tied to the torso by coincident vertices) welded along their
  seams (0.05 mm; one degenerate spot at the nose tip is merged), turned from
  triangles into quads and subdivided (Catmull-Clark) with Blender's
  Subdivision Surface, which also interpolates the skin weights and the UVs;
- the eyeballs (centre, radius, the joint that carries them, the direction
  out of the eye opening), which `eyes.py` replaces with its own;
- the mystacial whisker strips, kept only as anchors (root, tip and the
  root's skin weights) for `whiskers.py`;
- the lip line (where the head skin meets the mouth lining: the skin is a
  closed surface, the mouth a closed bag) and, for each eye, the aperture of
  its closed lid pocket, found by casting rays out of the eyeball;
- the colour texture sampled at every subdivided vertex (`tex_rgb`), used to
  find the nose leather, which the artist painted to the modelled shape.

The teeth, tongue and gums are dropped: the mouth is closed. Nothing here depends on bone-local axes (the
importer points bone Y sideways on the legs); frames come from joint
positions.
"""

import hashlib
import os
import urllib.request

import numpy as np

import bpy
import bmesh  # noqa: E402  (needs bpy first)

from .vecmath import nrm

COMMIT = "5582bd1b2d1a4e19f7ee7093b63a5ee328e974ac"
SOURCE = f"https://github.com/xrblocks/assets/tree/{COMMIT}/models/Cat"
RAW = f"https://raw.githubusercontent.com/xrblocks/assets/{COMMIT}/models/Cat/"
FILES = {
    "cat.gltf": "5e743ef858a6d05d45543fc5f1e9158e4bf8c9cb491f03010e93f949f1c0b630",
    "cat.bin": "20f21f966a1a9eed2473bb2752ba490526aeadbadd76bc6e415e9141e07bceeb",
    "ShortHairedCat_Color.jpg": "8a5bb527cd0894dcc05f76dfc006f015d1113ecd2e2cfe2f7beb9429dd3bda6a",
    "ShortHairedCat_Normal.jpg": "9d4161c5a5341fed9b3808e482d260deae078a5162fb55e9b8b8a957389ff0a0",
    "ShortHairedCat_arm.jpg": "20889423d64ee4fa5cc64f29a0b2beaa45ecd30d7c8d2c393b4849aa7083d01a",
}
CM = 0.01  # the glTF rest pose is in centimetres


def default_dir():
    cache = os.environ.get("XDG_CACHE_HOME") or os.path.join(os.path.expanduser("~"), ".cache")
    return os.path.join(cache, "vice-afterglow", "xrblocks-cat-" + COMMIT[:7])


def _sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def ensure(path=None, fetch=True, log=print):
    """Return a folder holding the five pinned files, downloading what is missing."""
    path = path or os.environ.get("XRBLOCKS_CAT_DIR") or default_dir()
    os.makedirs(path, exist_ok=True)
    for name, digest in FILES.items():
        f = os.path.join(path, name)
        if not os.path.exists(f):
            if not fetch:
                raise SystemExit(f"missing {f}; run without --no-fetch or fetch {RAW}{name}")
            log(f"fetching {name} from xrblocks/assets@{COMMIT[:7]}")
            data = urllib.request.urlopen(RAW + name, timeout=120).read()
            if hashlib.sha256(data).hexdigest() != digest:
                raise SystemExit(f"{name}: downloaded file does not match the pinned SHA-256")
            with open(f + ".part", "wb") as out:
                out.write(data)
            os.replace(f + ".part", f)
        if _sha(f) != digest:
            raise SystemExit(f"{f}: SHA-256 differs from the pinned base; refusing to build")
    return path


class Base:
    """Everything the generator needs from the base model, as numpy arrays (metres)."""

    names: list          # joint names, parents before children
    parent: np.ndarray   # (B,) parent index, -1 for the root
    rest: np.ndarray     # (B, 4, 4) rest matrices, armature space = world
    clip: np.ndarray     # (F, B, 4, 4) local basis matrices per clip frame
    V: np.ndarray        # (N, 3) subdivided body, rest pose
    Q: np.ndarray        # (M, 4) quads of the subdivided body
    loop_uv: np.ndarray  # (M, 4, 2) base UVs per face corner
    W: np.ndarray        # (N, B) skin weights (rows sum to 1)
    tex_rgb: np.ndarray  # (N, 3) base colour texture at each vertex (linear)
    lip_line: np.ndarray  # vertex indices along the closed mouth
    eyes: dict           # {"L", "R"}: centre, radius, joint, out, aperture (rest)
    whiskers: list       # dicts: root, tip, weights (B,), gap to the skin
    normal_map: str      # path of the base normal map
    dir: str

    def index(self, name):
        return self.names.index(name)

    def children(self, i):
        return [j for j, p in enumerate(self.parent) if p == i]

    def subtree(self, name):
        """Joint indices of name and all its descendants."""
        out = [self.index(name)]
        for j in range(len(self.names)):
            if self.parent[j] in out:
                out.append(j)
        return out


def _islands(bm):
    lab = np.full(len(bm.verts), -1, int)
    k = 0
    for v in bm.verts:
        if lab[v.index] >= 0:
            continue
        stack = [v]
        while stack:
            x = stack.pop()
            if lab[x.index] >= 0:
                continue
            lab[x.index] = k
            stack.extend(e.other_vert(x) for e in x.link_edges)
        k += 1
    return lab, k


def load(path, subdiv=2, log=print):
    """Import the pinned base and return a Base. Leaves an empty scene behind."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(path, "cat.gltf"))
    sc = bpy.context.scene
    arm = next(o for o in sc.objects if o.type == "ARMATURE")
    me = next(o for o in sc.objects if o.type == "MESH" and o.find_armature() == arm)
    b = Base()
    b.dir = path
    b.normal_map = os.path.join(path, "ShortHairedCat_Normal.jpg")

    # --- skeleton and clip
    bones = list(arm.data.bones)
    b.names = [x.name for x in bones]
    b.parent = np.array([b.names.index(x.parent.name) if x.parent else -1 for x in bones])
    assert all(p < i for i, p in enumerate(b.parent)), "joints are not in hierarchy order"
    rest = np.array([np.array(x.matrix_local) for x in bones])
    rest[:, :3, 3] *= CM
    b.rest = rest
    act = arm.animation_data.action
    f0, f1 = (int(round(v)) for v in act.frame_range)
    clip = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        M = np.array([np.array(arm.pose.bones[n].matrix_basis) for n in b.names])
        root = M[0]
        s = np.linalg.norm(root[:3, :3], axis=0)
        root[:3, :3] /= s  # drop the 0.01 unit scale on the root
        M[1:, :3, 3] *= CM
        clip.append(M)
    b.clip = np.array(clip)
    sc.frame_set(0)

    # --- mesh data in metres, rest pose
    md = me.data
    nv = len(md.vertices)
    co = np.empty(nv * 3)
    md.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) * CM
    gmap = {g.index: b.names.index(g.name) for g in me.vertex_groups}
    Wfull = np.zeros((nv, len(b.names)), np.float32)
    for v in md.vertices:
        for g in v.groups:
            Wfull[v.index, gmap[g.group]] += g.weight
    Wfull /= np.maximum(Wfull.sum(1, keepdims=True), 1e-9)

    bm = bmesh.new()
    bm.from_mesh(md)
    for v, p in zip(bm.verts, co):
        v.co = p
    bm.verts.ensure_lookup_table()
    lab, nparts = _islands(bm)
    dom = []
    for i in range(nparts):
        m = lab == i
        dom.append(b.names[int(Wfull[m].sum(0).argmax())])

    # Coincident vertices tie the skin pieces together (head, torso, tail,
    # legs, ears, every toe top and pad, belly and chest fills, the mouth
    # lining). The skin is the component of that graph holding the largest
    # piece; teeth, tongue, gums, eyeballs and whiskers touch nothing.
    from mathutils.kdtree import KDTree
    kd = KDTree(nv)
    for i, p in enumerate(co):
        kd.insert(p, i)
    kd.balance()
    touch = {i: {} for i in range(nparts)}
    for i in range(nv):
        for _, j, _ in kd.find_range(co[i], 5e-5):
            if lab[j] != lab[i]:
                touch[lab[i]][lab[j]] = touch[lab[i]].get(lab[j], 0) + 1
    sizes = np.bincount(lab)
    skin_parts = {int(sizes.argmax())}
    stack = list(skin_parts)
    while stack:
        x = stack.pop()
        for y in touch[x]:
            if y not in skin_parts:
                skin_parts.add(y)
                stack.append(y)
    head_set = set(b.subtree("Head"))
    ear_set = set(b.subtree("L_Ear01")) | set(b.subtree("R_Ear01"))
    head_parts = [i for i in skin_parts if b.names.index(dom[i]) in head_set - ear_set]
    head_main = max(head_parts, key=lambda i: sizes[i])
    # the lip line: where the head skin meets the mouth lining
    lip = [i for i in np.nonzero(lab == head_main)[0]
           if any(lab[j] in head_parts and lab[j] != head_main for _, j, _ in kd.find_range(co[i], 5e-5))]
    lip_points = co[lip]

    # eyeballs: the two parts carried by the eyeball joints
    b.eyes = {}
    for side, joint in (("L", "leftEye1_EyeballJoint"), ("R", "rightEye1_EyeballJoint")):
        parts = [i for i in range(nparts) if dom[i] == joint]
        assert len(parts) == 1, f"expected one eyeball on {joint}, found {len(parts)}"
        P = co[lab == parts[0]]
        c = 0.5 * (P.min(0) + P.max(0))
        r = float(np.linalg.norm(P - c, axis=1).mean())
        b.eyes[side] = dict(centre=c, radius=r, joint=b.names.index(joint))

    # whisker strips: thin ribbons on the face, outside the skin
    b.whiskers = []
    for i in range(nparts):
        if i in skin_parts or dom[i].endswith("EyeballJoint") or b.names.index(dom[i]) not in head_set:
            continue
        idx = np.nonzero(lab == i)[0]
        P = co[idx]
        c = P.mean(0)
        _, s, vt = np.linalg.svd(P - c, full_matrices=False)
        t = (P - c) @ vt[0]
        if len(idx) > 60 or t.max() - t.min() < 0.02 or s[2] > 0.1 * s[0]:
            continue  # teeth, gums, tongue: not ribbons
        a, z = P[t.argmin()], P[t.argmax()]
        b.whiskers.append(dict(ends=(a, z), idx=idx))

    # weld the skin; merge the one degenerate spot at the nose tip
    dead = [v for v in bm.verts if lab[v.index] not in skin_parts]
    bmesh.ops.delete(bm, geom=dead, context="VERTS")
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=5e-5)
    for _ in range(3):
        bad = [v for v in bm.verts if not v.is_manifold]
        if not bad:
            break
        groups = []
        for v in bad:
            for g in groups:
                if (g[0].co - v.co).length < 0.002:
                    g.append(v)
                    break
            else:
                groups.append([v])
        for g in groups:
            if len(g) > 1:
                bmesh.ops.pointmerge(bm, verts=g, merge_co=sum((v.co for v in g), g[0].co * 0) / len(g))
        bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=list(bm.edges))
        bmesh.ops.delete(bm, geom=[e for e in bm.edges if not e.link_faces], context="EDGES_FACES")
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    nonman = sum(1 for e in bm.edges if not e.is_manifold)
    log(f"base: {nparts} parts, {len(skin_parts)} skin pieces welded ({len(bm.verts)} verts, "
        f"{nonman} open or non-manifold edges); {len(b.whiskers)} whisker strips")
    bmesh.ops.join_triangles(bm, faces=list(bm.faces), angle_face_threshold=np.radians(40),
                             angle_shape_threshold=np.radians(40), cmp_uvs=False, cmp_vcols=False,
                             cmp_seam=False, cmp_sharp=False, cmp_materials=False)

    body = bpy.data.meshes.new("BaseBody")
    bm.to_mesh(body)
    bm.free()
    if "custom_normal" in body.attributes:
        body.attributes.remove(body.attributes["custom_normal"])
    ob = bpy.data.objects.new("BaseBody", body)
    sc.collection.objects.link(ob)
    for name in [g.name for g in sorted(me.vertex_groups, key=lambda g: g.index)]:
        ob.vertex_groups.new(name=name)
    mod = ob.modifiers.new("Subdivide", "SUBSURF")
    mod.levels = mod.render_levels = subdiv
    mod.quality = 3
    mod.uv_smooth = "PRESERVE_BOUNDARIES"
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    em = ev.to_mesh()
    n = len(em.vertices)
    V = np.empty(n * 3)
    em.vertices.foreach_get("co", V)
    b.V = V.reshape(-1, 3)
    ls = np.empty(len(em.polygons), np.int32)
    lt = np.empty(len(em.polygons), np.int32)
    em.polygons.foreach_get("loop_start", ls)
    em.polygons.foreach_get("loop_total", lt)
    assert (lt == 4).all(), "subdivided body should be all quads"
    vi = np.empty(len(em.loops), np.int32)
    em.loops.foreach_get("vertex_index", vi)
    b.Q = vi.reshape(-1, 4)
    uv = np.empty(len(em.loops) * 2)
    em.uv_layers[0].data.foreach_get("uv", uv)
    b.loop_uv = uv.reshape(-1, 4, 2)
    gmap2 = {g.index: b.names.index(g.name) for g in ob.vertex_groups}
    W = np.zeros((n, len(b.names)), np.float32)
    for v in em.vertices:
        for g in v.groups:
            W[v.index, gmap2[g.group]] += g.weight
    b.W = W / np.maximum(W.sum(1, keepdims=True), 1e-9)
    ev.to_mesh_clear()
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree as KD
    bvh = BVHTree.FromPolygons([Vector(p) for p in b.V], b.Q.tolist())
    kd2 = KD(n)
    for i, p in enumerate(b.V):
        kd2.insert(p, i)
    kd2.balance()

    # The lip line on the subdivided skin (the mouth is a closed bag).
    near = set()
    for p in lip_points:
        near.update(j for _, j, _ in kd2.find_range(p, 0.0015))
    b.lip_line = np.array(sorted(near))

    # Each eyeball sits in a pocket of lid skin (the lining cuts through the
    # back of the ball at about 0.7 R). The skin is closed, so rays from the
    # eyeball's centre that leave the head without a hit went through the
    # lid aperture.
    k = np.arange(1500) + 0.5
    phi = np.arccos(1 - 2 * k / len(k))
    th = np.pi * (1 + 5 ** 0.5) * k
    dirs = np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], 1)
    for side, e in b.eyes.items():
        free = []
        for d in dirs:
            hit = bvh.ray_cast(Vector(e["centre"]), Vector(d), 1.0)
            free.append(hit[0] is None)
        free = np.array(free)
        assert free.sum() > 10, f"eye {side}: no aperture found"
        e["out"] = nrm(dirs[free].mean(0))
        e["aperture"] = float(np.degrees(np.arccos(np.clip(dirs[free] @ e["out"], -1, 1)).max()))

    # Whisker anchors: the root is the end of the ribbon nearer the skin.
    anchors = []
    for wsk in b.whiskers:
        a, z = wsk["ends"]
        da, dz = kd2.find(a)[2], kd2.find(z)[2]
        root, tip = (a, z) if da < dz else (z, a)
        idx = wsk["idx"]
        nearest = idx[np.argsort(np.linalg.norm(co[idx] - root, axis=1))[:4]]
        anchors.append(dict(root=root, tip=tip, weights=Wfull[nearest].mean(0), gap=min(da, dz)))
    b.whiskers = anchors

    # base colour at each vertex (mean over its face corners)
    from PIL import Image
    img = np.asarray(Image.open(os.path.join(path, "ShortHairedCat_Color.jpg")).convert("RGB"), float) / 255.0
    img = np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)
    H, Wd = img.shape[:2]
    uvl = b.loop_uv.reshape(-1, 2)
    px = np.clip((uvl[:, 0] % 1.0) * (Wd - 1), 0, Wd - 1).astype(int)
    py = np.clip((1 - uvl[:, 1] % 1.0) * (H - 1), 0, H - 1).astype(int)
    rgb = img[py, px]
    acc = np.zeros((n, 3))
    cnt = np.zeros(n)
    np.add.at(acc, b.Q.ravel(), rgb)
    np.add.at(cnt, b.Q.ravel(), 1)
    b.tex_rgb = acc / np.maximum(cnt, 1)[:, None]
    log(f"base: subdivided body {n} verts, {len(b.Q)} quads")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return b
