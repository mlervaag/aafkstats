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

    expect(status.contract).toBe("newspaper-enrichment-status@2");
    expect(status.searchPolicy).toEqual({
      initialWindowDays: 2,
      expandedWindowDays: 3,
      resultIsRequired: false,
      visualReviewRequired: true,
      pilot1979: {
        visualReviewRequired: false,
        reviewBasis: "nb_ocr_api_user_waiver",
      },
    });
    expect(entries).toHaveLength(39);
    expect(status.pilot1979.canonicalMatchesInScope).toBe(39);
    expect(status.pilot1979.withSmpSource).toBe(31);
    expect(status.pilot1979.ocrCorrelated).toBe(30);
    expect(status.pilot1979.noOcrCandidate).toBe(8);
    expect(status.pilot1979.residualQueue).toBe(8);
    expect(entries.find((entry) => entry.matchId === "1979-04-29-aalesunds-fk-hodd")).toMatchObject({
      date: "1979-04-29",
      opponent: "Hødd",
      competition: "andredivisjon",
      homeAway: "home",
      score: "0-1",
      existingSmpSource: true,
      reviewStatus: "ocr_correlated",
    });
  });

  it("den versjonerte køen inneholder ikke avis-OCR", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    expect(raw).not.toMatch(/fullText|rawOcr|quote:/u);
  });
});
