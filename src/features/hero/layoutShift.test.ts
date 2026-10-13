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

  it("keeps the shot's number in one cell too, every number there and the frame showing one: a cut renders nothing in React", () => {
    expect(bodyOf(".hudNo")).toMatch(/display:\s*inline-grid/);
    expect(bodyOf(".hudNoCell")).toMatch(/grid-area:\s*1\s*\/\s*1/);
    expect(bodyOf(".hudNoCell")).toMatch(/visibility:\s*hidden/);
    expect(bodyOf(".hudNoCell[data-current]")).toMatch(/visibility:\s*visible/);
    expect(declared(/hudNo/, "display").map(([s]) => s)).toEqual([".hudNo"]);
    // The frame writes data-current (showShot); a React state for the shot re-rendered the stage and its canvas at every cut.
    const stage = readFileSync(new URL("./HeroStage.tsx", import.meta.url), "utf8");
    expect(stage).toMatch(/data-shot-no/);
    expect(stage).toMatch(/data-shot-label/);
    expect(stage).not.toMatch(/\buseState\b/);
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

describe("the career city's aim corners never shift", () => {
  const work = topLevelRules(readFileSync(new URL("../work/Work.module.css", import.meta.url), "utf8"));
  const reticle = work.filter(([sel]) => sel.startsWith(".reticle"));

  it("moves each corner by a transform in the reticle's container units, never by left or top", () => {
    expect(reticle.find(([sel]) => sel === ".reticle")?.[1]).toMatch(/container-type:\s*size/);
    for (const [sel, body] of reticle) expect(`${sel} { ${body} }`).not.toMatch(/(left|top|right|bottom|inset)\s*:[^;]*var\(--c\d[xy]/);
    for (let i = 0; i < 4; i += 1) {
      const body = reticle.find(([sel]) => sel === `.reticle [data-corner="${i}"]`)?.[1] ?? "";
      expect(body).toMatch(new RegExp(`transform:[^;]*var\\(--c${i}x[^)]*\\)\\s*\\*\\s*1cqw[^;]*var\\(--c${i}y[^)]*\\)\\s*\\*\\s*1cqh`));
    }
    const span = reticle.find(([sel]) => sel === ".reticle span")?.[1] ?? "";
    expect(span).toMatch(/left:\s*0/);
    expect(span).toMatch(/top:\s*0/);
  });
});

describe("the career city's overlays move on the compositor", () => {
  const source = readFileSync(new URL("../work/Work.module.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const work = topLevelRules(source);
  const workBody = (selector: string) => work.find(([sel]) => sel === selector)?.[1] ?? "";

  it("thickens the reading bar under a push by a transform, as the hero's, never by its height (a layout every frame)", () => {
    expect(source).not.toMatch(/height:[^;]*var\(--push/);
    expect(workBody(".subtitle::after")).toMatch(/transform:[^;]*scaleY\([^;]*var\(--push/);
  });

  it("gives the aim's corners layers only while they show, and the opening's cover only while it lifts", () => {
    expect(workBody(".reticle span")).not.toMatch(/will-change/);
    expect(workBody(".reticle[data-visible] span,\n.reticle[data-hint] span")).toMatch(/will-change:\s*transform/);
    expect(workBody(".fade")).not.toMatch(/will-change/);
    expect(workBody(".fade[data-lifting]")).toMatch(/will-change:\s*opacity/);
  });
});

describe("the hero's title, gone", () => {
  it("gives its layers back without leaving the accessibility tree (no visibility: hidden: its heading takes the focus)", () => {
    expect(bodyOf(".title[data-gone],\n.title[data-gone] .letter")).toMatch(/will-change:\s*auto/);
    expect(rules.filter(([sel]) => sel.includes(".title[data-gone]")).map(([, body]) => body).join(";")).not.toMatch(/visibility/);
  });
});
