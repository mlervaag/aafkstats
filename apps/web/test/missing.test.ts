import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadMissingOverview } from "../lib/missing.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-missing-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("den offentlige arbeidskøen", () => {
  it("bruker samme definisjon av spilt som resten av arkivet", () => {
    expect(loadMissingOverview().playedMatches).toBe(11);
  });

  it("teller manglende kampfelt uten å gjøre provider-metadata til en supporteroppgave", () => {
    const missing = loadMissingOverview();
    expect(missing.matchFields).toContainEqual({ field: "report", matches: 10 });
    expect(missing.matchFields).toContainEqual({ field: "venue", matches: 1 });
    expect(missing.matchFields.some((row) => row.field === "providers")).toBe(false);
    for (const row of missing.matchFields) {
      expect(row.matches).toBeLessThanOrEqual(missing.playedMatches);
    }
  });

  it("grupperer historiske resultater og lenker dem til riktig sesong", () => {
    const missing = loadMissingOverview();
    expect(missing.historicalResults).toEqual({
      total: 1,
      seasons: [{ season: 1914, results: 1 }],
    });
  });

  it("samler en uavklart personkonflikt uten å velge kilde", () => {
    const conflicts = loadMissingOverview().unresolvedPeople;
    expect(conflicts.people).toBe(1);
    expect(conflicts.conflicts).toBe(1);
    expect(conflicts.items).toEqual([{
      id: "jan-jonsson",
      name: "Jan Jönsson",
      url: "/personer/jan-jonsson",
      conflicts: 1,
      fields: ["trener.2013"],
    }]);
  });

  it("beholder detaljene som trengs for å kjenne igjen en lagoppstillingskandidat", () => {
    const review = loadMissingOverview().lineupReview;
    expect(review.candidates).toBe(1);
    expect(review.sources).toBe(1);
    expect(review.items[0]).toMatchObject({
      sourceId: "aafk-90-ar-1914-2004",
      url: "/kilder/aafk-90-ar-1914-2004",
      sourceUrl: "https://www.nb.no/items/URN:NBN:no-nb_digibok_2011071108003",
    });
    expect(review.items[0]?.candidates).toEqual([{
      id: "oppstilling-fixture-1914",
      page: "42",
      season: 1914,
      names: ["Fixture Spiller A", "Tor Hogne Aaroey"],
      personIds: ["tor-hogne-aaroy"],
    }]);
  });
});
