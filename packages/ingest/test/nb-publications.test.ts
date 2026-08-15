import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import type { Match, Source } from "@aafkstats/schema";
import { altoLines, candidatesForPage } from "../src/adapters/nb-publications.js";

describe("NB-publikasjonsuttrekk", () => {
  it("leser tekstlinjer fra ALTO uten å bevare XML", () => {
    const xml = `<alto><Layout><TextLine><String CONTENT="Nils"/><SP/><String CONTENT="Jangaard"/></TextLine><TextLine><String CONTENT="formann"/></TextLine></Layout></alto>`;
    expect(altoLines(xml)).toEqual(["Nils Jangaard", "formann"]);
  });

  it("lager kildebelagte faktatokens for kjente personer og verv", () => {
    const archive = {
      people: [{ id: "nils-jangaard", name: "Nils Jangaard", names: [] }],
      matches: [],
      clubs: [],
    } as unknown as Archive;
    const source = { id: "testkilde", title: "Test", sourceType: "book", year: 1950, providers: [] } satisfies Source;
    const candidates = candidatesForPage(archive, source, "4", ["Formann Nils Jangaard 1950"]);
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "person_role", page: "4", personIds: ["nils-jangaard"], years: [1950], keywords: ["formann"] }),
    ]));
  });

  it("fanger opp kampresultater over to linjer i medlemsblad", () => {
    const archive = {
      people: [],
      matches: [
        {
          id: "1962-09-02-sk-brann-aalesunds-fk",
          competition: { season: 1962, id: "nm" },
          home: { clubId: "sk-brann", score: 0 },
          away: { clubId: "aalesunds-fk", score: 0 },
        },
      ],
      clubs: [{ id: "sk-brann", name: "Brann", shortName: "Brann", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1962",
      title: "Medlemsblad 1962",
      sourceType: "member_magazine",
      year: 1962,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "50", [
      "I Bergen mot Brann",
      "ble sluttresultatet 0–0",
    ]);

    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "match_result",
        page: "50",
        scores: ["0-0"],
        matchIds: ["1962-09-02-sk-brann-aalesunds-fk"],
      }),
    ]));
  });

  it("lager match_result-kandidat uten matchIds dersom kampen ikke finnes i kanonisk arkiv", () => {
    const archive = {
      people: [],
      matches: [],
      clubs: [{ id: "herd", name: "Herd", shortName: "Herd", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1962",
      title: "Medlemsblad 1962",
      sourceType: "member_magazine",
      year: 1962,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "59", [
      "Privatkamp mot Herd endte 1–0",
    ]);

    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "match_result",
        page: "59",
        scores: ["1-0"],
        matchIds: [],
      }),
    ]));
  });

  it("terminliste uten resultat genererer ikke match_result-kandidat, men genererer fixture_list-kandidat", () => {
    const archive = {
      people: [],
      matches: [],
      clubs: [{ id: "hodd", name: "Hødd", shortName: "Hødd", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1962",
      title: "Medlemsblad 1962",
      sourceType: "member_magazine",
      year: 1962,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "27", [
      "Terminliste for vårsesongen:",
      "29. april: Hødd mot AaFK på Høddvoll",
    ]);

    const matchResults = candidates.filter((c) => c.kind === "match_result");
    expect(matchResults).toHaveLength(0);

    const fixtureLists = candidates.filter((c) => c.kind === "fixture_list");
    expect(fixtureLists.length).toBeGreaterThan(0);
    expect(fixtureLists[0]).toMatchObject({
      kind: "fixture_list",
      page: "27",
      keywords: ["terminliste"],
    });
  });

  it("historisk tilbakeblikk på 1947 i et 1962-blad matches ikke mot 1962-kamp", () => {
    const archive = {
      people: [],
      matches: [
        {
          id: "1962-05-13-aalesunds-fk-clausenengen",
          competition: { season: 1962, id: "forstedivisjon" },
          home: { clubId: "aalesunds-fk", score: 7 },
          away: { clubId: "clausenengen", score: 0 },
        },
      ] as unknown as Match[],
      clubs: [{ id: "clausenengen", name: "Clausenengen", shortName: "Clausenengen", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1962",
      title: "Medlemsblad 1962",
      sourceType: "member_magazine",
      year: 1962,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "10", [
      "Vi blar i minnenes bok fra 1947 da vi møtte Clausenengen og vant 7–0",
    ]);

    const matchResult = candidates.find((c) => c.kind === "match_result");
    expect(matchResult).toBeDefined();
    // 1947-omtalen skal ikke få kobling til 1962-kampen
    expect(matchResult?.matchIds).toEqual([]);
    expect(matchResult?.years).toEqual([1947]);
  });

  it("speilvendt resultat kobles aldri automatisk mot eksisterende kamp", () => {
    const archive = {
      people: [],
      matches: [
        {
          id: "1962-06-17-aalesunds-fk-molde-fk",
          competition: { season: 1962, id: "forstedivisjon" },
          home: { clubId: "aalesunds-fk", score: 2 },
          away: { clubId: "molde-fk", score: 0 },
        },
      ] as unknown as Match[],
      clubs: [{ id: "molde-fk", name: "Molde", shortName: "Molde", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1962",
      title: "Medlemsblad 1962",
      sourceType: "member_magazine",
      year: 1962,
      providers: [],
    } satisfies Source;

    // Tekst som speilvender 2–0 til 0–2
    const candidates = candidatesForPage(archive, source, "48", [
      "Molde mot AaFK 0–2",
    ]);

    const matchResult = candidates.find((c) => c.kind === "match_result");
    expect(matchResult).toBeDefined();
    expect(matchResult?.matchIds).toEqual([]);
  });

  it("glidende vindu forårsaker ikke duplikate kandidater for samme linje", () => {
    const archive = {
      people: [{ id: "einar-aas", name: "Einar Aas", names: [] }],
      matches: [],
      clubs: [],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1962",
      title: "Medlemsblad 1962",
      sourceType: "member_magazine",
      year: 1962,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "28", [
      "Oppmann Einar Aas har ordet",
      "Vi ser fram til en god sesong",
    ]);

    const einarMentions = candidates.filter((c) => c.kind === "person_mention" && c.personIds.includes("einar-aas"));
    // uniqueCandidates fjerner duplikater fra overappende vinduer
    expect(einarMentions).toHaveLength(1);
  });

  it("klokkeslett og repeterte kolon-sekvenser forårsaker ikke falske match_result-kandidater", () => {
    const archive = { people: [], matches: [], clubs: [] } as unknown as Archive;
    const source = {
      id: "medlemsblad-1961",
      title: "Medlemsblad 1961",
      sourceType: "member_magazine",
      year: 1961,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "4", [
      "Trening i gymnastikksalen hver torsdag fra kl. 17 til 19:00",
      "Støyblokk: 5:5:5:2:3:5",
    ]);

    const matchResults = candidates.filter((c) => c.kind === "match_result");
    expect(matchResults).toHaveLength(0);
  });

  it("gjenkjenner internasjonal privatkamp mot Canto do Rio på Aksla stadion", () => {
    const archive = {
      people: [],
      matches: [
        {
          id: "1961-07-06-aalesunds-fk-canto-do-rio",
          competition: { season: 1961, id: "treningskamp" },
          home: { clubId: "aalesunds-fk", score: 0 },
          away: { clubId: "canto-do-rio", score: 5 },
        },
      ] as unknown as Match[],
      clubs: [{ id: "canto-do-rio", name: "Canto do Rio Football Club", shortName: "Canto do Rio", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1961",
      title: "Medlemsblad 1961",
      sourceType: "member_magazine",
      year: 1961,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "31", [
      "Aksla Stadion 6. juli: Canto do Rio mot ÅFK 5–0",
    ]);

    const matchResult = candidates.find((c) => c.kind === "match_result");
    expect(matchResult).toBeDefined();
    expect(matchResult?.scores).toEqual(["5-0"]);
  });

  it("kompakt kolon (3:1) fanges ikke opp som resultat — for mange falske positiver i OCR-støy og klokkeslett", () => {
    const archive = {
      people: [],
      matches: [],
      clubs: [{ id: "herd", name: "Herd", shortName: "Herd", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1961",
      title: "Medlemsblad 1961",
      sourceType: "member_magazine",
      year: 1961,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "50", [
      "AaFK slo Herd 3:1 på Aksla stadion",
    ]);

    const matchResults = candidates.filter((c) => c.kind === "match_result");
    expect(matchResults).toHaveLength(0);
  });

  it("kolon med mellomrom (3 : 1) gjenkjennes som resultat", () => {
    const archive = {
      people: [],
      matches: [],
      clubs: [{ id: "herd", name: "Herd", shortName: "Herd", names: [] }],
    } as unknown as Archive;
    const source = {
      id: "medlemsblad-1961",
      title: "Medlemsblad 1961",
      sourceType: "member_magazine",
      year: 1961,
      providers: [],
    } satisfies Source;

    const candidates = candidatesForPage(archive, source, "50", [
      "AaFK slo Herd 3 : 1 på Aksla stadion",
    ]);

    const matchResult = candidates.find((c) => c.kind === "match_result");
    expect(matchResult).toBeDefined();
    expect(matchResult?.scores).toEqual(["3-1"]);
  });
});
