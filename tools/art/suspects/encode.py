"""Encode one RGBA PNG of the line-up as WebP (q82) and AVIF (q60).

    python3 tools/art/suspects/encode.py <in.png> <out stem>

Writes <out stem>.webp and <out stem>.avif with straight alpha and no
metadata (no EXIF, no ICC, no XMP). Needs Pillow >= 11 with WebP and AVIF.
"""

import sys

from PIL import Image, features

if not (features.check("webp") and features.check("avif")):
    sys.exit("encode.py: this Pillow has no WebP or AVIF support")

source, stem = sys.argv[1], sys.argv[2]
image = Image.open(source).convert("RGBA")
image.info.clear()
image.save(f"{stem}.webp", "WEBP", quality=82, alpha_quality=100, method=6)
image.save(f"{stem}.avif", "AVIF", quality=60, speed=4, max_threads=1)
