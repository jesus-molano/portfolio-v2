import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CAT_IDS, CULPRIT, lowestHead, parseManifest, placeLineup } from "./lineup";
import manifest from "../../../public/interlude/manifest.json";
import { Suspects } from "./Suspects";

const CSS = readFileSync(path.resolve(__dirname, "Suspects.module.css"), "utf8");

/** The text a screen reader takes as an element's name: its content, minus what is aria-hidden. */
function accessibleName(html: string): string {
  return html
    .replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** One cat's slot in the rendered line-up. */
function slot(html: string, id: string): string {
  const start = html.indexOf(`data-cat="${id}"`);
  expect(start, id).toBeGreaterThan(0);
  return html.slice(start, html.indexOf("</li>", start));
}

/** The declarations of every rule whose selector list is exactly `selector`. */
function rules(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...CSS.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((match) => match[1]);
}

describe("the culprit", () => {
  it("is Dante, the smallest of the four: the one who looks least capable of it", () => {
    expect(CAT_IDS).toContain(CULPRIT);
    expect(CULPRIT).toBe("dante");
    expect(lowestHead(placeLineup(parseManifest(manifest)))).toBe(CULPRIT);
  });

  for (const lang of locales) {
    it(`${lang}: wears the stamp on his plate, a real button with a name, and nobody else does`, async () => {
      const dict = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Suspects, { dict: dict.suspects, lang }));
      expect(html.match(/<button\b/g)).toHaveLength(1);

      const dante = slot(html, CULPRIT);
      const cat = dict.suspects.cats.find((c) => c.id === CULPRIT)!;
      const button = dante.match(/<button\b([^>]*)>([\s\S]*?)<\/button>/);
      expect(button).not.toBeNull();
      const [, attributes, content] = button!;
      expect(attributes).toContain('type="button"');
      expect(attributes).toContain('aria-expanded="false"');
      expect(accessibleName(content)).toBe(`${cat.name}, ${cat.alias}`);

      // The verdict is real text, tied to the button and right after it.
      const controls = attributes.match(/aria-controls="([^"]+)"/)?.[1];
      expect(controls).toBeTruthy();
      expect(dante).toMatch(new RegExp(`</button><span[^>]*id="${controls}"[^>]*>${dict.suspects.stamp}</span>`));
      for (const other of CAT_IDS.filter((id) => id !== CULPRIT)) {
        expect(slot(html, other)).not.toContain(`>${dict.suspects.stamp}<`);
      }
    });
  }

  it("says GUILTY in each language, one word on the stamp", () => {
    expect(locales.length).toBe(2);
    return Promise.all(locales.map(getDictionary)).then(([first, second]) => {
      const stamps = [first.suspects.stamp, second.suspects.stamp].sort();
      expect(stamps).toEqual(["Culpable", "Guilty"]);
    });
  });
});

describe("the stamp's stylesheet", () => {
  it("hides it at first sight, from the eye and from the accessibility tree", () => {
    const [base] = rules(".stamp");
    expect(base).toMatch(/visibility:\s*hidden/);
    expect(base).toMatch(/opacity:\s*0;/);
    expect(base).toMatch(/pointer-events:\s*none/);
  });

  it("keeps it out of the flow, so a hidden CULPABLE never widens Dante's plate into a tell", () => {
    const [base] = rules(".stamp");
    expect(base).toMatch(/position:\s*absolute/);
    const [pair] = rules(".culprit");
    expect(pair).toMatch(/position:\s*relative/);
  });

  it("brings it up on a pinned plate and on keyboard focus, and on hover only where a pointer hovers", () => {
    const shown = rules('.plateButton[aria-expanded="true"] + .stamp,\n.plateButton:focus-visible + .stamp');
    expect(shown.some((body) => /visibility:\s*visible/.test(body) && /opacity:\s*1/.test(body))).toBe(true);
    const hover = CSS.match(/@media \(hover: hover\) \{\s*\.plateButton:hover \+ \.stamp \{([^}]*)\}/);
    expect(hover?.[1]).toMatch(/visibility:\s*visible/);
    expect(CSS).not.toMatch(/^\.plateButton:hover \+ \.stamp/m);
  });

  it("animates it only for those who have not asked for reduced motion", () => {
    const outside = CSS.replace(/@media \(prefers-reduced-motion: no-preference\)[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, "");
    const stampRules = [...outside.matchAll(/([^{}]*\.stamp[^{}]*)\{([^}]*)\}/g)];
    expect(stampRules.length).toBeGreaterThan(0);
    for (const [, selector, body] of stampRules) {
      expect(body, selector.trim()).not.toMatch(/transition|animation|scale:/);
    }
  });
});
