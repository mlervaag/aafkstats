import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import {
  loadCoverage,
  loadNeighbourSeasons,
  loadNextMatch,
  loadOverview,
  loadSeason,
  loadStandings,
} from "../lib/archive.js";

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

describe("neste kamp", () => {
  it("finner den første kampen som ikke er spilt", () => {
    const next = loadNextMatch("2024-01-01");
    expect(next?.matchId).toBe("2024-11-24-sk-brann-aalesunds-fk");
    expect(next?.kickoff).toBe("17:00");
  });

  it("regner ikke en gammel terminlistekamp som neste kamp", () => {
    // Kampen står som `scheduled` i fixturen, men datoen er passert. Uten
    // datofilteret ville forsiden lovet en kamp som aldri kommer.
    expect(loadNextMatch("2025-01-01")).toBeUndefined();
  });
});

describe("sesongdekning", () => {
  it("teller kampene som står igjen på terminlista", () => {
    const summaries = loadSeason(2024)!.summaries;
    const eliteserien = summaries.find((s) => s.competitionId === "eliteserien")!;
    expect(eliteserien.scheduled).toBe(1);
    // Sesongtallene teller den ikke med. Det er nettopp skillet merket bygger på.
    expect(eliteserien.played + eliteserien.scheduled).toBeGreaterThan(eliteserien.played);
  });
});

describe("naboårene", () => {
  it("hopper over årene arkivet ikke har", () => {
    // Fixturen har 1998, 2005 og 2024. En lenke til 2004 ville vært en blindvei.
    expect(loadNeighbourSeasons(2005)).toEqual({ previous: 1998, next: 2024 });
  });

  it("gir null i hver ende", () => {
    expect(loadNeighbourSeasons(1998).previous).toBeNull();
    expect(loadNeighbourSeasons(2024).next).toBeNull();
  });
});

describe("sluttabellen", () => {
  it("leser tabellen med kildens lagnavn", () => {
    const { table } = loadStandings("forstedivisjon", 1998);
    expect(table).toHaveLength(5);
    expect(table[0]).toMatchObject({ position: 1, team: "Molde", clubId: "molde-fk", points: 13 });
    // Laget uten klubbfil skal stå der med navn og uten lenke.
    expect(table.at(-1)).toMatchObject({ team: "Eik-Tønsberg", clubId: null, url: null });
  });

  it("regner ut målforskjellen i viewet", () => {
    const { table } = loadStandings("forstedivisjon", 1998);
    expect(table[0]!.goalDifference).toBe(6);
    expect(table.at(-1)!.goalDifference).toBe(-5);
  });

  it("gir sesongen sin sluttplass fra tabellen", () => {
    // core_seasons har feltet, men ingen har fylt det for en eneste sesong.
    // Fixturens season.yaml sier 8. plass; tabellen sier 3., og tabellen vinner.
    const summary = loadSeason(1998)!.summaries.find((s) => s.competitionId === "forstedivisjon")!;
    expect(summary.finalPosition).toBe(3);
  });

  it("gir ingen tabell for en sesong vi ikke har hentet", () => {
    expect(loadStandings("eliteserien", 2024).table).toEqual([]);
  });

  it("leser kurven i rundenes rekkefølge", () => {
    const { progression } = loadStandings("forstedivisjon", 1998);
    expect(progression.map((p) => p.round)).toEqual([1, 2, 3, 4, 5, 6]);
    // Siste punkt skal stemme med tabellraden. Det er hele kontrakten kurven
    // slipper gjennom innhøstingen på.
    expect(progression.at(-1)).toMatchObject({ position: 3, points: 8, played: 6 });
  });
});
