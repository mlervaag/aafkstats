import { describe, expect, it } from "vitest";
import { match } from "../src/match.js";
import type { Match } from "../src/match.js";
import { person } from "../src/person.js";
import type { Person } from "../src/person.js";
import { debuts, newcomers, newPlayers, squadKeys, unexplained } from "../src/new-players.js";
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

  it("skiller en ukoblet skrivemåte fra en ukjent person", () => {
    // Kartum-tilfellet: kamptroppen skrev «Sander Erik Kartum», mens personfila
    // het «Sander Kartum» og bar overgangen fra før. Rutinen meldte den gangen
    // at overgangen måtte føres for hånd, og sendte noen ut for å lete etter en
    // opplysning arkivet allerede hadde.
    const kamp = makeMatch({
      lineups: { home: { starters: ["Sander Erik Kartum"], subs: [] } },
    });
    const fila = makePerson({
      id: "sander-kartum",
      name: "Sander Kartum",
      transfers: [{
        id: "inn-hearts-2026",
        direction: "in",
        club: "Hearts",
        date: "2026-09-02",
        providers: [{ providerId: "aafk-no", url: "https://www.aafk.no/nyheter/x" }],
      }],
    });

    const arrival = newPlayers(makeArchive([kamp], [fila]))[0]?.arrival;
    expect(arrival).toMatchObject({
      status: "unlinked",
      personId: "sander-kartum",
      personName: "Sander Kartum",
      // Hele mangelen er koblingen: overgangen ligger der allerede.
      documented: true,
    });
  });

  it("sier ukoblet også når fila mangler overgangen, så arbeidet havner på riktig fil", () => {
    const kamp = makeMatch({
      lineups: { home: { starters: ["Sander Erik Kartum"], subs: [] } },
    });
    const fila = makePerson({ id: "sander-kartum", name: "Sander Kartum" });
    expect(newPlayers(makeArchive([kamp], [fila]))[0]?.arrival)
      .toMatchObject({ status: "unlinked", documented: false });
  });

  it("gjetter ikke når to filer kan være samme mann", () => {
    // To kandidater er ikke et svar. En gjetning her ville slått to personer
    // sammen, som er nettopp det arkivet nekter å gjøre andre steder.
    const kamp = makeMatch({
      lineups: { home: { starters: ["Sander Erik Kartum"], subs: [] } },
    });
    const en = makePerson({ id: "sander-kartum", name: "Sander Kartum" });
    const to = makePerson({ id: "erik-kartum", name: "Erik Kartum" });
    expect(newPlayers(makeArchive([kamp], [en, to]))[0]?.arrival.status).toBe("unknown");
  });

  it("regner ikke to ulike menn med samme etternavn som samme person", () => {
    const kamp = makeMatch({
      lineups: { home: { starters: ["Kari Hansen"], subs: [] } },
    });
    const annen = makePerson({ id: "ole-hansen", name: "Ole Hansen" });
    expect(newPlayers(makeArchive([kamp], [annen]))[0]?.arrival.status).toBe("unknown");
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

describe("newcomers", () => {
  const gammel = makeMatch({
    id: "2024-04-01-aalesunds-fk-molde-fk",
    date: "2024-04-01",
    competition: { id: "eliteserien", season: 2024 },
    lineups: { home: { starters: ["Kari Hansen"], subs: [] } },
  });
  const ny = makeMatch({ lineups: { home: { starters: ["Kari Hansen"], subs: ["Ola Nordmann"] } } });

  it("melder bare dem som ikke sto i en oppstilling fra før", () => {
    const known = squadKeys([gammel]);
    expect(newcomers([ny], [], known).map((player) => player.debut.name)).toEqual(["Ola Nordmann"]);
  });

  it("teller ikke en gammel kamp som hentes inn i etterkant som en ny spiller", () => {
    // Kampen er ny for arkivet, spilleren er ikke ny i troppen. Datoen ville sagt
    // det motsatte av begge deler, og det er derfor nøkkelen avgjør.
    const known = squadKeys([ny]);
    expect(newcomers([gammel], [], known)).toEqual([]);
  });

  it("svarer på overgangsspørsmålet for den nye, ikke bare på at han er ny", () => {
    const folk = [
      makePerson({
        transfers: [
          { id: "inn-hodd-2026", direction: "in", kind: "loan", club: "Hødd", date: "2026-03-01", providers: provider },
        ],
      }),
    ];

    expect(newcomers([ny], folk, squadKeys([gammel]))[0]?.arrival).toMatchObject({
      status: "documented",
      kind: "loan",
    });
  });

  it("regner samme navn i to nye kamper som én ny spiller", () => {
    const senere = makeMatch({
      id: "2026-04-08-aalesunds-fk-sk-brann",
      date: "2026-04-08",
      away: { clubId: "sk-brann", score: 1 },
      lineups: { home: { starters: ["Ola Nordmann"], subs: [] } },
    });

    expect(newcomers([ny, senere], [], new Set())).toHaveLength(2);
    expect(newcomers([ny, senere], [], squadKeys([gammel])).map((p) => p.debut.matchId)).toEqual([ny.id]);
  });
});
