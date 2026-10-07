/**
 * The site's icons: the browser tab's favicon and the home-screen icons.
 *
 *     node tools/art/favicon/build.mjs
 *
 * The mark is an enamel badge: a pink-to-asphalt enamel rim with a gloss
 * around a deep-violet palm leaning over a plain afterglow sun on pink
 * water. Every colour is a token (src/design/tokens.ts); the silhouettes
 * are deep violet, never black, and the sun is one plain disc (no stripes).
 *
 * Two drawings of it:
 * - the tab's: pixel drawings, one at 16 and one at 32 (`TAB_16`, `TAB_32`
 *   below, one letter a pixel), so every edge falls on a whole pixel. The
 *   .ico's 16 and 32 entries are those pixels exactly, written here without
 *   a browser: Chrome rasterises an SVG favicon at 32 and halves it, so the
 *   site lists the .ico with its sizes and Chrome takes the exact entry.
 *   `public/favicon.svg` (Firefox's pick) carries both drawings and shows
 *   the 16 below 24 px and the 32 above, or on a dense screen. At these
 *   sizes the palm is a silhouette against a plain sky, and the rim a
 *   ring of magenta going deep rose at its foot (a dark keyline outside
 *   it at 32), which parts it from a light tab and from a dark one.
 * - the badge (`badge.svg` here), from 48 px up: the palm's feathered
 *   fronds, the causeway with its lamps running into the sun, two birds,
 *   ripples and the gloss (the 512 adds a fine film grain to the sky).
 *   `tile.svg` is the badge on a full-bleed night with an afterglow behind
 *   it, for iOS's home screen (it rounds its own corners, so no clear
 *   corner may show).
 *
 * It writes the SVGs, then renders with Playwright's Chromium the badge's
 * 48 (the .ico's third entry), `public/apple-touch-icon.png` (the tile at
 * 180), `public/icon-192.png` and `public/icon-512.png` (the badge, for the
 * web manifest, `src/app/manifest.ts`). The same Chromium renders the same
 * bytes, so a run with nothing changed leaves every file as it was.
 * `src/lib/siteIcons.test.ts` checks them.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { withRenderer } from "../browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const PUBLIC = path.join(ROOT, "public");
const { palette, chapterCard } = await import(path.join(ROOT, "src/design/tokens.ts"));

/* ------------------------------------------------------------------ */
/* The tab: pixel drawings at 16 and 32.                               */
/* ------------------------------------------------------------------ */

/** One letter a pixel; "." is clear. Every colour a token. */
const INK = {
  N: palette.night,
  I: palette.ink,
  L: palette.lilac,
  H: palette.haze,
  M: palette.magenta,
  P: palette.pink,
  V: palette.violet,
  O: palette.orange,
  B: palette.amber,
  S: palette.sodium,
  C: palette.cream,
  K: chapterCard.bandMid,
  W: chapterCard.wordFoot,
  F: chapterCard.fold,
};

/**
 * At 16: a ring of magenta going deep rose at the foot (a dark foot sank
 * into a dark tab), the palm's crown two arches with drooping tips over a
 * plain haze sky, its trunk leaning in from the left, the sun a dome on
 * the horizon with one line of its light on the water. Its top is cream
 * and its lower half sodium, as the badge's sun goes: all cream, it read
 * as a white cloud in a real tab.
 */
export const TAB_16 = [
  ".....MMMMMM.....",
  "...MMHHHHIIMM...",
  "..MHHIHHIHHIHM..",
  ".MHHHIIIIHHHIHM.",
  ".MHHIIIIIIHHHHM.",
  "MHHIHHIIHHIHHHHM",
  "MWIWWWIWWCCIWWWM",
  "FWWWWWIWCCCCCWWF",
  "FOOOOIOSSSSSSSOF",
  "FOOOOIOSSSSSSSOF",
  "FPPPPIPPBBBBBPPF",
  ".FPPIIPPPPPPPPF.",
  ".FPPIPPPPPPPPPF.",
  "..FIIVVVVVVVVF..",
  "...FFVVVVVVFF...",
  ".....FFFFFF.....",
];

/**
 * At 32 (a 2x tab): the same picture, with room for a keyline outside the
 * enamel, a gloss on its upper left, a lilac top to the sky and fronds two
 * pixels thick that taper to one.
 */
export const TAB_32 = [
  "............NNNNNNNN............",
  ".........NNNMMMMMMMMNNN.........",
  ".......NNMMMLLLLLLLLMMMNN.......",
  "......NPPILLLLLLIIIILLLMMN......",
  ".....NPIIIIILLIIIIIIIILLLMN.....",
  "....NPLLLLIIIIIILLLLIIIILLMN....",
  "...NPHHHHHHIIIIHHHHHHHIIIHHMN...",
  "..NPHHHHHIIIIIIIIHHHHHHHIIHHMN..",
  "..NPHHHIIIHIIIIHIIIHHHHHHIHHMN..",
  ".NPHHHIIHHIIIIIIHHIIHHHHHHHHHMN.",
  ".NMHHIIHHHHIIIIHHHHHIIHHHHHHHMN.",
  ".NMHIIHHHHHHIIHHHHHHHIIHHHHHHMN.",
  "NMHHIHHHHHHHIIHHHHHHHHIHHHHHHHMN",
  "NFHHHHHHHHHIIHHHHHHHHHHHHHHHHHFN",
  "NFKKKKKKKKKIIKKKKCCCCCCCCKKKKKFN",
  "NFKKKKKKKKIIKKKKCCCCCCCCCCKKKKFN",
  "NFKKKKKKKKIIKKKCCCCCCCCCCCCKKKFN",
  "NFWWWWWWWWIIWWWSSSSSSSSSSSSWWWFN",
  "NFWWWWWWWIIWWWWSSSSSSSSSSSSWWWFN",
  "NFOOOOOOOIIOOOSSSSSSSSSSSSSSOOFN",
  ".NFOOOOOOIIOOOOOBBBBBBBBBBOOOFN.",
  ".NFOOOOOOIIOOOOOOOOOOOOOOOOOOFN.",
  ".NFPPPPPIIPPPPPPPPPPPPPPPPPPPFN.",
  "..NFPPPPIIPPPPPPPPPPPPPPPPPPFN..",
  "..NFPPPPIIPPPPPPPPPPPPPPPPPPFN..",
  "...NFPPPIIPPPPPPPPPPPPPPPPPFN...",
  "....NFIIIPPPPPPPPPPPPPPPPPFN....",
  ".....NFIIHHHHHHHHHHHHHHHHFN.....",
  "......NFFHHHHHHHHHHHHHHFFN......",
  ".......NNFFFVVVVVVVVFFFNN.......",
  ".........NNNFFFFFFFFNNN.........",
  "............NNNNNNNN............",
];

/** A path per colour, of horizontal runs (`M x y h w v1 h-w z`). */
function runsByColour(grid) {
  const paths = new Map();
  grid.forEach((row, y) => {
    if (row.length !== grid.length) throw new Error(`row ${y} of the ${grid.length} drawing is ${row.length} wide`);
    for (let x = 0; x < row.length; ) {
      const letter = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === letter) end++;
      if (letter !== ".") {
        if (!INK[letter]) throw new Error(`no colour for "${letter}"`);
        paths.set(letter, (paths.get(letter) ?? "") + `M${x} ${y}h${end - x}v1h-${end - x}z`);
      }
      x = end;
    }
  });
  return [...paths].map(([letter, d]) => `<path fill="${INK[letter]}" d="${d}"/>`).join("");
}

/**
 * Both drawings in one 32-unit SVG: the 16 doubled, shown below 24 px, and
 * the 32 at 24 px and up or on a screen of 1.5 device pixels a pixel.
 */
export function tabSvg() {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">`,
    `<style>.b{display:none}@media (min-width:24px),(min-resolution:1.5dppx){.a{display:none}.b{display:inline}}</style>`,
    `<g class="a" transform="scale(2)">${runsByColour(TAB_16)}</g>`,
    `<g class="b">${runsByColour(TAB_32)}</g>`,
    `</svg>`,
  ].join("");
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  let c = 0xffffffff;
  for (const byte of body) c = CRC[(c ^ byte) & 255] ^ (c >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

/** A drawing as an 8-bit RGBA PNG, its pixels exactly. */
export function pixelPng(grid) {
  const n = grid.length;
  const raw = Buffer.alloc((n * 4 + 1) * n);
  grid.forEach((row, y) =>
    [...row].forEach((letter, x) => {
      if (letter === ".") return;
      const hex = INK[letter];
      const rgba = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
      raw.set(rgba, y * (n * 4 + 1) + 1 + x * 4);
    }),
  );
  const header = Buffer.alloc(13);
  header.writeUInt32BE(n, 0);
  header.writeUInt32BE(n, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* The badge: 64 units, from 48 px up.                                 */
/* ------------------------------------------------------------------ */

const num = (v) => (Math.abs(v) < 0.05 ? "0" : String(+v.toFixed(1)));

/** Twice the signed area of a polygon. */
const area = (points) => points.reduce((sum, [x, y], i) => {
  const [nx, ny] = points[(i + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0);

/**
 * One palm frond along +x from the crown: a rachis rising `sag` over the
 * line and drooping to its tip, and `n` pairs of leaflets, longer below
 * (`low`) than above (`up`), longest mid-frond, hanging with their weight.
 * Every leaflet winds the way the rachis does, so where they overlap the
 * nonzero fill never leaves a hole.
 */
function frond({ length = 21, sag = 5, n = 11, low = 5.2, up = 2.4 } = {}) {
  const p1 = [length * 0.45, -sag];
  const p2 = [length, 1.5];
  const at = (t) => [2 * (1 - t) * t * p1[0] + t * t * p2[0], 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  const tangent = (t) => {
    const dx = 2 * (1 - t) * p1[0] + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * p1[1] + 2 * t * (p2[1] - p1[1]);
    const l = Math.hypot(dx, dy);
    return [dx / l, dy / l];
  };
  const top = [];
  const bottom = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const [x, y] = at(t);
    const [tx, ty] = tangent(t);
    const w = 0.85 * (1 - t) + 0.2;
    top.push([x + ty * w, y - tx * w]);
    bottom.push([x - ty * w, y + tx * w]);
  }
  const rachis = [...top, ...bottom.reverse()];
  const winding = Math.sign(area(rachis));
  const point = ([x, y]) => `${num(x)} ${num(y)}`;
  let d = `M${rachis.map(point).join(" ")}Z`;
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (0.83 * i) / (n - 1);
    const [x, y] = at(t);
    const [tx, ty] = tangent(t);
    const profile = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.85 + 0.25;
    for (const [side, size] of [[1, low], [-1, up]]) {
      // Out from the rachis, on toward the tip, and down with the weight.
      let dx = -ty * side * 0.75 + tx * 0.55;
      let dy = tx * side * 0.75 + ty * 0.55 + 0.45;
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
      const leaflet = [[x - tx * 0.7, y - ty * 0.7], [x + dx * size * profile, y + dy * size * profile], [x + tx * 0.7, y + ty * 0.7]];
      if (Math.sign(area(leaflet)) !== winding) leaflet.reverse();
      d += `M${leaflet.map(point).join("L")}Z`;
    }
  }
  return d;
}

/** The crown's fronds: angle, scale and whether mirrored. */
const CROWN = [[-28, 1, false], [10, 1, false], [44, 0.78, false], [-44, 0.95, true], [-2, 0.95, true], [40, 0.72, true], [-70, 0.62, false], [-74, 0.55, true]];

/**
 * The badge's defs and drawing in 64 units. `grain` lays a fine film grain
 * over the sky, a pixel's worth at 512 (finer, it only greys the picture at
 * the small sizes and doubles the PNG for nothing).
 */
function badgeParts({ grain = false } = {}) {
  const C = INK;
  const fronds = CROWN.map(([angle, scale, mirrored]) =>
    `<use href="#bf" transform="${mirrored ? "scale(-1 1) " : ""}rotate(${angle})${scale === 1 ? "" : ` scale(${scale})`}"/>`,
  ).join("");
  const defs = `<linearGradient id="bs" x1="0" y1="0" x2="0" y2="1"><stop offset=".05" stop-color="${palette.dusk}"/><stop offset=".45" stop-color="${C.H}"/><stop offset=".78" stop-color="${C.O}"/><stop offset="1" stop-color="${C.B}"/></linearGradient>
<radialGradient id="bh" cx="40" cy="40" r="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.B}" stop-opacity=".9"/><stop offset="1" stop-color="${C.O}" stop-opacity="0"/></radialGradient>
<linearGradient id="bu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.C}"/><stop offset=".55" stop-color="${C.S}"/><stop offset="1" stop-color="${C.O}"/></linearGradient>
<linearGradient id="bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.P}"/><stop offset="1" stop-color="${C.V}"/></linearGradient>
<linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.asphalt}"/><stop offset="1" stop-color="${C.I}"/></linearGradient>
<linearGradient id="br" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${C.M}"/><stop offset=".5" stop-color="${palette.asphalt}"/><stop offset="1" stop-color="${C.N}"/></linearGradient>
<radialGradient id="bg" cx=".5" cy="0" r=".8"><stop offset="0" stop-color="${C.C}" stop-opacity=".3"/><stop offset="1" stop-color="${C.C}" stop-opacity="0"/></radialGradient>
<filter id="bn" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="1" seed="7"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 .96 0 0 0 0 .94 0 0 0 -2.4 1.25"/></filter>
<clipPath id="bc"><circle cx="32" cy="32" r="30"/></clipPath>
<path id="bf" d="${frond()}"/>`;
  const body = `<g clip-path="url(#bc)">
<rect width="64" height="41" fill="url(#bs)"/>
<circle cx="40" cy="40" r="22" fill="url(#bh)"/>
<circle cx="40" cy="38" r="11" fill="url(#bu)"/>
<rect y="41" width="64" height="23" fill="url(#bw)"/>
<path d="M33 42.6h4M30.5 44.8h5.5M34 47.4h3.4M29 50.4h6M32.6 54h3" stroke="${C.C}" stroke-width=".6" stroke-linecap="round" opacity=".55"/>
<path d="M40 41L64 52V64H37Z" fill="url(#bd)"/>
<path d="M40 41L64 52" stroke="${C.B}" stroke-width=".9"/>
<path d="M40 41L37 64" stroke="${C.B}" stroke-width=".5" opacity=".55"/>
<path d="M40 41L53 64" stroke="${C.W}" stroke-width="3.4" opacity=".3"/>
<path d="M41.6 44l.6 1.1M43.9 48.2l1.1 2M47.5 54.7l1.8 3.3" stroke="${C.S}" stroke-width=".8"/>
<path d="M44.5 42.9v-2.2M49 45v-3.6M55 47.7v-5.6M63 51.4v-9" stroke="${C.I}" stroke-width=".5"/>
<g fill="${C.S}"><circle cx="44.5" cy="40.7" r=".4"/><circle cx="49" cy="41.4" r=".6"/><circle cx="55" cy="42.1" r=".9"/></g>
<path d="M44 15.5q1.2-1.3 2.4 0q1.2-1.3 2.4 0M50 11.6q.9-1 1.8 0q.9-1 1.8 0" fill="none" stroke="${C.I}" stroke-width=".6" stroke-linecap="round"/>
<path d="M5 64C8.5 47 12.5 33 18.4 21.5L21 22.5C15.8 34 13.5 48 12 64Z" fill="${C.I}"/>
<g fill="${C.I}" transform="translate(19.5 21.5)">${fronds}<circle r="2"/></g>
${grain ? `<svg width="64" height="41" viewBox="0 0 512 328"><rect width="512" height="328" filter="url(#bn)" opacity=".025"/></svg>` : ""}
<ellipse cx="32" cy="7" rx="27" ry="15" fill="url(#bg)"/>
</g>
<circle cx="32" cy="32" r="30.5" fill="none" stroke="url(#br)" stroke-width="3"/>
<path d="M2.9 21.4A31 31 0 0 1 17.4 4.6" fill="none" stroke="${C.C}" stroke-width=".8" stroke-linecap="round" opacity=".5"/>
<circle cx="32" cy="32" r="31.6" fill="none" stroke="${C.N}" stroke-width=".8"/>
<circle cx="32" cy="32" r="29" fill="none" stroke="${C.N}" stroke-width=".6" opacity=".7"/>`;
  return { defs, body };
}

/** The round badge, clear outside its rim. */
export function badgeSvg({ grain = false } = {}) {
  const { defs, body } = badgeParts({ grain });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
${defs}
</defs>
${body}
</svg>
`;
}

/** The badge on a full-bleed night with an afterglow behind it. */
export function tileSvg() {
  const { defs, body } = badgeParts();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<radialGradient id="ta" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="${INK.M}" stop-opacity=".55"/><stop offset=".55" stop-color="${palette.dusk}" stop-opacity=".35"/><stop offset="1" stop-color="${palette.dusk}" stop-opacity="0"/></radialGradient>
${defs}
</defs>
<rect width="64" height="64" fill="${INK.N}"/><rect width="64" height="64" fill="url(#ta)"/>
<g transform="translate(5 5) scale(.84375)">
${body}
</g>
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* Files.                                                              */
/* ------------------------------------------------------------------ */

/** An .ico of PNG entries (Windows Vista on, every browser), largest last. */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt8(0, at + 2);
    header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const page = (svg, size) =>
  `<!doctype html><html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${size}" height="${size}" style="display:block"></body></html>`;

async function main() {
  const badge = badgeSvg();
  const tile = tileSvg();
  fs.writeFileSync(path.join(PUBLIC, "favicon.svg"), tabSvg());
  fs.writeFileSync(path.join(HERE, "badge.svg"), badge);
  fs.writeFileSync(path.join(HERE, "tile.svg"), tile);

  await withRenderer(async (render) => {
    const at = (svg, size) => render(page(svg, size), size, size);
    const entries = [
      { size: 16, data: pixelPng(TAB_16) },
      { size: 32, data: pixelPng(TAB_32) },
      { size: 48, data: await at(badge, 48) },
    ];
    fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), ico(entries));
    fs.writeFileSync(path.join(PUBLIC, "apple-touch-icon.png"), await at(tile, 180));
    fs.writeFileSync(path.join(PUBLIC, "icon-192.png"), await at(badge, 192));
    fs.writeFileSync(path.join(PUBLIC, "icon-512.png"), await at(badgeSvg({ grain: true }), 512));
  });

  for (const file of ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
    console.log(`${file.padEnd(22)} ${fs.statSync(path.join(PUBLIC, file)).size} bytes`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
