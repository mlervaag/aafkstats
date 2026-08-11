import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { getPeople, getPersonById, getPersonRoles, mergeRoleSpells, type PersonRole } from "../lib/people.js";
import { getSourceRoleUsages, getSourceSeasonUsages, getSourceUsages } from "../lib/sources.js";

const previousDbPath = process.env.AAFK_DB_PATH;

/**
 * Kjører mot `data/`, ikke mot fixturen, på samme premiss som
 * packages/schema/test/archive-truths.test.ts: påstandene her handler om
 * virkelige personer og en virkelig publikasjon fra 1939. En fixture ville
 * bestått uansett hva som skjer med de filene som faktisk blir publisert.
 *
 * De øvrige testene her bygger fixture-arkivet i beforeAll. Uten et slikt steg
 * finnes det ingen arkivfil å åpne, og testen feiler før den rekker å si noe om
 * dataene — slik den gjorde i CI etter #73.
 */
beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-people-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("person- og organisasjonsarkivet", () => {
  it("samler kampfolk og historiske ledere i samme register", () => {
    const people = getPeople();
    expect(people.some((person) => person.appearances > 0)).toBe(true);
    expect(people.some((person) => person.role_categories.includes("board"))).toBe(true);
  });

  it("viser Georg Hallers stifter-, spiller-, anleggs-, formanns- og hedersroller", () => {
    const person = getPersonById("georg-haller");
    const roles = getPersonRoles("georg-haller");
    expect(person?.role_count).toBeGreaterThanOrEqual(5);
    expect(roles.map((role) => role.title)).toEqual(expect.arrayContaining([
      "Stifter og første formann",
      "Formann i banekomiteen",
      "Spiller",
      "Formann",
      "Æresmedlem",
    ]));
    expect(roles.every((role) => role.sources.length > 0)).toBe(true);
  });

  it("fører pilotkilden tilbake til roller, sesonger og kamper", () => {
    const id = "aalesunds-fotballklub-gjennem-1939-ec28";
    expect(getSourceRoleUsages(id).length).toBeGreaterThan(0);
    expect(getSourceSeasonUsages(id).length).toBeGreaterThan(0);
    expect(getSourceUsages(id).length).toBeGreaterThan(0);
  });
});

describe("mergeRoleSpells", () => {
  const role = (over: Partial<PersonRole>): PersonRole => ({
    person_id: "sigurd-norve", name: "Sigurd Nørve", role_id: "r", category: "board",
    title: "Formann", body: "Hovedstyret", from_date: "1946", to_date: null,
    sources: [], note: null, ...over,
  });

  it("slår en enkeltårskilde inn i perioden den ligger inni", () => {
    const merged = mergeRoleSpells([
      role({ role_id: "a", from_date: "1946", to_date: "1949", sources: [{ sourceId: "bok" }] }),
      role({ role_id: "b", from_date: "1948", sources: [{ sourceId: "tango", page: "235" }] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ from_date: "1946", to_date: "1949" });
    expect(merged[0]!.sources.map((s) => s.sourceId)).toEqual(["bok", "tango"]);
  });

  it("slår sammenhengende år til én periode", () => {
    const trener = (year: string) => role({ role_id: year, category: "coach", title: "Trener", body: null, from_date: year });
    const merged = mergeRoleSpells([trener("2009"), trener("2010"), trener("2011"), trener("2012")]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ from_date: "2009", to_date: "2012" });
  });

  it("regner tomt organ som hovedstyret", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "lauritz-giske", role_id: "a", from_date: "1953", to_date: "1954", body: "Hovedstyret" }),
      role({ person_id: "lauritz-giske", role_id: "b", from_date: "1954", body: null }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.body).toBe("Hovedstyret");
  });

  it("holder en navngitt komité utenfor hovedstyret", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "per-anker-eriksen", role_id: "a", from_date: "1951", body: null }),
      role({ person_id: "per-anker-eriksen", role_id: "b", from_date: "1952", body: "Banekomiteen" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("holder to organ fra hverandre selv om årene overlapper", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "erling-bjorge", role_id: "a", from_date: "1967", to_date: "1968", body: "Hovedstyret" }),
      role({ person_id: "erling-bjorge", role_id: "b", from_date: "1968", body: "Redaksjonskomiteen" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("beholder et opphold mellom to perioder", () => {
    const merged = mergeRoleSpells([
      role({ role_id: "a", from_date: "1946", to_date: "1949" }),
      role({ role_id: "b", from_date: "1955", to_date: "1957" }),
    ]);
    expect(merged.map((r) => r.from_date)).toEqual(["1946", "1955"]);
  });

  it("lar en åpen periode være åpen", () => {
    const merged = mergeRoleSpells([role({ role_id: "a", from_date: "2024" })]);
    expect(merged[0]!.to_date).toBeNull();
  });
});
