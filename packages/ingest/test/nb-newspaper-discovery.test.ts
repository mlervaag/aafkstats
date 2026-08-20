import { describe, expect, it } from "vitest";
import { classifyFragment } from "../src/newspaper/fragment-kind.js";
import { inferMatchDate, resolveMatchDate } from "../src/newspaper/date-inference.js";
import { matchScore, parseScores } from "../src/newspaper/score-parse.js";
import { parseNote } from "../src/newspaper/note-parser.js";
import { evidenceForFragment, inferHomeAway } from "../src/newspaper/evidence.js";
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

describe("inferHomeAway", () => {
  it("utleder ikke automatisk home fra løpende referat med seier 1-0", () => {
    const cfk = query({ opponent: "Clausenengen", opponentAliases: ["CFK"] });
    expect(inferHomeAway("AaFK slo Clausenengen 1—0 i går, og seieren var fortjent", cfk)).toBeUndefined();
    expect(inferHomeAway("Seiren ble så knepen som 1—0, men AaFK var det beste laget", cfk)).toBeUndefined();
  });

  it("gir ikke homeAwayFound av stedsnavn i irrelevant kontekst", () => {
    const cfk = query({ opponent: "Clausenengen", opponentAliases: ["CFK"] });
    expect(inferHomeAway("Statsministeren besøkte Kristiansund i går. AaFK slo Clausenengen 1—0", cfk)).toBeUndefined();
    expect(inferHomeAway("AaFK i landsdelsseriekampen mot Clausenengen i Kristiansund i går. Seiren ble 1—0", cfk)).toBeUndefined();
  });

  it("gjenkjenner eksplisitt bortekamp og bortebane", () => {
    const hodd = query({ opponent: "Hødd", opponentAliases: [] });
    expect(inferHomeAway("AaFK spilte bortekamp mot Hødd", hodd)).toBe("away");
    expect(inferHomeAway("AaFK på bortebane mot Hødd i går", hodd)).toBe("away");
  });

  it("gjenkjenner Kråmyra, Aksla og Ålesund som hjemmebane", () => {
    const hodd = query({ opponent: "Hødd", opponentAliases: [] });
    expect(inferHomeAway("AaFK møtte Hødd på Kråmyra", hodd)).toBe("home");
    expect(inferHomeAway("Kampen på Aksla stadion ble jevn", hodd)).toBe("home");
    expect(inferHomeAway("I Aalesund vant AaFK mot Hødd", hodd)).toBe("home");
    expect(inferHomeAway("AaFK spilte hjemmekamp mot Hødd", hodd)).toBe("home");
  });

  it("utleder home/away fra oppsettlinjer med bindestrek og tankestrek", () => {
    const hodd = query({ opponent: "Hødd", opponentAliases: [] });
    expect(inferHomeAway("AaFK — Hødd 2—0", hodd)).toBe("home");
    expect(inferHomeAway("Hødd — AaFK 0—1", hodd)).toBe("away");
    expect(inferHomeAway("ÅFK - Hødd 1-0", hodd)).toBe("home");
  });

  it("behandler klubbnavn med spesialtegn (punktum, parentes) bokstavelig", () => {
    const kfk = query({ opponent: "K. F. K.", opponentAliases: ["K.F.K."] });
    expect(inferHomeAway("K. F. K. — AaFK 0—1", kfk)).toBe("away");
    expect(inferHomeAway("Aa.F.K. — K. F. K. 2—0", kfk)).toBe("home");

    const frigg = query({ opponent: "Frigg (Oslo)", opponentAliases: [] });
    expect(inferHomeAway("Frigg (Oslo) — AaFK 0—2", frigg)).toBe("away");
    expect(inferHomeAway("AaFK — Frigg (Oslo) 3—1", frigg)).toBe("home");
  });
});

describe("reconcile", () => {
  const evidenceFrom = (text: string, issued: string, options: Partial<NewspaperQuery> = {}) =>
    evidenceForFragment(text, query({ expectedScore: [1, 0], ...options }), { issueId: `utgave-${issued}`, issueDate: issued });

  it("bekrefter kampen når dato og resultat begge holder", () => {
    const result = reconcile(query({ expectedScore: [1, 0], homeAwayHint: "away" }), [
      evidenceFrom("CFK—AaFK 0—1 i landsdelsseriekampen i Kristiansund i går. Seiren ble så knepen som 0—1", "19520505", { homeAwayHint: "away" }),
    ]);
    expect(result.status).toBe("confirmed");
    expect(result.matchDate?.value).toBe("1952-05-04");
    expect(result.checks.score).toBe("confirmed");
  });

  /**
   * Clausenengen 1952 #16: bekreftes med dato 1952-05-04 uten falsk homeAway-konflikt
   * selv om kilden har bortekamphint og referatet ikke har eksplisitt banebelegg (homeAway: unknown).
   */
  it("bekrefter Clausenengen 1952 #16 med dato 1952-05-04 uten falsk homeAway-konflikt", () => {
    const cfk = query({ opponent: "Clausenengen", opponentAliases: ["CFK"], expectedScore: [1, 0], homeAwayHint: "away", year: 1952 });
    const result = reconcile(cfk, [
      evidenceForFragment("AaFK slo Clausenengen 1—0 i går i Kristiansund", cfk, { issueId: "cfk-mai", issueDate: "19520505" }),
    ]);
    expect(result.status).toBe("confirmed");
    expect(result.matchDate?.value).toBe("1952-05-04");
    expect(result.checks.score).toBe("confirmed");
    expect(result.checks.homeAway).toBe("unknown");
  });

  /**
   * Nordlandet 1948 #15: sammenhengende dato 1948-05-06 og resultat 6-1,
   * men kilden sier bortekamp mens avisa sier hjemmekamp på Kråmyra -> ambiguous med checks.homeAway: conflict.
   */
  it("gir ambiguous for Nordlandet 1948 #15 når kilde og avis har motstridende hjemme/borte", () => {
    const nordlandet = query({ opponent: "Nordlandet", opponentAliases: [], expectedScore: [6, 1], homeAwayHint: "away", year: 1948 });
    const result = reconcile(nordlandet, [
      evidenceForFragment("AaFK slo Nordlandet 6—1 torsdag på Kråmyra i 1. divisjon", nordlandet, { issueId: "n-1", issueDate: "19480511" }),
      evidenceForFragment("AaFK spilte mot Nordlandet i går på Kråmyra i 1. divisjon", nordlandet, { issueId: "n-2", issueDate: "19480507" }),
    ]);
    expect(result.status).toBe("ambiguous");
    expect(result.matchDate?.value).toBe("1948-05-06");
    expect(result.checks.homeAway).toBe("conflict");
    expect(result.checks.score).toBe("confirmed");
  });

  /**
   * Ørsta 1947 #19: kilden spesifiserer cupkamp, et udatert/senere event har resultatavvik,
   * men et annet sterkt event i sesongen matcher cup-hintet bedre -> ambiguous.
   */
  it("gir ambiguous for Ørsta 1947 #19 når et annet sterkt event matcher cup-hintet", () => {
    const orsta = query({ opponent: "Ørsta", opponentAliases: [], expectedScore: [2, 0], competitionHint: "cup", hints: { keywords: ["cup"] }, year: 1947 });
    const cupEvent = evidenceForFragment("I cupkampen i går slo AaFK Ørsta", orsta, { issueId: "cup", issueDate: "19470616" });
    const conflictEvent = evidenceForFragment("I kampen i går slo AaFK Ørsta 2—1", orsta, { issueId: "serie", issueDate: "19470825" });

    const result = reconcile(orsta, [cupEvent, conflictEvent]);
    expect(result.status).toBe("ambiguous");
  });

  /**
   * Øvre Telemark Kretslag 1949 #5: sammenhengende dato 1949-07-10 og resultat 0-1.
   */
  it("bekrefter Øvre Telemark Kretslag 1949 #5 med sammenhengende bevis for 1949-07-10", () => {
    const telemark = query({ opponent: "Øvre Telemark Kretslag", opponentAliases: [], expectedScore: [0, 1], year: 1949 });
    const result = reconcile(telemark, [
      evidenceForFragment("Øvre Telemark Kretslag slo AaFK 1—0 i går", telemark, { issueId: "t-1", issueDate: "19490711" }),
    ]);
    expect(result.status).toBe("confirmed");
    expect(result.matchDate?.value).toBe("1949-07-10");
    expect(result.checks.score).toBe("confirmed");
  });

  /**
   * Ranheim 1946 #15: Juni-hendelsen bekreftes med 1946-06-16 og 2-2,
   * juli-hendelsen mangler score.
   */
  it("bekrefter Ranheim 1946 #15 på juni-datoen 1946-06-16 med 2-2", () => {
    const ranheim = query({ opponent: "Ranheim", opponentAliases: [], expectedScore: [2, 2], year: 1946 });
    const result = reconcile(ranheim, [
      evidenceForFragment("AaFK spilte 2—2 mot Ranheim søndag", ranheim, { issueId: "juni", issueDate: "19460617" }),
      evidenceForFragment("AaFK spilte kamp i går", ranheim, { issueId: "juli", issueDate: "19460710" }),
    ]);

    expect(result.status).toBe("confirmed");
    expect(result.matchDate?.value).toBe("1946-06-16");
    expect(result.checks.score).toBe("confirmed");
    expect(result.checks.opponent).toBe("confirmed");
  });

  /**
   * Herd 1949 #2: Juni-hendelsen inneholder 4-2 (reversert 2-4) og peker på 1949-06-12,
   * august-hendelsen mangler sammenhengende resultatbevis.
   */
  it("bekrefter Herd 1949 #2 på juni-datoen 1949-06-12 med 4-2 (reversert 2-4)", () => {
    const herd = query({ opponent: "Herd", opponentAliases: [], expectedScore: [2, 4], year: 1949 });
    const result = reconcile(herd, [
      evidenceForFragment("Herd slo AaFK 4—2 søndag", herd, { issueId: "juni", issueDate: "19490617" }),
      evidenceForFragment("AaFK møtte Herd i går på Kråmyra", herd, { issueId: "august", issueDate: "19490822" }),
    ]);

    expect(result.status).toBe("confirmed");
    expect(result.matchDate?.value).toBe("1949-06-12");
    expect(result.checks.score).toBe("confirmed");
    expect(result.checks.opponent).toBe("confirmed");
  });

  /**
   * Old Boys 1946 #9: Juli-dato og oktober-resultat er separate hendelser -> ambiguous.
   */
  it("gir ambiguous for Old Boys 1946 #9 når juli-dato og oktober-score er separate hendelser", () => {
    const oldBoys = query({ opponent: "Old Boys", opponentAliases: [], expectedScore: [4, 1], year: 1946 });
    const result = reconcile(oldBoys, [
      evidenceForFragment("AaFK og Old Boys møttes i går", oldBoys, { issueId: "juli", issueDate: "19460712" }),
      evidenceForFragment("Old Boys vant 5—0 over AaFK", oldBoys, { issueId: "oktober", issueDate: "19461007" }),
    ]);

    expect(result.status).toBe("ambiguous");
    expect(result.checks.score).toBe("unknown");
    expect(result.newspaperScore).toBeUndefined();
  });

  /**
   * Scorebevis: Tabellscore skal ikke oppheve eller bekrefte en konflikt fra artikkel.
   */
  it("lar ikke en tabellscore oppheve en resultatkonflikt fra en artikkel", () => {
    const cfk = query({ opponent: "Clausenengen", opponentAliases: [], expectedScore: [1, 0], year: 1952 });
    const tableEvidence = evidenceForFragment("Tabell: CFK 7 4 2 1 12 8 10 AaFK 7 3 1 3 9 11 7", cfk, { issueId: "tabell", issueDate: "19520505" });
    tableEvidence.scoreMatchesSource = true;
    tableEvidence.temporal = { phrase: "i går", offset: -1, inferredMatchDate: "1952-05-04", confidence: "high" };

    const articleEvidence = evidenceForFragment("I kampen i går slo Clausenengen AaFK 2—1 i Kristiansund", cfk, { issueId: "referat", issueDate: "19520505" });

    const result = reconcile(cfk, [tableEvidence, articleEvidence]);
    expect(result.status).toBe("conflict");
    expect(result.checks.score).toBe("conflict");
    expect(result.newspaperScore).toEqual([2, 1]);
  });

  /**
   * Scorebevis: Motstridende artikler i samme hendelse gir ambiguous.
   */
  it("gir ambiguous dersom samme hendelse inneholder motstridende kampbevis", () => {
    const cfk = query({ opponent: "Clausenengen", opponentAliases: [], expectedScore: [1, 0], year: 1952 });
    const article1 = evidenceForFragment("AaFK slo Clausenengen 1—0 i går", cfk, { issueId: "artikkel-1", issueDate: "19520505" });
    const article2 = evidenceForFragment("Clausenengen slo AaFK 2—1 i går", cfk, { issueId: "artikkel-2", issueDate: "19520505" });

    const result = reconcile(cfk, [article1, article2]);
    expect(result.status).toBe("ambiguous");
    expect(result.checks.score).toBe("unknown");
  });

  /**
   * Hendelseslokal confidence: Blåses ikke opp av sterke bevis fra andre kamper.
   */
  it("beregner combinedConfidence kun fra den valgte hendelsen, ikke fra andre kamper", () => {
    const cfk = query({ opponent: "Clausenengen", opponentAliases: [], expectedScore: [1, 0], year: 1952 });
    const mayMatch = evidenceForFragment("AaFK slo Clausenengen 1—0 i går i Kristiansund", cfk, { issueId: "mai", issueDate: "19520505" });
    const octMatch1 = evidenceForFragment("AaFK og Clausenengen spilte høstkamp i går", cfk, { issueId: "okt-1", issueDate: "19521020" });
    const octMatch2 = evidenceForFragment("Clausenengen og AaFK møttes igjen i går", cfk, { issueId: "okt-2", issueDate: "19521020" });

    const singleResult = reconcile(cfk, [mayMatch]);
    const multiResult = reconcile(cfk, [mayMatch, octMatch1, octMatch2]);

    expect(multiResult.status).toBe("confirmed");
    expect(multiResult.combinedConfidence).toBe(singleResult.combinedConfidence);
  });

  /**
   * Representativ datovisning for ambiguous med flere daterte hendelser.
   */
  it("velger en representativ datert hendelse (og ikke en udatert) ved ambiguous med flere daterte hendelser", () => {
    const dr = query({ opponent: "Dr. Ballklubb", opponentAliases: [], expectedScore: [3, 2], year: 1947 });
    const dated1 = evidenceForFragment("AaFK møtte Dr. Ballklubb fredag", dr, { issueId: "d1", issueDate: "19470708" });
    const dated2 = evidenceForFragment("Dr. Ballklubb og AaFK spilte søndag", dr, { issueId: "d2", issueDate: "19471027" });
    const undatedStrong = evidenceForFragment("Dr. Ballklubb og AaFK spilte en fantastisk fotballkamp med mange mål foran publikum", dr, { issueId: "u", issueDate: "19470811" });

    const result = reconcile(dr, [dated1, dated2, undatedStrong]);
    expect(result.status).toBe("ambiguous");
    expect(result.matchDate).toBeDefined();
    expect(["1947-07-04", "1947-10-26"]).toContain(result.matchDate?.value);
    expect(result.matchDate?.disagreement.length).toBeGreaterThan(0);
  });

  /**
   * Spjelkavik 1953: et datert event har scoreConflict 3-2, men et annet event i sesongen
   * har kildens resultat 2-1 -> ambiguous (ikke konflikt mot kilden).
   */
  it("gir ambiguous for Spjelkavik 1953 når et annet event i sesongen har scoreAgreement", () => {
    const spjelkavik = query({ opponent: "Spjelkavik", opponentAliases: [], expectedScore: [2, 1], year: 1953 });
    const conflictEvent = evidenceForFragment("Spjelkavik—AaFK 3—2. Kampen i går ga hjemmeseier", spjelkavik, { issueId: "c", issueDate: "19530708" });
    const agreementEvent = evidenceForFragment("AaFK slo Spjelkavik 2—1 i treningskampen på Kråmyra", spjelkavik, { issueId: "a", issueDate: "19530419" });

    const result = reconcile(spjelkavik, [conflictEvent, agreementEvent]);
    expect(result.status).toBe("ambiguous");
  });

  /**
   * Guard 1955: et datert event har scoreConflict 6-0, men et annet event i sesongen
   * har kildens resultat 2-0 -> ambiguous.
   */
  it("gir ambiguous for Guard 1955 når et annet event i sesongen har scoreAgreement", () => {
    const guard = query({ opponent: "Guard", opponentAliases: [], expectedScore: [2, 0], year: 1955 });
    const conflictEvent = evidenceForFragment("AaFK slo Guard 6—0 i går", guard, { issueId: "c", issueDate: "19550830" });
    const agreementEvent = evidenceForFragment("AaFK slo Guard 2—0 på Kråmyra", guard, { issueId: "a", issueDate: "19550430" });

    const result = reconcile(guard, [conflictEvent, agreementEvent]);
    expect(result.status).toBe("ambiguous");
  });

  /**
   * Sykkylven 1955: kilden spesifiserer 1. divisjon og bortekamp (away),
   * et privatkampevent har resultatavvik 3-0, men et annet datert event matcher 1. divisjon og away -> ambiguous.
   */
  it("gir ambiguous for Sykkylven 1955 når et annet event matcher competitionHint og homeAwayHint bedre", () => {
    const sykkylven = query({ opponent: "Sykkylven", opponentAliases: [], expectedScore: [2, 2], competitionHint: "1. divisjon", homeAwayHint: "away", year: 1955 });
    const conflictEvent = evidenceForFragment("AaFK slo Sykkylven 3—0 i privatkampen i går", sykkylven, { issueId: "c", issueDate: "19550520" });
    const leagueEvent = evidenceForFragment("I 1. divisjonskampen i går spilte Sykkylven mot AaFK", sykkylven, { issueId: "l", issueDate: "19550808" });

    const result = reconcile(sykkylven, [conflictEvent, leagueEvent]);
    expect(result.status).toBe("ambiguous");
  });

  /**
   * Guard 1959: bevis med score publisert 1. juni kan ikke knyttes til en kamp datert 3. juni -> ambiguous.
   */
  it("gir ambiguous for Guard 1959 når scorebevis er publisert før den utledede kampdatoen", () => {
    const guard = query({ opponent: "Guard", opponentAliases: [], expectedScore: [6, 2], year: 1959 });
    const june1Score = evidenceForFragment("AaFK slo Guard 6—3 i Kristiansund", guard, { issueId: "june1", issueDate: "19590601" });
    const june4Date = evidenceForFragment("AaFK møtte Guard i går på Kråmyra", guard, { issueId: "june4", issueDate: "19590604" });

    const result = reconcile(guard, [june1Score, june4Date]);
    expect(result.status).toBe("ambiguous");
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

  /**
   * Tidskausalitet: Et kampresultat publisert 1. juni kan ikke klynges til en kamp datert 3. juni.
   */
  it("klynger ikke et resultat publisert før den utledede kampdatoen", () => {
    const guard = query({ opponent: "Guard", opponentAliases: [], expectedScore: [6, 2] });
    const june1Score = evidenceForFragment("AaFK slo Guard 6—3", guard, { issueId: "june1", issueDate: "19590601" });
    const june4Dated = evidenceForFragment("AaFK møtte Guard i går", guard, { issueId: "june4", issueDate: "19590604" });

    const events = clusterEvidence([june1Score, june4Dated]);
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.inferredDate === "1959-06-03" && e.evidence.length === 1)).toBe(true);
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
