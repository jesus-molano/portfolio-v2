import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import manifest from "../../../public/interlude/manifest.json";
import { CAT_IDS, CULPRIT, lowestHead, parseManifest, placeLineup, PLAYER_ONE, SLOT_IDS } from "./lineup";
import { newSelect, pick, PLAYER_KEY, REDUCED_HOLD_MS, REFUSALS, rememberedChoice, rovingIndex, settle } from "./select";
import { Suspects } from "./Suspects";

const CSS = readFileSync(path.resolve(__dirname, "Suspects.module.css"), "utf8");

/** The text a screen reader takes as an element's name: its text, minus every aria-hidden subtree. */
function accessibleName(html: string): string {
  const VOID = new Set(["img", "source", "br", "input"]);
  let hiddenDepth = 0;
  const stack: boolean[] = [];
  let text = "";
  for (const token of html.match(/<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith("</")) {
      if (stack.pop()) hiddenDepth -= 1;
    } else if (token.startsWith("<")) {
      const tag = token.match(/^<([a-z0-9]+)/i)?.[1]?.toLowerCase() ?? "";
      if (VOID.has(tag) || token.endsWith("/>")) continue;
      const hidden = /aria-hidden="true"/.test(token);
      stack.push(hidden);
      if (hidden) hiddenDepth += 1;
    } else if (hiddenDepth === 0) {
      text += token;
    }
  }
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** One slot's markup in the rendered select. */
function slot(html: string, id: string): string {
  const start = html.indexOf(`data-slot="${id}"`);
  expect(start, id).toBeGreaterThan(0);
  return html.slice(start, html.indexOf("</li>", start));
}

describe("the select's state", () => {
  it("never lets a cat be chosen: each refuses in its own way, for its own time", () => {
    let state = newSelect();
    for (const id of CAT_IDS) {
      const { state: next, effect } = pick(state, id, 1000);
      expect(next.chosen, id).toBe(false);
      expect(effect).toEqual({ type: "refuse", id, kind: REFUSALS[id].kind, ms: REFUSALS[id].ms });
      expect(next.refusing).toEqual({ id, until: 1000 + REFUSALS[id].ms });
      state = next;
    }
    expect(new Set(CAT_IDS.map((id) => REFUSALS[id].kind)).size).toBe(4);
  });

  it("has Dante, the culprit, as the one who attacks", () => {
    expect(CULPRIT).toBe("dante");
    expect(REFUSALS[CULPRIT].kind).toBe("claw");
    expect(CAT_IDS.filter((id) => REFUSALS[id].kind === "claw")).toEqual([CULPRIT]);
    // The twist survives without the stamp: the one who looks least capable of it.
    expect(lowestHead(placeLineup(parseManifest(manifest)))).toBe(CULPRIT);
  });

  it("keeps every cat she tried, once, in slot order", () => {
    let state = newSelect();
    for (const id of ["odin", "kira", "odin", "dante"] as const) state = pick(state, id, 0).state;
    expect(state.tried).toEqual(["kira", "dante", "odin"]);
  });

  it("replays a refusal picked again, and lets the one before it go", () => {
    const first = pick(newSelect(), "tom", 0).state;
    const again = pick(first, "tom", 500).state;
    expect(again.refusing).toEqual({ id: "tom", until: 500 + REFUSALS.tom.ms });
    const other = pick(again, "kira", 600).state;
    expect(other.refusing?.id).toBe("kira");
  });

  it("holds a still refusal a little longer under reduced motion", () => {
    const { effect } = pick(newSelect(), "kira", 0, true);
    expect(effect).toMatchObject({ type: "refuse", ms: Math.max(REFUSALS.kira.ms, REDUCED_HOLD_MS) });
  });

  it("chooses Jesús, once: a second pick is no new choice", () => {
    const { state, effect } = pick(newSelect(), PLAYER_ONE, 0);
    expect(state.chosen).toBe(true);
    expect(effect).toEqual({ type: "choose", first: true });
    expect(pick(state, PLAYER_ONE, 10).effect).toEqual({ type: "choose", first: false });
    // A cat picked after him still refuses, and he stays chosen.
    expect(pick(state, "dante", 20).state.chosen).toBe(true);
  });

  it("settles a refusal once its time has passed", () => {
    const state = pick(newSelect(), "odin", 0).state;
    expect(settle(state, REFUSALS.odin.ms - 1).refusing).not.toBeNull();
    expect(settle(state, REFUSALS.odin.ms).refusing).toBeNull();
  });

  it("moves the focus with the arrows, wrapping, and Home and End; up and down stay the page's", () => {
    expect(rovingIndex(0, "ArrowRight")).toBe(1);
    expect(rovingIndex(4, "ArrowRight")).toBe(0);
    expect(rovingIndex(0, "ArrowLeft")).toBe(4);
    expect(rovingIndex(2, "Home")).toBe(0);
    expect(rovingIndex(2, "End")).toBe(SLOT_IDS.length - 1);
    expect(rovingIndex(2, "ArrowDown")).toBeNull();
    expect(rovingIndex(2, "ArrowUp")).toBeNull();
    expect(rovingIndex(0, "ArrowRight", 0)).toBeNull();
  });

  it("remembers the choice for the visit only as Jesús", () => {
    expect(PLAYER_KEY).toMatch(/^va-/);
    expect(rememberedChoice("jesus")).toBe(true);
    expect(rememberedChoice("kira")).toBe(false);
    expect(rememberedChoice(null)).toBe(false);
  });
});

describe("the select's markup", () => {
  for (const lang of locales) {
    it(`${lang}: five real buttons in line-up order, one tab stop, each named with why it can or cannot be picked`, async () => {
      const dict = (await getDictionary(lang)).suspects;
      const html = renderToStaticMarkup(createElement(Suspects, { dict, lang }));
      const slots = [...html.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1]);
      expect(slots).toEqual([...SLOT_IDS]);
      const buttons = [...html.matchAll(/<button\b([^>]*data-pick[^>]*)>([\s\S]*?)<\/button>/g)];
      expect(buttons).toHaveLength(5);
      expect(buttons.filter(([, attributes]) => /tabindex="0"/.test(attributes))).toHaveLength(1);
      for (const id of SLOT_IDS) {
        const [, attributes] = slot(html, id).match(/<button\b([^>]*)>([\s\S]*?)<\/button>/)!;
        expect(attributes, id).toContain('type="button"');
        const described = attributes.match(/aria-describedby="([^"]+)"/)?.[1];
        expect(html, id).toContain(`id="${described}"`);
        // Named in one string: the plate's block spans read with stray spaces before the punctuation.
        const name = attributes.match(/aria-label="([^"]*)"/)?.[1]?.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
        if (id === PLAYER_ONE) {
          expect(attributes).not.toContain("aria-disabled");
          expect(name).toBe(`${dict.player1.name}, ${dict.player1.alias}. ${dict.player1.why}`);
        } else {
          const cat = dict.cats.find((c) => c.id === id)!;
          expect(attributes, id).toContain('aria-disabled="true"');
          expect(name, id).toBe(`${cat.name}, ${cat.alias}. ${dict.refusals[cat.id as (typeof CAT_IDS)[number]].why}`);
        }
      }
    });

    it(`${lang}: until he is chosen, Tab past the roster lands on a locked stop that says why the story waits`, async () => {
      const dict = (await getDictionary(lang)).suspects;
      const html = renderToStaticMarkup(createElement(Suspects, { dict, lang }));
      const locked = html.match(/<button\b([^>]*data-locked[^>]*)>([\s\S]*?)<\/button>/);
      expect(locked).not.toBeNull();
      expect(locked![1]).toContain('aria-disabled="true"');
      expect(accessibleName(locked![2])).toBe(dict.wall);
      // After the roster, before the way on.
      expect(html.indexOf("data-locked")).toBeGreaterThan(html.lastIndexOf("data-pick"));
      expect(html.indexOf("data-locked")).toBeLessThan(html.indexOf('href="#work"'));
    });

    it(`${lang}: says refusals and the choice in a live region, and the way on is a real link to the main story`, async () => {
      const dict = (await getDictionary(lang)).suspects;
      const html = renderToStaticMarkup(createElement(Suspects, { dict, lang }));
      expect(html).toMatch(/<p class="sr-only" aria-live="polite" data-live="[^"]*"><\/p>/);
      expect(html).toMatch(new RegExp(`<a href="#work"[^>]*>${dict.wayOn}<span[^>]*aria-hidden="true"`));
      // The prompt, the flash and the claw layer are for the eye only.
      for (const marker of ["data-prompt", "data-flash", "data-claw"]) {
        expect(html).toMatch(new RegExp(`<[a-z]+[^>]*${marker}="[^"]*"[^>]*aria-hidden="true"`));
      }
      // The header is the roster's name.
      expect(html).toMatch(/<ul[^>]*aria-labelledby="suspects-select"/);
      expect(html).toContain(`id="suspects-select"`);
    });

    it(`${lang}: stamps no verdict and files no complaint anywhere in the section`, async () => {
      const dict = (await getDictionary(lang)).suspects;
      const html = renderToStaticMarkup(createElement(Suspects, { dict, lang }));
      expect(html).not.toMatch(/Culpable|Guilty|Denuncia|Complaint|aria-expanded/);
    });
  }
});

/** The declarations of every rule whose selector list is exactly `selector`. */
function rules(selector: string, css = CSS): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((match) => match[1]);
}

/** The bodies of every `@media <query> { ... }` block, one after another. */
function media(query: string): string {
  const bodies: string[] = [];
  for (let start = CSS.indexOf(`@media ${query} {`); start >= 0; start = CSS.indexOf(`@media ${query} {`, start + 1)) {
    const open = CSS.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < CSS.length; i += 1) {
      if (CSS[i] === "{") depth += 1;
      if (CSS[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          bodies.push(CSS.slice(open + 1, i));
          break;
        }
      }
    }
  }
  expect(bodies.length, query).toBeGreaterThan(0);
  return bodies.join("\n");
}

describe("the select's stylesheet", () => {
  it("keeps the swap-in renders unseen until a refusal shows them", () => {
    expect(rules(".swap").join("")).toMatch(/opacity:\s*0/);
  });

  it("switches states without reflow: the waiting and chosen words and the foot's two states share one cell", () => {
    expect(rules(".state > span").join("")).toMatch(/grid-area:\s*1 \/ 1/);
    expect(rules(".foot > *").join("")).toMatch(/grid-area:\s*1 \/ 1/);
    expect(rules(".after").join("")).toMatch(/visibility:\s*hidden/);
  });

  it("shows the way on without script, and hides what script would play", () => {
    const none = media("(scripting: none)");
    expect(none).toMatch(/\.after\s*\{\s*visibility:\s*visible/);
    expect(none).toMatch(/\.banner,\s*\.legend\s*\{\s*visibility:\s*hidden/);
  });

  it("plays no turn, nod, duck, lunge or flash under reduced motion: still states instead", () => {
    const reduced = media("(prefers-reduced-motion: reduce)");
    for (const selector of [
      '.slot[data-slot="kira"][data-refusing] .cat',
      '.slot[data-slot="odin"][data-refusing] .cat',
      '.slot[data-slot="tom"][data-refusing] .figIn,\n  .slot[data-slot="dante"][data-refusing] .cat',
    ]) {
      expect(rules(selector, reduced).join(""), selector).toMatch(/animation:\s*none/);
    }
    expect(reduced).toMatch(/\.flash\s*\{\s*display:\s*none/);
    // The choice's slam and fades exist only for those who have not asked for reduced motion.
    expect(media("(prefers-reduced-motion: no-preference)")).toMatch(/data-chosen="fresh"/);
    expect(CSS.replace(/@media \(prefers-reduced-motion: no-preference\)[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, "")).not.toMatch(
      /data-chosen="fresh"\][^{]*\{[^}]*animation/,
    );
  });

  it("brings the cursor up on hover only where a pointer hovers, and always on keyboard focus", () => {
    expect(CSS).toMatch(/\.pick:focus-visible \.cursor,/);
    expect(media("(hover: hover)")).toMatch(/\.pick:hover \.cursor/);
    expect(CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, "")).not.toMatch(/\.pick:hover/);
  });

  it("keeps the way on a 44 px target", () => {
    expect(rules(".wayLink").join("")).toMatch(/min-height:\s*2\.75rem/);
  });
});
