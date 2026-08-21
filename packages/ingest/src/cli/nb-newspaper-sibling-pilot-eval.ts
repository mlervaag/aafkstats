#!/usr/bin/env node
import { resolve } from "node:path";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { evaluateSiblingPilot } from "../newspaper/sibling-evaluator.js";

async function main(): Promise<void> {
  const manifestPath = resolve(repoRoot(), "packages/ingest/test/fixtures/nb-newspaper-sibling-pilot.yaml");
  console.log("Leser arkiv og kjører evaluering av sibling-piloten (10 grupper, 26 hypoteser)...\n");

  const archive = await loadArchive(dataDir());
  const report = await evaluateSiblingPilot(archive, manifestPath);

  console.log("=== EVALUERINGSRAPPORT FOR SIBLING-PILOT ===\n");
  console.log(`Totalt antall grupper: ${report.totalGroups}`);
  console.log(`Totalt antall hypoteser: ${report.totalHypotheses}`);
  console.log(`Eksakt korrekte allokeringer: ${report.exactCorrectAllocations}`);
  console.log(`Korrekt avviste (unresolved/symmetric): ${report.correctlyRejectedAllocations}`);
  console.log(`Feilaktige allokeringer: ${report.incorrectAllocations}`);
  console.log(`Falske high-confidence allokeringer: ${report.falseHighConfidenceAllocations}`);
  console.log(`Uverifiserte allokeringer: ${report.unverifiedAllocations}`);
  console.log(`\nGruppe-status: ${report.fullyCorrectGroups} fullt korrekte, ${report.partiallyCorrectGroups} delvis korrekte, ${report.failedGroups} feilet, ${report.unverifiedGroups} uverifiserte\n`);

  console.log("--- Detaljert hypoteseoversikt ---");
  for (const group of report.groups) {
    console.log(`\nGruppe ${group.groupKey} (${group.classification}):`);
    for (const h of group.hypotheses) {
      const candidateInfo = h.candidateDate ? `kandidat: ${h.candidateDate}` : "ingen kandidat";
      const allocInfo = h.allocatedDate ? `akseptert: ${h.allocatedDate}` : "uallokert";
      const check = h.classification === "exact_correct" || h.classification === "correctly_rejected" ? "✓" : "✗";
      console.log(`  ${check} #${h.no} (forventet: ${h.expectedAllocation}${h.expectedDate ? ` ${h.expectedDate}` : ""}) -> ${allocInfo} (${candidateInfo}, ${h.decision}, ${h.confidence}, margin ${h.margin}, status: ${h.status}) [${h.classification}]`);
    }
  }

  if (report.falseHighConfidenceAllocations > 0) {
    console.error(`\n[FEIL] Fant ${report.falseHighConfidenceAllocations} falske high-confidence allokeringer!`);
    process.exit(1);
  }

  console.log("\nFullført uten falske high-confidence allokeringer.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
