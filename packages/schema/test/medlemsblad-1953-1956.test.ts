import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadArchive, type Archive } from "../src/load.js";

describe("Medlemsblad 1953–1956 (PR #156)", () => {
  let archive: Archive;

  beforeAll(async () => {
    archive = await loadArchive(resolve(import.meta.dirname, "../../../data"));
  }, 30_000);

  it("fører formenn i organisasjonssnapshots med presis distinksjon på organ (Hovedstyret, Banekomiteen, Dameavdelingen)", () => {
    const snap1953 = archive.organizationSnapshots.find((s) => s.date === "1953");
    const snap1954 = archive.organizationSnapshots.find((s) => s.date === "1954");
    const snap1955 = archive.organizationSnapshots.find((s) => s.date === "1955");
    const snap1956 = archive.organizationSnapshots.find((s) => s.date === "1956");

    // Hovedstyrets formann
    expect(snap1953?.people.find((p) => p.observedTitle === "Formann" && p.body === "Hovedstyret")?.personId).toBe("lauritz-giske");
    expect(snap1954?.people.find((p) => p.observedTitle === "Formann" && p.body === "Hovedstyret")?.personId).toBe("lauritz-giske");
    expect(snap1955?.people.find((p) => p.observedTitle === "Formann" && p.body === "Hovedstyret")?.personId).toBe("kjell-berentzen");
    expect(snap1956?.people.find((p) => p.observedTitle === "Formann" && p.body === "Hovedstyret")?.personId).toBe("kjell-berentzen");

    // Banekomiteens formann
    expect(snap1953?.people.find((p) => p.observedTitle === "Formann" && p.body === "Banekomiteen")?.personId).toBe("emil-sando");
    expect(snap1954?.people.find((p) => p.observedTitle === "Formann" && p.body === "Banekomiteen")?.personId).toBe("emil-sando");
    expect(snap1955?.people.find((p) => p.observedTitle === "Formann" && p.body === "Banekomiteen")?.personId).toBe("emil-sando");
    expect(snap1956?.people.find((p) => p.observedTitle === "Formann" && p.body === "Banekomiteen")?.personId).toBe("rolf-annaniassen");

    // Dameavdelingens formann (valgt nov 1953 for arbeidsåret 1954)
    expect(snap1953?.people.find((p) => p.observedTitle === "Formann" && p.body === "Dameavdelingen")?.personId).toBeUndefined();
    expect(snap1954?.people.find((p) => p.observedTitle === "Formann" && p.body === "Dameavdelingen")?.personId).toBe("anita-wold");
  });

  it("dokumenterer formanns- og nestformannsperioder for Lauritz Giske og Kjell Berentzen", () => {
    const giske = archive.people.find((p) => p.id === "lauritz-giske");
    const berentzen = archive.people.find((p) => p.id === "kjell-berentzen");

    const giskeFormann = giske?.roles?.find((r) => r.id === "formann-1953-1954");
    expect(giskeFormann).toMatchObject({
      from: "1953",
      to: "1954",
      category: "board",
      title: "Formann",
      body: "Hovedstyret",
    });

    const giskeNestformann = giske?.roles?.find((r) => r.id === "nestformann-hovedstyret-1956");
    expect(giskeNestformann).toMatchObject({
      from: "1956",
      to: "1956",
      category: "board",
      title: "Nestformann",
      body: "Hovedstyret",
    });

    const berentzenFormann = berentzen?.roles?.find((r) => r.id === "formann-1955-1956");
    expect(berentzenFormann).toMatchObject({
      from: "1955",
      to: "1956",
      category: "board",
      title: "Formann",
    });
    expect(berentzenFormann?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1955-8ccc" && s.page === "64")).toBe(true);
    expect(berentzenFormann?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1956-3e52" && s.page === "16")).toBe(true);
  });

  it("fører Bernt Sulebust som sekretær og Harald Sæther som kasserer i 1953 og 1954", () => {
    const snap1953 = archive.organizationSnapshots.find((s) => s.date === "1953");
    expect(snap1953?.people.find((p) => p.observedTitle === "Sekretær")?.personId).toBe("bernt-sulebust");
    expect(snap1953?.people.find((p) => p.observedTitle === "Kasserer")?.personId).toBe("harald-saether");

    const snap1954 = archive.organizationSnapshots.find((s) => s.date === "1954");
    expect(snap1954?.people.find((p) => p.observedTitle === "Sekretær")?.personId).toBe("bernt-sulebust");
    expect(snap1954?.people.find((p) => p.observedTitle === "Kasserer")?.personId).toBe("harald-saether");

    const bernt = archive.people.find((p) => p.id === "bernt-sulebust");
    expect(bernt?.roles?.some((r) => r.id === "sekretaer-hovedstyret-1953-1954" && r.body === "Hovedstyret")).toBe(true);

    const eriksen = archive.people.find((p) => p.id === "karsten-eriksen");
    expect(eriksen?.roles?.some((r) => r.id === "nestformann-hovedstyret-1953-1954" && r.body === "Hovedstyret")).toBe(true);
  });

  it("fører trenere, oppmenn og kapteiner for 1953–1955 med samsvar mellom snapshot og personfiler", () => {
    const snap1953 = archive.organizationSnapshots.find((s) => s.date === "1953");
    const snap1954 = archive.organizationSnapshots.find((s) => s.date === "1954");
    const snap1955 = archive.organizationSnapshots.find((s) => s.date === "1955");

    expect(snap1953?.people.find((p) => p.observedTitle === "Oppmann")?.personId).toBe("ragnvald-langva");
    expect(snap1953?.people.find((p) => p.observedTitle === "Trener")?.personId).toBe("finn-tollas");
    expect(snap1954?.people.find((p) => p.observedTitle === "Oppmann")?.personId).toBe("fritz-haagensen");
    expect(snap1955?.people.find((p) => p.observedTitle === "Trener")?.personId).toBe("oivind-haagensen");

    // Reell verifikasjon av at personfilene også har rollene
    const tollas = archive.people.find((p) => p.id === "finn-tollas");
    expect(tollas?.roles?.some((r) => r.id === "trener-1953-1954" && r.category === "coach")).toBe(true);

    const fritz = archive.people.find((p) => p.id === "fritz-haagensen");
    expect(fritz?.roles?.some((r) => r.id === "oppmann-1954" && r.category === "sporting_staff")).toBe(true);
    expect(fritz?.roles?.some((r) => r.id === "oppmann-1955" && r.category === "sporting_staff")).toBe(true);

    const oivind = archive.people.find((p) => p.id === "oivind-haagensen");
    expect(oivind?.roles?.some((r) => r.id === "trener-1955" && r.category === "coach")).toBe(true);

    const langva = archive.people.find((p) => p.id === "ragnvald-langva");
    expect(langva?.roles?.some((r) => r.id === "oppmann-1953" && r.category === "sporting_staff")).toBe(true);

    const larsen = archive.people.find((p) => p.id === "jan-larsen");
    expect(larsen?.roles?.some((r) => r.id === "kaptein-1955" && r.category === "sporting_staff")).toBe(true);
  });

  it("fører Anita Wold (Anita Olsen-Vold) som formann i Dameavdelingen", () => {
    const anita = archive.people.find((p) => p.id === "anita-wold");
    expect(anita?.names).toContain("Anita Olsen-Vold");
    const role = anita?.roles?.find((r) => r.id === "formann-dameavdelingen-1954");
    expect(role).toMatchObject({
      from: "1954",
      category: "board",
      title: "Formann",
      body: "Dameavdelingen",
    });
    expect(role?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1953-3e9d" && s.page === "66")).toBe(true);
  });

  it("dokumenterer Banekomiteens formenn og Kråmyra treningsbanes første gangs bruk i 1955", () => {
    const obs = archive.historicalObservations.find((o) => o.id === "1955-kramyra-forste-bruk");
    expect(obs).toMatchObject({
      date: "1955-08-21",
      seasonYears: [1955],
    });
    expect(obs?.personIds).toEqual(["emil-sando"]);

    const rolf = archive.people.find((p) => p.id === "rolf-annaniassen");
    expect(rolf?.roles?.some((r) => r.id === "banekomiteformann-1956-1957" && r.body === "Kråmyra-prosjektet")).toBe(true);
  });

  it("dokumenterer hedersbevisninger, gullmerker og spillemerker", () => {
    const nedregard = archive.people.find((p) => p.id === "karsten-nedregard");
    const olsen = archive.people.find((p) => p.id === "trygve-olsen");
    const sando = archive.people.find((p) => p.id === "emil-sando");
    const sulebak = archive.people.find((p) => p.id === "rasmus-sulebak");
    const froysa = archive.people.find((p) => p.id === "ingvald-froysa");
    const aas = archive.people.find((p) => p.id === "einar-aas");

    expect(nedregard?.roles?.some((r) => r.id === "spillemerke-gull-1950")).toBe(true);
    expect(olsen?.roles?.some((r) => r.id === "spillemerke-gull-1950")).toBe(true);
    expect(sando?.roles?.some((r) => r.id === "gullmerkeinnehaver-1953")).toBe(true);
    expect(sulebak?.roles?.some((r) => r.id === "kruset-1955")).toBe(true);
    expect(froysa?.roles?.some((r) => r.id === "spillemerke-solv-1950")).toBe(true);
    expect(aas?.roles?.some((r) => r.id === "arets-spiller-1956")).toBe(true);
  });

  it("beriker canonical match for 1954 NM 3. runde mot Freidig", () => {
    const match = archive.matches.find((m) => m.id === "1954-08-08-freidig-aalesunds-fk");
    expect(match).toBeDefined();
    expect(match?.date).toBe("1954-08-08");
    expect(match?.home.score).toBe(3);
    expect(match?.away.score).toBe(1);
    expect(match?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1954-cd1c" && s.page === "95")).toBe(true);
  });

  describe("Preservation-garanti mot person-regresjon (sentinel personer)", () => {
    it("bevarer Karsten Nedregårds 1961-kilde (PR #154) og gullmerkehistorikk", () => {
      const nedregard = archive.people.find((p) => p.id === "karsten-nedregard");
      expect(nedregard).toBeDefined();
      expect(nedregard?.roles?.some((r) => r.id === "gullmerkeinnehaver-1972")).toBe(true);
      expect(nedregard?.roles?.some((r) => r.id === "spillemerke-gull-1950")).toBe(true);
      // Eksplisitt vern av kilden lagt inn i PR #154
      expect(nedregard?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1961-a9f8" && s.page === "76")).toBe(true);
      expect(nedregard?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1953-3e9d" && s.page === "74")).toBe(true);
    });

    it("bevarer all eldre og nyere historikk for Einar Aas", () => {
      const aas = archive.people.find((p) => p.id === "einar-aas");
      expect(aas).toBeDefined();
      expect(aas?.roles?.some((r) => r.id === "trener-1960")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "trener-1966")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "oppmann-1961")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "oppmann-1962")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "oppmann-1963")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "oppmann-1964")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "arets-spiller-1956")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "arets-spiller-1957")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "gullmerkeinnehaver-1960")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "gullmerkeinnehaver-2002")).toBe(true);
      expect(aas?.roles?.some((r) => r.id === "aeresmedlem-2013")).toBe(true);
      expect(aas?.coachSpells).toEqual([
        { fromSeason: 1960, toSeason: 1960 },
      ]);
    });

    it("bevarer alle roller og konflikter for Peder Puck og beriker Banekomité-vervet med 1953-kilde", () => {
      const puck = archive.people.find((p) => p.id === "peder-puck");
      expect(puck).toBeDefined();
      expect(puck?.roles?.some((r) => r.id === "oppmann-1932")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "oppmann-1933")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "styreleder-1945")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "formann-1946")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "aeresmedlem-1957")).toBe(true);
      expect(puck?.conflicts?.some((c) => c.field === "formann.1932")).toBe(true);

      const banekomite = puck?.roles?.find((r) => r.id === "nestformann-1951");
      expect(banekomite).toBeDefined();
      expect(banekomite?.body).toBe("Banekomiteen");
      expect(banekomite?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1953-3e9d" && s.page === "87")).toBe(true);
    });

    it("bevarer alle roller, konflikter og kilder for Hans J. Henriksen", () => {
      const hans = archive.people.find((p) => p.id === "hans-j-henriksen");
      expect(hans).toBeDefined();
      expect(hans?.roles?.some((r) => r.id === "formann-1957-1960")).toBe(true);
      expect(hans?.names).toContain("Hans Henriksen");
      expect(hans?.conflicts?.some((c) => c.field === "formann.1968")).toBe(true);
    });

    it("bevarer alle roller for Lauritz Giske", () => {
      const giske = archive.people.find((p) => p.id === "lauritz-giske");
      expect(giske).toBeDefined();
      expect(giske?.roles?.some((r) => r.id === "formann-1953-1954")).toBe(true);
      expect(giske?.roles?.some((r) => r.id === "nestformann-hovedstyret-1956")).toBe(true);
      expect(giske?.roles?.some((r) => r.id === "nestformann-1955")).toBe(true);
      expect(giske?.roles?.some((r) => r.id === "gullmerkeinnehaver-1972")).toBe(true);
    });

    it("bevarer roller og dokumenterer NFFs dommerkomité for Øivind Haagensen", () => {
      const oivind = archive.people.find((p) => p.id === "oivind-haagensen");
      expect(oivind).toBeDefined();
      expect(oivind?.roles?.some((r) => r.id === "trener-1955")).toBe(true);
      expect(oivind?.roles?.some((r) => r.id === "gullmerkeinnehaver-1964")).toBe(true);

      const nffRole = oivind?.roles?.find((r) => r.id === "nff-dommerkomite-1953");
      expect(nffRole).toMatchObject({
        category: "administration",
        title: "Medlem av NFFs dommerkomité",
        body: "NFFs dommerkomité",
        from: "1953",
      });
      expect(nffRole?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1953-3e9d" && s.page === "30")).toBe(true);
    });

    it("bevarer alle roller og hedersbevisninger for Asbjørn Korsnes", () => {
      const korsnes = archive.people.find((p) => p.id === "asbjorn-korsnes");
      expect(korsnes).toBeDefined();
      expect(korsnes?.roles?.some((r) => r.id === "nestformann-1957")).toBe(true);
      expect(korsnes?.roles?.some((r) => r.id === "spillemerke-solv-150-kamper")).toBe(true);
      expect(korsnes?.roles?.some((r) => r.id === "gullmerkeinnehaver-1976")).toBe(true);
      expect(korsnes?.roles?.some((r) => r.id === "styreleder-1979")).toBe(true);
      expect(korsnes?.roles?.some((r) => r.id === "formann-1979")).toBe(true);
    });

    it("bevarer alle roller, treneroppdrag og hedersbevisninger for Torbjørn Aarø", () => {
      const aaro = archive.people.find((p) => p.id === "torbjorn-aaro");
      expect(aaro).toBeDefined();
      expect(aaro?.roles?.some((r) => r.id === "kaptein-1961-1962")).toBe(true);
      expect(aaro?.roles?.some((r) => r.id === "trener-1961")).toBe(true);
      expect(aaro?.roles?.some((r) => r.id === "trener-1964")).toBe(true);
      expect(aaro?.roles?.some((r) => r.id === "trener-1965")).toBe(true);
      expect(aaro?.roles?.some((r) => r.id === "seniorstatuett-1957")).toBe(true);
      expect(aaro?.roles?.some((r) => r.id === "spillemerke-solv-1957")).toBe(true);
      expect(aaro?.roles?.some((r) => r.id === "spillemerke-300-kamper")).toBe(true);
      expect(aaro?.roles?.some((r) => r.id === "gullmerkeinnehaver-1987")).toBe(true);
      expect(aaro?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1953-3e9d" && s.page === "75")).toBe(true);
      expect(aaro?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1954-cd1c" && s.page === "47")).toBe(true);
    });

    it("bevarer Kjell Berentzens roller, konflikter og nyere kilder", () => {
      const berentzen = archive.people.find((p) => p.id === "kjell-berentzen");
      expect(berentzen).toBeDefined();
      expect(berentzen?.roles?.some((r) => r.id === "formann-1955-1956")).toBe(true);
      expect(berentzen?.roles?.some((r) => r.id === "formann-1961")).toBe(true);
      expect(berentzen?.roles?.find((r) => r.id === "formann-1961")?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1961-a9f8")).toBe(true);
    });
  });
});
