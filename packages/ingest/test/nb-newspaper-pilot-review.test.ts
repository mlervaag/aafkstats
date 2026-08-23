import { describe, expect, it } from "vitest";
import type { BatchEntry, BatchReport, IssueRef } from "../src/adapters/nb-newspaper-batch.js";
import { buildPilotReviewEntries } from "../src/newspaper/pilot-review.js";

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
  it("korrelerer bare lokal kampomtale og oppgir at faksimilen ikke er lest", () => {
    expect(buildPilotReviewEntries(report([entry(issue())]))[0]).toMatchObject({
      status: "ocr_correlated",
      reviewMethod: "ocr_api",
      facsimileReviewed: false,
      confidence: "high",
      canonicalLinked: false,
      visuallyReviewedPages: 0,
    });
  });

  it("avstår for tabell/terminliste og bevarer resultatkonflikt", () => {
    const fixture = issue({ genres: ["fixture_list"], evidence: [{ genre: "fixture_list", score: 20, reasons: ["motstander og AaFK i samme avsnitt"] }] });
    const conflict = issue({ scoreConflict: { canonical: "0-1", newspaper: "2-1" } });
    const [fixtureReview, conflictReview] = buildPilotReviewEntries(report([entry(fixture), { ...entry(conflict), matchId: "1979-07-29-hodd-aalesunds-fk" }]));
    expect(fixtureReview?.status).toBe("no_ocr_candidate");
    expect(conflictReview?.status).toBe("conflict_candidate");
  });
});
