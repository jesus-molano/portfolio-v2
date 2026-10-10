#!/usr/bin/env python3
"""The load menu's thumbnails (LOAD GAME / CARGAR PARTIDA, src/features/load).

    python3 tools/art/load/thumbs.py

One 16:9 still per save slot, cut from the site's own pictures: the hero's
drive into the city and the army's board (the share card's frames,
tools/art/og/keyart/frames, and the board's English twin in
tools/art/load/frames), Dante mid-strike (the character select's
render), the STATS portrait, the Afterglow at night and the credits' dawn
plate (the board, the cinema and the plate lettered per locale, so two of
each). Writes
public/load/<name>-<width>.{avif,webp} at 160 and 320 px wide, metadata
stripped, transparent where the source is (the slot's own colour shows
through). Deterministic: a rerun writes the same bytes. Rerun it when one
of those pictures changes.
"""
import os

from PIL import Image, features

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "public", "load")
WIDTHS = (160, 320)
LOCALES = ("en", "es")

# name: (source, the crop's centre as fractions of the room the 16:9 box has to move in, x and y)
THUMBS = {
    "hero": ("tools/art/og/keyart/frames/hero-chase.webp", (0.5, 0.5)),
    "suspects": ("public/interlude/dante-swipe.webp", (0.5, 0.3)),
    # The army's board is lettered per locale: the share card's Spanish frame, and its English twin
    # shot the same way (tools/art/load/frames/army-en.webp, the stage at army.card0 on /en).
    "work-es": ("tools/art/og/keyart/frames/army.webp", (0.5, 0.5)),
    "work-en": ("tools/art/load/frames/army-en.webp", (0.5, 0.5)),
    "stats": ("public/stats/portrait.webp", (0.5, 0.2)),
    **{f"projects-{l}": (f"tools/art/og/keyart/frames/cinema-{l}.webp", (0.5, 0.55)) for l in LOCALES},
    **{f"credits-{l}": (f"public/finale/dawn-wide-{l}.webp", (0.2, 0.92)) for l in LOCALES},
}
# The dawn plate is 16:9 already: a close look at the car parked at the picture palace after the
# last show, under its marquee (whose letters are the page's own, live, never on the plate).
ZOOM = {f"credits-{l}": 0.42 for l in LOCALES}


def crop_16_9(image: Image.Image, at: tuple[float, float], zoom: float) -> Image.Image:
    w, h = image.size
    cw = min(w, round(h * 16 / 9)) * zoom
    ch = cw * 9 / 16
    x = (w - cw) * at[0]
    y = (h - ch) * at[1]
    return image.crop((round(x), round(y), round(x + cw), round(y + ch)))


def main() -> None:
    if not (features.check("webp") and features.check("avif")):
        raise SystemExit("Pillow needs WebP and AVIF support (pip install 'pillow>=11')")
    os.makedirs(OUT, exist_ok=True)
    for name, (source, at) in THUMBS.items():
        image = Image.open(os.path.join(ROOT, source))
        image.load()
        image = image.convert("RGBA") if "A" in image.getbands() else image.convert("RGB")
        still = crop_16_9(image, at, ZOOM.get(name, 1.0))
        for width in WIDTHS:
            small = still.resize((width, round(width * 9 / 16)), Image.Resampling.LANCZOS)
            if small.mode == "RGBA" and small.getchannel("A").getextrema() == (255, 255):
                small = small.convert("RGB")
            stem = os.path.join(OUT, f"{name}-{width}")
            small.save(f"{stem}.webp", "WEBP", quality=80, method=6, exif=b"", icc_profile=None)
            small.save(f"{stem}.avif", "AVIF", quality=55, speed=4, exif=b"", icc_profile=None)
            sizes = "  ".join(f"{ext} {os.path.getsize(f'{stem}.{ext}') / 1024:.1f} KB" for ext in ("avif", "webp"))
            print(f"{name}-{width}  {sizes}")


if __name__ == "__main__":
    main()
