"""THE USUAL SUSPECTS: build and render the cats of the line-up interlude.

One shared generator (the `cats` package next to this file) turns the
XR Blocks "Cat" by Google (Apache-2.0; fetched from a pinned commit,
hash-checked and kept outside the repo, see cats/base.py) into each of the
four suspects. What makes a cat itself is data in `cats/suspects/<cat>.py`,
one file per cat, so each can be tuned on its own: size, proportions, the
line-up sit and the face, coat colours and markings, fur, eyes, skin,
whiskers, Odin's halo.

Run with Blender 4.5 as a Python module (bpy), from the repo root:

  XDG_CONFIG_HOME=$(mktemp -d) nice /home/user/.venvs/bpy/bin/python \\
      tools/blender/build_cats.py -- --cat tom --render <out dir> \\
      [--quality clay|test|final] [--views lineup,face,face34,profile,q34] \\
      [--field coat|length|<cat-space field>] [--density F] [--blend]

--cat        kira, tom, dante, odin, neutral (the shared defaults), or all
             (the four suspects in turn, then a line-up composite);
--quality    clay: bare skin in grey clay under neutral studio lights, no fur
             (anatomy and pose; seconds). test: fur at half density, 48
             samples, 12 px/cm (minutes). final: full fur, adaptive 64-256
             samples, 24 px/cm;
--views      lineup (the shared level camera; the image is cropped to the cat
             and its box in slot-plane cm is in the report), q34 (whole cat,
             3/4), face, face34, profile (head close-ups);
--field      paints the clay with a field instead of grey: `coat` (the
             markings' mean colour: fast coat work), `length` (fur length),
             `bare` (nose, lips, rims, inner ears, pads) or any CatSpace
             field (hx, hf, hu, s, dorsal, lateral, leg_t, tail_u, ...);
--blend      also saves the scene as <cat>.blend.

Outputs in the render folder: <cat>-<view>.png, <cat>-sheet.png (every view
at full size, 96 px, 48 px and as a silhouette: the face must read as a cat
at thumbnail size), <cat>-report.json (sizes, paw and ear-tip heights,
footprint, joint positions in floor cm for tail paths, the muzzle guards,
strand counts, timings) and with --cat all, lineup.png.

Deterministic: every random draw comes from numpy's PCG64 seeded with the
CRC-32 of the cat's key; Cycles uses a fixed seed.
"""

import argparse
import json
import math
import os
import sys
import time
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

import bpy  # noqa: E402

from cats import base, catspace, coat, eyes, fur, halo, pose, review, rig, shape, skin, stage, suspects, whiskers  # noqa: E402,E501
from cats.vecmath import mat4, rot_axis, vertex_normals, xform  # noqa: E402

T0 = time.time()

QUALITY = {
    # samples, px per cm (line-up), close-up px, fur density factor
    "clay": dict(samples=16, px_cm=8, res=480, density=0.0),
    "test": dict(samples=48, px_cm=12, res=640, density=0.5),
    "final": dict(samples=256, px_cm=24, res=1024, density=1.0),
}
VIEWS = {
    "lineup": dict(kind="lineup"),
    "q34": dict(kind="orbit", target="body", az=35.0, el=4.0, dist=1.9, lens=135.0),
    "face": dict(kind="orbit", target="head", az=0.0, el=2.0, dist=0.62, lens=100.0),
    "face34": dict(kind="orbit", target="head", az=35.0, el=4.0, dist=0.62, lens=100.0),
    "profile": dict(kind="orbit", target="head", az=90.0, el=2.0, dist=0.62, lens=100.0),
}


def log(*a):
    print(f"[{time.time() - T0:7.1f}s]", *a, flush=True)


def seeds(key):
    ss = np.random.SeedSequence(zlib.crc32(key.encode()))
    return [np.random.default_rng(s) for s in ss.spawn(4)]  # fur, whiskers, spare, spare


# ------------------------------------------------------------------ build

class Cat:
    """Everything built for one cat, in world metres (floor z = 0, slot centre x = y = 0)."""


def build(b, spec, quality, work, field=None, density=None, log=log):
    q = QUALITY[quality]
    cat = Cat()
    cat.spec = spec
    rng_fur, rng_wsk, _, _ = seeds(spec.key)
    t = time.time()
    skel0 = rig.Skeleton(b.names, b.parent, b.rest)
    head0 = catspace.head_frame(skel0)
    rest2, G, shape_p = shape.build(skel0, spec.shape, head_frame=head0[1])
    skel = skel0.copy(rest2)
    Vr = rig.skin(b.V, b.W, G)
    cs = catspace.compute(skel, Vr, b.Q, b.W)
    eyes_r = {}
    for side, e in b.eyes.items():
        Gj = G[e["joint"]]
        eyes_r[side] = dict(centre=xform(Gj, e["centre"]),
                            radius=e["radius"] * abs(np.linalg.det(Gj[:3, :3])) ** (1 / 3))
    sk = skin.params(spec.skin)
    masks = skin.masks(cs, b.Q, b.tex_rgb, b.lip_line, eyes_r, sk)

    # pose, floor, size
    basis = pose.sit(skel, b.clip, spec.pose)
    P = skel.fk(basis)
    V = rig.skin(b.V, b.W, skel.skin_matrices(P, rest2, G))
    body = cs.tail < 0.5
    z0 = V[body, 2].min()
    cx = 0.5 * (V[body, 0].min() + V[body, 0].max())
    cy = pose.footprint(skel, P)[1]
    ear_top = V[cs.ear > 0.5, 2].max()
    scale = spec.ear_tip_cm * 0.01 / (ear_top - z0)
    # again with the paw offsets in final centimetres (they hardly move the ears)
    basis = pose.sit(skel, b.clip, spec.pose, unit=1.0 / scale)
    P = skel.fk(basis)
    V = rig.skin(b.V, b.W, skel.skin_matrices(P, rest2, G))
    z0 = V[body, 2].min()
    cx = 0.5 * (V[body, 0].min() + V[body, 0].max())
    cy = pose.footprint(skel, P)[1]
    scale = spec.ear_tip_cm * 0.01 / (V[cs.ear > 0.5, 2].max() - z0)
    Mw = mat4(np.eye(3) * scale) @ mat4(t=-np.array([cx, cy, z0]))
    pp = pose.merged(spec.pose)
    if pp["tail"]:
        basis = pose.tail_path(skel, basis, pp["tail"], Mw, pp["tail_tip_lift"])
        P = skel.fk(basis)
    Pw = Mw @ P
    K = Mw @ skel.skin_matrices(P, rest2, G)
    V = rig.skin(b.V, b.W, K)
    V = pose.relax(V, b.Q, pose.belly_weights(cs), pp["relax"]["belly"])
    N = vertex_normals(V, b.Q)
    cat.V, cat.N, cat.Q, cat.K, cat.Pw, cat.cs, cat.Vr = V, N, b.Q, K, Pw, cs, Vr
    cat.scale = scale
    cat.masks = masks
    cat.head = catspace.head_frame(skel, Pw)
    log(f"{spec.key}: shape and pose in {time.time() - t:.1f}s; scale {scale:.3f}")

    # coat colour on the skin
    pal = coat.palette(spec.palette)
    probs = coat.probabilities(pal, spec.markings(cs), len(Vr))
    coat_mean = coat.mean_colour(pal, probs)
    skin_col, bare, ref, gloss, detail_on = skin.colours(sk, masks, coat_mean, b.tex_rgb)
    attrs = dict(skin_col=skin_col, bare=bare, bare_ref=ref, gloss=gloss, detail_on=detail_on)
    clay = quality == "clay"
    if field:
        attrs["debug"] = field_colours(field, cs, masks, coat_mean, spec)
        mat = skin.clay_material(field=True)
    elif clay:
        mat = skin.clay_material()
    else:
        mat = skin.material(os.path.join(b.dir, "ShortHairedCat_Color.jpg"), b.normal_map)
    cat.body = skin.body_object(V, b.Q, b.loop_uv, attrs, mat)
    cat.objects = [cat.body]

    # eyes
    ep = eyes.params(spec.eyes)
    cat.eyes = eyes.place(b.eyes, K, cat.head[1], stage.lens_position(), pp["gaze"], ep)
    cat.objects += eyes.build(cat.eyes, ep, work, spec.key)

    # fur and whiskers
    cat.strands = 0
    cat.extra_points = [V]
    bvh = fur.bvh_of(V, b.Q)
    fp = fur.params(spec.fur)
    L, dens, regions = fur.length_field(cs, fp, masks)
    cat.L = L
    if not clay and not field:
        t = time.time()
        comb = fur.comb_field(skel, cs, b.W, eyes_r)
        lift = fur.lift_field(fp, regions)
        dfac = q["density"] if density is None else density
        parts = fur.build(rng_fur, fp, cs, Vr, V, b.Q, N, comb, L, dens, lift, pal, spec.markings,
                          density_factor=dfac, inner_ear=masks["inner_ear"],
                          ear_param=cs.ear_t, log=log)
        if fp["collide"]:
            parts[0] = (fur.collide(parts[0][0], bvh, log=log), parts[0][1], parts[0][2])
        for i in range(1, len(parts)):
            parts[i][0][..., 2] = np.maximum(parts[i][0][..., 2], 0.0002)
        furob = fur.make_curves("Fur", parts)
        furob.data.materials.append(fur.material("Fur", fp["hair"]))
        cat.objects.append(furob)
        cat.strands = fur.strands_count(parts)
        cat.extra_points.append(np.concatenate([p[0][:, -1] for p in parts])[::7])
        log(f"{spec.key}: fur {cat.strands} strands in {time.time() - t:.1f}s")
        wp = whiskers.params(spec.whiskers)
        wpts, wrad, wcol, _ = whiskers.build(b.whiskers, K, head0, cat.head, bvh, wp, rng_wsk, scale)
        wob = fur.make_curves("Whiskers", [(wpts, wrad, wcol)])
        wob.data.materials.append(fur.material("Whisker", dict(fp["hair"], roughness=wp["roughness"],
                                                                coat=0.4, random_roughness=0.05)))
        cat.objects.append(wob)
        cat.extra_points.append(wpts.reshape(-1, 3))

    # halo
    hp = halo.params(spec.halo)
    cat.halo = None
    if hp["enabled"]:
        head_v = (cs.head > 0.5)
        crown = V[head_v][np.argmax(V[head_v, 2])]
        ear_pts = V[(cs.ear > 0.5) & (V[:, 2] > V[cs.ear > 0.5, 2].max() - 0.03)]
        ear_pts = ear_pts + np.array([0, 0, fp["length"]["ear"] * 1e-3 + fp["lynx"]["length"] * 1e-3])
        bases = [Pw[skel.i(c[0]), :3, 3] for c in rig.EARS.values()]
        centre, R, Rm, gap = halo.place(hp, crown, bases, ear_pts, stage.lens_position())
        power = halo.light_power(hp, centre, crown)
        ob, light = halo.build(hp, stage.tokens(), centre, R, Rm, cat.objects, power)
        cat.halo = dict(centre=centre.tolist(), radius=R, clearance_cm=gap * 100, light_w=power,
                        crown_cm=(crown * 100).tolist())
        cat.extra_points.append(np.array([centre + Rm @ [R * math.cos(a), R * math.sin(a), 0]
                                          for a in np.linspace(0, 2 * math.pi, 32)]))
    cat.guards = review.muzzle_guards(cs, masks["nose"], scale, adult=spec.adult)
    return cat


def field_colours(name, cs, masks, coat_mean, spec):
    """Debug colours per vertex for --field."""
    if name == "coat":
        return coat_mean
    if name == "bare":
        out = np.full((len(cs.p), 3), 0.5)
        for k, col in (("inner_ear", (0.9, 0.5, 0.5)), ("pads", (0.2, 0.2, 0.6)), ("rims", (0.1, 0.1, 0.1)),
                       ("lips", (0.6, 0.1, 0.1)), ("nose", (1.0, 0.3, 0.6))):
            w = np.clip(masks[k], 0, 1)[:, None]
            out = out * (1 - w) + np.array(col) * w
        return out
    if name == "length":
        fp = fur.params(spec.fur)
        L, _, _ = fur.length_field(cs, fp, masks)
        v = L / max(L.max(), 1e-9)
    else:
        v = np.asarray(getattr(cs, name), float)
        lo, hi = np.percentile(v, 1), np.percentile(v, 99)
        v = (v - lo) / max(hi - lo, 1e-9)
    v = np.clip(v, 0, 1)
    # a blue-white-red ramp with bands every 0.1 so values can be read
    band = 0.85 + 0.15 * (np.floor(v * 10) % 2)
    rgb = np.stack([v, 1 - np.abs(v - 0.5) * 2, 1 - v], 1) * band[:, None]
    return rgb ** 2.2


# ------------------------------------------------------------------ report

def report(cat, b):
    spec = cat.spec
    V, cs = cat.V, cat.cs
    out = dict(cat=spec.key, name=spec.name, number=spec.number, scale=cat.scale)
    out["ear_tip_cm"] = round(float(V[cs.ear > 0.5, 2].max() * 100), 2)
    out["ear_tip_target_cm"] = spec.ear_tip_cm
    paws = {}
    for key, chain in rig.LEGS.items():
        w = rig_subtree_weight(b, chain[2])
        sel = w > 0.5
        paws[key] = round(float(V[sel, 2].min() * 100), 2)
    out["paw_floor_cm"] = paws
    out["footprint_cm"] = dict(x=[round(float(V[:, 0].min() * 100), 1), round(float(V[:, 0].max() * 100), 1)],
                               y=[round(float(V[:, 1].min() * 100), 1), round(float(V[:, 1].max() * 100), 1)])
    out["tail_lowest_cm"] = round(float(V[cs.tail > 0.5, 2].min() * 100), 2)
    T = np.array([cat.Pw[b.names.index(n), :3, 3] for n in rig.TAIL])
    out["tail_length_cm"] = round(float(np.linalg.norm(np.diff(T, axis=0), axis=1).sum() * 100), 1)
    names = ["Tail01", "Tail04", "Tail07", "Head", "Pelvis", "Chest"] + [c[2] for c in rig.LEGS.values()]
    out["joints_floor_cm"] = {n: [round(float(v), 1) for v in cat.Pw[b.names.index(n), :3, 3] * 100] for n in names}
    out["eyes"] = {s: dict(radius_mm=round(e["radius"] * 1000, 2), turn_deg=round(e["turn"], 1))
                   for s, e in cat.eyes.items()}
    out["guards"] = cat.guards
    out["strands"] = cat.strands
    out["halo"] = cat.halo
    return out


def rig_subtree_weight(b, name):
    idx = b.subtree(name)
    return b.W[:, idx].sum(1)


# ------------------------------------------------------------------ render

def render_views(cat, views, quality, out_dir, threads, samples=None, field=None):
    q = QUALITY[quality]
    pal = stage.tokens()
    spec = cat.spec
    stage.setup_render(quality, threads=threads, samples=samples or q["samples"])
    stage.world(pal, 0.25 if quality != "clay" else 0.6)
    clay = quality == "clay" or field
    pts = np.concatenate(cat.extra_points)
    origin, F, E = cat.head
    head_c = origin - F[:, 1] * 0.25 * E - F[:, 2] * 0.15 * E
    done = {}
    for view in views:
        v = VIEWS[view]
        stage.clear()
        if v["kind"] == "lineup":
            cam = stage.lineup_camera()
            crop = stage.frame_lineup(q["px_cm"], pts)
            done[view] = dict(crop_m=[float(x) for x in crop])
            target = np.array([0, 0, 0.2])
            az = 0.0
        else:
            target = head_c if v["target"] == "head" else np.array([0, 0, 0.5 * pts[:, 2].max()])
            cam = stage.orbit_camera(target, v["az"], v["el"], v["dist"], lens=v["lens"], res=q["res"])
            az = v["az"]
        if clay:
            stage.studio_lights(target, np.array(cam.location))
        else:
            lights = stage.lineup_lights(pal, gains=spec.lights)
            if az:
                R = rot_axis([0, 0, 1.0], math.radians(az))
                for li in lights:
                    li.location = tuple(R @ np.array(li.location))
                    stage.look_at(li, target + np.array([0, 0, 0.02]))
        path = os.path.join(out_dir, f"{spec.key}-{view}.png")
        t = time.time()
        stage.render(path)
        log(f"{spec.key}: {view} rendered in {time.time() - t:.1f}s -> {path}")
        done.setdefault(view, {})["path"] = path
    return done


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--cat", default="neutral", help="kira, tom, dante, odin, neutral or all")
    ap.add_argument("--render", required=True, help="output folder (outside the repo)")
    ap.add_argument("--quality", default="test", choices=sorted(QUALITY))
    ap.add_argument("--views", default="lineup,face,face34,profile")
    ap.add_argument("--field", default=None)
    ap.add_argument("--density", type=float, default=None, help="fur density factor (overrides the quality's)")
    ap.add_argument("--samples", type=int, default=None)
    ap.add_argument("--threads", type=int, default=3)
    ap.add_argument("--base", default=None, help="folder with the pinned base (default: a cache folder)")
    ap.add_argument("--no-fetch", action="store_true")
    ap.add_argument("--blend", action="store_true")
    args = ap.parse_args(argv)
    out_dir = os.path.abspath(args.render)
    repo = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if out_dir.startswith(repo + os.sep):
        raise SystemExit("render into a folder outside the repo (renders are reviewed, not committed)")
    os.makedirs(out_dir, exist_ok=True)
    views = [v for v in args.views.split(",") if v]
    for v in views:
        if v not in VIEWS:
            raise SystemExit(f"unknown view {v!r}; one of {', '.join(VIEWS)}")
    keys = suspects.CATS if args.cat == "all" else (args.cat,)
    b = base.load(base.ensure(args.base, fetch=not args.no_fetch), log=log)
    composite = []
    for key in keys:
        spec = suspects.load(key)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        work = os.path.join(out_dir, "work")
        os.makedirs(work, exist_ok=True)
        cat = build(b, spec, args.quality, work, field=args.field, density=args.density)
        rep = report(cat, b)
        done = render_views(cat, views, args.quality, out_dir, args.threads, args.samples, args.field)
        rep["views"] = done
        g = rep["guards"]
        log(f"{key}: ear tip {rep['ear_tip_cm']} cm (target {spec.ear_tip_cm}), paws {rep['paw_floor_cm']}, "
            f"guards " + ", ".join(f"{k} {g.get(k, float('nan')):.2f}{'' if ok else ' FAIL'}"
                                    for k, ok in g["pass"].items()))
        with open(os.path.join(out_dir, f"{key}-report.json"), "w") as f:
            json.dump(rep, f, indent=1)
        imgs = [(v, done[v]["path"]) for v in views if v in done]
        review.face_sheet(imgs, os.path.join(out_dir, f"{key}-sheet.png"), stage.tokens(),
                          label=f"{spec.name} N° {spec.number:02d} ({args.quality})")
        if "lineup" in done:
            composite.append((max(spec.number - 1, 0), done["lineup"]["path"], done["lineup"]["crop_m"]))
        if args.blend:
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, f"{key}.blend"))
    if len(composite) > 1:
        review.lineup_composite(composite, QUALITY[args.quality]["px_cm"], os.path.join(out_dir, "lineup.png"),
                                stage.tokens())
    log("done")


if __name__ == "__main__":
    main()
