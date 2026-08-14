import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import {
  analyzeAnnualReportPdf,
  failedAnnualReportAnalysis,
  technicalCoverageReport,
  technicalManifest,
  type AnnualReportTechnicalAnalysis,
} from "../adapters/sfk-annual-report-analysis.js";
import {
  INDEX_URL,
  parseAnnualReportIndex,
  validateAnnualReportSeries,
} from "../adapters/sfk-annual-reports.js";
import { fetchBytes, fetchText } from "../http.js";
import { assertMayFetch } from "../policy.js";

interface Args {
  from?: number;
  to?: number;
  year?: number;
  refresh: boolean;
  report?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const archive = await loadArchive(resolve(root, "data"));
  const issues = [...archive.issues, ...crossValidate(archive)];
  if (issues.length > 0) throw new Error(`arkivet har ${issues.length} valideringsfeil`);
  assertMayFetch(archive, "sunnmore-fotballkrets");

  let networkRequests = 0;
  const onNetworkRequest = () => networkRequests++;
  const index = await fetchText(INDEX_URL, { refresh: args.refresh, onNetworkRequest });
  const discovered = parseAnnualReportIndex(index);
  validateAnnualReportSeries(discovered);
  const reports = discovered.filter((report) =>
    args.year !== undefined
      ? report.year === args.year
      : (args.from === undefined || report.year >= args.from) &&
        (args.to === undefined || report.year <= args.to),
  );
  if (reports.length === 0) throw new Error("ingen oppdagede årsrapporter er innenfor utvalget");

  console.log(`SFK PDF-kartlegging: ${reports.length} rapporter, sekvensiell analyse`);
  const analyses: AnnualReportTechnicalAnalysis[] = [];
  for (const report of reports) {
    let analysis: AnnualReportTechnicalAnalysis;
    try {
      const bytes = await fetchBytes(report.url, { refresh: args.refresh, onNetworkRequest });
      analysis = await analyzeAnnualReportPdf(report, bytes);
    } catch (error) {
      analysis = failedAnnualReportAnalysis(report, shortError(error));
    }
    analyses.push(analysis);
    const mentionSummary = analysis.mentionPages.length > 0
      ? `, ${analysis.mentionPages.length} AaFK-sider`
      : "";
    console.log(
      `${analysis.year}: ${analysis.pages} sider, ${analysis.textLayer}, OCR ${analysis.ocrStatus}${mentionSummary}`,
    );
    if (analysis.error) console.error(`  FEIL: ${analysis.error}`);
  }

  const manifestPath = resolve(root, ".cache/ingest/sfk-annual-reports/technical-manifest.json");
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, technicalManifest(analyses), "utf8");
  console.log(`Manifest: ${manifestPath}`);

  if (args.report) {
    const reportPath = resolve(root, args.report);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, technicalCoverageReport(analyses), "utf8");
    console.log(`Dekningsrapport: ${reportPath}`);
  }

  console.log(`Nettverkskall: ${networkRequests}`);
  const failed = analyses.filter((analysis) => analysis.textLayer === "failed");
  if (failed.length > 0) {
    console.error(`${failed.length} rapporter feilet; se manifestet og dekningsrapporten.`);
    process.exitCode = 1;
  }
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
      if (!raw || !Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error(`${arg} krever et gyldig årstall`);
      }
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
  if (args.from !== undefined && args.to !== undefined && args.from > args.to) {
    throw new Error("--from kan ikke være større enn --to");
  }
  return args;
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/gu, " ").trim().slice(0, 300);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
