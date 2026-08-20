import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { sourceIdFromPath, sourceResultPopulation } from "../src/newspaper/source-result-query.js";
import { batchPolicyFor } from "../src/newspaper/batch-policy.js";
import { evidenceForFragment } from "../src/newspaper/evidence.js";
import { reconcile } from "../src/newspaper/reconciliation.js";
import type { NewspaperQuery } from "../src/newspaper/evidence.js";

interface AcceptanceCase {
  sourceResultFile: string;
  year: number;
  no: number;
  expectedPolicy: "automatic" | "manual";
  expectedStatus?: "confirmed" | "probable" | "ambiguous" | "conflict" | "not_found";
  expectedDate?: string;
  expectedReviewReason?: string;
}

interface AcceptanceManifest {
  version: number;
  cases: AcceptanceCase[];
}

const manifestPath = resolve(repoRoot(), "packages/ingest/test/fixtures/nb-newspaper-acceptance.yaml");
const manifest: AcceptanceManifest = parse(readFileSync(manifestPath, "utf8"));

describe("nb-newspaper-acceptance (deterministisk)", () => {
  it("validerer struktur, kildeutvalg og policy for alle saker i manifestet", async () => {
    const archive = await loadArchive(dataDir());
    expect(archive.issues).toHaveLength(0);

    for (const testCase of manifest.cases) {
      const sourceId = sourceIdFromPath(testCase.sourceResultFile);
      const population = sourceResultPopulation(archive, {
        sourceId,
        season: testCase.year,
        no: testCase.no,
      });

      const planned = population.hypotheses[0];
      expect(planned, `Fant ikke kilderesultat for ${sourceId} ${testCase.year} #${testCase.no}`).toBeDefined();

      const policyDecision = batchPolicyFor(planned!.hypothesis, planned!.siblingGroupSize);
      expect(policyDecision.policy, `${testCase.year} #${testCase.no} policy`).toBe(testCase.expectedPolicy);

      if (testCase.expectedPolicy === "manual" && testCase.expectedReviewReason) {
        expect(policyDecision.reviewReason, `${testCase.year} #${testCase.no} reviewReason`).toBe(
          testCase.expectedReviewReason,
        );
      }
    }
  }, 30000);

  it("bekrefter Clausenengen 1952 #16 deterministisk mot representativt kildebevis", () => {
    const query: NewspaperQuery = {
      year: 1952,
      opponent: "Clausenengen",
      opponentAliases: ["CFK"],
      aafkAliases: ["Aalesunds FK", "AaFK", "ÅFK"],
      expectedScore: [1, 0],
      homeAwayHint: "away",
      competitionHint: "1. divisjon",
    };

    const evidence = evidenceForFragment(
      "Det var tilløp til bra takter for AaFK i landsdelsseriekampen mot Clausenengen i Kristiansund i går. Seiren ble riktignok så knepen som 1—0, men likevel var AaFK det klart beste laget.",
      query,
      { issueId: "cfk-mai-1952", issueDate: "19520505", page: "3" },
    );

    const result = reconcile(query, [evidence]);

    expect(result.status).toBe("confirmed");
    expect(result.matchDate?.value).toBe("1952-05-04");
    expect(result.matchDate?.confidence).toBe("high");
    expect(result.checks.score).toBe("confirmed");
    expect(result.checks.homeAway).toBe("unknown");
    expect(result.checks.opponent).toBe("confirmed");
  });
});
