import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  enrichFromDetails,
  normalizeLeagueMatch,
  parseMinute,
  readAssist,
  readRound,
  readShootout,
  readStats,
  splitExtraTime,
} from "../src/adapters/fotmob.js";
import type { RawLeagueMatch, RawMatchDetails } from "../src/adapters/fotmob.js";
import type { SourceMatch } from "../src/types.js";

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

describe("målgiver", () => {
  // FotMob sender navnet to steder: assistInput er rent, assistStr er ferdig
  // formatert for skjerm. Leses feil felt, havner «assist by » inni verdien og
  // følger med hele veien ut i API-et og svarene fra spørrefunksjonen.
  it("foretrekker det rene navnefeltet", () => {
    expect(readAssist({ assistStr: "assist by Janus Seehusen", assistInput: "Janus Seehusen" }))
      .toBe("Janus Seehusen");
  });

  it("skreller visningsprefikset når det rene feltet mangler", () => {
    expect(readAssist({ assistStr: "assist by Frederik Elkær" })).toBe("Frederik Elkær");
    expect(readAssist({ assistStr: "målgivende av Ola Nordmann" })).toBe("Ola Nordmann");
  });

  it("gir undefined når det ikke finnes målgiver", () => {
    expect(readAssist({})).toBeUndefined();
    expect(readAssist({ assistStr: "" })).toBeUndefined();
    expect(readAssist({ assistStr: "assist by " })).toBeUndefined();
  });

  it("lar et navn som tilfeldigvis begynner likt være i fred", () => {
    expect(readAssist({ assistStr: "Assistane Diop" })).toBe("Assistane Diop");
  });
});

describe("runde og sluttspillstadium", () => {
  it("leser serierunder som tall", () => {
    expect(readRound(7)).toEqual({ round: 7 });
    expect(readRound("30")).toEqual({ round: 30 });
  });

  // Den farlige saken: «strip alt som ikke er siffer» gjør 1/4 til runde 14 og
  // 1/8 til runde 18, og kampen skrives uten at noe klager.
  it("tolker cupbrøker som stadium, ikke som rundenummer", () => {
    expect(readRound("1/2")).toEqual({ stage: "semi_final" });
    expect(readRound("1/4")).toEqual({ stage: "quarter_final" });
    expect(readRound("1/8")).toEqual({ stage: "round_of_16" });
    expect(readRound("1/16")).toEqual({ stage: "round_of_32" });
  });

  it("kjenner igjen finalen og andre navngitte stadier", () => {
    expect(readRound("final")).toEqual({ stage: "final" });
    expect(readRound("Group A")).toEqual({ stage: "group" });
    expect(readRound("Qualifying round")).toEqual({ stage: "qualifying" });
  });

  it("lar heller runden stå tom enn å gjette på en ukjent form", () => {
    expect(readRound("noe helt annet")).toEqual({});
    expect(readRound(undefined)).toEqual({});
    expect(readRound("")).toEqual({});
  });
});

describe("ekstraomganger", () => {
  // Ekte cupkamp: Hødd–Aalesund 25.05.2011, 1–2 etter ekstraomganger.
  // Mål på 50 (hjemme), 90 (borte) og 120 (borte) → 1–1 etter ordinær tid.
  const cupDetail = () => fixture<RawMatchDetails>("fotmob-cup-aet.json");

  const aetMatch = (): SourceMatch => ({
    externalId: "1011785",
    date: "2011-05-25",
    status: "played",
    rawStatus: "AET",
    home: { externalId: "8417", name: "Hødd" },
    away: { externalId: "8404", name: "Aalesund" },
    homeScore: 1,
    awayScore: 2,
    competitionExternalId: "206",
    competitionName: "Norgesmesterskapet",
    season: 2011,
    fields: [],
  });

  it("skiller stillingen etter 90 fra det som kom i ekstraomgangene", () => {
    const match = aetMatch();
    splitExtraTime(match, cupDetail());
    // Arkivets home.score er ordinær tid; sluttresultatet er score + extraTime.
    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(1);
    expect(match.extraTime).toEqual({ home: 0, away: 1 });
    expect(match.warnings ?? []).toHaveLength(0);
  });

  it("rører ikke kamper som ble avgjort på ordinær tid", () => {
    const match = { ...aetMatch(), rawStatus: "FT" };
    splitExtraTime(match, cupDetail());
    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(2);
    expect(match.extraTime).toBeUndefined();
  });

  // Eldre kamper har ofte hullete hendelseslister. Da skal resultatet stå urørt og
  // kampen sendes til kontroll — en gjettet stilling etter 90 er verre enn ingen.
  it("skriver ingenting når hendelsene ikke forklarer sluttresultatet", () => {
    const match = aetMatch();
    const thin = {
      content: { matchFacts: { events: { events: [{ type: "Goal", time: 50, isHome: true }] } } },
    } as unknown as RawMatchDetails;
    splitExtraTime(match, thin);
    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(2);
    expect(match.extraTime).toBeUndefined();
    expect(match.warnings?.[0]).toMatch(/forklarer ikke sluttresultatet/);
  });
});

describe("straffesparkkonkurranse", () => {
  const base = (): SourceMatch => ({
    externalId: "4182983",
    date: "2023-06-07",
    status: "played",
    rawStatus: "Pen",
    home: { externalId: "8404", name: "Aalesund" },
    away: { externalId: "8468", name: "Brann" },
    homeScore: 3,
    awayScore: 3,
    competitionExternalId: "206",
    competitionName: "Norgesmesterskapet",
    season: 2023,
    fields: [],
  });

  // Den vanlige formen: én oppsummerende hendelse. Uten den blir en cupkamp
  // stående som uavgjort uten at noe forteller hvem som gikk videre.
  it("leser den oppsummerte hendelsen", () => {
    const match = base();
    readShootout(match, {
      content: { matchFacts: { events: { events: [
        { type: "PenaltyShootout", time: 121, penaltyScore: [5, 6] },
      ] } } },
    } as unknown as RawMatchDetails);
    expect(match.penaltyShootout).toEqual({ home: 5, away: 6 });
    expect(match.fields).toContain("penaltyShootout");
  });

  it("teller enkeltspark når oppsummeringen mangler", () => {
    const match = base();
    readShootout(match, {
      content: { matchFacts: { events: { events: [
        { type: "Goal", isHome: true, isPenaltyShootoutEvent: true },
        { type: "Goal", isHome: false, isPenaltyShootoutEvent: true },
        { type: "MissedPenalty", isHome: true, isPenaltyShootoutEvent: true },
        { type: "Goal", isHome: false, isPenaltyShootoutEvent: true },
      ] } } },
    } as unknown as RawMatchDetails);
    expect(match.penaltyShootout).toEqual({ home: 1, away: 2 });
  });

  it("rører ikke kamper uten straffesparkkonkurranse", () => {
    const match = base();
    readShootout(match, {
      content: { matchFacts: { events: { events: [{ type: "Goal", isHome: true, time: 12 }] } } },
    } as unknown as RawMatchDetails);
    expect(match.penaltyShootout).toBeUndefined();
  });
});



