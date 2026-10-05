"""Odin's halo: a generic golden ring floating over his head, and its light.

The floating ring of the dead in Dragon Ball, as a plain shape: no
character, no logo. A torus with a slightly flattened tube:

- ring radius = `radius` x the distance between the ear bases;
- tube = `tube` mm thick, `flatten` its height over its width;
- centred over the crown, `height` cm above it (raised further if needed so
  the ring clears every ear tip by `clearance` cm), and tilted `tilt`
  degrees toward the camera so it reads as an ellipse, not a line.

It glows (`sodium` at the outer edge to `amber` inside, from the site's
tokens) and carries a small point light at its centre that is light-linked
to the cat only: a faint warm rim on his crown, ears and whisker tops,
nothing more (the plan caps the gain at 15%). `light` is the power for a
ring 5 cm above the crown, scaled with the square of the actual distance.
Measured on Odin's test build, face view, ring hidden, top quarter of his
head (ears, crown, brow): 2 W adds 44% luminance and 6 W 63%, so the
default 0.3 W stays near 10%. Light linking keeps it off everything but
the cat (the floor and shadow catchers included).
"""

import math

import numpy as np

import bpy
from mathutils import Matrix

from .params import merged
from .skin import nodes_for
from .vecmath import nrm, rot_axis, srgb

DEFAULT = dict(
    enabled=False,
    radius=0.55,      # x the distance between the ear bases
    tube=4.0,         # mm
    flatten=0.75,
    height=5.0,       # cm above the crown
    tilt=15.0,        # degrees, toward the camera
    clearance=1.0,    # cm to the ear tips, at least
    strength=1.6,     # emission (higher burns to cream under the tone mapping; the glow is post)
    light=0.3,        # W for a ring 5 cm above the crown (see the module doc)
    light_radius=0.03,
)


def params(spec):
    return merged(DEFAULT, spec, "halo")


def torus(R, r, flatten, nu=160, nv=24):
    u = np.linspace(0, 2 * math.pi, nu, endpoint=False)
    v = np.linspace(0, 2 * math.pi, nv, endpoint=False)
    U, Vv = np.meshgrid(u, v, indexing="ij")
    x = (R + r * np.cos(Vv)) * np.cos(U)
    y = (R + r * np.cos(Vv)) * np.sin(U)
    z = r * flatten * np.sin(Vv)
    P = np.stack([x, y, z], -1).reshape(-1, 3)
    F = []
    for i in range(nu):
        for j in range(nv):
            a = i * nv + j
            b = ((i + 1) % nu) * nv + j
            c = ((i + 1) % nu) * nv + (j + 1) % nv
            d = i * nv + (j + 1) % nv
            F.append([a, b, c, d])
    return P, np.array(F)


def place(p, crown, ear_bases, ear_tips, lens):
    """Centre, ring radius and orientation (3x3) of the halo; asserts the clearance."""
    R = p["radius"] * float(np.linalg.norm(ear_bases[0] - ear_bases[1]))
    r = p["tube"] * 1e-3
    to_cam = nrm(np.array([lens[0] - crown[0], lens[1] - crown[1], 0.0]))
    axis = nrm(np.cross([0, 0, 1.0], to_cam))  # tilt about the horizontal across the view
    Rm = rot_axis(axis, math.radians(p["tilt"]))
    centre = np.array([crown[0], crown[1], crown[2] + p["height"] * 0.01])
    for _ in range(60):
        gap = clearance(centre, Rm, R, r, ear_tips)
        if gap >= p["clearance"] * 0.01:
            break
        centre[2] += 0.002
    gap = clearance(centre, Rm, R, r, ear_tips)
    assert gap >= p["clearance"] * 0.01 - 1e-6, f"halo clears the ears by only {gap * 100:.2f} cm"
    return centre, R, Rm, gap


def clearance(centre, Rm, R, r, points):
    """Smallest distance from the points to the torus surface."""
    P = (np.asarray(points) - centre) @ Rm  # into the ring's frame (z = ring axis)
    rho = np.hypot(P[:, 0], P[:, 1])
    d = np.hypot(rho - R, P[:, 2]) - r
    return float(d.min())


def light_power(p, centre, crown):
    """The halo light's watts: `light` at 5 cm, kept constant on the crown at other heights."""
    d = float(np.linalg.norm(np.asarray(centre) - np.asarray(crown)))
    return p["light"] * (d / 0.05) ** 2


def build(p, pal, centre, R, Rm, receivers, power):
    """Ring mesh, glow material and the light-linked point light."""
    P, F = torus(R, p["tube"] * 1e-3, p["flatten"])
    me = bpy.data.meshes.new("Halo")
    me.from_pydata(P.tolist(), [], F.tolist())
    me.polygons.foreach_set("use_smooth", np.ones(len(F), bool))
    mat = bpy.data.materials.new("Halo")
    nt, out = nodes_for(mat)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    vlen = nt.nodes.new("ShaderNodeVectorMath")
    vlen.operation = "LENGTH"
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs["X"], comb.inputs["X"])
    nt.links.new(sep.outputs["Y"], comb.inputs["Y"])
    nt.links.new(comb.outputs[0], vlen.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = R - p["tube"] * 1e-3
    mr.inputs["From Max"].default_value = R + p["tube"] * 1e-3
    nt.links.new(vlen.outputs["Value"], mr.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*srgb(pal["amber"]), 1)
    mix.inputs[7].default_value = (*srgb(pal["sodium"]), 1)
    nt.links.new(mr.outputs["Result"], mix.inputs["Factor"])
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bs.inputs["Base Color"].default_value = (*srgb("#c8962e"), 1)
    bs.inputs["Metallic"].default_value = 1.0
    bs.inputs["Roughness"].default_value = 0.3
    nt.links.new(mix.outputs[2], bs.inputs["Emission Color"])
    bs.inputs["Emission Strength"].default_value = p["strength"]
    nt.links.new(bs.outputs[0], out.inputs[0])
    me.materials.append(mat)
    ob = bpy.data.objects.new("Halo", me)
    M = np.eye(4)
    M[:3, :3] = Rm
    M[:3, 3] = centre
    ob.matrix_world = Matrix(M.tolist())
    bpy.context.scene.collection.objects.link(ob)
    ob.visible_shadow = False
    li = bpy.data.lights.new("HaloLight", "POINT")
    li.energy = power
    li.color = tuple(float(c) for c in srgb(pal["amber"]))
    li.shadow_soft_size = p["light_radius"]
    lo = bpy.data.objects.new("HaloLight", li)
    lo.location = tuple(float(v) for v in centre)
    bpy.context.scene.collection.objects.link(lo)
    lo.lightgroup = "halo"
    ob.lightgroup = "halo"
    coll = bpy.data.collections.new("HaloReceivers")
    for r_ob in receivers:
        coll.objects.link(r_ob)
    lo.light_linking.receiver_collection = coll
    return ob, lo
