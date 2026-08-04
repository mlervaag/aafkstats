import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeProgression,
  divisionClubsMatch,
  finalTable,
  parseDivisionResults,
  parseTableBlocks,
  parseTableRow,
  pointsPerWin,
  progressionAgreesWithTable,
  readOutcome,
} from "../src/adapters/rsssf-table.js";
import { stripMarkup } from "../src/adapters/rsssf.js";

const page1998 = stripMarkup(
  readFileSync(resolve(import.meta.dirname, "fixtures/rsssf-first-1998.html"), "utf8"),
);

describe("parseTableRow", () => {
  it("leser en vanlig rad med status", () => {
    expect(parseTableRow("Odd Grenland         26 16  7  3 55-18 55 Promoted")).toEqual({
      name: "Odd Grenland",
      played: 26, wins: 16, draws: 7, losses: 3,
      goalsFor: 55, goalsAgainst: 18, points: 55,
      status: "Promoted",
    });
  });

  it("lar seg ikke lure av et årstall i klubbnavnet", () => {
    // «Sarpsborg 08» og «Lyn 1896» er grunnen til at raden ikke kan leses fra
    // venstre. Leses 08 som kampantall, blir hele raden feil uten å se feil ut.
    expect(parseTableRow("Sarpsborg 08       30 12  9  9 45-40 45")).toMatchObject({
      name: "Sarpsborg 08", played: 30, wins: 12, points: 45,
    });
    expect(parseTableRow("Lyn 1896           30 12 10  8 56-40 46 Promotion play-off")).toMatchObject({
      name: "Lyn 1896", played: 30, draws: 10, points: 46,
    });
  });

  it("tåler mellomrom etter bindestreken i målkolonnen", () => {
    // Slik står det på årgangene rundt 2001.
    expect(parseTableRow("Aalesund        30 13  8  9 65- 51 47")).toMatchObject({
      name: "Aalesund", goalsFor: 65, goalsAgainst: 51, points: 47,
    });
  });

  it("leser poengsummen bak et poengtrekk", () => {
    expect(parseTableRow("Lillestrøm         30 12  9  9 45-43 44*")).toMatchObject({ points: 44 });
  });

  it("tar med en status som er lengre enn noen forventer", () => {
    // 2005 har «Play-off (UEFA Cup (cup winner))». En grense på antall ord
    // forkastet raden, og delte tabellen i to.
    expect(parseTableRow("Molde              26  8  6 12 40-46 30 Play-off (UEFA Cup (cup winner))"))
      .toMatchObject({ name: "Molde", status: "Play-off (UEFA Cup (cup winner))" });
  });

  it("avviser en linje der seire, uavgjorte og tap ikke summerer til spilte", () => {
    expect(parseTableRow("Noe rart 26 16 7 9 55-18 55")).toBeUndefined();
  });

  it("avviser en resultatlinje", () => {
    expect(parseTableRow("19/4:   Start - Odd 0-0")).toBeUndefined();
  });
});

describe("finalTable", () => {
  it("finner tabellen i 1998-fixturen", () => {
    const table = finalTable(page1998);
    expect(table).toBeDefined();
    expect(table).toHaveLength(14);
    expect(table![0]).toMatchObject({ name: "Odd Grenland", points: 55, status: "Promoted" });
    const aafk = table!.findIndex((row) => row.name === "Aalesund");
    expect(aafk).toBe(10);
    expect(table![aafk]).toMatchObject({ points: 34, status: "Relegated" });
  });

  it("velger tabellen med flest spilte kamper, ikke den siste på sida", () => {
    // RSSSF trykker en tabell etter hver runde fra sommeren av, og noen årganger
    // har hjemme- og bortetabeller etter sluttabellen. Begge deler gjør «siste
    // blokk» til feil svar.
    const text = [
      "Halvveis           15  8  4  3 20-14 28",
      "Andre              15  7  4  4 18-15 25",
      "Tredje             15  6  4  5 17-16 22",
      "Fjerde             15  5  4  6 16-17 19",
      "",
      "Sluttabell         30 16  8  6 40-28 56",
      "Andre              30 14  8  8 38-30 50",
      "Tredje             30 12  8 10 36-32 44",
      "Fjerde             30 10  8 12 34-34 38",
      "",
      "Hjemme             15  9  4  2 22-12 31",
      "Andre h            15  8  4  3 20-14 28",
      "Tredje h           15  7  4  4 18-16 25",
      "Fjerde h           15  6  4  5 16-18 22",
    ].join("\n");
    expect(finalTable(text)![0]).toMatchObject({ name: "Sluttabell", played: 30 });
  });

  it("lar skillelinjene for opp- og nedrykk stå inne i tabellen", () => {
    const table = finalTable(page1998)!;
    // Raden rett under den doble streken må fortsatt være med.
    expect(table.map((row) => row.name)).toContain("Kjelsås");
  });
});

describe("readOutcome", () => {
  it("skiller kvalifisering fra direkte opp- og nedrykk", () => {
    expect(readOutcome("Promoted")).toBe("promoted");
    expect(readOutcome("Relegated")).toBe("relegated");
    expect(readOutcome("Promotion play-off")).toBe("promotion_playoff");
    expect(readOutcome("Relegation play-off*")).toBe("relegation_playoff");
  });

  it("lar en europacupplass være noe annet enn en tabellskjebne", () => {
    // Den er en opplysning, men ikke en av våre — den hører i note, ikke i outcome.
    expect(readOutcome("Champions League")).toBe("none");
    expect(readOutcome("Europa League (cup winner)")).toBe("none");
    expect(readOutcome("")).toBe("none");
  });
});

describe("pointsPerWin", () => {
  const row = (wins: number, draws: number, points: number) => ({
    name: "x", played: wins + draws, wins, draws, losses: 0,
    goalsFor: 0, goalsAgainst: 0, points, status: "",
  });

  it("leser satsen ut av tabellen i stedet for av årstallet", () => {
    expect(pointsPerWin([row(10, 2, 32), row(8, 4, 28)])).toBe(3);
    expect(pointsPerWin([row(10, 2, 22), row(8, 4, 20)])).toBe(2);
  });

  it("lar ett poengtrekk slippe å velte regelen", () => {
    expect(pointsPerWin([row(10, 2, 32), row(8, 4, 28), row(9, 3, 29)])).toBe(3);
  });
});

describe("parseDivisionResults", () => {
  it("tar med alle lagenes kamper, ikke bare AaFKs", () => {
    const results = parseDivisionResults(page1998);
    expect(results.length).toBeGreaterThan(150);
    expect(results.filter((r) => r.home === "Aalesund" || r.away === "Aalesund")).toHaveLength(26);
    expect(results.filter((r) => r.round === 1)).toHaveLength(7);
  });

  it("lar ikke kampene etter siste runde arve rundenummeret", () => {
    // Kvalifiseringskampene står uten egen `Round`-linje. I 2015 ga det runde 30
    // tretten kamper, og fire lag som aldri spilte i divisjonen fikk poeng.
    const text = [
      "Round 30",
      "========",
      "8/11:   Bodø/Glimt - Stabæk 6-1",
      "        Aalesund - Rosenborg 0-1",
      "",
      "Play-off",
      "========",
      "13/11:  Kristiansund - Ranheim 1-0",
      "        Hødd - Jerv 1-1",
    ].join("\n");
    const results = parseDivisionResults(text);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.home)).not.toContain("Kristiansund");
  });
});

describe("computeProgression", () => {
  it("lander på nøyaktig samme rad som tabellen kilden trykte", () => {
    // Den sterkeste kontrollen vi har: kurven regnes ut av rundene, tabellen er
    // hentet. Møtes de ikke, er utregningen feil.
    const table = finalTable(page1998)!;
    const position = table.findIndex((row) => row.name === "Aalesund");
    const progression = computeProgression(
      parseDivisionResults(page1998), "Aalesund", pointsPerWin(table),
    );
    expect(progression).toHaveLength(26);
    expect(progressionAgreesWithTable(progression, table[position]!, position + 1))
      .toEqual({ ok: true });
  });

  it("teller poeng etter satsen som gjaldt", () => {
    const results = [
      { round: 1, home: "A", away: "B", homeGoals: 1, awayGoals: 0 },
      { round: 1, home: "C", away: "D", homeGoals: 2, awayGoals: 2 },
    ];
    expect(computeProgression(results, "A", 2)[0]).toMatchObject({ points: 2, position: 1 });
    expect(computeProgression(results, "A", 3)[0]).toMatchObject({ points: 3, position: 1 });
  });

  it("sorterer på poeng, så målforskjell, så scorede mål", () => {
    const results = [
      { round: 1, home: "Lik", away: "Taper", homeGoals: 3, awayGoals: 0 },
      { round: 1, home: "Bedre", away: "Annen", homeGoals: 5, awayGoals: 1 },
    ];
    // Begge har 3 poeng; «Bedre» har målforskjell 4 mot 3.
    expect(computeProgression(results, "Bedre", 3)[0]!.position).toBe(1);
    expect(computeProgression(results, "Lik", 3)[0]!.position).toBe(2);
  });
});

describe("progressionAgreesWithTable", () => {
  const row = {
    name: "Aalesund", played: 30, wins: 10, draws: 8, losses: 12,
    goalsFor: 40, goalsAgainst: 55, points: 38, status: "",
  };

  it("avviser en kurve som mangler en kamp", () => {
    // Dette er 2015: RSSSF skriver «Aalesund Stabæk 1-1» uten bindestreken, og
    // resultatlinja lar seg ikke lese. Uten kontrollen ville kurven endt ett
    // poeng og én kamp feil, og ingenting hadde avslørt det.
    const result = progressionAgreesWithTable(
      [{ position: 10, points: 37, played: 29, goalDifference: -15 }], row, 10,
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("kamper 29 mot 30");
    expect(result.ok === false && result.reason).toContain("poeng 37 mot 38");
  });

  it("avviser en tom kurve framfor å godta den", () => {
    expect(progressionAgreesWithTable([], row, 10).ok).toBe(false);
  });

  it("godtar en kurve som stemmer", () => {
    expect(progressionAgreesWithTable(
      [{ position: 10, points: 38, played: 30, goalDifference: -15 }], row, 10,
    )).toEqual({ ok: true });
  });
});

describe("parseTableBlocks", () => {
  it("krever minst fire rader for å kalle noe en tabell", () => {
    // Ellers blir tre tilfeldige linjer med tall i til en divisjon.
    expect(parseTableBlocks("A 4 2 1 1 5-4 7\nB 4 2 1 1 5-4 7\nC 4 2 1 1 5-4 7")).toEqual([]);
  });
});

describe("divisionClubsMatch", () => {
  const row = (name: string) => ({
    name, played: 2, wins: 1, draws: 0, losses: 1,
    goalsFor: 1, goalsAgainst: 1, points: 3, status: "",
  });

  it("godtar at tabellen og resultatene skriver navnene ulikt", () => {
    // Sida for 2022 har «Kristiansund BK» i tabellen og «Kristiansund» i
    // resultatlinjene. Det er samme klubb, og kanonisk identitet ser det.
    expect(divisionClubsMatch(
      [{ round: 1, home: "Kristiansund", away: "Sandefjord", homeGoals: 1, awayGoals: 0 }],
      [row("Kristiansund BK"), row("Sandefjord Fotball")],
    )).toEqual({ ok: true });
  });

  it("fanger en skrivefeil som lager et lag for mye", () => {
    // «Strømsgodet» står på én resultatlinje i 2022. Et ekstra lag i utregningen
    // flytter alle under det, og poengkontrollen alene fanger det ikke når de
    // splittede lagene tilfeldigvis ligger under vårt eget.
    const result = divisionClubsMatch(
      [{ round: 1, home: "Strømsgodet", away: "Molde", homeGoals: 1, awayGoals: 0 }],
      [row("Strømsgodset"), row("Molde")],
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("stromsgodet");
  });
});
