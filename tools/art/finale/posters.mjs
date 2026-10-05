/**
 * The four one-sheets of The Afterglow (src/features/finale): one original
 * poster per side project, each in its own genre (a heist blueprint, a
 * museum job, a procedural's evidence board, a neo-noir). 27 x 40 ratio,
 * 270 x 400 units, one per repository and locale; title, tagline and
 * billing are baked in. Our own drawings and type, no borrowed art or logos.
 */
import fs from "node:fs";
import path from "node:path";
import { C, rng, f, mix, esc } from "./lib.mjs";

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
      en: ["JESÚS MOLANO PRESENTS A DECLARATIVE JOB · CACHYOS · HYPRLAND", "SIMULATED BEFORE IT IS APPLIED · ROLLED BACK IF IT FAILS"],
      es: ["JESÚS MOLANO PRESENTA UN GOLPE DECLARATIVO · CACHYOS · HYPRLAND", "SE ENSAYA ANTES DE APLICARSE · SE DESHACE SI FALLA"],
    },
  },
  {
    key: "tes", repo: "tessera-studio",
    tag: copy("tessera-studio", "tagline"),
    sub: copy("tessera-studio", "sub"),
    bill: {
      en: ["JESÚS MOLANO PRESENTS A READ-ONLY CATALOGUE · COMPONENTS · INVENTORY · REUSE", "WRITTEN IN PYTHON · ZERO DEPENDENCIES · STRICT CSP · RUNS LOCAL"],
      es: ["JESÚS MOLANO PRESENTA UN CATÁLOGO DE SOLO LECTURA · COMPONENTES · INVENTARIO · REUTILIZACIÓN", "ESCRITO EN PYTHON · CERO DEPENDENCIAS · CSP ESTRICTA · EN LOCAL"],
    },
  },
  {
    key: "atl", repo: "project-atlas",
    tag: copy("project-atlas", "tagline"),
    sub: copy("project-atlas", "sub"),
    bill: {
      en: ["JESÚS MOLANO PRESENTS AN EVIDENCE SIDECAR · FOR CODING AGENTS", "COMPONENTS · DESIGN EVIDENCE · DECISIONS · RISKS · BEFORE ANY CODE CHANGES"],
      es: ["JESÚS MOLANO PRESENTA UN SIDECAR DE EVIDENCIAS · PARA AGENTES DE CÓDIGO", "COMPONENTES · EVIDENCIAS DE DISEÑO · DECISIONES · RIESGOS · ANTES DE TOCAR CÓDIGO"],
    },
  },
  {
    key: "exp", repo: "Expenses-Log-App",
    tag: copy("expenses-log-app", "tagline"),
    sub: copy("expenses-log-app", "sub"),
    bill: {
      en: ["JESÚS MOLANO PRESENTS A MOBILE-FIRST PWA · SMART LISTS · ONE-TAP PAID", "WEB PUSH REMINDERS · WORKS OFFLINE · SUPABASE SYNC · NEXT 16"],
      es: ["JESÚS MOLANO PRESENTA UNA PWA MÓVIL · LISTAS INTELIGENTES · PAGOS EN UN TOQUE", "AVISOS WEB PUSH · FUNCIONA SIN CONEXIÓN · SINCRONIZACIÓN CON SUPABASE · NEXT 16"],
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
/** Billing block: condensed credits like a real one-sheet, squeezed to the width. */
function billing(y, lines, { fill = C.cream, op = 0.78, width = 226, size = 15.5 } = {}) {
  return lines.map((l, i) => `<text x="${W / 2}" y="${y + i * size * 0.86}" text-anchor="middle" font-family="'Six Caps'" font-size="${size}" fill="${fill}" fill-opacity="${op}" textLength="${width}" lengthAdjust="spacingAndGlyphs">${esc(l)}</text>`).join("");
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
function dotfiles(p, lang, id, hot = false) {
  const r = rng(11);
  let grid = "";
  for (let x = 0; x <= W; x += 10) grid += `<path d="M${x},0 V${H}" stroke="${C.cyan}" stroke-opacity="${x % 50 === 0 ? 0.13 : 0.05}" stroke-width=".5"/>`;
  for (let y = 0; y <= H; y += 10) grid += `<path d="M0,${y} H${W}" stroke="${C.cyan}" stroke-opacity="${y % 50 === 0 ? 0.13 : 0.05}" stroke-width=".5"/>`;
  const cy = C.cyan;
  // the plan: a tiled desktop drawn as the floor plan of the job
  const rooms = [
    [34, 98, 104, 136, lang === "es" ? "TERMINAL" : "TERMINAL"],
    [142, 98, 94, 50, lang === "es" ? "EDITOR" : "EDITOR"],
    [142, 152, 94, 40, lang === "es" ? "NAVEGADOR" : "BROWSER"],
    [142, 196, 94, 38, lang === "es" ? "MÚSICA" : "MUSIC"],
  ];
  let plan = "";
  plan += `<rect x="26" y="78" width="218" height="164" rx="3" fill="${cy}" fill-opacity=".035" stroke="${cy}" stroke-width="2.2"/>`;
  plan += `<rect x="29.5" y="81.5" width="211" height="157" rx="2" fill="none" stroke="${cy}" stroke-opacity=".5" stroke-width=".6"/>`;
  plan += `<rect x="34" y="84" width="202" height="10" fill="none" stroke="${cy}" stroke-width=".9"/>`;
  plan += `<text x="38" y="91.4" font-family="JetBrains Mono" font-size="4.8" font-weight="700" fill="${cy}" fill-opacity=".85" letter-spacing=".8">BAR · 23:59 · ▮▮▮▮▯</text>`;
  for (const [x, y, w, h, label] of rooms) {
    plan += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${cy}" stroke-width="1.1"/>`;
    plan += `<rect x="${x + 2.5}" y="${y + 2.5}" width="${w - 5}" height="${h - 5}" fill="none" stroke="${cy}" stroke-opacity=".35" stroke-width=".45"/>`;
    plan += `<text x="${x + 6}" y="${y + 10}" font-family="JetBrains Mono" font-weight="700" font-size="5.4" letter-spacing="1" fill="${cy}" fill-opacity=".9">${label}</text>`;
    // a door in each room: a gap and its swing
    plan += `<path d="M${x + w - 16},${y + h} h10" stroke="#0e1546" stroke-width="2.4"/><path d="M${x + w - 16},${y + h} a10,10 0 0 1 10,-10" fill="none" stroke="${cy}" stroke-opacity=".7" stroke-width=".55"/><path d="M${x + w - 6},${y + h} v-10" stroke="${cy}" stroke-opacity=".7" stroke-width=".55"/>`;
  }
  // terminal "furniture": lines of a prompt
  for (let i = 0; i < 9; i++) plan += `<path d="M42,${116 + i * 11} h${f(18 + r() * 62)}" stroke="${cy}" stroke-opacity="${i === 8 ? 0.9 : 0.3}" stroke-width="${i === 8 ? 1.2 : 0.7}" stroke-dasharray="${i % 3 === 0 ? "2 1.5" : "none"}"/>`;
  // dimension lines
  plan += `<g stroke="${cy}" stroke-opacity=".6" stroke-width=".5" fill="none"><path d="M26,68 H244 M26,64 V72 M244,64 V72"/><path d="M252,78 V242 M248,78 H256 M248,242 H256"/></g>`;
  plan += `<text x="135" y="65" text-anchor="middle" font-family="JetBrains Mono" font-size="4.8" fill="${cy}" fill-opacity=".75" letter-spacing=".6">2560</text>`;
  plan += `<text x="258" y="162" text-anchor="middle" font-family="JetBrains Mono" font-size="4.8" fill="${cy}" fill-opacity=".75" transform="rotate(90 258 162)">1440</text>`;
  // the route: dry run, apply, way out (through the west door)
  const L = lang === "es" ? ["ENSAYO", "APLICAR", "SALIDA"] : ["DRY RUN", "APPLY", "WAY OUT"];
  plan += `<path d="M26,150 h-2" stroke="#0e1546" stroke-width="3"/>`;
  const route = "M64,218 C92,214 112,196 104,170 S70,136 92,118 S128,104 120,138 S60,154 40,150 L12,150";
  if (hot) plan += `<path d="${route}" fill="none" stroke="${C.magenta}" stroke-width="6" opacity=".55" filter="url(#${id}b3)"/>`;
  plan += `<path d="${route}" fill="none" stroke="${hot ? "#ffd0ea" : C.magenta}" stroke-width="1.8" stroke-dasharray="4 2.6"/>`;
  plan += `<path d="M14,146 l-6,4 6,4" fill="none" stroke="${C.magenta}" stroke-width="1.8"/>`;
  const marks = [[64, 218, "1", L[0], 74, 221, "start"], [92, 118, "2", L[1], 101, 114, "start"], [22, 150, "3", L[2], 8, 166, "start"]];
  for (const [x, y, n, lab, lx, ly, anc] of marks) {
    plan += `<circle cx="${x}" cy="${y}" r="6.4" fill="#0e1546" stroke="${C.magenta}" stroke-width="1.4"/><text x="${x}" y="${y + 2.6}" text-anchor="middle" font-family="'Big Shoulders Display'" font-weight="900" font-size="8" fill="${C.cream}">${n}</text>`;
    plan += `<text x="${lx}" y="${ly}" text-anchor="${anc}" font-family="JetBrains Mono" font-weight="700" font-size="5.4" letter-spacing=".9" fill="${C.pink}" stroke="#0e1546" stroke-width="2.4" paint-order="stroke">${lab}</text>`;
  }
  // the dial: a combination lock laid on the plan
  const dx = 186, dy = 176, R = 52;
  let ticks = "", nums = "";
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * Math.PI * 2 + (hot ? 1.05 : 0.31);
    const l = i % 10 === 0 ? 8 : i % 5 === 0 ? 5.5 : 3.2;
    const r0 = R - 4.5, r1 = r0 - l;
    ticks += `<path d="M${f(dx + Math.sin(a) * r0)},${f(dy - Math.cos(a) * r0)} L${f(dx + Math.sin(a) * r1)},${f(dy - Math.cos(a) * r1)}" stroke="#2b1848" stroke-width="${i % 10 === 0 ? 1.1 : 0.55}"/>`;
    if (i % 10 === 0) {
      const rn = R - 19;
      nums += `<text x="${f(dx + Math.sin(a) * rn)}" y="${f(dy - Math.cos(a) * rn + 2.6)}" text-anchor="middle" font-family="'Big Shoulders Display'" font-weight="800" font-size="7.4" fill="#2b1848" transform="rotate(${f((a * 180) / Math.PI)} ${f(dx + Math.sin(a) * rn)} ${f(dy - Math.cos(a) * rn)})">${i}</text>`;
    }
  }
  let knurl = "";
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    knurl += `<path d="M${f(dx + Math.sin(a) * (R + 1))},${f(dy - Math.cos(a) * (R + 1))} L${f(dx + Math.sin(a) * (R + 6))},${f(dy - Math.cos(a) * (R + 6))}" stroke="#3a2a5c" stroke-opacity=".55" stroke-width=".9"/>`;
  }
  let grips = "";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.31;
    grips += `<circle cx="${f(dx + Math.sin(a) * 19.5)}" cy="${f(dy - Math.cos(a) * 19.5)}" r="2.6" fill="#5a4a7a"/>`;
  }
  const dial = `
    <ellipse cx="${dx + 7}" cy="${dy + 12}" rx="${R + 8}" ry="${R + 6}" fill="#050214" opacity=".6" filter="url(#${id}b6)"/>
    <circle cx="${dx}" cy="${dy}" r="${R + 6}" fill="url(#${id}chrome)"/>
    ${knurl}
    <circle cx="${dx}" cy="${dy}" r="${R}" fill="url(#${id}face)" stroke="#5a4a7a" stroke-width=".8"/>
    ${ticks}${nums}
    <circle cx="${dx}" cy="${dy}" r="22" fill="url(#${id}knob)" stroke="#2b1848" stroke-width=".6"/>
    ${grips}
    <circle cx="${dx}" cy="${dy}" r="14.5" fill="url(#${id}chrome)" stroke="#2b1848" stroke-width=".5"/>
    <circle cx="${dx}" cy="${dy}" r="6.2" fill="${C.magenta}"/><circle cx="${dx - 1.8}" cy="${dy - 2}" r="1.8" fill="#fff" opacity=".7"/>
    <path d="M${dx},${dy - R - 8} l-5,-9 h10 z" fill="${C.magenta}"/>
    <path d="M${dx - 34},${dy - 40} a52,52 0 0 1 30,-12" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round"/>`;
  const [t1, t2] = p.tag[lang];
  return `<symbol id="${id}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16245e"/><stop offset=".55" stop-color="#0f1748"/><stop offset="1" stop-color="#0a0828"/></linearGradient>
    <radialGradient id="${id}lamp" cx=".55" cy=".42" r=".55"><stop offset="0" stop-color="#3a63c8" stop-opacity=".55"/><stop offset="1" stop-color="#3a63c8" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}chrome" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#e6dcf0"/><stop offset=".7" stop-color="#8f7cae"/><stop offset="1" stop-color="#3a2a5c"/></radialGradient>
    <radialGradient id="${id}face" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fffaf2"/><stop offset=".7" stop-color="#efe2d2"/><stop offset="1" stop-color="#c9b4b0"/></radialGradient>
    <radialGradient id="${id}knob" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#d8cce6"/><stop offset="1" stop-color="#6a5a8a"/></radialGradient>
    <linearGradient id="${id}title" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e3fbff"/><stop offset="1" stop-color="#8fe9f7"/></linearGradient>
    <filter id="${id}b6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="${id}b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    ${paperGrain(id + "g")}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>
  <rect width="${W}" height="${H}" fill="url(#${id}lamp)" opacity="${hot ? 1.6 : 1}"/>${hot ? `<rect width="${W}" height="${H}" fill="url(#${id}lamp)"/>` : ""}
  <g>${grid}</g>
  <g transform="rotate(-3 135 160)">${plan}</g>
  ${dial}
  <rect y="262" width="${W}" height="138" fill="#0a0828" fill-opacity=".55"/>
  ${txt(W / 2, 30, 8.6, t1, { ls: 3.2 })}
  ${txt(W / 2, 43, 8.6, t2, { ls: 3.2, fill: C.pink })}
  <text x="146" y="324" text-anchor="middle" font-family="'Big Shoulders Display'" font-weight="900" font-size="66" letter-spacing="1" fill="${C.cyan}" opacity=".55" filter="url(#${id}b3)" textLength="196" lengthAdjust="spacingAndGlyphs">DOTFILES</text>
  <text x="146" y="324" text-anchor="middle" font-family="'Big Shoulders Display'" font-weight="900" font-size="66" letter-spacing="1" fill="url(#${id}title)" textLength="196" lengthAdjust="spacingAndGlyphs">DOTFILES</text>
  <circle cx="38" cy="318" r="6.4" fill="${C.magenta}"/>
  ${txt(W / 2, 341, 8.6, p.sub[lang], { w: 500, fill: C.pink, ls: 0.4, extra: subFit(p.sub[lang], 8.6) })}
  ${billing(357, p.bill[lang], { width: 230, size: 14 })}
  ${footer(lang, p, { y: 384 })}
  ${grainRect(id + "g", 0.16)}
</symbol>`;
}

/* ----------------------------------------------------- 2 tessera-studio */
function tessera(p, lang, id, hot = false) {
  const r = rng(23);
  // the mosaic: a component card set in tesserae, a gold border
  const cols = 17, rows = 22, t = 4.7, gap = 0.75, x0 = 95.5, y0 = 98;
  let tiles = "";
  const pick = (i, j) => {
    if (i < 1 || j < 1 || i > cols - 2 || j > rows - 2) return (i + j) % 2 ? "#f0c36a" : "#d9963f";
    if (i < 2 || j < 2 || i > cols - 3 || j > rows - 3) return "#3a1a52";
    // card
    if (i >= 3 && i <= cols - 4 && j >= 3 && j <= rows - 4) {
      const ci = i - 3, cj = j - 3;
      const dxA = ci - 2.2, dyA = cj - 2.4;
      if (dxA * dxA + dyA * dyA <= 3.6) return cj < 2 ? "#ff8fd0" : "#ff2d95";
      if (cj >= 1 && cj <= 2 && ci >= 5 && ci <= 9) return cj === 1 ? "#2b1848" : "#8c62b8";
      if (cj === 6 && ci >= 1 && ci <= 9) return "#2b1848";
      if (cj === 8 && ci >= 1 && ci <= 8) return "#a58cc8";
      if (cj === 10 && ci >= 1 && ci <= 6) return "#a58cc8";
      if (cj >= 12 && cj <= 13 && ci >= 1 && ci <= 6) return "#ffb83a";
      return "#fbf0e4";
    }
    return "#2b1848";
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const c = pick(i, j);
      const jit = (r() - 0.5) * 0.9;
      const shade = r() < 0.5 ? mix(c, "#ffffff", r() * 0.14) : mix(c, "#1a0d38", r() * 0.18);
      tiles += `<rect x="${f(x0 + i * (t + gap) + jit)}" y="${f(y0 + j * (t + gap) + (r() - 0.5) * 0.9)}" width="${t}" height="${t}" rx=".6" fill="${shade}" transform="rotate(${f((r() - 0.5) * 6)} ${f(x0 + i * (t + gap) + t / 2)} ${f(y0 + j * (t + gap) + t / 2)})"/>`;
    }
  }
  const mw = cols * (t + gap) - gap, mh = rows * (t + gap) - gap;
  // fluted back wall
  let flutes = "";
  for (let x = 6; x < W; x += 15) flutes += `<rect x="${x}" y="0" width="7" height="300" fill="#ffffff" opacity=".028"/>`;
  // the lasers (strict CSP)
  const beams = [[0, 112, 270, 176], [0, 196, 270, 104], [0, 150, 270, 226], [0, 236, 270, 148]];
  let lasers = "";
  for (const [a, b, c, d] of beams) {
    lasers += `<path d="M${a},${b} L${c},${d}" stroke="#ff2d6f" stroke-width="${hot ? 6 : 3.2}" opacity="${hot ? 0.7 : 0.35}" filter="url(#${id}b2)"/>`;
    lasers += `<path d="M${a},${b} L${c},${d}" stroke="#ff9ab8" stroke-width=".6"/>`;
    lasers += `<circle cx="${a + 2}" cy="${b}" r="2" fill="#ff2d6f"/><circle cx="${c - 2}" cy="${d}" r="2" fill="#ff2d6f"/>`;
  }
  const [t1, t2] = p.tag[lang];
  const lot = lang === "es" ? ["LOTE 07", "REUSAR ✓"] : ["LOT 07", "REUSE ✓"];
  return `<symbol id="${id}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241040"/><stop offset=".72" stop-color="#170a2c"/><stop offset="1" stop-color="#0d0619"/></linearGradient>
    <linearGradient id="${id}cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9c8" stop-opacity=".42"/><stop offset="1" stop-color="#ffe9c8" stop-opacity="0"/></linearGradient>
    <radialGradient id="${id}pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe1b0" stop-opacity=".5"/><stop offset="1" stop-color="#ffe1b0" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset=".45" stop-color="#f0c36a"/><stop offset=".55" stop-color="#c98a3a"/><stop offset="1" stop-color="#ffe2a0"/></linearGradient>
    <linearGradient id="${id}slab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6ea"/><stop offset="1" stop-color="#cdb7c8"/></linearGradient>
    <linearGradient id="${id}plinth" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1442"/><stop offset=".45" stop-color="#5a3a78"/><stop offset=".55" stop-color="#6a4a88"/><stop offset="1" stop-color="#22103a"/></linearGradient>
    <filter id="${id}b2" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="${id}b5" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
    ${paperGrain(id + "g")}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>
  ${flutes}
  <path d="M118,0 H152 L232,262 H38 Z" fill="url(#${id}cone)" filter="url(#${id}b5)"/>
  <ellipse cx="135" cy="262" rx="92" ry="12" fill="url(#${id}pool)"/>
  <!-- plinth -->
  <rect x="86" y="230" width="98" height="34" fill="url(#${id}plinth)"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${92 + i * 13}" y="232" width="5" height="30" fill="#ffffff" opacity=".06"/>`).join("")}
  <rect x="78" y="224" width="114" height="7" fill="url(#${id}slab)"/>
  <rect x="78" y="263" width="114" height="5" fill="#cdb7c8" opacity=".7"/>
  <!-- the vitrine -->
  <rect x="84" y="80" width="102" height="144" fill="#ffffff" fill-opacity=".04" stroke="#fff4f1" stroke-opacity=".55" stroke-width=".7"/>
  <path d="M84,80 L92,72 H194 L186,80 M194,72 V216 L186,224" fill="none" stroke="#fff4f1" stroke-opacity=".35" stroke-width=".6"/>
  <rect x="${x0 - 3}" y="${y0 - 3}" width="${f(mw + 6)}" height="${f(mh + 6)}" fill="#120624"/>
  ${tiles}
  <path d="M92,82 L120,82 L96,222 L86,222 Z" fill="#ffffff" opacity=".09"/>
  <path d="M150,82 L160,82 L136,222 L130,222 Z" fill="#ffffff" opacity=".05"/>
  <!-- the lot tag -->
  <path d="M186,96 C196,104 200,112 204,120" fill="none" stroke="#e8d6c8" stroke-width=".6"/>
  <g transform="rotate(9 214 132)">
    <path d="M200,118 h30 v28 h-30 l-5,-14 z" fill="#f6ead8"/><circle cx="201.5" cy="132" r="1.6" fill="#241040"/>
    <text x="215" y="129" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="5.6" fill="#241040">${lot[0]}</text>
    <text x="215" y="139" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="5" fill="#b0306a">${lot[1]}</text>
  </g>
  ${lasers}
  ${hot ? `<rect width="${W}" height="272" fill="#ff2d6f" opacity=".13"/><circle cx="135" cy="6" r="60" fill="#ff2d6f" opacity=".35" filter="url(#${id}b5)"/>` : ""}
  <rect y="272" width="${W}" height="128" fill="#0d0619" fill-opacity=".45"/>
  ${txt(W / 2, 30, 9, t1, { fam: "Cinzel", w: 800, ls: 2.6 })}
  ${txt(W / 2, 43, 9, t2, { fam: "Cinzel", w: 800, ls: 2.6, fill: "#f0c36a" })}
  <text x="${W / 2}" y="314" text-anchor="middle" font-family="Cinzel" font-weight="900" font-size="44" fill="#1a0b2c" transform="translate(1.5 2)" textLength="224" lengthAdjust="spacingAndGlyphs">TESSERA</text>
  <text x="${W / 2}" y="314" text-anchor="middle" font-family="Cinzel" font-weight="900" font-size="44" fill="url(#${id}gold)" textLength="224" lengthAdjust="spacingAndGlyphs">TESSERA</text>
  ${txt(W / 2, 331, 11, "STUDIO", { fam: "Cinzel", w: 800, ls: 11, fill: C.cream })}
  ${txt(W / 2, 346, 8.4, p.sub[lang], { w: 500, fill: "#ffd8a8", ls: 0.4, extra: subFit(p.sub[lang], 8.4) })}
  ${billing(361, p.bill[lang], { width: 232, size: 13.5 })}
  ${footer(lang, p, { y: 386 })}
  ${grainRect(id + "g", 0.15)}
</symbol>`;
}

/* ------------------------------------------------------ 3 project-atlas */
function atlas(p, lang, id, hot = false) {
  const r = rng(37);
  const L = lang === "es"
    ? { comp: "COMPONENTES", design: "DISEÑO", dec: "DECISIONES", risk: "RIESGOS", note: ["AGENTE:", "LEE ESTO", "PRIMERO."], card: ["DECISIÓN 014", "Los tokens", "no se tocan."], stamp: "EVIDENCIAS", sheet: "ATLAS · HOJA 1", tokens: "TOKENS", button: "BOTÓN ×14", modal: "¿RIESGO?" }
    : { comp: "COMPONENTS", design: "DESIGN", dec: "DECISIONS", risk: "RISKS", note: ["AGENT:", "READ THIS", "FIRST."], card: ["DECISION 014", "The tokens", "stay put."], stamp: "EVIDENCE", sheet: "ATLAS · SHEET 1", tokens: "TOKENS", button: "BUTTON ×14", modal: "RISK?" };
  // The stamp's box fits its word; a long one (EVIDENCIAS) moves left so it stays on the sheet.
  const stampW = L.stamp.length * 8.2 + 14;
  const stampX = Math.min(176, W - 12 - stampW);
  // cork speckle
  let cork = "";
  for (let i = 0; i < 520; i++) {
    const x = r() * W, y = r() * 300;
    cork += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.4 + r() * 1.3)}" fill="${r() < 0.5 ? "#3a1a2c" : "#c58a7a"}" opacity="${f(0.15 + r() * 0.3)}"/>`;
  }
  // the map: blocks, an avenue, the river, four districts
  let map = "";
  const mx = 54, my = 94, mw = 166, mh = 122;
  map += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="#f4e6d4"/>`;
  for (let gx = 0; gx < 13; gx++) for (let gy = 0; gy < 9; gy++) {
    if (r() < 0.12) continue;
    map += `<rect x="${f(mx + 6 + gx * 12.6)}" y="${f(my + 8 + gy * 13)}" width="${f(8.4 + r() * 2)}" height="${f(8.6 + r() * 2)}" fill="${r() < 0.15 ? "#e8b8c4" : "#ddc9cf"}"/>`;
  }
  map += `<path d="M${mx},${my + 96} C${mx + 40},${my + 84} ${mx + 70},${my + 112} ${mx + 112},${my + 96} S${mx + 150},${my + 70} ${mx + mw},${my + 78}" fill="none" stroke="#9fd6e2" stroke-width="7"/>`;
  map += `<path d="M${mx + 8},${my + mh} L${mx + mw - 18},${my}" stroke="#f4e6d4" stroke-width="4"/><path d="M${mx + 8},${my + mh} L${mx + mw - 18},${my}" stroke="#c9a2a8" stroke-width=".6"/>`;
  map += `<path d="M${mx + mw / 3},${my} V${my + mh} M${mx + (2 * mw) / 3},${my} V${my + mh} M${mx},${my + mh / 2} H${mx + mw}" stroke="#b89a8e" stroke-opacity=".5" stroke-width=".7"/>`;
  const dist = [
    [mx + 6, my + 6, 70, 52, L.comp], [mx + 92, my + 6, 72, 46, L.design],
    [mx + 6, my + 66, 66, 56, L.dec], [mx + 96, my + 62, 68, 60, L.risk],
  ];
  dist.forEach(([x, y, w, h, lab], i) => {
    map += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${i === 3 ? "#ff2d6f" : "#6a4bc4"}" fill-opacity=".08" stroke="${i === 3 ? "#d8205a" : "#4a2a7a"}" stroke-width=".9" stroke-dasharray="3 2"/>`;
    const lx = i === 0 ? x + 16 : x + 3;
    map += `<rect x="${lx}" y="${y + 3}" width="${lab.length * 4.6 + 6}" height="9" fill="#f4e6d4"/>`;
    map += `<text x="${lx + 3}" y="${y + 10}" font-family="'Special Elite'" font-size="7" fill="${i === 3 ? "#c41850" : "#2b1848"}">${lab}</text>`;
  });
  map += `<path d="M${mx + 128},${my + 92} l10,10 M${mx + 138},${my + 92} l-10,10" stroke="#d8205a" stroke-width="2.2"/>`;
  map += `<text x="${mx + mw - 4}" y="${my + mh - 4}" text-anchor="end" font-family="JetBrains Mono" font-size="4.6" fill="#6a4a5a">${L.sheet}</text>`;
  // compass rose
  map += `<g transform="translate(${mx + 150} ${my + 26})"><circle r="7" fill="none" stroke="#6a4a5a" stroke-width=".5"/><path d="M0,-10 L2,0 0,10 -2,0 Z" fill="#2b1848"/><text y="-11.5" text-anchor="middle" font-family="JetBrains Mono" font-size="4" fill="#2b1848">N</text></g>`;
  const pin = (x, y, c = C.magenta) => `<circle cx="${x + 1}" cy="${y + 2.4}" r="3.6" fill="#1a0b14" opacity=".45"/><circle cx="${x}" cy="${y}" r="3.6" fill="${c}"/><circle cx="${x - 1.1}" cy="${y - 1.2}" r="1.1" fill="#fff" opacity=".75"/>`;
  const pins = { comp: [96, 126], design: [180, 124], dec: [84, 184], risk: [184, 186] };
  // items around the map
  const polaroid = `<g transform="rotate(-9 38 84)">
    <rect x="8" y="48" width="60" height="70" fill="#fbf6ee"/><rect x="13" y="53" width="50" height="46" fill="#1d0f33"/>
    <rect x="21" y="70" width="34" height="12" rx="6" fill="${C.magenta}"/><text x="38" y="78" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="5.4" fill="#fff">OK</text>
    <text x="38" y="111" text-anchor="middle" font-family="'Special Elite'" font-size="6.4" fill="#2b1848">${L.button}</text></g>`;
  const swatch = `<g transform="rotate(8 230 80)">
    <rect x="202" y="54" width="58" height="58" fill="#fbf6ee"/>
    <rect x="207" y="59" width="15" height="34" fill="${C.magenta}"/><rect x="223.5" y="59" width="15" height="34" fill="${C.sodium}"/><rect x="240" y="59" width="15" height="34" fill="${C.cyan}"/>
    <text x="231" y="105" text-anchor="middle" font-family="'Special Elite'" font-size="6.4" fill="#2b1848">${L.tokens}</text></g>`;
  let lines = "";
  for (let i = 0; i < 4; i++) lines += `<path d="M18,${222 + i * 8} h76" stroke="#a8c4e0" stroke-width=".5"/>`;
  const card = `<g transform="rotate(4 56 228)">
    <rect x="14" y="204" width="84" height="50" fill="#fdfaf2"/><path d="M14,214 h84" stroke="#e86a8a" stroke-width=".6"/>${lines}
    <text x="20" y="211.5" font-family="'Special Elite'" font-size="6.2" fill="#c41850">${L.card[0]}</text>
    <text x="20" y="227" font-family="'Special Elite'" font-size="7.6" fill="#2b1848">${L.card[1]}</text>
    <text x="20" y="237" font-family="'Special Elite'" font-size="7.6" fill="#2b1848">${L.card[2]}</text></g>`;
  const photo = `<g transform="rotate(-7 222 222)">
    <rect x="192" y="190" width="62" height="64" fill="#fbf6ee"/><rect x="197" y="195" width="52" height="42" fill="#2a1442"/>
    <rect x="206" y="202" width="34" height="27" rx="2" fill="#efe2f0"/><rect x="206" y="202" width="34" height="6" fill="#8c62b8"/>
    <rect x="210" y="212" width="20" height="2.4" fill="#b9a0c8"/><rect x="210" y="217" width="14" height="2.4" fill="#b9a0c8"/>
    <ellipse cx="223" cy="216" rx="24" ry="17" fill="none" stroke="#ff2d6f" stroke-width="1.6" transform="rotate(-8 223 216)"/>
    <text x="223" y="248" text-anchor="middle" font-family="'Special Elite'" font-size="6.6" fill="#c41850">${L.modal}</text></g>`;
  const sticky = `<g transform="rotate(4 148 232)">
    <rect x="121" y="206" width="56" height="52" fill="#2a1408" opacity=".35" transform="translate(2 3)"/>
    <rect x="121" y="206" width="56" height="52" fill="${C.sodium}"/><rect x="121" y="206" width="56" height="9" fill="#f5c45a"/>
    ${L.note.map((l, i) => `<text x="128" y="${226 + i * 10}" font-family="'Special Elite'" font-size="8" fill="#2b1848">${l}</text>`).join("")}</g>`;
  // red string: from the items to the districts
  const ends = [[34, 58, ...pins.comp], [228, 62, ...pins.design], [52, 210, ...pins.dec], [224, 196, ...pins.risk], [150, 212, ...pins.comp], [150, 212, ...pins.risk]];
  let strings = "";
  for (const [a, b, c, d] of ends) {
    const mxp = (a + c) / 2, myp = (b + d) / 2 + 6;
    strings += `<path d="M${a},${b} Q${mxp},${myp} ${c},${d}" fill="none" stroke="#1a0b14" stroke-opacity=".35" stroke-width="1.4" transform="translate(1 2)"/>`;
    if (hot) strings += `<path d="M${a},${b} Q${mxp},${myp} ${c},${d}" fill="none" stroke="#ff2d95" stroke-width="5" opacity=".6" filter="url(#${id}sh)"/>`;
    strings += `<path d="M${a},${b} Q${mxp},${myp} ${c},${d}" fill="none" stroke="${hot ? "#ff9ad0" : "#ff2d6f"}" stroke-width="${hot ? 1.4 : 1.1}"/>`;
  }
  const [t1, t2] = p.tag[lang];
  return `<symbol id="${id}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4652"/><stop offset=".6" stop-color="#5e3348"/><stop offset="1" stop-color="#241034"/></linearGradient>
    <radialGradient id="${id}lamp" cx=".5" cy=".36" r=".6"><stop offset="0" stop-color="#ffd8a8" stop-opacity=".55"/><stop offset=".6" stop-color="#ff8a5c" stop-opacity=".12"/><stop offset="1" stop-color="#ff8a5c" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241034" stop-opacity=".85"/><stop offset="1" stop-color="#241034" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0d38" stop-opacity="0"/><stop offset=".35" stop-color="#1a0d38" stop-opacity=".88"/><stop offset="1" stop-color="#120828"/></linearGradient>
    <filter id="${id}sh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
    ${paperGrain(id + "g", 0.75)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>
  ${cork}
  <rect width="${W}" height="${H}" fill="url(#${id}lamp)"/>${hot ? `<rect width="${W}" height="${H}" fill="url(#${id}lamp)"/>` : ""}
  <g transform="rotate(-3 137 155)"><rect x="58" y="100" width="166" height="122" fill="#1a0b14" opacity=".4" filter="url(#${id}sh)"/>${map}</g>
  ${polaroid}${swatch}${card}${photo}${sticky}
  ${strings}
  ${pin(...pins.comp)}${pin(...pins.design)}${pin(...pins.dec)}${pin(...pins.risk, "#ffd27a")}${pin(34, 56)}${pin(228, 60)}${pin(52, 208)}${pin(224, 194)}${pin(150, 210, "#19e6ff")}
  <g transform="rotate(-14 210 150)" opacity=".8"><rect x="${stampX}" y="138" width="${stampW}" height="22" rx="2" fill="none" stroke="#e0185a" stroke-width="1.8"/><text x="${stampX + 7}" y="154" font-family="'Big Shoulders Display'" font-weight="900" font-size="15" letter-spacing="2" fill="#e0185a">${L.stamp}</text></g>
  <rect y="250" width="${W}" height="150" fill="url(#${id}fade)"/>
  <rect width="${W}" height="46" fill="url(#${id}top)"/>
  ${txt(W / 2, 22, 9, t1, { fam: "Oswald", w: 700, ls: 3.4 })}
  ${txt(W / 2, 34, 9, t2, { fam: "Oswald", w: 700, ls: 3.4, fill: "#ffd8a8" })}
  ${txt(W / 2 + 6, 286, 12, "PROJECT", { fam: "Oswald", w: 500, ls: 12, fill: "#ff8fd0" })}
  <text x="${W / 2 + 2}" y="345" text-anchor="middle" font-family="Anton" font-size="58" fill="#ff2d6f" opacity=".85" textLength="196" lengthAdjust="spacingAndGlyphs">ATLAS</text>
  <text x="${W / 2}" y="342" text-anchor="middle" font-family="Anton" font-size="58" fill="${C.cream}" textLength="196" lengthAdjust="spacingAndGlyphs">ATLAS</text>
  ${txt(W / 2, 355, 8.2, p.sub[lang], { w: 500, fill: "#ffd8a8", ls: 0.3, extra: subFit(p.sub[lang], 8.2) })}
  ${billing(370.5, p.bill[lang], { width: 234, size: 11.5, op: 0.72 })}
  ${footer(lang, p, { y: 389 })}
  ${grainRect(id + "g", 0.2)}
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
    ? { day: "viernes 30", n1: ["El alquiler vence mañana.", "650,00 € · toca para marcar pagado"], n2: ["Gimnasio · cobra en 3 días", "29,90 €"], app: "EXPENSES LOG", now: "1 min", stamp: "PAGADO", off: "SIN CONEXIÓN · EN COLA" }
    : { day: "Friday 30", n1: ["Rent is due tomorrow.", "€650.00 · tap to mark it paid"], n2: ["Gym · charges in 3 days", "€29.90"], app: "EXPENSES LOG", now: "1m", stamp: "PAID", off: "OFFLINE · QUEUED" };
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
      <text x="140" y="211" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="4.4" fill="#fff4f1" fill-opacity=".75" letter-spacing=".8">${L.off}</text>
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
  ${billing(370, p.bill[lang], { width: 234, size: 11.5, op: 0.72 })}
  ${footer(lang, p, { y: 389 })}
  ${grainRect(id + "g", 0.16)}
</symbol>`;
}

const ART = { dot: dotfiles, tes: tessera, atl: atlas, exp: expenses };
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
 * `hot`: the lit state, with the poster's prop in action (the dial turned
 * and the route lit, the lasers flared, the string glowing, the stamp down).
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
  "Cinzel:wght@800;900",
  "Oswald:wght@500;700",
  "Anton",
  "Six Caps",
  "Special Elite",
  "Playfair Display:ital,wght@1,700;1,900",
];
