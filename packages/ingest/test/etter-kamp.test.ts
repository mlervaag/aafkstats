import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import { matchesDue, ongoingLeagues } from "../src/etter-kamp.js";

function match(date: string, status: "played" | "scheduled", opponent = "hamarkameratene") {
  return {
    id: `${date}-${opponent}-aalesunds-fk`, date, dateConfidence: "exact" as const, status,
    competition: { id: "eliteserien", season: 2026, stage: "regular_season" as const },
    home: { clubId: opponent, score: null, halfTimeScore: null },
    away: { clubId: "aalesunds-fk", score: null, halfTimeScore: null },
    neutralVenue: false, events: [], externalReports: [], providers: [], sources: [],
    confidence: "probable" as const, conflicts: [], tags: [], aliases: {}, manual: [],
    file: `${date}.yaml`,
  };
}

function archive(matches: ReturnType<typeof match>[]): Archive {
  return {
    clubs: [
      { id: "aalesunds-fk", name: "Aalesunds FK", names: [], country: "NO", aliases: {} },
      { id: "hamarkameratene", name: "Hamarkameratene", names: [], country: "NO", aliases: {} },
    ],
    matches,
    competitions: [
      { id: "eliteserien", name: "Eliteserien", names: [], type: "league", country: "NO", aliases: { fotmob: "59" } },
    ],
    venues: [], providers: [], seasons: [], observations: [], standings: [], people: [],
    contributions: [], sources: [], issues: [],
  } as unknown as Archive;
}

describe("matchesDue", () => {
  it("tar med kampen som ble spilt i dag", () => {
    // Rutinen kjøres om kvelden etter kampen. Et strengt «før i dag» ville gjort
    // nettopp den kjøringen tom, som er den ene kjøringen den finnes for.
    const due = matchesDue(archive([match("2026-08-09", "scheduled")]), "2026-08-09");
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ date: "2026-08-09", opponent: "Hamarkameratene", competitionName: "Eliteserien" });
  });

  it("lar kamper fram i tid stå", () => {
    expect(matchesDue(archive([match("2026-08-16", "scheduled")]), "2026-08-09")).toEqual([]);
  });

  it("bryr seg ikke om kamper arkivet allerede har resultatet for", () => {
    expect(matchesDue(archive([match("2026-08-09", "played")]), "2026-08-09")).toEqual([]);
  });

  it("tar med etterslep, ikke bare gårsdagen", () => {
    // Kjøres rutinen først en uke senere, skal alt som står igjen bli med.
    const due = matchesDue(
      archive([match("2026-08-02", "scheduled", "viking"), match("2026-08-09", "scheduled")]),
      "2026-08-12",
    );
    expect(due.map((entry) => entry.date)).toEqual(["2026-08-02", "2026-08-09"]);
  });

  it("navngir motstanderen uansett hvilken side AaFK spilte på", () => {
    const home = match("2026-08-09", "scheduled");
    home.home = { clubId: "aalesunds-fk", score: null, halfTimeScore: null };
    home.away = { clubId: "hamarkameratene", score: null, halfTimeScore: null };
    expect(matchesDue(archive([home]), "2026-08-09")[0]?.opponent).toBe("Hamarkameratene");
  });
});

describe("ongoingLeagues", () => {
  it("finner seriesesongen som fortsatt har kamper igjen", () => {
    const leagues = ongoingLeagues(archive([match("2026-08-16", "scheduled")]));
    expect(leagues).toEqual([
      { competitionId: "eliteserien", competitionName: "Eliteserien", season: 2026, leagueId: "59" },
    ]);
  });

  it("tar med sesongen selv når AaFK ikke har noe uspilt etterslep", () => {
    // Dette er hele poenget: tabellen flytter seg av andre lags kamper. Søndagen
    // dette ble skrevet falt AaFK en plass en time etter at vår egen kamp var
    // hentet, fordi to andre lag spilte.
    const matches = [match("2026-08-09", "played"), match("2026-08-16", "scheduled")];
    expect(matchesDue(archive(matches), "2026-08-09")).toEqual([]);
    expect(ongoingLeagues(archive(matches))).toHaveLength(1);
  });

  it("slutter av seg selv når siste runde er spilt", () => {
    // Ingen kamper igjen på terminlista, ingen tabell som kan bevege seg.
    expect(ongoingLeagues(archive([match("2026-08-09", "played")]))).toEqual([]);
  });

  it("hopper over en konkurranse uten fotmob-ID framfor å gjette", () => {
    const state = archive([match("2026-08-16", "scheduled")]);
    (state.competitions[0] as { aliases: Record<string, string> }).aliases = {};
    expect(ongoingLeagues(state)).toEqual([]);
  });
});
