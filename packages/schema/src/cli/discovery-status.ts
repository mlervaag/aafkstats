import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { repoRoot } from "../load.js";
import { buildDiscoveryClosureStatus } from "../historical/discovery-closure.js";

const root = repoRoot();
const report = await buildDiscoveryClosureStatus(root);
const outputPath = join(root, "data", "discovery", "discovery-closure-status.yaml");
await writeFile(outputPath, stringifyYaml(report, { lineWidth: 0 }), "utf8");

console.log("DISCOVERY_CLOSURE_QUEUE_ESTABLISHED");
console.log(`Univers: ${report.totals.totalCurrentDiscoveryUniverse}`);
console.log(`Visuell review: ${report.totals.pendingVisualReview}`);
console.log(`Revalidering: ${report.totals.requiresRevalidation}`);
console.log(`Kanonisering: ${report.totals.pendingCanonicalization}`);
console.log(`Integritetsfeil: ${report.integrity.orphanDiscoveryReferences.length + report.integrity.ambiguousInternalState.length}`);
console.log(`Skrev ${outputPath}`);
