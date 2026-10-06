/**
 * Measures the chapter cards' words and ribbons in Chromium, on the very
 * woff2 files the page loads (src/app/fonts), to check the metrics the
 * cards are laid out with (src/components/ChapterCard: scriptFace.ts reads
 * scriptMetrics.json, capsFace.ts holds the capitals' table).
 *
 *     node tools/chapter/measure.mjs [--profile]
 *
 * Prints JSON: for every chapter word in the dictionaries, its advance
 * width (with the cards' word spacing), its ink box and the run an SVG
 * <text> gets, all in em at 1000 px; for every ribbon in capitals, its
 * kerned run in em. chapterLayout.test.ts keeps these numbers as MEASURED:
 * rerun this after changing a face or a word, and update them. With
 * --profile, each word's lowest ink per 0.02 em column too (canvas, with
 * no keyline), to compare with scriptDepth.
 *
 * Needs Playwright's Chromium (a local `playwright` package, or the global
 * one PLAYWRIGHT_GLOBAL points at).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const WORD_SPACE = 0.16;

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return import(process.env.PLAYWRIGHT_GLOBAL ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
  }
}

/** Every chapter in the dictionaries, with its language. */
function chapters() {
  const found = [];
  for (const lang of ["en", "es"]) {
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.chapter && typeof node.chapter.word === "string") found.push({ lang, ...node.chapter });
      for (const value of Object.values(node)) walk(value);
    };
    walk(JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/dictionaries/${lang}.json`), "utf8")));
  }
  return found;
}

const font = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, "src/app/fonts", file)).toString("base64")}`;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"Script";src:url(${font("ChapterScript-Regular.woff2")}) format("woff2");font-display:block}
@font-face{font-family:"Caps";src:url(${font("BigShouldersDisplay-Black.latin.woff2")}) format("woff2");font-weight:900;font-display:block}
</style><body><svg id="svg" width="10" height="10"></svg></body>`;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html);
  const list = chapters().map(({ lang, word, ribbon }) => ({ word, ribbon: ribbon.toLocaleUpperCase(lang) }));
  const result = await page.evaluate(
    async ({ list, wordSpace, profile }) => {
      await Promise.all([document.fonts.load('400 1000px "Script"'), document.fonts.load('900 1000px "Caps"')]);
      const ctx = document.createElement("canvas").getContext("2d");
      const em = (value) => Math.round(value) / 1000;
      const words = {};
      const ribbons = {};
      for (const { word, ribbon } of list) {
        ctx.font = '400 1000px "Script"';
        ctx.wordSpacing = `${wordSpace * 1000}px`;
        const m = ctx.measureText(word);
        const svg = document.getElementById("svg");
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("font-family", "Script");
        text.setAttribute("font-size", "1000");
        text.setAttribute("word-spacing", String(wordSpace * 1000));
        text.textContent = word;
        svg.append(text);
        const svgLength = text.getComputedTextLength();
        text.remove();
        const entry = {
          advance: em(m.width),
          left: em(-m.actualBoundingBoxLeft),
          right: em(m.actualBoundingBoxRight),
          ascent: em(m.actualBoundingBoxAscent),
          descent: em(m.actualBoundingBoxDescent),
          svgLength: em(svgLength),
        };
        if (profile) {
          // The lowest inked row in each 20 px column, the pen at x 600 and the baseline at y 1200.
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(m.width + 1400);
          canvas.height = 1800;
          const c = canvas.getContext("2d", { willReadFrequently: true });
          c.font = ctx.font;
          c.wordSpacing = ctx.wordSpacing;
          c.fillText(word, 600, 1200);
          const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
          const lows = [];
          for (let col = 0; col * 20 < canvas.width; col++) {
            let low = null;
            for (let x = col * 20; x < Math.min(canvas.width, col * 20 + 20); x++) {
              for (let y = canvas.height - 1; y >= 0; y--) {
                if (data[(y * canvas.width + x) * 4 + 3] > 127) {
                  low = low === null ? y : Math.max(low, y);
                  break;
                }
              }
            }
            lows.push(low === null ? null : (low + 1 - 1200) / 1000);
          }
          entry.profile = { from: -0.6, column: 0.02, depth: lows };
        }
        words[word] = entry;
        ctx.font = '900 1000px "Caps"';
        ctx.wordSpacing = "0px";
        ribbons[ribbon] = em(ctx.measureText(ribbon).width);
      }
      return { words, ribbons };
    },
    { list, wordSpace: WORD_SPACE, profile: process.argv.includes("--profile") },
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
