import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";

/*
 * Nothing on the hero's frame may move while it is on screen (a layout
 * shift): a box whose content changes keeps the size of its largest content,
 * and swaps flip visibility, never display. scrollux's `shiftless` check
 * measures the same boxes in the browser.
 */
const css = readFileSync(new URL("./Hero.module.css", import.meta.url), "utf8");

/** The stylesheet's rules outside any @media block, as [selector, body]. */
function topLevelRules(source: string): [string, string][] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: [string, string][] = [];
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "{") {
      if (depth === 0) selector = text.slice(start, i).trim();
      depth += 1;
      if (depth === 1) start = i + 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        if (!selector.startsWith("@")) rules.push([selector, text.slice(start, i)]);
        start = i + 1;
      }
    }
  }
  return rules;
}
const rules = topLevelRules(css);
const declared = (sel: RegExp, prop: string) =>
  rules.filter(([s, body]) => sel.test(s) && new RegExp(`(^|;|\\s)${prop}\\s*:`).test(body));
const bodyOf = (selector: string) => rules.find(([s]) => s === selector)?.[1] ?? "";

describe("the hero's frame never shifts", () => {
  it("keeps the camera readout as wide as its widest shot label: every label in one cell, swapped by visibility", () => {
    expect(bodyOf(".hudShot")).toMatch(/display:\s*inline-grid/);
    expect(bodyOf(".hudShotLabel")).toMatch(/grid-area:\s*1\s*\/\s*1/);
    expect(bodyOf(".hudShotLabel")).toMatch(/visibility:\s*hidden/);
    expect(bodyOf(".hudShotLabel[data-current]")).toMatch(/visibility:\s*visible/);
    expect(declared(/hudShot|hudCamera/, "display").map(([s]) => s).sort()).toEqual([".hudCamera", ".hudShot"]);
    // One cell per label, keyed by its text: two equal labels would share a key and both read as current.
    for (const dict of [en, es]) expect(new Set(dict.hero.shots).size).toBe(dict.hero.shots.length);
  });

  it("keeps the title hint's box the size of its largest message: each in a fixed cell, swapped by visibility", () => {
    for (const cls of ["hintLine1", "hintAck", "hintOnward"]) expect(css).toMatch(new RegExp(`\\.${cls}[^{]*\\{[^}]*grid-area:\\s*1\\s*/\\s*1`));
    for (const cls of ["hintLine2", "hintArriving"]) expect(css).toMatch(new RegExp(`\\.${cls}[^{]*\\{[^}]*grid-area:\\s*2\\s*/\\s*1`));
    expect(bodyOf(".hintBox")).toMatch(/display:\s*grid/);
    // No state of the hint (data-prompt, data-naming) changes what is laid out: only what shows.
    expect(declared(/\.hint\[data-prompt|\[data-naming\]/, "display").map(([s]) => s)).toEqual([]);
    for (const cls of ["hintAck", "hintOnward", "hintArriving"]) expect(bodyOf(`.${cls}`)).not.toMatch(/display:\s*none/);
    // The answer alone stands in the box's middle by a translate (no layout), half a second-row line and the gap.
    expect(bodyOf('.hint[data-prompt="ack"]:not([data-naming]) .hintAck')).toMatch(/translate:\s*0 calc\(\(var\(--hint-row2\) \+ 0\.35rem\) \/ 2\)/);
    expect(bodyOf(".hintBox")).toMatch(/row-gap:\s*0\.35rem/);
    expect(bodyOf(".hintBox")).toMatch(/--hint-row2:\s*calc\(0\.8rem \* 1\.5\)/);
    expect(rules.filter(([sel]) => sel === ".hintLine2,\n.hintArriving").map(([, body]) => body).join(";")).toMatch(/font-size:\s*0\.8rem[\s\S]*line-height:\s*1\.5/);
  });

  it("keeps the dash's status one line tall, said or not, so the unit centred with it never moves", () => {
    expect(bodyOf(".status")).toMatch(/(^|[;\s])height:\s*1lh/);
  });
});
