import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  enrichFromDetails,
  normalizeLeagueMatch,
  parseMinute,
  readStats,
} from "../src/adapters/fotmob.js";
import type { RawLeagueMatch, RawMatchDetails } from "../src/adapters/fotmob.js";

const fixture = <T>(name: string): T => JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures", name), "utf8"),
) as T;

describe("FotMob-adapter", () => {
  it("normaliserer en ligakamp med numeriske kilde-ID-er", () => {
    const match = normalizeLeagueMatch(fixture<RawLeagueMatch>("fotmob-league-match.json"), "203", 2024);
    expect(match).toMatchObject({
      externalId: "4385655",
      date: "2024-04-01",
      kickoff: "17:00",
      status: "played",
      home: { externalId: "8404", name: "Aalesund" },
      away: { externalId: "9918", name: "Stabæk" },
      homeScore: 1,
      awayScore: 1,
      round: 1,
    });
    expect(match?.externalId).not.toBe("undefined");
  });

  it("tolker ikke 0–0 på en framtidig kamp som et resultat", () => {
    const raw = fixture<RawLeagueMatch>("fotmob-league-match.json");
    raw.status = { ...raw.status, finished: false, scoreStr: "0 - 0" };
    const match = normalizeLeagueMatch(raw, "203", 2025);
    expect(match).toMatchObject({ status: "scheduled" });
    expect(match?.homeScore).toBeUndefined();
    expect(match?.awayScore).toBeUndefined();
  });

  it("bevarer tilleggstid som minute og stoppage", () => {
    expect(parseMinute("90+2", undefined)).toEqual({ minute: 90, stoppage: 2 });
    expect(parseMinute(45, 3)).toEqual({ minute: 45, stoppage: 3 });
    expect(parseMinute("–", undefined)).toBeUndefined();
  });

  it("leser detaljer uten å gjøre straffekonkurransen til ordinære mål", () => {
    const match = normalizeLeagueMatch(fixture<RawLeagueMatch>("fotmob-league-match.json"), "203", 2024)!;
    enrichFromDetails(match, fixture<RawMatchDetails>("fotmob-match-details.json"));
    expect(match.attendance).toBe(3944);
    expect(match.homeHalfTime).toBe(0);
    expect(match.events).toHaveLength(3);
    expect(match.events?.[1]).toMatchObject({ type: "substitution", player: "Sebastian Olderheim", playerOff: "Chris Hegardt" });
    expect(match.events?.[2]).toMatchObject({ type: "goal", minute: 90, stoppage: 2 });
    expect(match.stats?.home).toMatchObject({ possession: 53, shots: 19, xg: 1.42 });
    expect(match.lineups?.home).toMatchObject({ formation: "4-3-3", coach: "Christian Johnsen" });
  });

  it("returnerer ingen statistikk for tomme eller dekorative verdier", () => {
    const sparse: RawMatchDetails = {
      content: {
        stats: {
          Periods: {
            All: {
              stats: [{ title: "Top stats", stats: [{ title: "Total shots", stats: ["–", "-"] }] }],
            },
          },
        },
      },
    };
    expect(readStats(sparse)).toBeUndefined();
  });
});
