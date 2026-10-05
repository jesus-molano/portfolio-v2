/**
 * The Afterglow: the art-deco picture palace on the plaza where the avenue
 * ends, drawn as SVG for the finale's plates (src/features/finale). One
 * set, two moods: night (the side projects, every light on) and dawn (the
 * end credits, the lights going out, the convertible parked at the kerb).
 *
 * The plates leave the live parts to the DOM: the marquee board is blank
 * (its changeable letters are DOM), the bulb strips and the poster cases of
 * the night plate are DOM too (they chase and light on hover). `cinema()`
 * returns the projected geometry of every live part, so the page can put
 * its elements exactly on the plate (finaleLayout.ts reads it).
 */
import { C, rng, f, clamp, lerp, mix, esc, poly, palmCrown } from "./lib.mjs";
import { posterSymbol } from "./posters.mjs";

/** The repositories on the bill, left to right (the cases' order). */
export const BILL = ["dotfiles", "tessera-studio", "project-atlas", "Expenses-Log-App"];

/** World metres: facade plane z 0, ground y 0, x centred on the entrance. */
export const CIN = {
  roof: 8.2, wingRoof: 7.6, half: 17, block: 8.6, ground: 3.75,
  marquee: { x0: -6.6, x1: 6.6, y0: 3.75, y1: 6.15, z: 3.0 },
  crest: { half: 3.9, y0: 6.15, y1: 7.55, z: 2.75 },
  entrance: { half: 3.1, depth: 2.6 },
  booth: { half: 0.95, z: -0.9 },
  cases: [-6.45, -4.35, 4.35, 6.45], caseW: 1.75, caseH: 2.36, caseY: 0.62, posterW: 1.42, posterH: 2.1,
};

/* ------------------------------------------------------------- helpers */
const rect = (cam, x0, y0, x1, y1, z) => {
  const a = cam.p(x0, y1, z), b = cam.p(x1, y0, z);
  return { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] };
};
const R = (r, attrs) => `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" ${attrs}/>`;

/** Words painted on the building itself (the booth's neon and the crest's sub-line). */
export const CINEMA_TEXT = {
  booth: { en: "TICKETS", es: "TAQUILLA" },
  cinema: { en: "CINEMA", es: "CINE" },
};

/** A rectangle in frame pixels. */
const box = (x, y, w, h) => ({ x: f(x), y: f(y), w: f(w), h: f(h) });

/* --------------------------------------------------------------- scene */
/**
 * o: { px, w, h, lang, rows: [cap metres per letter row], mode: "night" | "dawn",
 *      cases: "dom" (night: their light only, the cases are DOM) | "baked" (dawn: dark cases),
 *      lit: { posters, soffit, crest, lobby, crestLetters, booth }, palms, lamps, car, seed }
 * Returns { defs, body, geo }: geo holds the live parts in frame pixels.
 */
export function cinema(cam, o) {
  const px = o.px, W = o.w, H = o.h;
  const dawn = o.mode === "dawn";
  const lit = { posters: 1, soffit: 1, crest: 1, lobby: 1, crestLetters: null, booth: 1, ...(o.lit || {}) };
  const r = rng(o.seed ?? 7);
  const M = CIN.marquee, K = CIN.crest, E = CIN.entrance;
  let defs = "", sky = "", city = "", back = "", facade = "", ground = "", soffit = "", marquee = "", crest = "", front = "", floor = "", fg = "", bloom = "";
  const geo = { cases: [], rows: [], strips: [] };

  defs += `
  <radialGradient id="${px}bulb"><stop offset="0" stop-color="#fff1d6" stop-opacity=".95"/><stop offset=".3" stop-color="#ffd27a" stop-opacity=".45"/><stop offset="1" stop-color="#ff8a5c" stop-opacity="0"/></radialGradient>
  <linearGradient id="${px}sky" gradientUnits="userSpaceOnUse" x1="0" y1="${f(Math.min(0, cam.p(0, 30, -60)[1]))}" x2="0" y2="${f(cam.p(0, CIN.roof, 0)[1] + 30)}">${dawn
    ? `<stop offset="0" stop-color="#1a1250"/><stop offset=".28" stop-color="#3c3290"/><stop offset=".55" stop-color="#8a6cc4"/><stop offset=".75" stop-color="#e39bbd"/><stop offset=".9" stop-color="#ffbfa8"/><stop offset="1" stop-color="#ffdcb4"/>`
    : `<stop offset="0" stop-color="${C.night}"/><stop offset=".45" stop-color="#1e0c42"/><stop offset=".8" stop-color="#3a1660"/><stop offset="1" stop-color="#5a2470"/>`}</linearGradient>
  <linearGradient id="${px}stucco" x1="0" y1="0" x2="0" y2="1">${dawn
    ? `<stop offset="0" stop-color="#b58ac0"/><stop offset="1" stop-color="#7a4a8a"/>`
    : `<stop offset="0" stop-color="#6a3a7a"/><stop offset=".55" stop-color="#b56a92"/><stop offset="1" stop-color="#f0a0a8"/>`}</linearGradient>
  <linearGradient id="${px}wing" x1="0" y1="0" x2="0" y2="1">${dawn
    ? `<stop offset="0" stop-color="#9a76b0"/><stop offset="1" stop-color="#4a2a62"/>`
    : `<stop offset="0" stop-color="#4a2462"/><stop offset=".6" stop-color="#7a3a7a"/><stop offset="1" stop-color="#2a1442"/>`}</linearGradient>
  <linearGradient id="${px}vitro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dawn ? "#2a1442" : "#3a1a4a"}"/><stop offset=".25" stop-color="#1a0b2c"/><stop offset="1" stop-color="#12081f"/></linearGradient>
  <linearGradient id="${px}soffit" gradientUnits="userSpaceOnUse" x1="0" y1="${f(cam.p(0, M.y0, M.z)[1])}" x2="0" y2="${f(cam.p(0, M.y0, -E.depth)[1])}"><stop offset="0" stop-color="${lit.soffit > 0.3 ? "#fff0d6" : "#6a4a6a"}"/><stop offset=".5" stop-color="${lit.soffit > 0.3 ? "#ffc58a" : "#4a2a52"}"/><stop offset="1" stop-color="${lit.soffit > 0.3 ? "#e0806a" : "#2a1438"}"/></linearGradient>
  <linearGradient id="${px}board" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset=".5" stop-color="#fff6e6"/><stop offset="1" stop-color="#ffe9cc"/></linearGradient>
  <linearGradient id="${px}enamel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e1250"/><stop offset="1" stop-color="#160828"/></linearGradient>
  <linearGradient id="${px}chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6ea"/><stop offset=".45" stop-color="#c9b0d8"/><stop offset=".55" stop-color="#5a3a7a"/><stop offset="1" stop-color="#e8d0f0"/></linearGradient>
  <linearGradient id="${px}chromeV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a2a6a"/><stop offset=".35" stop-color="#fff6ea"/><stop offset=".6" stop-color="#b9a0c8"/><stop offset="1" stop-color="#3a2050"/></linearGradient>
  <linearGradient id="${px}cap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#12061f"/><stop offset=".55" stop-color="#3a1a5a"/><stop offset="1" stop-color="#7a4a9a"/></linearGradient>
  <linearGradient id="${px}capR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#12061f"/><stop offset=".55" stop-color="#3a1a5a"/><stop offset="1" stop-color="#7a4a9a"/></linearGradient>
  <linearGradient id="${px}lobby" x1="0" y1="0" x2="0" y2="1">${lit.lobby > 0.3 ? `<stop offset="0" stop-color="#ffe9c8"/><stop offset=".6" stop-color="#ffb07a"/><stop offset="1" stop-color="#d0607a"/>` : `<stop offset="0" stop-color="#2a1442"/><stop offset="1" stop-color="#160a28"/>`}</linearGradient>
  <linearGradient id="${px}vestL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${lit.lobby > 0.3 ? "#c86a8a" : "#3a1a4a"}"/><stop offset="1" stop-color="${lit.lobby > 0.3 ? "#6a2a5a" : "#1a0b2c"}"/></linearGradient>
  <linearGradient id="${px}vestR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${lit.lobby > 0.3 ? "#c86a8a" : "#3a1a4a"}"/><stop offset="1" stop-color="${lit.lobby > 0.3 ? "#6a2a5a" : "#1a0b2c"}"/></linearGradient>
  <linearGradient id="${px}booth" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a2a5a"/><stop offset=".3" stop-color="#ffd2c8"/><stop offset=".45" stop-color="#fff0e6"/><stop offset=".75" stop-color="#d88aa0"/><stop offset="1" stop-color="#4a1f4a"/></linearGradient>
  <linearGradient id="${px}floor" gradientUnits="userSpaceOnUse" x1="0" y1="${f(cam.p(0, 0, 0)[1])}" x2="0" y2="${H}"><stop offset="0" stop-color="${dawn ? "#6a4a7a" : "#8a4a6a"}"/><stop offset="1" stop-color="${dawn ? "#3a2452" : "#3a1a42"}"/></linearGradient>
  <radialGradient id="${px}pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd8a8" stop-opacity=".55"/><stop offset=".5" stop-color="#ff8a7a" stop-opacity=".18"/><stop offset="1" stop-color="#ff8a7a" stop-opacity="0"/></radialGradient>
  <radialGradient id="${px}caseGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1d6" stop-opacity=".55"/><stop offset=".6" stop-color="#ffd27a" stop-opacity=".12"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
  <radialGradient id="${px}hotGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9c8" stop-opacity=".85"/><stop offset=".45" stop-color="#ff8fd0" stop-opacity=".3"/><stop offset="1" stop-color="#ff2d95" stop-opacity="0"/></radialGradient>
  <linearGradient id="${px}refl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="${px}reflMask"><rect x="0" y="${f(cam.p(0, 0, 0)[1])}" width="${W}" height="${H}" fill="url(#${px}refl)"/></mask>`;

  /* --- sky, stars, city ------------------------------------------------ */
  sky += `<rect width="${W}" height="${H}" fill="url(#${px}sky)"/>`;
  const roofY = cam.p(0, CIN.roof, 0)[1];
  for (let i = 0; i < 140; i++) {
    const x = r() * W, y = r() * Math.max(10, roofY);
    const a = (dawn ? 0.35 : 0.85) * (0.25 + r() * 0.75) * (1 - y / (roofY + 40));
    sky += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.4 + r() * 0.8)}" fill="${C.cream}" opacity="${f(clamp(a))}"/>`;
  }
  if (dawn) sky += `<ellipse cx="${W * 0.72}" cy="${f(cam.cy + 10)}" rx="${W * 0.6}" ry="${f(H * 0.18)}" fill="#ffe1c0" opacity=".45" filter="url(#${px}b30)"/>`;
  else sky += `<ellipse cx="${W / 2}" cy="${f(roofY + 10)}" rx="${W * 0.7}" ry="${f(H * 0.12)}" fill="#ff6aa8" opacity=".22" filter="url(#${px}b30)"/>`;
  // the city beyond the roofs
  const towers = [];
  const cr = rng(41);
  for (let x = -40; x < W + 40;) {
    const w = 40 + cr() * 90 * (W / 1280);
    const far = cr();
    const top = roofY - (20 + cr() * 150) * (cam.F / 900) * (far < 0.3 ? 1.5 : 1) * (dawn ? 0.55 + far * 0.25 : 1);
    towers.push({ x, w, top, far });
    x += w * (0.55 + cr() * 0.5);
  }
  towers.sort((a, b) => b.far - a.far);
  // the towers reach down to the far kerb, so no sky shows past the cinema's wings
  const cityFoot = Math.max(roofY + 40, cam.p(0, 0, -0.7)[1]);
  for (const t of towers) {
    const col = dawn ? mix("#3a2a6e", "#b48ac4", 0.25 + t.far * 0.6) : mix("#170a30", "#2c1450", t.far);
    city += `<rect x="${f(t.x)}" y="${f(t.top)}" width="${f(t.w)}" height="${f(cityFoot - t.top)}" fill="${col}"/>`;
    if (cr() < 0.35) city += `<rect x="${f(t.x + t.w * 0.3)}" y="${f(t.top - 10)}" width="${f(t.w * 0.4)}" height="10" fill="${col}"/>`;
    const step = 7 * (cam.F / 900);
    for (let y = t.top + 6; y < cityFoot - 20; y += step) {
      for (let x = t.x + 4; x < t.x + t.w - 4; x += step * 0.9) {
        if (cr() < (dawn ? 0.93 : 0.7)) continue;
        city += `<rect x="${f(x)}" y="${f(y)}" width="${f(step * 0.42)}" height="${f(step * 0.5)}" fill="${cr() < 0.8 ? "#ffd9a0" : cr() < 0.5 ? C.pink : "#bfe9ff"}" opacity="${f((dawn ? 0.35 : 0.55) + cr() * 0.4)}"/>`;
      }
    }
  }
  // the landmark far off, its LED crown still lit (left out where it would float over the crest)
  if (o.landmark !== false) {
    const lx = W * 0.87, base = roofY + 10, s = cam.F / 900;
    const tiers = [[34, 0, 120], [26, 120, 150], [19, 150, 170], [12, 170, 184], [7, 184, 194]];
    let tw = "";
    for (const [hw, y0, y1] of tiers) tw += `<rect x="${f(lx - hw * s)}" y="${f(base - y1 * s)}" width="${f(2 * hw * s)}" height="${f((y1 - y0) * s)}" fill="${dawn ? "#5a4a8a" : "#241248"}"/>`;
    for (const [hw, , y1] of tiers.slice(1)) tw += `<rect x="${f(lx - hw * s)}" y="${f(base - y1 * s)}" width="${f(2 * hw * s)}" height="${f(1.6 * s)}" fill="#e6f8ff" opacity="${dawn ? 0.55 : 0.95}"/>`;
    tw += `<rect x="${f(lx - 0.8 * s)}" y="${f(base - 224 * s)}" width="${f(1.6 * s)}" height="${f(30 * s)}" fill="${dawn ? "#5a4a8a" : "#241248"}"/>`;
    tw += `<rect x="${f(lx - 9 * s)}" y="${f(base - 204 * s)}" width="${f(18 * s)}" height="${f(6 * s)}" rx="${f(3 * s)}" fill="${C.red}" opacity=".95"/>`;
    tw += `<circle cx="${f(lx)}" cy="${f(base - 160 * s)}" r="${f(40 * s)}" fill="#bfe9ff" opacity="${dawn ? 0.1 : 0.18}" filter="url(#${px}b16)"/>`;
    city = tw + city;
  }

  /* --- pylon and fins above the roof --------------------------------- */
  {
    const z = -0.4;
    const py = [[1.5, CIN.roof, 14.5], [1.05, 14.5, 16.2], [0.6, 16.2, 17.4]];
    for (const [hw, y0, y1] of py) {
      const rr = rect(cam, -hw, y0, hw, y1, z);
      back += R(rr, `fill="url(#${px}wing)"`);
      for (let i = 1; i < 6; i++) back += `<rect x="${f(rr.x + (rr.w * i) / 6 - 0.6)}" y="${f(rr.y)}" width="1.2" height="${f(rr.h)}" fill="#12061f" opacity=".35"/>`;
      for (let i = 1; i < 6; i++) back += `<rect x="${f(rr.x + (rr.w * i) / 6 + 0.6)}" y="${f(rr.y)}" width="${f(Math.max(0.6, rr.w / 30))}" height="${f(rr.h)}" fill="#ffe0f0" opacity="${dawn ? 0.16 : 0.08}"/>`;
      // the dawn catches the east edge; at night an uplight warms the base
      back += `<rect x="${f(rr.x + rr.w * 0.9)}" y="${f(rr.y)}" width="${f(rr.w * 0.1)}" height="${f(rr.h)}" fill="${dawn ? "#ffc8b0" : "#ff7ab0"}" opacity="${dawn ? 0.45 : 0.2}"/>`;
      const ledge = rect(cam, -hw - 0.12, y1 - 0.12, hw + 0.12, y1 + 0.04, z + 0.1);
      back += R(ledge, `fill="${dawn ? "#f6e0f0" : "#c9a0d8"}" opacity=".8"`);
    }
    if (!dawn) {
      const ul = rect(cam, -1.5, CIN.roof, 1.5, CIN.roof + 3.2, z + 0.02);
      defs += `<linearGradient id="${px}uplight" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7ab0" stop-opacity=".55"/><stop offset="1" stop-color="#ff7ab0" stop-opacity="0"/></linearGradient>`;
      back += R(ul, `fill="url(#${px}uplight)"`);
    }
    const sp = rect(cam, -0.07, 17.4, 0.07, 20.5, z);
    back += R(sp, `fill="#2a1442"`);
    const bc = cam.p(0, 20.6, z);
    back += `<circle cx="${f(bc[0])}" cy="${f(bc[1])}" r="${f(cam.s(0.5, z))}" fill="${C.red}" opacity=".35" filter="url(#${px}b4)"/><circle cx="${f(bc[0])}" cy="${f(bc[1])}" r="${f(cam.s(0.13, z))}" fill="#ff8a9a"/>`;
    // cyan neon on the pylon's edges
    for (const sx of [-1, 1]) {
      const a = cam.p(sx * 1.45, CIN.roof, z + 0.05), b = cam.p(sx * 1.45, 14.4, z + 0.05);
      back += `<path d="M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}" stroke="${C.cyan}" stroke-width="${f(Math.max(1, cam.s(0.06, z)))}" filter="url(#${px}glowS)" opacity="${dawn ? 0.35 : 0.9}"/>`;
    }
    // fins
    for (const sx of [-1, 1]) {
      const fr = rect(cam, sx * 3.3 - 0.22, CIN.roof - 0.5, sx * 3.3 + 0.22, 11.6, z + 0.2);
      back += R(fr, `fill="url(#${px}wing)"`);
      const a = cam.p(sx * 3.3, CIN.roof, z + 0.45), b = cam.p(sx * 3.3, 11.5, z + 0.45);
      back += `<path d="M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}" stroke="${C.pink}" stroke-width="${f(Math.max(1, cam.s(0.05, z)))}" filter="url(#${px}glowS)" opacity="${dawn ? 0.3 : 0.85}"/>`;
    }
  }

  /* --- upper facade ------------------------------------------------- */
  {
    // wings, then the central block
    for (const sx of [-1, 1]) {
      const wr = rect(cam, sx > 0 ? CIN.block : -CIN.half, 0, sx > 0 ? CIN.half : -CIN.block, CIN.wingRoof, -0.6);
      facade += R(wr, `fill="url(#${px}wing)"`);
      // portholes and speed lines on the wings
      for (let k = 0; k < 3; k++) {
        const y = 6.3 + k * 0.32;
        const a = cam.p(sx > 0 ? CIN.block : -CIN.half, y, -0.55), b = cam.p(sx > 0 ? CIN.half : -CIN.block, y, -0.55);
        facade += `<path d="M${f(a[0])},${f(a[1])} H${f(b[0])}" stroke="${C.pink}" stroke-width="${f(Math.max(0.8, cam.s(0.04, -0.6)))}" opacity="${dawn ? 0.25 : 0.7}" filter="url(#${px}glowS)"/>`;
      }
      for (let k = 0; k < 4; k++) {
        const x = sx * (CIN.block + 2.8 + k * 2.1);
        const c = cam.p(x, 4.9, -0.55);
        facade += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(cam.s(0.42, -0.6))}" fill="${dawn ? "#c8a0d0" : "#2a1442"}" fill-opacity="${dawn ? 0.3 : 1}" stroke="#f4dce8" stroke-opacity="${dawn ? 0.3 : 0.6}" stroke-width="${f(cam.s(0.06, -0.6))}"/>`;
        if (!dawn && k % 2 === 0) facade += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(cam.s(0.36, -0.6))}" fill="#ffc890" opacity=".7"/>`;
      }
      const cp = rect(cam, sx > 0 ? CIN.block : -CIN.half, CIN.wingRoof, sx > 0 ? CIN.half : -CIN.block, CIN.wingRoof + 0.18, -0.6);
      facade += R(cp, `fill="#f4dce8" opacity="${dawn ? 0.8 : 0.55}"`);
    }
    const br = rect(cam, -CIN.block, 0, CIN.block, CIN.roof, 0);
    facade += R(br, `fill="url(#${px}stucco)"`);
    // eyebrow ledge and the three speed lines under the coping
    for (let k = 0; k < 3; k++) {
      const y = 7.25 + k * 0.26;
      const a = cam.p(-CIN.block, y, 0.05), b = cam.p(CIN.block, y, 0.05);
      facade += `<path d="M${f(a[0])},${f(a[1])} H${f(b[0])}" stroke="${dawn ? "#c8a0d8" : C.magenta}" stroke-width="${f(Math.max(1, cam.s(0.05, 0)))}" opacity="${dawn ? 0.5 : 0.95}" ${dawn ? "" : `filter="url(#${px}glowS)"`}/>`;
    }
    const cop = rect(cam, -CIN.block - 0.1, CIN.roof - 0.16, CIN.block + 0.1, CIN.roof + 0.06, 0.08);
    facade += R(cop, `fill="${dawn ? "#f6e4f0" : "#f4c8d8"}"`);
    // the corner radius: a shaded strip at each end of the block
    for (const sx of [-1, 1]) {
      const cr2 = rect(cam, sx > 0 ? CIN.block - 0.7 : -CIN.block, CIN.ground, sx > 0 ? CIN.block : -CIN.block + 0.7, CIN.roof, 0);
      facade += R(cr2, `fill="url(#${px}${sx > 0 ? "capR" : "cap"})" opacity=".55"`);
    }
  }

  /* --- ground floor: vitrolite wall, entrance, booth, cases ----------- */
  {
    const gw = rect(cam, -CIN.block, 0, CIN.block, CIN.ground, 0);
    ground += R(gw, `fill="url(#${px}vitro)"`);
    // vitrolite joints and chrome strips
    for (let x = -CIN.block; x <= CIN.block + 0.01; x += 1.075) {
      if (Math.abs(x) < E.half) continue;
      const a = cam.p(x, 0, 0), b = cam.p(x, CIN.ground, 0);
      ground += `<path d="M${f(a[0])},${f(a[1])} V${f(b[1])}" stroke="#ffffff" stroke-opacity=".06" stroke-width="1"/>`;
    }
    for (const y of [0.34, 3.45]) {
      const sr = rect(cam, -CIN.block, y, CIN.block, y + 0.07, 0.02);
      ground += R(sr, `fill="url(#${px}chrome)" opacity=".8"`);
    }
    // soft warm spill from the soffit down the wall
    const sp = rect(cam, -CIN.block, 2.2, CIN.block, CIN.ground, 0.01);
    ground += R(sp, `fill="#ffb07a" opacity="${f(0.16 * lit.soffit)}"`);

    // entrance recess: back wall with doors, side walls, ceiling, floor
    const zb = -E.depth;
    const bw = rect(cam, -E.half, 0, E.half, CIN.ground, zb);
    ground += R(bw, `fill="#1a0b2c"`);
    // transom grille, glowing
    const tg = rect(cam, -E.half + 0.15, 2.65, E.half - 0.15, CIN.ground - 0.12, zb);
    ground += R(tg, `fill="url(#${px}lobby)" opacity="${f(0.35 + 0.6 * lit.lobby)}"`);
    for (let i = -8; i <= 8; i++) {
      const a = cam.p(0, 2.62, zb), b = cam.p(i * 0.36, CIN.ground - 0.12, zb);
      ground += `<path d="M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}" stroke="#2a1442" stroke-width="${f(cam.s(0.035, zb))}"/>`;
    }
    // four doors
    for (let i = 0; i < 4; i++) {
      const x0 = -2.7 + i * 1.375, x1 = x0 + 1.25;
      const dr = rect(cam, x0, 0.02, x1, 2.5, zb);
      ground += R(dr, `fill="url(#${px}chromeV)"`);
      const gl = rect(cam, x0 + 0.08, 0.12, x1 - 0.08, 2.42, zb);
      ground += R(gl, `fill="url(#${px}lobby)" opacity="${f(0.25 + 0.75 * lit.lobby)}"`);
      const pc = cam.p((x0 + x1) / 2, 1.75, zb);
      ground += `<circle cx="${f(pc[0])}" cy="${f(pc[1])}" r="${f(cam.s(0.3, zb))}" fill="none" stroke="#fff6ea" stroke-opacity=".75" stroke-width="${f(cam.s(0.06, zb))}"/>`;
      const bar = rect(cam, x0 + 0.15, 1.02, x1 - 0.15, 1.1, zb);
      ground += R(bar, `fill="#fff6ea" opacity=".85"`);
    }
    // lobby silhouettes through the glass: the candy counter and a lamp
    // side walls
    for (const sx of [-1, 1]) {
      const x = sx * E.half;
      ground += poly([cam.p(x, 0, 0), cam.p(x, CIN.ground, 0), cam.p(x, CIN.ground, zb), cam.p(x, 0, zb)], `fill="url(#${px}${sx < 0 ? "vestL" : "vestR"})"`);
      // a frame of light on each side wall: the coming-attraction slot
      const q = [cam.p(x, 0.7, -0.5), cam.p(x, 2.5, -0.5), cam.p(x, 2.5, -2.0), cam.p(x, 0.7, -2.0)];
      ground += poly(q, `fill="${lit.lobby > 0.3 ? "#ffd8b8" : "#3a2050"}" opacity=".22"`);
    }
    // vestibule floor (terrazzo, warm)
    ground += poly([cam.p(-E.half, 0, 0), cam.p(E.half, 0, 0), cam.p(E.half, 0, zb), cam.p(-E.half, 0, zb)], `fill="${lit.lobby > 0.3 ? "#c87a8a" : "#3a2048"}"`);

    // the box office
    {
      const B = CIN.booth, z = B.z;
      const body = rect(cam, -B.half, 0, B.half, 2.3, z);
      const dome = cam.p(0, 2.3, z);
      const rx = cam.s(B.half, z), ry = cam.s(0.42, z);
      ground += `<ellipse cx="${f(dome[0])}" cy="${f(dome[1])}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${px}booth)"/>`;
      ground += R(body, `fill="url(#${px}booth)"`);
      for (const y of [0.25, 0.45, 2.15]) {
        const s2 = rect(cam, -B.half, y, B.half, y + 0.05, z + 0.01);
        ground += R(s2, `fill="#7a3a6a" opacity=".6"`);
      }
      const win = rect(cam, -0.55, 1.0, 0.55, 1.95, z + 0.02);
      ground += `<path d="M${f(win.x)},${f(win.y + win.h)} V${f(win.y + win.w / 2)} A${f(win.w / 2)},${f(win.w / 2)} 0 0 1 ${f(win.x + win.w)},${f(win.y + win.w / 2)} V${f(win.y + win.h)} Z" fill="${lit.booth > 0.3 ? "#ffe2b8" : "#2a1442"}" stroke="#fff6ea" stroke-width="${f(cam.s(0.04, z))}"/>`;
      if (lit.booth > 0.3) {
        const lamp = cam.p(0.28, 1.62, z - 0.2);
        ground += `<circle cx="${f(lamp[0])}" cy="${f(lamp[1])}" r="${f(cam.s(0.3, z))}" fill="#fff4e0" opacity=".8" filter="url(#${px}b4)"/>`;
        const roll = rect(cam, -0.36, 1.0, -0.1, 1.22, z - 0.1);
        ground += R(roll, `rx="${f(roll.w * 0.3)}" fill="#ff5a9a" opacity=".85"`);
        const tk = rect(cam, -0.1, 1.0, 0.3, 1.06, z - 0.05);
        ground += R(tk, `fill="#fff0f6"`);
      }
      const ledge = rect(cam, -0.65, 0.92, 0.65, 1.0, z + 0.06);
      ground += R(ledge, `fill="#f0c36a"`);
      const g2 = cam.p(0, 2.12, z + 0.02);
      ground += `<circle cx="${f(g2[0])}" cy="${f(g2[1])}" r="${f(cam.s(0.09, z))}" fill="#7a3a6a" stroke="#fff6ea" stroke-width="${f(cam.s(0.02, z))}"/>`;
      // neon on the dome: TICKETS / TAQUILLA
      const t = CINEMA_TEXT.booth[o.lang];
      const tc = cam.p(0, 2.86, z + 0.2);
      ground += `<text x="${f(tc[0])}" y="${f(tc[1])}" text-anchor="middle" font-family="Limelight" font-size="${f(cam.s(0.3, z))}" fill="${lit.booth > 0.3 ? "#bff6ff" : "#4a5a7a"}" stroke="${lit.booth > 0.3 ? C.cyan : "none"}" stroke-width="${f(cam.s(0.012, z))}" ${lit.booth > 0.3 ? `filter="url(#${px}glow)"` : ""} letter-spacing="${f(cam.s(0.025, z))}">${t}</text>`;
    }

    // poster cases: at night only their light (the cases themselves are DOM); at dawn dark, the posters in
    if (o.cases !== "none") CIN.cases.forEach((x, i) => {
      const repo = BILL[i];
      const z = 0.06;
      const on = lit.posters;
      const fr = rect(cam, x - CIN.caseW / 2, CIN.caseY, x + CIN.caseW / 2, CIN.caseY + CIN.caseH, z);
      const pr = rect(cam, x - CIN.posterW / 2, CIN.caseY + (CIN.caseH - CIN.posterH) / 2, x + CIN.posterW / 2, CIN.caseY + (CIN.caseH + CIN.posterH) / 2, z + 0.02);
      const pl = rect(cam, x - 0.5, 0.42, x + 0.5, 0.58, z);
      const pool = cam.p(x, 0, 0.9);
      geo.cases.push({
        repo,
        frame: box(fr.x, fr.y, fr.w, fr.h),
        poster: box(pr.x, pr.y, pr.w, pr.h),
        plate: box(pl.x, pl.y, pl.w, pl.h),
        pool: box(pool[0] - cam.s(1.2, 0.9), pool[1] - cam.s(0.45, 0.9), cam.s(2.4, 0.9), cam.s(0.9, 0.9)),
      });
      if (on > 0.1) ground += `<ellipse cx="${f(fr.x + fr.w / 2)}" cy="${f(fr.y + fr.h / 2)}" rx="${f(fr.w * 0.95)}" ry="${f(fr.h * 0.75)}" fill="url(#${px}caseGlow)" opacity="${f(on * 0.7)}"/>`;
      if (o.cases === "baked") {
        ground += R(fr, `rx="${f(fr.w * 0.05)}" fill="url(#${px}chromeV)"`);
        const inner = { x: fr.x + fr.w * 0.06, y: fr.y + fr.h * 0.04, w: fr.w * 0.88, h: fr.h * 0.92 };
        ground += R(inner, `fill="#12061f"`);
        const sym = posterSymbol(repo, o.lang);
        defs += sym.svg;
        ground += `<use href="#${sym.id}" x="${f(pr.x)}" y="${f(pr.y)}" width="${f(pr.w)}" height="${f(pr.h)}"/>`;
        if (on < 0.5) ground += R(pr, `fill="#0b0619" opacity="${f(0.72 - on)}"`);
        ground += `<path d="M${f(pr.x)},${f(pr.y)} h${f(pr.w * 0.42)} l${f(-pr.w * 0.3)},${f(pr.h)} h${f(-pr.w * 0.12)} Z" fill="#fff" opacity=".08"/>`;
        // the bulbs around the frame, out
        const bx0 = x - CIN.caseW / 2 + 0.06, bx1 = x + CIN.caseW / 2 - 0.06, by0 = CIN.caseY + 0.05, by1 = CIN.caseY + CIN.caseH - 0.05;
        const pts = [];
        const nx = 8, ny = 11;
        for (let k = 0; k < nx; k++) pts.push([lerp(bx0, bx1, k / (nx - 1)), by1]);
        for (let k = 1; k < ny - 1; k++) pts.push([bx1, lerp(by1, by0, k / (ny - 1))]);
        for (let k = nx - 1; k >= 0; k--) pts.push([lerp(bx0, bx1, k / (nx - 1)), by0]);
        for (let k = ny - 2; k > 0; k--) pts.push([bx0, lerp(by1, by0, k / (ny - 1))]);
        for (const [bx, by] of pts) {
          const c = cam.p(bx, by, z + 0.05);
          ground += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(Math.max(0.7, cam.s(0.032, z)))}" fill="#4a3a5a" opacity=".9"/>`;
        }
      }
      // brass plate: the repo name
      ground += R(pl, `rx="${f(pl.h * 0.2)}" fill="#e8b860"`);
      ground += `<text x="${f(pl.x + pl.w / 2)}" y="${f(pl.y + pl.h * 0.72)}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="${f(pl.h * 0.62)}" fill="#2b1848" textLength="${f(Math.min(pl.w * 0.88, repo.length * pl.h * 0.4))}" lengthAdjust="spacingAndGlyphs">${esc(repo)}</text>`;
    });
  }

  /* --- soffit under the marquee (and on into the vestibule) ---------- */
  {
    const y = M.y0;
    soffit += poly([cam.p(M.x0, y, M.z), cam.p(M.x1, y, M.z), cam.p(M.x1, y, 0), cam.p(E.half, y, 0), cam.p(E.half, y, -E.depth), cam.p(-E.half, y, -E.depth), cam.p(-E.half, y, 0), cam.p(M.x0, y, 0)], `fill="url(#${px}soffit)"`);
    // chrome ribs running back to the wall
    for (let x = M.x0 + 0.6; x < M.x1; x += 1.2) {
      const a = cam.p(x, y, M.z), b = cam.p(x, y, Math.abs(x) < E.half ? -E.depth : 0);
      soffit += `<path d="M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}" stroke="#a86a7a" stroke-opacity=".55" stroke-width="${f(Math.max(0.6, cam.s(0.03, 1.5)))}"/>`;
    }
    const sr = rng(5);
    for (let zz = M.z - 0.3; zz > -E.depth; zz -= 0.46) {
      for (let x = M.x0 + 0.3; x < M.x1 - 0.2; x += 0.6) {
        if (zz < 0 && Math.abs(x) > E.half - 0.2) continue;
        const c = cam.p(x, y, zz);
        const rad = Math.max(0.6, cam.s(0.045, zz));
        const on = sr() < lit.soffit;
        if (on) soffit += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(rad * 3.6)}" fill="url(#${px}bulb)" opacity=".9"/>`;
        soffit += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(rad)}" fill="${on ? "#fffdf4" : "#7a5a6a"}"/>`;
      }
    }
    // the marquee's light on the pavement
    if (lit.soffit > 0.2) {
      const c = cam.p(0, 0, 1.8);
      floor += `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(cam.s(8, 1.8))}" ry="${f(cam.s(1.6, 1.8))}" fill="url(#${px}pool)" opacity="${f(lit.soffit)}"/>`;
    }
  }

  /* --- the marquee face --------------------------------------------- */
  {
    const w = M.x1 - M.x0, h = M.y1 - M.y0;
    const T = cam.front(M.x0, M.y1, M.z);
    let g = "";
    g += `<rect x="-.02" y="-.02" width="${f(w + 0.04)}" height="${f(h + 0.04)}" rx=".08" fill="url(#${px}enamel)"/>`;
    g += `<rect x="0" y="0" width="${w}" height=".09" fill="url(#${px}chrome)"/>`;
    g += `<rect x="0" y="${f(h - 0.09)}" width="${w}" height=".09" fill="url(#${px}chrome)"/>`;
    // bulb strips top and bottom: DOM (they chase); the plate keeps a dark socket rail
    const nb = 46;
    for (const sy of [0.2, h - 0.2]) {
      const a = cam.p(M.x0 + 0.32, M.y1 - sy, M.z), b = cam.p(M.x1 - 0.32, M.y1 - sy, M.z);
      geo.strips.push({ x0: f(a[0]), x1: f(b[0]), y: f(a[1]), n: nb, r: f(cam.s(0.045, M.z)) });
      g += `<rect x=".26" y="${f(sy - 0.07)}" width="${f(w - 0.52)}" height=".14" rx=".07" fill="#0b0619" opacity=".55"/>`;
    }
    // the lit board and its rails
    const bx = 0.34, by = 0.34, bw = w - 0.68, bh = h - 0.68;
    g += `<rect x="${bx}" y="${by}" width="${f(bw)}" height="${f(bh)}" fill="url(#${px}board)"/>`;
    g += `<rect x="${bx}" y="${by}" width="${f(bw)}" height="${f(bh)}" fill="none" stroke="#c9b0d8" stroke-width=".03"/><!--rails-->`;
    {
      const a = cam.p(M.x0 + bx, M.y1 - by, M.z), b = cam.p(M.x0 + bx + bw, M.y1 - by - bh, M.z);
      geo.board = box(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    }
    // one row of letters between each pair of rails, as tall as its letters ask
    const tot = o.rows.reduce((acc, cap) => acc + cap + 0.26, 0);
    let yy = by;
    const rails = [by];
    o.rows.forEach((cap) => {
      const rh = ((cap + 0.26) / tot) * bh;
      const top = cam.p(0, M.y1 - yy, M.z)[1], bottom = cam.p(0, M.y1 - yy - rh, M.z)[1], base = cam.p(0, M.y1 - (yy + rh - 0.13), M.z)[1];
      geo.rows.push({ top: f(top), bottom: f(bottom), base: f(base), cap: f(cam.s(cap, M.z)) });
      yy += rh;
      rails.push(yy);
    });
    const railSvg = rails.map((ry) => `<rect x="${bx}" y="${f(ry - 0.012)}" width="${f(bw)}" height=".024" fill="#a898b8" opacity=".55"/>`).join("");
    // panel seams
    let seams = "";
    for (let k = 1; k < 6; k++) seams += `<path d="M${f(bx + (bw * k) / 6)},${by} V${f(by + bh)}" stroke="#e8dcd0" stroke-width=".015"/>`;
    g = g.replace("<!--rails-->", railSvg + seams);
    // streamline end caps
    g += `<rect x="-.02" y="-.02" width=".3" height="${f(h + 0.04)}" rx=".08" fill="url(#${px}cap)"/>`;
    g += `<rect x="${f(w - 0.28)}" y="-.02" width=".3" height="${f(h + 0.04)}" rx=".08" fill="url(#${px}capR)"/>`;
    // neon underline
    g += `<rect x=".2" y="${f(h + 0.02)}" width="${f(w - 0.4)}" height=".035" fill="${C.magenta}" filter="url(#${px}glowS)"/>`;
    defs += `<clipPath id="${px}mq"><rect x="-.02" y="-.02" width="${f(w + 0.04)}" height="${f(h + 0.04)}" rx=".08"/></clipPath>`;
    marquee += `<g transform="${T}"><g clip-path="url(#${px}mq)">${g}</g></g>`;
    // bloom of the board
    bloom += `<g transform="${T}" opacity=".55" filter="url(#${px}b16)"><rect x="${bx}" y="${by}" width="${f(bw)}" height="${f(bh)}" fill="#ffe6c8"/></g>`;
  }

  /* --- the crest: AFTERGLOW in neon over a sunburst ------------------- */
  {
    const z = K.z;
    const hw = K.half;
    const T = cam.front(-hw, K.y1, z);
    const w = hw * 2, h = K.y1 - K.y0;
    const on = lit.crest;
    let g = "";
    // sunburst fan behind
    const fx = w / 2, fy = h + 0.1;
    for (let k = 0; k < 15; k++) {
      const a = Math.PI + (k / 14) * Math.PI;
      const L = 2.0 + (k % 2) * 0.5;
      g += `<path d="M${f(fx)},${f(fy)} L${f(fx + Math.cos(a) * L)},${f(fy + Math.sin(a) * L * 0.62)}" stroke="${on > 0.3 ? (k % 2 ? C.sodium : "#ffb0d8") : "#5a4a6a"}" stroke-width=".05" opacity="${on > 0.3 ? 0.9 : 0.6}" ${on > 0.3 ? `filter="url(#${px}glowS)"` : ""}/>`;
    }
    // stepped tablet
    g += `<path d="M0,${f(h)} V.62 H.5 V.32 H${f(w / 2 - 1.3)} V0 H${f(w / 2 + 1.3)} V.32 H${f(w - 0.5)} V.62 H${w} V${f(h)} Z" fill="url(#${px}enamel)" stroke="url(#${px}chrome)" stroke-width=".06"/>`;
    // the name, in neon tubes
    const name = "AFTERGLOW";
    const letters = [...name];
    const lw = 0.7;
    letters.forEach((ch, i) => {
      const lx = w / 2 + (i - (letters.length - 1) / 2) * lw;
      const onL = lit.crestLetters ? lit.crestLetters[i] : on;
      const col = onL > 0.5 ? "#ff7ac0" : "#4a2a5a";
      if (onL > 0.5) g += `<text x="${f(lx)}" y="${f(h - 0.36)}" text-anchor="middle" font-family="Limelight" font-size=".86" fill="none" stroke="${C.magenta}" stroke-width=".14" opacity=".55" filter="url(#${px}b4)">${ch}</text>`;
      g += `<text x="${f(lx)}" y="${f(h - 0.36)}" text-anchor="middle" font-family="Limelight" font-size=".86" fill="${onL > 0.5 ? "#3a0a2a" : "#1a0b2c"}" stroke="${col}" stroke-width=".05">${ch}</text>`;
      if (onL > 0.5) g += `<text x="${f(lx)}" y="${f(h - 0.36)}" text-anchor="middle" font-family="Limelight" font-size=".86" fill="none" stroke="#fff0f8" stroke-width=".018">${ch}</text>`;
    });
    const sub = CINEMA_TEXT.cinema[o.lang];
    g += `<text x="${f(w / 2)}" y="${f(h - 0.1)}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size=".15" letter-spacing=".24" fill="${on > 0.3 ? C.cyan : "#4a5a7a"}" ${on > 0.3 ? `filter="url(#${px}glowS)"` : ""}>${sub}</text>`;
    crest += `<g transform="${T}">${g}</g>`;
  }

  /* --- air: warm haze under the marquee, pink wash above it ----------- */
  if (lit.soffit > 0.3) {
    const a = cam.p(M.x0, M.y0, M.z), b = cam.p(M.x1, M.y0, M.z), c = cam.p(M.x1 + 1.5, 0, M.z), d = cam.p(M.x0 - 1.5, 0, M.z);
    defs += `<linearGradient id="${px}haze" gradientUnits="userSpaceOnUse" x1="0" y1="${f(a[1])}" x2="0" y2="${f(c[1])}"><stop offset="0" stop-color="#ffd8a8" stop-opacity=".22"/><stop offset="1" stop-color="#ff8fd0" stop-opacity="0"/></linearGradient>`;
    bloom += poly([a, b, c, d], `fill="url(#${px}haze)"`);
  }
  if (!dawn) {
    const t = cam.p(0, M.y1 + 0.4, M.z);
    bloom += `<ellipse cx="${f(t[0])}" cy="${f(t[1])}" rx="${f(cam.s(9, M.z))}" ry="${f(cam.s(1.6, M.z))}" fill="#ff7ab0" opacity=".16" filter="url(#${px}b30)"/>`;
  }

  /* --- velvet ropes ---------------------------------------------------- */
  {
    const z = 1.1;
    const posts = [-2.5, -1.35, 1.35, 2.5];
    for (const [a, b] of [[-2.5, -1.35], [1.35, 2.5]]) {
      const p0 = cam.p(a, 0.86, z), p1 = cam.p(b, 0.86, z), m = cam.p((a + b) / 2, 0.6, z);
      front += `<path d="M${f(p0[0])},${f(p0[1])} Q${f(m[0])},${f(m[1] + (m[1] - p0[1]) * 0.6)} ${f(p1[0])},${f(p1[1])}" fill="none" stroke="#c0105a" stroke-width="${f(cam.s(0.07, z))}" stroke-linecap="round"/>`;
      front += `<path d="M${f(p0[0])},${f(p0[1] - cam.s(0.02, z))} Q${f(m[0])},${f(m[1] + (m[1] - p0[1]) * 0.6 - cam.s(0.02, z))} ${f(p1[0])},${f(p1[1] - cam.s(0.02, z))}" fill="none" stroke="#ff7ab0" stroke-opacity=".6" stroke-width="${f(cam.s(0.02, z))}"/>`;
    }
    for (const x of posts) {
      const pr = rect(cam, x - 0.04, 0.0, x + 0.04, 0.92, z);
      front += R(pr, `fill="url(#${px}chromeV)"`);
      const top = cam.p(x, 0.94, z), base = cam.p(x, 0.02, z);
      front += `<circle cx="${f(top[0])}" cy="${f(top[1])}" r="${f(cam.s(0.07, z))}" fill="#f0c36a"/>`;
      front += `<ellipse cx="${f(base[0])}" cy="${f(base[1])}" rx="${f(cam.s(0.2, z))}" ry="${f(cam.s(0.05, z))}" fill="#f0c36a"/>`;
    }
  }

  /* --- the pavement: terrazzo with a brass sunburst, wet ------------- */
  {
    const zf = Math.min(9, cam.z - 0.6);
    const zs = Math.min(40, cam.z - 0.6);
    floor = poly([cam.p(-30, 0, 0), cam.p(30, 0, 0), cam.p(30, 0, zf), cam.p(-30, 0, zf)], `fill="url(#${px}floor)"`) + floor;
    let inlay = "";
    for (let k = -9; k <= 9; k++) {
      const a = cam.p(0, 0, 0.02), b = cam.p(k * 1.6, 0, 6.5);
      inlay += `<path d="M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}" stroke="#f0c36a" stroke-opacity="${dawn ? 0.25 : 0.4}" stroke-width="${f(Math.max(0.6, cam.s(0.02, 3)))}"/>`;
    }
    for (const zz of [0.5, 4.6]) {
      const a = cam.p(-30, 0, zz), b = cam.p(30, 0, zz);
      inlay += `<path d="M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}" stroke="#f0c36a" stroke-opacity="${dawn ? 0.3 : 0.45}" stroke-width="${f(Math.max(0.6, cam.s(0.025, zz)))}"/>`;
    }
    const c0 = cam.p(0, 0, 0.02);
    inlay += `<ellipse cx="${f(c0[0])}" cy="${f(c0[1])}" rx="${f(cam.s(1.0, 0))}" ry="${f(cam.s(0.12, 0))}" fill="#f0c36a" opacity=".35"/>`;
    // curb and street, for the far cameras
    if (zs > 5.6) {
    const cb = [cam.p(-30, 0, 5.6), cam.p(30, 0, 5.6), cam.p(30, -0.15, 5.6), cam.p(-30, -0.15, 5.6)];
    inlay += poly(cb, `fill="#d8b8c8" opacity=".55"`);
    inlay += poly([cam.p(-30, -0.15, 5.6), cam.p(30, -0.15, 5.6), cam.p(30, -0.15, zs), cam.p(-30, -0.15, zs)], `fill="${dawn ? "#3a2a5a" : "#24123a"}"`);
    if (zs > 12.5) for (let x = -30; x < 30; x += 3.2) {
      const a = cam.p(x, -0.14, 12), b = cam.p(x + 1.8, -0.14, 12), c2 = cam.p(x + 1.8, -0.14, 12.15), d2 = cam.p(x, -0.14, 12.15);
      inlay += poly([a, b, c2, d2], `fill="${C.sodium}" opacity="${dawn ? 0.55 : 0.75}"`);
    }
    }
    floor += inlay;
    // the case light pools on the pavement
    if (lit.posters > 0.1 && o.cases !== "none") CIN.cases.forEach((x) => {
      const c = cam.p(x, 0, 0.9);
      floor += `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(cam.s(1.2, 0.9))}" ry="${f(cam.s(0.45, 0.9))}" fill="url(#${px}pool)" opacity=".55"/>`;
    });
  }

  /* --- street lamps at the curb ---------------------------------------- */
  let street = "";
  if (o.lamps) for (const lp of o.lamps) {
    const z = lp.z;
    const pole = rect(cam, lp.x - 0.07, -0.15, lp.x + 0.07, 5.2, z);
    street += R(pole, `fill="${dawn ? "#2a1a48" : "#1e0e36"}"`);
    const arm = cam.p(lp.x, 5.2, z), head = cam.p(lp.x + lp.dir * 0.9, 5.05, z);
    street += `<path d="M${f(arm[0])},${f(arm[1])} Q${f((arm[0] + head[0]) / 2)},${f(arm[1] - cam.s(0.3, z))} ${f(head[0])},${f(head[1])}" fill="none" stroke="${dawn ? "#2a1a48" : "#1e0e36"}" stroke-width="${f(cam.s(0.1, z))}"/>`;
    street += `<ellipse cx="${f(head[0])}" cy="${f(head[1] + cam.s(0.08, z))}" rx="${f(cam.s(0.32, z))}" ry="${f(cam.s(0.1, z))}" fill="${lp.on ? "#fff1d6" : "#5a4a6a"}"/>`;
    if (lp.on) street += `<circle cx="${f(head[0])}" cy="${f(head[1] + cam.s(0.2, z))}" r="${f(cam.s(1.4, z))}" fill="url(#${px}bulb)" opacity=".7"/>`;
  }

  /* --- the hero's convertible, parked at the curb (side profile) ------- */
  let car = "";
  if (o.car) {
    const { x0, z, flip = false } = o.car;
    const T = cam.front(x0, 1.25, z);
    const paint = "#173b9e";
    let g = "";
    const body = "M.1,1.06 L.04,.86 Q.08,.69 .5,.64 L1.55,.6 L1.95,.58 L3.2,.6 Q3.9,.6 4.32,.66 Q4.6,.7 4.62,.86 L4.56,1.06 L4.1,1.09 A.42,.42 0 0 0 3.28,1.09 L1.27,1.11 A.42,.42 0 0 0 .43,1.09 Z";
    defs += `<linearGradient id="${px}paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dawn ? "#ffc8d8" : "#ff9ad0"}"/><stop offset=".12" stop-color="#6a5ac8"/><stop offset=".45" stop-color="${paint}"/><stop offset="1" stop-color="#0c1240"/></linearGradient>`;
    g += `<path d="${body}" fill="url(#${px}paint)"/>`;
    // rim light along the beltline and the hood, chrome bumpers
    g += `<path d="M.5,.645 L1.55,.605 L1.95,.585 L3.2,.605 Q3.9,.605 4.32,.665" fill="none" stroke="${dawn ? "#ffd8c8" : "#ffb0d8"}" stroke-width=".025" opacity=".9"/>`;
    g += `<rect x=".02" y=".9" width=".2" height=".07" rx=".03" fill="#e8e0f8"/><rect x="4.44" y=".9" width=".2" height=".07" rx=".03" fill="#e8e0f8"/>`;
    g += `<path d="M.5,.79 L4.35,.79" stroke="#e8e0f8" stroke-width=".025" opacity=".85"/>`;
    g += `<path d="M1.95,.62 V1.08 M3.12,.62 V1.08" stroke="#0c1240" stroke-width=".015" opacity=".7"/>`;
    g += `<path d="M2.85,.84 h.18" stroke="#e8e0f8" stroke-width=".03" stroke-linecap="round"/>`;
    // windshield frame and glass, raked back
    g += `<path d="M1.92,.58 L2.24,.1 L2.34,.1 L2.06,.58 Z" fill="#c9c0e0"/>`;
    g += `<path d="M2.06,.58 L2.34,.1 L2.4,.12 L2.18,.58 Z" fill="${dawn ? "#ffe0ec" : "#ff9ad0"}" opacity=".35"/>`;
    // seat backs and headrests
    g += `<path d="M2.62,.6 Q2.6,.36 2.78,.34 Q2.92,.36 2.9,.6 Z" fill="#d8b4b8"/><path d="M3.25,.6 Q3.23,.38 3.4,.36 Q3.54,.38 3.52,.6 Z" fill="#d8b4b8"/>`;
    g += `<path d="M2.66,.58 Q2.65,.4 2.78,.38" fill="none" stroke="#fff4f1" stroke-width=".02" opacity=".7"/><path d="M3.29,.58 Q3.28,.42 3.4,.4" fill="none" stroke="#fff4f1" stroke-width=".02" opacity=".7"/>`;
    // lamps
    g += `<rect x="4.5" y=".72" width=".11" height=".1" rx=".02" fill="#ff3b5c"/><circle cx="4.56" cy=".77" r=".3" fill="#ff3b5c" opacity=".35" filter="url(#${px}b4)"/>`;
    g += `<ellipse cx=".1" cy=".76" rx=".05" ry=".07" fill="#e8e0f8" opacity=".8"/>`;
    // wheels
    for (const wx of [0.85, 3.69]) {
      g += `<circle cx="${wx}" cy="1.07" r=".34" fill="#120a1e"/><circle cx="${wx}" cy="1.07" r=".2" fill="#c9c0e0"/><circle cx="${wx}" cy="1.07" r=".09" fill="#6a5a8a"/>`;
      g += `<path d="M${wx - 0.14},1.0 a.16,.16 0 0 1 .2,-.08" fill="none" stroke="#fff" stroke-width=".02" opacity=".7"/>`;
    }
    car = `<g id="${px}car" transform="${T}${flip ? ` translate(4.66 0) scale(-1 1)` : ""}">${g}</g>`;
    const base = cam.p(0, -0.15, z)[1];
    car = `<g opacity=".5" filter="url(#${px}smear)"><use href="#${px}car" transform="matrix(1 0 0 -1 0 ${f(2 * base)})"/></g>` + car;
  }

  /* --- foreground: palms framing the shot ---------------------------- */
  if (o.palms) for (const pl of o.palms) {
    fg += `<path d="M${f(pl.x)},${f(pl.y)} C${f(pl.x - pl.lean * 0.4)},${f(pl.y + (H - pl.y) * 0.45)} ${f(pl.x - pl.lean)},${f(pl.y + (H - pl.y) * 0.8)} ${f(pl.x - pl.lean * 1.2)},${H + 10}" fill="none" stroke="#12061f" stroke-width="${f(pl.trunk)}" stroke-linecap="round"/>`;
    fg += palmCrown(pl.x, pl.y, pl.size, pl.seed, "#12061f");
  }

  const reflect = o.reflections !== false;
  const baseY = cam.p(0, 0, 0)[1];
  const mainId = `${px}main`;
  const body = `
  <g id="${mainId}">
    ${sky}
    <g>${city}</g>
    ${back}
    ${facade}
    ${ground}
    ${soffit}
    ${marquee}
    ${crest}
  </g>
  <g>${floor}</g>
  ${reflect ? `<g mask="url(#${px}reflMask)" opacity="${dawn ? 0.3 : 0.55}"><use href="#${mainId}" transform="matrix(1 0 0 -1 0 ${f(2 * baseY)})" filter="url(#${px}smear)"/></g>` : ""}
  ${front}
  ${street}
  ${car}
  <g style="mix-blend-mode:screen">${bloom}</g>
  ${fg}`;
  defs += `<filter id="${px}smear" x="-5%" y="-5%" width="110%" height="120%"><feGaussianBlur stdDeviation="1.6 7"/></filter>`;
  return { defs, body, geo };
}
