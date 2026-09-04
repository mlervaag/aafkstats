import { describe, expect, it } from "vitest";
import { match } from "../src/match.js";
import type { Match } from "../src/match.js";
import { person } from "../src/person.js";
import type { Person } from "../src/person.js";
import { debuts, newPlayers, unexplained } from "../src/new-players.js";
import type { Archive } from "../src/load.js";

function makeMatch(overrides: Record<string, unknown> = {}): Match & { file: string } {
  const parsed = match.parse({
    id: "2026-04-01-aalesunds-fk-molde-fk",
    date: "2026-04-01",
    status: "played",
    competition: { id: "eliteserien", season: 2026 },
    home: { clubId: "aalesunds-fk", score: 2 },
    away: { clubId: "molde-fk", score: 1 },
    ...overrides,
  });
  return { ...parsed, file: `seasons/${parsed.competition.season}/matches/${parsed.id}.yaml` };
}

function makePerson(overrides: Record<string, unknown> = {}): Person {
  return person.parse({ id: "ola-nordmann", name: "Ola Nordmann", ...overrides });
}

/** Bare feltene kontrollen leser; resten av arkivet er den likegyldig til. */
function makeArchive(matches: (Match & { file: string })[], people: Person[] = []): Archive {
  return { matches, people } as unknown as Archive;
}

const provider = [{ providerId: "wikipedia", url: "https://example.org", retrievedAt: "2026-01-02", fields: ["direction"] }];

describe("debuts", () => {
  it("regner første kamp navnet står i, uansett om det var start eller benk", () => {
    const archive = makeArchive([
      makeMatch({
        id: "2026-04-01-aalesunds-fk-molde-fk",
        date: "2026-04-01",
        lineups: { home: { starters: ["Kari Hansen"], subs: ["Ola Nordmann"] } },
      }),
      makeMatch({
        id: "2026-04-08-aalesunds-fk-sk-brann",
        date: "2026-04-08",
        away: { clubId: "sk-brann", score: 1 },
        lineups: { home: { starters: ["Ola Nordmann", "Kari Hansen"], subs: [] } },
      }),
    ]);

    const found = debuts(archive);
    expect(found.map((entry) => entry.name)).toEqual(["Kari Hansen", "Ola Nordmann"]);
    expect(found.map((entry) => entry.date)).toEqual(["2026-04-01", "2026-04-01"]);
    expect(found.find((entry) => entry.name === "Ola Nordmann")?.role).toBe("bench");
  });

  it("leser vår egen side av oppstillingen, også på bortebane", () => {
    const archive = makeArchive([
      makeMatch({
        id: "2026-04-05-molde-fk-aalesunds-fk",
        date: "2026-04-05",
        home: { clubId: "molde-fk", score: 1 },
        away: { clubId: "aalesunds-fk", score: 2 },
        lineups: {
          home: { starters: ["Motstander Motstandersen"], subs: [] },
          away: { starters: ["Ola Nordmann"], subs: [] },
        },
      }),
    ]);

    expect(debuts(archive).map((entry) => entry.name)).toEqual(["Ola Nordmann"]);
  });

  it("samler skrivemåter av samme navn til én debut", () => {
    const archive = makeArchive([
      makeMatch({
        id: "2026-04-01-aalesunds-fk-molde-fk",
        date: "2026-04-01",
        lineups: { home: { starters: ["Ólafur Gudmundsson"], subs: [] } },
      }),
      makeMatch({
        id: "2026-04-08-aalesunds-fk-sk-brann",
        date: "2026-04-08",
        away: { clubId: "sk-brann", score: 1 },
        lineups: { home: { starters: ["Olafur Gudmundsson"], subs: [] } },
      }),
    ]);

    expect(debuts(archive)).toHaveLength(1);
  });

  it("hopper over kamper uten oppstilling", () => {
    const utenOppstilling = makeMatch({
      id: "1955-06-12-aalesunds-fk-molde-fk",
      date: "1955-06-12",
      competition: { id: "eliteserien", season: 1955 },
    });
    expect(debuts(makeArchive([utenOppstilling]))).toEqual([]);
  });

  it("finner personfila bak navnet, også på en annen skrivemåte", () => {
    const archive = makeArchive(
      [makeMatch({ lineups: { home: { starters: ["Ola Nordman"], subs: [] } } })],
      [makePerson({ names: ["Ola Nordman"] })],
    );

    expect(debuts(archive)[0]?.personId).toBe("ola-nordmann");
  });
});

describe("newPlayers", () => {
  const debutMatch = makeMatch({ lineups: { home: { starters: ["Ola Nordmann"], subs: [] } } });

  it("regner en inngående overgang fra samme sesong som forklaringen", () => {
    const archive = makeArchive([debutMatch], [
      makePerson({
        transfers: [
          { id: "inn-hodd-2026", direction: "in", kind: "transfer", club: "Hødd", date: "2026-02-01", providers: provider },
        ],
      }),
    ]);

    const [player] = newPlayers(archive);
    expect(player?.arrival).toMatchObject({ status: "documented", transferId: "inn-hodd-2026", club: "Hødd" });
    expect(unexplained(newPlayers(archive))).toEqual([]);
  });

  it("godtar vintervinduet, der overgangen er ført på sesongen etter datoen", () => {
    const archive = makeArchive([debutMatch], [
      makePerson({
        transfers: [
          {
            id: "inn-hodd-2025", direction: "in", kind: "transfer", club: "Hødd",
            date: "2025-12-18", season: 2026, providers: provider,
          },
        ],
      }),
    ]);

    expect(newPlayers(archive)[0]?.arrival.status).toBe("documented");
  });

  it("sier fra når den eneste inngående overgangen er etter debuten", () => {
    const archive = makeArchive([debutMatch], [
      makePerson({
        transfers: [
          { id: "inn-hodd-2027", direction: "in", kind: "transfer", club: "Hødd", date: "2027-01-05", providers: provider },
        ],
      }),
    ]);

    expect(newPlayers(archive)[0]?.arrival).toMatchObject({ status: "later", transferId: "inn-hodd-2027" });
  });

  it("teller en utgående overgang som ingen forklaring", () => {
    const archive = makeArchive([debutMatch], [
      makePerson({
        transfers: [
          { id: "ut-hodd-2026", direction: "out", kind: "transfer", club: "Hødd", date: "2026-08-01", providers: provider },
        ],
      }),
    ]);

    expect(newPlayers(archive)[0]?.arrival.status).toBe("undocumented");
  });

  it("skiller et navn uten personfil fra en personfil uten overgang", () => {
    const utenFil = makeArchive([debutMatch]);
    expect(newPlayers(utenFil)[0]?.arrival.status).toBe("unknown");

    const utenOvergang = makeArchive([debutMatch], [makePerson()]);
    expect(newPlayers(utenOvergang)[0]?.arrival.status).toBe("undocumented");
  });

  it("begrenser til vinduet rutinen spør om", () => {
    const archive = makeArchive([
      makeMatch({
        id: "2024-04-01-aalesunds-fk-molde-fk",
        date: "2024-04-01",
        competition: { id: "eliteserien", season: 2024 },
        lineups: { home: { starters: ["Gammel Spiller"], subs: [] } },
      }),
      debutMatch,
    ]);

    expect(newPlayers(archive, { since: "2026-01-01" }).map((p) => p.debut.name)).toEqual(["Ola Nordmann"]);
    expect(newPlayers(archive, { season: 2024 }).map((p) => p.debut.name)).toEqual(["Gammel Spiller"]);
    expect(newPlayers(archive)).toHaveLength(2);
  });
});
