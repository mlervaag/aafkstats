import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadCoverage, loadMatchIndex, loadNextMatch, loadSeason } from "../lib/archive.js";
import { matchDescription, matchTitle } from "../lib/metadata.js";
import { hasBeenPlayed, statusNote } from "../lib/status.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-status-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

/**
 * De seks statusene ser like ut i dataene og betyr helt ulike ting.
 *
 * Fixturen har én av hver som ikke er en vanlig spilt kamp: en på terminlista,
 * en utsatt, en avlyst, en avbrutt og en avgjort på grønt bord.
 */
describe("kampstatus", () => {
  it("regner bare spilt og grønt bord som spilt", () => {
    expect(hasBeenPlayed("played")).toBe(true);
    expect(hasBeenPlayed("awarded")).toBe(true);
    for (const status of ["scheduled", "postponed", "cancelled", "abandoned"]) {
      expect(hasBeenPlayed(status), status).toBe(false);
    }
  });

  it("gir hver ikke-spilt status sin egen forklaring", () => {
    const labels = ["scheduled", "postponed", "cancelled", "abandoned"].map(
      (status) => statusNote(status)!.label,
    );
    expect(labels).toEqual([
      "Kampen er ikke spilt",
      "Kampen er utsatt",
      "Kampen ble avlyst",
      "Kampen ble avbrutt",
    ]);
    // Fargen står aldri alene. Hver tilstand har et ord som bærer forskjellen.
    expect(new Set(labels).size).toBe(4);
  });

  it("gir ingen statuslinje til en kamp som gikk som den skulle", () => {
    expect(statusNote("played")).toBeUndefined();
    expect(statusNote("awarded")).toBeUndefined();
  });

  it("har alle fem tilstandene i fixturen", () => {
    const statuses = new Set(loadMatchIndex().map((match) => match.status));
    for (const status of ["played", "awarded", "scheduled", "postponed", "cancelled", "abandoned"]) {
      expect(statuses.has(status), status).toBe(true);
    }
  });

  it("holder avlyste og avbrutte kamper utenfor statistikken", () => {
    // De ligger i arkivet fordi de fant sted på terminlista, men de har ingen
    // sluttstilling. Telles de med, blir en sesong lengre enn den var.
    expect(loadCoverage().matches).toBe(11);
    const serien = loadSeason(2005)!.summaries.find((s) => s.competitionId === "eliteserien")!;
    expect(serien.played).toBe(2);
  });

  it("lar ikke en utsatt kamp stå som neste ordinære kamp uten forklaring", () => {
    // Den utsatte kampen i fixturen er 2024-06-16, altså før terminlistekampen
    // i november. Neste kamp skal være den som faktisk skal spilles.
    const next = loadNextMatch("2024-01-01");
    expect(next?.matchId).toBe("2024-11-24-sk-brann-aalesunds-fk");
    expect(next?.status).toBe("scheduled");
  });

  it("beskriver hver tilstand riktig i metadata", () => {
    const base = {
      homeName: "Aalesunds FK",
      awayName: "Molde FK",
      homeScore: null,
      awayScore: null,
      date: "2024-06-16",
      status: "postponed",
      competition: "Eliteserien",
      venue: "Color Line Stadion",
      attendance: null,
    };
    expect(matchDescription(base)).toContain("utsatt");
    expect(matchDescription({ ...base, status: "cancelled" })).toContain("avlyst");
    expect(matchTitle(base)).toContain("mot");
  });
});
