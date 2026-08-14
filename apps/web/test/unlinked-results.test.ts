import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { groupUnlinkedResults } from "../components/UnlinkedResults.js";
import { loadSeason, loadSeasonYears, seasonRank, type SourceResult, type SeasonSummary } from "../lib/archive.js";

const previousDbPath = process.env.AAFK_DB_PATH;
beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-unlinked-results-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);
afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("uavklarte historiske resultater og resultatgrupper", () => {
  it("grupperer kildepåstander med samme resultGroupId", () => {
    const results: SourceResult[] = [
      {
        id: "1920-001",
        sourceId: "nff-arbok-1920",
        season: 1920,
        page: 79,
        opponent: "Rollon",
        opponentClubId: "rollon",
        aafkScore: 4,
        opponentScore: 1,
        result: "S",
        competitionId: "nm",
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: null,
        resultGroupId: "nm-1920-rollon-kvalifisering",
        matchId: null,
        note: null,
      },
      {
        id: "1920-013",
        sourceId: "aalesunds-fotballklub-gjennem-1939-ec28",
        season: 1920,
        page: 84,
        opponent: "Rollon",
        opponentClubId: null,
        aafkScore: 4,
        opponentScore: 1,
        result: "S",
        competitionId: "nm",
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: null,
        resultGroupId: "nm-1920-rollon-kvalifisering",
        matchId: null,
        note: null,
      },
    ];

    const unlinked = groupUnlinkedResults(results);
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]?.key).toBe("nm-1920-rollon-kvalifisering");
    expect(unlinked[0]?.claims).toHaveLength(2);
    expect(unlinked[0]?.agreement).toBe("sources_agree");
  });

  it("viser uenighet når kilder har motstridende resultater innen samme gruppe", () => {
    const results: SourceResult[] = [
      {
        id: "1920-001",
        sourceId: "kilde-1",
        season: 1920,
        page: 10,
        opponent: "Rollon",
        opponentClubId: "rollon",
        aafkScore: 4,
        opponentScore: 1,
        result: "S",
        competitionId: "nm",
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: 1,
        resultGroupId: "gruppe-rollon",
        matchId: null,
        note: null,
      },
      {
        id: "1920-002",
        sourceId: "kilde-2",
        season: 1920,
        page: 20,
        opponent: "Rollon",
        opponentClubId: "rollon",
        aafkScore: 3,
        opponentScore: 1,
        result: "S",
        competitionId: "nm",
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: 1,
        resultGroupId: "gruppe-rollon",
        matchId: null,
        note: null,
      },
    ];

    const unlinked = groupUnlinkedResults(results);
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]?.agreement).toBe("sources_disagree");
    expect(unlinked[0]?.claims.map((c) => c.aafkScore)).toEqual([4, 3]);
  });

  it("slår aldri sammen resultater uten resultGroupId automatisk", () => {
    const results: SourceResult[] = [
      {
        id: "1920-008",
        sourceId: "nff-arbok-1920",
        season: 1920,
        page: 99,
        opponent: "Trygg",
        opponentClubId: null,
        aafkScore: 1,
        opponentScore: 0,
        result: "S",
        competitionId: "treningskamp",
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: null,
        resultGroupId: null,
        matchId: null,
        note: null,
      },
      {
        id: "1920-006",
        sourceId: "aalesunds-fotballklub-gjennem-1939-ec28",
        season: 1920,
        page: 83,
        opponent: "Trygg",
        opponentClubId: null,
        aafkScore: 1,
        opponentScore: 0,
        result: "S",
        competitionId: null,
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: null,
        resultGroupId: null,
        matchId: null,
        note: null,
      },
    ];

    const unlinked = groupUnlinkedResults(results);
    expect(unlinked).toHaveLength(2);
  });

  it("skjuler resultater med matchId fra unlinked-visningen", () => {
    const results: SourceResult[] = [
      {
        id: "1920-004",
        sourceId: "nff-arbok-1920",
        season: 1920,
        page: 99,
        opponent: "Rollon",
        opponentClubId: "rollon",
        aafkScore: 5,
        opponentScore: 1,
        result: "S",
        competitionId: "treningskamp",
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: null,
        resultGroupId: null,
        matchId: "1920-05-16-aalesunds-fk-rollon",
        note: null,
      },
    ];

    const unlinked = groupUnlinkedResults(results);
    expect(unlinked).toHaveLength(0);
  });

  it("laster 1920-sesongen og filtrerer bort koblede kamper fra alle kilder", () => {
    const season = loadSeason(1920);
    expect(season).toBeDefined();
    // Verifiser at ingen rader med matchId returneres i sourceResults
    expect(season!.sourceResults.every((r) => r.matchId === null)).toBe(true);

    // NM-kampene fra 1920 har resultGroupId og grupperes
    const nmGroups = season!.sourceResults.filter((r) => r.resultGroupId?.startsWith("nm-1920-"));
    expect(nmGroups.length).toBe(6); // 3 fra NFF + 3 fra 25-årsboka

    const unlinked = groupUnlinkedResults(season!.sourceResults);
    const nmUnlinked = unlinked.filter((u) => u.key.startsWith("nm-1920-"));
    expect(nmUnlinked).toHaveLength(3);
    for (const u of nmUnlinked) {
      expect(u.claims.length).toBe(2);
      expect(u.agreement).toBe("sources_agree");
    }
  });

  it("rangerer Paivas pokal foran generiske privatkamper", () => {
    const paivas = {
      season: 1920,
      competitionId: "paivas-pokal",
      competitionType: "friendly",
      competition: "Paivas pokal",
      played: 2,
    } as SeasonSummary;

    const treningskamper = {
      season: 1920,
      competitionId: "treningskamper-1920",
      competitionType: "friendly",
      competition: "Privatkamper",
      played: 5,
    } as SeasonSummary;

    const rank = seasonRank(paivas, treningskamper);
    expect(rank).toBeLessThan(0); // paivas kommer foran
  });

  it("teller kun logiske uavklarte resultater i documentedResults i loadSeasonYears", () => {
    const years = loadSeasonYears();
    const y1920 = years.find((y) => y.year === 1920);
    expect(y1920).toBeDefined();
    // 1920 har nå 3 NM-grupper + 5 uavklarte Trygg/Frem/Rollon rader = 8 logiske uavklarte resultater
    const season = loadSeason(1920);
    const unlinked = groupUnlinkedResults(season!.sourceResults);
    expect(y1920!.documentedResults).toBe(unlinked.length);
  });

  it("grupperer 1918 NM mot KFK fra NFF-årboka og 25-årsboka til ett felles oppgjør", () => {
    const season = loadSeason(1918);
    expect(season).toBeDefined();
    const unlinked = groupUnlinkedResults(season!.sourceResults);
    const kfkNm = unlinked.find((u) => u.key === "nm-1918-kfk-runde-1");
    expect(kfkNm).toBeDefined();
    expect(kfkNm?.claims).toHaveLength(2);
    expect(kfkNm?.opponentClubId).toBe("kfk");
  });
});
