import { describe, expect, it } from "vitest";
import { canonicalClubKey, clubKey, clubNameForms, isLongerNameForm, personKey, preferredPersonName, slugify } from "../src/identity.js";

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

  it("stryker flere ledd i samme ende", () => {
    // Dette var feilen: ett strøk per ende holdt så lenge navnene hadde ett
    // ledd. NFF Fotballdata skriver dem med to, og «Spjelkavik IL - Fotball»
    // stoppet på «spjelkavik-il». Fire klubber lå dobbelt i arkivet fordi
    // valideringen aldri så at de var samme identitet.
    expect(clubKey("Spjelkavik IL - Fotball")).toBe(clubKey("Spjelkavik"));
    expect(clubKey("Skarbøvik IL- Fotball")).toBe(clubKey("Skarbøvik"));
    expect(clubKey("Stranda IL - Fotball")).toBe(clubKey("Stranda"));
    expect(clubKey("Ørsta IL - Fotball")).toBe(clubKey("Ørsta"));
  });

  it("tømmer ikke et navn som bare består av støyledd", () => {
    // En tom nøkkel ville gjort alle slike klubber til samme identitet.
    expect(clubKey("IL")).toBe("il");
    expect(clubKey("FK")).toBe("fk");
    expect(clubKey("IL Fotball")).not.toBe("");
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

  it("prioriterer eksplisitt identityKey", () => {
    const kfk = {
      id: "kfk",
      name: "Kristiansund Fotballklubb",
      identityKey: "kristiansund-fk",
    };
    const kbk = {
      id: "kristiansund",
      name: "Kristiansund Ballklubb",
      identityKey: "kristiansund-bk",
    };
    expect(canonicalClubKey(kfk)).toBe("kristiansund-fk");
    expect(canonicalClubKey(kbk)).toBe("kristiansund-bk");
    expect(canonicalClubKey(kfk)).not.toBe(canonicalClubKey(kbk));
  });

  it("faller tilbake til ID-en når navnet er tomt", () => {
    expect(canonicalClubKey({ id: "en-klubb", name: "" })).toBe("en-klubb");
  });
});

describe("clubNameForms", () => {
  it("tar med ID, navn, kortnavn, historiske navn og navnevarianter", () => {
    const forms = clubNameForms({
      id: "kfk",
      name: "Kristiansund Fotballklubb",
      shortName: "KFK",
      names: [{ name: "KFK" }],
      nameVariants: ["K.F.K.", "K. F. K.", "Kristiansunds Fotballklub"],
    });
    expect(forms).toEqual([
      "kfk",
      "Kristiansund Fotballklubb",
      "KFK",
      "KFK",
      "K.F.K.",
      "K. F. K.",
      "Kristiansunds Fotballklub",
    ]);
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

  it("translittererer bokstaver som ikke er en latinsk bokstav med et tegn på", () => {
    // NFD har ingenting å dekomponere for disse, så uten egne linjer ble de
    // strøket til ingenting: «Þrándarson» ble `randarson` og «Međimorec» ble
    // `me imorec`. Personfila og lagoppstillingen fikk hver sin nøkkel selv når
    // de skrev nøyaktig samme navn, og fem spillere sto med tom side.
    expect(personKey("Aron Elís Þrándarson")).toBe(personKey("Aron Elis Thrandarson"));
    expect(personKey("Vinko Međimorec")).toBe(personKey("Vinko Medimorec"));
    expect(personKey("Davíð Jóhannsson")).toBe(personKey("David Johannsson"));
    // Og det viktigste: bokstaven forsvinner ikke, slik at to ulike navn ikke
    // blir like fordi begge mistet et tegn.
    expect(personKey("Þrándarson")).toBe("thrandarson");
    expect(personKey("Međimorec")).toBe("medimorec");
    expect(personKey("Guðmundsson")).toBe("gudmundsson");
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

describe("isLongerNameForm", () => {
  it("kjenner igjen kildens form med mellomnavn", () => {
    // Den som faktisk sto i arkivet: personfila het «Sten Grytebust», FotMob
    // skrev «Sten Michael Grytebust», og personsida viste null av 284 kamper.
    expect(isLongerNameForm("Sten Grytebust", "Sten Michael Grytebust")).toBe(true);
    expect(isLongerNameForm("Tor Erik Larsen", "Tor Erik Valderhaug Larsen")).toBe(true);
    expect(isLongerNameForm("Paul Ngongo", "Paul Ngongo Iversen")).toBe(true);
  });

  it("bryr seg ikke om rekkefølgen, siden noen kilder skriver etternavnet først", () => {
    expect(isLongerNameForm("Sten Grytebust", "Grytebust, Sten Michael")).toBe(true);
  });

  it("ser gjennom skrivemåten, slik personKey gjør", () => {
    expect(isLongerNameForm("Tor Hogne Aarøy", "Tor Hogne Berg Aaroey")).toBe(true);
  });

  it("er ikke sann for to navn som bare deler et ord", () => {
    expect(isLongerNameForm("Jan Hansen", "Jan Berg Nilsen")).toBe(false);
    expect(isLongerNameForm("Mathias Kristensen", "Mathias Berg Christensen")).toBe(false);
  });

  it("krever to ord, ellers ville hvert fornavn blitt en kandidat", () => {
    expect(isLongerNameForm("Ole", "Ole Hansen Berg")).toBe(false);
  });

  it("er usann begge veier for samme navn", () => {
    expect(isLongerNameForm("Kjetil Rekdal", "Kjetil Rekdal")).toBe(false);
    expect(isLongerNameForm("Sten Michael Grytebust", "Sten Grytebust")).toBe(false);
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
