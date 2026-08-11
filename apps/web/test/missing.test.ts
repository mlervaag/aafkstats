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

  it("holder tomme kandidatlag som tomme i stedet for å dikte oppgaver", () => {
    const missing = loadMissingOverview();
    expect(missing.historicalResults).toEqual({ total: 0, seasons: [] });
    expect(missing.unresolvedPeople).toEqual({ people: 0, conflicts: 0, items: [] });
    expect(missing.lineupReview).toEqual({ candidates: 0, sources: 0, items: [] });
  });
});
