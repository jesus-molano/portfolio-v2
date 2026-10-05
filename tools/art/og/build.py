#!/usr/bin/env python3
"""The link preview cards (Open Graph and Twitter), one per locale.

    python3 tools/art/og/build.py [--locale en] [--font path/to/BebasNeue-Regular.ttf]

Takes the cinema's wide night plate (public/finale/night-wide-<locale>.webp,
whose box office is lettered in that language), hangs his name and role on
its marquee in the cinema's changeable letters (Bebas Neue, accents taped
on, as the page does), hangs the four posters in their cases, lights the
bulb strips along the board and writes a
1200 x 630 JPEG to public/og/<locale>.jpg (under 300 KB, metadata
stripped). Deterministic: the same plate gives the same card.

Beside the cards it writes tools/art/og/sources.json: for each locale, the
words on the marquee and the SHA-256 of the plate, of each poster and of
the card it made. src/lib/shareCard.test.ts recomputes them, so a card
left behind by a new plate, poster, name or role fails the tests.

The marquee geometry comes from src/features/finale/plates.json, the
colours from src/design/tokens.ts, the words from the dictionaries
(hero.name, hero.role); the size and the weight cap mirror
src/lib/shareCard.ts, whose test checks the files. Bebas Neue is fetched once from Google Fonts into
.art-cache/fonts/ (Git ignores it) unless --font names a local copy. Needs
Pillow with WebP support.
"""
import argparse
import hashlib
import json
import math
import os
import random
import re
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SIZE = (1200, 630)
MAX_BYTES = 300 * 1024
LOCALES = ("en", "es")
FONT_CACHE = os.path.join(ROOT, ".art-cache", "fonts", "bebas-neue.ttf")
SOURCES = os.path.join(ROOT, "tools", "art", "og", "sources.json")
FONT_CSS = "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap"

# The marquee's metrics, as src/features/finale/finaleLayout.ts lays them out (em).
CAP_HEIGHT = 0.704
TILE_GAP = 0.08
SPACE_ADVANCE = 0.32
BOARD_MARGIN = 0.03
ACCENTED = {"Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U", "Ñ": "N"}


def read(path: str) -> str:
    with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
        return handle.read()


def token(name: str) -> str:
    """A colour from tokens.ts, by its key (the first match: keys are unique where they are used here)."""
    match = re.search(rf"\b{name}: \"([^\"]+)\"", read("src/design/tokens.ts"))
    if not match:
        raise SystemExit(f"no token {name} in src/design/tokens.ts")
    return match.group(1)


def rgba(css: str) -> tuple[int, int, int, int]:
    if css.startswith("#"):
        return (int(css[1:3], 16), int(css[3:5], 16), int(css[5:7], 16), 255)
    parts = [float(p) for p in re.findall(r"[\d.]+", css)]
    return (int(parts[0]), int(parts[1]), int(parts[2]), round(parts[3] * 255))


def font_file(explicit: str | None) -> str:
    if explicit:
        return explicit
    if not os.path.exists(FONT_CACHE):
        # An old user agent gets the TrueType file rather than WOFF2.
        request = urllib.request.Request(FONT_CSS, headers={"User-Agent": "Mozilla/4.0"})
        css = urllib.request.urlopen(request, timeout=30).read().decode()
        url = re.search(r"url\((https://[^)]+\.ttf)\)", css)
        if not url:
            raise SystemExit("Google Fonts sent no TrueType file for Bebas Neue")
        os.makedirs(os.path.dirname(FONT_CACHE), exist_ok=True)
        with open(FONT_CACHE, "wb") as handle:
            handle.write(urllib.request.urlopen(url.group(1), timeout=30).read())
    return FONT_CACHE


def tiles(text: str, row: int):
    """(glyph, taped, advance in em or None to measure, tilt in degrees, drop in em) per slot, seeded per row and slot."""
    out = []
    for slot, char in enumerate(text.upper()):
        if char == " ":
            out.append(("", False, SPACE_ADVANCE, 0.0, 0.0))
            continue
        glyph = ACCENTED.get(char, char)
        rand = random.Random(row * 7919 + slot * 131 + ord(glyph))
        out.append((glyph, glyph != char, None, (rand.random() - 0.5) * 1.8, (rand.random() - 0.5) * 0.03))
    return out


def letter_rows(plate: Image.Image, geometry: dict, rows: list[str], font_path: str) -> None:
    """Hangs `rows` on the plate's marquee board, one kit size for every row."""
    scale = plate.width / geometry["width"]
    board = geometry["board"]
    probe = ImageFont.truetype(font_path, 1000)

    def advance(glyph: str) -> float:
        return probe.getlength(glyph) / 1000

    laid = [[(g, t, a if a is not None else advance(g), tilt, drop) for g, t, a, tilt, drop in tiles(text, i)] for i, text in enumerate(rows)]
    widths = [sum(tile[2] for tile in row) + TILE_GAP * (len(row) - 1) for row in laid]
    room = board["w"] * (1 - 2 * BOARD_MARGIN)
    size = min(min(r["cap"] / CAP_HEIGHT for r in geometry["rows"]), room / max(widths))
    px = size * scale

    ink = rgba(token("letterInk"))
    face = rgba(token("tileFace"))
    edge = rgba(token("tileEdge"))
    font = ImageFont.truetype(font_path, round(px))
    for i, row_tiles in enumerate(laid):
        rail = geometry["rows"][i]
        width = widths[i] * px
        x = (board["x"] + board["w"] / 2) * scale - width / 2
        top = (rail["base"] - 0.8 * size) * scale
        for glyph, taped, adv, tilt, drop in row_tiles:
            w = adv * px
            if glyph:
                pad = round(px * 0.2)
                tile = Image.new("RGBA", (round(w + 2 * pad), round(px + 2 * pad)), (0, 0, 0, 0))
                draw = ImageDraw.Draw(tile)
                box = (pad - 0.035 * px, pad + 0.03 * px, pad + w + 0.035 * px, pad + px - 0.13 * px)
                draw.rectangle(box, fill=face, outline=edge, width=max(1, round(0.012 * px)))
                draw.text((pad + w / 2, pad + 0.8 * px), glyph, font=font, fill=ink, anchor="ms")
                if taped:
                    tape = Image.new("RGBA", (round(0.2 * px), max(2, round(0.055 * px))), ink)
                    tape = tape.rotate(24, expand=True, resample=Image.Resampling.BICUBIC)
                    tile.alpha_composite(tape, (round(pad + 0.42 * w), round(pad + 0.005 * px - tape.height / 3)))
                # Each letter hangs a hair crooked, from near its top.
                tile = tile.rotate(-tilt, center=(tile.width / 2, pad + 0.1 * px), resample=Image.Resampling.BICUBIC)
                plate.alpha_composite(tile, (round(x - pad), round(top + drop * px - pad)))
            x += w + TILE_GAP * px


def bulb_sprite(diameter: int) -> Image.Image:
    """A lit bulb: a white-hot filament in a warm halo, as Marquee.module.css draws it (still, as under reduced motion)."""
    core = rgba(token("bulb"))
    halo = rgba(token("bulbHalo"))
    halo_edge = rgba(token("bulbHaloEdge"))
    sprite = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 0))
    pixels = sprite.load()
    radius = diameter / 2
    for y in range(diameter):
        for x in range(diameter):
            t = math.hypot(x + 0.5 - radius, y + 0.5 - radius) / radius
            if t <= 0.15:
                colour = core
            elif t <= 0.27:
                k = (t - 0.15) / 0.12
                colour = tuple(round(core[c] + (halo[c] - core[c]) * k) for c in range(4))
            elif t <= 0.68:
                k = (t - 0.27) / 0.41
                colour = tuple(round(halo[c] + (halo_edge[c] - halo[c]) * k) for c in range(4))
            else:
                continue
            pixels[x, y] = colour[:3] + (round(colour[3] * 0.8),)
    return sprite


def light_strips(plate: Image.Image, geometry: dict) -> None:
    scale = plate.width / geometry["width"]
    for strip in geometry["strips"]:
        sprite = bulb_sprite(max(3, round(strip["r"] * 6.4 * scale)))
        for i in range(strip["n"]):
            x = strip["x0"] + (strip["x1"] - strip["x0"]) * i / (strip["n"] - 1)
            plate.alpha_composite(sprite, (round(x * scale - sprite.width / 2), round(strip["y"] * scale - sprite.height / 2)))


def sha256(path: str) -> str:
    with open(os.path.join(ROOT, path), "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def plate_path(locale: str) -> str:
    return f"public/finale/night-wide-{locale}.webp"


def poster_path(repo: str, locale: str) -> str:
    return f"public/finale/poster-{repo.lower()}-{locale}.webp"


def hang_posters(plate: Image.Image, geometry: dict, locale: str) -> None:
    """Each side project's poster in its case, unlit, as the page shows them."""
    scale = plate.width / geometry["width"]
    for case in geometry["cases"]:
        rect = case["poster"]
        poster = Image.open(os.path.join(ROOT, poster_path(case["repo"], locale))).convert("RGBA")
        poster = poster.resize((round(rect["w"] * scale), round(rect["h"] * scale)), Image.Resampling.LANCZOS)
        plate.alpha_composite(poster, (round(rect["x"] * scale), round(rect["y"] * scale)))


def build(locale: str, font_path: str) -> dict:
    """Writes the locale's card; returns what it was made from."""
    geometry = json.loads(read("src/features/finale/plates.json"))["night-wide"]
    hero = json.loads(read(f"src/i18n/dictionaries/{locale}.json"))["hero"]
    plate = Image.open(os.path.join(ROOT, plate_path(locale))).convert("RGBA")
    hang_posters(plate, geometry, locale)
    letter_rows(plate, geometry, [hero["name"], hero["role"]], font_path)
    light_strips(plate, geometry)
    # The card's aspect, the plate's full width: a little of the sky and the street goes.
    height = round(plate.width * SIZE[1] / SIZE[0])
    top = round((plate.height - height) * 0.35)
    card = plate.crop((0, top, plate.width, top + height)).convert("RGB")
    card = card.resize(SIZE, Image.Resampling.LANCZOS)
    out = os.path.join(ROOT, "public", "og", f"{locale}.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for quality in (88, 84, 80, 76, 72):
        card.save(out, "JPEG", quality=quality, optimize=True, progressive=True, exif=b"", icc_profile=None)
        if os.path.getsize(out) <= MAX_BYTES:
            break
    else:
        raise SystemExit(f"{out} stays over {MAX_BYTES // 1024} KB")
    print(f"{os.path.relpath(out, ROOT)}\t{os.path.getsize(out) // 1024} KB")
    inputs = [plate_path(locale)] + [poster_path(case["repo"], locale) for case in geometry["cases"]]
    return {
        "words": [hero["name"], hero["role"]],
        "files": {path: sha256(path) for path in inputs},
        "card": sha256(os.path.relpath(out, ROOT)),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--locale", choices=LOCALES)
    parser.add_argument("--font")
    args = parser.parse_args()
    font_path = font_file(args.font)
    sources = {}
    if os.path.exists(SOURCES):
        with open(SOURCES, encoding="utf-8") as handle:
            sources = json.load(handle)
    for locale in [args.locale] if args.locale else LOCALES:
        sources[locale] = build(locale, font_path)
    with open(SOURCES, "w", encoding="utf-8") as handle:
        json.dump({locale: sources[locale] for locale in sorted(sources)}, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
