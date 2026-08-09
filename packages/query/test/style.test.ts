import { describe, expect, it } from "vitest";
import { stripProseDashes } from "../src/style.js";
import { systemPrompt } from "../src/prompt.js";

describe("stripProseDashes", () => {
  it("lar teksten stå urørt når det ikke finnes tankestrek", () => {
    const text = "AaFK vant 2-1 borte mot Molde FK i 2011.";
    expect(stripProseDashes(text)).toBe(text);
  });

  describe("tallstrek skal stå", () => {
    it("beholder resultatet", () => {
      expect(stripProseDashes("Det endte 2–1.")).toBe("Det endte 2–1.");
    });

    it("beholder årsspenn", () => {
      expect(stripProseDashes("Arkivet dekker 1917–2026.")).toBe("Arkivet dekker 1917–2026.");
    });

    it("beholder datospenn med punktum", () => {
      expect(stripProseDashes("Turneringen gikk 16.–18. mai.")).toBe("Turneringen gikk 16.–18. mai.");
    });

    it("strammer inn mellomrom rundt tallstreken", () => {
      // Dette er formen resultater har ellers i arkivet, så den skal være lik her.
      expect(stripProseDashes("Det endte 2 – 1.")).toBe("Det endte 2–1.");
    });

    it("beholder em-strek mellom tall, men normaliserer tegnet", () => {
      expect(stripProseDashes("Det endte 3—0.")).toBe("Det endte 3–0.");
    });
  });

  describe("tankestrek som tegnsetting skal bort", () => {
    it("bytter em-strek mellom ord med komma", () => {
      expect(stripProseDashes("AaFK vant — den første seieren siden mai.")).toBe(
        "AaFK vant, den første seieren siden mai.",
      );
    });

    it("bytter en-strek mellom ord med komma", () => {
      expect(stripProseDashes("Molde – en gammel kjenning.")).toBe("Molde, en gammel kjenning.");
    });

    it("håndterer strek uten mellomrom rundt", () => {
      expect(stripProseDashes("Molde—en gammel kjenning.")).toBe("Molde, en gammel kjenning.");
    });

    it("dobler ikke tegnsetting når det allerede står et komma", () => {
      expect(stripProseDashes("Molde, – en gammel kjenning.")).toBe("Molde, en gammel kjenning.");
    });

    it("fjerner strek som innleder en linje uten å sette komma foran", () => {
      expect(stripProseDashes("Kamper:\n– Molde\n– Brann")).toBe("Kamper:\nMolde\nBrann");
    });

    it("fjerner strek som avslutter en linje", () => {
      expect(stripProseDashes("Det står uklart —\nneste linje")).toBe("Det står uklart\nneste linje");
    });

    it("tar flere streker i samme setning", () => {
      expect(stripProseDashes("AaFK — som rykket opp i 2002 — spilte i Tippeligaen.")).toBe(
        "AaFK, som rykket opp i 2002, spilte i Tippeligaen.",
      );
    });
  });

  describe("blandet tekst", () => {
    it("skiller mellom tallstrek og tegnsetting i samme setning", () => {
      expect(stripProseDashes("AaFK tapte 1–7 mot Brann — det største tapet i arkivet.")).toBe(
        "AaFK tapte 1–7 mot Brann, det største tapet i arkivet.",
      );
    });

    it("lar markdownlenker og bindestreker være", () => {
      const text = "Se [16. mai 2022](/kamp/2022-05-16-aalesunds-fk-molde-fk) i AaFK-arkivet.";
      expect(stripProseDashes(text)).toBe(text);
    });
  });

  describe("strømming", () => {
    it("rører ikke halen mens svaret fortsatt kommer", () => {
      // «2–» kan bli «2–1». Erstattes streken nå, blinker «2, » på skjermen i ett
      // bilde før neste tegn kommer.
      expect(stripProseDashes("Det endte 2–", true)).toBe("Det endte 2–");
    });

    it("behandler halen når svaret er ferdig", () => {
      expect(stripProseDashes("Det endte 2–", false)).toBe("Det endte 2");
    });

    it("tar streker som ligger godt innenfor halen", () => {
      expect(stripProseDashes("AaFK vant — og det holdt hele veien", true)).toBe(
        "AaFK vant, og det holdt hele veien",
      );
    });

    it("gir samme resultat som ikke-strømmende når hele teksten er der", () => {
      const full = "AaFK tapte 1–7 mot Brann — det største tapet i arkivet.";
      expect(stripProseDashes(full, true)).toBe(stripProseDashes(full, false));
    });
  });
});

describe("systemPrompt", () => {
  it("forbyr tankestrek som tegnsetting, men beskytter tallstreken", () => {
    // Uten unntaket for tall ville modellen skrevet resultater uten strek, og
    // hele arkivets skrivemåte for resultater ville sprikt mot nettstedet.
    const prompt = systemPrompt();
    expect(prompt).toContain("Ingen tankestrek som tegnsetting");
    expect(prompt).toContain("2–1");
  });

  it("bruker ikke selv tankestrek som tegnsetting", () => {
    // En systemprompt full av tankestrek er en instruksjon om å bruke tankestrek,
    // uansett hva den påstår i teksten. Modellen speiler formen den blir gitt.
    const withoutRanges = systemPrompt().replace(/\d[.\s]{0,2}[–—][.\s]{0,2}\d/g, "");
    expect(withoutRanges).not.toMatch(/[–—]/);
  });

  it("krever komplette og delbare kamplenker", () => {
    const prompt = systemPrompt();
    expect(prompt).toContain("https://aafkstats.vercel.app/kamp/");
    expect(prompt).toContain("Ikke skriv relative lenker");
    expect(prompt).not.toContain("](/kamp/");
  });

  it("forbyr statusmeldinger og ventende delsvar", () => {
    const prompt = systemPrompt();
    expect(prompt).toContain("Gjør alle nødvendige verktøykall før du skriver svartekst");
    expect(prompt).toContain("Jeg søker etter dem nå");
    expect(prompt).toContain("Det finnes ingen jobb som fortsetter etter at meldingen er sendt");
  });
});
