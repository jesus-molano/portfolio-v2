/**
 * Shared helpers for the finale's art (the cinema plates and the posters):
 * the palette, a seeded generator, a level pinhole camera and the SVG
 * filters every frame uses. Art-only colours live here; the site's own
 * colours are the tokens (src/design/tokens.ts), mirrored where the art
 * meets the page (`C.night`, `C.cream`, ...).
 */

export const C = {
  night: "#1a0d38", ink: "#2b1848", dusk: "#6a4bc4", haze: "#e39bbd", magenta: "#ff2d95", pink: "#ff8fd0",
  cyan: "#19e6ff", violet: "#8a4dff", orange: "#ff8a5c", amber: "#ffd8a8", lilac: "#8c62b8",
  asphalt: "#3a2a5c", sodium: "#ffd27a", cream: "#fff4f1", text: "#f6f1ff", deep: "#0b0619", red: "#ff3b5c",
};

/** mulberry32, the same generator as createRandom (src/features/hero/scene/world.ts). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const f = (n) => +Number(n).toFixed(2);
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function mix(c1, c2, t) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))).toString(16).padStart(2, "0")).join("");
}

/**
 * Level pinhole camera looking down -z with lens shift: verticals stay
 * vertical and planes facing the camera map affinely. World metres, y up.
 */
export class Cam {
  constructor({ x, y, z, f, cx, cy }) {
    Object.assign(this, { x, y, z, F: f, cx, cy });
  }
  p(X, Y, Z) {
    const d = this.z - Z;
    return [this.cx + (this.F * (X - this.x)) / d, this.cy - (this.F * (Y - this.y)) / d, d];
  }
  s(size, Z) {
    return (this.F * size) / (this.z - Z);
  }
  /** SVG matrix for a plane facing +z at depth Z: local metres, x right, y DOWN, origin at world (X, Y). */
  front(X, Y, Z) {
    const k = this.F / (this.z - Z);
    const [ox, oy] = this.p(X, Y, Z);
    return `matrix(${f(k)} 0 0 ${f(k)} ${f(ox)} ${f(oy)})`;
  }
}

export const pt = (p) => `${f(p[0])},${f(p[1])}`;
export const poly = (ps, attrs = "") => `<polygon points="${ps.map(pt).join(" ")}" ${attrs}/>`;

/** Grain, glows and blurs shared by every frame. Ids are prefixed per frame to stay unique. */
export function filters(px) {
  return `
  <filter id="${px}grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
  <filter id="${px}b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1"/></filter>
  <filter id="${px}b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="${px}b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="${px}b8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="${px}b16" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="${px}b30" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="${px}neon" x="-30%" y="-60%" width="160%" height="220%">
    <feGaussianBlur stdDeviation="2.2" result="b"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="w"/>
    <feMerge><feMergeNode in="w"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="${px}glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.4" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="${px}glowS" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="1" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
}

/** Grain and vignette over a frame. */
export function finish(px, w, h, grain = 0.08, vig = 0.7) {
  return `<radialGradient id="${px}vig" cx=".5" cy=".5" r=".78"><stop offset=".55" stop-color="#05020e" stop-opacity="0"/><stop offset="1" stop-color="#05020e" stop-opacity="${vig}"/></radialGradient>
  <rect width="${w}" height="${h}" fill="url(#${px}vig)"/>
  <rect width="${w}" height="${h}" filter="url(#${px}grain)" opacity="${grain}" style="mix-blend-mode:overlay"/>`;
}

/**
 * Fades the frame's edges into the page's night (`--va-color-night`), so a
 * plate letterboxed on a wider or taller screen has no seam. `edges` in
 * fractions of the frame: { top, bottom, left, right }.
 */
export function edgeFade(px, w, h, edges, color = C.night) {
  let s = "";
  const band = (id, x1, y1, x2, y2, rect) => {
    s += `<linearGradient id="${px}${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${color}"/><stop offset=".35" stop-color="${color}" stop-opacity=".7"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`;
    s += `<rect x="${f(rect[0])}" y="${f(rect[1])}" width="${f(rect[2])}" height="${f(rect[3])}" fill="url(#${px}${id})"/>`;
  };
  if (edges.top) band("fadeT", 0, 0, 0, 1, [0, 0, w, h * edges.top]);
  if (edges.bottom) band("fadeB", 0, 1, 0, 0, [0, h * (1 - edges.bottom), w, h * edges.bottom]);
  if (edges.left) band("fadeL", 0, 0, 1, 0, [0, 0, w * edges.left, h]);
  if (edges.right) band("fadeR", 1, 0, 0, 0, [w * (1 - edges.right), 0, w * edges.right, h]);
  return s;
}

/** A palm crown in screen space: pinnate fronds of tapered, drooping leaflets, a violet silhouette. */
export function palmCrown(cx, cy, size, seed, fill = "#12061f") {
  const r = rng(seed);
  let s = "";
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 2.05 + (r() - 0.5) * 0.22;
    const len = size * (0.8 + r() * 0.35);
    const up = Math.sin(a) < 0 ? 0.55 : 0.35;
    const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len * up + size * (0.28 + r() * 0.3);
    const mx = cx + Math.cos(a) * len * 0.55, my = cy + Math.sin(a) * len * 0.55 * up - size * 0.12;
    s += `<path d="M${f(cx)},${f(cy)} Q${f(mx)},${f(my)} ${f(ex)},${f(ey)}" fill="none" stroke="${fill}" stroke-width="${f(size * 0.028)}" stroke-linecap="round"/>`;
    const k = 30;
    let blades = "";
    for (let j = 1; j < k; j++) {
      const t = j / k;
      const qx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
      const qy = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
      const tx = 2 * (1 - t) * (mx - cx) + 2 * t * (ex - mx), ty = 2 * (1 - t) * (my - cy) + 2 * t * (ey - my);
      const tl = Math.hypot(tx, ty) || 1;
      const ux = tx / tl, uy = ty / tl;
      const L = size * 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.7) * (0.75 + r() * 0.4);
      const bw = size * 0.022 * (1 - t * 0.6);
      for (const sgn of [1, -1]) {
        // leaflet: out from the rachis, then hanging under gravity
        const nx = -uy * sgn, ny = ux * sgn;
        const tipx = qx + nx * L * 0.62 + ux * L * 0.42;
        const tipy = qy + ny * L * 0.62 + uy * L * 0.42 + L * 0.85;
        const b1x = qx - ux * bw, b1y = qy - uy * bw, b2x = qx + ux * bw, b2y = qy + uy * bw;
        const c1x = qx + nx * L * 0.45 + ux * L * 0.1, c1y = qy + ny * L * 0.45 + L * 0.2;
        blades += `M${f(b1x)},${f(b1y)} Q${f(c1x)},${f(c1y)} ${f(tipx)},${f(tipy)} Q${f(c1x + ux * bw * 2)},${f(c1y + uy * bw * 2)} ${f(b2x)},${f(b2y)} Z `;
      }
    }
    s += `<path d="${blades}" fill="${fill}"/>`;
  }
  s += `<ellipse cx="${f(cx)}" cy="${f(cy + size * 0.04)}" rx="${f(size * 0.07)}" ry="${f(size * 0.1)}" fill="${fill}"/>`;
  return s;
}
