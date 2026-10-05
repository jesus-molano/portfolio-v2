"""Eyes: an eyeball with a painted iris behind a glass cornea, aimed at the lens.

The base's eyeballs are replaced (base.py keeps their centre and radius and
the joint that carries them). Each eye here is two meshes:

- the eyeball: a sphere whose front cap (the iris, `iris` x the radius
  across) is pressed flat, so the iris sits a few millimetres behind the
  cornea like a real anterior chamber. It carries the painted iris (fibres,
  a darker limbal ring, the pupil) in a UV projection along the gaze, with
  the pupil's long axis on the head's up axis;
- the cornea: a clear sphere a hair larger than the eyeball (IOR 1.376).
  Shadow rays pass straight through it (a glass shell would otherwise put
  the iris in its own shadow), camera rays refract and reflect: the
  catchlight and the depth of a real eye.

Gaze: by default each eye looks at the line-up lens (cats in a mugshot
look at the camera), then `pose.gaze` yaw / pitch (degrees, the pose
module's signs: yaw + to image right) are added; the result is held within
`max_turn` degrees of the eye opening so no white shows.

Pupil: `pupil.width` and `pupil.height` in iris radii. A narrow width is a
slit with pointed ends; toward width / height = 0.7 it rounds into an oval.
"""

import math
import os

import numpy as np

import bpy
import bmesh  # noqa: E402  (needs bpy first)
from mathutils import Matrix

from .params import merged
from .skin import nodes_for
from .vecmath import nrm, rot_axis, rot_between, slerp_rot, smoothstep, srgb

DEFAULT = dict(
    inner="#b7b85a",     # iris colour near the pupil
    outer="#6e8d3e",     # iris colour at the rim
    limbus="#33402a",    # the dark ring round the iris
    sclera="#5a5446",    # what shows outside the iris (little, on a cat)
    pupil=dict(width=0.14, height=0.86),
    iris=0.84,           # iris radius / eyeball radius
    fibres=1.0,          # strength of the iris fibres and blotches
    glow=0.0,            # iris emission (keep 0 unless the eyes go dead)
    size=1.0,            # eyeball radius factor on top of the shape's eye scale
    max_turn=24.0,       # degrees the gaze may leave the eye opening
)


def params(spec):
    return merged(DEFAULT, spec, "eyes")


def paint_iris(path, p, res=512, seed=11):
    """The iris texture: u, v in [0, 1] cover the eyeball's projected disc."""
    from PIL import Image

    from .noise import fbm

    xs = np.linspace(-1, 1, res)
    X, Z = np.meshgrid(xs, -xs)
    r = np.hypot(X, Z)
    ang = np.arctan2(Z, X)
    ir = p["iris"]
    rr = r / ir  # 1 at the iris rim
    pts = np.stack([np.cos(ang) * 3, np.sin(ang) * 3, rr * 6], -1).reshape(-1, 3)
    fib = fbm(pts * np.array([6.0, 6.0, 1.0]), 3, seed=seed).reshape(r.shape)
    blot = fbm(np.stack([X * 7, Z * 7, np.zeros_like(X)], -1).reshape(-1, 3), 3, seed + 1).reshape(r.shape)
    ci, co = srgb(p["inner"]), srgb(p["outer"])
    t = smoothstep(0.15, 0.85, rr)[..., None]
    col = ci * (1 - t) + co * t
    k = p["fibres"]
    col = col * (1 + k * (0.55 * fib[..., None] - 0.3)) * (1 + k * (0.3 * blot[..., None] - 0.15))
    limb = smoothstep(0.78, 0.97, rr)[..., None]
    col = col * (1 - limb) + srgb(p["limbus"]) * limb
    scl = smoothstep(0.985, 1.02, rr)[..., None]
    col = col * (1 - scl) + srgb(p["sclera"]) * scl
    # pupil: half-width at height z is w * (1 - (z/h)^2)^e, e from 1 (a
    # pointed slit) to 0.5 (an ellipse) as it dilates
    w, h = p["pupil"]["width"] * ir, p["pupil"]["height"] * ir
    e = 1.0 - 0.5 * smoothstep(0.25, 0.7, p["pupil"]["width"] / max(p["pupil"]["height"], 1e-3))
    zz = np.clip(np.abs(Z) / h, 0, 1)
    half = w * np.power(np.clip(1 - zz ** 2, 0, 1), e)
    aa = 2.5 / res
    pm = smoothstep(aa, -aa, np.abs(X) - half) * (np.abs(Z) < h)
    col = col * (1 - pm[..., None]) + srgb("#060608") * pm[..., None]
    c8 = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(np.maximum(col, 0), 1 / 2.4) - 0.055)
    Image.fromarray((np.clip(c8, 0, 1) * 255).astype(np.uint8), "RGB").save(path)
    return path


def _eyeball(R, iris, nu=72, nv=48):
    """Unit-frame eyeball (gaze +Z): vertices, quads, uv per vertex."""
    th = np.linspace(0, math.pi, nv + 1)[1:-1]
    ph = np.linspace(0, 2 * math.pi, nu, endpoint=False)
    T, Pp = np.meshgrid(th, ph, indexing="ij")
    x = np.sin(T) * np.cos(Pp)
    y = np.sin(T) * np.sin(Pp)
    z = np.cos(T)
    V = np.stack([x, y, z], -1).reshape(-1, 3)
    ti = math.asin(min(iris, 0.99))
    flat = T.ravel() < ti
    V[flat, 2] = math.cos(ti)
    V = np.vstack([[0, 0, math.cos(ti)], V, [0, 0, -1.0]]) * R
    n = nu
    F = []
    for i in range(len(th) - 1):
        for j in range(n):
            a = 1 + i * n + j
            b = 1 + i * n + (j + 1) % n
            c = 1 + (i + 1) * n + (j + 1) % n
            d = 1 + (i + 1) * n + j
            F.append([a, d, c, b])
    F = np.array(F)
    caps = []
    for j in range(n):
        caps.append([0, 1 + j, 1 + (j + 1) % n])
        last = 1 + (len(th) - 1) * n
        caps.append([len(V) - 1, last + (j + 1) % n, last + j])
    uv = 0.5 + 0.5 * V[:, :2] / R
    return V, F, np.array(caps), uv


def eye_material(name, iris_path, glow):
    mat = bpy.data.materials.new(name)
    nt, out = nodes_for(mat)
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "iris"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(iris_path, check_existing=True)
    tex.extension = "EXTEND"
    nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
    nt.links.new(tex.outputs["Color"], bs.inputs["Emission Color"])
    bs.inputs["Emission Strength"].default_value = glow
    bs.inputs["Roughness"].default_value = 0.42
    bs.inputs["Specular IOR Level"].default_value = 0.2
    nt.links.new(bs.outputs[0], out.inputs[0])
    return mat


def cornea_material():
    mat = bpy.data.materials.get("Cornea")
    if mat:
        return mat
    mat = bpy.data.materials.new("Cornea")
    nt, out = nodes_for(mat)
    glass = nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["IOR"].default_value = 1.376
    glass.inputs["Roughness"].default_value = 0.0
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs[0])
    nt.links.new(glass.outputs[0], mix.inputs[1])
    nt.links.new(clear.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return mat


def place(eyes_rest, K, head_F, lens, gaze, p):
    """Posed eye centres, radii and gaze frames.

    eyes_rest: base eyes (centre, radius, joint, out) in the base rest frame;
    K: (B, 4, 4) skinning matrices from that rest frame to the world;
    head_F: posed head frame columns (left, forward, up).
    Returns {side: dict(centre, radius, frame (3x3 columns x, y=up, z=gaze))}.
    """
    out = {}
    up_h = head_F[:, 2]
    for side, e in eyes_rest.items():
        M = K[e["joint"]]
        c = M[:3, :3] @ e["centre"] + M[:3, 3]
        s = abs(np.linalg.det(M[:3, :3])) ** (1 / 3)
        R = e["radius"] * s * p["size"]
        opening = nrm(M[:3, :3] @ e["out"])
        g = nrm(np.asarray(lens, float) - c)
        g = rot_axis([0, 0, 1.0], -math.radians(gaze.get("yaw", 0.0))) @ g
        g = rot_axis(head_F[:, 0], -math.radians(gaze.get("pitch", 0.0))) @ g
        ang = math.degrees(math.acos(np.clip(g @ opening, -1, 1)))
        if ang > p["max_turn"]:
            g = slerp_rot(rot_between(opening, g), p["max_turn"] / ang) @ opening
        y = nrm(up_h - (up_h @ g) * g)
        x = np.cross(y, g)
        out[side] = dict(centre=c, radius=R, frame=np.stack([x, y, g], 1), opening=opening, turn=ang)
    return out


def build(placed, p, work, name):
    """Eyeball and cornea objects for the placed eyes. Returns the objects."""
    iris = paint_iris(os.path.join(work, f"{name}-iris.png"), p)
    mat = eye_material(f"{name}Eye", iris, p["glow"])
    cmat = cornea_material()
    obs = []
    for side, e in placed.items():
        V, F, caps, uv = _eyeball(e["radius"], p["iris"])
        Vw = V @ e["frame"].T + e["centre"]
        me = bpy.data.meshes.new(f"Eye.{side}")
        me.from_pydata(Vw.tolist(), [], F.tolist() + caps.tolist())
        me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), bool))
        lay = me.uv_layers.new(name="iris")
        vi = np.empty(len(me.loops), np.int32)
        me.loops.foreach_get("vertex_index", vi)
        lay.data.foreach_set("uv", uv[vi].astype(np.float32).ravel())
        me.materials.append(mat)
        ob = bpy.data.objects.new(f"Eye.{side}", me)
        bpy.context.scene.collection.objects.link(ob)
        obs.append(ob)
        # cornea
        cm = bpy.data.meshes.new(f"Cornea.{side}")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=40, radius=e["radius"] * 1.012)
        bm.to_mesh(cm)
        bm.free()
        cm.polygons.foreach_set("use_smooth", np.ones(len(cm.polygons), bool))
        cm.materials.append(cmat)
        co = bpy.data.objects.new(f"Cornea.{side}", cm)
        M = np.eye(4)
        M[:3, :3] = e["frame"]
        M[:3, 3] = e["centre"]
        co.matrix_world = Matrix(M.tolist())
        bpy.context.scene.collection.objects.link(co)
        obs.append(co)
    return obs
