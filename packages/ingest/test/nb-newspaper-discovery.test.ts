import { describe, expect, it } from "vitest";
import { classifyFragment } from "../src/newspaper/fragment-kind.js";
import { inferMatchDate, resolveMatchDate } from "../src/newspaper/date-inference.js";
import { matchScore, parseScores } from "../src/newspaper/score-parse.js";
import { parseNote } from "../src/newspaper/note-parser.js";
import { evidenceForFragment } from "../src/newspaper/evidence.js";
import { reconcile } from "../src/newspaper/reconciliation.js";
import { clusterEvidence } from "../src/newspaper/evidence-cluster.js";
import { allocateEvents } from "../src/newspaper/allocation.js";
import { verifyNewspaperCandidate } from "../src/newspaper/discovery.js";
import type { DiscoveredIssue } from "../src/newspaper/discovery.js";
import type { MatchHypothesis } from "../src/newspaper/allocation.js";
import type { SourceResultQuery } from "../src/newspaper/source-result-query.js";
import type { NewspaperQuery } from "../src/newspaper/evidence.js";

/**
 * Tekstene under er skrevet etter formen Sunnmørsposten faktisk bruker, og
 * uttrykkene er de som ble lest i de virkelige utgavene under utviklingen —
 * «i går» 5. mai 1952, «morgendagens» 15. juli 1948, «kveldens kamp» 16. juli
 * 1948. Årgangene er opphavsrettsbeskyttede, så teksten er gjenskapt her og
 * ikke kopiert.
 */
const AAFK = ["Aalesund", "Aalesunds", "ÅFK", "AAFK", "Aa.F.K."];

const query = (overrides: Partial<NewspaperQuery> = {}): NewspaperQuery => ({
  year: 1952,
  opponent: "Clausenengen",
  opponentAliases: ["CFK"],
  aafkAliases: AAFK,
  ...overrides,
});

describe("parseNote", () => {
  it("leser konkurranse og bane ut av klubbens egen notatform", () => {
    expect(parseNote("2. divisjon. bortekamp.")).toMatchObject({ competitionHint: "2. divisjon", homeAwayHint: "away" });
    expect(parseNote("Cupen, 2. runde")).toMatchObject({ competitionHint: "cup" });
    expect(parseNote("Omkamp etter ekstraomganger")).toMatchObject({ replay: true, extraTime: true });
  });

  it("gir ingen hint av et notat uten kontekst", () => {
    expect(parseNote("trykt «AFK—Rollon 2—2».")).toEqual({ keywords: [] });
    expect(parseNote(undefined)).toEqual({ keywords: [] });
  });
});

describe("parseScores", () => {
  /** OCR skriver null som «o» og ett som «I» eller «l». */
  it("leser resultater OCR har mishandlet", () => {
    expect(parseScores("3—3 2—o 3—3 I—2")).toEqual([
      { home: 3, away: 3, raw: "3—3" },
      { home: 2, away: 0, raw: "2—o" },
      { home: 3, away: 3, raw: "3—3" },
      { home: 1, away: 2, raw: "I—2" },
    ]);
  });

  it("godtar kolon og tankestrek, men ikke rene bokstaver", () => {
    expect(parseScores("Molde 2:1 Hødd")).toHaveLength(1);
    expect(parseScores("o—l")).toEqual([]);
  });

  it("finner resultatet uansett hvilken vei lagene står", () => {
    expect(matchScore("Raufoss—ÅFK 0—1", [1, 0])).toMatchObject({ reversed: true });
    expect(matchScore("ÅFK—Raufoss 1—0", [1, 0])).toMatchObject({ reversed: false });
    expect(matchScore("ÅFK—Raufoss 3—2", [1, 0])).toBeUndefined();
  });
});

describe("classifyFragment", () => {
  it("skiller referat, resultatbørs, tabell og kupong", () => {
    expect(classifyFragment("AaFK vant 1—0 over Clausenengen i Kristiansund i går, og seieren var fortjent"))
      .toBe("article");
    expect(classifyFragment("Bryn—Rollon 2—1 Hødd—Ørsta 0—0 Molde—Varfjell 4—0 CFK—Træff 3—2")).toBe("result_list");
    expect(classifyFragment("Tabell: Hødd 7 4 2 1 12 8 10 Bryn 7 3 1 3 9 11 7 CFK 7 2 2 3")).toBe("standings");
    expect(classifyFragment("Tippekupong nr. 18 med kampene for helga")).toBe("coupon");
  });
});

describe("inferMatchDate", () => {
  it("leser «i går» som dagen før utgaven", () => {
    expect(inferMatchDate("mot Clausenengen i Kristiansund i går", "19520505"))
      .toMatchObject({ inferredMatchDate: "1952-05-04", confidence: "high" });
  });

  it("leser forhåndsomtale og kampdagens egen omtale", () => {
    expect(inferMatchDate("Interessen for morgendagens fotballkamp mellom Sarpsborg FK og ÅFK", "19480715"))
      .toMatchObject({ inferredMatchDate: "1948-07-16", confidence: "high" });
    expect(inferMatchDate("Til kveldens kamp mellom Sarpsborg og ÅFK på Nørve", "19480716"))
      .toMatchObject({ inferredMatchDate: "1948-07-16", confidence: "high" });
  });

  it("gir ukedag lav tillit, og gjetter ikke uten holdepunkt", () => {
    expect(inferMatchDate("kampen søndag ble jevn", "19520505")).toMatchObject({ confidence: "low" });
    expect(inferMatchDate("Aalesund har prestert endel i det siste", "19520505")).toBeUndefined();
  });

  /** To utgaver som peker samme vei er sterkere enn hver for seg. */
  it("løfter tilliten når flere utgaver sier det samme", () => {
    const resolved = resolveMatchDate([
      { temporal: { phrase: "morgendagens", offset: 1, inferredMatchDate: "1948-07-16", confidence: "high" }, weight: 60 },
      { temporal: { phrase: "kveldens kamp", offset: 0, inferredMatchDate: "1948-07-16", confidence: "high" }, weight: 70 },
      { temporal: { phrase: "søndag", offset: -2, inferredMatchDate: "1948-07-11", confidence: "low" }, weight: 30 },
    ])!;
    expect(resolved).toMatchObject({ date: "1948-07-16", confidence: "high", agreement: 2 });
    expect(resolved.disagreement).toEqual(["1948-07-11"]);
  });
});

describe("evidenceForFragment", () => {
  it("bærer hvert signal for seg, ikke bare et tall", () => {
    const evidence = evidenceForFragment(
      "AaFK i landsdelsseriekampen mot Clausenengen i Kristiansund i går. Seiren ble så knepen som 1—0, men AaFK var det beste laget",
      query({ expectedScore: [1, 0], homeAwayHint: "away" }),
      { issueId: "utgave", issueDate: "19520505", page: "3" },
    );

    expect(evidence.sameFragment).toBe(true);
    expect(evidence.scoreMatchesSource).toBe(true);
    expect(evidence.kind).toBe("article");
    expect(evidence.temporal?.inferredMatchDate).toBe("1952-05-04");
    expect(evidence.score).toBeGreaterThan(60);
  });

  /** Tabeller og kuponger skal ikke kunne slå et referat. */
  it("trekker fra for tabell, terminliste og tippekupong", () => {
    const table = evidenceForFragment(
      "Tabell: CFK 7 4 2 1 12 8 10 Aalesund 7 3 1 3 9 11 7 Hødd 7 2 2 3 8 10 6",
      query({ expectedScore: [1, 0] }),
      { issueId: "tabell", issueDate: "19520505" },
    );
    const article = evidenceForFragment(
      "Aalesund slo Clausenengen 1—0 i går, og kampen var jevn helt til slutt",
      query({ expectedScore: [1, 0] }),
      { issueId: "referat", issueDate: "19520505" },
    );
    expect(table.score).toBeLessThan(article.score);
    expect(table.kind).toBe("standings");
  });

  it("teller ikke resultatet når bare det ene laget er nevnt", () => {
    const evidence = evidenceForFragment(
      "KFK slo Nordlandet 1—0 på Kristiansund stadion",
      query({ expectedScore: [1, 0] }),
      { issueId: "annen", issueDate: "19520505" },
    );
    expect(evidence.scoreMatchesSource).toBeUndefined();
  });

  it("ser bort fra støy der navnene betyr noe annet", () => {
    const evidence = evidenceForFragment(
      "Raufoss ammunisjonsfabrikk melder om økt produksjon, og i Aalesund by er det stille",
      query({ opponent: "Raufoss", opponentAliases: [] }),
      { issueId: "støy", issueDate: "19630617" },
    );
    expect(evidence.matchTalk).toBe(false);
    expect(evidence.score).toBeLessThan(45);
  });
});

describe("reconcile", () => {
  const evidenceFrom = (text: string, issued: string, options: Partial<NewspaperQuery> = {}) =>
    evidenceForFragment(text, query({ expectedScore: [1, 0], ...options }), { issueId: `utgave-${issued}`, issueDate: issued });

  it("bekrefter kampen når dato og resultat begge holder", () => {
    const result = reconcile(query({ expectedScore: [1, 0], homeAwayHint: "away" }), [
      evidenceFrom("AaFK i landsdelsseriekampen mot Clausenengen i Kristiansund i går. Seiren ble så knepen som 1—0", "19520505", { homeAwayHint: "away" }),
    ]);
    expect(result.status).toBe("confirmed");
    expect(result.matchDate?.value).toBe("1952-05-04");
    expect(result.checks.score).toBe("confirmed");
  });

  /**
   * Sarpsborg-kampen i 1948: kilden sier 1-0, avisa sier 2-1, og kampen er
   * likevel den samme. Det skal rapporteres som konflikt, ikke skjules bak en
   * bekreftelse og ikke forkastes fordi resultatet avviker.
   */
  it("melder konflikt når avisa har et annet resultat enn kilden", () => {
    const result = reconcile(query({ opponent: "Sarpsborg", opponentAliases: [], expectedScore: [1, 0] }), [
      evidenceForFragment(
        "Til kveldens kamp mellom Sarpsborg og ÅFK på Nørve stiller Sarpsborg med følgende lag",
        query({ opponent: "Sarpsborg", opponentAliases: [], expectedScore: [1, 0] }),
        { issueId: "forhånd", issueDate: "19480716" },
      ),
      evidenceForFragment(
        "ÅFK—Sarpsborg 2—1. Kampen på Nørve i går ble en real thriller for de 4000 tilskuerne",
        query({ opponent: "Sarpsborg", opponentAliases: [], expectedScore: [1, 0] }),
        { issueId: "referat", issueDate: "19480717" },
      ),
    ]);

    expect(result.status).toBe("conflict");
    expect(result.matchDate?.value).toBe("1948-07-16");
    expect(result.newspaperScore).toEqual([2, 1]);
    expect(result.sourceScore).toEqual([1, 0]);
    expect(result.checks.score).toBe("conflict");
  });

  it("sier ikke funnet når ingen kandidat når terskelen", () => {
    const result = reconcile(query({ expectedScore: [1, 0] }), [
      evidenceFrom("Værmeldingen for Sunnmøre neste uke", "19520505"),
    ]);
    expect(result.status).toBe("not_found");
    expect(result.evidence).toEqual([]);
  });
});

describe("clusterEvidence", () => {
  /**
   * Forhåndsomtale, kampdag og referat er tre utgaver om én kamp. Som
   * konkurrenter svekker de hverandre; som én hendelse er de tredobbelt belegg.
   */
  it("samler utgaver som peker på samme kampdato", () => {
    const raufoss = query({ opponent: "Raufoss", opponentAliases: [], expectedScore: [1, 0] });
    const events = clusterEvidence([
      evidenceForFragment("ÅFK møter Raufoss i morgen, og kampen blir tøff", raufoss, { issueId: "a", issueDate: "19630615" }),
      evidenceForFragment("Til kveldens kamp mellom Raufoss og ÅFK stiller laget slik", raufoss, { issueId: "b", issueDate: "19630616" }),
      evidenceForFragment("Raufoss—ÅFK 0—1. Kampen i går ga ÅFK to poeng", raufoss, { issueId: "c", issueDate: "19630617" }),
      evidenceForFragment("ÅFK vant over Raufoss i går kveld på Kråmyra", raufoss, { issueId: "d", issueDate: "19631021" }),
    ]);

    expect(events).toHaveLength(2);
    const june = events.find((event) => event.inferredDate === "1963-06-16")!;
    expect(june.evidence).toHaveLength(3);
    expect(june.score).toBeGreaterThan(events.find((event) => event.inferredDate === "1963-10-20")!.score);
  });
});

describe("allocateEvents", () => {
  const hypothesis = (id: string, no: number, score: [number, number]): MatchHypothesis => ({
    id,
    order: no,
    queries: [{ ...query({ opponent: "Raufoss", opponentAliases: [], expectedScore: score }), ref: { sourceId: "kilde", file: "f", season: 1963, no } } as SourceResultQuery],
  });

  /**
   * Invarianten som manglet: to kamper mot samme motstander må få hver sin
   * hendelse. Før fordelingen tok begge radene den hendelsen som så sterkest ut
   * alene, og junikampen ble datert til oktober.
   */
  it("gir to kamper mot samme motstander hver sin hendelse", () => {
    const raufoss = (score: [number, number]) => query({ opponent: "Raufoss", opponentAliases: [], expectedScore: score });
    const events = clusterEvidence([
      evidenceForFragment("Raufoss—ÅFK 0—1. Kampen i går ga ÅFK to poeng", raufoss([1, 0]), { issueId: "juni", issueDate: "19630617" }),
      evidenceForFragment("ÅFK—Raufoss 0—2 i går. Raufoss tok med seg begge poengene fra Kråmyra", raufoss([0, 2]), { issueId: "oktober", issueDate: "19631021" }),
    ]);

    const allocations = allocateEvents([hypothesis("A", 27, [1, 0]), hypothesis("B", 30, [0, 2])], events);
    const [first, second] = allocations;

    expect(first!.eventId).toBeDefined();
    expect(second!.eventId).toBeDefined();
    expect(first!.eventId).not.toBe(second!.eventId);
    // Kronologien i kilden stemmer med datoene: #27 før #30.
    expect(first!.eventId).toBe("event:1963-06-16");
    expect(second!.eventId).toBe("event:1963-10-20");
  });

  it("lar en påstand stå uten hendelse når det ikke finnes flere", () => {
    const events = clusterEvidence([
      evidenceForFragment("Raufoss—ÅFK 0—1. Kampen i går ga ÅFK to poeng", query({ opponent: "Raufoss", opponentAliases: [], expectedScore: [1, 0] }), { issueId: "juni", issueDate: "19630617" }),
    ]);
    const allocations = allocateEvents([hypothesis("A", 27, [1, 0]), hypothesis("B", 30, [0, 2])], events);
    expect(allocations.filter((allocation) => allocation.eventId !== undefined)).toHaveLength(1);
  });

  it("rapporterer marginen til nest beste fordeling", () => {
    const events = clusterEvidence([
      evidenceForFragment("Raufoss—ÅFK 0—1. Kampen i går ga ÅFK to poeng", query({ opponent: "Raufoss", opponentAliases: [], expectedScore: [1, 0] }), { issueId: "juni", issueDate: "19630617" }),
      evidenceForFragment("ÅFK—Raufoss 0—2 i går på Kråmyra", query({ opponent: "Raufoss", opponentAliases: [], expectedScore: [0, 2] }), { issueId: "oktober", issueDate: "19631021" }),
    ]);
    const [allocation] = allocateEvents([hypothesis("A", 27, [1, 0]), hypothesis("B", 30, [0, 2])], events);
    expect(allocation!.margin).toBeGreaterThan(0);
    expect(allocation!.runnerUpScore).toBeGreaterThan(0);
  });
});

describe("verifyNewspaperCandidate", () => {
  const raufoss = { ...query({ opponent: "Raufoss", opponentAliases: [], expectedScore: [1, 0] }), ref: { sourceId: "k", file: "f", season: 1963, no: 27 } } as SourceResultQuery;
  const issue = (texts: string[]): DiscoveredIssue => ({
    id: "utgave",
    issued: "19630615",
    itemUrl: "https://www.nb.no/items/utgave",
    newspaper: "Sunnmørsposten",
    mayStoreFullText: false,
    fragments: texts.map((text, index) => ({ page: String(index + 2), text })),
  });

  /**
   * Invarianten hele denne modellen finnes for: å lese mer av samme avisutgave
   * skal aldri svekke det vi alt har funnet der. Før vant det høyest scorende
   * vinduet alene, og et sterkere vindu uten tidsuttrykk kunne slette datoen.
   */
  it("mister ikke datoen når berikelsen legger til et sterkere avsnitt", () => {
    const before = verifyNewspaperCandidate(raufoss, issue([
      "ÅFK møter Raufoss i morgen på Raufoss stadion",
    ]))!;
    expect(before.temporal?.inferredMatchDate).toBe("1963-06-16");

    const after = verifyNewspaperCandidate(raufoss, issue([
      "ÅFK møter Raufoss i morgen på Raufoss stadion",
      "Raufoss—ÅFK. Kampen blir avgjørende for serien, og ÅFK stiller med sitt beste lag foran tilskuerne, med dommer fra Oslo",
    ]))!;

    expect(after.temporal?.inferredMatchDate).toBe("1963-06-16");
    expect(after.score).toBeGreaterThanOrEqual(before.score);
  });

  it("mister ikke resultatet når et annet avsnitt scorer høyere", () => {
    const before = verifyNewspaperCandidate(raufoss, issue([
      "Raufoss—ÅFK 0—1 var stillingen",
    ]))!;
    expect(before.scoreFound).toEqual([0, 1]);

    const after = verifyNewspaperCandidate(raufoss, issue([
      "Raufoss—ÅFK 0—1 var stillingen",
      "Kampen mellom Raufoss og ÅFK i går samlet mange tilskuere, og dommeren hadde full kontroll gjennom hele oppgjøret",
    ]))!;
    expect(after.scoreFound).toEqual([0, 1]);
    expect(after.temporal?.inferredMatchDate).toBe("1963-06-14");
  });

  /** Roller hentes bare fra vinduer som selv navngir begge lagene. */
  it("henter ikke roller fra avsnitt uten kampidentitet", () => {
    const evidence = verifyNewspaperCandidate(raufoss, issue([
      "ÅFK og Raufoss møtes til dyst på lørdag i en viktig kamp for begge lag",
      "Bygdas historie ble markert i går med tale og korps",
    ]))!;
    expect(evidence.temporal?.phrase).not.toBe("i går");
  });
});
