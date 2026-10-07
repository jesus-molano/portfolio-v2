import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  ACHIEVEMENTS,
  BRANCHES,
  type Box,
  branchItems,
  branchTally,
  captionBox,
  detailBox,
  edges,
  FIELD,
  formatTally,
  GROUPS,
  isUnlocked,
  labelBox,
  onBranch,
  overlaps,
  ROOT,
  segmentHitsBox,
  SKY,
  type SkyPoint,
  starBox,
  starRadius,
  stepInBranch,
  tally,
  TYPE,
  emUnits,
} from "./achievements";

const DICTS = [
  ["en", en.stats.achievements],
  ["es", es.stats.achievements],
] as const;

/** Every width the sky is drawn at: its narrowest (a short window or 1000 px), 1100, 1440 and the 1680 px cap. */
const SKY_WIDTHS = [TYPE.minSkyPx, 1004, 1180, 1344, 1584];

describe("the achievement tree's data", () => {
  it("counts what it holds: 20 of 30 unlocked, never a number typed in", () => {
    expect(tally()).toEqual({ unlocked: 20, total: 30 });
    expect(branchTally("sport")).toEqual({ unlocked: 6, total: 11 });
    expect(branchTally("games")).toEqual({ unlocked: 4, total: 6 });
    // Marvel, locked, counts in both branches that feed it: neither reads as finished.
    expect(branchTally("film")).toEqual({ unlocked: 5, total: 7 });
    expect(branchTally("series")).toEqual({ unlocked: 5, total: 7 });
    expect(branchTally("crossover")).toEqual({ unlocked: 0, total: 1 });
    for (const place of ["film", "series"] as const) expect(branchItems(place).map((item) => item.id)).toContain("marvel");
    // Every branch has something still locked.
    for (const branch of BRANCHES) {
      const count = branchTally(branch.id);
      expect(count.unlocked, branch.id).toBeLessThan(count.total);
    }
    expect(formatTally("{unlocked}/{total}", tally())).toBe("20/30");
  });

  it("keeps the owner's items where he put them, unlocked and locked", () => {
    const state = (id: (typeof ACHIEVEMENTS)[number]["id"]) => ACHIEVEMENTS.find((item) => item.id === id)!.lock;
    const unlocked = ["ropeBasic", "boxerStep", "run2k", "run5k", "run10k", "f1Dawn", "metalGear", "devilMayCry", "skyrim", "rdr2"] as const;
    const films = ["godfather", "usualSuspects", "pulpFiction", "matrix", "odyssey"] as const;
    const series = ["sopranos", "breakingBad", "betterCallSaul", "peakyBlinders", "chernobyl"] as const;
    for (const id of [...unlocked, ...films, ...series]) expect(state(id), id).toBe("none");
    const locked = ["doubleUnders", "halfMarathon", "marathon", "alonso33", "gta6", "elderScrolls6", "imax", "onePiece"] as const;
    for (const id of locked) expect(state(id), id).toBe("locked");
    expect(ACHIEVEMENTS.map((item) => item.place === "film" && item.id).filter(Boolean).sort()).toEqual([...films, "imax"].sort());
    expect(ACHIEVEMENTS.map((item) => item.place === "series" && item.id).filter(Boolean).sort()).toEqual([...series, "onePiece"].sort());
    // Locked harder than anything: eating like a pig, in SPORT; and Marvel, surrendered.
    expect(state("pig")).toBe("max");
    expect(ACHIEVEMENTS.find((item) => item.id === "pig")?.place).toBe("sport");
    expect(state("marvel")).toBe("surrendered");
    expect(ACHIEVEMENTS.filter((item) => item.lock === "max" || item.lock === "surrendered").map((item) => item.id)).toEqual(["pig", "marvel"]);
  });

  it("marks his two favourites, gold and first from their hubs, and nothing else", () => {
    expect(ACHIEVEMENTS.filter((item) => item.favourite).map((item) => item.id)).toEqual(["godfather", "sopranos"]);
    for (const place of ["film", "series"] as const) {
      const [first] = onBranch(place);
      expect(first.favourite, place).toBe(true);
      expect(first.from).toEqual(["hub"]);
      expect(starRadius(first)).toBeGreaterThan(TYPE.starRadius);
    }
    // The hard locks are drawn at one scale, the biggest in the sky.
    expect(starRadius(ACHIEVEMENTS.find((item) => item.id === "marvel")!)).toBe(starRadius(ACHIEVEMENTS.find((item) => item.id === "pig")!));
  });

  it("branches like a game's tree: every branch forks somewhere, and FILM and SERIES meet in Marvel", () => {
    // A fork: a star (or a hub) that two or more stars grow from, the stars a branch feeds outside it included.
    const forks = (place: "sport" | "games" | "film" | "series") => {
      const sources = branchItems(place).flatMap((item) => item.from.filter((from) => from === "hub" ? item.place === place : true));
      return new Set(sources.filter((from, i) => sources.indexOf(from) !== i));
    };
    for (const place of ["sport", "games", "film", "series"] as const) expect(forks(place).size, place).toBeGreaterThan(0);
    // One Piece hangs off its own path, never on the way to Marvel.
    const toMarvel = new Set<string>();
    const walk = (id: string) => {
      const item = ACHIEVEMENTS.find((a) => a.id === id);
      if (!item) return;
      toMarvel.add(id);
      item.from.forEach(walk);
    };
    walk("marvel");
    expect(toMarvel.has("onePiece")).toBe(false);
    expect(toMarvel.has("godfather") && toMarvel.has("sopranos")).toBe(true);
  });

  it("feeds Marvel from both FILM and SERIES, its only two links, both locked", () => {
    const links = edges().filter((edge) => edge.to === "marvel");
    expect(links.map((edge) => edge.tint).sort()).toEqual(["film", "series"]);
    expect(links.every((edge) => !edge.lit)).toBe(true);
    const marvel = ACHIEVEMENTS.find((item) => item.id === "marvel")!;
    expect(marvel.place).toBe("crossover");
    expect(marvel.from.map((from) => ACHIEVEMENTS.find((item) => item.id === from)?.place).sort()).toEqual(["film", "series"]);
  });

  it("links the player to every hub, every star to what it grows from, and lights a link only into an unlocked star", () => {
    const list = edges();
    const hubs = BRANCHES.filter((branch) => branch.hub).map((branch) => `hub:${branch.id}`);
    expect(list.filter((edge) => edge.from === "root").map((edge) => edge.to)).toEqual(hubs);
    for (const item of ACHIEVEMENTS) {
      const into = list.filter((edge) => edge.to === item.id);
      expect(into, item.id).toHaveLength(item.from.length);
      for (const edge of into) expect(edge.lit, item.id).toBe(isUnlocked(item));
      // Nothing unlocked grows from a locked star.
      if (isUnlocked(item)) for (const from of item.from) if (from !== "hub") expect(isUnlocked(ACHIEVEMENTS.find((a) => a.id === from)!), item.id).toBe(true);
    }
    // The glow goes out from the player: a link is one step deeper than the one before it.
    for (const edge of list) {
      if (edge.from === "root") expect(edge.depth).toBe(0);
      else if (edge.from.startsWith("hub:")) expect(edge.depth, edge.to).toBe(1);
      else expect(edge.depth, edge.to).toBe(list.find((other) => other.to === edge.from)!.depth + 1);
    }
  });

  it("steps along a branch with the arrows, stopping at its ends", () => {
    expect(stepInBranch("ropeBasic", 1)).toBe("boxerStep");
    expect(stepInBranch("ropeBasic", -1)).toBe("ropeBasic");
    expect(stepInBranch("doubleUnders", 1)).toBe("run2k");
    expect(stepInBranch("pig", 1)).toBe("pig");
    expect(stepInBranch("skyrim", 1)).toBe("elderScrolls6");
    expect(stepInBranch("imax", 1)).toBe("imax");
    expect(stepInBranch("godfather", -1)).toBe("godfather");
    expect(stepInBranch("marvel", -1)).toBe("marvel");
  });

  it("lists each branch from its hub out: every star after what it grows from", () => {
    for (const branch of BRANCHES) {
      const list = onBranch(branch.id).map((item) => item.id);
      for (const item of onBranch(branch.id)) {
        for (const from of item.from) if (from !== "hub" && list.includes(from)) expect(list.indexOf(from), item.id).toBeLessThan(list.indexOf(item.id));
      }
    }
  });
});

describe("the achievement tree's copy", () => {
  it("has a title and a line for every star, a name for every branch and constellation, and nothing else", () => {
    for (const [lang, dict] of DICTS) {
      expect(Object.keys(dict.nodes).sort(), lang).toEqual(ACHIEVEMENTS.map((item) => item.id).sort());
      expect(Object.keys(dict.branches).sort(), lang).toEqual(BRANCHES.map((branch) => branch.id).sort());
      expect(Object.keys(dict.groups).sort(), lang).toEqual(GROUPS.map((group) => group.id).sort());
      for (const [id, { title, line }] of Object.entries(dict.nodes)) {
        expect(Array.from(title).length, `${lang} ${id}`).toBeLessThanOrEqual(30);
        expect(Array.from(line).length, `${lang} ${id}`).toBeLessThanOrEqual(56);
        expect(line, `${lang} ${id}`).toMatch(/[.!?)]$/);
      }
      for (const template of [dict.count, dict.branchCount]) {
        expect(template).toContain("{unlocked}");
        expect(template).toContain("{total}");
      }
    }
  });

  it("says what every locked star requires, and only locked stars require anything", () => {
    for (const [lang, dict] of DICTS) {
      const requires = lang === "es" ? /^Requiere: / : /^Requires: /;
      for (const item of ACHIEVEMENTS) expect(requires.test(dict.nodes[item.id].line), `${lang} ${item.id}`).toBe(!isUnlocked(item));
    }
  });

  it("states unlocked and locked in words, and the two hard locks by name", () => {
    expect(es.stats.achievements.status).toEqual({ unlocked: "desbloqueado", locked: "bloqueado" });
    expect(en.stats.achievements.status).toEqual({ unlocked: "unlocked", locked: "locked" });
    expect(es.stats.achievements.hardLocks.surrendered).toBe("rendido");
    expect(en.stats.achievements.hardLocks.surrendered).toBe("surrendered");
    expect(es.stats.achievements.hardLocks.max).toMatch(/bloqueo máximo/i);
  });

  it("keeps the owner's words: the tab, the pig, Marvel, the jump rope and his updates", () => {
    expect(es.stats.tabs[2]).toBe("LOGROS");
    expect(en.stats.tabs[2]).toBe("ACHIEVEMENTS");
    expect(es.stats.achievements.nodes.pig.title).toBe("Dejar de comer como un cerdo");
    expect(es.stats.achievements.nodes.marvel.title).toBe("Estar al día con Marvel");
    expect(es.stats.achievements.nodes.doubleUnders.title).toBe("Double unders");
    expect(es.stats.achievements.nodes.run5k.title).toBe("5 km en 24 min");
    expect(es.stats.achievements.nodes.run10k.title).toBe("10 km en una hora");
    expect(es.stats.achievements.nodes.godfather).toEqual({ title: "El Padrino", line: "Le haré una oferta que no podrá rechazar." });
    expect(en.stats.achievements.nodes.godfather).toEqual({ title: "The Godfather", line: "I'm gonna make him an offer he can't refuse." });
    expect(es.stats.achievements.nodes.sopranos).toEqual({ title: "Los Soprano", line: "Del final, mejor ni hablamos." });
    expect(en.stats.achievements.nodes.sopranos).toEqual({ title: "The Sopranos", line: "Let's not talk about the ending." });
    expect(es.stats.achievements.nodes.odyssey).toEqual({ title: "Ver La Odisea sin ir al baño", line: "Vejiga de acero: confirmada." });
    expect(en.stats.achievements.nodes.odyssey.line).toBe("Bladder of steel: confirmed.");
    expect(es.stats.achievements.nodes.imax).toEqual({ title: "Ver una peli en IMAX de 70 mm", line: "Requiere: un presupuesto que no tengo." });
    expect(en.stats.achievements.nodes.imax).toEqual({ title: "Watch a film in 70mm IMAX", line: "Requires: a budget I don't have." });
    expect(es.stats.achievements.nodes.onePiece.title).toBe("Ponerme al día con One Piece");
    expect(es.stats.achievements.nodes.onePiece.line).toMatch(/Me quedé en Arabasta\.$/);
    expect(en.stats.achievements.nodes.onePiece.line).toMatch(/Stuck in Arabasta\.$/);
    expect(en.stats.achievements.nodes.chernobyl.line).toBe("3.6 roentgen. Not great, not terrible.");
    expect(es.stats.achievements.nodes.chernobyl.line).toMatch(/^3,6 roentgen\./);
    // His own words on the 10 km: he never picks up the phone, so the star never says he does.
    for (const [, dict] of DICTS) expect(JSON.stringify(dict.nodes)).not.toMatch(/móvil|phone(?! booth)/i);
    expect(es.stats.achievements.favourite).toBe("favorita");
    expect(en.stats.achievements.favourite).toBe("favourite");
    for (const [, dict] of DICTS) {
      expect(dict.nodes.metalGear.title).toBe("Metal Gear Solid 3");
      expect(dict.nodes.devilMayCry.title).toBe("Devil May Cry 3");
      expect(dict.nodes.rdr2.title).toBe("Red Dead Redemption 2");
      expect(dict.nodes.gta6.title).toBe("GTA VI");
      expect(dict.nodes.elderScrolls6.title).toBe("The Elder Scrolls VI");
      expect(dict.nodes.elderScrolls6.line).toMatch(/2018/);
      expect(dict.nodes.alonso33.line).toMatch(/2013/);
      expect(dict.nodes.pig.line).toMatch(/\((no encontrada|not found)\)/);
    }
  });
});

/** Every word on the sky, as boxes in its plane, at one width. */
function boxesAt(skyPx: number, dict: (typeof DICTS)[number][1]) {
  const labels = ACHIEVEMENTS.map((item) => {
    const tag = item.lock === "max" || item.lock === "surrendered" ? dict.hardLocks[item.lock] : item.favourite ? dict.favourite : null;
    return { id: item.id, item, box: labelBox(item, dict.nodes[item.id].title, tag, skyPx) };
  });
  const stars = [
    ...ACHIEVEMENTS.map((item) => ({ id: item.id, box: starBox(item.at, starRadius(item)) })),
    { id: "root", box: starBox(ROOT) },
    ...BRANCHES.flatMap((branch) => (branch.hub ? [{ id: `hub:${branch.id}`, box: starBox(branch.hub, 5) }] : [])),
  ];
  // The hubs' names hang under their dots; SPORT's constellations are named in the sky.
  const captions = [
    ...BRANCHES.filter((branch) => branch.caption).map((branch) => {
      const count = branchTally(branch.id);
      return { id: `caption:${branch.id}`, box: captionBox(branch.caption!, `${dict.branches[branch.id]} ${count.unlocked}/${count.total}`, 0, skyPx) };
    }),
    ...GROUPS.map((group) => ({ id: `group:${group.id}`, box: captionBox(group.at, dict.groups[group.id], 0, skyPx) })),
    { id: "player", box: captionBox(ROOT, dict.player, 18, skyPx) },
  ];
  return { labels, stars, captions };
}

const inside = (box: Box) => box.x >= 0 && box.y >= 0 && box.x + box.width <= SKY.width && box.y + box.height <= SKY.height;

/** A title's room in the sky: clear of the sky's edge by this many units. */
const PAD = 10;
const roomy = (box: Box) => box.x >= PAD && box.y >= PAD && box.x + box.width <= SKY.width - PAD && box.y + box.height <= SKY.height - PAD;

describe("the achievement tree's sky", () => {
  it("puts every star, hub and the player inside the sky, clear of each other", () => {
    const points: [string, SkyPoint][] = [
      ["root", ROOT],
      ...BRANCHES.flatMap((branch) => (branch.hub ? [[branch.id, branch.hub] as [string, SkyPoint]] : [])),
      ...ACHIEVEMENTS.map((item) => [item.id, item.at] as [string, SkyPoint]),
    ];
    for (const [id, [x, y]] of points) {
      expect(x > 20 && x < SKY.width - 20 && y > 20 && y < SKY.height - 20, id).toBe(true);
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const [a, p] = points[i];
        const [b, q] = points[j];
        expect(Math.hypot(p[0] - q[0], p[1] - q[1]), `${a} ${b}`).toBeGreaterThan(48);
      }
    }
  });

  for (const [lang, dict] of DICTS) {
    for (const skyPx of SKY_WIDTHS) {
      it(`${lang} at ${skyPx} px: no title on another, on a star, on a name or across a link, and every one inside the sky`, () => {
        const { labels, stars, captions } = boxesAt(skyPx, dict);
        // Titles of two branches keep a full line apart, so two constellations never read as one.
        const lineGap = TYPE.lineHeight * emUnits(skyPx);
        const problems: string[] = [];
        for (const { id, item, box } of labels) {
          if (!roomy(box)) problems.push(`${id} leaves the sky`);
          for (const other of labels) {
            if (other.id < id && overlaps(box, other.box, other.item.place === item.place ? 2 : lineGap)) problems.push(`${id} on ${other.id}`);
          }
          for (const star of stars) if (star.id !== id && overlaps(box, star.box, 2)) problems.push(`${id} on the star ${star.id}`);
          for (const caption of captions) if (overlaps(box, caption.box, 2)) problems.push(`${id} on ${caption.id}`);
          for (const edge of edges()) if (segmentHitsBox(edge.a, edge.b, box)) problems.push(`${id} across ${edge.from}-${edge.to}`);
        }
        for (const caption of captions) {
          if (!inside(caption.box)) problems.push(`${caption.id} leaves the sky`);
          for (const star of stars) {
            if (caption.id === "player" && star.id === "root") continue;
            if (overlaps(caption.box, star.box, 2)) problems.push(`${caption.id} on the star ${star.id}`);
          }
          for (const other of captions) if (other.id < caption.id && overlaps(caption.box, other.box, 2)) problems.push(`${caption.id} on ${other.id}`);
          for (const edge of edges()) if (segmentHitsBox(edge.a, edge.b, caption.box)) problems.push(`${caption.id} across ${edge.from}-${edge.to}`);
        }
        expect(problems).toEqual([]);
      });

      it(`${lang} at ${skyPx} px: opens every star's details inside the sky, never over its own star`, () => {
        const { labels } = boxesAt(skyPx, dict);
        for (const { id, item, box } of labels) {
          const detail = detailBox(item, box, skyPx);
          expect(inside(detail), `${id} ${JSON.stringify(detail)}`).toBe(true);
          expect(overlaps(detail, starBox(item.at, starRadius(item))), id).toBe(false);
        }
      });
    }
  }

  it("keeps the background's specks off the stars, so none reads as one more achievement", () => {
    for (const star of FIELD) {
      for (const item of ACHIEVEMENTS) expect(Math.hypot(star.x - item.at[0], star.y - item.at[1])).toBeGreaterThanOrEqual(26);
    }
    expect(FIELD.length).toBeGreaterThan(60);
  });
});
