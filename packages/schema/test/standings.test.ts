import { describe, expect, it } from "vitest";
import { standings, standingsPath } from "../src/standings.js";
import { person } from "../src/person.js";

const row = (position: number, name: string, over: Record<string, unknown> = {}) => ({
  position, name, clubId: null,
  played: 10, wins: 5, draws: 2, losses: 3,
  goalsFor: 15, goalsAgainst: 12, points: 17, outcome: "none",
  ...over,
});

const table = (rows: unknown[]) => ({ competitionId: "eliteserien", season: 2023, table: rows });

describe("tabellskjemaet", () => {
  it("godtar en tabell med kildens egne lagnavn", () => {
    const parsed = standings.parse(table([row(1, "Bodø/Glimt"), row(2, "Brann")]));
    expect(parsed.table[0]!.clubId).toBeNull();
    expect(parsed.progression).toEqual([]);
  });

  it("krever at plasseringene er 1 til N uten hull", () => {
    // Et hull betyr at parseren har mistet en rad, og en tabell som mangler et
    // lag ser helt normal ut. RSSSF-sida for 2019 mistet fire rader på et
    // fotnotemerke bak poengsummen.
    const result = standings.safeParse(table([row(1, "A"), row(3, "B"), row(4, "C")]));
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toContain("uten hull");
  });

  it("avviser samme lag to ganger", () => {
    const result = standings.safeParse(table([row(1, "Brann"), row(2, "Brann")]));
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toContain("to ganger");
  });

  it("avviser to rader som peker på samme klubb", () => {
    // To skrivemåter av samme navn er den vanligste måten dette oppstår på.
    const result = standings.safeParse(table([
      row(1, "Kristiansund", { clubId: "kristiansund-bk" }),
      row(2, "Kristiansund BK", { clubId: "kristiansund-bk" }),
    ]));
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toContain("to rader");
  });

  it("avviser en kurve som peker utenfor tabellen", () => {
    const result = standings.safeParse({
      ...table([row(1, "A"), row(2, "B")]),
      progression: [{ round: 1, position: 5, points: 3, played: 1, goalDifference: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toContain("utenfor en tabell med 2 lag");
  });

  it("godtar poeng som ikke er seire ganger tre", () => {
    // To poeng for seier gjaldt til 1987, og poengtrekk finnes. Poengsummen er
    // hentet fra kilden, ikke regnet ut.
    expect(standings.safeParse(table([
      row(1, "A", { wins: 5, draws: 2, points: 12 }),
      row(2, "B", { wins: 4, draws: 3, points: 11 }),
    ])).success).toBe(true);
  });

  it("avviser en tabell med bare ett lag", () => {
    expect(standings.safeParse(table([row(1, "A")])).success).toBe(false);
  });

  it("avviser ukjente felt", () => {
    expect(standings.safeParse({ ...table([row(1, "A"), row(2, "B")]), tabell: [] }).success)
      .toBe(false);
  });
});

describe("standingsPath", () => {
  it("legger tabellen under konkurransen sin", () => {
    expect(standingsPath("eliteserien", 2023)).toBe("standings/eliteserien/2023.yaml");
  });
});

describe("personskjemaet", () => {
  const base = { id: "kjetil-rekdal", name: "Kjetil Rekdal" };

  it("godtar en person med bare navn", () => {
    const parsed = person.parse(base);
    expect(parsed.names).toEqual([]);
    expect(parsed.squadNumbers).toEqual([]);
  });

  it("avviser to draktnummer for samme sesong", () => {
    const result = person.safeParse({
      ...base,
      squadNumbers: [{ season: 2024, number: 7 }, { season: 2024, number: 9 }],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toContain("to draktnummer");
  });

  it("avviser en trenerperiode som slutter før den begynner", () => {
    const result = person.safeParse({ ...base, coachSpells: [{ fromSeason: 2012, toSeason: 2008 }] });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toContain("slutter");
  });

  it("lar en trenerperiode stå åpen", () => {
    // Kilden skriver «2024–» for den som fortsatt har jobben.
    expect(person.parse({ ...base, coachSpells: [{ fromSeason: 2024, toSeason: null }] })
      .coachSpells[0]!.toSeason).toBeNull();
  });

  it("krever at Wikidata-ID-en ser ut som en Wikidata-ID", () => {
    expect(person.safeParse({ ...base, wikidata: "Q1796755" }).success).toBe(true);
    expect(person.safeParse({ ...base, wikidata: "1796755" }).success).toBe(false);
    expect(person.safeParse({ ...base, wikidata: "Q0" }).success).toBe(false);
  });

  it("avviser en posisjon som ikke finnes", () => {
    expect(person.safeParse({ ...base, position: "sweeper" }).success).toBe(false);
  });
});
