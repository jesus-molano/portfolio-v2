import { describe, expect, it } from "vitest";
import { chapterCard, chapterSpan, mixHex, palette, tailOf, tokensToCssVariables } from "./tokens";

const kebab = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

describe("mixHex", () => {
  it("keeps its two ends and meets them halfway", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    // 127.5 rounds up.
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex(palette.magenta, palette.ink, 0.5)).toBe("#95236f");
  });

  it("mixes each channel on its own and writes every channel with two digits", () => {
    expect(mixHex("#ff0000", "#0000ff", 0.25)).toBe("#bf0040");
    expect(mixHex("#000000", "#100c02", 0.5)).toBe("#080601");
    expect(mixHex("#0a0b0c", "#0a0b0c", 0.3)).toBe("#0a0b0c");
  });
});

describe("tailOf", () => {
  it("turns a band colour toward magenta, then a little toward ink", () => {
    expect(tailOf(palette.orange)).toBe(mixHex(mixHex(palette.orange, palette.magenta, 0.3), palette.ink, 0.105));
    // A tail is the band turned from the light: never lighter than it in any channel but blue (magenta's).
    for (const band of [palette.orange, palette.pink]) {
      const tail = tailOf(band);
      for (const i of [0, 1]) {
        expect(parseInt(tail.slice(1 + 2 * i, 3 + 2 * i), 16)).toBeLessThanOrEqual(parseInt(band.slice(1 + 2 * i, 3 + 2 * i), 16));
      }
    }
  });
});

describe("the chapter cards' tokens", () => {
  it("are #rrggbb colours, the tails and the fold derived from the band, all emitted as --va-chapter-*", () => {
    const css = tokensToCssVariables();
    for (const [key, value] of Object.entries(chapterCard)) {
      expect(value, key).toMatch(/^#[0-9a-f]{6}$/);
      expect(css, key).toContain(`--va-chapter-${kebab(key)}: ${value};`);
    }
    expect(chapterCard.tailStart).toBe(tailOf(chapterCard.bandStart));
    expect(chapterCard.tailMid).toBe(tailOf(chapterCard.bandMid));
    expect(chapterCard.tailEnd).toBe(tailOf(chapterCard.bandEnd));
    expect(chapterCard.fold).toBe(mixHex(palette.magenta, palette.ink, 0.5));
  });

  it("emit the cards' span: rem, capped by the height of a short screen", () => {
    expect(tokensToCssVariables()).toContain(`--va-chapter-span: min(${chapterSpan.rem}rem, ${chapterSpan.perHeight * 100}svh);`);
  });
});
