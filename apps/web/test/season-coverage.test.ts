import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadSeason, loadSeasonCoverage, loadSeasonDetailLevel, loadSeasonYears } from "../lib/archive.js";

const previousDbPath = process.env.AAFK_DB_PATH;
let databaseDir: string;

beforeAll(async () => {
  databaseDir = mkdtempSync(join(tmpdir(), "aafk-season-coverage-"));
  const dbPath = join(databaseDir, "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 60_000);

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
  rmSync(databaseDir, { recursive: true, force: true });
});

describe("hva dekningsmerket kan si", () => {
  /**
   * Merket skrev «5 kjente kamper» for 1955. Sluttabellen i det samme arkivet
   * sier at AaFK spilte fjorten den sesongen, og tallet ligger på sesongraden.
   * Nevneren fantes, den ble bare ikke brukt.
   */
  it("kjenner nevneren for en sesong uten rundetall", () => {
    const season = loadSeason(1955)!;
    const league = season.summaries.find((entry) => entry.competitionId === "forstedivisjon")!;
    expect(league.coverage).toBe("isolated");
    expect(league.played).toBe(5);
    expect(league.expectedMatches).toBe(14);
  });

  /**
   * «Komplett · N av N seriekamper» skal aldri kunne bli «N av null». En sesong
   * uten kjent omfang klassifiseres som `unverified`, ikke `complete`.
   */
  it("har et kjent omfang bak hver komplette sesong", () => {
    const complete = loadSeasonYears()
      .flatMap((year) => (year.primary ? [year.primary] : []))
      .filter((season) => season.coverage === "complete");
    expect(complete.length).toBeGreaterThan(0);
    for (const season of complete) {
      expect(season.expectedMatches).toBe(season.played);
    }
  });

  /**
   * Det merket ikke måler. 1982 er en komplett kampliste der ingen av de 22
   * kampene har lagoppstilling eller kampreferat — sesongen er hel og
   * tynn på samme tid, og bare det ene av de to sto på sida.
   */
  it("finner feltene som mangler på hver eneste kamp i en komplett sesong", () => {
    const detail = loadSeasonDetailLevel(1982, "forstedivisjon");
    expect(detail.played).toBe(22);
    expect(detail.missingOnAll).toContain("lineups");
    expect(detail.missingOnAll).not.toContain("referee");
    expect(detail.missingOnAll).not.toContain("attendance");
    expect(detail.missingOnAll).not.toContain("score");
  });

  it("melder ingen mangler på et felt bare noen av kampene savner", () => {
    const detail = loadSeasonDetailLevel(2024, "forstedivisjon");
    expect(detail.played).toBe(30);
    expect(detail.missingOnAll).not.toContain("lineups");
  });
});

describe("hele sesongen, ikke bare serien", () => {
  /**
   * Saken som gjorde at viewet finnes. 2019 hadde hele serien inne og sto som
   * «Komplett», mens cupkvartfinalen mot Viking ligger i arkivet som 1–1 uten
   * straffesparkkonkurranse. Enten mangler neste kamp, eller så mangler
   * resultatet av den siste — uansett er ikke året ferdig kanonisert.
   */
  it("kaller ikke et år komplett når cuprekka ikke er spilt ferdig", () => {
    const coverage = loadSeasonCoverage(2019)!;
    expect(coverage.status).toBe("partial");
    expect(coverage.blocker).toBe("cup_unfinished");
    expect(coverage.cupClosed).toBe(false);

    // Serien er hel; det er bare året som ikke er det.
    const league = loadSeason(2019)!.summaries.find((entry) => entry.competitionId === "forstedivisjon")!;
    expect(league.coverage).toBe("complete");
  });

  /**
   * 2009 slutter på en cupfinale. En finale avslutter rekka uansett hvordan den
   * gikk — AaFK vant den på straffer, og et krav om tap ville feilaktig meldt
   * året som ufullstendig.
   */
  it("regner en finale som slutten på cuprekka", () => {
    const coverage = loadSeasonCoverage(2009)!;
    expect(coverage.cupClosed).toBe(true);
    expect(coverage.status).toBe("complete");
  });

  it("svarer unknown, ikke partial, for et år uten seriesesong i arkivet", () => {
    const coverage = loadSeasonCoverage(1954)!;
    expect(coverage.status).toBe("unknown");
    expect(coverage.blocker).toBe("no_league_season");
  });

  it("holder sesongen som pågår utenfor", () => {
    const ongoing = loadSeasonYears().filter((year) => year.coverage?.status === "in_progress");
    for (const year of ongoing) expect(year.coverage!.scheduled).toBeGreaterThan(0);
  });

  /**
   * Ingen år kan være komplett uten at hver seriesesong det året er det. Testen
   * går fra året til konkurransene, motsatt vei av regelen i viewet.
   */
  it("krever hel serie bak hvert komplette år", () => {
    const complete = loadSeasonYears().filter((year) => year.coverage?.status === "complete");
    expect(complete.length).toBeGreaterThan(0);
    for (const year of complete) {
      const leagues = loadSeason(year.year)!.summaries.filter(
        (entry) => entry.coverage !== "not_applicable",
      );
      expect(leagues.length).toBeGreaterThan(0);
      for (const league of leagues) expect(league.coverage).toBe("complete");
    }
  });
});
