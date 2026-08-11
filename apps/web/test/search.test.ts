import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { parseSearchQuery, searchMatches, searchPeople } from "../lib/search.js";

const previousDbPath = process.env.AAFK_DB_PATH;
let fixtureDbPath: string;

beforeAll(async () => {
  fixtureDbPath = join(mkdtempSync(join(tmpdir(), "aafk-search-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), fixtureDbPath);
  process.env.AAFK_DB_PATH = fixtureDbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("parseSearchQuery", () => {
  it("skiller år og motstander", () => {
    expect(parseSearchQuery("2013 Tromsø")).toEqual({ years: [2013], terms: ["tromsø"] });
  });

  it("beholder vanlige tall som søkeord", () => {
    expect(parseSearchQuery("tapte 6 mål")).toEqual({ years: [], terms: ["tapte", "6", "mål"] });
  });

  it("dedupliserer år", () => {
    expect(parseSearchQuery("2025 2025 Sogndal")).toEqual({ years: [2025], terms: ["sogndal"] });
  });

  it("setter tak på hvor mange ledd ett søk blir", () => {
    // Hvert ord legger tre LIKE-tester med ledende jokertegn til spørringen, og
    // hver av dem er en full gjennomgang av tabellen. Endepunktet er åpent og
    // uten fartsgrense, så uten et tak bestemmer avsenderen arbeidsmengden.
    const parsed = parseSearchQuery("a b c d e f g h i j k l m n o p");
    expect(parsed.terms.length).toBeLessThanOrEqual(6);

    const manyYears = parseSearchQuery("1990 1991 1992 1993 1994 1995 1996 1997 1998");
    expect(manyYears.years.length).toBeLessThanOrEqual(6);
  });

  it("finner alle kamper i et år uten AI", () => {
    expect(searchMatches("2024")).toHaveLength(7);
  });

  it("kombinerer år og motstander", () => {
    const matches = searchMatches("2024 Molde");
    expect(matches).toHaveLength(3);
    expect(matches.every((match) => match.date.startsWith("2024") && match.opponent === "Molde FK")).toBe(true);
  });

  it("finner personer uten AI og tåler manglende diakritiske tegn", () => {
    const people = searchPeople("Jan Jonsson");
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      personId: "jan-jonsson",
      name: "Jan Jönsson",
      url: "/personer/jan-jonsson",
    });
  });

  it("finner personer etter rolle og år", () => {
    const people = searchPeople("trener 2013");
    expect(people.some((person) => person.personId === "jan-jonsson")).toBe(true);
  });

  it("søker i hele personregisteret på under ett sekund", async () => {
    // Det offentlige people-viewet beregner kampaktivitet med flere korrelerte
    // underoppslag per person. Brukt i direktesøket tok det over fire sekunder
    // på dagens arkiv, selv om trefflisten bare trenger navn, rolle og periode.
    const fullDbPath = join(mkdtempSync(join(tmpdir(), "aafk-search-full-")), "archive.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), fullDbPath);
    process.env.AAFK_DB_PATH = fullDbPath;
    try {
      const started = performance.now();
      const people = searchPeople("formann 1961");
      const durationMs = performance.now() - started;
      expect(people.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(1_000);
    } finally {
      process.env.AAFK_DB_PATH = fixtureDbPath;
    }
  }, 30_000);
});
