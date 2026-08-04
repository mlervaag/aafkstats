import { describe, expect, it } from "vitest";
import { canonicalClubKey, clubKey, clubNameForms, slugify } from "../src/identity.js";

/**
 * Klubbidentitet er det ene stedet der en for løs regel og en for streng regel
 * feiler på hver sin måte, og bare den ene er synlig.
 *
 * For streng: samme klubb får to identiteter, arkivet får en dublett, og
 * valideringen sier fra. Ubehagelig, men fanget.
 *
 * For løs: to klubber blir én, kampene deres slås sammen, og innbyrdes
 * statistikk blir gal uten at noe feiler noe sted. Det er den farlige retningen,
 * og derfor er halvparten av testene under negative.
 */
describe("clubKey", () => {
  it("stryker forkortelsen enten den står foran eller bak", () => {
    // Dette var feilen: bare den bakerste ble strøket, så «Kristiansund BK»
    // fant «Kristiansund» mens «FK Haugesund» ikke fant «Haugesund».
    expect(clubKey("FK Haugesund")).toBe("haugesund");
    expect(clubKey("Haugesund")).toBe("haugesund");
    expect(clubKey("Haugesund FK")).toBe("haugesund");
    expect(clubKey("Kristiansund BK")).toBe(clubKey("Kristiansund"));
    expect(clubKey("SK Brann")).toBe(clubKey("Brann"));
    expect(clubKey("FK Sykkylven")).toBe(clubKey("Sykkylven"));
  });

  it("stryker bare ledd som står som eget ord", () => {
    // Uten bindestrekskravet i mønsteret blir «Skeid» til «eid».
    expect(clubKey("Skeid")).toBe("skeid");
    expect(clubKey("Ifjord")).toBe("ifjord");
    expect(clubKey("Fklubben")).toBe("fklubben");
    expect(clubKey("Bkilen")).toBe("bkilen");
  });

  it("slår ikke sammen klubber som bare deler et navneledd", () => {
    expect(clubKey("Vard Haugesund")).not.toBe(clubKey("Haugesund"));
    expect(clubKey("Odd")).not.toBe(clubKey("Hødd"));
    expect(clubKey("Strømsgodset")).not.toBe(clubKey("Godset"));
  });

  it("håndterer norske bokstaver likt i begge retninger", () => {
    expect(clubKey("Hødd")).toBe("hodd");
    expect(clubKey("Vålerenga")).toBe("valerenga");
    expect(clubKey("Bodø/Glimt")).toBe("bodo-glimt");
  });
});

describe("canonicalClubKey", () => {
  it("bruker navnet, ikke ID-en", () => {
    // ID-en er historisk tilfeldig — den kom fra den kilden som fant klubben
    // først. Navnet er det som faktisk beskriver klubben.
    expect(canonicalClubKey({ id: "fk-haugesund", name: "FK Haugesund" })).toBe("haugesund");
  });

  it("faller tilbake til ID-en når navnet er tomt", () => {
    expect(canonicalClubKey({ id: "en-klubb", name: "" })).toBe("en-klubb");
  });
});

describe("clubNameForms", () => {
  it("tar med ID, navn, kortnavn og historiske navn", () => {
    const forms = clubNameForms({
      id: "odds-ballklubb",
      name: "Odds Ballklubb",
      shortName: "Odd",
      names: [{ name: "Odd Grenland" }],
    });
    expect(forms).toEqual(["odds-ballklubb", "Odds Ballklubb", "Odd", "Odd Grenland"]);
  });

  it("hopper over felt som ikke er satt", () => {
    expect(clubNameForms({ id: "brann", name: "SK Brann" })).toEqual(["brann", "SK Brann"]);
  });
});

describe("slugify", () => {
  it("translittererer før den fjerner tegn", () => {
    // Uten translittereringen først faller æøå ut helt, og «Bodø» blir «bod».
    // Merk at å blir én a, ikke to: klubb-ID-en aalesunds-fk kommer fra klubbens
    // egen skrivemåte «Aalesunds FK», ikke fra en aa-regel her.
    expect(slugify("Ålesund")).toBe("alesund");
    expect(slugify("Aalesunds FK")).toBe("aalesunds-fk");
    expect(slugify("Bodø/Glimt")).toBe("bodo-glimt");
    expect(slugify("Nærbø")).toBe("naerbo");
    expect(slugify("  Rosenborg  ")).toBe("rosenborg");
  });
});
