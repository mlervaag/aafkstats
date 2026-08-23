import { describe, expect, it } from "vitest";
import type { BatchEntry, BatchReport, IssueRef } from "../src/adapters/nb-newspaper-batch.js";
import { buildPilotReviewEntries, isSameNewspaperDocument, prepareMatchForNewspaperWrite, reconcilePrematchExternalReport } from "../src/newspaper/pilot-review.js";
import type { Match, Source } from "@aafkstats/schema";

const issue = (overrides: Partial<IssueRef> = {}): IssueRef => ({
  id: "issue",
  issued: "19790430",
  itemUrl: "https://www.nb.no/items/issue",
  pageUrl: "https://www.nb.no/items/issue?page=2",
  page: "2",
  access: { viewability: "NONE", isPublicDomain: false, mayStoreFullText: false, attribution: "test" },
  accessNote: "test",
  score: 78,
  reasons: ["resultat: 0-1"],
  genres: ["match_report"],
  evidence: [{ genre: "match_report", score: 75, reasons: ["motstander og AaFK i samme avsnitt"] }],
  dayOffset: 1,
  ...overrides,
});

const entry = (candidate: IssueRef): BatchEntry => ({
  matchId: "1979-04-29-aalesunds-fk-hodd",
  date: "1979-04-29",
  opponent: "Hødd",
  score: "0-1",
  competitionId: "andredivisjon",
  homeAway: "home",
  newspaper: "Sunnmørsposten",
  searchContext: { aafkAliases: ["ÅFK"], opponentAliases: ["Hødd"], existingSourceIds: [] },
  searchWindow: { from: "1979-04-27", to: "1979-05-01", radiusDays: 2, expanded: false },
  outcome: "candidate_found",
  visualReviewStatus: "pending",
  checkedAt: "2026-08-23T00:00:00Z",
  candidateIssuesFound: 1,
  candidates: [candidate],
  issue: candidate,
});

const report = (entries: BatchEntry[]): BatchReport => ({
  version: 2,
  adapter: "canonical-newspaper-enrichment@2",
  createdAt: "2026-08-23T00:00:00Z",
  updatedAt: "2026-08-23T00:00:00Z",
  range: { from: 1979, to: 1979 },
  entries,
});

describe("1979 OCR pilot review", () => {
  it("forbereder eldre kamper som mangler valgfrie kildelister", () => {
    const match = {} as Match;
    prepareMatchForNewspaperWrite(match);
    expect(match).toMatchObject({ externalReports: [], providers: [], sources: [] });
  });

  it("gjenbruker samme NB-utgave selv om to kamper ligger på ulike sider", () => {
    const existing = { id: "sunnmorsposten-19470826-issue", urn: "URN:issue", accessUrl: "https://www.nb.no/items/issue?page=4" } as Source;
    const expected = { ...existing, accessUrl: "https://www.nb.no/items/issue?page=5" } as Source;
    expect(isSameNewspaperDocument(existing, expected)).toBe(true);
  });

  it("removes only machine-derived report markers while preserving curated reports", () => {
    const url = "https://www.nb.no/items/issue?page=2";
    const match = {
      externalReports: [
        { publisher: "Sunnmorsposten", url },
        { publisher: "Sunnmorsposten", title: "Curated report", url: `${url}&curated=1` },
      ],
      providers: [{ providerId: "nasjonalbiblioteket", url, fields: ["externalReports"] }],
      sources: [{ sourceId: "source", fields: ["externalReports"] }],
    } as Match;
    reconcilePrematchExternalReport(match, { pageUrl: url }, "source", false);
    reconcilePrematchExternalReport(match, { pageUrl: `${url}&curated=1` }, "curated-source", false);
    expect(match.externalReports).toEqual([{ publisher: "Sunnmorsposten", title: "Curated report", url: `${url}&curated=1` }]);
    expect(match.providers[0]?.fields).toEqual([]);
    expect(match.sources[0]?.fields).toEqual([]);
  });

  it("korrelerer bare lokal kampomtale og oppgir at faksimilen ikke er lest", () => {
    expect(buildPilotReviewEntries(report([entry(issue())]))[0]).toMatchObject({
      status: "ocr_correlated",
      reviewMethod: "ocr_api",
      facsimileReviewed: false,
      confidence: "high",
      canonicalLinked: false,
      visuallyReviewedPages: 0,
      evidenceIssues: [{ issueId: "issue", reviewMethod: "ocr_api", facsimileReviewed: false, canonicalLinked: false }],
    });
  });

  it("avstår for tabell/terminliste og bevarer resultatkonflikt", () => {
    const fixture = issue({ genres: ["fixture_list"], evidence: [{ genre: "fixture_list", score: 20, reasons: ["motstander og AaFK i samme avsnitt"] }] });
    const conflict = issue({ scoreConflict: { canonical: "0-1", newspaper: "2-1" } });
    const [fixtureReview, conflictReview] = buildPilotReviewEntries(report([entry(fixture), { ...entry(conflict), matchId: "1979-07-29-hodd-aalesunds-fk" }]));
    expect(fixtureReview?.status).toBe("no_ocr_candidate");
    expect(conflictReview?.status).toBe("conflict_candidate");
    expect(conflictReview?.conflict).toEqual({ field: "score", canonical: "0-1", newspaper: "2-1" });
  });

  it("never lets prematch copy create a score conflict and prefers a postmatch report", () => {
    const preview = issue({
      id: "preview",
      issued: "19620903",
      dayOffset: -2,
      score: 99,
      genres: ["preview"],
      evidence: [{ genre: "preview", score: 99, reasons: ["motstander og AaFK i samme avsnitt"] }],
      scoreConflict: { canonical: "1-2", newspaper: "0-0" },
    });
    const postmatch = issue({ id: "report", issued: "19620906", dayOffset: 1, score: 65 });
    const matchEntry = { ...entry(preview), matchId: "1962-09-05-aalesunds-fk-brann", candidates: [preview, postmatch] };

    const [review] = buildPilotReviewEntries(report([matchEntry]));
    expect(review).toMatchObject({ issueId: "report", status: "ocr_correlated" });
    expect(review?.conflict).toBeUndefined();
  });

  it("keeps a preview without carrying its stale scoreConflict forward", () => {
    const preview = issue({ issued: "19620903", dayOffset: -2, scoreConflict: { canonical: "1-2", newspaper: "0-0" } });
    const [review] = buildPilotReviewEntries(report([{ ...entry(preview), matchId: "1962-09-05-aalesunds-fk-brann" }]));
    expect(review?.status).toBe("ocr_correlated");
    expect(review?.conflict).toBeUndefined();
  });
});
