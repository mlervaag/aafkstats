import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadArchive, type Archive } from "../src/load.js";

describe("Medlemsblad 1953–1956 (PR #156)", () => {
  let archive: Archive;

  beforeAll(async () => {
    archive = await loadArchive(resolve(import.meta.dirname, "../../../data"));
  }, 30_000);

  it("fører korrekt formann i organisasjonssnapshots for 1953, 1954, 1955 og 1956", () => {
    const snap1953 = archive.organizationSnapshots.find((s) => s.date === "1953");
    const snap1954 = archive.organizationSnapshots.find((s) => s.date === "1954");
    const snap1955 = archive.organizationSnapshots.find((s) => s.date === "1955");
    const snap1956 = archive.organizationSnapshots.find((s) => s.date === "1956");

    expect(snap1953?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("lauritz-giske");
    expect(snap1954?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("lauritz-giske");
    expect(snap1955?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("kjell-berentzen");
    expect(snap1956?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe("kjell-berentzen");
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
    });

    const berentzenFormann = berentzen?.roles?.find((r) => r.id === "formann-1955-1956");
    expect(berentzenFormann).toMatchObject({
      from: "1955",
      to: "1956",
      category: "board",
      title: "Formann",
    });
    expect(berentzenFormann?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1955-8ccc" && s.page === "64")).toBe(true);
  });

  it("fører Bernt Sulebust som sekretær og Harald Sæther som kasserer i 1953 og 1954", () => {
    const snap1953 = archive.organizationSnapshots.find((s) => s.date === "1953");
    expect(snap1953?.people.find((p) => p.observedTitle === "Sekretær")?.personId).toBe("bernt-sulebust");
    expect(snap1953?.people.find((p) => p.observedTitle === "Kasserer")?.personId).toBe("harald-saether");

    const snap1954 = archive.organizationSnapshots.find((s) => s.date === "1954");
    expect(snap1954?.people.find((p) => p.observedTitle === "Sekretær")?.personId).toBe("bernt-sulebust");
    expect(snap1954?.people.find((p) => p.observedTitle === "Kasserer")?.personId).toBe("harald-saether");
  });

  it("fører trenere og oppmenn for 1953–1955", () => {
    const snap1953 = archive.organizationSnapshots.find((s) => s.date === "1953");
    const snap1954 = archive.organizationSnapshots.find((s) => s.date === "1954");
    const snap1955 = archive.organizationSnapshots.find((s) => s.date === "1955");

    expect(snap1953?.people.find((p) => p.observedTitle === "Oppmann")?.personId).toBe("ragnvald-langva");
    expect(snap1953?.people.find((p) => p.observedTitle === "Trener")?.personId).toBe("finn-tollas");

    expect(snap1954?.people.find((p) => p.observedTitle === "Oppmann")?.personId).toBe("fritz-haagensen");
    expect(snap1955?.people.find((p) => p.observedTitle === "Trener")?.personId).toBe("oivind-haagensen");
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
    expect(obs?.personIds).toContain("emil-sando");
    expect(obs?.personIds).toContain("kjell-berentzen");

    const snap1953 = archive.organizationSnapshots.find((s) => s.date === "1953");
    const snap1956 = archive.organizationSnapshots.find((s) => s.date === "1956");
    expect(snap1953?.people.find((p) => p.body === "Banekomiteen")?.personId).toBe("emil-sando");
    expect(snap1956?.people.find((p) => p.body === "Banekomiteen")?.personId).toBe("rolf-annaniassen");
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
    });

    it("bevarer alle roller og konflikter for Peder Puck", () => {
      const puck = archive.people.find((p) => p.id === "peder-puck");
      expect(puck).toBeDefined();
      expect(puck?.roles?.some((r) => r.id === "oppmann-1932")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "oppmann-1933")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "styreleder-1945")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "formann-1946")).toBe(true);
      expect(puck?.roles?.some((r) => r.id === "aeresmedlem-1957")).toBe(true);
      expect(puck?.conflicts).toBeDefined();
      expect(puck?.conflicts && puck.conflicts.length > 0).toBe(true);
    });

    it("bevarer alle roller, konflikter og kilder for Hans J. Henriksen", () => {
      const hans = archive.people.find((p) => p.id === "hans-j-henriksen");
      expect(hans).toBeDefined();
      expect(hans?.roles?.some((r) => r.id === "formann-1957-1960")).toBe(true);
      expect(hans?.names).toContain("Hans Henriksen");
      expect(hans?.conflicts).toBeDefined();
    });

    it("bevarer alle roller for Lauritz Giske", () => {
      const giske = archive.people.find((p) => p.id === "lauritz-giske");
      expect(giske).toBeDefined();
      expect(giske?.roles?.some((r) => r.id === "formann-1953-1954")).toBe(true);
      expect(giske?.roles?.some((r) => r.id === "nestformann-1955")).toBe(true);
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
    });
  });
});
