import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import {
  INDEX_URL,
  annualReportManifest,
  annualReportSourceId,
  generateAnnualReportSource,
  parseAnnualReportIndex,
  planAnnualReportSources,
  validateAnnualReportSeries,
} from "../adapters/sfk-annual-reports.js";
import { fetchText } from "../http.js";
import { assertMayFetch, assertMayPublish } from "../policy.js";

interface Args { refresh: boolean; write: boolean; manifest: string }

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const dataRoot = resolve(root, "data");
  const archive = await loadArchive(dataRoot);
  const issues = [...archive.issues, ...crossValidate(archive)];
  if (issues.length > 0) throw new Error(`arkivet har ${issues.length} valideringsfeil`);

  assertMayFetch(archive, "sunnmore-fotballkrets");
  const html = await fetchText(INDEX_URL, { refresh: args.refresh });
  const reports = parseAnnualReportIndex(html);
  validateAnnualReportSeries(reports);
  const plan = planAnnualReportSources(reports, archive.sources);

  const manifestPath = resolve(root, args.manifest);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, annualReportManifest(reports), "utf8");

  console.log("SFK årsrapporter");
  console.log(`${reports.length} rapporter oppdaget`);
  console.log(`${reports[0]!.year} til ${reports.at(-1)!.year}`);
  console.log(`${plan.missing.length} manglende source-filer`);
  console.log(`${plan.existing.length} eksisterende sources`);
  console.log(`${plan.conflicts.length} konflikter`);
  for (const conflict of plan.conflicts) {
    console.error(`KONFLIKT ${conflict.id}: ${conflict.differences.join("; ")}`);
  }
  console.log(`Manifest: ${manifestPath}`);

  if (plan.conflicts.length > 0) {
    throw new Error("eksisterende sources avviker fra indeksen og krever manuell kontroll");
  }
  if (!args.write) {
    console.log("Ingen data skrevet.");
    return;
  }

  assertMayPublish(archive, "sunnmore-fotballkrets");
  for (const report of plan.missing) {
    const path = resolve(dataRoot, "sources", `${annualReportSourceId(report.year)}.yaml`);
    await writeFile(path, generateAnnualReportSource(report), { encoding: "utf8", flag: "wx" });
  }
  console.log(`${plan.missing.length} source-filer skrevet.`);
}

function parseArgs(argv: string[]): Args {
  let refresh = false;
  let write = false;
  let manifest = ".cache/ingest/sfk-annual-reports/manifest.json";
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (arg === "--refresh") refresh = true;
    else if (arg === "--write") write = true;
    else if (arg === "--manifest") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error("--manifest krever en sti");
      manifest = value;
    } else throw new Error(`ukjent argument: ${arg}`);
  }
  return { refresh, write, manifest };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
