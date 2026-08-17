import { describe, expect, it } from "vitest";
import { extractMatchFacts, isAnchored } from "../src/adapters/nb-newspaper-facts.js";

/**
 * Boksene under er skrevet etter formen Sunnmørsposten faktisk bruker — samme
 * felt, samme rekkefølge, samme slurv i OCR-en — men teksten er satt opp her og
 * ikke kopiert fra avisa.
 */
const AAFK = ["Aalesunds FK", "AaFK", "ÅFK"];
const HODD = ["Hødd"];
const BOX = "2. divisjon avd. B ÅFK-HØDD 2-0 (1-0) Kråmyra stadion 3200 tilskuere Mål: 1-0 Arild Holm (straffe, 37), 2-0 Steinar Henden (53). Dommer: Sjur Hatløy, Hødd. Gult kort: Bertil Hansen, Hessa.";

describe("isAnchored", () => {
  it("godtar boksen når begge lagene og stillingen stemmer", () => {
    expect(isAnchored(BOX, { homeNames: AAFK, awayNames: HODD, score: "2-0" })).toBe(true);
  });

  it("godtar samme boks når lagene kommer i motsatt rekkefølge", () => {
    expect(isAnchored(BOX, { homeNames: HODD, awayNames: AAFK, score: "2-0" })).toBe(true);
  });

  /**
   * Den viktigste avvisningen: 9. juni 1986 sto ÅFK-kampen og
   * Skottland–Vest-Tyskland i VM på samme side, i samme format. Uten lagnavnene
   * i ankeret ville dommeren i VM-kampen blitt ÅFKs dommer.
   */
  it("avviser en boks fra en annen kamp på samme side", () => {
    const vm = "VM-gruppe E SKOTTLAND-VEST-TYSKLAND 1-2 (1-1) Corregidora stadion 27.000 tilskuere Dommer: Ioan Igna, Romania.";
    expect(isAnchored(vm, { homeNames: AAFK, awayNames: HODD, score: "1-2" })).toBe(false);
  });

  it("avviser riktig lag med feil stilling", () => {
    expect(isAnchored(BOX, { homeNames: AAFK, awayNames: HODD, score: "3-0" })).toBe(false);
  });

  it("avviser tekst uten resultatboks", () => {
    expect(isAnchored("ÅFK møter Hødd på Kråmyra i kveld.", { homeNames: AAFK, awayNames: HODD, score: "2-0" }))
      .toBe(false);
  });
});

describe("extractMatchFacts", () => {
  it("leser arena, tilskuere, pausestilling, mål, dommer og kort", () => {
    const facts = extractMatchFacts([{ pageNumber: "9", text: BOX }], { homeNames: AAFK, awayNames: HODD, score: "2-0" })!;

    expect(facts.venue).toBe("Kråmyra stadion");
    expect(facts.attendance).toBe(3200);
    expect(facts.halfTime).toEqual({ home: 1, away: 0 });
    expect(facts.referee).toBe("Sjur Hatløy");
    expect(facts.goals).toEqual([
      { standing: "1-0", scorer: "Arild Holm", minute: 37, penalty: true },
      { standing: "2-0", scorer: "Steinar Henden", minute: 53 },
    ]);
    expect(facts.cards).toEqual([{ type: "yellow", players: "Bertil Hansen, Hessa" }]);
    expect(facts.sources[0]?.page).toBe("9");
  });

  it("tar av punktumet OCR-en henger på arenanavnet", () => {
    const facts = extractMatchFacts(
      [{ text: "MJØLNER-ÅFK 0-3 (0-2) Narvik stadion. 646 tilskuere, Mål: 0-1 Arild Holm (21)." }],
      { homeNames: ["Mjølner"], awayNames: AAFK, score: "0-3" },
    )!;
    expect(facts.venue).toBe("Narvik stadion");
  });

  it("leser tilskuertallet både før og etter ordet", () => {
    const etter = extractMatchFacts([{ text: "ÅFK-HØDD 2-0 (1-0) Kråmyra stadion 3200 tilskuere" }], { homeNames: AAFK, awayNames: HODD, score: "2-0" })!;
    const foran = extractMatchFacts([{ text: "ÅFK-HØDD 2-0 (1-0) Kråmyra stadion Tilskuere: 3200" }], { homeNames: AAFK, awayNames: HODD, score: "2-0" })!;
    expect(etter.attendance).toBe(3200);
    expect(foran.attendance).toBe(3200);
  });

  it("takler tusenskille og boks uten pausestilling", () => {
    const facts = extractMatchFacts(
      [{ text: "ÅFK-HØDD 2-0 Gjemselund 27.000 tilskuere Dommer: Harald Hansen, Mjøndalen" }],
      { homeNames: AAFK, awayNames: HODD, score: "2-0" },
    )!;
    expect(facts.attendance).toBe(27_000);
    expect(facts.halfTime).toBeUndefined();
    expect(facts.referee).toBe("Harald Hansen");
  });

  it("leser minuttet uansett hvor i parentesen det står", () => {
    const facts = extractMatchFacts(
      [{ text: "ÅFK-HØDD 2-0 (1-0) Kråmyra 100 tilskuere Mål: 1-0 Per Hansen (straffe, 37), 2-0 Ola Nordmann (88, straffe)." }],
      { homeNames: AAFK, awayNames: HODD, score: "2-0" },
    )!;
    expect(facts.goals.map((goal) => [goal.minute, goal.penalty])).toEqual([[37, true], [88, true]]);
  });

  it("gir null når ingen boks i utgaven navngir kampen", () => {
    expect(extractMatchFacts(
      [{ text: "Kråmyra 3200 tilskuere Dommer: Sjur Hatløy" }, { text: "VALDER-FYLLINGEN 1-1 (0-0) Valdervoll 300 tilskuere" }],
      { homeNames: AAFK, awayNames: HODD, score: "2-0" },
    )).toBeNull();
  });

  it("tar med laguppstillingen som ukontrollert OCR", () => {
    const facts = extractMatchFacts(
      [{ text: "ÅFK-HØDD 2-0 (1-0) Kråmyra 3200 tilskuere ÅFK: Sverre kngeskar, Bobbo Aam, Eivind Syversen, Øyvind Lervåg" }],
      { homeNames: AAFK, awayNames: HODD, score: "2-0" },
    )!;
    expect(facts.lineups[0]?.team).toBe("ÅFK");
    expect(facts.lineups[0]?.namesRaw).toContain("Bobbo Aam");
  });
});
