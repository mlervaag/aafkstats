import { describe, expect, it } from "vitest";
import { canonicalClubKey, clubKey, clubNameForms, personKey, preferredPersonName, slugify } from "../src/identity.js";

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

describe("personKey", () => {
  it("slår sammen skrivemåtene kilden veksler mellom", () => {
    // 2014-sesongen har begge som hovedtrener, og de er én mann. Uten dette
    // viser trenerhistorikken to trenere det året.
    expect(personKey("Jan Jönsson")).toBe(personKey("Jan Joensson"));
    expect(personKey("Tor Hogne Aarøy")).toBe(personKey("Tor Hogne Aaroey"));
    expect(personKey("Henrik Rørvik Bjørdal")).toBe(personKey("Henrik Roervik Bjoerdal"));
    expect(personKey("Isak Dybvik Määttä")).toBe(personKey("Isak Dybvik Maeaettae"));
    expect(personKey("Jonatan Tollås Nation")).toBe(personKey("Jonatan Tollaas Nation"));
    expect(personKey("Ólafur Gudmundsson")).toBe(personKey("Olafur Gudmundsson"));
  });

  it("slår ikke sammen navn som bare ligner", () => {
    // Kan være samme mann feilstavet, og kan være to menn. Det spørsmålet skal
    // et menneske svare på; data:duplicates rapporterer paret.
    expect(personKey("Mathias Kristensen")).not.toBe(personKey("Mathias Christensen"));
    expect(personKey("Lars Nilsen")).not.toBe(personKey("Lars Nielsen"));
  });

  it("stryker ikke ledd slik klubbnøkkelen gjør", () => {
    // «Å stryke ledd av et personnavn ville vært å gjette på hva som er fornavn
    // og hva som er tittel.» IK er en klubbforkortelse, ikke støy i et navn.
    expect(personKey("Ik Hansen")).not.toBe(personKey("Hansen"));
  });

  it("er ufølsom for store bokstaver og ekstra mellomrom", () => {
    expect(personKey("  KJETIL   Rekdal ")).toBe(personKey("Kjetil Rekdal"));
  });
});

describe("preferredPersonName", () => {
  it("velger den skrevne formen framfor omskrivingen", () => {
    // Selv når omskrivingen er den vanligste. «Määttä» er navnet.
    expect(preferredPersonName([
      { name: "Isak Dybvik Maeaettae", count: 9 },
      { name: "Isak Dybvik Määttä", count: 2 },
    ])).toBe("Isak Dybvik Määttä");
  });

  it("velger den norske bokstaven, ikke bare den med aksent", () => {
    expect(preferredPersonName([
      { name: "Tor Hogne Aaroey", count: 40 },
      { name: "Tor Hogne Aarøy", count: 3 },
    ])).toBe("Tor Hogne Aarøy");
  });

  it("faller tilbake på hyppighet når begge er skrevet likt", () => {
    expect(preferredPersonName([
      { name: "Kjetil Rekdal", count: 2 },
      { name: "Kjetil A. Rekdal", count: 9 },
    ])).toBe("Kjetil A. Rekdal");
  });

  it("gir samme svar uansett rekkefølge inn", () => {
    // Ellers avhenger navnet på sida av hvilken kamp som ble lest først.
    const variants = [{ name: "Ola Nordmann", count: 5 }, { name: "Ola Nordman", count: 5 }];
    expect(preferredPersonName(variants)).toBe(preferredPersonName([...variants].reverse()));
  });
});
