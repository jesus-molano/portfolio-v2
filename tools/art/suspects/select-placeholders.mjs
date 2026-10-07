#!/usr/bin/env node
/**
 * THE USUAL SUSPECTS as a character select: placeholders for the three
 * renders the select needs beside the four cats, until the Blender renders
 * land under the same names (tools/blender, render_interlude.py):
 *
 * - `jesus`: Jesús on one knee (his right knee down, his left foot planted,
 *   his left forearm on the raised knee), facing the camera, in the hero's
 *   striped tee, gold aviators, earring, beard and crew cut: flat vector
 *   art in the site's palette, about 1.26 m to the crown;
 * - `kira-back`: Kira from behind, her own outline (the front render's
 *   alpha) in a tabby coat, lit like the others;
 * - `tom-asleep`: Tom with his eyes closed, the fur above each eye drawn
 *   down over it and a line of lashes.
 *
 *   node tools/art/suspects/select-placeholders.mjs [--out public/interlude]
 *
 * Writes <id>.png into a temporary folder, encodes each as WebP and AVIF
 * (tools/art/suspects/encode.py) and adds the three entries to
 * manifest.json as the renders do (public/interlude/README.md): Kira's
 * back and Tom asleep under `states`, each naming its cat, and Jesús at
 * the top level, in the cats' contract (w, h, floorY, headTopY, centerX,
 * headWidth in image pixels) with his real `heightCm` and the `scale` he
 * is drawn at (1:scale; the page shows him at the chart's true scale).
 * Kira's back and Tom asleep are the front renders' own size, so they
 * share their metrics. Deterministic.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { withRenderer } from "../browser.mjs";

const { values } = parseArgs({ options: { out: { type: "string", default: "public/interlude" } } });
const OUT = path.resolve(values.out);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const PYTHON = process.env.PYTHON ?? "python3";
const manifestPath = path.join(OUT, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const dataUrl = (file) => `data:image/webp;base64,${fs.readFileSync(path.join(OUT, file)).toString("base64")}`;
const page = (svg, w, h) =>
  `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg.replace("<svg", `<svg width="${w}" height="${h}"`)}</body></html>`;

// ------------------------------------------------------------------ Kira from behind

function kiraBack() {
  const { w, h } = manifest.cats.kira;
  const src = dataUrl("kira.webp");
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
 <defs>
  <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:alpha"><image href="${src}" width="${w}" height="${h}"/></mask>
  <filter id="stripe" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">
   <feTurbulence type="turbulence" baseFrequency="0.004 0.022" numOctaves="2" seed="11" result="t"/>
   <feColorMatrix in="t" type="matrix" values="0 0 0 0 .08  0 0 0 0 .055  0 0 0 0 .04  -6 0 0 0 1.2" result="c"/>
   <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="1" seed="9" result="w"/>
   <feDisplacementMap in="c" in2="w" scale="70" xChannelSelector="R" yChannelSelector="G"/>
   <feGaussianBlur stdDeviation="2.2 1"/>
  </filter>
  <filter id="patch" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">
   <feTurbulence type="fractalNoise" baseFrequency="0.007 0.011" numOctaves="2" seed="5" result="n"/>
   <feColorMatrix in="n" type="matrix" values="0 0 0 0 .62  0 0 0 0 .36  0 0 0 0 .18  6 0 0 0 -3.5"/>
   <feGaussianBlur stdDeviation="8"/>
  </filter>
  <filter id="fur" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">
   <feTurbulence type="fractalNoise" baseFrequency="0.6 0.05" numOctaves="2" seed="2"/>
   <feColorMatrix type="matrix" values="0 0 0 0 .95  0 0 0 0 .88  0 0 0 0 .8  1.4 0 0 0 -.62"/>
  </filter>
  <radialGradient id="base" cx=".46" cy=".36" r=".7"><stop offset="0" stop-color="#66574a"/><stop offset=".5" stop-color="#43372c"/><stop offset="1" stop-color="#1e1611"/></radialGradient>
  <linearGradient id="rim" x1="0" x2="1"><stop offset="0" stop-color="#b8a2ff" stop-opacity=".35"/><stop offset=".12" stop-color="#b8a2ff" stop-opacity="0"/><stop offset=".82" stop-color="#d0306e" stop-opacity="0"/><stop offset="1" stop-color="#d0306e" stop-opacity=".6"/></linearGradient>
  <linearGradient id="spine" x1="0" x2="1"><stop offset=".4" stop-color="#120a06" stop-opacity="0"/><stop offset=".5" stop-color="#120a06" stop-opacity=".45"/><stop offset=".6" stop-color="#120a06" stop-opacity="0"/></linearGradient>
  <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1"><stop offset=".72" stop-color="#1a0d38" stop-opacity="0"/><stop offset="1" stop-color="#1a0d38" stop-opacity=".5"/></linearGradient>
  <filter id="inner" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
   <feGaussianBlur in="SourceAlpha" stdDeviation="26" result="b"/>
   <feComponentTransfer in="b" result="inv"><feFuncA type="table" tableValues="1 .85 .4 .08 0"/></feComponentTransfer>
   <feFlood flood-color="#120b14"/><feComposite in2="inv" operator="in"/>
  </filter>
  <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
 </defs>
 <g mask="url(#m)">
  <rect width="${w}" height="${h}" fill="url(#base)"/>
  <rect width="${w}" height="${h}" filter="url(#patch)"/>
  <rect width="${w}" height="${h}" filter="url(#stripe)"/>
  <rect x="220" y="140" width="140" height="560" fill="url(#spine)" filter="url(#soft)"/>
  <rect width="${w}" height="${h}" filter="url(#fur)" opacity=".12"/>
  <ellipse cx="300" cy="170" rx="130" ry="60" fill="#fff4f1" opacity=".07" filter="url(#soft)"/>
  <image href="${src}" width="${w}" height="${h}" filter="url(#inner)"/>
  <rect width="${w}" height="${h}" fill="url(#rim)"/>
  <rect width="${w}" height="${h}" fill="url(#floor)"/>
 </g>
</svg>`,
  };
}

// ------------------------------------------------------------------ Tom asleep

function tomAsleep() {
  const { w, h } = manifest.cats.tom;
  const src = dataUrl("tom.webp");
  // The fur above each eye, drawn 34 px down over it, then the lashes.
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
 <defs>
  <filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>
  <mask id="l" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><ellipse cx="247" cy="182" rx="31" ry="18" fill="#fff" filter="url(#f)" transform="rotate(5 247 182)"/></mask>
  <mask id="r" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><ellipse cx="358" cy="190" rx="29" ry="17" fill="#fff" filter="url(#f)" transform="rotate(-7 358 190)"/></mask>
 </defs>
 <image href="${src}" width="${w}" height="${h}"/>
 <g mask="url(#l)"><image href="${src}" width="${w}" height="${h}" transform="translate(0 34)"/></g>
 <g mask="url(#r)"><image href="${src}" width="${w}" height="${h}" transform="translate(0 34)"/></g>
 <path d="M223 189Q247 202 272 189M337 196Q358 208 381 193" fill="none" stroke="#1c1620" stroke-width="3.6" stroke-linecap="round" opacity=".9"/>
</svg>`,
  };
}

// ------------------------------------------------------------------ Jesús on one knee

/** Drawing units: the figure is drawn in a 92 x 156 box, the floor at y = 154, the slot centre at x = 45. */
const J = { x0: -5, width: 92, height: 156, floor: 154, center: 40, crown: 9.6, headLeft: 30.4, headRight: 49.6, realCm: 126, scale: 6.4 };

function jesus() {
  const body = `
   <path d="M14.8 57 21.8 59 24.6 76 27.4 91 28.8 98.6 23.6 99.6 20.6 91.6 16.8 76Z"/>
   <path d="M65.2 57 58.2 59 56.8 74 56.6 86 57.4 96 62.6 97.2 63.6 88 63.2 74Z"/>
   <path d="M36.6 30.5H43.4L44.2 37.4H35.8Z"/>
   <path d="M31.6 16.4C31.6 8.6 48.4 8.6 48.4 16.4V22.2C48.4 28.6 44.4 32.6 40 32.6 35.6 32.6 31.6 28.6 31.6 22.2Z"/>
   <ellipse cx="31.1" cy="21" rx="1.4" ry="2.5"/><ellipse cx="48.9" cy="21" rx="1.4" ry="2.5"/>
   <use href="#tee"/>
   <path d="${J.hips}"/>
   <path d="${J.kneel}"/>
   <path d="${J.backShoe}"/>
   <path d="${J.shin}"/>
   <path d="${J.shoe}"/>
   <path d="${J.knee}"/>
   <path d="${J.hand}"/>`;
  const w = Math.round(J.width * J.scale);
  const h = Math.round(J.height * J.scale);
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${J.x0} 0 ${J.width} ${J.height}">
 <defs>
  <linearGradient id="light" x1="0" x2="1"><stop offset="0" stop-color="#fff4f1" stop-opacity=".2"/><stop offset=".38" stop-color="#fff4f1" stop-opacity="0"/><stop offset=".62" stop-color="#1a0d38" stop-opacity=".1"/><stop offset="1" stop-color="#1a0d38" stop-opacity=".55"/></linearGradient>
  <linearGradient id="down" x1="0" x2="0" y1="0" y2="1"><stop offset=".55" stop-color="#1a0d38" stop-opacity="0"/><stop offset="1" stop-color="#1a0d38" stop-opacity=".38"/></linearGradient>
  <radialGradient id="key" cx=".42" cy=".28" r=".55"><stop offset="0" stop-color="#e8dcff" stop-opacity=".16"/><stop offset="1" stop-color="#e8dcff" stop-opacity="0"/></radialGradient>
  <linearGradient id="lens" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5a1f7a"/><stop offset=".5" stop-color="#c03a8e"/><stop offset="1" stop-color="#ff8fd0"/></linearGradient>
  <linearGradient id="skin" x1="0" x2="1"><stop offset="0" stop-color="#cf998a"/><stop offset=".55" stop-color="#b47f75"/><stop offset="1" stop-color="#8a5a5c"/></linearGradient>
  <linearGradient id="armL" x1="0" x2="1"><stop offset="0" stop-color="#c99385"/><stop offset="1" stop-color="#a87470"/></linearGradient>
  <linearGradient id="armR" x1="0" x2="1"><stop offset="0" stop-color="#9a6865"/><stop offset="1" stop-color="#7a4d54"/></linearGradient>
  <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1"><stop offset=".5" stop-color="#17101c"/><stop offset="1" stop-color="#17101c" stop-opacity=".2"/></linearGradient>
  <linearGradient id="denim" x1="0" x2="1"><stop offset="0" stop-color="#36407a"/><stop offset=".5" stop-color="#2c3464"/><stop offset="1" stop-color="#20264d"/></linearGradient>
  <linearGradient id="denimNear" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#46508e"/><stop offset=".55" stop-color="#323a70"/><stop offset="1" stop-color="#232a55"/></linearGradient>
  <radialGradient id="shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0b0518" stop-opacity=".75"/><stop offset="1" stop-color="#0b0518" stop-opacity="0"/></radialGradient>
  <path id="tee" d="M21 38.6C26.5 36.4 32.5 35.6 36 35.9 37.6 38.3 42.4 38.3 44 35.9 47.5 35.6 53.5 36.4 59 38.6 61.8 40 63 42.6 63.8 46L65.6 57.4 58 59.4 56.6 53.6C56.4 66 56.6 82 57.4 97.6 50 99.8 30 99.8 22.6 97.6 23.4 82 23.6 66 23.4 53.6L22 59.4 14.4 57.4 16.2 46C17 42.6 18.2 40 21 38.6Z"/>
  <clipPath id="teeClip"><use href="#tee"/></clipPath>
  <g id="body">${body}</g>
  <clipPath id="bodyClip"><use href="#body"/></clipPath>
 </defs>
 <ellipse cx="36" cy="${J.floor}" rx="33" ry="2.6" fill="url(#shadow)"/>
 <use href="#body" fill="#b8a2ff" opacity=".35" transform="translate(-.6 -.2)"/>
 <use href="#body" fill="#d0306e" opacity=".85" transform="translate(.75 0)"/>
 <use href="#body" fill="#ff8fd0" opacity=".5" transform="translate(.4 0)"/>
 <path d="M14.8 57 21.8 59 24.6 76 27.4 91 28.8 98.6 23.6 99.6 20.6 91.6 16.8 76Z" fill="url(#armL)"/>
 <path d="M65.2 57 58.2 59 56.8 74 56.6 86 57.4 96 62.6 97.2 63.6 88 63.2 74Z" fill="url(#armR)"/>
 <path d="M36.6 30.5H43.4L44.2 37.4H35.8Z" fill="#9c6a66"/>
 <path d="M36.6 30.5H43.4L43.7 33.6C41.4 35 38.6 35 36.3 33.6Z" fill="#6e4448"/>
 <use href="#tee" fill="#ebe4f3"/>
 <g clip-path="url(#teeClip)">
  <g fill="#202150">${Array.from({ length: 15 }, (_, i) => `<rect x="0" y="${(40.4 + i * 3.8).toFixed(1)}" width="80" height="1.8"/>`).join("")}</g>
  <path d="M23.4 53.6 22 59.4M56.6 53.6 58 59.4" stroke="#1a0d38" stroke-opacity=".35" stroke-width=".8"/>
  <path d="M27 62C29 72 28.6 86 26.6 97" fill="none" stroke="#1a0d38" stroke-opacity=".16" stroke-width="3"/>
  <path d="M53 62C51 72 51.4 86 53.4 97" fill="none" stroke="#1a0d38" stroke-opacity=".24" stroke-width="3"/>
 </g>
 <path d="M36 35.9C37.6 39.2 42.4 39.2 44 35.9" fill="none" stroke="#6e1f35" stroke-width="1.6" stroke-linecap="round"/>
 <path d="M9.6 141.4C13 142.4 18 145 21.6 149.6L19.6 153.4C15.6 151.6 12 148.6 9.2 145.6Z" fill="#20264d"/>
 <path d="${J.backShoe}" fill="#cfc6dc"/>
 <path d="M6.6 151.2H15.8" stroke="#3a2a5c" stroke-width="1.2"/>
 <path d="M8.6 137.4C10 136.8 12.6 136.8 14.2 137.6" fill="none" stroke="#9e93b4" stroke-width=".6"/>
 <path d="${J.kneel}" fill="url(#denim)"/>
 <ellipse cx="20.4" cy="${J.floor - 0.8}" rx="7.6" ry="1.4" fill="#151a3a"/>
 <path d="M31.4 106C29.8 120 27.4 134 23.6 146" fill="none" stroke="#5a64a6" stroke-width="1.4" stroke-opacity=".4"/>
 <path d="${J.hips}" fill="url(#denim)"/>
 <path d="M22.4 95.6H57.6L57.9 99.2H22.1Z" fill="#1d2248"/>
 <rect x="38.6" y="95.4" width="2.8" height="4" rx=".5" fill="#c9a24a" opacity=".85"/>
 <path d="M24.2 99.6C26.6 103 30 104 33 104.2M40 99.4V104" fill="none" stroke="#161a3c" stroke-width=".6"/>
 <path d="${J.shin}" fill="url(#denim)"/>
 <path d="M54.2 116C54.5 128 54.5 136 54.2 144" fill="none" stroke="#5a64a6" stroke-width="1.1" stroke-opacity=".3"/>
 <path d="${J.shoe}" fill="#e8e1ef"/>
 <path d="M44.2 151.6H63.6" stroke="#3a2a5c" stroke-width="1.3"/>
 <path d="M48.4 147.2C51 146.4 56.8 146.4 59.4 147.2" fill="none" stroke="#b9afc9" stroke-width=".6"/>
 <path d="${J.knee}" fill="url(#denimNear)"/>
 <path d="M47.8 101.6C51 99.4 57 99.4 60.2 101.6" fill="none" stroke="#6a74b6" stroke-width=".9" stroke-opacity=".5"/>
 <path d="${J.hand}" fill="#8a5a5c"/>
 <path d="M56.2 103.6 56.6 107M58.4 103.8 58.6 107.4M60.4 103.6 60.4 106.6" stroke="#6e4448" stroke-width=".4" stroke-linecap="round"/>
 <path d="M23.4 98.4C24.6 96.4 27.6 96.2 29 97.8 28.6 99.4 25.4 100.2 23.4 98.4Z" fill="#b57f74"/>
 <ellipse cx="31.1" cy="21" rx="1.4" ry="2.5" fill="#bd877c"/>
 <ellipse cx="48.9" cy="21" rx="1.4" ry="2.5" fill="#8a5a5c"/>
 <path d="M31.6 16.4C31.6 8.6 48.4 8.6 48.4 16.4V22.2C48.4 28.6 44.4 32.6 40 32.6 35.6 32.6 31.6 28.6 31.6 22.2Z" fill="url(#skin)"/>
 <path d="M31.4 18C30.4 7 49.6 7 48.6 18 47.8 14.2 44.6 12.2 40 12.2 35.4 12.2 32.2 14.2 31.4 18Z" fill="url(#fade)"/>
 <path d="M33 12.6C36 10.6 44 10.6 47 12.6" fill="none" stroke="#3a2c40" stroke-width=".5" opacity=".7"/>
 <path d="M31.8 20.6C32 28 35 34.6 40 34.8 45 34.6 48 28 48.2 20.6L47 21.6C46.8 25.6 44.2 27.6 40 27.4 35.8 27.6 33.2 25.6 33 21.6Z" fill="#1b1320"/>
 <path d="M35.8 25.6C37.6 24.5 42.4 24.5 44.2 25.6 42.8 26.9 37.2 26.9 35.8 25.6Z" fill="#1b1320"/>
 <path d="M37.8 27.9C39.2 28.4 40.8 28.4 42.2 27.9" fill="none" stroke="#7a4a52" stroke-width=".7" stroke-linecap="round"/>
 <path d="M40 19.8 39.1 23.7 40.6 24" fill="none" stroke="#6e4448" stroke-width=".45"/>
 <path d="M32.8 18.7H39.1C39.7 18.7 39.7 19.5 39.5 20.5 39.1 22.8 37.6 23.4 36.2 23.4 34.2 23.4 32.8 22.1 32.6 20.3 32.5 19.3 32.5 18.7 32.8 18.7Z" fill="url(#lens)" stroke="#f0c36a" stroke-width=".42"/>
 <path d="M47.2 18.7H40.9C40.3 18.7 40.3 19.5 40.5 20.5 40.9 22.8 42.4 23.4 43.8 23.4 45.8 23.4 47.2 22.1 47.4 20.3 47.5 19.3 47.5 18.7 47.2 18.7Z" fill="url(#lens)" stroke="#f0c36a" stroke-width=".42"/>
 <path d="M32.6 18.6H47.4M39.5 19.3C39.8 18.9 40.2 18.9 40.5 19.3M32.6 19 31 19.8M47.4 19 49 19.8" fill="none" stroke="#f0c36a" stroke-width=".42"/>
 <path d="M33.6 19.6 35.6 19.6M41.6 19.6 43.6 19.6" stroke="#fff4f1" stroke-width=".5" stroke-linecap="round" opacity=".85"/>
 <circle cx="49.1" cy="24" r=".9" fill="none" stroke="#5a6ea8" stroke-width=".42"/>
 <rect x="${J.x0}" y="0" width="${J.width}" height="${J.height}" fill="url(#key)" clip-path="url(#bodyClip)"/>
 <rect x="${J.x0}" y="0" width="${J.width}" height="${J.height}" fill="url(#light)" clip-path="url(#bodyClip)"/>
 <rect x="${J.x0}" y="0" width="${J.width}" height="${J.height}" fill="url(#down)" clip-path="url(#bodyClip)"/>
</svg>`,
  };
}
Object.assign(J, {
  // Hips and seat, under the belt.
  hips: "M22.4 95.6H57.6L58.4 104.6C52 106.6 46 106 40 105 34 106 28 106.6 21.8 105Z",
  // His right thigh, down and out to the knee on the floor.
  kneel: "M22.6 101H39.6L37 116 30.6 142C29.4 148.4 25.6 152.8 21 152.4 16.4 152 13.6 148.4 14.2 143.6L19.4 118Z",
  // That leg's sneaker behind the knee, toes bent on the floor, its heel up.
  backShoe: "M6.2 138.6C6.6 136.4 9.6 135.4 12.4 135.8 15 136.2 16.6 138.2 16.4 140.8L15.8 152.2C15.6 153.4 14.6 154 13.4 154H8.2C7 154 6.2 153.2 6.2 152Z",
  // His left shin, from the raised knee down to the planted foot.
  shin: "M47.8 108H60.2L59.6 128 59.2 146.2H48.8L48.2 128Z",
  // The planted sneaker, its toe toward the camera.
  shoe: "M46.6 144.6H61.4C64 145 65 148.6 64.4 151.4 64 153.4 62.4 154 60.4 154H47.4C45.4 154 43.8 153.4 43.4 151.4 42.8 148.6 43.8 145 46.6 144.6Z",
  // The raised knee, nearest the camera, at the height of his hips.
  knee: "M45.6 98.6C47.6 95.6 59.4 95.6 61.8 99 63.6 102 63 108.4 60.8 111 57.6 113.8 49.8 113.8 46.6 111 44.4 108.4 44.2 101.8 45.6 98.6Z",
  // His left hand hanging over the knee.
  hand: "M56.4 95.6C58.6 94.6 62 95 63 96.8 63.6 99 63 103.6 61.8 106.2 60.4 108 57.2 108 56.2 106.4 55.4 104 55.4 98.6 56.4 95.6Z",
});

// ------------------------------------------------------------------ render, measure, encode

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "select-placeholders-"));
const jobs = { "kira-back": kiraBack(), "tom-asleep": tomAsleep(), jesus: jesus() };
await withRenderer(async (render) => {
  for (const [id, job] of Object.entries(jobs)) {
    fs.writeFileSync(path.join(tmp, `${id}.png`), await render(page(job.svg, job.w, job.h), job.w, job.h));
  }
});

// The renders' contract (public/interlude/README.md): the states name their cat, Jesús stands at the top level.
const states = { ...(manifest.states ?? {}) };
states["kira-back"] = { ...manifest.cats.kira, cat: "kira" };
states["tom-asleep"] = { ...manifest.cats.tom, cat: "tom" };
let jesusEntry;
{
  const s = J.scale;
  const floorY = Math.round(J.floor * s);
  const headTopY = Math.round(J.crown * s);
  jesusEntry = {
    w: jobs.jesus.w,
    h: jobs.jesus.h,
    floorY,
    headTopY,
    centerX: Math.round((J.center - J.x0) * s),
    headWidth: Math.round((J.headRight - J.headLeft) * s),
    // He stands J.realCm tall on one knee, drawn at 1:scale of the manifest's pixels per centimetre.
    heightCm: J.realCm,
    scale: Math.round((manifest.pxPerCm / ((floorY - headTopY) / J.realCm)) * 10000) / 10000,
  };
}
for (const id of Object.keys(jobs)) {
  execFileSync(PYTHON, [path.join(ROOT, "tools/art/suspects/encode.py"), path.join(tmp, `${id}.png`), path.join(OUT, id)], { stdio: "inherit" });
}
delete manifest.figures;
manifest.states = states;
manifest.jesus = jesusEntry;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ states, jesus: jesusEntry }, null, 2));
