import { describe, expect, it } from "vitest";
import { eligible, type LoaderTip, TIP_MAX_CHARS } from "@/features/loader/tips";
import { visibleStations } from "@/features/music/stations";
import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";

/** Longest each piece of hero UI copy may be, in characters, so it fits its chip on a phone. */
const CAPS: [RegExp, number][] = [
  [/^intro\.hint/, 34],
  [/^intro\.ack$/, 34],
  [/^intro\.model$/, 40],
  [/^intro\.arriving$/, 40],
  [/^cues\.keepGoing/, 30],
  [/^cues\.hold$/, 32],
  [/^cues\.next/, 12],
  [/^cues\.end/, 16],
  [/^osd\./, 9],
  // The pedal's name and its tag beside it on a long wait.
  [/^pedal\.label$/, 20],
  [/^pedal\.tag$/, 8],
  [/^skipLabel$/, 16],
  [/^skipHurry$/, 12],
  // Under the name: two lines at most on a 320 px phone.
  [/^tagline$/, 66],
];

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, inner]) =>
        Object.entries(flatten(inner, prefix ? `${prefix}.${key}` : key)),
      ),
    );
  }
  return {};
}

describe("hero UI copy", () => {
  const dicts = [
    ["en", en.hero, en.common.cues],
    ["es", es.hero, es.common.cues],
  ] as const;

  it("has the same intro and transport keys in both languages", () => {
    expect(Object.keys(es.hero.intro).sort()).toEqual(Object.keys(en.hero.intro).sort());
    expect(Object.keys(es.hero.osd).sort()).toEqual(Object.keys(en.hero.osd).sort());
    expect(Object.keys(es.common.cues).sort()).toEqual(Object.keys(en.common.cues).sort());
    expect(Object.keys(es.hero.pedal).sort()).toEqual(Object.keys(en.hero.pedal).sort());
  });

  it("names the dash's limiter and its release, and asks with her gesture instead of a WAITING word", () => {
    for (const hero of [en.hero, es.hero]) {
      expect(Object.keys(hero.osd).sort()).toEqual(["clear", "drive", "floored", "limiter", "reverse", "unit"]);
    }
  });

  it("has the same radio keys in both languages, and a callout short enough for its tag", () => {
    expect(Object.keys(flatten(es.radio)).sort()).toEqual(Object.keys(flatten(en.radio)).sort());
    for (const radio of [en.radio, es.radio]) {
      // Three lines at most in the 17rem tag under the music button.
      expect(Array.from(radio.calloutTouch).length).toBeLessThanOrEqual(56);
      expect(Array.from(radio.gesture).length).toBeLessThanOrEqual(56);
    }
  });

  for (const [locale, hero, cues] of dicts) {
    it(`${locale}: keeps every hint, cue and label short enough for its chip`, () => {
      const copy = flatten({
        intro: hero.intro,
        cues,
        osd: hero.osd,
        pedal: hero.pedal,
        skipLabel: hero.skipLabel,
        skipHurry: hero.skipHurry,
        tagline: hero.tagline,
      });
      for (const [key, text] of Object.entries(copy)) {
        const cap = CAPS.find(([pattern]) => pattern.test(key))?.[1];
        if (cap === undefined) continue;
        expect(Array.from(text).length, `${locale} hero.${key}`).toBeLessThanOrEqual(cap);
      }
    });

    it(`${locale}: the tagline never says he drives: she has the wheel`, () => {
      expect(hero.tagline).not.toMatch(/wheel|drive|volante|conduzco|conduce/i);
    });

    it(`${locale}: Skip's accessible name contains its visible label`, () => {
      expect(hero.skipLabel.toLowerCase()).toContain(cues.skip.toLowerCase());
    });

    it(`${locale}: the pedal's accessible name starts with the word its tag shows, and its prompts name it`, () => {
      expect(hero.pedal.label.toLowerCase().startsWith(hero.pedal.tag.toLowerCase())).toBe(true);
      expect(cues.nextPedal).toBe(hero.pedal.tag);
      // Phones learn both ways to drive on the title; after that every prompt speaks her last input.
      expect(hero.intro.hintTouch).toMatch(/pedal/i);
      expect(hero.intro.hintKey).toMatch(/\bW\b/);
    });

    it(`${locale}: the hero never sounds like a video player`, () => {
      const words = /\b(play|plays|pause|rewind|fast.?forward|reproduc\w*|pausa|rebobin\w*)\b/i;
      const copy = flatten({ intro: hero.intro, osd: hero.osd, pedal: hero.pedal, cues, skipHurry: hero.skipHurry });
      for (const [key, text] of Object.entries(copy)) expect(text, key).not.toMatch(words);
    });
  }
});

describe("loading screen copy", () => {
  const locales = [
    ["en", en.loader],
    ["es", es.loader],
  ] as const;
  const tipsOf = (loader: typeof en.loader) => loader.tips as LoaderTip[];
  const stationNames = visibleStations().map((station) => station.name);
  /** Capitals that are not a station's name. */
  const NOT_STATIONS = new Set(["CV"]);
  /** Runs of capitalised words: "MANERO", "ONE LOUDER", "WITNESS ME". */
  const CAPITALS = /\b[A-Z][A-Z.\-]*[A-Z.](?:\s+[A-Z][A-Z.\-]*[A-Z.])*/g;

  it("has the same keys in both languages", () => {
    expect(Object.keys(es.loader).sort()).toEqual(Object.keys(en.loader).sort());
    for (const part of ["labels", "menu", "keys", "panel"] as const) {
      expect(Object.keys(es.loader[part]).sort(), part).toEqual(Object.keys(en.loader[part]).sort());
    }
  });

  it("gives every tip the same kind and conditions in both languages", () => {
    const shape = (tips: LoaderTip[]) => tips.map(({ kind, when }) => ({ kind, when }));
    expect(shape(tipsOf(es.loader))).toEqual(shape(tipsOf(en.loader)));
  });

  for (const [locale, loader] of locales) {
    const tips = tipsOf(loader);

    it(`${locale}: has 10 to 14 tips of 120 characters at most, each with a known kind and conditions`, () => {
      expect(tips.length).toBeGreaterThanOrEqual(10);
      expect(tips.length).toBeLessThanOrEqual(14);
      for (const tip of tips) {
        expect(Array.from(tip.text).length, tip.text).toBeLessThanOrEqual(TIP_MAX_CHARS);
        expect(["tip", "trivia"]).toContain(tip.kind);
        for (const condition of tip.when) expect(["pointer", "touch", "motion"]).toContain(condition);
        expect(loader.labels).toHaveProperty(tip.kind);
      }
    });

    it(`${locale}: opens on a tip for every device, and has a tip for everyone under reduced motion`, () => {
      expect(tips[0].kind).toBe("tip");
      expect(tips[0].when).not.toContain("pointer");
      expect(tips[0].when).not.toContain("touch");
      expect(tips.some((tip) => tip.kind === "tip" && tip.when.length === 0)).toBe(true);
    });

    it(`${locale}: has enough tips for every visitor`, () => {
      const count = (touch: boolean, reducedMotion: boolean) =>
        tips.filter((tip) => eligible(tip, { touch, reducedMotion })).length;
      expect(count(false, false)).toBeGreaterThanOrEqual(10);
      expect(count(true, false)).toBeGreaterThanOrEqual(10);
      expect(count(false, true)).toBeGreaterThanOrEqual(8);
      expect(count(true, true)).toBeGreaterThanOrEqual(8);
    });

    it(`${locale}: names every station on air, as written`, () => {
      const named = new Set<string>();
      for (const tip of tips) {
        for (const [match] of tip.text.matchAll(CAPITALS)) {
          // A full stop after a name ends the sentence, unless the name itself ends in one.
          const run = stationNames.includes(match) ? match : match.replace(/\.$/, "");
          if (NOT_STATIONS.has(run)) continue;
          expect(stationNames, `"${run}" in "${tip.text}"`).toContain(run);
          named.add(run);
        }
      }
      expect([...named].sort()).toEqual([...stationNames].sort());
    });

    it(`${locale}: leaves the hero's own lines to the hero`, () => {
      for (const tip of tips) {
        expect(tip.text).not.toMatch(/Tenerife|Canaria|army|ejército|zapador|\bAI\b|\bIA\b|agent|Friday|viernes/i);
      }
    });

    it(`${locale}: gives away no later section, and promises nothing that is not on the page yet`, () => {
      // The cats and their complaint, STATS (its bars, its map and his favourites), the
      // cinema and the credits keep their own jokes. The career city's tip names no
      // employer: the city tells them.
      const later =
        /(?<!\p{L})(cats?|gatos?|line-?up|rueda de reconocimiento|suspects?|sospechosos?|culprit|culpable|appetite|apetito|stats|estadísticas|Metal Gear|cardboard|cartón|Godfather|Padrino|Sopranos?|Breaking Bad|Pulp Fiction|Matrix|Skyrim|cinema|cine|posters?|carteles?|credits|créditos|employers?|currículum|CV)(?!\p{L})/iu;
      for (const tip of tips) expect(tip.text).not.toMatch(later);
    });

    it(`${locale}: tells the radio's long-press on touch as it is: a still finger off the pedal, the ring, the lift`, () => {
      // touchHold.ts: still within its slop until the ring comes up, opened as it lifts; a finger on
      // the pedal drives and is never a long-press. The radio button is the other way in.
      const words =
        locale === "en"
          ? [/\bstill\b/, /\bpicture\b/, /not the pedal/, /\bring\b/, /\blift\b/, /\bbutton\b/]
          : [/\bquieto\b/, /\bimagen\b/, /no en el pedal/, /\baro\b/, /levántalo/, /\bbotón\b/];
      const radio = tips.filter((tip) => tip.when.includes("touch") && !tip.when.includes("motion"));
      expect(radio).toHaveLength(1);
      for (const word of words) expect(radio[0].text).toMatch(word);
      // Not "hold the picture" alone: a thumb left there while she reads opens nothing.
      expect(radio[0].text).not.toMatch(/press and hold|deja el dedo sobre/i);
    });

    it(`${locale}: keeps the menu's words, its lines and the slow note short`, () => {
      // The three items are one huge word each in the marquee face, on one line.
      for (const item of [loader.menu.newGame, loader.menu.continue, loader.menu.settings]) {
        expect(Array.from(item).length, item).toBeLessThanOrEqual(14);
      }
      // A line under an item holds its lead (or the longest station chip) and its state on a 360 px phone.
      expect(Array.from(`${loader.menu.noMusic} · ${loader.menu.waiting}`).length).toBeLessThanOrEqual(36);
      expect(Array.from(loader.menu.settingsSub).length).toBeLessThanOrEqual(40);
      expect(Array.from(loader.menu.radioOff).length).toBeLessThanOrEqual(16);
      for (const short of [loader.menu.early, loader.menu.withMusic, loader.keys.move, loader.keys.choose, loader.panel.back]) {
        expect(Array.from(short).length, short).toBeLessThanOrEqual(14);
      }
      expect(Array.from(loader.readyShort).length).toBeLessThanOrEqual(32);
      expect(Array.from(loader.slow).length).toBeLessThanOrEqual(TIP_MAX_CHARS);
      expect(Array.from(loader.notYet).length).toBeLessThanOrEqual(TIP_MAX_CHARS);
    });

    it(`${locale}: is a start menu, not a title card: no name and no role on it`, () => {
      const dict = locale === "en" ? en : es;
      const copy = JSON.stringify({ ...loader, tips: undefined });
      expect(copy).not.toContain(dict.hero.name);
      expect(copy).not.toContain(dict.hero.role);
    });

    it(`${locale}: never sounds like a video player`, () => {
      const words = /\b(play|pause|rewind|fast.?forward|reproduc\w*|pausa|rebobin\w*)\b/i;
      const copy = [...Object.values(flatten(loader)), ...tips.map((tip) => tip.text)];
      for (const text of copy) expect(text).not.toMatch(words);
    });
  }
});

describe("not-found page copy", () => {
  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${locale}: titles the 404 with its own heading and his name, never as the home page`, () => {
      expect(dict.notFound.title).toBe(`${dict.notFound.heading} — ${dict.hero.name}`);
      expect(dict.notFound.title).not.toBe(dict.meta.title);
    });
  }
});

/** Same keys, same array lengths, at every depth. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }
  return typeof value;
}

describe("finale copy (projects, credits)", () => {
  it("has the same keys and the same number of lines in both languages", () => {
    expect(shape(es.projects)).toEqual(shape(en.projects));
    expect(shape(es.credits)).toEqual(shape(en.credits));
    expect(shape(es.common)).toEqual(shape(en.common));
  });

  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${locale}: keeps every spoken line within a subtitle card (64 characters)`, () => {
      for (const line of [dict.projects.line, dict.credits.opening, dict.credits.last]) {
        expect(Array.from(line).length, line).toBeLessThanOrEqual(64);
      }
    });

    it(`${locale}: leaves "live" to Heuristik (the LIVE tag is not copy here) and shows no email`, () => {
      const text = JSON.stringify([dict.projects, dict.credits]);
      expect(text).not.toMatch(/\blive\b|en directo/i);
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    });

    it(`${locale}: says "now" only as the cinema says it`, () => {
      const text = JSON.stringify([dict.projects, dict.credits]).replace(/NOW SHOWING/g, "");
      expect(text).not.toMatch(/\b(now|today|hoy|ahora)\b/i);
    });
  }
});

describe("chapter cards (each static section's heading)", () => {
  /** The static sections, in the film's order; the career city adds its own when it lands. */
  const SECTIONS = ["suspects", "stats", "projects", "credits"] as const;
  const graphemes = (text: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;

  it("has a chapter, with a word and a ribbon, for every static section in both languages", () => {
    for (const dict of [en, es]) {
      for (const section of SECTIONS) {
        expect(Object.keys(dict[section].chapter).sort(), section).toEqual(["ribbon", "word"]);
      }
    }
  });

  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${locale}: keeps the word to 13 letters and the ribbon to one line of 22`, () => {
      for (const section of SECTIONS) {
        const { word, ribbon } = dict[section].chapter;
        // THE LATE SHOW and THAT'S A WRAP are 13; SOSPECHOSOS HABITUALES is 22.
        expect(graphemes(word), word).toBeLessThanOrEqual(13);
        expect(Array.from(ribbon).length, ribbon).toBeLessThanOrEqual(22);
        // Stored as read (the card sets the capitals), with the typographic apostrophe.
        expect(word).not.toBe(word.toUpperCase());
        expect(`${word} ${ribbon}`).not.toContain("'");
      }
    });

    it(`${locale}: opens a Spanish exclamation only to close it`, () => {
      for (const section of SECTIONS) {
        const { word } = dict[section].chapter;
        expect(word.includes("¡"), word).toBe(word.includes("!"));
      }
    });
  }

  it("says what the owner chose: a word in the film's voice, the section plainly on the ribbon", () => {
    const cards = (dict: typeof en) => SECTIONS.map((section) => [dict[section].chapter.word, dict[section].chapter.ribbon]);
    expect(cards(es)).toEqual([
      ["La banda", "Sospechosos habituales"],
      ["Pausa", "Ficha del jugador"],
      ["Sesión golfa", "Proyectos personales"],
      ["¡Y corten!", "Créditos y contacto"],
    ]);
    expect(cards(en)).toEqual([
      ["The crew", "The usual suspects"],
      ["Paused", "Player profile"],
      ["The late show", "Side projects"],
      ["That’s a wrap", "Credits and contact"],
    ]);
    // "El conductor" / "The driver" is his role in the credits' cast, not a ribbon.
    expect(es.credits.cast.driver).toBe("El conductor");
    expect(en.credits.cast.driver).toBe("The driver");
  });

  it("opens the career city on the owner's card: the main story, as STATS' main missions, on air since 2018", () => {
    expect(es.work.chapter).toEqual({ word: "Historia principal", ribbon: "Trayectoria · 2018 — LIVE" });
    expect(en.work.chapter).toEqual({ word: "Main story", ribbon: "Career · 2018 — LIVE" });
  });

  it("pays off the hero's last line: the crew it promised", () => {
    expect(en.suspects.chapter.word).toBe("The crew");
    expect(es.suspects.chapter.word).toBe("La banda");
    expect(en.hero.lines.flat().at(-1)).toMatch(/meet the crew/i);
    expect(es.hero.lines.flat().at(-1)).toMatch(/la banda/i);
  });
});

describe("the game's own words", () => {
  // The owner: it is a game (a partida, a scene, an intro), so the experience's own UI never calls
  // the site a film. What really is about films stays: the cinema and its posters, the credits, the
  // achievements and STATS's bars about watching them, the hero's spoken lines.
  const FILM = /pel[ií]cula|\bfilms?\b|\bmovies?\b/i;
  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${locale}: never calls the site a film in the start menu, the intro's help, the settings or the description`, () => {
      const copy = flatten({ loader: dict.loader, intro: dict.hero.intro, settings: dict.stats.settings, description: dict.meta.description });
      for (const [key, text] of Object.entries(copy)) expect(text, key).not.toMatch(FILM);
    });
  }
});
