import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { annualReportSourceId, type AnnualReportLink } from "./sfk-annual-reports.js";

export type TextLayerStatus = "usable" | "sparse" | "none" | "failed";
export type OcrStatus = "not_needed" | "pending";

export interface AnnualReportSignals {
  seniorTable: boolean;
  cupResults: boolean;
  reserve: boolean;
  junior: boolean;
  youth: boolean;
  people: boolean;
  officials: boolean;
}

export type AnnualReportSignalName = keyof AnnualReportSignals;

export interface AnnualReportPdfText {
  analysis: AnnualReportTechnicalAnalysis;
  /** Lever bare i minnet eller ignorert arbeidsdata; committede rapporter lagrer aldri teksten. */
  pageTexts: string[];
}

export interface AnnualReportTechnicalAnalysis {
  year: number;
  sourceId: string;
  url: string;
  sha256: string;
  bytes: number;
  pages: number;
  textLayer: TextLayerStatus;
  textChars: number;
  textPages: number;
  strongMentions: number;
  weakMentions: number;
  mentionPages: number[];
  signals: AnnualReportSignals;
  ocrStatus: OcrStatus;
  extractionStatus: "unreviewed" | "candidate";
  error?: string;
}

const EMPTY_SIGNALS: AnnualReportSignals = {
  seniorTable: false,
  cupResults: false,
  reserve: false,
  junior: false,
  youth: false,
  people: false,
  officials: false,
};

const SIGNAL_PATTERNS: Record<keyof AnnualReportSignals, RegExp> = {
  seniorTable: /\b(?:tabell|divisjon|serie|seriemester|opprykk|nedrykk)\b/iu,
  cupResults: /\b(?:nm|norgesmesterskap|cup|runde)\b/iu,
  reserve: /\b(?:reserve|reservelag|res\.\s*lag|andrelag)\b/iu,
  junior: /\b(?:junior|g19)\b/iu,
  youth: /\b(?:gutt|smågutt|g16|g15|g14|g13|lilleputt|miniputt)\b/iu,
  people: /\b(?:spillere?|trenere?|representasjon|landslag|kretslag)\b/iu,
  officials: /\b(?:dommere?|komit[eé](?:er)?|styre|kurs|trenerkurs)\b/iu,
};

export async function analyzeAnnualReportPdf(
  report: AnnualReportLink,
  bytes: Uint8Array,
): Promise<AnnualReportTechnicalAnalysis> {
  return (await readAnnualReportPdfText(report, bytes)).analysis;
}

export async function readAnnualReportPdfText(
  report: AnnualReportLink,
  bytes: Uint8Array,
): Promise<AnnualReportPdfText> {
  const sha256 = hashPdf(bytes);
  if (!hasPdfSignature(bytes)) {
    return {
      analysis: failedAnnualReportAnalysis(report, "fila mangler PDF-signaturen %PDF-", bytes.length, sha256),
      pageTexts: [],
    };
  }

  let loadingTask: ReturnType<typeof getDocument> | undefined;
  try {
    loadingTask = getDocument({ data: bytes.slice(), verbosity: 0 });
    const document = await loadingTask.promise;
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        pageTexts.push(
          content.items
            .filter((item): item is typeof item & { str: string } => "str" in item)
            .map((item) => item.str)
            .join(" "),
        );
      } finally {
        page.cleanup();
      }
    }
    return {
      analysis: analyzePageTexts(report, bytes.length, sha256, pageTexts),
      pageTexts: pageTexts.map(normalizeText),
    };
  } catch (error) {
    return {
      analysis: failedAnnualReportAnalysis(report, shortError(error), bytes.length, sha256),
      pageTexts: [],
    };
  } finally {
    await loadingTask?.destroy();
  }
}

export function analyzePageTexts(
  report: AnnualReportLink,
  byteLength: number,
  sha256: string,
  rawPageTexts: string[],
): AnnualReportTechnicalAnalysis {
  const pages = rawPageTexts.length;
  const pageTexts = rawPageTexts.map(normalizeText);
  const textChars = pageTexts.reduce((total, text) => total + text.length, 0);
  const textPages = pageTexts.filter((text) => text.length >= 50).length;
  const textLayer = classifyTextLayer(textPages, pages);
  let strongMentions = 0;
  let weakMentions = 0;
  const mentionPages: number[] = [];
  const signals = { ...EMPTY_SIGNALS };

  pageTexts.forEach((text, index) => {
    const mentions = countAafkMentions(text);
    strongMentions += mentions.strong;
    weakMentions += mentions.weak;
    if (mentions.strong + mentions.weak > 0) mentionPages.push(index + 1);
    // Bare sikre klubbaliaser kan gjøre et generelt kretsord til et AaFK-signal.
    if (mentions.strong > 0) {
      for (const [name, pattern] of Object.entries(SIGNAL_PATTERNS) as Array<[keyof AnnualReportSignals, RegExp]>) {
        if (pattern.test(text)) signals[name] = true;
      }
    }
  });

  return {
    year: report.year,
    sourceId: annualReportSourceId(report.year),
    url: report.url,
    sha256,
    bytes: byteLength,
    pages,
    textLayer,
    textChars,
    textPages,
    strongMentions,
    weakMentions,
    mentionPages,
    signals,
    ocrStatus: textLayer === "usable" ? "not_needed" : "pending",
    extractionStatus:
      (textLayer === "usable" || textLayer === "sparse") && strongMentions + weakMentions > 0
        ? "candidate"
        : "unreviewed",
  };
}

export function classifyTextLayer(textPages: number, pages: number): TextLayerStatus {
  if (textPages === 0 || pages === 0) return "none";
  return textPages / pages < 0.25 ? "sparse" : "usable";
}

export function countAafkMentions(text: string): { strong: number; weak: number } {
  const strongPattern = /(?<![\p{L}\p{N}])(?:aafk|åfk|aalesunds?\s+(?:fk|fotballklubb))(?![\p{L}\p{N}])/giu;
  const weakPattern = /(?<![\p{L}\p{N}])aalesunds?(?![\p{L}\p{N}])/giu;
  const strongMatches = [...text.matchAll(strongPattern)];
  const withoutStrong = [...text];
  for (const match of strongMatches) {
    const start = match.index;
    if (start === undefined) continue;
    withoutStrong.fill(" ", start, start + match[0].length);
  }
  return {
    strong: strongMatches.length,
    weak: [...withoutStrong.join("").matchAll(weakPattern)].length,
  };
}

export function technicalManifest(analyses: AnnualReportTechnicalAnalysis[]): string {
  return `${JSON.stringify({
    reports: [...analyses].sort((a, b) => a.year - b.year),
  }, null, 2)}\n`;
}

export function technicalCoverageReport(analyses: AnnualReportTechnicalAnalysis[]): string {
  const reports = [...analyses].sort((a, b) => a.year - b.year);
  const count = (status: TextLayerStatus) => reports.filter((report) => report.textLayer === status).length;
  const totalBytes = reports.reduce((total, report) => total + report.bytes, 0);
  const totalPages = reports.reduce((total, report) => total + report.pages, 0);
  const ocr = reports.filter((report) => report.ocrStatus === "pending").length;
  const strong = reports.filter((report) => report.strongMentions > 0).length;
  const weakOnly = reports.filter((report) => report.strongMentions === 0 && report.weakMentions > 0).length;

  return [
    "# SFK årsrapporter, teknisk dekningskart",
    "",
    "Kartet er generert maskinelt fra PDF-ene. Treff og signaler er triage, ikke kanoniske historiske fakta.",
    "",
    "## Sammendrag",
    "",
    `- Rapporter undersøkt: ${reports.length}`,
    `- Årsspenn: ${reports.length ? `${reports[0]!.year}–${reports.at(-1)!.year}` : "–"}`,
    `- Totale sider: ${totalPages}`,
    `- Total størrelse: ${formatMb(totalBytes)} MB`,
    `- Brukbart tekstlag: ${count("usable")}`,
    `- Spredt tekstlag: ${count("sparse")}`,
    `- Uten tekstlag: ${count("none")}`,
    `- Feilet: ${count("failed")}`,
    `- Trenger senere OCR: ${ocr}`,
    `- Rapporter med sterke AaFK-treff: ${strong}`,
    `- Rapporter med bare svake treff: ${weakOnly}`,
    "",
    "## År for år",
    "",
    "| År | Sider | MB | Tekstlag | AaFK | Svake | Treff-sider | Signaler | OCR |",
    "|---:|---:|---:|---|---:|---:|---|---|---|",
    ...reports.map((report) =>
      `| ${report.year} | ${report.pages} | ${formatMb(report.bytes)} | ${report.textLayer} | ` +
      `${report.strongMentions} | ${report.weakMentions} | ${report.mentionPages.join(", ") || "–"} | ` +
      `${formatSignalNames(signalNames(report.signals))} | ${report.ocrStatus} |`,
    ),
    "",
    "## Tolkning",
    "",
    "`none` betyr at dokumentet ikke har et brukbart søkbart tekstlag. Null treff i slike",
    "rapporter betyr derfor ikke at rapporten ikke omtaler AaFK; den må eventuelt OCR-leses",
    "og kontrolleres visuelt i et senere arbeidsspor.",
    "",
  ].join("\n");
}

export function signalNames(signals: AnnualReportSignals): AnnualReportSignalName[] {
  return (Object.keys(signals) as AnnualReportSignalName[]).filter((name) => signals[name]);
}

export function signalKeywords(text: string, name: AnnualReportSignalName): string[] {
  const pattern = SIGNAL_PATTERNS[name];
  const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`);
  return [...new Set([...text.matchAll(globalPattern)].map((match) => match[0].toLocaleLowerCase("nb-NO")))];
}

export function formatSignalNames(names: AnnualReportSignalName[]): string {
  const labels: Record<AnnualReportSignalName, string> = {
    seniorTable: "serie",
    cupResults: "NM",
    reserve: "reserve",
    junior: "junior",
    youth: "ungdom",
    people: "personer",
    officials: "dommere/verv",
  };
  return names.map((name) => labels[name]).join(", ") || "–";
}

export function failedAnnualReportAnalysis(
  report: AnnualReportLink,
  error: string,
  bytes = 0,
  sha256 = "unavailable",
): AnnualReportTechnicalAnalysis {
  return {
    year: report.year,
    sourceId: annualReportSourceId(report.year),
    url: report.url,
    sha256,
    bytes,
    pages: 0,
    textLayer: "failed",
    textChars: 0,
    textPages: 0,
    strongMentions: 0,
    weakMentions: 0,
    mentionPages: [],
    signals: { ...EMPTY_SIGNALS },
    ocrStatus: "pending",
    extractionStatus: "unreviewed",
    error,
  };
}

function hashPdf(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function formatMb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(2);
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/gu, " ").trim().slice(0, 300);
}
