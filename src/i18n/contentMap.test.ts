import { describe, expect, it } from "vitest";
import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";

/**
 * The content map in AGENTS.md: each thing is told in full in one place,
 * and everywhere else gets at most a link or a wink. These rules hold the
 * dictionaries to it, so a section added on its own never retells what
 * another one owns. Baked text (the posters' billing blocks, the city's
 * canvases) is outside the dictionaries and has to follow the map by hand.
 */
type Rule = {
  /** What the rule keeps in its place, for the failure message. */
  subject: string;
  pattern: RegExp;
  /** Key paths where the subject may be said; none means nowhere. */
  owners: RegExp[];
  /** How many times it may be said in one language, owners included. */
  max?: number;
};

const RULES: Rule[] = [
  {
    // The cinema tells the side projects; STATS and the credits name none.
    subject: "a side project's repository",
    pattern: /dotfiles|tessera[\s_-]*studio|project[\s_-]*atlas|expenses[\s_-]*log/i,
    owners: [/^projects\./],
  },
  {
    // The career city tells the jobs in full (`work.*`, still to come); until
    // it lands, STATS' main missions are its index.
    subject: "an employer or a client",
    pattern: /\b(PwC|Cloud District|Logixs|Heuristik|Naturgy|Pangea|Telpark|Bytetravel|Retech)\b/i,
    owners: [/^stats\.missions\.items\./, /^work\./],
  },
  {
    // Tenerife against Gran Canaria is the hero's joke. The map names the
    // island on its inset, and the map's text alternative says what the
    // picture shows, so a screen reader hears the same inset; neither tells
    // the joke. The career city names the army's posting, Las Palmas de
    // Gran Canaria, as a fact (`work.*`); that is not the joke either.
    // "Canarias", the archipelago, is not the joke and is free.
    subject: "Gran Canaria",
    pattern: /\bCanaria\b/i,
    owners: [/^hero\.lines\./, /^stats\.map\.inset\.name$/, /^stats\.map\.label$/, /^work\./],
  },
  {
    // The army is a job like the others: its unit and its service are the
    // career index's and the career city's facts. The hero tells the
    // anecdote without them.
    subject: "the army's unit or service",
    pattern: /Batall[oó]n de Zapadores|Ej[eé]rcito de Tierra|Spanish Army/i,
    owners: [/^stats\.missions\.items\./, /^work\./],
  },
  {
    // Metal Gear's box is its star's wink in STATS's achievement tree, and nowhere else (the map has no hobbies).
    subject: "the cardboard box",
    pattern: /cart[oó]n|cardboard/i,
    owners: [/^stats\.achievements\.nodes\.metalGear\.line$/],
    max: 1,
  },
  {
    // How the jobs were done: the owner lifted his "never remote" rule for the main missions' work-mode
    // labels, «Presencial» / «En remoto», and only for them (career.ts holds each job's mode).
    subject: "remote work",
    pattern: /\bremot|teletrabajo/i,
    owners: [/^stats\.missions\.modes\.remote$/],
    max: 1,
  },
  {
    // Said once, under RACECRAFT on the STATS sheet.
    subject: "from the sofa",
    pattern: /desde el sof[aá]|from the sofa/i,
    owners: [/^stats\.bars\./],
    max: 1,
  },
  {
    // STATS was him off the clock; its card now says the game is paused (Player profile). The words may
    // come back as a wink inside STATS, once at most; the cinema's marquee bills free admission instead.
    subject: "off the clock",
    pattern: /off the clock|fuera de horario/i,
    owners: [/^stats\./],
    max: 1,
  },
  {
    // He has never lived or worked there.
    subject: "Madrid",
    pattern: /Madrid/i,
    owners: [],
  },
];

/** Every string in a dictionary with its key path; array items by index. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => strings(inner, path ? `${path}.${key}` : key));
  }
  return [];
}

const LOCALES = [
  ["en", strings(en)],
  ["es", strings(es)],
] as const;

describe("the content map", () => {
  for (const [locale, copy] of LOCALES) {
    for (const rule of RULES) {
      it(`${locale}: says ${rule.subject} only where the map puts it`, () => {
        const said = copy.filter(([, text]) => rule.pattern.test(text));
        const stray = said
          .filter(([path]) => !rule.owners.some((owner) => owner.test(path)))
          .map(([path, text]) => `${path}: ${text}`);
        expect(stray, `${rule.subject} outside its owner`).toEqual([]);
        if (rule.max !== undefined) {
          const times = said.reduce(
            (sum, [, text]) => sum + (text.match(new RegExp(rule.pattern.source, "gi"))?.length ?? 0),
            0,
          );
          expect(times, `${rule.subject}, times said`).toBeLessThanOrEqual(rule.max);
        }
      });
    }

    // The patterns have to bite: each owner still says what it owns.
    it(`${locale}: still names the side projects in the cinema, the employers and the army's unit in the career index, and the remote jobs as such`, () => {
      const text = (owner: RegExp) =>
        copy
          .filter(([path]) => owner.test(path))
          .map(([, value]) => value)
          .join("\n");
      const cinema = text(/^projects\.posters\./);
      for (const repo of [/dotfiles/i, /tessera[\s_-]*studio/i, /project[\s_-]*atlas/i, /expenses[\s_-]*log/i]) {
        expect(cinema, String(repo)).toMatch(repo);
      }
      const missions = text(/^stats\.missions\.items\./);
      for (const employer of ["PwC", "Cloud District", "Logixs", "Heuristik"]) expect(missions).toContain(employer);
      expect(missions).toMatch(/Batall[oó]n de Zapadores/);
      expect(text(/^hero\.lines\./)).toMatch(/Gran Canaria/);
      expect(text(/^stats\.achievements\.nodes\.metalGear\./)).toMatch(/cart[oó]n|cardboard/i);
      expect(text(/^stats\.bars\./)).toMatch(/desde el sof[aá]|from the sofa/i);
      expect(text(/^stats\.missions\.modes\./)).toMatch(/remot/i);
    });
  }
});
