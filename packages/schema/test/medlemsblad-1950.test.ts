import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadArchive, type Archive } from "../src/load.js";

describe("Medlemsblad 1950 (Vol. 1, nr. 1–6)", () => {
  let archive: Archive;

  beforeAll(async () => {
    archive = await loadArchive(resolve(import.meta.dirname, "../../../data"));
  }, 30_000);

  it("fører organisasjonssnapshot 1950 med full sammensetning av styrer og komiteer", () => {
    const snap1950 = archive.organizationSnapshots.find((s) => s.date === "1950");
    expect(snap1950).toBeDefined();

    // Hovedstyret 1950
    expect(snap1950?.people.find((p) => p.observedTitle === "Formann" && p.body === "Hovedstyret")?.personId).toBe("per-anker-eriksen");
    expect(snap1950?.people.find((p) => p.observedTitle === "Nestformann" && p.body === "Hovedstyret")?.personId).toBe("louis-vegsund");
    expect(snap1950?.people.find((p) => p.observedTitle === "Sekretær" && p.body === "Hovedstyret")?.personId).toBe("karsten-eriksen");
    expect(snap1950?.people.find((p) => p.observedTitle === "Kasserer" && p.body === "Hovedstyret")?.personId).toBe("arne-vestad");

    // Sportslig ledelse
    expect(snap1950?.people.find((p) => p.observedTitle === "Oppmann" && p.body === "A-laget")?.personId).toBe("peder-puck");
    expect(snap1950?.people.find((p) => p.observedTitle === "Junioroppmann" && p.body === "Junioravdelingen")?.personId).toBe("finn-tollas");
    expect(snap1950?.people.find((p) => p.observedTitle === "Idrettsinstruktør" && p.body === "Innetreningen")?.personId).toBe("karl-slinning");

    // Banekomiteen 1950 (alle 5 medlemmer)
    expect(snap1950?.people.find((p) => p.observedTitle === "Formann" && p.body === "Banekomiteen")?.personId).toBe("emil-sando");
    expect(snap1950?.people.find((p) => p.personId === "sigurd-norve" && p.body === "Banekomiteen")).toBeDefined();
    expect(snap1950?.people.find((p) => p.personId === "odd-ostensen" && p.body === "Banekomiteen")).toBeDefined();
    expect(snap1950?.people.find((p) => p.personId === "monrad-orheim" && p.body === "Banekomiteen")).toBeDefined();
    expect(snap1950?.people.find((p) => p.personId === "oivind-haagensen" && p.body === "Banekomiteen")).toBeDefined();

    // Dameavdelingen 1950
    expect(snap1950?.people.find((p) => p.observedTitle === "Formann" && p.body === "Dameavdelingen")?.personId).toBe("alfhild-ringdal");
    expect(snap1950?.people.find((p) => p.observedTitle === "Nestformann" && p.body === "Dameavdelingen")?.personId).toBe("mary-vegsund");
    expect(snap1950?.people.find((p) => p.observedTitle === "Sekretær" && p.body === "Dameavdelingen")?.personId).toBe("anita-olsen");
    expect(snap1950?.people.find((p) => p.observedTitle === "Kasserer" && p.body === "Dameavdelingen")?.personId).toBe("aase-gudmundseth");

    // Medlemsbladet redaksjon 1950
    expect(snap1950?.people.find((p) => p.observedTitle === "Ansvarshavende" && p.body === "Medlemsbladet")?.personId).toBe("lauritz-giske");
    expect(snap1950?.people.find((p) => p.personId === "harald-nord" && p.body === "Medlemsbladet")).toBeDefined();
    expect(snap1950?.people.find((p) => p.personId === "bernt-sulebust" && p.body === "Medlemsbladet")).toBeDefined();
    expect(snap1950?.people.find((p) => p.personId === "ivar-ostensen" && p.body === "Medlemsbladet")).toBeDefined();
    expect(snap1950?.people.find((p) => p.personId === "bjorn-aasen" && p.body === "Medlemsbladet")).toBeDefined();
  });

  it("fører organisasjonssnapshot 1951 fra årsmøtevalgene 29. november 1950", () => {
    const snap1951 = archive.organizationSnapshots.find((s) => s.date === "1951");
    expect(snap1951).toBeDefined();

    // Hovedstyret 1951
    expect(snap1951?.people.find((p) => p.observedTitle === "Formann" && p.body === "Hovedstyret")?.personId).toBe("per-anker-eriksen");
    expect(snap1951?.people.find((p) => p.observedTitle === "Nestformann" && p.body === "Hovedstyret")?.personId).toBe("arne-vestad");
    expect(snap1951?.people.find((p) => p.observedTitle === "Sekretær" && p.body === "Hovedstyret")?.personId).toBe("karsten-eriksen");
    expect(snap1951?.people.find((p) => p.observedTitle === "Kasserer" && p.body === "Hovedstyret")?.personId).toBe("bjorn-aasen");
    expect(snap1951?.people.find((p) => p.personId === "odd-ostensen" && p.body === "Hovedstyret")).toBeDefined();
    expect(snap1951?.people.find((p) => p.personId === "monrad-orheim" && p.body === "Hovedstyret")).toBeDefined();

    // Sportsutvalget 1951
    expect(snap1951?.people.find((p) => p.observedTitle === "Formann" && p.body === "Sportsutvalget")?.personId).toBe("peder-puck");
    expect(snap1951?.people.find((p) => p.personId === "kare-brandal" && p.body === "Sportsutvalget")).toBeDefined();
    expect(snap1951?.people.find((p) => p.personId === "gunnar-saether" && p.body === "Sportsutvalget")).toBeDefined();
    expect(snap1951?.people.find((p) => p.personId === "harald-nord" && p.body === "Sportsutvalget")).toBeDefined();

    // Klubbarkivar 1951
    expect(snap1951?.people.find((p) => p.observedTitle === "Klubbarkivar")?.personId).toBe("asbjorn-korsnes");
  });

  it("dokumenterer roller og tillitsverv for nye og berikede personer uten interpolering", () => {
    // Lars Tøsse har separate styremedlem-roller per dokumentert år
    const larsTosse = archive.people.find((p) => p.id === "lars-tosse");
    expect(larsTosse).toBeDefined();
    expect(larsTosse?.roles.some((r) => r.id === "aeresmedlem-1939")).toBe(true);
    expect(larsTosse?.roles.some((r) => r.id === "styremedlem-1925" && r.from === "1925" && r.to === "1925")).toBe(true);
    expect(larsTosse?.roles.some((r) => r.id === "styremedlem-1927" && r.from === "1927" && r.to === "1927")).toBe(true);
    expect(larsTosse?.roles.some((r) => r.id === "styremedlem-1930" && r.from === "1930" && r.to === "1930")).toBe(true);
    expect(larsTosse?.roles.some((r) => r.id === "styremedlem-1931" && r.from === "1931" && r.to === "1931")).toBe(true);
    expect(larsTosse?.roles.some((r) => r.id === "revisor-1933")).toBe(true);
    expect(larsTosse?.roles.some((r) => r.id === "banekomite-1939-1940")).toBe(true);

    // Karl Løvold
    const karlLovold = archive.people.find((p) => p.id === "karl-lovold");
    expect(karlLovold).toBeDefined();
    expect(karlLovold?.roles.some((r) => r.id === "a-lagsspiller-1931-1947" && r.from === "1931" && r.to === "1947")).toBe(true);

    // Olav Skarbøvik
    const olavSkarbovik = archive.people.find((p) => p.id === "olav-skarbovik");
    expect(olavSkarbovik).toBeDefined();
    expect(olavSkarbovik?.roles.some((r) => r.id === "a-lagsspiller-1929-1938" && r.from === "1929" && r.to === "1938")).toBe(true);

    // Trygve Olsen debut 1936
    const trygveOlsen = archive.people.find((p) => p.id === "trygve-olsen");
    expect(trygveOlsen?.roles.some((r) => r.id === "a-lagsspiller-1936" && r.from === "1936")).toBe(true);

    // Overganger høsten 1950
    const reidar = archive.people.find((p) => p.id === "reidar-skarbovik");
    expect(reidar?.roles.some((r) => r.id === "overgang-frigg-1950")).toBe(true);

    const hjelle = archive.people.find((p) => p.id === "knut-hjelle");
    expect(hjelle?.roles.some((r) => r.id === "overgang-volda-1950")).toBe(true);

    const odegaard = archive.people.find((p) => p.id === "helge-odegaard");
    expect(odegaard?.roles.some((r) => r.id === "overgang-wing-1950")).toBe(true);

    const henriksen = archive.people.find((p) => p.id === "hans-j-henriksen");
    expect(henriksen?.roles.some((r) => r.id === "overgang-wing-1950")).toBe(true);
  });

  it("dokumenterer historiske observasjoner for Kråmyra og Dameavdelingen", () => {
    const kramyraSpade = archive.historicalObservations.find((o) => o.id === "1950-kramyra-forste-spadestikk");
    expect(kramyraSpade).toBeDefined();
    expect(kramyraSpade?.date).toBe("1950-05-24");
    expect(kramyraSpade?.personIds).toContain("emil-sando");

    const kramyrUka = archive.historicalObservations.find((o) => o.id === "1950-kramyr-uka-markedsuke");
    expect(kramyrUka).toBeDefined();
    expect(kramyrUka?.date).toBe("1950-11-11");
    expect(kramyrUka?.personIds).toContain("alfhild-ringdal");

    const dameStiftelse = archive.historicalObservations.find((o) => o.id === "1946-dameavdelingen-stiftelse");
    expect(dameStiftelse).toBeDefined();
    expect(dameStiftelse?.date).toBe("1946-03-21");
    expect(dameStiftelse?.personIds).toContain("irma-ingebrigtsen");
  });

  it("dokumenterer samtidige og retrospektive kilderesultater fordelt på faktiske historiske år", () => {
    const sresHefte3 = archive.sourceResults.find((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1950-62fa");
    expect(sresHefte3).toBeDefined();
    expect(sresHefte3?.seasons[0]?.results.length).toBe(7);

    const sresHefte4 = archive.sourceResults.find((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1950-3b73");
    expect(sresHefte4).toBeDefined();
    expect(sresHefte4?.seasons[0]?.results.length).toBe(2);

    const sresHefte5 = archive.sourceResults.find((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1950-37d9");
    expect(sresHefte5).toBeDefined();
    expect(sresHefte5?.seasons[0]?.results.length).toBe(1);

    const sresHefte6 = archive.sourceResults.find((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1950-083e");
    expect(sresHefte6).toBeDefined();
    // Inneholder retrospektive kamper fra 1927, 1932 og 1940
    expect(sresHefte6?.seasons.some((s) => s.year === 1927)).toBe(true);
    expect(sresHefte6?.seasons.some((s) => s.year === 1932)).toBe(true);
    expect(sresHefte6?.seasons.some((s) => s.year === 1940 && s.results.length === 5)).toBe(true);
  });
});
