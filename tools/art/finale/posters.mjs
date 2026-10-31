/**
 * The four one-sheets of The Afterglow (src/features/finale): one original
 * poster per side project, each in its own genre (a fifties sci-fi
 * B-movie, a sports drama, an eighties horror, a neo-noir). 27 x
 * 40 ratio, 270 x 400 units, one per repository and locale; title, tagline
 * and billing are baked in. Our own drawings and type, no borrowed art or
 * logos.
 *
 * Each part of a poster has one job: the tagline and the line under the
 * title make the joke, the billing block gives names and stack (the cinema
 * presents, never his name), and the caption under the case on the page
 * (projects.posters.<id>.oneLiner) says plainly what the project does.
 * None of them repeats another.
 */
import fs from "node:fs";
import path from "node:path";
import { C, rng, f, clamp, mix, esc } from "./lib.mjs";

/** The tagline and the line under the title come from the dictionaries (projects.posters), like the page's captions. */
const DICTS = Object.fromEntries(
  ["en", "es"].map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), `../../../src/i18n/dictionaries/${lang}.json`), "utf8")).projects.posters,
  ]),
);
const copy = (id, key) => ({ en: DICTS.en[id][key], es: DICTS.es[id][key] });

export const W = 270, H = 400;

export const POSTERS = [
  {
    key: "dot", repo: "dotfiles",
    tag: copy("dotfiles", "tagline"),
    sub: copy("dotfiles", "sub"),
    bill: {
      en: ["THE AFTERGLOW PRESENTS A DOUBLE BILL · STARRING WINDOWS · CACHYOS"],
      es: ["THE AFTERGLOW PRESENTA UNA SESIÓN DOBLE · CON WINDOWS · CACHYOS"],
    },
  },
  {
    key: "trz", repo: "trazada",
    tag: copy("trazada", "tagline"),
    sub: copy("trazada", "sub"),
    bill: {
      en: ["THE AFTERGLOW PRESENTS · STARRING NUXT 4 · VUE 3 · TRESJS · THREE.JS", "WITH PYTHON 3.13 · FASTF1 · PANDAS · UPLOT · GSAP · AND A BINARY FORMAT OF ITS OWN"],
      es: ["THE AFTERGLOW PRESENTA · CON NUXT 4 · VUE 3 · TRESJS · THREE.JS", "PYTHON 3.13 · FASTF1 · PANDAS · UPLOT · GSAP · Y UN FORMATO BINARIO PROPIO"],
    },
  },
  {
    key: "ovl", repo: "OverLap",
    tag: copy("overlap", "tagline"),
    sub: copy("overlap", "sub"),
    bill: {
      en: ["THE AFTERGLOW PRESENTS · STARRING ELECTRON · VUE 3 · TYPESCRIPT", "WITH THE IRACING SDK · KOFFI · VITE · AND ELEVEN WIDGETS ON TOP"],
      es: ["THE AFTERGLOW PRESENTA · CON ELECTRON · VUE 3 · TYPESCRIPT", "EL SDK DE IRACING · KOFFI · VITE · Y ONCE WIDGETS ENCIMA"],
    },
  },
  {
    key: "exp", repo: "Expenses-Log-App",
    tag: copy("expenses-log-app", "tagline"),
    sub: copy("expenses-log-app", "sub"),
    bill: {
      en: ["THE AFTERGLOW PRESENTS · STARRING NEXT 16 · REACT 19 · SUPABASE", "WITH WEB PUSH · SERWIST · TYPESCRIPT · ZOD · TAILWIND CSS"],
      es: ["THE AFTERGLOW PRESENTA · CON NEXT 16 · REACT 19 · SUPABASE", "Y WEB PUSH · SERWIST · TYPESCRIPT · ZOD · TAILWIND CSS"],
    },
  },
];

const T = {
  // A real one-sheet's "exclusively at"; never "now" (the LIVE tag is Heuristik's alone).
  now: { en: "EXCLUSIVELY ON GITHUB", es: "SOLO EN GITHUB" },
};

/* ------------------------------------------------------------- helpers */
const txt = (x, y, s, t, { fam = "Space Grotesk", w = 700, ls = 0, fill = C.cream, op = 1, anchor = "middle", extra = "", italic = false } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${fam}" font-weight="${w}"${italic ? ' font-style="italic"' : ""} font-size="${s}" letter-spacing="${ls}" fill="${fill}" fill-opacity="${op}" ${extra}>${esc(t)}</text>`;
/**
 * Billing block: condensed credits like a real one-sheet. Every line keeps
 * the face's own proportions (Six Caps sets about 0.2 em a character), so
 * a short line stays short instead of stretching, and a long one is
 * squeezed to the width.
 */
const SIX_CAPS_EM = 0.202;
function billing(y, lines, { fill = C.cream, op = 0.78, width = 226, size = 15.5 } = {}) {
  return lines.map((l, i) => {
    const length = Math.min(width, Array.from(l).length * SIX_CAPS_EM * size);
    return `<text x="${W / 2}" y="${f(y + i * size * 0.86)}" text-anchor="middle" font-family="'Six Caps'" font-size="${size}" text-rendering="geometricPrecision" fill="${fill}" fill-opacity="${op}" textLength="${f(length)}" lengthAdjust="spacingAndGlyphs">${esc(l)}</text>`;
  }).join("");
}
/** Squeeze a long subtitle to the poster's safe width. */
const subFit = (t, size) => (t.length * size * 0.56 > 232 ? `textLength="232" lengthAdjust="spacingAndGlyphs"` : "");
function footer(lang, p, { fill = C.cream, y = 386 } = {}) {
  return txt(W / 2, y, 7.2, T.now[lang], { ls: 3.2, fill, op: 0.95 }) +
    txt(W / 2, y + 9, 5.2, `github.com/jesus-molano/${p.repo}`, { fam: "JetBrains Mono", w: 500, ls: 0.4, fill, op: 0.55 });
}
function paperGrain(id, freq = 0.9) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="5" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`;
}
const grainRect = (id, op) => `<rect width="${W}" height="${H}" filter="url(#${id})" opacity="${op}" style="mix-blend-mode:overlay"/>`;

/* ---------------------------------------------------------- 1 dotfiles */
/**
 * A fifties sci-fi one-sheet: a flying saucer beams his dotfiles down onto
 * two machines on a desk, and both screens come out the same. The two
 * plates under them name the systems (Windows, CachyOS); no logos.
 */
function dotfiles(p, lang, id, hot = false) {
  const r = rng(11);
  const cy = C.cyan;
  let stars = "";
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = 8 + r() * 226, s = r();
    if (y < 52 && Math.abs(x - W / 2) < 100) continue; // clear of the tagline
    stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.25 + s * 0.75)}" fill="${s > 0.85 ? C.pink : "#e3fbff"}" opacity="${f(0.2 + r() * 0.6)}"/>`;
  }
  // the saucer: a chrome hull, a glass dome, running lights round the rim
  const sx = 135, sy = 100;
  let rim = "";
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / 10);
    const x = sx - Math.cos(a) * 66, y = sy + 3 + Math.sin(a) * 6.5;
    const c = [C.magenta, C.sodium, cy][i % 3];
    if (hot) rim += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${c}" opacity=".55" filter="url(#${id}b3)"/>`;
    rim += `<circle cx="${f(x)}" cy="${f(y)}" r="2.1" fill="${c}"/><circle cx="${f(x - 0.6)}" cy="${f(y - 0.7)}" r=".7" fill="#fff" opacity=".8"/>`;
  }
  const saucer = `<g transform="rotate(-4 ${sx} ${sy})">
    ${hot ? `<ellipse cx="${sx}" cy="${sy - 4}" rx="96" ry="30" fill="${C.pink}" opacity=".3" filter="url(#${id}b6)"/>` : ""}
    <ellipse cx="${sx}" cy="${sy + 12}" rx="46" ry="9" fill="${cy}" opacity="${hot ? 0.9 : 0.55}" filter="url(#${id}b6)"/>
    <path d="M${sx - 30},${sy - 2} C${sx - 30},${sy - 30} ${sx + 30},${sy - 30} ${sx + 30},${sy - 2} Z" fill="url(#${id}dome)" stroke="#e3fbff" stroke-opacity=".6" stroke-width=".6"/>
    <path d="M${sx - 17},${sy - 18} C${sx - 12},${sy - 25} ${sx - 3},${sy - 26} ${sx + 4},${sy - 25}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="${sx}" cy="${sy}" rx="78" ry="14" fill="url(#${id}hull)"/>
    <ellipse cx="${sx}" cy="${sy - 3}" rx="70" ry="8" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".7"/>
    <path d="M${sx - 78},${sy} C${sx - 60},${sy + 16} ${sx + 60},${sy + 16} ${sx + 78},${sy}" fill="none" stroke="#2b1848" stroke-opacity=".55" stroke-width="1.2"/>
    ${rim}
    <ellipse cx="${sx}" cy="${sy + 11}" rx="28" ry="5" fill="#bff6ff"/>
    <ellipse cx="${sx}" cy="${sy + 11}" rx="17" ry="2.8" fill="#fff"/></g>`;
  // the beam, from the saucer's belly down to the desk
  const beamTop = sy + 11, beamFoot = 238;
  const cone = `M${sx - 26},${beamTop} L${sx + 26},${beamTop} L246,${beamFoot} L24,${beamFoot} Z`;
  const beam = `<path d="${cone}" fill="url(#${id}beam)" opacity="${hot ? 1 : 0.8}"/>` +
    (hot ? `<path d="${cone}" fill="${C.pink}" opacity=".16" filter="url(#${id}b6)"/><path d="M${sx - 12},${beamTop} L${sx + 12},${beamTop} L${sx + 60},${beamFoot} L${sx - 60},${beamFoot} Z" fill="#fff" opacity=".18" filter="url(#${id}b3)"/>` : "") +
    [0.22, 0.45, 0.7].map((t) => {
      const y = beamTop + (beamFoot - beamTop) * t, half = 26 + (109 - 26) * t;
      return `<ellipse cx="${sx}" cy="${f(y)}" rx="${f(half)}" ry="${f(3 + t * 6)}" fill="none" stroke="#e3fbff" stroke-opacity="${hot ? 0.45 : 0.22}" stroke-width=".7"/>`;
    }).join("");
  // the dotfiles coming down: sheets with a dot, the corner folded
  const sheets = [[110, 128, -18], [158, 134, 14], [90, 154, 10], [134, 148, -6], [178, 158, -20], [204, 178, 16]];
  let files = "";
  for (const [x, y, a] of sheets) {
    if (hot) files += `<circle cx="${x}" cy="${y}" r="10" fill="${C.pink}" opacity=".35" filter="url(#${id}b3)"/>`;
    files += `<g transform="rotate(${a} ${x} ${y})" opacity="${hot ? 1 : 0.92}">
      <path d="M${x - 6.5},${y - 8} h9 l4,4 v12 h-13 Z" fill="#fff4f1"/><path d="M${x + 2.5},${y - 8} v4 h4" fill="#cfe9f2"/>
      <circle cx="${x - 1}" cy="${y + 0.5}" r="2.4" fill="${C.magenta}"/>
      <path d="M${x - 4},${y + 5} h7" stroke="#6a4bc4" stroke-width=".8"/></g>`;
  }
  // one screen, drawn twice: the same wallpaper, the same terminal, the same cursor
  const screen = (x, y, w, h) => {
    const t = `${id}s${x}`;
    return `<clipPath id="${t}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/></clipPath>
    <g clip-path="url(#${t})">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}wall)"/>
      <circle cx="${f(x + w * 0.72)}" cy="${f(y + h * 0.66)}" r="${f(h * 0.2)}" fill="#ffd8a8" opacity=".9"/>
      <rect x="${f(x)}" y="${f(y + h * 0.78)}" width="${w}" height="${f(h * 0.22)}" fill="#2a1442"/>
      <rect x="${f(x + w * 0.1)}" y="${f(y + h * 0.14)}" width="${f(w * 0.56)}" height="${f(h * 0.56)}" rx="1.4" fill="#0d0716" fill-opacity=".9" stroke="${cy}" stroke-opacity=".5" stroke-width=".5"/>
      ${[0, 1, 2].map((k) => `<circle cx="${f(x + w * 0.1 + 3 + k * 3)}" cy="${f(y + h * 0.14 + 2.6)}" r=".9" fill="${[C.magenta, C.sodium, cy][k]}"/>`).join("")}
      ${[0, 1, 2].map((k) => `<path d="M${f(x + w * 0.1 + 3)},${f(y + h * (0.34 + k * 0.1))} h${f(w * (0.4 - k * 0.1))}" stroke="${cy}" stroke-opacity=".75" stroke-width=".9"/>`).join("")}
      <rect x="${f(x + w * 0.1 + 3)}" y="${f(y + h * 0.6)}" width="3" height="${f(h * 0.06)}" fill="${C.magenta}"/>
    </g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#fff" opacity="${hot ? 0.12 : 0.04}"/>`;
  };
  const plateText = (x, y, label) => `<rect x="${f(x - label.length * 2.2 - 4)}" y="${y - 6}" width="${f(label.length * 4.4 + 8)}" height="8.5" rx="1" fill="#0a0828" stroke="${cy}" stroke-opacity=".6" stroke-width=".5"/><text x="${x}" y="${y}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="5.2" letter-spacing=".8" fill="${cy}">${label}</text>`;
  const machines = `
    <rect x="0" y="236" width="${W}" height="30" fill="url(#${id}desk)"/>
    <path d="M0,236.5 H${W}" stroke="${cy}" stroke-opacity="${hot ? 0.9 : 0.5}" stroke-width=".8"/>
    <ellipse cx="${sx}" cy="237" rx="${hot ? 118 : 104}" ry="6" fill="${cy}" opacity="${hot ? 0.5 : 0.28}" filter="url(#${id}b3)"/>
    <!-- the desktop's monitor -->
    <rect x="98" y="218" width="10" height="16" fill="#2b1848"/><path d="M84,236 h38 l-4,-4 h-30 Z" fill="#3a2a5c"/>
    <rect x="52" y="168" width="102" height="54" rx="3" fill="#1a1238" stroke="#5a4a7a" stroke-width=".8"/>
    ${screen(56, 172, 94, 46)}
    <!-- the laptop -->
    <rect x="164" y="186" width="74" height="46" rx="3" fill="#1a1238" stroke="#5a4a7a" stroke-width=".8"/>
    ${screen(168, 190, 66, 38)}
    <path d="M158,232 h86 l6,5 h-98 Z" fill="#4a3a6a"/><path d="M190,233.5 h22" stroke="#2b1848" stroke-width="1"/>
    ${plateText(103, 252, "WINDOWS")}${plateText(201, 252, "CACHYOS")}`;
  const [t1, t2] = p.tag[lang];
  return `<symbol id="${id}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0f3a"/><stop offset=".55" stop-color="#16245e"/><stop offset="1" stop-color="#0a0828"/></linearGradient>
    <radialGradient id="${id}lamp" cx=".5" cy=".3" r=".55"><stop offset="0" stop-color="#3a63c8" stop-opacity=".5"/><stop offset="1" stop-color="#3a63c8" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#d6cce6"/><stop offset=".6" stop-color="#8f7cae"/><stop offset="1" stop-color="#3a2a5c"/></linearGradient>
    <linearGradient id="${id}dome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3fbff" stop-opacity=".95"/><stop offset=".6" stop-color="#5fd8ee" stop-opacity=".75"/><stop offset="1" stop-color="#2a6a9a" stop-opacity=".9"/></linearGradient>
    <linearGradient id="${id}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bff6ff" stop-opacity=".62"/><stop offset=".55" stop-color="${cy}" stop-opacity=".2"/><stop offset="1" stop-color="${cy}" stop-opacity=".1"/></linearGradient>
    <linearGradient id="${id}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4bc4"/><stop offset=".55" stop-color="#e39bbd"/><stop offset="1" stop-color="#ff8a5c"/></linearGradient>
    <linearGradient id="${id}desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1848"/><stop offset="1" stop-color="#0a0828"/></linearGradient>
    <linearGradient id="${id}title" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e3fbff"/><stop offset="1" stop-color="#8fe9f7"/></linearGradient>
    <filter id="${id}b6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="${id}b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    ${paperGrain(id + "g")}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>
  <rect width="${W}" height="${H}" fill="url(#${id}lamp)" opacity="${hot ? 1.6 : 1}"/>
  <g>${stars}</g>
  ${beam}
  ${saucer}
  ${files}
  ${machines}
  <rect y="262" width="${W}" height="138" fill="#0a0828" fill-opacity=".55"/>
  ${txt(W / 2, 30, 8.6, t1, { ls: 3.2 })}
  ${txt(W / 2, 43, 8.6, t2, { ls: 3.2, fill: C.pink })}
  <text x="146" y="324" text-anchor="middle" font-family="'Big Shoulders Display'" font-weight="900" font-size="66" letter-spacing="1" fill="${cy}" opacity=".55" filter="url(#${id}b3)" textLength="196" lengthAdjust="spacingAndGlyphs">DOTFILES</text>
  <text x="146" y="324" text-anchor="middle" font-family="'Big Shoulders Display'" font-weight="900" font-size="66" letter-spacing="1" fill="url(#${id}title)" textLength="196" lengthAdjust="spacingAndGlyphs">DOTFILES</text>
  <circle cx="38" cy="318" r="6.4" fill="${C.magenta}"/>
  ${txt(W / 2, 341, 8.6, p.sub[lang], { w: 500, fill: C.pink, ls: 0.4, extra: subFit(p.sub[lang], 8.6) })}
  ${billing(359, p.bill[lang], { width: 230, size: 16 })}
  ${footer(lang, p, { y: 382 })}
  ${grainRect(id + "g", 0.16)}
</symbol>`;
}

/* ------------------------------------------------------------ 2 trazada */
/**
 * A prestige sports drama: an invented circuit floating in the afterglow,
 * drawn the way trazada draws a track (a ribbon on its real relief, made
 * twice as tall and labelled Estimated, with skirts falling to nothing)
 * but twice as wide, so it reads in a case. Through its hairpin, the
 * racing line itself, painted outside, inside, outside: the word's
 * meaning. The cars are light trails coloured by speed, as its Trails
 * layer draws them, and at the hairpin its generic single-seater runs
 * with the compare ghost behind it (in a slot outside the paint, so the
 * line never runs under them), under a plain low sun. No real circuit,
 * team, driver, number or logo; no kerbs, since the app draws none.
 */
const TRZ = (() => {
  // A pinhole camera pitched down 31 degrees, world metres (x right, y up, z away).
  const pitch = (31 * Math.PI) / 180, sin = Math.sin(pitch), cos = Math.cos(pitch);
  const cam = { x: -10, y: 125, z: -245, F: 280, ox: 135, oy: 258 };
  const horizon = cam.oy - cam.F * Math.tan(pitch);
  const proj = ([x, y, z]) => {
    const dy = y - cam.y, dz = z - cam.z;
    const yc = dy * cos + dz * sin, zc = -dy * sin + dz * cos;
    return [cam.ox + (cam.F * (x - cam.x)) / zc, cam.oy - (cam.F * yc) / zc, zc];
  };
  // The circuit, invented: [x, z, height] in metres, anticlockwise from above; a closed Catmull-Rom.
  const CTRL = [
    [-170, 420, 8], [-110, 200, 3], [-62, 70, 0], [-48, 8, 0], [-10, -18, 0], [28, 8, 0], [44, 70, 0],
    [100, 240, 2], [170, 420, 6], [230, 600, 12], [300, 860, 22], [360, 1010, 30], [300, 1110, 34],
    [160, 1080, 38], [40, 1150, 42], [-110, 1100, 50], [-300, 1150, 62], [-440, 1060, 72], [-430, 860, 58],
    [-330, 660, 36], [-240, 520, 18],
  ];
  const RELIEF = 2; // the app's "Relieve x2", which it labels Estimated
  const HALF = 14; // half the ribbon's width: the app's 14 m track, drawn twice as wide
  const cr = (p0, p1, p2, p3, t) =>
    p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t * t * t));
  const n = CTRL.length, centre = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < 16; k++) centre.push(cr(CTRL[(i + n - 1) % n], CTRL[i], CTRL[(i + 1) % n], CTRL[(i + 2) % n], k / 16));
  const M = centre.length;
  const pts = centre.map(([x, z, h], i) => {
    const [x2, z2] = centre[(i + 1) % M], [x0, z0] = centre[(i + M - 1) % M];
    const tx = x2 - x0, tz = z2 - z0, l = Math.hypot(tx, tz);
    const nx = -tz / l, nz = tx / l; // left of travel
    const y = h * RELIEF;
    return { c: [x, y, z], L: [x + nx * HALF, y, z + nz * HALF], R: [x - nx * HALF, y, z - nz * HALF], n: [nx, nz], t: [tx / l, tz / l], h };
  });
  const S = [0];
  for (let i = 1; i <= M; i++) S.push(S[i - 1] + Math.hypot(centre[i % M][0] - centre[i - 1][0], centre[i % M][1] - centre[i - 1][1]));
  const lap = S[M];
  const top = Math.max(...centre.map((c) => c[2]));
  // The hairpin's apex: the nearest point of the first third.
  let apex = 0;
  for (let i = 0; i < M / 3; i++) if (centre[i][1] < centre[apex][1]) apex = i;
  /** A point at arc length u, `o` metres to the left of travel, `lift` over the surface; its tangent and normal. */
  const frame = (u, o = 0, lift = 0) => {
    u = ((u % lap) + lap) % lap;
    let i = 0;
    while (S[i + 1] < u) i++;
    const k = (u - S[i]) / (S[i + 1] - S[i]), a = pts[i], b = pts[(i + 1) % M];
    const L = (p, q) => p + (q - p) * k;
    const nv = [L(a.n[0], b.n[0]), L(a.n[1], b.n[1])], tv = [L(a.t[0], b.t[0]), L(a.t[1], b.t[1])];
    return { p: [L(a.c[0], b.c[0]) + nv[0] * o, L(a.c[1], b.c[1]) + lift, L(a.c[2], b.c[2]) + nv[1] * o], t: tv, n: nv };
  };
  const at = (u, o = 0, lift = 0.6) => proj(frame(u, o, lift).p);
  return { proj, horizon, pts, M, HALF, top, frame, at, lap, apex: S[apex] };
})();

/** The ribbon: skirts dropping 34 m from both edges in fading bands (one path per band, no seams), then the surface, far to near. */
function trzRibbon(id) {
  const { pts, M, proj, top } = TRZ;
  const DROP = 34, BANDS = [0.95, 0.84, 0.61, 0.41, 0.24, 0.1, 0.02];
  const bands = BANDS.map(() => []), quads = [];
  const P = (q) => `${f(q[0])},${f(q[1])}`;
  for (let i = 0; i < M; i++) {
    const a = pts[i], b = pts[(i + 1) % M];
    for (const side of ["L", "R"]) {
      const p1 = proj(a[side]), p2 = proj(b[side]);
      const p3 = proj([b[side][0], b[side][1] - DROP, b[side][2]]), p4 = proj([a[side][0], a[side][1] - DROP, a[side][2]]);
      const along = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      BANDS.forEach((_, k) => {
        const t0 = k / BANDS.length, t1 = (k + 1) / BANDS.length;
        bands[k].push(`M${P(along(p1, p4, t0))}L${P(along(p2, p3, t0))}L${P(along(p2, p3, t1))}L${P(along(p1, p4, t1))}Z`);
      });
    }
    const A = proj(a.L), B = proj(b.L), Cc = proj(b.R), D = proj(a.R);
    const depth = (proj(a.c)[2] + proj(b.c)[2]) / 2;
    const far = clamp((depth - 560) / 940);
    const fill = mix(mix(C.ink, "#4a3270", (a.h + b.h) / 2 / top), "#7a3f78", far * 0.55);
    quads.push({
      depth,
      svg:
        `<path d="M${P(A)}L${P(B)}L${P(Cc)}L${P(D)}Z" fill="${fill}" stroke="${fill}" stroke-width=".4" stroke-linejoin="round"/>` +
        `<path d="M${P(A)}L${P(B)}M${P(D)}L${P(Cc)}" stroke="${C.cream}" stroke-opacity="${f(0.45 + 0.4 * (1 - far))}" stroke-width="${f(Math.max(0.4, 330 / depth))}" stroke-linecap="round"/>`,
    });
  }
  quads.sort((p, q) => q.depth - p.depth);
  return `<g filter="url(#${id}sk)">${bands.map((d, k) => `<path d="${d.join("")}" fill="${C.ink}" fill-opacity="${BANDS[k]}"/>`).join("")}</g>${quads.map((q) => q.svg).join("")}`;
}

/**
 * The racing line through the hairpin, as its offset from the centre line
 * (+ is the inside, left of travel) by metres from the apex: outside down
 * the left leg, one long turn-in to a late apex hugging the inside, one
 * long track-out to the outside up the right leg. Each move is a half
 * cosine, so the line sweeps through the corner and never hesitates on
 * its way (keys eased one by one stopped it at every key: it wobbled).
 */
const TRZ_LINE = { outside: -10, inside: 10, turnIn: -95, apex: 5, trackOut: 105 };
function trzLineOffset(d) {
  const { outside, inside, turnIn, apex, trackOut } = TRZ_LINE;
  const ease = (t) => (1 - Math.cos(Math.PI * clamp(t))) / 2;
  if (d <= apex) return outside + (inside - outside) * ease((d - turnIn) / (apex - turnIn));
  return inside + (outside - inside) * ease((d - apex) / (trackOut - apex));
}

/**
 * A smooth path through points sampled along the track, in poster units:
 * relaxed a little (the ends kept), then joined by Catmull-Rom curves, so
 * a stroke along the ribbon reads as one sweep, never a shaky polyline.
 */
function trzSmooth(ps, passes = 3) {
  let q = ps.map((p) => [p[0], p[1]]);
  for (let k = 0; k < passes; k++) {
    q = q.map((p, i) => (i === 0 || i === q.length - 1 ? p : [(q[i - 1][0] + 2 * p[0] + q[i + 1][0]) / 4, (q[i - 1][1] + 2 * p[1] + q[i + 1][1]) / 4]));
  }
  let d = `M${f(q[0][0])},${f(q[0][1])}`;
  for (let i = 0; i < q.length - 1; i++) {
    const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

/** Speed ramps of the app's Trails layer (violet slow, blue, ice fast), as gradient stops tail to head. */
const TRZ_RAMPS = {
  fast: [[0, "#8b6cff", 0], [0.3, "#8b6cff", 0.45], [0.7, "#4aa8ff", 0.85], [1, "#d9f3ff", 1]],
  braking: [[0, "#d9f3ff", 0], [0.3, "#4aa8ff", 0.6], [1, "#8b6cff", 1]],
  slow: [[0, "#8b6cff", 0], [0.35, "#8b6cff", 0.6], [1, "#b9a8ff", 1]],
};
/** A car's light trail on the centre line (cars ride it, as in the app), at a 2.4 m slot of "Separar coches"; `head: false` for the car's own. */
function trzTrail(id, key, head, len, slot, ramp, hot, { dot = true } = {}) {
  const ps = Array.from({ length: 29 }, (_, j) => TRZ.at(head - len + (len * j) / 28, slot));
  const a = ps[0], b = ps[28];
  const w = Math.max(0.55, 950 / b[2]) * (hot ? 1.35 : 1);
  const d = trzSmooth(ps);
  const grad = `<linearGradient id="${id}t${key}" gradientUnits="userSpaceOnUse" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}">${TRZ_RAMPS[ramp].map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join("")}</linearGradient>`;
  const svg =
    (hot ? `<path d="${d}" fill="none" stroke="url(#${id}t${key})" stroke-width="${f(w * 3.2)}" stroke-linecap="round" opacity=".6" filter="url(#${id}b2)"/>` : "") +
    `<path d="${d}" fill="none" stroke="url(#${id}t${key})" stroke-width="${f(w)}" stroke-linecap="round"/>` +
    (dot
      ? `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(w * 3.6)}" fill="#d9f3ff" opacity="${hot ? 0.55 : 0.3}" filter="url(#${id}b2)"/><circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(w * 1.25)}" fill="#fff" opacity="${hot ? 1 : 0.9}"/>`
      : "");
  return { grad, svg };
}

/**
 * The app's generic single-seater (halo, wings, sidepods, grey helmet; no
 * number, logo or livery), as polygons on the track through the same
 * camera, grown `TRZ_CAR` times as the app grows its cars to map scale.
 * Local metres: x forward, y left, z up. The ghost is the compare ghost:
 * the same car in pink at the app's 35 %, with a pale rim, and no shadow.
 */
const TRZ_CAR = 6.5;
/** Both cars run two of the app's 2.4 m "Separar coches" slots outside the centre line, clear of the paint inside them. */
const TRZ_SLOT = -4.8;
function trzCar(id, u, { ghost = false, hot = false } = {}) {
  const { p, t, n } = TRZ.frame(u, TRZ_SLOT);
  const K = TRZ_CAR;
  const at3 = (x, y, z) => TRZ.proj([p[0] + (t[0] * x + n[0] * y) * K, p[1] + z * K, p[2] + (t[1] * x + n[1] * y) * K]);
  const path = (q) => q.map((v) => `${f(v[0])},${f(v[1])}`).join("L");
  const poly = (xy, z, fill, extra = "") => `<path d="M${path(xy.map(([x, y]) => at3(x, y, z)))}Z" fill="${fill}" ${extra}/>`;
  const box = (x0, x1, y0, y1, z, fill, extra) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z, fill, extra);
  const oval = (cx, cy, rx, ry, z, fill, extra) => poly(Array.from({ length: 20 }, (_, i) => [cx + rx * Math.cos((i * Math.PI) / 10), cy + ry * Math.sin((i * Math.PI) / 10)]), z, fill, extra);
  const G = "#ff9fd0", rim = "#ffd0ea";
  const carbon = ghost ? G : "#35373c", tyre = ghost ? G : "#1b1a22";
  const body = [[2.9, 0.1], [2.9, -0.1], [0.9, -0.42], [0.6, -0.82], [-1.25, -0.82], [-2.05, -0.34], [-2.05, 0.34], [-1.25, 0.82], [0.6, 0.82], [0.9, 0.42]];
  const deck = [[2.85, 0.07], [2.85, -0.07], [0.9, -0.3], [0.55, -0.62], [-1.2, -0.62], [-1.95, -0.24], [-1.95, 0.24], [-1.2, 0.62], [0.55, 0.62], [0.9, 0.3]];
  let g = ghost ? "" : oval(-0.1, 0, 3.1, 1.25, 0.02, "#120820", `opacity=".6" filter="url(#${id}b1)"`);
  g += box(-2.1, 1.3, -0.8, 0.8, 0.1, carbon); // floor
  for (const s of [-1, 1]) {
    g += box(1.4, 2.1, s * 0.62, s * 1.02, 0.36, tyre) + box(-2, -1.28, s * 0.58, s * 1.06, 0.38, tyre);
    // The compound on the tyre's shoulder, as the app paints it: a known one, never red.
    if (!ghost) g += box(1.4, 2.1, s * 0.97, s * 1.02, 0.4, C.sodium) + box(-2, -1.28, s * 1.01, s * 1.06, 0.42, C.sodium);
  }
  g += box(2.45, 2.95, -0.98, 0.98, 0.16, carbon); // front wing
  g += poly(body, 0.32, ghost ? G : "#b9a0c8") + poly(deck, 0.6, ghost ? G : "#f2eee3");
  g += oval(0.05, 0, 0.46, 0.26, 0.64, ghost ? G : "#1c1626"); // cockpit
  g += `<path d="M${path([[0.6, -0.3], [0.75, 0], [0.6, 0.3]].map(([x, y]) => at3(x, y, 0.95)))}" fill="none" stroke="${ghost ? rim : "#3f4245"}" stroke-width="${f(0.084 * K)}" stroke-linejoin="round"/>`; // halo
  g += oval(0, 0, 0.17, 0.15, 0.92, ghost ? rim : "#9599a0"); // helmet
  g += `<path d="M${path([at3(-0.25, 0, 0.85), at3(-1.9, 0, 0.7)])}" stroke="${ghost ? rim : "#fffaee"}" stroke-width="${f(0.09 * K)}" stroke-linecap="round"/>`; // engine cover
  g += box(-2.85, -2.35, -0.52, 0.52, 0.98, carbon); // rear wing
  const outline = `M${path(body.map(([x, y]) => at3(x, y, 0.32)))}Z`;
  // The ghost: the track's ink under it, so the line and the sky never show through its 35 %, and a pale rim.
  if (ghost) return `<path d="${outline}" fill="${C.ink}" opacity=".7"/><g opacity=".35">${g}</g><path d="${outline}" fill="none" stroke="${rim}" stroke-width="1" stroke-opacity=".95" stroke-linejoin="round"/>`;
  // A dark keyline round the body, so its cream deck stands off the cream paint.
  g = `<path d="${outline}" fill="none" stroke="#1c1626" stroke-width="1.6" stroke-linejoin="round"/>` + g;
  const [lx, ly] = at3(-2.9, 0, 0.42); // the rain light
  return g + (hot ? `<circle cx="${f(lx)}" cy="${f(ly)}" r="1.6" fill="#ff2d6f" opacity=".75" filter="url(#${id}b1)"/><circle cx="${f(lx)}" cy="${f(ly)}" r=".55" fill="#ff9ab8"/>` : `<circle cx="${f(lx)}" cy="${f(ly)}" r=".55" fill="#ff2d6f"/>`);
}

function trazada(p, lang, id, hot = false) {
  const r = rng(41);
  const { horizon, apex, lap, at, HALF } = TRZ;
  // Trails: [metres from the apex, length, slot, ramp] near the hairpin; [share of the lap, ...] far away.
  const trails = [
    [apex + 260, 150, 0, "fast"], [apex - 170, 140, 2.4, "braking"], [apex + 620, 250, 0, "fast"],
    [0.52 * lap, 170, 0, "slow"], [0.64 * lap, 150, -2.4, "slow"], [0.9 * lap, 200, 0, "fast"],
  ].map(([u, len, slot, ramp], k) => trzTrail(id, k, u, len, slot, ramp, hot));
  // The car just past the apex, side on, in its slot outside the paint; the ghost nose to tail, 40 m behind.
  const carAt = apex + 20, ghostAt = carAt - 40;
  // Lit, the car draws its own trail, ending under its rear wing.
  const own = trzTrail(id, "own", carAt - 2.4 * TRZ_CAR, 80, TRZ_SLOT, "fast", true, { dot: false });
  const line = [];
  for (let d = -160; d <= 160; d += 4) line.push(at(apex + d, trzLineOffset(d), 0.3));
  const lineD = trzSmooth(line);
  const fl = at(apex + 420, -HALF + 1, 0.3), fr = at(apex + 420, HALF - 1, 0.3); // the finish line
  let stars = "";
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = 8 + r() * (horizon - 30), q = r();
    if (y < 52 && Math.abs(x - W / 2) < 104) continue; // clear of the tagline
    stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.25 + q * 0.6)}" fill="${q > 0.8 ? C.amber : C.cream}" opacity="${f(0.15 + r() * 0.45)}"/>`;
  }
  // The sky: lavender over a sodium-and-peach band whose brightest line is the camera's horizon.
  const SKY = [[0, C.night], [18, C.ink], [36, "#4a2a66"], [59, C.lilac], [73, C.haze], [82, C.orange], [87, C.sodium], [90, C.amber], [93, "#ffb347"], [115, C.orange], [149, "#c25a7a"], [191, "#6a2f62"], [270, C.ink], [400, C.night]];
  const [t1, t2] = p.tag[lang];
  const title = (attrs) => `<text x="${W / 2}" y="322" text-anchor="middle" font-family="'Barlow Condensed'" font-style="italic" font-weight="800" font-size="66" textLength="214" lengthAdjust="spacingAndGlyphs" ${attrs}>TRAZADA</text>`;
  return `<symbol id="${id}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${id}bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}">${SKY.map(([y, c]) => `<stop offset="${f(y / H)}" stop-color="${c}"/>`).join("")}</linearGradient>
    <radialGradient id="${id}glow" cx=".5" cy="${f(horizon / H)}" r=".55" gradientTransform="translate(0 ${f(horizon / H)}) scale(1 .5) translate(0 ${f(-horizon / H)})"><stop offset="0" stop-color="${C.sodium}" stop-opacity=".55"/><stop offset=".5" stop-color="${C.orange}" stop-opacity=".18"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaee"/><stop offset=".55" stop-color="${C.sodium}"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}title" gradientUnits="userSpaceOnUse" x1="0" y1="275.8" x2="0" y2="322"><stop offset="0" stop-color="#fffaee"/><stop offset=".55" stop-color="${C.amber}"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
    <linearGradient id="${id}scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.night}" stop-opacity="0"/><stop offset=".22" stop-color="${C.night}" stop-opacity=".82"/><stop offset="1" stop-color="#140a2a" stop-opacity=".94"/></linearGradient>
    ${trails.map((t) => t.grad).join("")}${own.grad}
    <filter id="${id}sk" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".7"/></filter>
    <filter id="${id}b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1"/></filter>
    <filter id="${id}b2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="${id}b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="${id}b4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
    ${paperGrain(id + "g")}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>
  <g>${stars}</g>
  <rect width="${W}" height="${H}" fill="url(#${id}glow)" opacity=".7"/>
  <circle cx="160" cy="84" r="42" fill="${C.sodium}" opacity=".3" filter="url(#${id}b4)"/>
  <circle cx="160" cy="84" r="16" fill="url(#${id}sun)" opacity=".9"/>
  ${trzRibbon(id)}
  <path d="M${f(fl[0])},${f(fl[1])}L${f(fr[0])},${f(fr[1])}" stroke="#f2eee3" stroke-width=".9" opacity=".8"/>
  ${hot ? `<path d="${lineD}" fill="none" stroke="${C.magenta}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".6" filter="url(#${id}b3)"/>` : ""}
  <path d="${lineD}" fill="none" stroke="#f2eee3" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${lineD}" fill="none" stroke="#fff" stroke-width="${hot ? 1.4 : 1}" stroke-linecap="round" opacity="${hot ? 1 : 0.6}"/>
  ${trails.map((t) => t.svg).join("")}
  ${hot ? own.svg : ""}
  ${trzCar(id, ghostAt, { ghost: true })}
  ${trzCar(id, carAt, { hot })}
  <rect y="250" width="${W}" height="150" fill="url(#${id}scrim)"/>
  ${txt(W / 2, 30, 10, t1, { fam: "'Barlow Condensed'", w: 600, ls: 3.4 })}
  ${txt(W / 2, 43, 10, t2, { fam: "'Barlow Condensed'", w: 600, ls: 3.4, fill: C.sodium })}
  ${title(`fill="${C.orange}" opacity=".55" filter="url(#${id}b4)"`)}
  ${title(`fill="${C.magenta}" opacity=".85" transform="translate(2 3)"`)}
  ${title(`fill="url(#${id}title)"`)}
  <rect x="96" y="330" width="24" height="1.6" fill="#b36bff"/><rect x="123" y="330" width="24" height="1.6" fill="#2fbf71"/><rect x="150" y="330" width="24" height="1.6" fill="#e5c22b"/>
  ${txt(W / 2, 346, 8, p.sub[lang], { w: 500, fill: C.amber, ls: 0.3, extra: subFit(p.sub[lang], 8) })}
  ${billing(361, p.bill[lang], { width: 232, size: 13.5 })}
  ${footer(lang, p, { y: 386 })}
  ${grainRect(id + "g", 0.16)}
</symbol>`;
}

/* ------------------------------------------------------------ 3 OverLap */
/**
 * An eighties horror one-sheet: in the dark, the overlay's own radar (the
 * player's car in the middle, the lanes, the 10 and 20 m rings) floats like
 * a found screen, and a red car sits half alongside, its glow bleeding off
 * the radar's edge, two headlights in the fog beyond it like eyes. The
 * spotter's bar on that side burns red. No sim's logo or screen, only the
 * app's own drawing; lit, the glow, the eyes and the bar flare.
 */
function overlap(p, lang, id, hot = false) {
  const r = rng(71);
  const L = { near: "10 m", far: "20 m" };
  // fog: soft violet clouds drifting across the dark
  let fog = "";
  for (let i = 0; i < 22; i++) {
    const x = r() * W, y = 40 + r() * 280, rx = 30 + r() * 60, ry = 8 + r() * 16;
    fog += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${r() < 0.3 ? "#5a1838" : "#3a2a5c"}" opacity="${f(0.12 + r() * 0.2)}"/>`;
  }
  let dust = "";
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = 30 + r() * 300;
    dust += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.3 + r() * 0.6)}" fill="${r() < 0.4 ? "#ff6a7a" : C.cream}" opacity="${f(0.08 + r() * 0.3)}"/>`;
  }
  // the radar, a dark rounded screen, tilted a little
  const rx0 = 62, ry0 = 76, rw = 160, rh = 168, cx = rx0 + rw / 2, cy = ry0 + rh / 2;
  const car = (x, y, body, { glow = 0, light = "#ffd27a", stroke = "#1a0b14" } = {}) =>
    (glow ? `<rect x="${f(x - 11)}" y="${f(y - 21)}" width="22" height="42" rx="9" fill="${body}" opacity="${f(glow)}" filter="url(#${id}b4)"/>` : "") +
    `<rect x="${f(x - 8)}" y="${f(y - 17)}" width="16" height="34" rx="5.5" fill="${body}" stroke="${stroke}" stroke-width="1.2"/>` +
    `<rect x="${f(x - 4.6)}" y="${f(y - 11)}" width="9.2" height="4.4" rx="1.6" fill="${light}"/>` +
    `<rect x="${f(x - 6)}" y="${f(y - 15.5)}" width="2" height="31" rx="1" fill="#fff" opacity=".12"/>`;
  let ticks = "";
  for (let k = -3; k <= 3; k++) if (k) ticks += `<path d="M${cx - 3},${f(cy + k * 22)} h6" stroke="#a89cb8" stroke-opacity=".5" stroke-width=".7"/>`;
  const radar = `<g transform="rotate(-4 ${cx} ${cy})">
    <rect x="${rx0 - 2}" y="${ry0 - 2}" width="${rw + 4}" height="${rh + 4}" rx="11" fill="#ff2d4a" opacity="${hot ? 0.5 : 0.22}" filter="url(#${id}b4)"/>
    <rect x="${rx0}" y="${ry0}" width="${rw}" height="${rh}" rx="9" fill="url(#${id}scr)" stroke="#6a5a7a" stroke-opacity=".7" stroke-width="1"/>
    <g clip-path="url(#${id}clip)">
      <ellipse cx="${rx0 + 4}" cy="${cy + 6}" rx="${hot ? 70 : 56}" ry="${hot ? 70 : 58}" fill="url(#${id}bleed)"/>
      <rect x="${rx0 + 3}" y="${cy - 38}" width="${hot ? 6 : 4.4}" height="88" rx="2.5" fill="#ff3b4a" opacity="${hot ? 1 : 0.85}" filter="url(#${id}b2)"/>
      <path d="M${rx0},${cy} H${rx0 + rw} M${cx},${ry0} V${ry0 + rh}" stroke="#a89cb8" stroke-opacity=".45" stroke-width=".6"/>
      <path d="M${rx0},${cy - 52} H${rx0 + rw} M${rx0},${cy + 52} H${rx0 + rw}" stroke="#a89cb8" stroke-opacity=".4" stroke-width=".6" stroke-dasharray="3 2.4"/>
      ${ticks}
      ${car(cx, cy - 66, "#b07a86", { light: "#ffd27a" })}
      ${car(cx, cy + 62, "#d4636e", { light: "#ffd27a" })}
      ${car(cx - 26, cy + 8, "#ff3b3b", { glow: hot ? 0.95 : 0.7 })}
      ${car(cx, cy, "#ffc21a", { light: "#7a5a12", stroke: "#3a2a10" })}
      <path d="M${rx0},${ry0 + rh * 0.55} L${rx0 + rw},${ry0 + rh * 0.42}" stroke="#fff" stroke-opacity=".04" stroke-width="60"/>
    </g>
    <text x="${rx0 + rw - 9}" y="${ry0 + 15}" text-anchor="end" font-family="Space Grotesk" font-weight="700" font-size="8" fill="#c8bed6" fill-opacity=".8">${L.far}</text>
    <text x="${rx0 + rw - 9}" y="${cy - 56}" text-anchor="end" font-family="Space Grotesk" font-weight="700" font-size="8" fill="#c8bed6" fill-opacity=".8">${L.near}</text>
    <rect x="${rx0 - 20}" y="${ry0 + 2}" width="9" height="${rh - 4}" rx="4.5" fill="#2a1a2e" stroke="#4a3a5a" stroke-width=".8"/>
    ${hot ? `<rect x="${rx0 - 22}" y="${ry0 + 2}" width="13" height="${rh - 4}" rx="6" fill="#ff2d4a" opacity=".7" filter="url(#${id}b4)"/>` : ""}
    <rect x="${rx0 - 19}" y="${ry0 + 3}" width="7" height="${rh - 6}" rx="3.5" fill="url(#${id}bar)"/>
    <rect x="${rx0 + rw + 11}" y="${ry0 + 2}" width="9" height="${rh - 4}" rx="4.5" fill="#2a1a2e" stroke="#4a3a5a" stroke-width=".8"/>
    <rect x="${rx0 + rw + 12}" y="${ry0 + rh - 40}" width="7" height="37" rx="3.5" fill="#ff8a3c" opacity=".55"/>
  </g>`;
  // the eyes: two headlights in the fog, just off the radar's left edge
  const eyes = [[13, 214], [29, 211]].map(([x, y]) =>
    `<ellipse cx="${x}" cy="${y}" rx="${hot ? 14 : 10}" ry="${hot ? 7 : 5}" fill="#ff5a5a" opacity="${hot ? 0.85 : 0.6}" filter="url(#${id}b4)"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="1.8" fill="#fff0e8" opacity="${hot ? 1 : 0.85}"/>`).join("");
  const [t1, t2] = p.tag[lang];
  const title = (attrs) => `<text x="${W / 2}" y="330" text-anchor="middle" font-family="Anton" font-size="62" letter-spacing="1" textLength="222" lengthAdjust="spacingAndGlyphs" ${attrs}>OVERLAP</text>`;
  return `<symbol id="${id}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07030f"/><stop offset=".45" stop-color="#140822"/><stop offset=".78" stop-color="#2a0a22"/><stop offset="1" stop-color="#0b0410"/></linearGradient>
    <radialGradient id="${id}red" cx=".18" cy=".46" r=".6"><stop offset="0" stop-color="#ff2d4a" stop-opacity="${hot ? 0.42 : 0.26}"/><stop offset=".5" stop-color="#8a1030" stop-opacity=".12"/><stop offset="1" stop-color="#8a1030" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3644"/><stop offset=".6" stop-color="#2a2534"/><stop offset="1" stop-color="#1c1824"/></linearGradient>
    <radialGradient id="${id}bleed" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff2d3a" stop-opacity=".55"/><stop offset=".55" stop-color="#ff2d3a" stop-opacity=".16"/><stop offset="1" stop-color="#ff2d3a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff8a3c"/><stop offset=".5" stop-color="#ff3b3b"/><stop offset="1" stop-color="#ff2d4a"/></linearGradient>
    <linearGradient id="${id}title" gradientUnits="userSpaceOnUse" x1="0" y1="282" x2="0" y2="330"><stop offset="0" stop-color="#ffe6dc"/><stop offset=".45" stop-color="#ff5a5a"/><stop offset="1" stop-color="#b3102e"/></linearGradient>
    <linearGradient id="${id}scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0410" stop-opacity="0"/><stop offset=".3" stop-color="#0b0410" stop-opacity=".85"/><stop offset="1" stop-color="#07030a"/></linearGradient>
    <linearGradient id="${id}top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07030f" stop-opacity=".9"/><stop offset="1" stop-color="#07030f" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}clip"><rect x="${rx0}" y="${ry0}" width="${rw}" height="${rh}" rx="9"/></clipPath>
    <filter id="${id}b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="${id}b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="${id}b8" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>
    ${paperGrain(id + "g", 0.85)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>
  <rect width="${W}" height="${H}" fill="url(#${id}red)"/>${hot ? `<rect width="${W}" height="${H}" fill="url(#${id}red)" opacity=".6"/>` : ""}
  <g filter="url(#${id}b8)">${fog}</g>
  ${eyes}
  ${radar}
  <g>${dust}</g>
  <rect y="262" width="${W}" height="138" fill="url(#${id}scrim)"/>
  <rect width="${W}" height="56" fill="url(#${id}top)"/>
  ${txt(W / 2, 28, 10, t1, { fam: "Oswald", w: 500, ls: 3.6, fill: "#e8dcef" })}
  ${txt(W / 2, 42, 10, t2, { fam: "Oswald", w: 700, ls: 3.6, fill: "#ff5a64" })}
  ${title(`fill="#ff2d4a" opacity="${hot ? 0.95 : 0.7}" filter="url(#${id}b4)"`)}
  ${title(`fill="#3a0612" transform="translate(1.6 2.4)"`)}
  ${title(`fill="url(#${id}title)"`)}
  ${txt(W / 2, 345, 8.2, p.sub[lang], { w: 500, fill: "#ffc8c0", ls: 0.4, extra: subFit(p.sub[lang], 8.2) })}
  ${billing(360, p.bill[lang], { width: 234, size: 12, op: 0.74 })}
  ${footer(lang, p, { y: 387 })}
  ${grainRect(id + "g", 0.18)}
</symbol>`;
}

/* --------------------------------------------------- 4 Expenses-Log-App */
function expenses(p, lang, id, hot = false) {
  const r = rng(53);
  let rain = "";
  for (let i = 0; i < 120; i++) {
    const x = r() * W, y = r() * H, l = 6 + r() * 16;
    rain += `<path d="M${f(x)},${f(y)} l${f(-l * 0.18)},${f(l)}" stroke="#ffe6f4" stroke-opacity="${f(0.06 + r() * 0.16)}" stroke-width="${f(0.3 + r() * 0.5)}"/>`;
  }
  let bokeh = "";
  const cols = [C.sodium, C.pink, C.cyan, C.magenta, "#ffe9d0"];
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = 20 + r() * 260, rr = 6 + r() * 18;
    bokeh += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="${cols[i % cols.length]}" opacity="${f(0.05 + r() * 0.12)}"/>`;
  }
  const L = lang === "es"
    ? { day: "viernes 30", n1: ["El alquiler vence mañana.", "650,00 €"], n2: ["Gimnasio · cobra en 3 días", "29,90 €"], app: "EXPENSES LOG", now: "1 min", stamp: "PAGADO" }
    : { day: "Friday 30", n1: ["Rent is due tomorrow.", "€650.00"], n2: ["Gym · charges in 3 days", "€29.90"], app: "EXPENSES LOG", now: "1m", stamp: "PAID" };
  const stampW = L.stamp.length * 15 + 22;
  const [t1, t2] = p.tag[lang];
  return `<symbol id="${id}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#160a30"/><stop offset=".55" stop-color="#2e0c44"/><stop offset=".8" stop-color="#5a0f4a"/><stop offset="1" stop-color="#1a0820"/></linearGradient>
    <linearGradient id="${id}scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1458"/><stop offset=".55" stop-color="#8a2a7a"/><stop offset=".8" stop-color="#ff7a8a"/><stop offset="1" stop-color="#ffc38a"/></linearGradient>
    <linearGradient id="${id}edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe6f4"/><stop offset=".4" stop-color="#6a4a88"/><stop offset=".7" stop-color="#ff8fd0"/><stop offset="1" stop-color="#2a1442"/></linearGradient>
    <radialGradient id="${id}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff8fd0" stop-opacity=".55"/><stop offset="1" stop-color="#ff2d95" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}title" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd0ea"/><stop offset=".5" stop-color="#ff5ab0"/><stop offset="1" stop-color="#ff2d95"/></linearGradient>
    <filter id="${id}b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="${id}b1" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.3"/></filter>
    <filter id="${id}b8" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="${id}ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.78" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
    <clipPath id="${id}clip"><rect x="88" y="66" width="104" height="226" rx="13"/></clipPath>
    ${paperGrain(id + "g")}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>
  <g filter="url(#${id}b8)">${bokeh}</g>
  <!-- the collector's shadow on the wall -->
  <g fill="#0a0418" opacity=".7" filter="url(#${id}b1)" transform="translate(-12 6) scale(1.08)">
    <ellipse cx="62" cy="108" rx="58" ry="11"/>
    <path d="M30,108 C30,74 42,60 62,60 C82,60 94,74 94,108 Z"/>
    <path d="M56,62 q6,7 12,0" fill="#1a0b30"/>
    <ellipse cx="62" cy="128" rx="25" ry="30"/>
    <path d="M-20,280 C-16,200 10,168 40,160 L84,160 C114,168 140,200 144,280 Z"/>
  </g>
  <ellipse cx="140" cy="186" rx="96" ry="130" fill="url(#${id}glow)" opacity="${hot ? 1 : 0.8}"/>${hot ? `<ellipse cx="140" cy="186" rx="80" ry="120" fill="url(#${id}glow)"/>` : ""}
  <g transform="rotate(7 140 180)">
    <rect x="84" y="62" width="112" height="234" rx="16" fill="url(#${id}edge)"/>
    <rect x="86.5" y="64.5" width="107" height="229" rx="14" fill="#0d0716"/>
    <g clip-path="url(#${id}clip)">
      <rect x="88" y="66" width="104" height="226" fill="url(#${id}scr)"/>
      <circle cx="140" cy="250" r="26" fill="#ffd8a8" opacity=".9"/>
      <path d="M88,262 H192 V292 H88 Z" fill="#2a1442"/>
      <path d="M100,262 c2,-14 0,-26 -3,-34 M100,234 c-8,-2 -14,2 -16,6 M100,234 c6,-6 14,-4 16,0 M100,234 c-2,-6 -8,-8 -12,-8 M100,234 c4,-4 10,-6 14,-3" fill="none" stroke="#2a1442" stroke-width="2"/>
      <path d="M178,262 c-1,-10 0,-20 2,-26 M180,236 c-6,-2 -11,1 -13,4 M180,236 c5,-5 11,-3 13,0" fill="none" stroke="#2a1442" stroke-width="1.6"/>
      <rect x="88" y="66" width="104" height="226" fill="#0d0716" opacity=".18"/>
      <text x="140" y="112" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="31" fill="#fff4f1" letter-spacing="-.5">23:59</text>
      <text x="140" y="124" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="7" fill="#fff4f1" fill-opacity=".8">${L.day}</text>
      <g>
        <rect x="93" y="136" width="94" height="34" rx="7" fill="#fff4f8" fill-opacity=".92"/>
        <rect x="98" y="141" width="11" height="11" rx="3" fill="${C.magenta}"/><path d="M101,146.5 h5 M103.5,144 v5" stroke="#fff" stroke-width="1.2"/>
        <text x="112" y="147" font-family="JetBrains Mono" font-weight="700" font-size="4.2" fill="#6a4a88" letter-spacing=".4">${L.app}</text>
        <text x="182" y="147" text-anchor="end" font-family="Space Grotesk" font-size="4.4" fill="#6a4a88">${L.now}</text>
        <text x="98" y="158.5" font-family="Space Grotesk" font-weight="700" font-size="6.2" fill="#1a0b2c">${L.n1[0]}</text>
        <text x="98" y="166" font-family="Space Grotesk" font-weight="500" font-size="5" fill="#4a2a6a">${L.n1[1]}</text>
      </g>
      <g opacity=".82">
        <rect x="93" y="174" width="94" height="24" rx="7" fill="#fff4f8" fill-opacity=".7"/>
        <text x="98" y="185" font-family="Space Grotesk" font-weight="700" font-size="5.6" fill="#1a0b2c">${L.n2[0]}</text>
        <text x="98" y="193" font-family="Space Grotesk" font-weight="500" font-size="5" fill="#4a2a6a">${L.n2[1]}</text>
      </g>
    </g>
    <rect x="124" y="70" width="32" height="7" rx="3.5" fill="#0d0716"/>
    <path d="M94,70 L128,70 L98,290 L92,290 Z" fill="#fff" opacity=".06"/>
  </g>
  <g transform="rotate(-13 156 214)${hot ? " translate(156 214) scale(1.12) translate(-156 -214)" : ""}" filter="url(#${id}ink)" opacity="${hot ? 1 : 0.88}">
    <rect x="${f(156 - stampW / 2)}" y="195" width="${stampW}" height="40" rx="3" fill="none" stroke="${C.magenta}" stroke-width="3"/>
    <rect x="${f(160 - stampW / 2)}" y="199" width="${stampW - 8}" height="32" rx="2" fill="#ff2d95" fill-opacity=".08" stroke="${C.magenta}" stroke-width="1"/>
    <text x="156" y="225.5" text-anchor="middle" font-family="'Big Shoulders Display'" font-weight="900" font-size="30" letter-spacing="3" fill="${C.magenta}">${L.stamp}</text>
  </g>
  <g>${rain}</g>
  <rect y="292" width="${W}" height="108" fill="#12061f" fill-opacity=".55"/>
  ${txt(W / 2, 26, 12, t1, { fam: "Playfair Display", w: 700, italic: true, ls: 0.3 })}
  ${txt(W / 2, 41, 12, t2, { fam: "Playfair Display", w: 700, italic: true, ls: 0.3, fill: "#ff8fd0" })}
  <text x="${W / 2}" y="330" text-anchor="middle" font-family="'Playfair Display'" font-style="italic" font-weight="900" font-size="50" fill="#ff2d95" opacity=".6" filter="url(#${id}b3)" textLength="214" lengthAdjust="spacingAndGlyphs">Expenses</text>
  <text x="${W / 2}" y="330" text-anchor="middle" font-family="'Playfair Display'" font-style="italic" font-weight="900" font-size="50" fill="url(#${id}title)" textLength="214" lengthAdjust="spacingAndGlyphs">Expenses</text>
  <path d="M74,340 H108 M162,340 H196" stroke="#ffd8a8" stroke-width=".7"/>
  ${txt(W / 2, 344, 11, "LOG", { fam: "Playfair Display", w: 900, ls: 9, fill: "#ffd8a8" })}
  ${txt(W / 2, 354.5, 7.8, p.sub[lang], { w: 500, fill: C.cream, op: 0.85, ls: 0.3, extra: subFit(p.sub[lang], 7.8) })}
  ${billing(368, p.bill[lang], { width: 234, size: 10.5, op: 0.74 })}
  ${footer(lang, p, { y: 389 })}
  ${grainRect(id + "g", 0.16)}
</symbol>`;
}

const ART = { dot: dotfiles, trz: trazada, ovl: overlap, exp: expenses };
const posterId = (p, lang, hot) => `ps-${p.key}-${lang}${hot ? "-hot" : ""}`;

/** One poster as an SVG <symbol> (viewBox 270 x 400) and its id, for drawing it inside a larger frame. */
export function posterSymbol(repo, lang, hot = false) {
  const p = POSTERS.find((q) => q.repo === repo);
  if (!p) throw new Error(`no poster for ${repo}`);
  const id = posterId(p, lang, hot);
  return { id, svg: ART[p.key](p, lang, id, hot) };
}

/**
 * One poster as a standalone SVG document, `width` x `height` pixels.
 * `hot`: the lit state, with the poster's prop in action and every word in
 * place (the beam on, the racing line burning and the trails lit, the
 * red car's glow and its eyes flaring, the stamp down).
 */
export function posterSvg(repo, lang, { width = W, height = H, hot = false } = {}) {
  const { id, svg } = posterSymbol(repo, lang, hot);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}"><defs>${svg}</defs><use href="#${id}" width="${W}" height="${H}"/></svg>`;
}

/** The Google Fonts families the posters are drawn in. */
export const POSTER_FONTS = [
  "Space Grotesk:wght@400;500;700",
  "JetBrains Mono:wght@400;500;700",
  "Big Shoulders Display:wght@800;900",
  "Barlow Condensed:ital,wght@0,600;1,800",
  "Oswald:wght@500;700",
  "Anton",
  "Six Caps",
  "Playfair Display:ital,wght@1,700;1,900",
];
