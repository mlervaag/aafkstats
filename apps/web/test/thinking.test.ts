import { describe, expect, it } from "vitest";
import { thinkingWords } from "../lib/thinking.js";

/**
 * Tenkeordene er tekst utan logikk, så det er lite å teste. Det som festest her
 * er forma komponenten krev, og dei to reglane lista er bygd på: kvart ord er
 * ei handling (eit verb i notid), og notidsforma er den som faktisk finst — ikkje
 * ei gjetting skriven frå minnet.
 */
describe("thinkingWords", () => {
  it("har ingen duplikatar", () => {
    expect(new Set(thinkingWords).size).toBe(thinkingWords.length);
  });

  it("avsluttar ikkje med ellipse eller punktum", () => {
    // ThinkingLine legg på « …» sjølv. Står det også her, blir det «… …».
    for (const word of thinkingWords) {
      expect(word).not.toMatch(/[.…!?]\s*$/);
    }
  });

  it("er korte nok til å stå på éi linje ved sida av verktøynamnet", () => {
    for (const word of thinkingWords) {
      expect(word.length).toBeLessThanOrEqual(30);
    }
  });

  it("byrjar med stor forbokstav og inneheld ingen tankestrek", () => {
    for (const word of thinkingWords) {
      expect(word[0]).toBe(word[0]!.toUpperCase());
      expect(word).not.toMatch(/[–—]/);
    }
  });

  it("bruker bøyingsformene som faktisk finst", () => {
    // «Andøvar» ser rett ut og er gale: andøve er eit e-verb og bøyest
    // «andøver». Kamse er eit a-verb og bøyest «kamsar». Slike former sto gale
    // i ei tidlegare liste, alle av typen ein lokal lesar ser med ein gong.
    expect(thinkingWords).toContain("Andøver over staden");
    expect(thinkingWords).toContain("Kamsar med tala");
    for (const wrong of ["Andøvar", "Kamser", "Vår nota"]) {
      expect(thinkingWords.join(" ")).not.toContain(wrong);
    }
  });

  it("er handlingar — ingen av dei gamle stille orda", () => {
    // Regelen no er at kvart ord er noko som skjer. Desse er tilstandar,
    // substantiv eller kraftuttrykk frå forrige runde, og skal ikkje snike seg
    // inn att av ei seinare endring.
    const joined = thinkingWords.join(" ");
    for (const stillstand of [
      "Bunding og kaffi",
      "Bleik på himmelen",
      "Årre",
      "Ej he fole låkt i haude",
      "Lått og løye",
    ]) {
      expect(joined).not.toContain(stillstand);
    }
  });

  it("har eit lite innslag av fotball, men mindre enn resten", () => {
    // Fotballuttrykka er eit nikk til klubben. Dei skal vere med, men vere
    // færre enn dei andre gruppene til saman.
    const football = [
      "Driblar seg forbi",
      "Spelar vegg",
      "Vender opp mot mål",
      "Legg inn frå kanten",
      "Set på press",
      "Jaktar gjenvinning",
    ];
    for (const term of football) {
      expect(thinkingWords).toContain(term);
    }
    expect(football.length).toBeLessThan(thinkingWords.length - football.length);
  });
});
