import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { getPeople, getPersonById, getPersonRoles } from "../lib/people.js";
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
