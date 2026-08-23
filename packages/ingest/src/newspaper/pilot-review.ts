import type { BatchEntry, BatchReport, IssueRef, NewspaperGenre } from "../adapters/nb-newspaper-batch.js";

export interface PilotReviewEntry {
  matchId: string;
  status: "ocr_correlated" | "no_ocr_candidate" | "conflict_candidate" | "not_digitized";
  reviewMethod: "ocr_api";
  facsimileReviewed: false;
  confidence: "high" | "medium" | "low";
  canonicalLinked: boolean;
  issueId?: string;
  urn?: string;
  url?: string;
  issued?: string;
  page?: string;
  searchedIssues: number;
  ocrCandidates: number;
  visuallyReviewedPages: 0;
  genres: NewspaperGenre[];
  fieldsAdded: string[];
  newPlayers: number;
  newEvents: number;
  newHistoricalObservations: 0;
  falsePositive: boolean;
  differentMatch: boolean;
  note: string;
}

const NON_EVENT_GENRES = new Set<NewspaperGenre>(["standings", "fixture_list", "advertisement", "unknown"]);

export function buildPilotReviewEntries(report: BatchReport): PilotReviewEntry[] {
  return report.entries.map(reviewEntry).sort((left, right) => left.matchId.localeCompare(right.matchId));
}

function reviewEntry(entry: BatchEntry): PilotReviewEntry {
  if (entry.outcome === "not_digitized") return terminal(entry, "not_digitized", "Ingen digitalisert utgave i søkevinduet.");
  const candidate = entry.candidates.find((issue) => isLocallyCorrelated(issue));
  if (!candidate) return terminal(entry, "no_ocr_candidate", "Ingen OCR-kandidat bandt begge klubber lokalt i relevant avisstoff.");

  const conflict = candidate.scoreConflict !== undefined;
  const exactScore = candidate.reasons.some((reason) => reason.startsWith("resultat:"));
  const confidence = conflict || exactScore ? "high" : candidate.score >= 70 ? "high" : "medium";
  return {
    matchId: entry.matchId,
    status: conflict ? "conflict_candidate" : "ocr_correlated",
    reviewMethod: "ocr_api",
    facsimileReviewed: false,
    confidence,
    canonicalLinked: false,
    issueId: candidate.id,
    ...(candidate.urn ? { urn: candidate.urn } : {}),
    url: candidate.pageUrl,
    ...(candidate.issued ? { issued: compactToIso(candidate.issued) } : {}),
    ...(candidate.page ? { page: candidate.page } : {}),
    searchedIssues: entry.candidateIssuesFound,
    ocrCandidates: entry.candidates.length,
    visuallyReviewedPages: 0,
    genres: candidate.genres,
    fieldsAdded: [],
    newPlayers: 0,
    newEvents: 0,
    newHistoricalObservations: 0,
    falsePositive: false,
    differentMatch: false,
    note: conflict
      ? "OCR-bandingen gjelder begge klubber, men resultatet avviker fra canonical. Ingen automatisk overskriving."
      : "Begge klubber er lokalt bundet i NB OCR-API innen datoankret søkevindu. Faksimilen er ikke kontrollert.",
  };
}

function terminal(entry: BatchEntry, status: PilotReviewEntry["status"], note: string): PilotReviewEntry {
  return {
    matchId: entry.matchId,
    status,
    reviewMethod: "ocr_api",
    facsimileReviewed: false,
    confidence: "low",
    canonicalLinked: false,
    searchedIssues: entry.candidateIssuesFound,
    ocrCandidates: entry.candidates.length,
    visuallyReviewedPages: 0,
    genres: [],
    fieldsAdded: [],
    newPlayers: 0,
    newEvents: 0,
    newHistoricalObservations: 0,
    falsePositive: false,
    differentMatch: false,
    note,
  };
}

function isLocallyCorrelated(issue: IssueRef): boolean {
  if (issue.dayOffset === undefined || issue.dayOffset < -2 || issue.dayOffset > 3) return false;
  return issue.evidence.some((evidence) =>
    !NON_EVENT_GENRES.has(evidence.genre)
    && evidence.reasons.includes("motstander og AaFK i samme avsnitt"));
}

function compactToIso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
