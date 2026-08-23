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
});
