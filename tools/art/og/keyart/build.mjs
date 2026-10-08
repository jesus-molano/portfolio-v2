#!/usr/bin/env node
/**
 * The link preview cards (Open Graph and Twitter), one per locale: a game
 * cover's grid of the site's own frames, his name and role in its type.
 *
 *   node --experimental-strip-types tools/art/og/keyart/build.mjs
 *
 * The frames in ./frames are the site as it renders (the hero's drive into
 * the city and him at the wheel, the army's board at night, the Afterglow
 * with its marquee lettered per locale), shot without the interface; Dante
 * mid-strike is public/interlude/dante-swipe.webp, his claw marks drawn
 * by src/features/suspects/claw.ts. Name and role come from the
 * dictionaries (hero.name, hero.role), the colours from
 * src/design/tokens.ts. Faces: Big Shoulders from src/app/fonts; Unbounded
 * and JetBrains Mono (the site's next/font faces) from .art-cache/fonts/,
 * taken from a production build's .next/static the first time.
 *
 * Writes public/og/<locale>.jpg (1200 x 630, under 300 KB) and
 * tools/art/og/sources.json: the words and the SHA-256 of every input and
 * of each card, which src/lib/shareCard.test.ts checks.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..", "..");
const FONTS = path.join(ROOT, ".art-cache", "fonts");
const SIZE = { width: 1200, height: 630 };
const MAX_BYTES = 300 * 1024;
const HOST = "jesusmolano.dev";
const COPY = {
  es: { drive: "Pulsa W para conducir", hostile: "HOSTIL" },
  en: { drive: "Press W to drive", hostile: "HOSTILE" },
};

const sha256 = (file) => createHash("sha256").update(readFileSync(path.join(ROOT, file))).digest("hex");

/** Unbounded and JetBrains Mono, latin, as next/font self-hosts them. */
function fonts() {
  const wanted = { Unbounded: "unbounded-latin.woff2", "JetBrains Mono": "jetbrains-latin.woff2" };
  mkdirSync(FONTS, { recursive: true });
  const missing = Object.entries(wanted).filter(([, file]) => !existsSync(path.join(FONTS, file)));
  if (missing.length === 0) return;
  const chunks = path.join(ROOT, ".next", "static", "chunks");
  if (!existsSync(chunks)) throw new Error("No faces in .art-cache/fonts: run pnpm build once, so they can be taken from .next/static.");
  const css = readdirSync(chunks).filter((f) => f.endsWith(".css")).map((f) => readFileSync(path.join(chunks, f), "utf8")).join("");
  for (const [family, file] of missing) {
    const face = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]).find((b) => b.includes(`font-family:${family};`) && b.includes("U+0000-00FF"));
    const src = face?.match(/url\(\.\.\/media\/([^)]+)\)/)?.[1];
    if (!src) throw new Error(`No latin ${family} in the build's stylesheets.`);
    copyFileSync(path.join(ROOT, ".next", "static", "media", src), path.join(FONTS, file));
  }
}

/** Dante's three marks for the 260 x 300 panel, as the select draws them over the screen. */
async function clawSvg() {
  const { clawMarks, clawStart } = await import(pathToFileURL(path.join(ROOT, "src/features/suspects/claw.ts")).href);
  const W = 260;
  const H = 300;
  const claw = clawMarks(W, H, clawStart({ left: 60, top: 60, width: 150, height: 220 }, { width: W, height: H }, true), true);
  const tokens = readFileSync(path.join(ROOT, "src/design/tokens.ts"), "utf8");
  const colour = (name) => tokens.match(new RegExp(`${name}: "(#[0-9a-f]{6})"`, "i"))[1];
  const paths = claw.marks.flatMap((m) => [
    ...m.glow.map((d) => `<path d="${d}" fill="${colour("magenta")}" opacity="0.14"/>`),
    `<path d="${m.edge}" fill="${colour("clawEdge")}"/>`,
    `<path d="${m.flesh}" fill="${colour("clawFlesh")}"/>`,
    `<path d="${m.gash}" fill="${colour("clawGash")}"/>`,
    `<path d="${m.core}" fill="${colour("clawCore")}" opacity="0.6"/>`,
  ]);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${paths.join("")}</svg>`;
}

function tokenCss() {
  const tokens = readFileSync(path.join(ROOT, "src/design/tokens.ts"), "utf8");
  return ["night", "ink", "cream", "magenta", "orange", "sodium"]
    .map((name) => `--${name}: ${tokens.match(new RegExp(`\\n  ${name}: "(#[0-9a-f]{6})"`, "i"))[1]};`)
    .join(" ");
}

const { chromium } = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));
fonts();
const claw = await clawSvg();
const template = readFileSync(path.join(HERE, "card.html"), "utf8");
const sources = {};
const browser = await chromium.launch();
for (const lang of ["en", "es"]) {
  const dict = JSON.parse(readFileSync(path.join(ROOT, `src/i18n/dictionaries/${lang}.json`), "utf8"));
  const name = dict.hero.name.toUpperCase();
  const role = dict.hero.role.toUpperCase();
  const html = template
    .replaceAll("{{lang}}", lang)
    .replaceAll("{{root}}", pathToFileURL(ROOT).href)
    .replaceAll("{{fonts}}", pathToFileURL(FONTS).href)
    .replace("{{tokens}}", tokenCss())
    .replace("{{name}}", name)
    .replace("{{role}}", role)
    .replace("{{drive}}", COPY[lang].drive)
    .replace("{{hostile}}", COPY[lang].hostile)
    .replace("{{host}}", HOST)
    .replace("{{claw}}", claw);
  const page = path.join(HERE, `.card-${lang}.html`);
  writeFileSync(page, html);
  const tab = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  await tab.goto(pathToFileURL(page).href);
  await tab.evaluate(() => document.fonts.ready);
  // His name on one line, as big as the block takes.
  await tab.evaluate(() => {
    const el = document.querySelector(".name");
    let size = 64;
    while (el.scrollWidth > 584 && size > 30) el.style.fontSize = `${(size -= 1)}px`;
  });
  await tab.waitForTimeout(300);
  const out = path.join(ROOT, "public", "og", `${lang}.jpg`);
  for (const quality of [92, 88, 84, 80]) {
    await tab.screenshot({ path: out, type: "jpeg", quality });
    if (readFileSync(out).length <= MAX_BYTES) break;
  }
  await tab.close();
  const files = [
    "tools/art/og/keyart/card.html",
    "tools/art/og/keyart/frames/hero-chase.webp",
    "tools/art/og/keyart/frames/hero-driver.webp",
    "tools/art/og/keyart/frames/army.webp",
    `tools/art/og/keyart/frames/cinema-${lang}.webp`,
    "public/interlude/dante-swipe.webp",
    "src/features/suspects/claw.ts",
  ];
  sources[lang] = {
    words: [dict.hero.name, dict.hero.role],
    files: Object.fromEntries(files.map((f) => [f, sha256(f)])),
    card: sha256(`public/og/${lang}.jpg`),
  };
  console.log(lang, `${Math.round(readFileSync(out).length / 1024)} KB`);
}
await browser.close();
writeFileSync(path.join(ROOT, "tools/art/og/sources.json"), `${JSON.stringify(sources, null, 2)}\n`);
