import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import type { Source } from "@aafkstats/schema";
import { altoLines, candidatesForPage } from "../src/adapters/nb-publications.js";

describe("NB-publikasjonsuttrekk", () => {
  it("leser tekstlinjer fra ALTO uten å bevare XML", () => {
    const xml = `<alto><Layout><TextLine><String CONTENT="Nils"/><SP/><String CONTENT="Jangaard"/></TextLine><TextLine><String CONTENT="formann"/></TextLine></Layout></alto>`;
    expect(altoLines(xml)).toEqual(["Nils Jangaard", "formann"]);
  });

  it("lager kildebelagte faktatokens for kjente personer og verv", () => {
    const archive = {
      people: [{ id: "nils-jangaard", name: "Nils Jangaard", names: [] }],
      matches: [],
      clubs: [],
    } as unknown as Archive;
    const source = { id: "testkilde", title: "Test", sourceType: "book", year: 1950, providers: [] } satisfies Source;
    const candidates = candidatesForPage(archive, source, "4", ["Formann Nils Jangaard 1950"]);
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "person_role", page: "4", personIds: ["nils-jangaard"], years: [1950], keywords: ["formann"] }),
    ]));
    expect(JSON.stringify(candidates)).not.toContain("Formann Nils Jangaard 1950");
  });
});

