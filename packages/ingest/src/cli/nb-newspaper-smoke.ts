#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { sourceIdFromPath, sourceResultPopulation } from "../newspaper/source-result-query.js";
import { batchPolicyFor } from "../newspaper/batch-policy.js";
import { discoverForSourceResult } from "../newspaper/discovery.js";

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

async function runSmoke(): Promise<void> {
  const manifestPath = resolve(repoRoot(), "packages/ingest/test/fixtures/nb-newspaper-acceptance.yaml");
  const manifest: AcceptanceManifest = parse(readFileSync(manifestPath, "utf8"));

  console.log(`Kjører live smoke for NB-avisdiscovery akseptansemanifest (v${manifest.version})...\n`);

  const archive = await loadArchive(dataDir());
  const failures: string[] = [];

  for (const testCase of manifest.cases) {
    const sourceId = sourceIdFromPath(testCase.sourceResultFile);
    const population = sourceResultPopulation(archive, {
      sourceId,
      season: testCase.year,
      no: testCase.no,
    });

    const planned = population.hypotheses[0];
    if (!planned) {
      const err = `[FAIL] Fant ikke kilderesultat for ${sourceId} ${testCase.year} #${testCase.no}`;
      console.error(err);
      failures.push(err);
      continue;
    }

    const policyDecision = batchPolicyFor(planned.hypothesis, planned.siblingGroupSize);
    if (policyDecision.policy !== testCase.expectedPolicy) {
      const err = `[FAIL] ${testCase.year} #${testCase.no}: forventet policy '${testCase.expectedPolicy}', fikk '${policyDecision.policy}'`;
      console.error(err);
      failures.push(err);
      continue;
    }

    if (policyDecision.policy === "manual") {
      if (policyDecision.reviewReason !== testCase.expectedReviewReason) {
        const err = `[FAIL] ${testCase.year} #${testCase.no}: forventet reviewReason '${testCase.expectedReviewReason}', fikk '${policyDecision.reviewReason}'`;
        console.error(err);
        failures.push(err);
      } else {
        console.log(`[PASS] ${testCase.year} #${testCase.no} (${planned.hypothesis.queries[0]?.printedOpponent}) → manual (${policyDecision.reviewReason})`);
      }
      continue;
    }

    // Automatisk sak: kjør discovery mot live NB / disk-cache
    const query = planned.hypothesis.queries[0]!;
    const result = await discoverForSourceResult(query);

    let caseFailed = false;
    if (testCase.expectedStatus !== undefined && result.status !== testCase.expectedStatus) {
      const err = `[FAIL] ${testCase.year} #${testCase.no} (${query.printedOpponent}): forventet status '${testCase.expectedStatus}', fikk '${result.status}' (score=${result.checks.score}, date=${result.checks.date}, homeAway=${result.checks.homeAway})`;
      console.error(err);
      failures.push(err);
      caseFailed = true;
    }

    if (testCase.expectedDate !== undefined && result.matchDate?.value !== testCase.expectedDate) {
      const err = `[FAIL] ${testCase.year} #${testCase.no} (${query.printedOpponent}): forventet dato '${testCase.expectedDate}', fikk '${result.matchDate?.value ?? "ingen"}'`;
      console.error(err);
      failures.push(err);
      caseFailed = true;
    }

    if (!caseFailed) {
      console.log(
        `[PASS] ${testCase.year} #${testCase.no} (${query.printedOpponent}) → ${result.status} · ${result.matchDate?.value ?? "ingen dato"} (${result.matchDate?.confidence ?? "ingen"})`,
      );
    }
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`Smoke test feilet med ${failures.length} avvik.`);
    process.exit(1);
  } else {
    console.log(`Alle ${manifest.cases.length} akseptansekontroller passerte.`);
    process.exit(0);
  }
}

runSmoke().catch((err) => {
  console.error("Uventet feil under live smoke:", err);
  process.exit(1);
});
