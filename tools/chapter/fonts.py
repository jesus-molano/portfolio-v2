#!/usr/bin/env python3
"""The chapter cards' script face and its metrics (src/components/ChapterCard).

    python3 tools/chapter/fonts.py [--source MrDafoe-Regular.ttf]

Writes two files, both checked in:

- src/app/fonts/ChapterScript-Regular.woff2: Mr Dafoe by Alejandro Paul
  (SIL OFL 1.1), subset to the letters of every chapter word in the
  dictionaries plus a safe Latin set (Spanish, Catalan, Portuguese and
  French letters, typographic quotes and dashes), hinting dropped, only the
  kerning kept. A subset is a Modified Version under the OFL and "Mr Dafoe"
  is a Reserved Font Name, so the subset is renamed "Chapter Script";
  ChapterScript.OFL.txt beside it keeps the copyright and the licence.
- src/components/ChapterCard/scriptMetrics.json: what chapterLayout.ts
  needs to lay a word out without a browser, read from that subset: each
  character's advance and ink box, the lowest point of its ink in every
  column 20 units wide (where a banner may hang under it), the kerning
  pairs between the characters, and the woff2's SHA-256 (a test checks the
  two still match).

Without --source it fetches the TTF from Google Fonts into
.art-cache/fonts (the hosts `pnpm build` needs too). Deterministic: the
same TTF gives the same bytes. Needs fontTools and brotli
(pip install fonttools brotli).
"""
import argparse
import hashlib
import io
import json
import math
import os
import re
import subprocess
import urllib.request

from fontTools import subset
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FONT_OUT = os.path.join(ROOT, "src/app/fonts/ChapterScript-Regular.woff2")
METRICS_OUT = os.path.join(ROOT, "src/components/ChapterCard/scriptMetrics.json")
DICTIONARIES = [os.path.join(ROOT, f"src/i18n/dictionaries/{lang}.json") for lang in ("en", "es")]
CACHE = os.path.join(ROOT, ".art-cache/fonts/MrDafoe-Regular.ttf")
CSS_URL = "https://fonts.googleapis.com/css2?family=Mr+Dafoe"

FAMILY = "Chapter Script"
POSTSCRIPT = "ChapterScript-Regular"

# The safe Latin set, beside the cards' own letters: printable ASCII, the
# Spanish letters and marks, the common Catalan, Portuguese and French
# letters, typographic quotes, dashes, the ellipsis and the euro.
SAFE = (
    "".join(chr(code) for code in range(0x20, 0x7F))
    + " ¡¿«»·ºª"
    + "ÁÉÍÓÚÜÑáéíóúüñ"
    + "ÀÈÌÒÙàèìòùÇçÏïÄËÖäëöÂÊÎÔÛâêîôûÃÕãõ"
    + "‘’“”–—…€"
)

# A column of the ink profile, in font units (0.02 em).
COLUMN = 20
# Segments per quadratic curve when the outlines are flattened.
STEPS = 12


def source_font(path):
    if path:
        return path
    if not os.path.exists(CACHE):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        # A plain user agent gets the full TrueType file.
        css = urllib.request.urlopen(urllib.request.Request(CSS_URL, headers={"User-Agent": "curl/8"})).read().decode()
        url = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css).group(1)
        subprocess.run(["curl", "-sSfL", "-o", CACHE, url], check=True)
    return CACHE


def chapter_letters():
    """Every character of every chapter word and ribbon in the dictionaries."""
    letters = set()

    def walk(node):
        if isinstance(node, dict):
            chapter = node.get("chapter")
            if isinstance(chapter, dict) and isinstance(chapter.get("word"), str):
                letters.update(chapter["word"])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    for path in DICTIONARIES:
        with open(path, encoding="utf-8") as file:
            walk(json.load(file))
    return letters


def rename(font):
    """The OFL's Reserved Font Name stays with the original: the subset gets its own."""
    names = font["name"]
    for record in list(names.names):
        if record.nameID in (1, 4, 16):
            names.setName(FAMILY, record.nameID, record.platformID, record.platEncID, record.langID)
        elif record.nameID == 6:
            names.setName(POSTSCRIPT, record.nameID, record.platformID, record.platEncID, record.langID)
        elif record.nameID == 3:
            names.setName(f"{POSTSCRIPT}: subset of Mr Dafoe 1.000", record.nameID, record.platformID, record.platEncID, record.langID)
    names.setName("This Font Software is licensed under the SIL Open Font License, Version 1.1.", 13, 3, 1, 0x409)
    names.setName("https://openfontlicense.org", 14, 3, 1, 0x409)


def build_subset(source, text):
    options = subset.Options()
    options.layout_features = ["kern"]
    options.hinting = False
    options.flavor = "woff2"
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_languages = [0x409]
    options.drop_tables += ["FFTM"]
    font = TTFont(source, recalcTimestamp=False)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted({ord(char) for char in text}))
    subsetter.subset(font)
    rename(font)
    out = io.BytesIO()
    font.flavor = "woff2"
    font.save(out, reorderTables=False)
    return out.getvalue()


class Segments(BasePen):
    """The outline as straight segments (quadratic curves flattened)."""

    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.segments = []
        self.start = None
        self.at = None

    def _moveTo(self, point):
        self.start = self.at = point

    def _lineTo(self, point):
        self.segments.append((self.at, point))
        self.at = point

    def _qCurveToOne(self, control, point):
        (x0, y0), (x1, y1), (x2, y2) = self.at, control, point
        previous = self.at
        for step in range(1, STEPS + 1):
            t = step / STEPS
            u = 1 - t
            here = (u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2)
            self.segments.append((previous, here))
            previous = here
        self.at = point

    def _curveToOne(self, c1, c2, point):
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = self.at, c1, c2, point
        previous = self.at
        for step in range(1, STEPS + 1):
            t = step / STEPS
            u = 1 - t
            here = (
                u**3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t**3 * x3,
                u**3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t**3 * y3,
            )
            self.segments.append((previous, here))
            previous = here
        self.at = point

    def _closePath(self):
        if self.at != self.start:
            self.segments.append((self.at, self.start))
        self.at = self.start

    _endPath = _closePath


def bottom_profile(segments, first, last):
    """
    The lowest point of the ink in each column [c * COLUMN, (c + 1) * COLUMN]
    from column `first` to `last`, in font units (y up), or None where the
    column has no ink. The lowest crossing of a filled outline is the
    bottom of its ink, so the outline's lowest point inside the column is.
    """
    lows = [math.inf] * (last - first + 1)
    for (x0, y0), (x1, y1) in segments:
        if x0 > x1:
            x0, y0, x1, y1 = x1, y1, x0, y0
        for column in range(math.floor(x0 / COLUMN), math.floor(x1 / COLUMN) + 1):
            left, right = column * COLUMN, (column + 1) * COLUMN
            a, b = max(x0, left), min(x1, right)
            if a > b:
                continue
            if x1 == x0:
                low = min(y0, y1)
            else:
                at = lambda x: y0 + (y1 - y0) * (x - x0) / (x1 - x0)
                low = min(at(a), at(b))
            index = column - first
            if 0 <= index < len(lows):
                lows[index] = min(lows[index], low)
    return [None if low == math.inf else math.floor(low) for low in lows]


def metrics(woff2, digest):
    font = TTFont(io.BytesIO(woff2), recalcTimestamp=False)
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]
    glyf = font["glyf"]
    glyphs = {}
    for code in sorted(cmap):
        name = cmap[code]
        advance = hmtx[name][0]
        glyph = glyf[name]
        if glyph.numberOfContours == 0:
            glyphs[chr(code)] = [advance]
            continue
        glyph.recalcBounds(glyf)
        pen = Segments(glyph_set)
        glyph_set[name].draw(pen)
        first = math.floor(glyph.xMin / COLUMN)
        last = math.floor(glyph.xMax / COLUMN)
        glyphs[chr(code)] = [advance, glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax, first, bottom_profile(pen.segments, first, last)]

    # Kerning: pair adjustments between the characters (PairPos, format 1 or 2).
    by_glyph = {}
    for code, name in cmap.items():
        by_glyph.setdefault(name, []).append(chr(code))
    kern = {}
    for lookup in font["GPOS"].table.LookupList.Lookup if "GPOS" in font else []:
        for table in lookup.SubTable:
            if lookup.LookupType == 9:
                if table.ExtensionLookupType != 2:
                    continue
                table = table.ExtSubTable
            elif lookup.LookupType != 2:
                continue
            if table.Format == 1:
                for left, pairs in zip(table.Coverage.glyphs, table.PairSet):
                    for record in pairs.PairValueRecord:
                        value = getattr(record.Value1, "XAdvance", 0) if record.Value1 else 0
                        if value:
                            for a in by_glyph.get(left, []):
                                for b in by_glyph.get(record.SecondGlyph, []):
                                    kern.setdefault(a + b, value)
            elif table.Format == 2:
                classes1 = table.ClassDef1.classDefs
                classes2 = table.ClassDef2.classDefs
                for left in table.Coverage.glyphs:
                    row = table.Class1Record[classes1.get(left, 0)]
                    for right in by_glyph:
                        record = row.Class2Record[classes2.get(right, 0)]
                        value = getattr(record.Value1, "XAdvance", 0) if record.Value1 else 0
                        if value:
                            for a in by_glyph.get(left, []):
                                for b in by_glyph[right]:
                                    kern.setdefault(a + b, value)

    os2 = font["OS/2"]
    return {
        "about": "tools/chapter/fonts.py: Chapter Script (Mr Dafoe, subset) for chapterLayout.ts. Do not edit by hand.",
        "font": os.path.relpath(FONT_OUT, ROOT),
        "sha256": digest,
        "unitsPerEm": font["head"].unitsPerEm,
        "ascender": os2.sTypoAscender,
        "descender": os2.sTypoDescender,
        "column": COLUMN,
        "glyphs": glyphs,
        "kern": dict(sorted(kern.items())),
    }


def compact_json(data):
    """One glyph or one kerning table per line: readable diffs, a small file."""
    lines = ["{"]
    items = list(data.items())
    for index, (key, value) in enumerate(items):
        comma = "," if index < len(items) - 1 else ""
        if key == "glyphs":
            lines.append(f'  "glyphs": {{')
            glyph_items = list(value.items())
            for j, (char, entry) in enumerate(glyph_items):
                tail = "," if j < len(glyph_items) - 1 else ""
                lines.append(f"    {json.dumps(char, ensure_ascii=False)}: {json.dumps(entry, separators=(',', ':'))}{tail}")
            lines.append(f"  }}{comma}")
        elif key == "kern":
            lines.append(f'  "kern": {json.dumps(value, ensure_ascii=False, separators=(",", ":"))}{comma}')
        else:
            lines.append(f"  {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)}{comma}")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", help="Mr Dafoe's TrueType file (default: fetched from Google Fonts)")
    args = parser.parse_args()

    text = "".join(sorted(set(SAFE) | chapter_letters()))
    woff2 = build_subset(source_font(args.source), text)
    digest = hashlib.sha256(woff2).hexdigest()
    with open(FONT_OUT, "wb") as file:
        file.write(woff2)
    with open(METRICS_OUT, "w", encoding="utf-8") as file:
        file.write(compact_json(metrics(woff2, digest)))
    print(f"{os.path.relpath(FONT_OUT, ROOT)}\t{len(woff2)} bytes, {len(text)} characters")
    print(f"{os.path.relpath(METRICS_OUT, ROOT)}\t{os.path.getsize(METRICS_OUT)} bytes")


if __name__ == "__main__":
    main()
