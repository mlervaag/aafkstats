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
