import { createHash } from "node:crypto";
import {
  countAafkMentions,
  formatSignalNames,
  signalKeywords,
  type AnnualReportSignalName,
  type AnnualReportTechnicalAnalysis,
} from "./sfk-annual-report-analysis.js";

export interface AnnualReportPageCandidate {
  id: string;
  year: number;
  sourceId: string;
  page: number;
  strongMentions: number;
  weakMentions: number;
  topics: AnnualReportSignalName[];
  keywords: string[];
}

const TOPIC_ORDER: AnnualReportSignalName[] = [
  "seniorTable",
  "cupResults",
  "reserve",
  "junior",
  "youth",
  "people",
  "officials",
];

/** Lager sidepekere for menneskelig kontroll, ikke faktapåstander. */
export function extractAnnualReportPageCandidates(
  analysis: AnnualReportTechnicalAnalysis,
  pageTexts: string[],
): AnnualReportPageCandidate[] {
  const candidates: AnnualReportPageCandidate[] = [];
  pageTexts.forEach((text, index) => {
    const mentions = countAafkMentions(text);
    if (mentions.strong === 0) return;
    const topics = TOPIC_ORDER.filter((name) => signalKeywords(text, name).length > 0);
    if (topics.length === 0) return;
    const keywords = [...new Set(topics.flatMap((name) => signalKeywords(text, name)))].sort((a, b) => a.localeCompare(b, "nb"));
    const page = index + 1;
    candidates.push({
      id: candidateId(analysis.sourceId, page, topics),
      year: analysis.year,
      sourceId: analysis.sourceId,
      page,
      strongMentions: mentions.strong,
      weakMentions: mentions.weak,
      topics,
      keywords,
    });
  });
  return candidates;
}

export function candidateManifest(candidates: AnnualReportPageCandidate[]): string {
  return `${JSON.stringify({
    candidates: sortCandidates(candidates),
  }, null, 2)}\n`;
}

export function candidateCoverageReport(
  analyses: AnnualReportTechnicalAnalysis[],
  candidates: AnnualReportPageCandidate[],
): string {
  const reports = [...analyses].sort((a, b) => a.year - b.year);
  const sorted = sortCandidates(candidates);
  const topicCounts = TOPIC_ORDER.map((name) => [name, sorted.filter((candidate) => candidate.topics.includes(name)).length] as const);
  return [
    "# SFK årsrapporter, faktakandidater fra tekstlag",
    "",
    "Kandidatene peker ut sider for menneskelig kontroll. De er maskinelle temasignaler,",
    "ikke påstander om kamper, tabeller, personer eller verv. Rå PDF-tekst lagres ikke.",
    "",
    "## Sammendrag",
    "",
    `- Rapporter med brukbart tekstlag: ${reports.length}`,
    `- Kandidatsider: ${sorted.length}`,
    `- Årsspenn: ${reports.length ? `${reports[0]!.year}–${reports.at(-1)!.year}` : "–"}`,
    ...topicCounts.map(([name, count]) => `- ${formatSignalNames([name])}: ${count} ${count === 1 ? "side" : "sider"}`),
    "",
    "## Rapporter",
    "",
    "| År | AaFK-sider | Kandidatsider | Signaler |",
    "|---:|---:|---:|---|",
    ...reports.map((analysis) => {
      const reportCandidates = sorted.filter((candidate) => candidate.year === analysis.year);
      const topics = TOPIC_ORDER.filter((name) => reportCandidates.some((candidate) => candidate.topics.includes(name)));
      return `| ${analysis.year} | ${analysis.mentionPages.length} | ${reportCandidates.length} | ${formatSignalNames(topics)} |`;
    }),
    "",
    "## Kandidatsider",
    "",
    "| År | Side | Sterke | Svake | Signaler | Nøkkelord |",
    "|---:|---:|---:|---:|---|---|",
    ...sorted.map((candidate) =>
      `| ${candidate.year} | ${candidate.page} | ${candidate.strongMentions} | ${candidate.weakMentions} | ` +
      `${formatSignalNames(candidate.topics)} | ${candidate.keywords.join(", ")} |`,
    ),
    "",
  ].join("\n");
}

function candidateId(sourceId: string, page: number, topics: AnnualReportSignalName[]): string {
  const hash = createHash("sha256").update(`${sourceId}\0${page}\0${topics.join(",")}`).digest("hex").slice(0, 16);
  return `sfk-side-${hash}`;
}

function sortCandidates(candidates: AnnualReportPageCandidate[]): AnnualReportPageCandidate[] {
  return [...candidates].sort((a, b) => a.year - b.year || a.page - b.page || a.id.localeCompare(b.id));
}
