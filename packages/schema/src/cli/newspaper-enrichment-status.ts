import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { repoRoot } from "../load.js";
import { buildNewspaperEnrichmentStatus } from "../historical/newspaper-enrichment-status.js";

const root = repoRoot();
const report = await buildNewspaperEnrichmentStatus(root);
const outputPath = join(root, "data", "discovery", "newspaper-enrichment-status.yaml");
await writeFile(outputPath, stringifyYaml(report, { lineWidth: 0 }), "utf8");

console.log("NEWSPAPER_ENRICHMENT_QUEUE_ESTABLISHED");
console.log(`Kamper i scope: ${report.totals.canonicalMatchesInScope}`);
console.log(`Med samtidig Smp-omtale: ${report.totals.withSmpMention}`);
console.log(`Komplett avisberikelse: ${report.totals.enrichmentComplete}`);
console.log(`I kø: ${report.queue.length}`);
console.log(`1979 i scope: ${report.pilot1979.canonicalMatchesInScope}`);
console.log(`Skrev ${outputPath}`);
