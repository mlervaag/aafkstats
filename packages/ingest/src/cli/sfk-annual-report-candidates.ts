import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { readAnnualReportPdfText, type AnnualReportTechnicalAnalysis } from "../adapters/sfk-annual-report-analysis.js";
import {
  candidateCoverageReport,
  candidateManifest,
  extractAnnualReportPageCandidates,
  type AnnualReportPageCandidate,
} from "../adapters/sfk-annual-report-candidates.js";
import { INDEX_URL, parseAnnualReportIndex, validateAnnualReportSeries } from "../adapters/sfk-annual-reports.js";
import { fetchBytes, fetchText } from "../http.js";
import { assertMayFetch } from "../policy.js";

interface Args { from?: number; to?: number; year?: number; refresh: boolean; report?: string }

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const archive = await loadArchive(resolve(root, "data"));
  const issues = [...archive.issues, ...crossValidate(archive)];
  if (issues.length > 0) throw new Error(`arkivet har ${issues.length} valideringsfeil`);
  assertMayFetch(archive, "sunnmore-fotballkrets");

  let networkRequests = 0;
  const onNetworkRequest = () => networkRequests++;
  const html = await fetchText(INDEX_URL, { refresh: args.refresh, onNetworkRequest });
  const discovered = parseAnnualReportIndex(html);
  validateAnnualReportSeries(discovered);
  const reports = discovered.filter((report) =>
    args.year !== undefined
      ? report.year === args.year
      : (args.from === undefined || report.year >= args.from) && (args.to === undefined || report.year <= args.to),
  );
  if (reports.length === 0) throw new Error("ingen oppdagede årsrapporter er innenfor utvalget");

  const analyses: AnnualReportTechnicalAnalysis[] = [];
  const candidates: AnnualReportPageCandidate[] = [];
  let failed = 0;
  for (const report of reports) {
    try {
      const bytes = await fetchBytes(report.url, { refresh: args.refresh, onNetworkRequest });
      const result = await readAnnualReportPdfText(report, bytes);
      if (result.analysis.textLayer === "failed") {
        failed++;
        console.error(`${report.year}: feilet – ${result.analysis.error}`);
        continue;
      }
      if (result.analysis.textLayer !== "usable" && result.analysis.textLayer !== "sparse") continue;
      analyses.push(result.analysis);
      const found = extractAnnualReportPageCandidates(result.analysis, result.pageTexts);
      candidates.push(...found);
      console.log(`${report.year}: ${result.analysis.mentionPages.length} AaFK-sider, ${found.length} kandidatsider`);
    } catch (error) {
      failed++;
      console.error(`${report.year}: feilet – ${shortError(error)}`);
    }
  }

  const manifestPath = resolve(root, ".cache/ingest/sfk-annual-reports/candidate-manifest.json");
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, candidateManifest(candidates), "utf8");
  if (args.report) {
    const reportPath = resolve(root, args.report);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, candidateCoverageReport(analyses, candidates), "utf8");
    console.log(`Rapport: ${reportPath}`);
  }
  console.log(`${analyses.length} tekstbaserte rapporter · ${candidates.length} kandidatsider · ${networkRequests} nettverkskall`);
  if (failed > 0) process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { refresh: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (arg === "--refresh") args.refresh = true;
    else if (arg === "--from" || arg === "--to" || arg === "--year") {
      const raw = argv[++index];
      const year = Number(raw);
      if (!raw || !Number.isInteger(year) || year < 1900 || year > 2100) throw new Error(`${arg} krever et gyldig årstall`);
      if (arg === "--from") args.from = year;
      else if (arg === "--to") args.to = year;
      else args.year = year;
    } else if (arg === "--report") {
      const path = argv[++index];
      if (!path || path.startsWith("--")) throw new Error("--report krever en sti");
      args.report = path;
    } else throw new Error(`ukjent argument: ${arg}`);
  }
  if (args.year !== undefined && (args.from !== undefined || args.to !== undefined)) {
    throw new Error("--year kan ikke kombineres med --from/--to");
  }
  if (args.from !== undefined && args.to !== undefined && args.from > args.to) throw new Error("--from kan ikke være større enn --to");
  return args;
}

function shortError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, " ").trim().slice(0, 300);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
