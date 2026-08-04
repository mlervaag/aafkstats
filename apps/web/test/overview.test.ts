import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadCoverage, loadOverview } from "../lib/archive.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-overview-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

/**
 * Forsiden sier «N AaFK-kamper». Terminlista for inneværende sesong ligger i
 * arkivet på lik linje med resten, så uten et skille teller overskriften kamper
 * som ikke er spilt, og «til 2026» henter årstallet fra en kamp i desember.
 *
 * Fixturen har elleve kamper, og én av dem står oppført som `scheduled`.
 */
describe("forsidetallene", () => {
  it("teller bare kamper som har funnet sted", () => {
    const { totals } = loadOverview();
    expect(totals.matches).toBe(10);
    expect(totals.upcoming).toBe(1);
  });

  it("henter siste årstall fra siste spilte kamp, ikke fra terminlista", () => {
    const { totals } = loadOverview();
    // Terminlistekampen i fixturen er 2024-11-24. Den skal ikke være «siste».
    expect(totals.last).toBe("2024-05-02");
  });

  it("holder dekningsnotisen på samme tall som forsiden", () => {
    // De to sto tidligere på hver sin spørring. Da kan de si ulike ting om det
    // samme arkivet på samme side, og en leser har ingen måte å se hvem som lyver.
    expect(loadCoverage().matches).toBe(loadOverview().totals.matches);
    expect(loadCoverage().upcoming).toBe(loadOverview().totals.upcoming);
  });

  it("holder terminlistekampen utenfor konkurransefordelingen også", () => {
    const coverage = loadCoverage();
    const sum = coverage.byCompetition.reduce((total, row) => total + row.matches, 0);
    expect(sum).toBe(coverage.matches);
  });
});
