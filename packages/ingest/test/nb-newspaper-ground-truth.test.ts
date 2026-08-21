import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { evidenceForFragment } from "../src/newspaper/evidence.js";
import { reconcile } from "../src/newspaper/reconciliation.js";
import { sourceResultPopulation } from "../src/newspaper/source-result-query.js";
import type { DiscoveryStatus, ReconciliationChecks } from "../src/newspaper/reconciliation.js";
import type { NewspaperQuery } from "../src/newspaper/evidence.js";
import type { HomeAwayHint } from "../src/newspaper/note-parser.js";

interface GroundTruthCase {
  year: number;
  no: number;
  opponent: string;
  expectedScore: [number, number];
  homeAwayHint?: HomeAwayHint;
  fragments: Array<{ issueId: string; issueDate: string; text: string }>;
  allowedStatuses: DiscoveryStatus[];
  expectedDate?: string;
  forbiddenDate?: string;
  expectedScoreCheck?: ReconciliationChecks["score"];
}

interface GroundTruthManifest {
  version: number;
  sourceId: string;
  cases: GroundTruthCase[];
}

const manifestPath = resolve(repoRoot(), "packages/ingest/test/fixtures/nb-newspaper-ground-truth.yaml");
const manifest: GroundTruthManifest = parse(readFileSync(manifestPath, "utf8"));
const AAFK_ALIASES = ["AaFK", "AAFK", "ÅFK", "Aalesund", "Aalesunds"];

describe("NB-avisdiscovery mot faksimile-ground-truth fra PR #186", () => {
  it("identifiserer alle seks source-results stabilt også når de er koblet til kamp", async () => {
    const archive = await loadArchive(dataDir());
    expect(archive.issues).toHaveLength(0);

    for (const testCase of manifest.cases) {
      const population = sourceResultPopulation(archive, {
        sourceId: manifest.sourceId,
        season: testCase.year,
        no: testCase.no,
      });
      expect(population.hypotheses, `${testCase.year} #${testCase.no}`).toHaveLength(1);
    }
  }, 30000);

  for (const testCase of manifest.cases) {
    it(`${testCase.year} #${testCase.no} ${testCase.opponent}`, () => {
      const query: NewspaperQuery = {
        year: testCase.year,
        opponent: testCase.opponent,
        opponentAliases: [],
        aafkAliases: AAFK_ALIASES,
        expectedScore: testCase.expectedScore,
        ...(testCase.homeAwayHint ? { homeAwayHint: testCase.homeAwayHint } : {}),
      };
      const evidence = testCase.fragments.map((fragment) => evidenceForFragment(fragment.text, query, fragment));
      const result = reconcile(query, evidence);

      expect(testCase.allowedStatuses, `${testCase.year} #${testCase.no} status`).toContain(result.status);
      if (testCase.expectedDate) expect(result.matchDate?.value).toBe(testCase.expectedDate);
      if (testCase.forbiddenDate) expect(result.matchDate?.value).not.toBe(testCase.forbiddenDate);
      if (testCase.expectedScoreCheck) expect(result.checks.score).toBe(testCase.expectedScoreCheck);
    });
  }
});
