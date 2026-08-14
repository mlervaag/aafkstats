import { describe, expect, it } from "vitest";
import { groupUnlinkedResults } from "../components/UnlinkedResults";
import { loadSeason, loadSeasonYears, seasonRank, type SourceResult, type SeasonSummary } from "../lib/archive";

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

  it("laster 1920-sesongen og filtrerer bort koblede kamper", () => {
    const season = loadSeason(1920);
    expect(season).toBeDefined();
    // 8 kamper fra nff-arbok-1920 har matchId og skal ikke være i sourceResults
    const matchedNffResults = season!.sourceResults.filter(
      (r) => r.sourceId === "nff-arbok-1920" && r.matchId !== null,
    );
    expect(matchedNffResults).toHaveLength(0);

    // NM-kampene fra 1920 har resultGroupId
    const nmGroups = season!.sourceResults.filter((r) => r.resultGroupId?.startsWith("nm-1920-"));
    expect(nmGroups.length).toBeGreaterThanOrEqual(3);

    const unlinked = groupUnlinkedResults(season!.sourceResults);
    const nmUnlinked = unlinked.filter((u) => u.key.startsWith("nm-1920-"));
    expect(nmUnlinked).toHaveLength(3);
    for (const u of nmUnlinked) {
      expect(u.claims.length).toBeGreaterThanOrEqual(2);
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

  it("teller kun uavklarte resultater i documentedResults i loadSeasonYears", () => {
    const years = loadSeasonYears();
    const y1920 = years.find((y) => y.year === 1920);
    expect(y1920).toBeDefined();
    // documentedResults skal ikke telle de 8 koblede NFF-kampene
    expect(y1920!.documentedResults).toBeLessThan(30);
  });
});
