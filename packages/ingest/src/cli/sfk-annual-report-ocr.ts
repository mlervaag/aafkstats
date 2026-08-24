import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import {
  annualReportOcrManifestPath,
  ocrAnnualReportPdf,
  ocrCoverageReport,
  ocrManifest,
  type AnnualReportOcrResult,
} from "../adapters/sfk-annual-report-ocr.js";
import { INDEX_URL, parseAnnualReportIndex, validateAnnualReportSeries } from "../adapters/sfk-annual-reports.js";
import { fetchBytes, fetchText } from "../http.js";
import { assertMayFetch } from "../policy.js";

interface Args { from: number; to: number | "latest"; refresh: boolean; report?: string; manifest?: string }

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
  const latestYear = Math.max(...discovered.map((report) => report.year));
  const to = args.to === "latest" ? latestYear : args.to;
  if (to > latestYear) throw new Error(`OCR-spennet går til ${to}, men siste oppdagede årsrapport er ${latestYear}`);
  const reports = discovered.filter((report) => report.year >= args.from && report.year <= to);
  if (reports.length === 0) throw new Error("ingen oppdagede årsrapporter er innenfor OCR-utvalget");

  const ocrCache = resolve(root, ".cache/ingest/sfk-annual-reports/ocr");
  const languageCache = resolve(root, ".cache/ingest/sfk-annual-reports/tesseract");
  await mkdir(languageCache, { recursive: true });
  let worker: Worker | undefined;
  const getWorker = async (): Promise<Worker> => {
    if (worker) return worker;
    console.log("Laster norsk OCR-modell …");
    worker = await createWorker("nor", OEM.LSTM_ONLY, { cachePath: languageCache });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      user_defined_dpi: "144",
    });
    return worker;
  };

  const results: AnnualReportOcrResult[] = [];
  try {
    for (const report of reports) {
      console.log(`\n${report.year}`);
      const bytes = await fetchBytes(report.url, { refresh: args.refresh, onNetworkRequest });
      const result = await ocrAnnualReportPdf(report, bytes, {
        cacheDir: ocrCache,
        refresh: args.refresh,
        getWorker,
        onProgress: (message) => console.log(`  ${message}`),
      });
      results.push(result);
      console.log(
        `${report.year}: ${result.pagesProcessed}/${result.pages} sider, ` +
        `${result.candidates.length} kandidatsider, ${result.meanConfidence.toFixed(1)} %`,
      );
    }
  } finally {
    await worker?.terminate();
  }

  const manifestPath = resolve(root, args.manifest ?? annualReportOcrManifestPath(args.from, to));
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, ocrManifest(results), "utf8");
  if (args.report) {
    const reportPath = resolve(root, args.report);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, ocrCoverageReport(results), "utf8");
    console.log(`Rapport: ${reportPath}`);
  }
  const failed = results.reduce((total, result) => total + result.pagesFailed.length, 0);
  const pages = results.reduce((total, result) => total + result.pagesProcessed, 0);
  const cacheHits = results.reduce((total, result) => total + result.cacheHits, 0);
  console.log(`${results.length} rapporter · ${pages} sider · ${cacheHits} OCR-cachetreff · ${networkRequests} nettverkskall`);
  if (failed > 0) process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  let from = 1952;
  let to: number | "latest" = 1979;
  let refresh = false;
  let report: string | undefined;
  let manifest: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (arg === "--refresh") refresh = true;
    else if (arg === "--year" || arg === "--from" || arg === "--to") {
      const raw = argv[++index];
      if (!raw) throw new Error(`${arg} krever et årstall`);
      if (arg === "--to" && raw === "latest") {
        to = "latest";
        continue;
      }
      const year = Number(raw);
      if (!Number.isInteger(year)) throw new Error(`${arg} krever et årstall eller latest`);
      if (arg === "--year") from = to = year;
      else if (arg === "--from") from = year;
      else to = year;
    } else if (arg === "--report") {
      report = argv[++index];
      if (!report || report.startsWith("--")) throw new Error("--report krever en sti");
    } else if (arg === "--manifest") {
      const rawManifest = argv[++index];
      if (!rawManifest || rawManifest.startsWith("--")) throw new Error("--manifest krever en sti");
      manifest = rawManifest;
    } else throw new Error(`ukjent argument: ${arg}`);
  }
  if (from < 1952 || (typeof to === "number" && (to < 1952 || from > to))) {
    throw new Error("OCR-spennet i denne kommandoen må starte i 1952 eller senere");
  }
  return { from, to, refresh, report, manifest };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
