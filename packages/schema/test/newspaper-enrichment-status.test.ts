import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../src/load.js";
import type { NewspaperEnrichmentStatus } from "../src/historical/newspaper-enrichment-status.js";

describe("newspaper enrichment status", () => {
  it("partisjonerer alle 39 daterte 1979-kampene deterministisk etter piloten", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    const status = parseYaml(raw, { schema: "core" }) as NewspaperEnrichmentStatus;
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
    expect(status.pilot1979.matchReports).toBe(24);
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
      facsimileReviewed: false,
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
    const status = parseYaml(raw, { schema: "core" }) as NewspaperEnrichmentStatus;
    const scaled = status.entries.filter((entry) => entry.season >= 1972 && entry.season <= 1978);

    expect([1972, 1973, 1974, 1975, 1976, 1977, 1978].map((year) => status.seasons[String(year)]?.canonicalMatchesInScope))
      .toEqual([6, 4, 6, 11, 12, 7, 2]);
    expect(scaled).toHaveLength(48);
    expect(scaled.filter((entry) => entry.hasSmpMention)).toHaveLength(37);
    expect(scaled.filter((entry) => entry.canonicalLinked)).toHaveLength(36);
    expect(scaled.filter((entry) => entry.reviewStatus === "ocr_correlated")).toHaveLength(33);
    expect(scaled.filter((entry) => entry.conflictCandidate)).toHaveLength(3);
    expect(scaled.filter((entry) => entry.reviewStatus === "no_ocr_candidate")).toHaveLength(12);
    expect(scaled.filter((entry) => entry.hasMatchReport)).toHaveLength(31);
    expect(scaled.filter((entry) => entry.hasPostMatchEvidence)).toHaveLength(31);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "complete")).toHaveLength(26);
    expect(scaled.filter((entry) => entry.enrichmentStatus === "residual")).toHaveLength(22);
    expect(scaled.filter((entry) => entry.halfTimeScore)).toHaveLength(3);
    expect(scaled.filter((entry) => entry.lineup || entry.goalscorers || entry.arena || entry.attendance || entry.referee)).toHaveLength(0);

    expect(status.seasons["1979"]).toMatchObject({
      canonicalMatchesInScope: 39,
      withSmpMention: 31,
      matchReports: 24,
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
    const status = parseYaml(raw, { schema: "core" }) as NewspaperEnrichmentStatus;
    const scaled = status.entries.filter((entry) => entry.season >= 1963 && entry.season <= 1971);

    expect([1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971].map((year) => status.seasons[String(year)]?.canonicalMatchesInScope ?? 0))
      .toEqual([10, 7, 8, 1, 13, 1, 0, 0, 2]);
    expect(scaled).toHaveLength(42);
    expect(scaled.filter((entry) => entry.hasSmpMention)).toHaveLength(30);
    expect(scaled.filter((entry) => entry.canonicalLinked)).toHaveLength(27);
    expect(scaled.filter((entry) => entry.reviewStatus === "ocr_correlated")).toHaveLength(25);
    expect(scaled.filter((entry) => entry.conflictCandidate)).toHaveLength(2);
    expect(scaled.filter((entry) => entry.reviewStatus === "no_ocr_candidate")).toHaveLength(15);
    expect(scaled.filter((entry) => entry.hasMatchReport)).toHaveLength(24);
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
});
