import { describe, expect, it } from "vitest";
import { knownPeople, resolveRoles } from "../src/adapters/nb-roles.js";

const people = knownPeople([
  { id: "ola-nordmann", name: "Ola Nordmann", names: [] },
  { id: "kari-nordmann", name: "Kari Nordmann", names: ["Kari N. Nordmann"] },
]);

function resolve(text: string, lines = [text]) {
  return resolveRoles(lines, text, { sourceId: "en-kilde", page: "12", column: 0, people, publicationYear: 1970 });
}

describe("resolveRoles", () => {
  /**
   * Regelen hele andre gjennomgang står på. I kandidatlaget ble et rolleord
   * parret med hvilket som helst navn på samme OCR-linje, og på en tospaltet
   * side kom det navnet fra nabospalten. Her skal hvert verv få navnet som
   * står *etter* det, og ingen andre.
   */
  it("gir hvert verv navnet som følger etter det", () => {
    const roles = resolve("Styret fikk i 1962 følgende sammensetning: Formann, Ola Nordmann, nestformann, Kari Nordmann, kasserer, Per Hansen.");
    expect(roles.map((role) => [role.title, role.personName])).toEqual([
      ["Nestformann", "Kari Nordmann"],
      ["Formann", "Ola Nordmann"],
      ["Kasserer", "Per Hansen"],
    ]);
  });

  it("lar «nestformann» slå «formann» på samme sted", () => {
    const roles = resolve("I 1958 var nestformann, Kari Nordmann, med i utvalget.");
    expect(roles.map((role) => role.title)).toEqual(["Nestformann"]);
  });

  it("leser navnet foran tittelen når setningen er snudd", () => {
    const roles = resolve("Klubben ble stiftet i 1914 med Ola Nordmann som dens første formann.");
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ title: "Formann", personName: "Ola Nordmann", from: "1914", rule: "name_then_role" });
  });

  it("leser en formannsrekke rad for rad", () => {
    const lines = ["Formennene gjennom årene", "1917 Ola Nordmann", "1918—19 Kari Nordmann", "1921 Per Hansen"];
    const roles = resolveRoles(lines, lines.join(" "), { sourceId: "en-kilde", page: "18", people, publicationYear: 1939 });
    expect(roles.filter((role) => role.rule === "year_row").map((role) => [role.personName, role.from, role.to])).toEqual([
      ["Kari Nordmann", "1918", "1919"],
      ["Ola Nordmann", "1917", null],
      ["Per Hansen", "1921", null],
    ]);
  });

  describe("hvor sikker lesningen er", () => {
    it("er sikker bare når både året og personen er kjent", () => {
      const [role] = resolve("Årsmøtet i 1962 valgte formann, Ola Nordmann.");
      expect(role).toMatchObject({ confidence: "high", personId: "ola-nordmann", from: "1962" });
    });

    it("er middels når året mangler", () => {
      const [role] = resolve("Møtet valgte formann, Ola Nordmann.");
      expect(role).toMatchObject({ confidence: "medium", personId: "ola-nordmann" });
      expect(role?.from).toBeUndefined();
    });

    it("er middels når personen er ukjent", () => {
      const [role] = resolve("Årsmøtet i 1962 valgte formann, Petter Ukjent.");
      expect(role).toMatchObject({ confidence: "medium", from: "1962" });
      expect(role?.personId).toBeUndefined();
    });

    it("kjenner igjen en alternativ skrivemåte fra registeret", () => {
      const [role] = resolve("I 1962 ble kasserer, Kari N. Nordmann, valgt.");
      expect(role?.personId).toBe("kari-nordmann");
    });
  });

  describe("årstallet som følger med", () => {
    it("tar aldri et årstall som ligger langt unna treffet", () => {
      const far = `Sesongen 1935 var krevende. ${"Klubben spilte mange kamper det året. ".repeat(6)}Så ble formann, Ola Nordmann, takket av.`;
      expect(resolve(far)[0]?.from).toBeUndefined();
    });

    it("forkaster et årstall som er yngre enn publikasjonen", () => {
      // Et sidetall eller et telefonnummer kan se ut som et årstall. Utgivelsen
      // setter den øvre grensen for hva som kan være et verv omtalt i boka.
      expect(resolve("Etter 1998 ble formann, Ola Nordmann, valgt.")[0]?.from).toBeUndefined();
    });
  });

  describe("hva som ikke er et navn", () => {
    it("plukker ikke opp klubbnavn og fellesord", () => {
      expect(resolve("Klubbens formann, Aalesunds Fotballklubb, takket for seg.")).toEqual([]);
    });

    it("plukker ikke opp overskrifter i versaler", () => {
      expect(resolve("FORMANN OG STYRE GJENNEM ÅRENE")).toEqual([]);
    });

    it("krever minst to ledd i navnet", () => {
      expect(resolve("Valgt ble formann, Ola.")).toEqual([]);
    });
  });

  it("teller ikke samme verv to ganger når to regler treffer", () => {
    const roles = resolve("I 1914 ble Ola Nordmann valgt som formann, Ola Nordmann satt lenge.");
    expect(roles.filter((role) => role.title === "Formann" && role.personName === "Ola Nordmann")).toHaveLength(1);
  });

  it("gir samme ID for samme lesning to ganger", () => {
    const text = "Årsmøtet i 1962 valgte formann, Ola Nordmann.";
    expect(resolve(text)[0]?.id).toBe(resolve(text)[0]?.id);
  });
});

describe("rekker i løpende tekst", () => {
  /**
   * Formannsrekka i jubileumsskriftet fra 1939 står slik, på trykt side 18.
   * «1914 og 1915» er én periode, ikke to verv — piloten førte den som
   * from 1914, to 1915, og maskinen skal lese den likt.
   */
  it("leser «Formenn: Navn år og år Navn år»", () => {
    const text = "det har i årenes løp vært følgende: Formenn: Ola Nordmann 1925 og 1926 Kari Nordmann 1927";
    const roles = resolve(text);
    expect(roles.map((role) => [role.personName, role.title, role.from, role.to, role.rule])).toEqual([
      ["Kari Nordmann", "Formann", "1927", null, "name_then_year"],
      ["Ola Nordmann", "Formann", "1925", "1926", "name_then_year"],
    ]);
  });

  it("kjenner igjen skrivemåten «Opmenn» fra før rettskrivingsreformen", () => {
    const [role] = resolve("Opmenn: Ola Nordmann 1931");
    expect(role).toMatchObject({ title: "Oppmann", from: "1931" });
  });

  it("stopper ved neste overskrift", () => {
    const roles = resolve("Formenn: Ola Nordmann 1925 Opmenn: Kari Nordmann 1931");
    expect(roles.map((role) => [role.personName, role.title])).toEqual([
      ["Kari Nordmann", "Oppmann"],
      ["Ola Nordmann", "Formann"],
    ]);
  });

  it("tar ikke med navn som står langt etter rekka", () => {
    const roles = resolve(`Formenn: Ola Nordmann 1925${" fyll ".repeat(90)}Kari Nordmann 1931`);
    expect(roles.map((role) => role.personName)).toEqual(["Ola Nordmann"]);
  });
});

describe("årstall som står etter rolleordet", () => {
  /**
   * Setningen står på side 4 i 35-årsboka fra 1950. Leter man bare bakover
   * etter et årstall, tar «spilte som aktiv fra 1914 til 1919» sekretærvervet,
   * og Nils Jangaard blir sekretær i 1919 i stedet for 1915 — fire år feil,
   * skrevet inn i arkivet som et faktum.
   */
  it("tar året som følger vervet, ikke det som står foran", () => {
    const text = "Han spilte som aktiv fra 1914 til 1919. Nils Jangaard ble valgt til sekretær i 1915.";
    const roles = resolveRoles([text], text, { sourceId: "s", page: "4", people, publicationYear: 1950 });
    expect(roles.filter((role) => role.title === "Sekretær").map((role) => role.from)).toEqual(["1915"]);
  });

  it("faller tilbake på året foran når ingen følger", () => {
    const text = "Årsmøtet i 1962 samlet mange medlemmer. Ola Nordmann ble formann.";
    const [role] = resolveRoles([text], text, { sourceId: "s", page: "1", people, publicationYear: 1970 });
    expect(role?.from).toBe("1962");
  });
});

describe("verv i noe annet enn klubben", () => {
  it("tar ikke med et formannsverv i en annen klubb", () => {
    // «Som formann i «Frigg» visste han hvordan arbeidet skulle legges opp» —
    // vervet er ekte, men det er ikke AaFKs.
    const text = "Ola Nordmann var formann i «Frigg» i 1910 før han kom hit.";
    expect(resolveRoles([text], text, { sourceId: "s", page: "1", people, publicationYear: 1950 })).toEqual([]);
  });

  it("tar ikke med et verv i en underkomité som om det var klubbens", () => {
    const text = "Ola Nordmann ble formann i banekomiteen i 1951.";
    expect(resolveRoles([text], text, { sourceId: "s", page: "1", people, publicationYear: 1960 })).toEqual([]);
  });

  it("lar «ble formann i 1917» stå — der er «i» et årstall, ikke et organ", () => {
    const text = "Ola Nordmann ble formann i 1917.";
    const [role] = resolveRoles([text], text, { sourceId: "s", page: "1", people, publicationYear: 1950 });
    expect(role).toMatchObject({ title: "Formann", from: "1917" });
  });
});

describe("hvilket organ vervet hører til", () => {
  function medSide(text: string, pageContext = text) {
    return resolveRoles([text], text, { sourceId: "s", page: "76", people, publicationYear: 1970, pageContext });
  }

  it("setter organet når siden sier hvilket", () => {
    const [role] = medSide("Banekomiteen la fram sitt forslag i 1951. Formann, Ola Nordmann, la fram saken.");
    expect(role).toMatchObject({ title: "Formann", body: "Banekomiteen" });
  });

  it("skriver ikke hovedstyret på rollen — det er standarden", () => {
    const [role] = medSide("Hovedstyret møttes i 1951. Formann, Ola Nordmann, åpnet møtet.");
    expect(role?.body).toBeUndefined();
  });

  /**
   * Side 76 i 50-årsboka lister et styre som ser ut som klubbens, men er Eldres
   * gruppes. Siden nevner både «Eldres gruppe» og «Arbeidsutvalget», så vi kan
   * ikke si hvilket vervet hører til — og da skal det ikke kunne løftes
   * automatisk inn som om han ledet klubben.
   */
  it("senker sikkerheten når siden nevner flere organer og ingen kan tilordnes", () => {
    const spalte = "Den fikk følgende sammensetning: Formann, Ola Nordmann, nestformann, Kari Nordmann.";
    const side = `Møte om dannelse av en Eldres gruppe i klubben. Arbeidsutvalget hadde laget et forslag. Styret skulle fungere til neste årsmøte i 1964. ${spalte}`;
    const [role] = resolveRoles([spalte], spalte, {
      sourceId: "s", page: "76", people, publicationYear: 1964, pageContext: side,
    });
    expect(role?.confidence).not.toBe("high");
  });

  it("lar en side uten organer være i fred", () => {
    const text = "Årsmøtet i 1962 valgte formann, Ola Nordmann.";
    const [role] = medSide(text);
    expect(role).toMatchObject({ confidence: "high" });
    expect(role?.body).toBeUndefined();
  });

  it("henter organet fra en annen spalte når spalten selv ikke sier det", () => {
    const spalte = "Årsmøtet i 1951 valgte formann, Ola Nordmann.";
    const side = `Stykket handler om banekomiteen og arbeidet der. ${spalte}`;
    const [role] = resolveRoles([spalte], spalte, {
      sourceId: "s", page: "76", people, publicationYear: 1970, pageContext: side,
    });
    expect(role?.body).toBe("Banekomiteen");
  });
});

describe("rolleord satt sammen med en annen klubb", () => {
  /**
   * «Etter AaFKs kamp mot Rosenborg i 2013, ga RBK-trener Per Joar Hansen denne
   * karakteristikken» — Tango siden 1914, side 260. Uten denne prøven ble han
   * ført som AaFKs trener i 2013, samtidig som arkivets egne kampdata sier at
   * Jan Jönsson ledet laget i 30 kamper det året.
   */
  it("tar ikke en annen klubbs trener", () => {
    const text = "Etter AaFKs kamp mot Rosenborg i 2013, ga RBK-trener Per Joar Hansen denne karakteristikken.";
    expect(resolve(text)).toEqual([]);
  });

  it("tar vår egen når prefikset er klubben selv", () => {
    const [role] = resolve("I 1966 uttalte AaFK-trener Ola Nordmann seg om saken.");
    expect(role).toMatchObject({ title: "Trener", personName: "Ola Nordmann" });
  });

  it("plukker ikke et rolleord som står midt i et annet ord", () => {
    expect(resolve("Klubben hadde en assistenttrener Ola Nordmann i 1970.")).toEqual([]);
  });
});
