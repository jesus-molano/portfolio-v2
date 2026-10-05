"""THE USUAL SUSPECTS: render the line-up layers the site ships in public/interlude.

The four suspects (kira, tom, dante, odin) come from the shared generator
(`build_cats.build`, data in `cats/suspects/<cat>.py`) in their line-up sit,
and are shot here as ONE set, so they match on the page:

- one stage: `stage.lineup_camera()` (135 mm, level at 26 cm, 3.2 m in
  front of the slot) and `stage.lineup_lights()` with ONE set of gains for
  all four (`GAINS`). The per-cat `LIGHTS` in the cats' files are ignored on
  purpose: the line-up is one photograph. If a cat looks wrong under the
  shared rig, fix the cat (coat, fur), not the light;
- one render setting: Cycles, `SAMPLES` samples with OpenImageDenoise, full
  fur density, `PX_PER_CM` pixels per centimetre at the slot plane, the same
  seed, transparent film;
- one contact shadow: a second pass of the same camera and crop in which the
  cat is invisible to the camera but still casts shadows onto a shadow
  catcher floor, lit only by one large soft light straight overhead
  (`SHADOW`). That gives a soft dark pool under the paws, body and tail,
  never a long cast shadow. It is baked into the layer's alpha as `night`
  (src/design/tokens.ts) under the cat.

Stages (all by default; each reads what the one before wrote; `render` is
`beauty` and `shadow`, which can also run on their own):

1. render: per cat, `<cat>-beauty.png` (RGBA, straight alpha) and
   `<cat>-shadow.png` (the floor band, shadow in the alpha, with
   `<cat>-shadow.json`), plus `<cat>-geometry.json` (the crop in full-frame
   pixels and the projected floor contact, slot centre and head width) and
   `<cat>-report.json` (the generator's report: sizes, paws, strands);
2. compose: per cat, `<cat>.png`, the shipping layer: cat over its contact
   shadow, cropped to what is visible, with the colour of the nearest
   visible pixels carried under the transparent ones (so lossy encoders and
   4:2:0 chroma never pull a dark or light fringe into the edges);
   `manifest.json` (the site's contract, below) and `lineup-review.png`
   (the four on the page's wall colours and height chart, floors on one
   line, for a person to look at);
3. encode (with `--encode <dir>`, the repo's public/interlude): `<cat>.avif`
   and `<cat>.webp` (no metadata: no Exif, XMP or ICC; straight alpha), and
   the manifest; it stops if an AVIF is over `AVIF_MAX` or the four over
   `AVIF_TOTAL`, and it refuses `--check` layers.

The manifest, in image pixels: `w` x `h`; `floorY`, the row where the cat
meets the floor (the front paws' floor contact, projected through the
camera: the page puts it on the chart's floor line); `headTopY`, the highest
row of the head, ear tips and their fur included (alpha >= 0.5);
`centerX`, the column of the slot centre; `headWidth`, the head across the
cheeks (the skin's width at cheek height plus the cheek fur on both sides).
`pxPerCm` is `PX_PER_CM`. No cat carries a halo, so none sets `haloInImage`.

Run with Blender 4.5 as a Python module (bpy), from the repo root:

  XDG_CONFIG_HOME=$(mktemp -d) nice /home/user/.venvs/bpy/bin/python \\
      tools/blender/render_interlude.py -- --out <folder outside the repo> \\
      [--cats kira,tom,dante,odin] [--stages render,compose,encode] \\
      [--encode public/interlude] [--threads 4] [--check]

--check renders at the generator's `test` quality (half fur density, 48
samples, 12 px/cm) to look at the light and sizes in minutes; check renders
are never encoded.

Deterministic: the generator seeds every draw from the cat's key, Cycles
uses seed 0, compose and encode have no randomness. The base model (the
XR Blocks "Cat", Apache-2.0) is fetched from its pinned commit and checked
by hash (cats/base.py); nothing personal is read.
"""

import argparse
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

import bpy  # noqa: E402

import build_cats  # noqa: E402
from cats import base, fur, rig, stage, suspects  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
CATS = suspects.CATS  # kira, tom, dante, odin: the slot order

# ONE render setting for the four layers.
PX_PER_CM = 24
SAMPLES = 64
QUALITY = "final"  # the generator's full fur density and final Cycles preset (adaptive min = SAMPLES)
CHECK = "test"

# ONE light rig: the shared line-up rig (cats/stage.py) with one set of gains.
# The cats' own LIGHTS asked for rim 0.2-0.6 and kicker 0.3-0.75. Side by
# side, anything over Kira's 0.2 / 0.3 washes the long coats (hers, Dante's)
# and even Tom's white flank in magenta, which reads as a coloured halo on
# the violet wall; at 0.2 / 0.3 every coat keeps its colour and the pink
# stays a thin edge. The hair light at 1.2 parts the dark coats from the wall.
GAINS = dict(key=1.0, rim=0.2, kicker=0.3, hair=1.2)
WORLD = 0.25

# ONE contact shadow (the module doc).
SHADOW = dict(
    light_size=0.5,   # m, square area light: about 0.6 cm of penumbra at the toes, 3 cm at the belly
    light_height=1.6,  # m above the floor, straight over the slot centre
    opacity=0.6,      # the darkest the pool gets, as alpha
    floor_band=0.05,  # m above the floor line (slot plane) rendered for the shadow
    blur_px=1.5,      # a Gaussian on the shadow's alpha (sigma, pixels at PX_PER_CM)
    cutoff=0.05,      # shadow alpha under this is dropped (no haze, no stray penumbra far out)
)

# The site's image budget (public/interlude/README.md, lineup.test.ts).
AVIF_MAX = 90 * 1024
AVIF_TOTAL = 360 * 1024
AVIF = dict(quality=70, speed=4, subsampling="4:4:4", range="full", alpha_premultiplied=False, max_threads=1)
WEBP = dict(quality=82, alpha_quality=100, method=6, exact=True)

T0 = time.time()


def log(*a):
    print(f"[{time.time() - T0:7.1f}s]", *a, flush=True)


# ------------------------------------------------------------------ camera geometry

def project(P, res):
    """World points (N, 3) to continuous full-frame pixels: u from the left, v from the bottom."""
    P = np.asarray(P, float).reshape(-1, 3)
    D, H, F = stage.CAM_DIST, stage.CAM_HEIGHT, stage.FRAME_M
    t = D / np.maximum(P[:, 1] + D, 1e-3)  # onto the slot plane through the lens
    xs = P[:, 0] * t
    zs = H + (P[:, 2] - H) * t
    return (xs / F + 0.5) * res, ((zs - H) / F + 0.5) * res


def set_border(res, x0, x1, y0, y1):
    """Render exactly full-frame pixels [x0, x1) x [y0, y1) (y from the bottom).

    Blender truncates border x resolution to whole pixels; a quarter pixel
    in from each edge makes that truncation land on the intended pixel.
    """
    r = bpy.context.scene.render
    r.use_border = True
    r.use_crop_to_border = True
    r.border_min_x, r.border_max_x = (x0 + 0.25) / res, (x1 + 0.25) / res
    r.border_min_y, r.border_max_y = (y0 + 0.25) / res, (y1 + 0.25) / res


def pixel_crop(res):
    """The integer pixel box of the border `stage.frame_lineup` chose (grown to whole pixels)."""
    r = bpy.context.scene.render
    x0 = int(math.floor(r.border_min_x * res))
    x1 = int(math.ceil(r.border_max_x * res))
    y0 = int(math.floor(r.border_min_y * res))
    y1 = int(math.ceil(r.border_max_y * res))
    return x0, x1, y0, y1


def geometry(cat, b, res, crop):
    """Where the floor contact, the slot centre and the head fall in the full frame."""
    V, cs = cat.V, cat.cs
    floor = []
    for key in ("fore.L", "fore.R"):
        sel = build_cats.rig_subtree_weight(b, rig.LEGS[key][2]) > 0.5
        zmin = V[sel, 2].min()
        if zmin > 0.006:  # a raised paw does not touch the floor
            continue
        contact = V[sel & (V[:, 2] < zmin + 0.003)]
        _, v = project(contact, res)
        floor.append(float(v.min()))  # the front edge of the paw: the lowest point in the picture
    if not floor:  # no front paw down: the slot plane's floor line
        floor = [float(project([[0, 0, 0]], res)[1][0])]
    origin, F, E = cat.head
    head = (cs.head > 0.5) & (cs.ear < 0.5)
    band = head & (V[:, 2] > origin[2] - 0.6 * E) & (V[:, 2] < origin[2] + 0.1 * E)
    u, _ = project(V[band], res)
    fp = fur.params(cat.spec.fur)
    cheek_mm = max(fp["length"]["cheek"], fp["length"]["face"])
    head_px = (u.max() - u.min()) + 2 * cheek_mm / 10.0 * (res / (stage.FRAME_M * 100))
    _, v_ear = project(V[cs.ear > 0.5], res)
    return dict(res=res, crop=list(crop), centre_u=res / 2.0, floor_v=float(np.mean(floor)),
                floor_v_paws=floor, head_width_px=float(head_px), ear_skin_v=float(v_ear.max()))


# ------------------------------------------------------------------ render

def render_cat(b, key, out, threads, check, passes=("beauty", "shadow")):
    spec = suspects.load(key)
    quality = CHECK if check else QUALITY
    q = build_cats.QUALITY[quality]
    px_cm = q["px_cm"] if check else PX_PER_CM
    samples = q["samples"] if check else SAMPLES
    bpy.ops.wm.read_factory_settings(use_empty=True)
    work = os.path.join(out, "work")
    os.makedirs(work, exist_ok=True)
    cat = build_cats.build(b, spec, quality, work, log=log)
    rep = build_cats.report(cat, b)
    if cat.halo:
        raise SystemExit(f"{key}: the line-up has no halo (owner); its HALO must stay off")
    pal = stage.tokens()
    sc = bpy.context.scene
    stage.setup_render(quality, threads=threads, samples=samples)
    stage.clear()
    stage.lineup_camera()
    stage.frame_lineup(px_cm, np.concatenate(cat.extra_points))
    res = sc.render.resolution_x
    crop = pixel_crop(res)
    geo = geometry(cat, b, res, crop)
    geo.update(px_per_cm=px_cm, quality=quality, samples=samples, gains=GAINS)

    if "beauty" in passes:  # the cat under the shared rig
        stage.world(pal, WORLD)
        set_border(res, *crop)
        lights = stage.lineup_lights(pal, gains=GAINS)
        path = os.path.join(out, f"{key}-beauty.png")
        t = time.time()
        stage.render(path)
        log(f"{key}: beauty in {time.time() - t:.1f}s")
        w, h = Image.open(path).size
        if (w, h) != (crop[1] - crop[0], crop[3] - crop[2]):
            raise SystemExit(f"{key}: rendered {w}x{h}, expected the border {crop}")
        for li in lights:
            bpy.data.objects.remove(li)
        with open(os.path.join(out, f"{key}-geometry.json"), "w") as f:
            json.dump(geo, f, indent=1)
        with open(os.path.join(out, f"{key}-report.json"), "w") as f:
            json.dump(rep, f, indent=1)

    if "shadow" in passes:  # the contact shadow: cat invisible to the camera, one soft light overhead
        stage.world(pal, 0.0)
        for ob in bpy.data.objects:
            if not ob.get("stage"):
                ob.visible_camera = False
        s = 1.5
        me = bpy.data.meshes.new("Floor")
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
        floor = stage.link(bpy.data.objects.new("Floor", me))
        floor.is_shadow_catcher = True
        stage.area_light("Contact", (0.0, 0.0, SHADOW["light_height"]), (0.0, 0.0, 0.0), 100.0, (1, 1, 1),
                         SHADOW["light_size"])
        _, v_top = project([[0, 0, SHADOW["floor_band"]]], res)
        ys1 = min(crop[3], int(math.ceil(v_top[0])))
        set_border(res, crop[0], crop[1], crop[2], ys1)
        path = os.path.join(out, f"{key}-shadow.png")
        t = time.time()
        stage.render(path)
        log(f"{key}: contact shadow in {time.time() - t:.1f}s")
        w, h = Image.open(path).size
        if (w, h) != (crop[1] - crop[0], ys1 - crop[2]):
            raise SystemExit(f"{key}: shadow rendered {w}x{h}, expected the band {crop[:3] + [ys1]}")
        with open(os.path.join(out, f"{key}-shadow.json"), "w") as f:
            json.dump(dict(crop=list(crop), rows=[crop[2], ys1], shadow=SHADOW, px_per_cm=px_cm,
                           quality=quality, samples=samples), f, indent=1)
    log(f"{key}: ear tip {rep['ear_tip_cm']} cm, paws {rep['paw_floor_cm']}, strands {rep['strands']}")


# ------------------------------------------------------------------ compose

def gaussian(a, sigma):
    if sigma <= 0:
        return a
    r = int(math.ceil(3 * sigma))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.pad(a, r, mode="edge")
    tmp = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 0, pad)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 1, tmp)


def bleed(rgb, a):
    """Colour under transparent pixels from the nearest visible ones (push-pull).

    Straight alpha keeps every visible pixel's colour as rendered; only fully
    transparent pixels change, so the picture is the same and the encoders'
    chroma subsampling has no black to blend into the edges.
    """
    levels = [(rgb * a[..., None], a)]  # premultiplied colour, weight <= 1
    while min(levels[-1][1].shape) > 1:
        c, w = levels[-1]
        H, W = w.shape
        H2, W2 = (H + 1) // 2, (W + 1) // 2
        c2 = np.pad(c, ((0, H2 * 2 - H), (0, W2 * 2 - W), (0, 0))).reshape(H2, 2, W2, 2, 3).sum((1, 3))
        w2 = np.pad(w, ((0, H2 * 2 - H), (0, W2 * 2 - W))).reshape(H2, 2, W2, 2).sum((1, 3))
        k = 1.0 / np.maximum(w2, 1.0)
        levels.append((c2 * k[..., None], w2 * k))
    c, w = levels[-1]
    fill = c / np.maximum(w, 1e-12)[..., None]
    for c, w in reversed(levels[:-1]):
        H, W = w.shape
        up = np.repeat(np.repeat(fill, 2, 0), 2, 1)[:H, :W]
        fill = c + (1 - w)[..., None] * up  # this level over the coarser fill
    out = rgb.copy()
    hole = a <= 0
    out[hole] = fill[hole]
    return out


def compose_cat(key, out, pal):
    geo = json.load(open(os.path.join(out, f"{key}-geometry.json")))
    im = np.asarray(Image.open(os.path.join(out, f"{key}-beauty.png")).convert("RGBA")).astype(np.float64) / 255
    rgb, a = im[..., :3], im[..., 3]
    H, W = a.shape
    x0, x1, y0, y1 = geo["crop"]
    # the shadow band sits at the bottom of the frame
    sh = np.asarray(Image.open(os.path.join(out, f"{key}-shadow.png")).convert("RGBA")).astype(np.float64) / 255
    S = np.zeros_like(a)
    S[H - sh.shape[0]:] = sh[..., 3]
    S = gaussian(S, SHADOW["blur_px"] * geo["px_per_cm"] / PX_PER_CM)
    S = np.clip((S - SHADOW["cutoff"]) / (1 - SHADOW["cutoff"]), 0, 1) * SHADOW["opacity"]
    night = np.array([int(pal["night"][i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    A = a + (1 - a) * S
    P = rgb * a[..., None] + night * (S * (1 - a))[..., None]
    RGB = np.where(A[..., None] > 0, P / np.maximum(A, 1e-12)[..., None], 0)
    # crop to what shows (alpha 3/255 and up: nothing fainter can be seen), a 2 px clear margin
    vis = A >= 3.0 / 255
    rows, cols = np.where(vis.any(1))[0], np.where(vis.any(0))[0]
    r0, r1 = max(rows[0] - 2, 0), min(rows[-1] + 3, H)
    c0, c1 = max(cols[0] - 2, 0), min(cols[-1] + 3, W)
    RGB, A, a = RGB[r0:r1, c0:c1], A[r0:r1, c0:c1], a[r0:r1, c0:c1]
    A8 = np.round(A * 255).astype(np.uint8)
    RGB = bleed(RGB, A8 / 255.0)
    rgba = np.dstack([np.round(np.clip(RGB, 0, 1) * 255).astype(np.uint8), A8])
    Image.fromarray(rgba, "RGBA").save(os.path.join(out, f"{key}.png"), optimize=True)
    # the manifest, in this image's pixels (rows from the top)
    head_rows = np.where((a >= 0.5).any(1))[0]
    entry = dict(
        w=int(rgba.shape[1]),
        h=int(rgba.shape[0]),
        floorY=int(round(y1 - geo["floor_v"] - r0)),
        headTopY=int(head_rows[0]),
        centerX=int(round(geo["centre_u"] - x0 - c0)),
        headWidth=int(round(geo["head_width_px"])),
    )
    ppc = geo["px_per_cm"]
    log(f"{key}: {entry['w']}x{entry['h']}, head top {(entry['floorY'] - entry['headTopY']) / ppc:.2f} cm over "
        f"the floor, reaches {entry['centerX'] / ppc:.1f} cm left and {(entry['w'] - entry['centerX']) / ppc:.1f} "
        f"cm right of the slot centre, {(entry['h'] - entry['floorY']) / ppc:.2f} cm under the floor line")
    return entry, ppc


def review(entries, ppc, out, pal):
    """The four on the page's wall (lineup tokens), floors on one line, a 5 cm chart."""
    toks = page_tokens()
    wall_hi, wall_lo, floor_c = (hexrgb(toks.get(k, d)) for k, d in
                                 (("wallHigh", "#1f1243"), ("wallLow", "#33255f"), ("floor", "#150b2e")))
    slot = 16 / 0.62  # lineup.ts WIDE_SLOT_CM
    W = int(round((4 * slot + 8) * ppc))
    floor = int(round(52 * ppc))
    H = floor + int(round(12 * ppc))
    sheet = np.zeros((H, W, 3))
    t = np.linspace(0, 1, floor)[:, None]
    sheet[:floor] = (np.array(wall_hi) * (1 - t) + np.array(wall_lo) * t)[:, None, :]
    sheet[floor:] = floor_c
    img = Image.fromarray(np.round(sheet).astype(np.uint8), "RGB").convert("RGBA")
    d = ImageDraw.Draw(img)
    for cm in range(5, 50, 5):
        y = floor - int(round(cm * ppc))
        d.line([(0, y), (W, y)], fill=(210, 190, 255, 90 if cm % 10 == 0 else 40), width=1)
        if cm % 10 == 0:
            d.text((6, y - 14), str(cm), fill=(240, 230, 255, 200))
    d.line([(0, floor), (W, floor)], fill=(255, 240, 230, 110), width=1)
    for i, key in enumerate(CATS):
        e = entries[key]
        cat = Image.open(os.path.join(out, f"{key}.png"))
        cx = int(round((4 + (i + 0.5) * slot) * ppc))
        img.alpha_composite(cat, (cx - e["centerX"], floor - e["floorY"]))
        top = floor - (e["floorY"] - e["headTopY"])
        d.line([(cx - 40, top), (cx + 40, top)], fill=(255, 120, 200, 200), width=1)
        d.text((cx - 60, floor + 12), f"{i + 1} {key} {(e['floorY'] - e['headTopY']) / ppc:.1f} cm",
               fill=(240, 230, 255, 255))
    img.convert("RGB").save(os.path.join(out, "lineup-review.png"))


def page_tokens():
    path = os.path.join(REPO, "src", "design", "tokens.ts")
    try:
        import re
        src = open(path, encoding="utf-8").read()
        m = re.search(r"export const lineup = \{(.*?)\} as const;", src, re.S)
        return dict(re.findall(r'(\w+):\s*"(#[0-9a-fA-F]{6})"', m.group(1))) if m else {}
    except OSError:
        return {}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# ------------------------------------------------------------------ encode

def write_manifest(folder, entries, ppc):
    """manifest.json, the site's contract: pxPerCm and each cat's box, in slot order."""
    manifest = dict(pxPerCm=ppc, cats={k: entries[k] for k in CATS})
    with open(os.path.join(folder, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def encode(out, dest, entries, ppc):
    os.makedirs(dest, exist_ok=True)
    sizes = {}
    for key in CATS:
        im = Image.open(os.path.join(out, f"{key}.png")).convert("RGBA")
        im.info.clear()
        avif = os.path.join(dest, f"{key}.avif")
        webp = os.path.join(dest, f"{key}.webp")
        im.save(avif, "AVIF", **AVIF)
        im.save(webp, "WEBP", **WEBP)
        sizes[key] = (os.path.getsize(avif), os.path.getsize(webp))
        log(f"{key}: avif {sizes[key][0] / 1024:.1f} KB, webp {sizes[key][1] / 1024:.1f} KB")
    total = sum(s[0] for s in sizes.values())
    over = [k for k, s in sizes.items() if s[0] > AVIF_MAX]
    if over or total > AVIF_TOTAL:
        raise SystemExit(f"over the image budget: {over or ''} total {total / 1024:.1f} KB")
    write_manifest(dest, entries, ppc)
    log(f"avif total {total / 1024:.1f} KB of {AVIF_TOTAL / 1024:.0f}")
    return sizes


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", required=True, help="work folder outside the repo")
    ap.add_argument("--cats", default=",".join(CATS))
    ap.add_argument("--stages", default="render,compose,encode")
    ap.add_argument("--encode", default=None, help="folder for the shipped files (public/interlude)")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--check", action="store_true", help="test quality, never encoded")
    ap.add_argument("--base", default=None)
    ap.add_argument("--no-fetch", action="store_true")
    args = ap.parse_args(argv)
    out = os.path.abspath(args.out)
    if out.startswith(REPO + os.sep):
        raise SystemExit("render into a folder outside the repo (the shipped files go through --encode)")
    os.makedirs(out, exist_ok=True)
    keys = [k for k in args.cats.split(",") if k]
    for k in keys:
        if k not in CATS:
            raise SystemExit(f"unknown cat {k!r}; one of {', '.join(CATS)}")
    stages = set(args.stages.split(","))
    pal = stage.tokens()
    passes = [p for p in ("beauty", "shadow") if p in stages or "render" in stages]
    if passes:
        b = base.load(base.ensure(args.base, fetch=not args.no_fetch), log=log)
        for key in keys:
            render_cat(b, key, out, args.threads, args.check, passes)
    if "compose" in stages or "encode" in stages:
        missing = [f"{k}-{n}.json" for k in CATS for n in ("geometry", "shadow")
                   if not os.path.exists(os.path.join(out, f"{k}-{n}.json"))]
        if missing:
            raise SystemExit(f"render first ({', '.join(missing)}): the line-up is composed from all four")
        geos = {k: json.load(open(os.path.join(out, f"{k}-geometry.json"))) for k in CATS}
        shads = {k: json.load(open(os.path.join(out, f"{k}-shadow.json"))) for k in CATS}
        settings = {(g["quality"], g["samples"], g["px_per_cm"], json.dumps(g["gains"], sort_keys=True),
                     json.dumps(shads[k]["shadow"], sort_keys=True), shads[k]["crop"] == g["crop"])
                    for k, g in geos.items()}
        if len(settings) > 1 or not all(x[-1] for x in settings):
            raise SystemExit(f"the layers in {out} were rendered with different settings {settings}: "
                             "render the four again together")
        entries = {k: compose_cat(k, out, pal)[0] for k in CATS}
        ppc = geos[CATS[0]]["px_per_cm"]
        write_manifest(out, entries, ppc)
        review(entries, ppc, out, pal)
        if "encode" in stages and args.encode:
            g = geos[CATS[0]]
            if ((g["quality"], g["samples"], g["px_per_cm"], g["gains"]) != (QUALITY, SAMPLES, PX_PER_CM, GAINS)
                    or shads[CATS[0]]["shadow"] != SHADOW or shads[CATS[0]]["samples"] != SAMPLES):
                raise SystemExit("only layers rendered at the one shipping setting are encoded (not --check)")
            encode(out, os.path.abspath(args.encode), entries, ppc)
    log("done")


if __name__ == "__main__":
    main()
