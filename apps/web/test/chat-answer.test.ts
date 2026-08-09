import { describe, expect, it } from "vitest";
import {
  absolutizeAnswerLinks,
  shareableAnswerText,
} from "../lib/chat-answer.js";

describe("absolutizeAnswerLinks", () => {
  it("gjør en intern kamplenke absolutt", () => {
    expect(absolutizeAnswerLinks("Se [kampen](/kamp/2024-04-01-aalesunds-fk-raufoss-il)."))
      .toBe("Se [kampen](https://aafkstats.vercel.app/kamp/2024-04-01-aalesunds-fk-raufoss-il).");
  });

  it("lar absolutte og eksterne lenker stå urørt", () => {
    const text = "Se [kampen](https://aafkstats.vercel.app/kamp/en) og [kilden](https://example.com/a).";
    expect(absolutizeAnswerLinks(text)).toBe(text);
  });

  it("gjør flere relative lenker absolutte", () => {
    expect(absolutizeAnswerLinks("[Én](/kamp/en) og [to](/kamp/to)"))
      .toBe("[Én](https://aafkstats.vercel.app/kamp/en) og [to](https://aafkstats.vercel.app/kamp/to)");
  });
});

describe("shareableAnswerText", () => {
  it("skriver lenketekst og full nettadresse uten Markdown", () => {
    expect(shareableAnswerText("Se [kampen](/kamp/en)."))
      .toBe("Se kampen: https://aafkstats.vercel.app/kamp/en.");
  });

  it("lar tekst uten lenker stå urørt", () => {
    expect(shareableAnswerText("AaFK vant 2–1.")).toBe("AaFK vant 2–1.");
  });
});
