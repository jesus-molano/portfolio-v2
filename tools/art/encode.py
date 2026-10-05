#!/usr/bin/env python3
"""Encodes rendered PNGs for the web (tools/art).

    python3 tools/art/encode.py <in.png> <out-stem> [--webp-quality 82] [--avif-quality 60] [--width 216]

Writes <out-stem>.avif and <out-stem>.webp, metadata stripped, and prints
both sizes. With --width, the image is first scaled down to that width
(Lanczos, the aspect ratio kept): a smaller variant for a srcset. Needs
Pillow 11 or newer with WebP and AVIF support.
"""
import argparse
import os

from PIL import Image, features


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("stem")
    parser.add_argument("--webp-quality", type=int, default=82)
    parser.add_argument("--avif-quality", type=int, default=60)
    parser.add_argument("--width", type=int, default=0)
    args = parser.parse_args()
    if not (features.check("webp") and features.check("avif")):
        raise SystemExit("Pillow needs WebP and AVIF support (pip install 'pillow>=11')")

    image = Image.open(args.source)
    image.load()
    if args.width and args.width < image.width:
        height = round(image.height * args.width / image.width)
        image = image.resize((args.width, height), Image.Resampling.LANCZOS)
    # Opaque art is encoded without an alpha channel: smaller, and no fringe.
    if image.mode == "RGBA" and image.getchannel("A").getextrema() == (255, 255):
        image = image.convert("RGB")
    os.makedirs(os.path.dirname(args.stem) or ".", exist_ok=True)
    image.save(f"{args.stem}.webp", "WEBP", quality=args.webp_quality, method=6, exif=b"", icc_profile=None)
    image.save(f"{args.stem}.avif", "AVIF", quality=args.avif_quality, speed=4, exif=b"", icc_profile=None)
    for ext in ("avif", "webp"):
        print(f"{args.stem}.{ext}\t{os.path.getsize(f'{args.stem}.{ext}') // 1024} KB")


if __name__ == "__main__":
    main()
