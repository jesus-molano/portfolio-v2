import { describe, expect, it } from "vitest";
import { tokensToCssVariables } from "@/design/tokens";
import { badgeMarkup, inlineTokens } from "./stationBadges";
import { formatFrequency, type LogoStyle, OFF, STATIONS } from "./stations";

const LOGOS: { logo: LogoStyle; frequency?: string }[] = [
  ...STATIONS.map((station) => ({ logo: station.logo, frequency: formatFrequency(station.frequency) })),
  { logo: OFF.logo },
];

/** The custom properties the page defines: the tokens, and the faces next/font sets. */
const DEFINED = new Set([...tokensToCssVariables().matchAll(/(--va-[a-z0-9-]+):/g)].map((match) => match[1]));

/** Opening and closing tags in order, for a balance check (self-closing ones skipped). */
function unbalanced(markup: string): string[] {
  const stack: string[] = [];
  const errors: string[] = [];
  for (const [tag, close, name] of markup.matchAll(/<(\/?)([a-zA-Z]+)\b[^<>]*>/g)) {
    if (tag.endsWith("/>")) continue;
    if (!close) stack.push(name);
    else if (stack.pop() !== name) errors.push(tag);
  }
  return [...errors, ...stack];
}

describe("the station badges", () => {
  it("draws one badge per station on the wheel, and radio off", () => {
    expect(LOGOS.map(({ logo }) => logo)).toEqual(["bobsled", "raheem", "manero", "louder", "witness", "tofu", "power"]);
  });

  for (const { logo, frequency } of LOGOS) {
    describe(logo, () => {
      const markup = badgeMarkup(logo, "test", frequency);

      it("is well formed", () => {
        expect(unbalanced(markup)).toEqual([]);
      });

      it("paints only with tokens, set through style", () => {
        expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(markup).not.toMatch(/\b(fill|stroke|stop-color|flood-color)="var\(/);
        expect(markup).not.toMatch(/\bclass=/);
        expect(markup).not.toMatch(/\bfont-family=/);
        for (const [, name] of markup.matchAll(/var\((--[a-z0-9-]+)\)/g)) expect(DEFINED, name).toContain(name);
      });

      it("sets its type only in the radio faces and the site's mono", () => {
        const faces = new Set([...markup.matchAll(/font-family:var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]));
        expect(faces.size > 0).toBe(markup.includes("<text"));
        for (const face of faces) expect(face).toMatch(/^--va-font-(radio-[a-z]+|mono)$/);
      });

      it("prefixes every id, and points only at its own", () => {
        const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id.startsWith("test-")).toBe(true);
        for (const [, ref] of markup.matchAll(/(?:url\(#|href="#)([^)"]+)/g)) expect(ids).toContain(ref);
      });

      it(frequency ? "prints its frequency on the tab" : "has no frequency tab", () => {
        if (frequency) expect(markup).toContain(`>${frequency}</text>`);
        else expect(markup).not.toMatch(/<text/);
      });
    });
  }

  it("keeps two badges on one page apart", () => {
    const a = badgeMarkup("tofu", "a", "107.6");
    const b = badgeMarkup("tofu", "b", "107.6");
    expect(a.replaceAll('"a-', '"b-').replaceAll("#a-", "#b-")).toBe(b);
    expect(b).not.toContain('id="a-');
  });
});

describe("inlineTokens", () => {
  it("moves token paints and faces into one style, after the tag's own", () => {
    expect(inlineTokens('<rect fill="var(--va-radio-tofu)" stroke="url(#x)" style="mix-blend-mode:screen"/>')).toBe(
      '<rect stroke="url(#x)" style="mix-blend-mode:screen;fill:var(--va-radio-tofu)"/>',
    );
    expect(inlineTokens('<text class="fCaps" fill="var(--va-color-ink)">ME</text>')).toBe(
      '<text style="fill:var(--va-color-ink);font-family:var(--va-font-radio-caps);font-weight:900">ME</text>',
    );
  });

  it("leaves a tag without tokens as it was", () => {
    expect(inlineTokens('<circle cx="1" r="2"/>')).toBe('<circle cx="1" r="2"/>');
  });

  it("refuses a face it does not know", () => {
    expect(() => inlineTokens('<text class="fComic">x</text>')).toThrow(/fComic/);
  });
});
