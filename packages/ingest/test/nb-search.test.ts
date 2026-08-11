import { describe, expect, it } from "vitest";
import { mergeOverlapping, resolveRolesFromSearch, searchTerms } from "../src/adapters/nb-search.js";
import { knownPeople } from "../src/adapters/nb-roles.js";

const people = knownPeople([
  { id: "ola-nordmann", name: "Ola Nordmann", names: [] },
  { id: "kari-nordmann", name: "Kari Nordmann", names: [] },
]);

function hit(page: string, before: string, match: string, after: string) {
  return { page, before, match, after };
}

describe("searchTerms", () => {
  it("søker på både rolleord og navnene i registeret", () => {
    const terms = searchTerms(people);
    expect(terms).toContain("formann");
    expect(terms).toContain("Ola Nordmann");
  });

  it("kan la navnene være", () => {
    expect(searchTerms(people, { names: false })).not.toContain("Ola Nordmann");
  });
});

describe("mergeOverlapping", () => {
  /**
   * Hvert søkeord gir sitt eget vindu rundt treffet. Overlapper de, er det
   * samme avsnitt sett to steder fra, og satt sammen igjen gjenoppstår
   * rekkefølgen i boka.
   */
  it("limer to vinduer på overlappet", () => {
    expect(mergeOverlapping([
      "Formenn: Ola Nordmann 1925 og 1926 Kari",
      "Ola Nordmann 1925 og 1926 Kari Nordmann 1927 Per Hansen 1928",
    ])).toEqual(["Formenn: Ola Nordmann 1925 og 1926 Kari Nordmann 1927 Per Hansen 1928"]);
  });

  it("slår sammen et vindu som ligger helt inni et annet", () => {
    expect(mergeOverlapping(["Formenn: Ola Nordmann 1925", "Ola Nordmann"])).toEqual(["Formenn: Ola Nordmann 1925"]);
  });

  it("lar vinduer som ikke hører sammen være to", () => {
    expect(mergeOverlapping([
      "Formenn: Ola Nordmann 1925 og 1926 lenge etterpå",
      "Et helt annet avsnitt et helt annet sted i boka",
    ])).toHaveLength(2);
  });

  it("limer ikke på et tilfeldig kort sammenfall", () => {
    // «og» finnes i begge, men to bokstaver er ikke samme tekst.
    expect(mergeOverlapping(["Klubben og", "og laget"])).toHaveLength(2);
  });
});

describe("resolveRolesFromSearch", () => {
  it("leser en rekke som står som løpende tekst etter en overskrift", () => {
    const roles = resolveRolesFromSearch([
      hit("18", "må nevnes og det har i årenes løp vært følgende:", "Formenn:", "Ola Nordmann 1925 og 1926 Kari Nordmann 1927"),
    ], { sourceId: "en-kilde", people, publicationYear: 1939 });

    expect(roles.map((role) => [role.personName, role.title, role.from, role.to])).toEqual([
      ["Kari Nordmann", "Formann", "1927", null],
      ["Ola Nordmann", "Formann", "1925", "1926"],
    ]);
  });

  /**
   * Side 18 i 1939-boka har «Formenn:» og «Opmenn:» rett etter hverandre. Uten
   * en grense ved neste overskrift fikk hvert navn begge vervene, og
   * halvparten av de sikre rollene var slike dubletter.
   */
  it("lar ikke den ene rekka løpe inn i den neste", () => {
    const roles = resolveRolesFromSearch([
      hit("18", "vært følgende:", "Formenn:", "Ola Nordmann 1925 Opmenn: Kari Nordmann 1931"),
    ], { sourceId: "en-kilde", people, publicationYear: 1939 });

    expect(roles.map((role) => [role.personName, role.title])).toEqual([
      ["Kari Nordmann", "Oppmann"],
      ["Ola Nordmann", "Formann"],
    ]);
  });

  it("bruker sidetallet treffet kom med", () => {
    const [role] = resolveRolesFromSearch([
      hit("18", "vært følgende:", "Formenn:", "Ola Nordmann 1925"),
    ], { sourceId: "en-kilde", people, publicationYear: 1939 });
    expect(role?.page).toBe("18");
  });

  it("teller ikke samme avsnitt to ganger når to søkeord traff i det", () => {
    const context = ["vært følgende:", "Formenn:", "Ola Nordmann 1925 og 1926"] as const;
    const roles = resolveRolesFromSearch([
      hit("18", ...context),
      hit("18", ...context),
    ], { sourceId: "en-kilde", people, publicationYear: 1939 });
    expect(roles).toHaveLength(1);
  });

  it("forkaster et årstall som er yngre enn publikasjonen", () => {
    expect(resolveRolesFromSearch([
      hit("18", "vært følgende:", "Formenn:", "Ola Nordmann 1998"),
    ], { sourceId: "en-kilde", people, publicationYear: 1939 })).toEqual([]);
  });
});
