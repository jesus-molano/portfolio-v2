"""The body mesh and its bare skin: nose leather, lips, eyelid rims, inner ears, pads.

Bare parts are found on the shaped rest mesh, in cat space, so they follow
the face whatever the pose:

- nose leather: the patch the base's artist painted pink, near the nose tip
  and above the mouth (the base's texture is only used to *find* it and for
  its fine detail: nostrils, the dark rim);
- lips: the skin along the closed mouth (`Base.lip_line`);
- eyelid rims: skin within a few millimetres of the eyeball;
- inner ears: ear skin facing forward, out of the ear's opening;
- pads: paw skin facing down at rest (the cat stands in the bind pose).

Colours come from the cat's `SKIN` (sRGB hex). The skin under the fur takes
the mean coat colour of the markings, darkened, so gaps between strands
never show a foreign colour. The shader multiplies bare skin by the base
texture's local detail (its luminance over the mean of that bare part), so
nostrils and the rim of the nose leather keep the sculpted look in any
colour; the base normal map is used on bare skin only (the head UVs are
mirrored, which is fine for symmetric detail).
"""

import numpy as np

import bpy

from .params import merged
from .vecmath import luminance, smoothstep, srgb

DEFAULT = dict(
    nose="#c98f8f",      # nose leather
    lips="#3a2b2d",      # lip line
    rims="#2b2224",      # eyelid rims
    inner_ear="#cfa6a6",  # inside the ear
    pads="#4f3f42",      # paw pads (rarely seen when sitting)
    darken=0.78,         # skin under the fur: mean coat colour x darken
    nose_gloss=0.38,     # roughness of the nose leather (wet look: lower)
    nose_detail=1.0,     # 0 = flat colour, 1 = the base's nostril and rim detail
    nose_size=1.0,       # grows (>1) or shrinks the found nose patch, about its centre
)


def params(spec):
    return merged(DEFAULT, spec, "skin")


def smoothfield(f, Q, iters=1):
    """Average a vertex field over its quads (each pass: vertex -> quad -> vertex)."""
    f = np.asarray(f, float)
    cnt = np.bincount(Q.ravel(), minlength=len(f)).astype(float)
    for _ in range(iters):
        fq = f[Q].mean(1)
        acc = np.bincount(Q.ravel(), np.repeat(fq, Q.shape[1]), minlength=len(f))
        f = acc / np.maximum(cnt, 1)
    return f


def _scaled(mask, c, front, s):
    """The mask grown (s > 1) or shrunk about its centre on the front of the muzzle."""
    from mathutils.kdtree import KDTree
    idx = np.nonzero(front)[0]
    pts = np.stack([c.hx[idx], c.hu[idx]], 1)
    w = mask[idx]
    if w.sum() < 1e-6:
        return mask
    centre = (pts * w[:, None]).sum(0) / w.sum()
    kd = KDTree(len(idx))
    for k, (x, u) in enumerate(pts):
        kd.insert((x, u, 0.0), k)
    kd.balance()
    out = mask.copy()
    src = centre + (pts - centre) / s
    for k, (x, u) in enumerate(src):
        out[idx[k]] = w[kd.find((x, u, 0.0))[1]]
    return out


def masks(c, Q, tex, lip_line, eyes, p=None):
    """Weights per rest vertex: nose, lips, rims, inner_ear, pads (0..1).

    c: CatSpace of the shaped rest mesh, Q its quads; tex: (N, 3) base colour (linear);
    eyes: {"L"/"R": dict(centre, radius)} in the shaped rest frame.
    """
    p = params(p or {})
    N = len(c.p)
    t = np.where(tex <= 0.0031308, tex * 12.92, 1.055 * np.power(np.maximum(tex, 0), 1 / 2.4) - 0.055)
    pink = t[:, 0] - t[:, 1]
    # the leather: pink texels on the front of the muzzle, around and below
    # the nose tip, inside a triangle narrowing toward the mouth (the base
    # also has pinkish follicle spots on the pads: they stay outside)
    du = c.hu - c.nose[2]
    half = 0.24 + 0.5 * np.clip(du, -0.25, 0.1)
    front = (c.head > 0.5) & (c.hf > c.nose[1] - 0.3)
    zone = front & (du > -0.24) & (du < 0.12) & (np.abs(c.hx) < half)
    nose = smoothfield(zone * smoothstep(0.06, 0.16, pink), Q, 2)
    nose = smoothstep(0.3, 0.6, nose)
    if abs(p["nose_size"] - 1.0) > 1e-6:
        nose = _scaled(nose, c, front, p["nose_size"])
    lips = np.zeros(N)
    if len(lip_line):
        lips[lip_line] = 1.0
    rims = np.zeros(N)
    gap = np.full(N, np.inf)
    for e in eyes.values():
        d = np.linalg.norm(c.p - e["centre"], axis=1) - e["radius"]
        gap = np.minimum(gap, d)
    rims = smoothstep(0.0032, 0.0012, gap)
    fwd = c.frame[:, 1]
    inner_ear = (c.ear > 0.5) * smoothstep(0.15, 0.45, c.n @ fwd)
    pads = (c.paw > 0.5) * smoothstep(-0.45, -0.75, c.n[:, 2])
    return dict(nose=nose, lips=lips, rims=rims, inner_ear=inner_ear, pads=pads, eye_gap=gap)


def colours(p, m, coat_mean, tex):
    """Per-vertex attributes for the skin shader.

    Returns skin (N, 3) linear colour, bare (N,) weight, ref (N,) the mean
    texture luminance of each vertex's bare part (for the detail ratio) and
    gloss (N,) roughness.
    """
    p = params(p)
    skin = coat_mean * p["darken"]
    lum = luminance(tex)
    bare = np.zeros(len(skin))
    ref = np.full(len(skin), max(float(lum.mean()), 1e-3))
    order = ("inner_ear", "pads", "rims", "lips", "nose")  # later ones win
    for name in order:
        w = np.clip(m[name], 0, 1)
        if not w.any():
            continue
        col = srgb(p[name])
        skin = skin * (1 - w[:, None]) + col * w[:, None]
        sel = w > 0.5
        if sel.any():
            ref[w > 0.2] = max(float(lum[sel].mean()), 1e-3)
        bare = np.maximum(bare, w)
    detail_on = np.maximum(m["nose"] * p["nose_detail"], 0.5 * np.maximum(m["lips"], m["pads"]))
    gloss = 0.6 - (0.6 - p["nose_gloss"]) * m["nose"]
    return skin, bare, ref, gloss, detail_on


# ----------------------------------------------------------------- Blender

def make_mesh(name, V, F, smooth=True):
    me = bpy.data.meshes.new(name)
    nv, nf = len(V), len(F)
    k = F.shape[1]
    me.vertices.add(nv)
    me.vertices.foreach_set("co", np.asarray(V, np.float32).ravel())
    me.loops.add(nf * k)
    me.loops.foreach_set("vertex_index", np.asarray(F, np.int32).ravel())
    me.polygons.add(nf)
    me.polygons.foreach_set("loop_start", np.arange(0, nf * k, k, dtype=np.int32))
    me.update(calc_edges=True)
    if smooth:
        me.polygons.foreach_set("use_smooth", np.ones(nf, bool))
    return me


def point_attr(me, name, values):
    """A float (N,) or colour (N, 3) attribute per vertex."""
    values = np.asarray(values, np.float32)
    if values.ndim == 1:
        a = me.attributes.new(name, "FLOAT", "POINT")
        a.data.foreach_set("value", values)
    else:
        a = me.color_attributes.new(name, "FLOAT_COLOR", "POINT")
        rgba = np.ones((len(values), 4), np.float32)
        rgba[:, :3] = values
        a.data.foreach_set("color", rgba.ravel())


def corner_uv(me, name, loop_uv):
    lay = me.uv_layers.new(name=name)
    lay.data.foreach_set("uv", np.asarray(loop_uv, np.float32).ravel())


def nodes_for(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes.new("ShaderNodeOutputMaterial")


def material(colour_tex, normal_tex):
    """Skin shader: coat colour under the fur, bare skin with the base's detail."""
    mat = bpy.data.materials.new("CatSkin")
    nt, out = nodes_for(mat)
    L = nt.links.new

    def attr(name):
        n = nt.nodes.new("ShaderNodeAttribute")
        n.attribute_name = name
        return n

    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "base"
    tc = nt.nodes.new("ShaderNodeTexImage")
    tc.image = bpy.data.images.load(colour_tex, check_existing=True)
    L(uv.outputs["UV"], tc.inputs["Vector"])
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    L(tc.outputs["Color"], bw.inputs["Color"])
    ratio = nt.nodes.new("ShaderNodeMath")
    ratio.operation = "DIVIDE"
    L(bw.outputs[0], ratio.inputs[0])
    L(attr("bare_ref").outputs["Fac"], ratio.inputs[1])
    clamp = nt.nodes.new("ShaderNodeClamp")
    clamp.inputs["Min"].default_value = 0.25
    clamp.inputs["Max"].default_value = 1.6
    L(ratio.outputs[0], clamp.inputs["Value"])
    # detail = mix(1, ratio, detail_on)
    mixd = nt.nodes.new("ShaderNodeMix")
    mixd.data_type = "FLOAT"
    L(attr("detail_on").outputs["Fac"], mixd.inputs["Factor"])
    mixd.inputs["A"].default_value = 1.0
    L(clamp.outputs[0], mixd.inputs["B"])
    mul = nt.nodes.new("ShaderNodeVectorMath")
    mul.operation = "SCALE"
    L(attr("skin_col").outputs["Color"], mul.inputs[0])
    L(mixd.outputs["Result"], mul.inputs["Scale"])
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    L(mul.outputs[0], bs.inputs["Base Color"])
    L(attr("gloss").outputs["Fac"], bs.inputs["Roughness"])
    bs.inputs["Subsurface Weight"].default_value = 0.12
    bs.inputs["Subsurface Radius"].default_value = (0.004, 0.0015, 0.001)
    bs.inputs["Subsurface Scale"].default_value = 1.0
    tn = nt.nodes.new("ShaderNodeTexImage")
    tn.image = bpy.data.images.load(normal_tex, check_existing=True)
    tn.image.colorspace_settings.name = "Non-Color"
    L(uv.outputs["UV"], tn.inputs["Vector"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.uv_map = "base"
    L(tn.outputs["Color"], nm.inputs["Color"])
    L(attr("bare").outputs["Fac"], nm.inputs["Strength"])
    L(nm.outputs["Normal"], bs.inputs["Normal"])
    L(bs.outputs[0], out.inputs[0])
    return mat


def clay_material(field=False):
    """Grey clay for shape reviews; with field=True it shows the `debug` colour."""
    mat = bpy.data.materials.new("Clay")
    nt, out = nodes_for(mat)
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bs.inputs["Roughness"].default_value = 0.55
    if field:
        a = nt.nodes.new("ShaderNodeAttribute")
        a.attribute_name = "debug"
        nt.links.new(a.outputs["Color"], bs.inputs["Base Color"])
    else:
        bs.inputs["Base Color"].default_value = (0.42, 0.42, 0.44, 1)
    nt.links.new(bs.outputs[0], out.inputs[0])
    return mat


def body_object(V, Q, loop_uv, attrs, mat, name="CatBody"):
    me = make_mesh(name, V, Q)
    corner_uv(me, "base", loop_uv)
    for k, v in attrs.items():
        point_attr(me, k, v)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob
