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

    // Banekomiteen 1950
    expect(snap1950?.people.find((p) => p.observedTitle === "Formann" && p.body === "Banekomiteen")?.personId).toBe("emil-sando");
    expect(snap1950?.people.find((p) => p.personId === "sigurd-norve" && p.body === "Banekomiteen")).toBeDefined();
    expect(snap1950?.people.find((p) => p.personId === "oivind-haagensen" && p.body === "Banekomiteen")).toBeDefined();

    // Dameavdelingen 1950
    expect(snap1950?.people.find((p) => p.observedTitle === "Formann" && p.body === "Dameavdelingen")?.personId).toBe("alfhild-ringdal");
    expect(snap1950?.people.find((p) => p.observedTitle === "Nestformann" && p.body === "Dameavdelingen")?.personId).toBe("mary-vegsund");
    expect(snap1950?.people.find((p) => p.observedTitle === "Sekretær" && p.body === "Dameavdelingen")?.personId).toBe("anita-olsen");
    expect(snap1950?.people.find((p) => p.observedTitle === "Kasserer" && p.body === "Dameavdelingen")?.personId).toBe("aase-gudmundseth");

    // Medlemsbladet
    expect(snap1950?.people.find((p) => p.observedTitle === "Ansvarshavende" && p.body === "Medlemsbladet")?.personId).toBe("lauritz-giske");
  });

  it("dokumenterer roller og tillitsverv for nye og berikede personer", () => {
    // Karl Løvold
    const karlLovold = archive.people.find((p) => p.id === "karl-lovold");
    expect(karlLovold).toBeDefined();
    expect(karlLovold?.roles.some((r) => r.id === "a-lagsspiller-1931-1947" && r.from === "1931" && r.to === "1947")).toBe(true);

    // Olav Skarbøvik
    const olavSkarbovik = archive.people.find((p) => p.id === "olav-skarbovik");
    expect(olavSkarbovik).toBeDefined();
    expect(olavSkarbovik?.roles.some((r) => r.id === "a-lagsspiller-1929-1938" && r.from === "1929" && r.to === "1938")).toBe(true);

    // Lars Tøsse
    const larsTosse = archive.people.find((p) => p.id === "lars-tosse");
    expect(larsTosse).toBeDefined();
    expect(larsTosse?.roles.some((r) => r.id === "aeresmedlem-1939")).toBe(true);

    // Asbjørn Korsnes som klubbarkivar
    const korsnes = archive.people.find((p) => p.id === "asbjorn-korsnes");
    expect(korsnes?.roles.some((r) => r.id === "arkivar-1951")).toBe(true);

    // Øivind Haagensen som A-lagsspiller 1930-1949
    const haagensen = archive.people.find((p) => p.id === "oivind-haagensen");
    expect(haagensen?.roles.some((r) => r.id === "a-lagsspiller-1930-1949")).toBe(true);

    // Ingvald Frøysa som målvakt 1923-1928
    const froysa = archive.people.find((p) => p.id === "ingvald-froysa");
    expect(froysa?.roles.some((r) => r.id === "a-lagskeeper-1923-1928")).toBe(true);
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

  it("dokumenterer kilderesultater for 1950 i hefte 3 og hefte 5", () => {
    const sresHefte3 = archive.sourceResults.find((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1950-62fa");
    expect(sresHefte3).toBeDefined();
    expect(sresHefte3?.seasons[0]?.results.length).toBe(7);

    const sresHefte5 = archive.sourceResults.find((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1950-37d9");
    expect(sresHefte5).toBeDefined();
    expect(sresHefte5?.seasons[0]?.results.length).toBe(1);
  });
});
