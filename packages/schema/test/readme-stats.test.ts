import { describe, expect, it } from "vitest";
import { syncReadmeStats, type ReadmeStatsArchive } from "../src/readme-stats.js";

/**
 * Tallene i README rettes av koden, ikke for hånd.
 *
 * Rutinen etter kamp lar arkivet vokse — en overgang er én person mer, en ny
 * arena ett stadion mer — og `archive-truths.test.ts` feller bygget når README
 * ikke har fulgt med. Disse testene låser at rettingen treffer riktig tall, og
 * bare tallet.
 */

const README = `# AaFK-arkivet

## Arkivet i tall

| | |
|---|---|
| **1 724 kamper** | Kamper registrert totalt i arkivet |
| **2 149 kildedokumenterte resultatoppføringer** | Bevart fra historiske kilder. **1 587 mangler fortsatt kobling til en kanonisk kamp.** |
| **103 år med kanoniske kamper** | 1915–2026, år med minst én registrert kamp |
| **108 år med historisk kampinformasjon** | De kanoniske årene over, pluss år med bare kilderesultater |
| **208 klubber · 98 stadion** | Med tidsavhengige navn |
| **489 personer** | Registrerte spillere, trenere og ledere |
| **9 dataleverandører** | Der data hentes digitalt fra |
| **802 historiske kilder** | Bøker, medlemsblad og årsmeldinger |

## Kilder og rettigheter

Arkivet dekker 1 724 kamper fra 1915 til i dag.
`;

/** Et arkiv med akkurat de tallene README over oppgir. */
function archive(overrides: Partial<Record<"matches" | "clubs" | "venues" | "people" | "providers" | "sources", number>> = {}): ReadmeStatsArchive {
  const count = (key: keyof typeof defaults) => overrides[key] ?? defaults[key];
  const defaults = { matches: 1724, clubs: 208, venues: 98, people: 489, providers: 9, sources: 802 };
  const list = (length: number) => Array.from({ length }, (_, index) => ({ id: `x-${index}` }));

  // 103 år med kamper: 1915–2017. De øvrige kampene legges på det siste året.
  const matches = Array.from({ length: count("matches") }, (_, index) => ({
    competition: { season: 1915 + Math.min(index, 102) },
  }));
  // 2 149 resultatoppføringer over 108 år (fem år uten kanoniske kamper), og
  // 1 587 av dem uten kobling til en kamp.
  const results = Array.from({ length: 2149 }, (_, index) => ({ matchId: index < 1587 ? null : `m-${index}` }));
  const sourceResults = [{
    seasons: [
      { year: 1915, results },
      ...[1909, 1910, 1911, 1912, 1913].map((year) => ({ year, results: [] })),
    ],
  }];

  return {
    matches,
    sourceResults,
    clubs: list(count("clubs")),
    venues: list(count("venues")),
    people: list(count("people")),
    providers: list(count("providers")),
    sources: list(count("sources")),
  } as unknown as ReadmeStatsArchive;
}

describe("syncReadmeStats", () => {
  it("lar en README som stemmer stå urørt", () => {
    const result = syncReadmeStats(README, archive());
    expect(result.changes).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.text).toBe(README);
  });

  it("retter personer og stadion når rutinen har ført inn en overgang på en ny arena", () => {
    const result = syncReadmeStats(README, archive({ people: 490, venues: 99 }));
    expect(result.changes).toEqual([
      { label: "stadion", from: 98, to: 99 },
      { label: "personer", from: 489, to: 490 },
    ]);
    expect(result.text).toContain("| **208 klubber · 99 stadion** | Med tidsavhengige navn |");
    expect(result.text).toContain("| **490 personer** | Registrerte spillere, trenere og ledere |");
  });

  it("endrer bare tallene, aldri teksten rundt", () => {
    const result = syncReadmeStats(README, archive({ people: 490, venues: 99, clubs: 209, sources: 803 }));
    const utenTall = (text: string) => text.replace(/\d/gu, "#");
    expect(utenTall(result.text)).toBe(utenTall(README));
    expect(result.text.split("\n")).toHaveLength(README.split("\n").length);
  });

  it("retter kamptallet begge stedene det står", () => {
    const result = syncReadmeStats(README, archive({ matches: 1725 }));
    expect(result.changes.map((change) => change.label)).toEqual(["kamper", "kamper (kildeavsnittet)"]);
    expect(result.text).toContain("| **1 725 kamper** |");
    expect(result.text).toContain("Arkivet dekker 1 725 kamper fra 1915 til i dag.");
    // «1 587 mangler fortsatt kobling» er et annet tall og skal ikke røres.
    expect(result.text).toContain("**1 587 mangler fortsatt kobling");
  });

  it("er ferdig etter én runde", () => {
    const wanted = archive({ people: 1000, venues: 99 });
    const first = syncReadmeStats(README, wanted);
    const second = syncReadmeStats(first.text, wanted);
    expect(second.changes).toEqual([]);
    expect(second.text).toBe(first.text);
  });

  it("setter tusenskille når tallet passerer tusen, og fjerner det når det faller under", () => {
    expect(syncReadmeStats(README, archive({ people: 1000 })).text).toContain("| **1 000 personer** |");
    expect(syncReadmeStats(README, archive({ matches: 999 })).text).toContain("| **999 kamper** |");
  });

  it("beholder et hardt mellomrom som tusenskille der det sto fra før", () => {
    const hard = README.replace("**1 724 kamper**", "**1\u00a0724 kamper**");
    const result = syncReadmeStats(hard, archive({ matches: 1725 }));
    expect(result.text).toContain("**1\u00a0725 kamper**");
  });

  it("sier fra om en rad den ikke finner, og gjetter den ikke tilbake på plass", () => {
    const omskrevet = README.replace("| **489 personer** |", "| **Personer: 489** |");
    const result = syncReadmeStats(omskrevet, archive({ people: 490 }));
    expect(result.missing).toEqual(["personer"]);
    expect(result.changes).toEqual([]);
    expect(result.text).toBe(omskrevet);
  });
});
