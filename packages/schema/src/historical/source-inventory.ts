import type { Source } from "../source.js";
import type { PublicationExtraction } from "../extraction.js";
import type { SourceResultCollection } from "../source-result.js";
import type { Provider } from "../entities.js";

export type SourceReviewStatus =
  | "reviewed"
  | "duplicate_or_reprint"
  | "unavailable"
  | "out_of_scope"
  | "unknown";

export interface HistoricalAuditScope {
  sourceIds?: string[];
  parentSourceId?: string;
  yearFrom?: number;
  yearTo?: number;
  requireCompleteReview?: boolean;
}

export interface SourceInventoryEntry {
  sourceId: string;
  title: string;
  year?: number;
  parentSourceId?: string;
  issue?: string;
  volume?: string;
  inScope: boolean;
  reviewStatus: SourceReviewStatus;
  extractionMode: "alto" | "manual" | "unavailable";
  pagesExpected: number;
  pagesProcessed: number;
  pagesFailed: string[];
  extractionFound: boolean;
  sourceResultsFound: boolean;
  errors: string[];
  warnings: string[];
}

export interface SourceInventorySummary {
  discovered: number;
  inScope: number;
  reviewed: number;
  reprints: number;
  unavailable: number;
  outOfScope: number;
  unknownReviewStatus: number;
  altoComplete: number;
  manualOrNoAlto: number;
  failedSources: number;
}

export interface SourceInventoryResult {
  scope: HistoricalAuditScope;
  summary: SourceInventorySummary;
  sources: SourceInventoryEntry[];
  allSourcesPassed: boolean;
}

/**
 * Utfører Source Inventory og preflight-audit mot kildekatalogen.
 */
export function auditSourceInventory(
  allSources: Map<string, Source>,
  allProviders: Map<string, Provider>,
  allExtractions: Map<string, PublicationExtraction>,
  allSourceResults: Map<string, SourceResultCollection>,
  scope: HistoricalAuditScope,
  declaredReviewStatuses?: Map<string, SourceReviewStatus>,
): SourceInventoryResult {
  const entries: SourceInventoryEntry[] = [];
  const processedSourceIds = new Set<string>();

  const explicitIds = scope.sourceIds ? new Set(scope.sourceIds) : null;

  // 1. Sjekk eksplisitte ID-er som ikke finnes i allSources
  if (explicitIds) {
    for (const explicitId of explicitIds) {
      if (!allSources.has(explicitId)) {
        entries.push({
          sourceId: explicitId,
          title: "(Ukjent kilde)",
          inScope: true,
          reviewStatus: "unknown",
          extractionMode: "manual",
          pagesExpected: 0,
          pagesProcessed: 0,
          pagesFailed: [],
          extractionFound: false,
          sourceResultsFound: false,
          errors: [`Kilden «${explicitId}» finnes ikke i kildekatalogen (data/sources/)`],
          warnings: [],
        });
        processedSourceIds.add(explicitId);
      }
    }
  }

  // 2. Gå gjennom alle kilder i arkivet
  for (const [sourceId, src] of allSources) {
    let inScope = true;

    if (explicitIds) {
      inScope = explicitIds.has(sourceId);
    } else {
      if (scope.parentSourceId && src.parentSourceId !== scope.parentSourceId) {
        inScope = false;
      }
      if (scope.yearFrom !== undefined && (src.year === undefined || src.year < scope.yearFrom)) {
        inScope = false;
      }
      if (scope.yearTo !== undefined && (src.year === undefined || src.year > scope.yearTo)) {
        inScope = false;
      }
    }

    if (!inScope && !explicitIds) {
      continue;
    }

    processedSourceIds.add(sourceId);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Preflight: Sjekk provider refs på kilden
    for (const provRef of src.providers) {
      if (!allProviders.has(provRef.providerId)) {
        errors.push(`Kilden refererer til ukjent provider «${provRef.providerId}»`);
      }
    }

    // Sjekk extraction
    const extraction = allExtractions.get(sourceId);
    let extractionMode: "alto" | "manual" | "unavailable" = "manual";
    let pagesExpected = 0;
    let pagesProcessed = 0;
    let pagesFailed: string[] = [];

    if (extraction) {
      pagesExpected = extraction.pagesExpected;
      pagesProcessed = extraction.pagesProcessed;
      pagesFailed = extraction.pagesFailed;

      if (extraction.providerId && !allProviders.has(extraction.providerId)) {
        errors.push(`Extraction refererer til ukjent provider «${extraction.providerId}»`);
      }

      if (extraction.ocrAccess === "alto") {
        extractionMode = "alto";
        if (pagesFailed.length > 0) {
          errors.push(`ALTO-extraction har ${pagesFailed.length} feilede sider (${pagesFailed.join(", ")})`);
        }
        if (pagesProcessed < pagesExpected) {
          warnings.push(`Behandlede sider (${pagesProcessed}) er lavere enn forventet (${pagesExpected})`);
        }
        if (extraction.adapter === "nb" && !extraction.contentHash) {
          warnings.push("Mangler contentHash for ALTO-kilde");
        }
      } else if (extraction.ocrAccess === "unavailable") {
        extractionMode = "unavailable";
      } else {
        extractionMode = "manual";
      }
    } else {
      warnings.push("Ingen maskinell extraction-fil registrert");
    }

    // Sjekk source-results
    const sourceResults = allSourceResults.get(sourceId);
    const sourceResultsFound = !!sourceResults;

    // Bestem reviewStatus ut fra dokumenterte deklarasjoner
    let reviewStatus: SourceReviewStatus = "unknown";
    if (declaredReviewStatuses && declaredReviewStatuses.has(sourceId)) {
      reviewStatus = declaredReviewStatuses.get(sourceId)!;
    } else if (extractionMode === "unavailable") {
      reviewStatus = "unavailable";
    }

    entries.push({
      sourceId,
      title: src.title,
      year: src.year,
      parentSourceId: src.parentSourceId,
      issue: src.issue,
      volume: src.volume,
      inScope,
      reviewStatus,
      extractionMode,
      pagesExpected,
      pagesProcessed,
      pagesFailed,
      extractionFound: !!extraction,
      sourceResultsFound,
      errors,
      warnings,
    });
  }

  // Sorter etter år og tittel
  entries.sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.sourceId.localeCompare(b.sourceId));

  let inScopeCount = 0;
  let reviewedCount = 0;
  let reprintsCount = 0;
  let unavailableCount = 0;
  let outOfScopeCount = 0;
  let unknownCount = 0;
  let altoCompleteCount = 0;
  let manualOrNoAltoCount = 0;
  let failedSourcesCount = 0;

  for (const e of entries) {
    if (e.inScope) {
      inScopeCount += 1;
      if (e.reviewStatus === "reviewed") reviewedCount += 1;
      else if (e.reviewStatus === "duplicate_or_reprint") reprintsCount += 1;
      else if (e.reviewStatus === "unavailable") unavailableCount += 1;
      else if (e.reviewStatus === "out_of_scope") outOfScopeCount += 1;
      else if (e.reviewStatus === "unknown") unknownCount += 1;

      const isAltoComplete =
        e.extractionMode === "alto" &&
        e.pagesFailed.length === 0 &&
        e.pagesProcessed === e.pagesExpected &&
        e.pagesExpected > 0;

      if (isAltoComplete) altoCompleteCount += 1;
      else if (e.extractionMode === "manual" || (e.extractionMode === "alto" && !isAltoComplete)) {
        manualOrNoAltoCount += 1;
      }

      if (e.errors.length > 0) failedSourcesCount += 1;
    }
  }

  const summary: SourceInventorySummary = {
    discovered: entries.length,
    inScope: inScopeCount,
    reviewed: reviewedCount,
    reprints: reprintsCount,
    unavailable: unavailableCount,
    outOfScope: outOfScopeCount,
    unknownReviewStatus: unknownCount,
    altoComplete: altoCompleteCount,
    manualOrNoAlto: manualOrNoAltoCount,
    failedSources: failedSourcesCount,
  };

  const allSourcesPassed =
    failedSourcesCount === 0 &&
    (!scope.requireCompleteReview || unknownCount === 0);

  return {
    scope,
    summary,
    sources: entries,
    allSourcesPassed,
  };
}
