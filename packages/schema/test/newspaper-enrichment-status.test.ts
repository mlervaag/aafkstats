import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArchiveYaml as parseYaml } from "../src/yaml.js";
import { repoRoot } from "../src/load.js";
import type { NewspaperEnrichmentStatus } from "../src/historical/newspaper-enrichment-status.js";

describe("newspaper enrichment status", () => {
  it("partisjonerer alle 39 daterte 1979-kampene deterministisk etter piloten", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    const status = parseYaml(raw) as NewspaperEnrichmentStatus;
    const entries = status.entries.filter((entry) => entry.season === 1979);

    expect(status.contract).toBe("newspaper-enrichment-status@3");
    expect(status.searchPolicy).toEqual({
      initialWindowDays: 2,
      expandedWindowDays: 3,
      resultIsRequired: false,
      pipeline: "canonical_match_date_anchored",
      reviewMethod: "ocr_api",
      facsimileReviewRequired: false,
      reviewBasis: "nb_ocr_api_production_policy",
      calibration: {
        season: 1979,
        facsimileSampleMatchLinkAccuracyPercent: 100,
        allMatchesFacsimileReviewed: false,
      },
    });
    expect(entries).toHaveLength(39);
    expect(status.pilot1979.canonicalMatchesInScope).toBe(39);
    expect(status.pilot1979.withSmpMention).toBe(31);
    expect(status.pilot1979.matchReports).toBe(23);
    expect(status.pilot1979.postMatchEvidence).toBe(28);
    expect(status.pilot1979.ocrCorrelated).toBe(30);
    expect(status.pilot1979.noOcrCandidate).toBe(8);
    expect(status.pilot1979.enrichmentComplete).toBe(22);
    expect(status.pilot1979.residualQueue).toBe(17);
    expect(status.pilot1979.residualConflictCandidate).toBe(1);
    expect(entries.find((entry) => entry.matchId === "1979-04-29-aalesunds-fk-hodd")).toMatchObject({
      date: "1979-04-29",
      opponent: "Hødd",
      competition: "andredivisjon",
      homeAway: "home",
      score: "0-1",
      hasSmpMention: true,
      hasMatchReport: true,
      hasPostMatchEvidence: true,
      ocrCorrelated: true,
      facsimileReviewed: true,
      reviewStatus: "ocr_correlated",
      enrichmentStatus: "complete",
      residualReason: "complete",
    });
    expect(entries.find((entry) => entry.matchId === "1979-08-18-stjordals-blink-aalesunds-fk")).toMatchObject({
      hasSmpMention: true,
      conflictCandidate: true,
      enrichmentStatus: "residual",
      residualReason: "conflict_candidate",
    });
  });

  it("den versjonerte køen inneholder ikke avis-OCR", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    expect(raw).not.toMatch(/fullText|rawOcr|quote:/u);
  });

  it("låser produksjonsbatchen 1972–1978 og 1979-kalibreringen", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    const status = parseYaml(raw) as NewspaperEnrichmentStatus;
    const scaled = status.entries.filter((entry) => entry.season >= 1972 && entry.season <= 1978);

    expect([1972, 1973, 1974, 1975, 1976, 1977, 1978].map((year) => status.seasons[String(year)]?.canonicalMatchesInScope))
      .toEqual([6, 4, 6, 11, 12, 7, 2]);
    expect(scaled).toHaveLength(48);
    expect(scaled.filter((entry) => entry.hasSmpMention)).toHaveLength(37);
    expect(scaled.filter((entry) => entry.canonicalLinked)).toHaveLength(36);
    expect(scaled.filter((entry) => entry.reviewStatus === "ocr_correlated")).toHaveLength(33);
    expect(scaled.filter((entry) => entry.conflictCandidate)).toHaveLength(3);
    expect(scaled.filter((entry) => entry.reviewStatus === "no_ocr_candidate")).toHaveLength(12);
    expect(scaled.filter((entry) => entry.hasMatchReport)).toHaveLength(29);
    expect(scaled.filter((entry) => entry.hasPostMatchEvidence)).toHaveLength(31);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "complete")).toHaveLength(26);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "residual")).toHaveLength(22);
    expect(scaled.filter((entry) => entry.halfTimeScore)).toHaveLength(3);
    expect(scaled.filter((entry) => entry.lineup || entry.goalscorers || entry.arena || entry.attendance || entry.referee)).toHaveLength(0);

    expect(status.seasons["1979"]).toMatchObject({
      canonicalMatchesInScope: 39,
      withSmpMention: 31,
      matchReports: 23,
      postMatchEvidence: 28,
      ocrCorrelated: 30,
      noOcrCandidate: 8,
      conflictCandidates: 1,
      enrichmentComplete: 22,
      residualQueue: 17,
      newHalfTimeScores: 7,
      newAttendances: 5,
      newArenas: 2,
      newReferees: 1,
    });
  });

  it("låser produksjonsbatchen 1963–1971 uten å endre senere regresjonssett", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    const status = parseYaml(raw) as NewspaperEnrichmentStatus;
    const scaled = status.entries.filter((entry) => entry.season >= 1963 && entry.season <= 1971);

    expect([1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971].map((year) => status.seasons[String(year)]?.canonicalMatchesInScope ?? 0))
      .toEqual([10, 7, 8, 1, 13, 1, 0, 0, 2]);
    expect(scaled).toHaveLength(42);
    expect(scaled.filter((entry) => entry.hasSmpMention)).toHaveLength(30);
    expect(scaled.filter((entry) => entry.canonicalLinked)).toHaveLength(27);
    expect(scaled.filter((entry) => entry.reviewStatus === "ocr_correlated")).toHaveLength(25);
    expect(scaled.filter((entry) => entry.conflictCandidate)).toHaveLength(2);
    expect(scaled.filter((entry) => entry.reviewStatus === "no_ocr_candidate")).toHaveLength(15);
    expect(scaled.filter((entry) => entry.hasMatchReport)).toHaveLength(22);
    expect(scaled.filter((entry) => entry.hasPostMatchEvidence)).toHaveLength(23);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "complete")).toHaveLength(20);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "residual")).toHaveLength(22);
    expect(scaled.filter((entry) => entry.conflictCandidate && entry.enrichmentStatus !== "residual")).toHaveLength(0);

    expect(status.seasons["1972"]).toMatchObject({ canonicalMatchesInScope: 6, withSmpMention: 4 });
    expect(status.seasons["1979"]).toMatchObject({
      canonicalMatchesInScope: 39,
      withSmpMention: 31,
      enrichmentComplete: 22,
      residualQueue: 17,
    });
  });

  it("låser massebatchen 1915–1962 og avistittelgrensen", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    const status = parseYaml(raw) as NewspaperEnrichmentStatus;
    const scaled = status.entries.filter((entry) => entry.season >= 1915 && entry.season <= 1962);
    const reviewRaw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-reviews.yaml"), "utf8");
    const allReviews = (parseYaml(reviewRaw) as { entries: Array<{
      matchId: string;
      canonicalLinked: boolean;
      fieldsAdded: string[];
      evidenceIssues?: Array<{ page?: string; url?: string }>;
      page?: string;
      url?: string;
    }> }).entries;
    const reviews = allReviews
      .filter((entry) => Number(entry.matchId.slice(0, 4)) >= 1915 && Number(entry.matchId.slice(0, 4)) <= 1962);

    expect([[1915, 1924], [1925, 1934], [1935, 1944], [1945, 1951], [1952, 1962]].map(([from, to]) =>
      scaled.filter((entry) => entry.season >= from! && entry.season <= to!).length)).toEqual([20, 22, 12, 62, 73]);
    expect([1916, 1931, 1939, 1941, 1942, 1943, 1944].map((year) => scaled.filter((entry) => entry.season === year).length)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(scaled).toHaveLength(189);
    expect(scaled.filter((entry) => entry.hasSmpMention)).toHaveLength(150);
    expect(reviews.filter((entry) => entry.canonicalLinked)).toHaveLength(130);
    expect(scaled.filter((entry) => entry.reviewStatus === "ocr_correlated")).toHaveLength(121);
    expect(scaled.filter((entry) => entry.conflictCandidate)).toHaveLength(9);
    expect(scaled.filter((entry) => entry.reviewStatus === "no_ocr_candidate")).toHaveLength(56);
    expect(scaled.filter((entry) => entry.reviewStatus === "not_digitized")).toHaveLength(2);
    expect(scaled.filter((entry) => entry.hasMatchReport)).toHaveLength(121);
    expect(scaled.filter((entry) => entry.hasPostMatchEvidence)).toHaveLength(121);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "complete")).toHaveLength(112);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "residual")).toHaveLength(77);
    expect(scaled.filter((entry) => entry.conflictCandidate && entry.enrichmentStatus !== "residual")).toHaveLength(0);
    expect(reviews.filter((entry) => entry.fieldsAdded.length > 0)).toHaveLength(1);
    expect(scaled.find((entry) => entry.matchId === "1962-09-05-aalesunds-fk-sk-brann")).toMatchObject({
      reviewStatus: "ocr_correlated",
      conflictCandidate: false,
      hasMatchReport: false,
    });

    const oldTitle = await readFile(join(repoRoot(), "data", "sources", "sunnmorsposten-19260906-88cb85c15a5067aee5fd3c089913cd98.yaml"), "utf8");
    const newTitle = await readFile(join(repoRoot(), "data", "sources", "sunnmorsposten-19280827-f4997dd07e6d1b8196898be8b6c96fa1.yaml"), "utf8");
    expect(oldTitle).toContain("title: Søndmørsposten 1926-09-06");
    expect(newTitle).toContain("title: Sunnmørsposten 1928-08-27");

    const pageLinks = allReviews.flatMap((entry) => [
      ...(entry.evidenceIssues ?? []),
      { page: entry.page, url: entry.url },
    ]).filter((issue): issue is { page: string; url: string } => Boolean(issue.page && issue.url));
    expect(pageLinks).not.toHaveLength(0);
    expect(pageLinks.filter((issue) =>
      Number(new URL(issue.url).searchParams.get("page")) !== Number(issue.page) - 1,
    )).toEqual([]);
  });

  it("låser produksjonsbatchen 1980–1999 og bevarer konfliktsemantikken", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    const status = parseYaml(raw) as NewspaperEnrichmentStatus;
    const scaled = status.entries.filter((entry) => entry.season >= 1980 && entry.season <= 1999);

    expect(scaled).toHaveLength(378);
    expect(scaled.filter((entry) => entry.hasSmpMention)).toHaveLength(318);
    expect(scaled.filter((entry) => entry.reviewStatus === "ocr_correlated")).toHaveLength(293);
    expect(scaled.filter((entry) => entry.conflictCandidate)).toHaveLength(25);
    expect(scaled.filter((entry) => entry.reviewStatus === "no_ocr_candidate")).toHaveLength(60);
    expect(scaled.filter((entry) => entry.hasMatchReport)).toHaveLength(300);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "complete")).toHaveLength(275);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "residual")).toHaveLength(103);
    expect(scaled.filter((entry) => entry.conflictCandidate && entry.enrichmentStatus !== "residual")).toHaveLength(0);
    expect(scaled.filter((entry) => entry.facsimileReviewed)).toHaveLength(0);
  });
});
