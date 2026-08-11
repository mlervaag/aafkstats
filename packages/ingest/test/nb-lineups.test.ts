import { describe, expect, it } from "vitest";
import { resolveLineups } from "../src/adapters/nb-lineups.js";
import { knownPeople } from "../src/adapters/nb-roles.js";

const people = knownPeople([
  { id: "ola-nordmann", name: "Ola Nordmann", names: [] },
  { id: "kari-nordmann", name: "Kari Nordmann", names: [] },
]);

const ELLEVE = [
  "Reidar Skarbøvik", "Johan Refsnes", "Ola Nordmann", "Edvin Løvold", "Finn Tolaas",
  "Erling Hansen", "Thor Refsnes", "Karsten Nedregård", "Trygve Olsen", "Karl Løvold",
  "Kari Nordmann",
];

function resolve(text: string) {
  return resolveLineups(text, { sourceId: "en-kilde", page: "42", column: 0, people, publicationYear: 1950 });
}

describe("resolveLineups", () => {
  it("leser et helt lag ut av en oppregning", () => {
    const [lineup] = resolve(`Seierslaget bestod av: ${ELLEVE.slice(0, 10).join(", ")} og ${ELLEVE[10]}.`);
    expect(lineup?.names).toEqual(ELLEVE);
  });

  it("slår navnene opp mot personregisteret", () => {
    const [lineup] = resolve(`Laget bestod av: ${ELLEVE.slice(0, 10).join(", ")} og ${ELLEVE[10]}.`);
    expect(lineup?.personIds).toEqual(["ola-nordmann", "kari-nordmann"]);
  });

  /**
   * Rekka slutter der oppregningen slutter. Uten den grensen ble dommeren og
   * det som ellers står etter punktumet med i laget.
   */
  it("stopper ved det første leddet som ikke er et navn", () => {
    const [lineup] = resolve(`Laget bestod av: ${ELLEVE.join(", ")}, dommeren Per Hansen ledet kampen.`);
    expect(lineup?.names).toEqual(ELLEVE);
  });

  it("regner ikke en setning med et par navn i som en oppstilling", () => {
    expect(resolve("Laget bestod av Ola Nordmann, Kari Nordmann og noen til.")).toEqual([]);
  });

  it("tar med årstallet som står nær, som pekepinn", () => {
    const [lineup] = resolve(`I 1948 spilte de sin beste kamp. Laget bestod av: ${ELLEVE.join(", ")}.`);
    expect(lineup?.season).toBe(1948);
  });

  it("forkaster et årstall som er yngre enn publikasjonen", () => {
    const [lineup] = resolve(`I 1998 skjedde det. Laget bestod av: ${ELLEVE.join(", ")}.`);
    expect(lineup?.season).toBeUndefined();
  });

  describe("hvor sikker lesningen er", () => {
    it("er sikker når hele laget står der og halvparten er kjent", () => {
      const alle = knownPeople(ELLEVE.map((name) => ({ id: name.toLowerCase().replace(/\W+/g, "-"), name, names: [] })));
      const [lineup] = resolveLineups(`Laget bestod av: ${ELLEVE.join(", ")}.`, {
        sourceId: "en-kilde", page: "42", people: alle, publicationYear: 1950,
      });
      expect(lineup).toMatchObject({ confidence: "high" });
      expect(lineup?.personIds).toHaveLength(11);
    });

    it("er middels når få av navnene er kjent fra før", () => {
      const [lineup] = resolve(`Laget bestod av: ${ELLEVE.join(", ")}.`);
      expect(lineup?.confidence).toBe("medium");
    });
  });

  it("gir samme ID for samme oppstilling to ganger", () => {
    const text = `Laget bestod av: ${ELLEVE.join(", ")}.`;
    expect(resolve(text)[0]?.id).toBe(resolve(text)[0]?.id);
  });

  it("bærer ingen kamp-ID", () => {
    // Oppstillingen sier hvem som spilte, ikke mot hvem. Å gjette kampen ut fra
    // et årstall i nærheten ville knyttet elleve navn til feil kamp.
    const [lineup] = resolve(`Laget bestod av: ${ELLEVE.join(", ")}.`);
    expect(lineup).not.toHaveProperty("matchId");
  });
});
