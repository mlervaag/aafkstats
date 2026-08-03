import { describe, expect, it } from "vitest";
import { thinkingWords } from "../lib/thinking.js";

/**
 * Tenkeordene er tekst uten logikk, så det er lite å teste. Det som festes her
 * er formen komponenten krever, og de to feiltypene som faktisk har oppstått:
 * bøyningsformer skrevet fra hukommelsen, og ord som ikke står i kilden.
 */
describe("thinkingWords", () => {
  it("har ingen duplikater", () => {
    expect(new Set(thinkingWords).size).toBe(thinkingWords.length);
  });

  it("avslutter ikke med ellipse eller punktum", () => {
    // ThinkingLine legger på « …» selv. Står det også her, blir det «… …».
    for (const word of thinkingWords) {
      expect(word).not.toMatch(/[.…!?]\s*$/);
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

  it("bruker bøyningsformene fra Nynorskordboka", () => {
    // «Andøvar» ser riktig ut og er galt: andøve er et e-verb og bøyes
    // «andøver». Seks slike feil sto i forrige liste, alle av typen en lokal
    // leser ser med en gang.
    expect(thinkingWords).toContain("Andøver over staden");
    expect(thinkingWords).toContain("Ventar på opplett");
    for (const wrong of ["Andøvar", "Ventar på opplet ", "Vår nota"]) {
      expect(thinkingWords.join(" ")).not.toContain(wrong);
    }
  });

  it("gjengir setningene fra kilden ordrett", () => {
    // Disse er ikke satt sammen av oss. De står slik i ordlista, og skal ikke
    // «ryddes» til bokmål eller normert nynorsk av en senere endring.
    for (const sentence of [
      "Ej he fole låkt i haude",
      "Ka e ditte for nåke",
      "Dæ va fole te kaule",
      "Han sit og maular småsei",
      "Nedi djupaste kavet",
      "Ikkje heilt i pussentur",
      "Mo plitt åleine",
      "I eit hattefok",
    ]) {
      expect(thinkingWords).toContain(sentence);
    }
  });

  it("bruker ord som ikke står i ordboka bare i kildens egen form", () => {
    // våe, kjantre, kjave og læke finnes ikke i Nynorskordboka. De kan ikke
    // bøyes på gjetning, så de står som kilden ga dem eller ikke i det hele tatt.
    const joined = thinkingWords.join(" ");
    expect(thinkingWords).toContain("Våe nota");
    for (const invented of ["Våar", "Kjantrar", "Kjavar", "Lækar"]) {
      expect(joined).not.toContain(invented);
    }
  });
});
