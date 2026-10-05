"""Reviews: numeric muzzle guards, face sheets and the line-up composite.

The owner's hard rule: a face must read unmistakably as a cat's, never as
anything else, at any size. The base's sculpted muzzle is what guarantees
it (shape.py cannot reach the muzzle except through the uniform head
scale); these guards measure it on the shaped rest mesh, in millimetres at
the cat's final size, and the build prints and records them:

- bridge: the midline profile from the brow (just ahead of the eyes) to the
  nose rises at most `BRIDGE_MM` above the straight line between them (a
  long bulging bridge is the shape to avoid);
- pads: along a line across the whisker pads, the front of the face bulges
  at most `PAD_MM` over the chord from the midline to the cheek, with no
  crease deeper than `CREASE_MM` between the nose and a pad (no round lobes);
- nose leather: at most `NOSE_MM` wide on an adult.

The bridge and crease limits are the plan's; the pad and nose limits are
calibrated on the base's own face, the one the owner approved (at a 35 cm
ear-tip height its pads bulge 4.2 mm over that chord and its leather is
14 mm wide), with a small margin: they catch a regression, not the base.

The sheets put each view at full size, 96 px and 48 px (the face must
still read at thumbnail size) and as 48 px silhouettes, on the line-up
wall's colour. A person signs them off.
"""

import os

import numpy as np

BRIDGE_MM = 1.5
PAD_MM = 5.0
CREASE_MM = 1.5
NOSE_MM = 15.0


def _envelope(x, y, lo, hi, step):
    """Max y per bin of x over [lo, hi]: bin centres and values (NaN for empty bins)."""
    edges = np.arange(lo, hi + step, step)
    cx, val = [], []
    for a, b in zip(edges[:-1], edges[1:]):
        m = (x >= a) & (x < b)
        cx.append(0.5 * (a + b))
        val.append(y[m].max() if m.any() else np.nan)
    cx, val = np.array(cx), np.array(val)
    ok = ~np.isnan(val)
    return cx[ok], val[ok]


def muzzle_guards(c, nose_mask, scale, adult=True):
    """The three guards (module doc), in mm at the final size. Returns a dict."""
    mm = c.E * scale * 1000.0  # millimetres per head unit
    head = c.head > 0.5
    nose = c.nose
    out = {}
    # bridge: upper midline profile (hu as a function of hf)
    mid = head & (np.abs(c.hx) < 0.06) & (c.hf > 0.12) & (c.hf <= nose[1] + 1e-6) & (c.hu > nose[2] - 0.05)
    f, u = _envelope(c.hf[mid], c.hu[mid], 0.12, nose[1], 0.02)
    if len(f) > 3:
        line = u[0] + (u[-1] - u[0]) * (f - f[0]) / max(f[-1] - f[0], 1e-9)
        out["bridge_rise_mm"] = float(max((u - line).max(), 0.0) * mm)
    # pads: front envelope (hf as a function of |hx|) at the pads' height
    hu_pad = nose[2] - 0.2
    band = head & (np.abs(c.hu - hu_pad) < 0.06) & (c.hf > -0.2)
    x, fr = _envelope(np.abs(c.hx[band]), c.hf[band], 0.0, 0.6, 0.04)
    if len(x) > 4:
        # bulge over the chord from the philtrum's edge to the pad's outer edge
        i0 = int(np.argmin(np.abs(x - 0.12)))
        x, fr = x[i0:], fr[i0:]
        chord = fr[0] + (fr[-1] - fr[0]) * (x - x[0]) / max(x[-1] - x[0], 1e-9)
        bulge = fr - chord
        out["pad_bulge_mm"] = float(max(bulge.max(), 0.0) * mm)
        xa, fa = _envelope(np.abs(c.hx[band]), c.hf[band], 0.0, 0.6, 0.04)
        k = int(np.argmax(fa[1:])) + 1  # the pad's peak, off the midline
        seg = fa[: k + 1]
        ch = seg[0] + (seg[-1] - seg[0]) * np.linspace(0, 1, len(seg))
        out["pad_crease_mm"] = float(max((ch - seg).max(), 0.0) * mm)
    m = nose_mask > 0.5
    if m.any():
        out["nose_width_mm"] = float((c.hx[m].max() - c.hx[m].min()) * mm)
    limits = dict(bridge_rise_mm=BRIDGE_MM, pad_bulge_mm=PAD_MM, pad_crease_mm=CREASE_MM)
    if adult:
        limits["nose_width_mm"] = NOSE_MM
    out["pass"] = {k: bool(out.get(k, 0.0) <= v) for k, v in limits.items()}
    out["limits"] = limits
    return out


def _wall(pal):
    from .vecmath import srgb, to_srgb
    return tuple(int(v * 255) for v in to_srgb(0.7 * srgb(pal["dusk"]) + 0.3 * srgb(pal["night"])))


def face_sheet(images, out, pal, label=""):
    """Columns per view: full size (320 px high), 96 px, 48 px and a 48 px silhouette."""
    from PIL import Image, ImageDraw
    wall = _wall(pal)
    cols = []
    for name, path in images:
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGBA")
        full = im.resize((max(1, int(im.width * 320 / im.height)), 320), Image.LANCZOS)
        t96 = im.resize((max(1, int(im.width * 96 / im.height)), 96), Image.LANCZOS)
        t48 = im.resize((max(1, int(im.width * 48 / im.height)), 48), Image.LANCZOS)
        a = np.asarray(t48)[..., 3] > 127
        sil = Image.fromarray(np.where(a, 20, 235).astype(np.uint8), "L").convert("RGBA")
        w = max(full.width, t96.width + t48.width + sil.width + 24)
        col = Image.new("RGBA", (w, 320 + 96 + 40), wall + (255,))
        col.alpha_composite(full, ((w - full.width) // 2, 0))
        col.alpha_composite(t96, (4, 328))
        col.alpha_composite(t48, (12 + t96.width, 328))
        col.alpha_composite(sil, (20 + t96.width + t48.width, 328))
        ImageDraw.Draw(col).text((4, 430), name, fill=(246, 241, 255, 255))
        cols.append(col)
    if not cols:
        return None
    W = sum(c.width for c in cols) + 8 * (len(cols) + 1)
    sheet = Image.new("RGBA", (W, 456 + 24), wall + (255,))
    x = 8
    for c in cols:
        sheet.alpha_composite(c, (x, 24))
        x += c.width + 8
    ImageDraw.Draw(sheet).text((8, 6), label, fill=(246, 241, 255, 255))
    sheet.convert("RGB").save(out)
    return out


def lineup_composite(entries, px_per_cm, out, pal, slot_cm=34.0, height_cm=60.0):
    """Line-up renders on a mock wall with a height chart, floors aligned.

    entries: [(slot 0..3, path, crop (x0, x1, z0, z1) in metres at the slot plane)].
    """
    from PIL import Image, ImageDraw
    wall = _wall(pal)
    W = int(round(4 * slot_cm * px_per_cm))
    H = int(round(height_cm * px_per_cm))
    sheet = Image.new("RGBA", (W, H), wall + (255,))
    d = ImageDraw.Draw(sheet)
    floor = H - int(round(8 * px_per_cm))
    for cm in range(0, int(height_cm) - 8, 5):
        y = floor - int(round(cm * px_per_cm))
        d.line([(0, y), (W, y)], fill=(255, 255, 255, 60 if cm % 10 else 110), width=1)
        if cm % 10 == 0:
            d.text((4, y - 12), f"{cm}", fill=(246, 241, 255, 200))
    for slot, path, crop in entries:
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGBA")
        cx = (slot + 0.5) * slot_cm * px_per_cm
        x = int(round(cx + crop[0] * 100 * px_per_cm))
        y = int(round(floor - crop[3] * 100 * px_per_cm))
        sheet.alpha_composite(im, (x, y))
        d.text((int(cx) - 4, 6), str(slot + 1), fill=(246, 241, 255, 255))
    d.line([(0, floor), (W, floor)], fill=(20, 10, 40, 255), width=2)
    sheet.convert("RGB").save(out)
    return out
