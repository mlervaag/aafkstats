import { describe, expect, it } from "vitest";
import { thinkingWords } from "../lib/thinking.js";

/**
 * Tenkeordene er tekst uten logikk, så det er lite å teste. Det som er verdt å
 * feste er formen de må ha for at komponenten skal sette dem riktig sammen, og
 * de par feilene som faktisk oppsto da lista ble skrevet.
 */
describe("thinkingWords", () => {
  it("har ingen duplikater", () => {
    expect(new Set(thinkingWords).size).toBe(thinkingWords.length);
  });

  it("avslutter ikke med ellipse", () => {
    // ThinkingLine legger på « …» selv. Står den også her, blir det «… …».
    for (const word of thinkingWords) {
      expect(word).not.toMatch(/[.…]\s*$/);
    }
  });

  it("er korte nok til å stå på én linje ved siden av verktøynavnet", () => {
    for (const word of thinkingWords) {
      expect(word.length).toBeLessThanOrEqual(30);
    }
  });

  it("begynner med stor forbokstav og inneholder ingen tankestrek", () => {
    for (const word of thinkingWords) {
      expect(word[0]).toBe(word[0]!.toUpperCase());
      expect(word).not.toMatch(/[–—]/);
    }
  });

  it("bruker presensformene fra Nynorskordboka", () => {
    // Seks former var gale i første utkast, og alle seks var av typen en lokal
    // leser ville sett med en gang. Formene under er slått opp på ord.uib.no.
    const looked_up: [string, string][] = [
      ["Maskineriet mel", "male"],
      ["Sløyer tala", "sløye"],
      ["Flekkjer og saltar", "flekkje"],
      ["Røktar garna", "røkte"],
      ["Fyrer opp under kjelen", "fyre"],
      ["Grunnar på det", "grunne"],
    ];
    for (const [phrase] of looked_up) {
      expect(thinkingWords).toContain(phrase);
    }
    // Og formene som var gale skal ikke ha sneket seg inn igjen.
    for (const wrong of ["malar", "sløyar", "flekkjar", "røkter", "fyrar", "grundar"]) {
      expect(thinkingWords.join(" ")).not.toContain(wrong);
    }
  });
});
