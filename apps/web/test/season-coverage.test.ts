import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadSeason, loadSeasonDetailLevel, loadSeasonYears } from "../lib/archive.js";

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
   * kampene har lagoppstilling, dommer eller tilskuertall — sesongen er hel og
   * tynn på samme tid, og bare det ene av de to sto på sida.
   */
  it("finner feltene som mangler på hver eneste kamp i en komplett sesong", () => {
    const detail = loadSeasonDetailLevel(1982, "forstedivisjon");
    expect(detail.played).toBe(22);
    expect(detail.missingOnAll).toContain("lineups");
    expect(detail.missingOnAll).toContain("referee");
    expect(detail.missingOnAll).toContain("attendance");
    expect(detail.missingOnAll).not.toContain("score");
  });

  it("melder ingen mangler på et felt bare noen av kampene savner", () => {
    const detail = loadSeasonDetailLevel(2024, "forstedivisjon");
    expect(detail.played).toBe(30);
    expect(detail.missingOnAll).not.toContain("lineups");
  });
});
