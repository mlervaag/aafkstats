import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadArchive, type Archive } from "../src/load.js";

describe("Medlemsblad 1957–1960 (PR #155)", () => {
  let archive: Archive;

  beforeAll(async () => {
    archive = await loadArchive(resolve(import.meta.dirname, "../../../data"));
  }, 30_000);

  it("fører korrekt formann i organisasjonssnapshots for 1957, 1958, 1959 og 1960", () => {
    const snap1957 = archive.organizationSnapshots.find((s) => s.date === "1957");
    const snap1958 = archive.organizationSnapshots.find((s) => s.date === "1958");
    const snap1959 = archive.organizationSnapshots.find((s) => s.date === "1959");
    const snap1960 = archive.organizationSnapshots.find((s) => s.date === "1960");
    const snap1961 = archive.organizationSnapshots.find((s) => s.date === "1961");

    expect(snap1957?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("hans-j-henriksen");
    expect(snap1958?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("hans-j-henriksen");
    expect(snap1959?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("hans-j-henriksen");
    expect(snap1960?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("hans-j-henriksen");
    expect(snap1961?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("kjell-berentzen");
  });

  it("dokumenterer formannsperiodene for Hans J. Henriksen og Kjell Berentzen med presis proveniens", () => {
    const hansHenriksen = archive.people.find((p) => p.id === "hans-j-henriksen");
    const kjellBerentzen = archive.people.find((p) => p.id === "kjell-berentzen");

    const hansFormann = hansHenriksen?.roles?.find((r) => r.id === "formann-1957-1960");
    expect(hansFormann).toMatchObject({
      from: "1957",
      to: "1960",
      category: "board",
      title: "Formann",
    });

    const berentzenFormann = kjellBerentzen?.roles?.find((r) => r.id === "formann-1961");
    expect(berentzenFormann).toMatchObject({
      from: "1961",
      to: "1961",
      category: "board",
      title: "Formann",
    });
    expect(berentzenFormann?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1960-146a" && s.page === "63")).toBe(true);
  });

  it("fører Rolf Kvissel som sekretær for 1958 med kilde til valg (1957 s. 65) og tillitsmannsliste (1958 s. 7)", () => {
    const kvissel = archive.people.find((p) => p.id === "rolf-kvissel");
    const role = kvissel?.roles?.find((r) => r.id === "sekretaer-1958");
    expect(role).toMatchObject({
      from: "1958",
      to: "1958",
      category: "administration",
      title: "Sekretær",
    });
    expect(role?.sources).toEqual([
      expect.objectContaining({ sourceId: "medlemsblad-for-aalesunds-fotb-1957-7672", page: "65" }),
      expect.objectContaining({ sourceId: "medlemsblad-for-aalesunds-fotb-1958-5725", page: "7" }),
    ]);
  });

  it("dokumenterer Harald Sæthers 8-årige kassererperiode 1953–1960", () => {
    const saether = archive.people.find((p) => p.id === "harald-saether");
    const role = saether?.roles?.find((r) => r.id === "kasserer-1953-1960");
    expect(role).toMatchObject({
      from: "1953",
      to: "1960",
      category: "administration",
      title: "Kasserer",
    });
  });

  it("fører trenere og oppmenn for 1958–1960", () => {
    const walderhaug = archive.people.find((p) => p.id === "ole-walderhaug");
    const larsen = archive.people.find((p) => p.id === "jan-larsen");
    const aas = archive.people.find((p) => p.id === "einar-aas");

    expect(walderhaug?.roles?.some((r) => r.id === "oppmann-1958" && r.category === "sporting_staff")).toBe(true);
    expect(walderhaug?.roles?.some((r) => r.id === "oppmann-1959" && r.category === "sporting_staff")).toBe(true);
    expect(walderhaug?.roles?.some((r) => r.id === "oppmann-1960" && r.category === "sporting_staff")).toBe(true);
    expect(walderhaug?.roles?.some((r) => r.id === "oppmann-1965")).toBe(true);

    expect(larsen?.roles?.find((r) => r.id === "trener-1958-1959")).toMatchObject({
      from: "1958",
      to: "1959",
      category: "coach",
    });
    expect(aas?.roles?.find((r) => r.id === "trener-1960")).toMatchObject({
      from: "1960",
      category: "coach",
    });
  });

  it("fører ledere for Dameavdelingen 1956–1960", () => {
    const stromsholm = archive.people.find((p) => p.id === "gerd-stromsholm");
    const ingebrigtsen = archive.people.find((p) => p.id === "elisif-ingebrigtsen");

    expect(stromsholm?.roles?.find((r) => r.id === "formann-dameavdelingen-1956")).toMatchObject({
      from: "1956",
      to: "1958",
      category: "board",
      body: "Dameavdelingen",
    });
    expect(ingebrigtsen?.roles?.find((r) => r.id === "formann-dameavdelingen-1959")).toMatchObject({
      from: "1959",
      to: "1960",
      category: "board",
      body: "Dameavdelingen",
    });
  });

  it("har opprettet kanonisk kamp AaFK – Westbahn Linz (1957-07-28) med delt feltproveniens", () => {
    const match = archive.matches.find((m) => m.id === "1957-07-28-aalesunds-fk-westbahn-linz");
    expect(match).toBeDefined();
    expect(match).toMatchObject({
      date: "1957-07-28",
      dateConfidence: "exact",
      status: "played",
      venueId: "aksla-stadion",
      attendance: 2500,
      home: { clubId: "aalesunds-fk", score: 0, halfTimeScore: 0 },
      away: { clubId: "westbahn-linz", score: 1, halfTimeScore: 0 },
    });
    expect(match?.lineups?.home?.starters).toHaveLength(11);
    expect(match?.sources).toEqual([
      expect.objectContaining({
        sourceId: "medlemsblad-for-aalesunds-fotb-1957-7672",
        page: "38",
        fields: expect.arrayContaining(["lineups.home.starters", "attendance", "home.halfTimeScore"]),
      }),
      expect.objectContaining({
        sourceId: "medlemsblad-for-aalesunds-fotb-1957-7672",
        page: "44",
        fields: expect.arrayContaining(["competition", "status"]),
      }),
    ]);
  });

  it("har opprettet kanonisk kamp AaFK – Tatran Prešov (1959-07-16) med delt feltproveniens", () => {
    const match = archive.matches.find((m) => m.id === "1959-07-16-aalesunds-fk-tatran-presov");
    expect(match).toBeDefined();
    expect(match).toMatchObject({
      date: "1959-07-16",
      dateConfidence: "exact",
      status: "played",
      venueId: "aksla-stadion",
      attendance: 2000,
      home: { clubId: "aalesunds-fk", score: 1, halfTimeScore: 1 },
      away: { clubId: "tatran-presov", score: 4, halfTimeScore: 2 },
    });
    expect(match?.lineups?.home?.starters).toHaveLength(11);
    expect(match?.sources).toEqual([
      expect.objectContaining({
        sourceId: "medlemsblad-for-aalesunds-fotb-1959-515a",
        page: "26",
        fields: expect.arrayContaining(["lineups.home.starters", "attendance", "home.halfTimeScore"]),
      }),
      expect.objectContaining({
        sourceId: "medlemsblad-for-aalesunds-fotb-1959-515a",
        page: "60",
        fields: expect.arrayContaining(["competition", "status"]),
      }),
    ]);
  });

  it("har registrert hedersbevisninger og milepæler 1957–1960", () => {
    const sando = archive.people.find((p) => p.id === "emil-sando");
    const puck = archive.people.find((p) => p.id === "peder-puck");
    const aaro = archive.people.find((p) => p.id === "torbjorn-aaro");
    const vadseth = archive.people.find((p) => p.id === "karsten-vadseth");
    const aas = archive.people.find((p) => p.id === "einar-aas");

    expect(sando?.roles?.find((r) => r.id === "aeresmedlem-1957")).toBeDefined();
    expect(puck?.roles?.find((r) => r.id === "aeresmedlem-1957")).toBeDefined();
    expect(aaro?.roles?.find((r) => r.id === "spillemerke-gull-1959")).toBeDefined();
    expect(vadseth?.roles?.find((r) => r.id === "brusdal-statuetten-1959")).toBeDefined();
    expect(aas?.roles?.find((r) => r.id === "gullmerkeinnehaver-1960")).toBeDefined();
  });

  it("har opprettet historiske observasjoner for Kråmyra-anlegget i 1957 og 1960", () => {
    const obs1957 = archive.historicalObservations.find((o) => o.id === "1957-kramyra-klubbhus-innvielse");
    const obs1960 = archive.historicalObservations.find((o) => o.id === "1960-kramyra-klubbhus-fullfort");

    expect(obs1957).toBeDefined();
    expect(obs1957).toMatchObject({
      date: "1957-10-26",
      personIds: expect.arrayContaining(["hans-j-henriksen", "rolf-annaniassen"]),
    });

    expect(obs1960).toBeDefined();
    expect(obs1960).toMatchObject({
      date: "1960-11-25",
      personIds: expect.arrayContaining(["hans-j-henriksen", "perry-ystenes", "frantz-lovmo", "helge-lunde"]),
    });
  });

  describe("Preservation av eksisterende personhistorikk (additivitetsgaranti)", () => {
    it("bevarer all eksisterende historikk, konflikter og trenerperioder for Einar Aas", () => {
      const aas = archive.people.find((p) => p.id === "einar-aas");
      expect(aas).toBeDefined();

      // Eksisterende roller fra main
      expect(aas?.roles?.some((r) => r.id === "trener-1966")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "oppmann-1962")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "oppmann-1963")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "oppmann-1964")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "gullmerkeinnehaver-2002")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "aeresmedlem-2013")).toBe(true);

      // Nye/berikede roller fra 1957-1960
      expect(aas?.roles?.some((r) => r.id === "arets-spiller-1957")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "gullmerkeinnehaver-1960")).toBe(true);

      // Konflikter og coachSpells
      const conflict = aas?.conflicts?.find((c) => c.field === "formann.1961");
      expect(conflict).toBeDefined();
      expect(conflict?.resolved).toBe(true);
      expect(conflict?.chosen).toBe("Kjell Berentzen");

      expect(aas?.coachSpells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fromSeason: 1960, toSeason: 1960 }),
        ]),
      );
    });

    it("bevarer all eldre og nyere historikk og uavklart konflikt for Peder Puck", () => {
      const puck = archive.people.find((p) => p.id === "peder-puck");
      expect(puck).toBeDefined();

      expect(puck?.roles?.some((r) => r.id === "formann-1938-1939")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "formann-1940-1945")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "gullmerkeinnehaver-1948")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "nif-plakett-1961")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "kasserer-1962")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "aeresmedlem-1957")).toBe(true);

      const conflict = puck?.conflicts?.find((c) => c.field === "formann.1932");
      expect(conflict).toBeDefined();
    });

    it("bevarer etterkrigs- og 1960-tallshistorikk, aliases og konflikt for Hans J. Henriksen", () => {
      const hans = archive.people.find((p) => p.id === "hans-j-henriksen");
      expect(hans).toBeDefined();

      expect(hans?.roles?.some((r) => r.id === "formann-1962-1964")).toBe(true);
      expect(hans?.roles?.some((r) => r.id === "formann-1969")).toBe(true);
      expect(hans?.roles?.some((r) => r.id === "gullmerkeinnehaver-1969")).toBe(true);

      expect(hans?.names).toEqual(
        expect.arrayContaining(["Hans Henriksen", "Hans Jacob Henriksen"]),
      );

      const conflict = hans?.conflicts?.find((c) => c.field === "formann.1968");
      expect(conflict).toBeDefined();
    });

    it("bevarer senere roller og hedersbevisninger for Asbjørn Korsnes", () => {
      const korsnes = archive.people.find((p) => p.id === "asbjorn-korsnes");
      expect(korsnes).toBeDefined();

      expect(korsnes?.roles?.some((r) => r.id === "gullmerkeinnehaver-1976")).toBe(true);
      expect(korsnes?.roles?.some((r) => r.id === "formann-1979" || r.id === "styreleder-1979")).toBe(true);
      expect(korsnes?.roles?.some((r) => r.id === "spillemerke-solv-150-kamper")).toBe(true);
    });

    it("bevarer resolved formann.1962 konflikt for Kjell Berentzen", () => {
      const berentzen = archive.people.find((p) => p.id === "kjell-berentzen");
      expect(berentzen).toBeDefined();

      expect(berentzen?.roles?.some((r) => r.id === "formann-1955-1956")).toBe(true);
      expect(berentzen?.roles?.some((r) => r.id === "formann-1961")).toBe(true);

      const conflict = berentzen?.conflicts?.find((c) => c.field === "formann.1962");
      expect(conflict).toBeDefined();
      expect(conflict?.resolved).toBe(true);
    });
  });
});
