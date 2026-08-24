import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Worker } from "tesseract.js";
import {
  analyzePageTexts,
  formatSignalNames,
  type AnnualReportSignalName,
} from "./sfk-annual-report-analysis.js";
import {
  extractAnnualReportPageCandidates,
  type AnnualReportPageCandidate,
} from "./sfk-annual-report-candidates.js";
import { annualReportSourceId, type AnnualReportLink } from "./sfk-annual-reports.js";

const require = createRequire(import.meta.url);
const pdfJsWasmUrl = `${resolve(dirname(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")), "../../wasm")}/`;

export interface CachedOcrPage {
  page: number;
  text: string;
  confidence: number;
}

export interface AnnualReportOcrResult {
  year: number;
  sourceId: string;
  pages: number;
  pagesProcessed: number;
  pagesFailed: number[];
  textChars: number;
  meanConfidence: number;
  cacheHits: number;
  candidates: AnnualReportPageCandidate[];
}

export interface OcrReportOptions {
  cacheDir: string;
  refresh?: boolean;
  scale?: number;
  getWorker: () => Promise<Worker>;
  onProgress?: (message: string) => void;
}

/** Stable, span-specific cache artifact name for OCR runs. */
export function annualReportOcrManifestPath(from: number, to: number): string {
  return `.cache/ingest/sfk-annual-reports/ocr-manifest-${from}-${to}.json`;
}

export function annualReportOcrSpan(results: AnnualReportOcrResult[]): string {
  if (results.length === 0) return "årsrapporter";
  const years = results.map((result) => result.year).sort((a, b) => a - b);
  return years[0] === years[years.length - 1] ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`;
}

export async function ocrAnnualReportPdf(
  report: AnnualReportLink,
  bytes: Uint8Array,
  options: OcrReportOptions,
): Promise<AnnualReportOcrResult> {
  const loadingTask = getDocument({ data: bytes.slice(), verbosity: 0, wasmUrl: pdfJsWasmUrl });
  const pageResults: CachedOcrPage[] = [];
  const pagesFailed: number[] = [];
  let cacheHits = 0;
  try {
    const document = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const cacheFile = join(options.cacheDir, String(report.year), `${String(pageNumber).padStart(3, "0")}.json`);
      try {
        if (!options.refresh && existsSync(cacheFile)) {
          pageResults.push(JSON.parse(await readFile(cacheFile, "utf8")) as CachedOcrPage);
          cacheHits++;
          options.onProgress?.(`${report.year} side ${pageNumber}/${document.numPages}: cache`);
          continue;
        }
        const page = await document.getPage(pageNumber);
        let png: Buffer;
        try {
          png = await renderPageToPng(page, options.scale ?? 2);
        } finally {
          page.cleanup();
        }
        const worker = await options.getWorker();
        const recognized = await worker.recognize(png);
        const result: CachedOcrPage = {
          page: pageNumber,
          text: normalizeText(recognized.data.text),
          confidence: round(recognized.data.confidence),
        };
        await writeCache(cacheFile, result);
        pageResults.push(result);
        options.onProgress?.(`${report.year} side ${pageNumber}/${document.numPages}: ${result.confidence.toFixed(1)} %`);
      } catch (error) {
        pagesFailed.push(pageNumber);
        options.onProgress?.(`${report.year} side ${pageNumber}/${document.numPages}: FEIL ${shortError(error)}`);
      }
    }

    const texts = Array.from({ length: document.numPages }, () => "");
    for (const page of pageResults) texts[page.page - 1] = page.text;
    const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    const analysis = analyzePageTexts(report, bytes.length, sha256, texts);
    const candidates = extractAnnualReportPageCandidates(analysis, texts);
    return {
      year: report.year,
      sourceId: annualReportSourceId(report.year),
      pages: document.numPages,
      pagesProcessed: pageResults.length,
      pagesFailed,
      textChars: pageResults.reduce((total, page) => total + page.text.length, 0),
      meanConfidence: round(
        pageResults.length > 0
          ? pageResults.reduce((total, page) => total + page.confidence, 0) / pageResults.length
          : 0,
      ),
      cacheHits,
      candidates,
    };
  } finally {
    await loadingTask.destroy();
  }
}

export function ocrManifest(results: AnnualReportOcrResult[]): string {
  return `${JSON.stringify({
    reports: sortResults(results).map(({ cacheHits: _cacheHits, candidates, ...result }) => ({
      ...result,
      candidatePages: candidates.length,
      topics: topicsFor(candidates),
    })),
    candidates: sortResults(results).flatMap((result) => result.candidates),
  }, null, 2)}\n`;
}

export function ocrCoverageReport(results: AnnualReportOcrResult[]): string {
  const sorted = sortResults(results);
  const candidates = sorted.flatMap((result) => result.candidates);
  const pages = sorted.reduce((total, result) => total + result.pages, 0);
  const processed = sorted.reduce((total, result) => total + result.pagesProcessed, 0);
  const failed = sorted.reduce((total, result) => total + result.pagesFailed.length, 0);
  return [
    `# SFK årsrapporter, OCR ${annualReportOcrSpan(sorted)}`,
    "",
    "OCR-resultatene er arbeidsdata. Rapporten viser bare dekning, målekvalitet og",
    "sidebaserte temasignaler; OCR-prosa og bilder ligger i ignorert cache.",
    "",
    "## Sammendrag",
    "",
    `- Rapporter: ${sorted.length}`,
    `- Sider: ${pages}`,
    `- OCR-behandlet: ${processed}`,
    `- Feilsider: ${failed}`,
    `- Kandidatsider: ${candidates.length}`,
    `- Gjennomsnittlig OCR-confidence: ${meanConfidence(sorted).toFixed(1)} %`,
    "",
    "## Rapporter",
    "",
    "| År | Sider | Behandlet | Feil | Tegn | Confidence | Kandidatsider | Signaler |",
    "|---:|---:|---:|---:|---:|---:|---:|---|",
    ...sorted.map((result) =>
      `| ${result.year} | ${result.pages} | ${result.pagesProcessed} | ${result.pagesFailed.join(", ") || "0"} | ` +
      `${result.textChars} | ${result.meanConfidence.toFixed(1)} % | ${result.candidates.length} | ` +
      `${formatSignalNames(topicsFor(result.candidates))} |`,
    ),
    "",
    "## Kandidatsider",
    "",
    "| År | Side | Sterke | Svake | Signaler | Nøkkelord |",
    "|---:|---:|---:|---:|---|---|",
    ...candidates.map((candidate) =>
      `| ${candidate.year} | ${candidate.page} | ${candidate.strongMentions} | ${candidate.weakMentions} | ` +
      `${formatSignalNames(candidate.topics)} | ${candidate.keywords.join(", ")} |`,
    ),
    "",
    "Alle kandidater må kontrolleres visuelt mot den oppgitte PDF-siden før noe kan",
    "flyttes til kanoniske kamp-, sesong-, person- eller organisasjonsdata.",
    "",
  ].join("\n");
}

async function renderPageToPng(page: PDFPageProxy, scale: number): Promise<Buffer> {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  await page.render({ canvas, canvasContext: context as never, viewport }).promise;
  return canvas.toBuffer("image/png");
}

async function writeCache(path: string, value: CachedOcrPage): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, path);
}

function topicsFor(candidates: AnnualReportPageCandidate[]): AnnualReportSignalName[] {
  const order: AnnualReportSignalName[] = ["seniorTable", "cupResults", "reserve", "junior", "youth", "people", "officials"];
  return order.filter((name) => candidates.some((candidate) => candidate.topics.includes(name)));
}

function sortResults(results: AnnualReportOcrResult[]): AnnualReportOcrResult[] {
  return [...results].sort((a, b) => a.year - b.year);
}

function meanConfidence(results: AnnualReportOcrResult[]): number {
  const processed = results.reduce((total, result) => total + result.pagesProcessed, 0);
  return processed > 0
    ? results.reduce((total, result) => total + result.meanConfidence * result.pagesProcessed, 0) / processed
    : 0;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function shortError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, " ").trim().slice(0, 200);
}
