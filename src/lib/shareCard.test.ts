import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import plates from "@/features/finale/plates.json";
import { locales } from "@/i18n/config";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { SHARE_CARD, SHARE_CARD_MAX_BYTES, shareCardPath } from "./shareCard";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const PUBLIC = path.join(ROOT, "public");

/** What tools/art/og/build.py made each card from, as it wrote it down. */
type Sources = Record<string, { words: string[]; files: Record<string, string>; card: string }>;

const sha256 = (file: string) => createHash("sha256").update(readFileSync(path.join(ROOT, file))).digest("hex");

/** Width and height from a JPEG's first start-of-frame marker. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.readUInt16BE(0)).toBe(0xffd8);
  let at = 2;
  while (at < bytes.length) {
    const marker = bytes.readUInt16BE(at);
    const length = bytes.readUInt16BE(at + 2);
    // SOF0 to SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  throw new Error("no start-of-frame marker");
}

describe("share cards", () => {
  for (const locale of locales) {
    it(`${locale}: has its card at the size the metadata announces, light enough to send`, () => {
      const bytes = readFileSync(path.join(PUBLIC, shareCardPath(locale)));
      expect(jpegSize(bytes)).toEqual({ width: SHARE_CARD.width, height: SHARE_CARD.height });
      expect(bytes.length).toBeLessThanOrEqual(SHARE_CARD_MAX_BYTES);
    });

    it(`${locale}: was built from the plate, the posters and the words the page has now`, () => {
      const rebuild = "rebuild the cards: python3 tools/art/og/build.py";
      const sources: Sources = JSON.parse(readFileSync(path.join(ROOT, "tools/art/og/sources.json"), "utf8"));
      const made = sources[locale];
      expect(made, rebuild).toBeDefined();
      const { hero } = { en, es }[locale];
      expect(made.words, `${rebuild} (his name or role changed)`).toEqual([hero.name, hero.role]);
      const inputs = [
        `public/finale/night-wide-${locale}.webp`,
        ...plates["night-wide"].cases.map((slot) => `public/finale/poster-${slot.repo.toLowerCase()}-${locale}.webp`),
      ];
      expect(Object.keys(made.files).sort(), rebuild).toEqual(inputs.sort());
      for (const file of inputs) expect(sha256(file), `${rebuild} (${file} changed)`).toBe(made.files[file]);
      expect(sha256(`public${shareCardPath(locale)}`), `${rebuild} (the card was changed by hand)`).toBe(made.card);
    });
  }
});
