import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import { loadArchive, repoRoot } from "../load.js";
import type { SourceResult } from "../source-result.js";
import { sourceClaimLineageManifest } from "./source-claim-lineage.js";
import {
  buildSourceClaimIndex,
  evaluateReviewValidityAgainstCurrentClaim,
  resolveLegacyHypothesisId,
  type ReviewValidityOutcome,
  type SourceClaimIndex,
} from "./source-claim-registry.js";

type JsonRecord = Record<string, unknown>;

export type DiscoveryTerminalStatus =
  | "canonicalized"
  | "matched_existing_canonical"
  | "visually_reviewed_unresolved"
  | "community_research"
  | "rejected_different_event"
  | "rejected_non_senior"
  | "rejected_source_mismatch"
  | "candidate_exhausted"
  | "no_candidate"
  | "superseded_by_newer_pipeline";

export type DiscoveryWorkflowStatus =
  | DiscoveryTerminalStatus
  | "needs_visual_review"
  | "requires_revalidation"
  | "ready_for_canonicalization"
  | "ambiguous_internal_state";

export interface DiscoveryClosureEntry {
  sourceClaimId: string;
  relatedSourceClaimIds: string[];
  sourceId: string;
  currentCoordinate: { season: number; no: number; hypothesisId: string };
  legacyHypothesisIds: string[];
  discoveryOrigins: string[];
  reviewUnitId: string;
  retrieval: {
    hasCandidates: boolean;
    candidateCount: number;
    candidatePriority: "high" | "medium" | "low" | "uncovered";
    bestCandidate: { candidateId: string; rank: number; pageUrl: string } | null;
  };
  selection: "pilot" | "wave2" | "final_remaining" | "none";
  review: {
    status: "never_reviewed" | "valid_review" | "stale_review" | "superseded_review";
    basis: "true_visual_review" | "legacy_ai_review" | "prior_ground_truth" | "none";
    validity: ReviewValidityOutcome | "not_applicable";
    sourceCoordinateAtReview: { season: number; no: number } | null;
    actualVisualSource: string | null;
    claimResolution: string | null;
    canonicalEligibility: string | null;
  };
  canonical: {
    status: "canonicalized" | "existing_match" | "not_canonicalized";
    matchId: string | null;
  };
  community: {
    status: "published" | "resolved" | "unresolved" | "none";
    caseIds: string[];
  };
  workflowStatus: DiscoveryWorkflowStatus;
  terminalStatus: DiscoveryTerminalStatus | null;
}

export interface DiscoveryClosureStatus {
  contract: "discovery-closure-status@1";
  decisionGate: "DISCOVERY_CLOSURE_QUEUE_ESTABLISHED";
  generatedFrom: { authoritativeAsOf: "working-tree"; inputs: string[] };
  baseline: {
    pr198: { totalHypotheses: number; candidateCovered: number; uncovered: number; candidatePages: number };
  };
  totals: Record<string, number>;
  periods: Record<string, Record<string, number>>;
  integrity: {
    orphanDiscoveryReferences: string[];
    ambiguousInternalState: string[];
    duplicatePrimarySourceClaimIds: string[];
    duplicateReviewAssignments: string[];
  };
  closureQueue: {
    needsVisualReview: string[];
    requiresRevalidation: string[];
    readyForCanonicalization: string[];
    communityResearch: string[];
    exhausted: string[];
    terminal: string[];
    bySelection: Record<"pilot" | "wave2" | "final_remaining" | "none", {
      needsVisualReview: string[];
      requiresRevalidation: string[];
      readyForCanonicalization: string[];
    }>;
  };
  entries: DiscoveryClosureEntry[];
}

const INPUTS = [
  "data/discovery/nb-source-result-wide-candidates-1945-1984.yaml",
  "data/discovery/nb-source-result-visual-review-1945-1984.yaml",
  "data/discovery/nb-source-result-canonicalization-1945-1984.yaml",
  "data/discovery/nb-source-result-canonicalization-wave2-1945-1954.yaml",
  "data/discovery/medlemsblad-1965-year-shift-mapping.yaml",
  "data/discovery/community-candidate-queue.yaml",
  "data/discovery/community-ai-review-wave-1.yaml",
  "data/discovery/community-ai-review-wave-2.yaml",
  "data/discovery/nb-community-research-wave-1.yaml",
  "data/discovery/nb-canonical-review-audit.yaml",
  "data/discovery/nb-visual-review-followup.yaml",
  "data/migrations/source-claim-lineage.yaml",
] as const;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function integer(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

async function readYaml(root: string, relativePath: string): Promise<JsonRecord> {
  return record(parseYaml(await readFile(join(root, relativePath), "utf8")));
}

function sourceReference(raw: unknown, fallbackSeason?: number): {
  sourceId: string;
  season: number;
  no: number;
  opponent?: string;
  score?: { aafk: number; opponent: number };
} | null {
  const ref = record(raw);
  const sourceId = text(ref.sourceId);
  const season = integer(ref.season) ?? integer(ref.year) ?? fallbackSeason;
  const no = integer(ref.no);
  if (!sourceId || season === undefined || no === undefined) return null;
  const score = record(ref.expectedScore);
  const aafk = integer(score.aafk);
  const opponentGoals = integer(score.opponent);
  return {
    sourceId,
    season,
    no,
    ...(text(ref.opponent) ? { opponent: text(ref.opponent) } : {}),
    ...(aafk !== undefined && opponentGoals !== undefined ? { score: { aafk, opponent: opponentGoals } } : {}),
  };
}

function samePayload(claim: SourceResult, ref: NonNullable<ReturnType<typeof sourceReference>>): boolean {
  if (ref.opponent && claim.opponent !== ref.opponent) return false;
  if (ref.score && (claim.aafkGoals !== ref.score.aafk || claim.opponentGoals !== ref.score.opponent)) return false;
  return true;
}

function resolveReference(
  ref: NonNullable<ReturnType<typeof sourceReference>>,
  index: SourceClaimIndex,
): { claim?: SourceResult; ambiguity?: string; orphan?: string } {
  const hypothesisId = `${ref.sourceId}#${ref.season}-${String(ref.no).padStart(3, "0")}`;
  const resolved = resolveLegacyHypothesisId(hypothesisId, index);
  if (resolved.status === "exact_current" || resolved.status === "superseded_coordinate_alias") {
    return samePayload(resolved.claim, ref)
      ? { claim: resolved.claim }
      : { ambiguity: `${hypothesisId}: source-result-payload matcher ikke claim ved koordinaten` };
  }
  if (resolved.status === "ambiguous_reused_coordinate") {
    const candidates = [resolved.currentClaim, ...resolved.historicalClaims]
      .filter((claim): claim is SourceResult => claim !== undefined)
      .filter((claim) => samePayload(claim, ref));
    if (candidates.length === 1) return { claim: candidates[0] };
    return { ambiguity: `${hypothesisId}: ${candidates.length} payload-matcher blant gjenbrukte koordinater` };
  }
  return { orphan: hypothesisId };
}

function currentNo(claim: SourceResult): number {
  return Number.parseInt(claim.id.slice(-3), 10);
}

function candidateSummary(raw: JsonRecord): DiscoveryClosureEntry["retrieval"]["bestCandidate"] {
  const candidateId = text(raw.candidateId);
  const rank = integer(raw.rank) ?? 1;
  const newspaper = record(raw.newspaper);
  const pageUrl = text(raw.pageUrl) ?? text(newspaper.pageUrl);
  if (!candidateId || !pageUrl) return null;
  return { candidateId, rank, pageUrl };
}

function periodFor(year: number): string {
  const start = year <= 1924 ? 1915 : year <= 1934 ? 1925 : year <= 1944 ? 1935 : year <= 1954 ? 1945 : year <= 1964 ? 1955 : year <= 1974 ? 1965 : 1975;
  return `${start}-${start + 9}`;
}

function terminalFor(entry: Omit<DiscoveryClosureEntry, "workflowStatus" | "terminalStatus">): {
  workflowStatus: DiscoveryWorkflowStatus;
  terminalStatus: DiscoveryTerminalStatus | null;
} {
  if (entry.canonical.status === "canonicalized") return { workflowStatus: "canonicalized", terminalStatus: "canonicalized" };
  if (entry.canonical.status === "existing_match") return { workflowStatus: "matched_existing_canonical", terminalStatus: "matched_existing_canonical" };
  if (!entry.retrieval.hasCandidates) return { workflowStatus: "no_candidate", terminalStatus: "no_candidate" };
  if (entry.review.status === "stale_review") return { workflowStatus: "requires_revalidation", terminalStatus: null };
  if (entry.community.status === "published" || entry.community.status === "unresolved") return { workflowStatus: "community_research", terminalStatus: "community_research" };
  if (entry.review.status === "never_reviewed" || entry.review.status === "superseded_review") return { workflowStatus: "needs_visual_review", terminalStatus: null };
  if (entry.review.claimResolution === "different_event") return { workflowStatus: "rejected_different_event", terminalStatus: "rejected_different_event" };
  if (entry.review.claimResolution === "non_senior") return { workflowStatus: "rejected_non_senior", terminalStatus: "rejected_non_senior" };
  if (entry.review.canonicalEligibility === "ready") return { workflowStatus: "ready_for_canonicalization", terminalStatus: null };
  if (entry.review.claimResolution === "insufficient") return { workflowStatus: "candidate_exhausted", terminalStatus: "candidate_exhausted" };
  return { workflowStatus: "visually_reviewed_unresolved", terminalStatus: "visually_reviewed_unresolved" };
}

/**
 * Rekonstruerer dagens discovery-status uten nettverk, ny review eller canonical writes.
 * Gamle koordinater er bare kompatibilitetsoppslag; permanent claim-ID er ledgerens identitet.
 */
export async function buildDiscoveryClosureStatus(root = repoRoot()): Promise<DiscoveryClosureStatus> {
  const data = new Map<string, JsonRecord>();
  for (const input of INPUTS) data.set(input, await readYaml(root, input));

  const archive = await loadArchive(join(root, "data"));
  const lineageRaw = data.get("data/migrations/source-claim-lineage.yaml") ?? {};
  const lineage = sourceClaimLineageManifest.parse(lineageRaw);
  const index = buildSourceClaimIndex(archive.sourceResults, lineage);
  const wide = data.get(INPUTS[0]) ?? {};
  const visual = data.get(INPUTS[1]) ?? {};
  const visualByHypothesis = new Map(list(visual.cases).map((item) => [text(item.hypothesisId) ?? "", item]));
  const wave2Ids = new Set<string>();
  if (Array.isArray(record(visual.productionWave2Selection).selectedHypothesisIds)) {
    for (const value of record(visual.productionWave2Selection).selectedHypothesisIds as unknown[]) {
      const id = text(value);
      if (id) wave2Ids.add(id);
    }
  }

  const canonicalIds = new Set<string>();
  for (const path of [INPUTS[2], INPUTS[3]]) {
    for (const item of list((data.get(path) ?? {}).items)) {
      const id = text(item.hypothesisId);
      if (id) canonicalIds.add(id);
    }
  }

  const researchByHypothesis = new Map<string, string[]>();
  for (const item of list((data.get(INPUTS[8]) ?? {}).items)) {
    const id = text(item.hypothesisId);
    const caseId = text(item.id);
    if (id && caseId) researchByHypothesis.set(id, [...(researchByHypothesis.get(id) ?? []), caseId]);
  }

  const aiCandidateIds = new Set<string>();
  for (const path of [INPUTS[6], INPUTS[7]]) {
    for (const item of list((data.get(path) ?? {}).reviews)) {
      const id = text(item.candidateId);
      if (id) aiCandidateIds.add(id);
    }
  }

  const orphanDiscoveryReferences: string[] = [];
  const ambiguousInternalState: string[] = [];
  const entries: DiscoveryClosureEntry[] = [];
  const claimToEntry = new Map<string, DiscoveryClosureEntry>();

  for (const hypothesis of list(wide.hypotheses)) {
    const hypothesisId = text(hypothesis.hypothesisId);
    if (!hypothesisId) continue;
    const visualCase = visualByHypothesis.get(hypothesisId);
    const hypothesisSeason = integer(hypothesis.season);
    const refs = list(hypothesis.sourceResults).map((item) => sourceReference(item, hypothesisSeason)).filter((ref): ref is NonNullable<typeof ref> => ref !== null);
    const resolvedClaims: SourceResult[] = [];
    for (const ref of refs) {
      const resolution = resolveReference(ref, index);
      if (resolution.claim && !resolvedClaims.some((claim) => claim.claimId === resolution.claim?.claimId)) resolvedClaims.push(resolution.claim);
      if (resolution.ambiguity) ambiguousInternalState.push(resolution.ambiguity);
      if (resolution.orphan) orphanDiscoveryReferences.push(resolution.orphan);
    }
    if (resolvedClaims.length === 0) continue;

    const matchedRef = sourceReference(record(visualCase?.matchedSourceResult), integer(visualCase?.season) ?? hypothesisSeason);
    const matchedClaim = matchedRef ? resolveReference(matchedRef, index).claim : undefined;
    const primary = matchedClaim ?? resolvedClaims[0]!;
    const candidates = list(hypothesis.candidates);
    const activeCandidate = list(visualCase?.reviewedCandidates)[0];
    const actualVisualSource = record(activeCandidate?.actualVisualSource);
    const actualPageUrl = text(actualVisualSource.pageUrl) ?? text(record(activeCandidate?.newspaper).pageUrl);
    const status = text(visualCase?.reviewStatus);
    const belongsToTrueVisualPipeline = status === "visually_reviewed_pilot" || status === "visually_reviewed_wave_2";
    const basis = belongsToTrueVisualPipeline ? "true_visual_review" as const : "none" as const;
    let reviewValidity: ReviewValidityOutcome | "not_applicable" = "not_applicable";
    let sourceCoordinateAtReview: { season: number; no: number } | null = null;
    let reviewStatus: DiscoveryClosureEntry["review"]["status"] = "never_reviewed";
    if (status === "visually_reviewed_pilot" || status === "visually_reviewed_wave_2") {
      const reviewRef = matchedRef ?? sourceReference(list(visualCase?.sourceResults)[0], integer(visualCase?.season) ?? hypothesisSeason);
      if (reviewRef) {
        sourceCoordinateAtReview = { season: reviewRef.season, no: reviewRef.no };
        reviewValidity = evaluateReviewValidityAgainstCurrentClaim(
          { sourceClaimId: primary.claimId, hypothesisId, sourceCoordinateAtReview },
          primary,
        ).validity;
        reviewStatus = reviewValidity === "requires_revalidation" || reviewValidity === "invalid" ? "stale_review" : "valid_review";
      }
    }

    const communityCases = researchByHypothesis.get(hypothesisId) ?? [];
    const linkedClaim = resolvedClaims.find((claim) => claim.matchId !== null);
    const canonicalized = Boolean(linkedClaim && canonicalIds.has(hypothesisId));
    const baseEntry = {
      sourceClaimId: primary.claimId,
      relatedSourceClaimIds: resolvedClaims.filter((claim) => claim.claimId !== primary.claimId).map((claim) => claim.claimId).sort(),
      sourceId: primary.sourceId,
      currentCoordinate: { season: primary.season, no: currentNo(primary), hypothesisId: `${primary.sourceId}#${primary.id}` },
      legacyHypothesisIds: [...new Set([hypothesisId, ...(index.lineageByClaimId.get(primary.claimId)?.legacyHypothesisIds ?? [])])].sort(),
      discoveryOrigins: ["pr198_wide_retrieval", ...(status === "visually_reviewed_pilot" ? ["pr199_pilot"] : []), ...(wave2Ids.has(hypothesisId) ? ["pr201_wave2"] : [])],
      reviewUnitId: text(record(hypothesis.siblingGroup).id) ?? hypothesisId,
      retrieval: {
        hasCandidates: candidates.length > 0,
        candidateCount: candidates.length,
        candidatePriority: (text(record(candidates[0]?.retrieval).machinePriority) ?? (candidates.length ? "low" : "uncovered")) as DiscoveryClosureEntry["retrieval"]["candidatePriority"],
        bestCandidate: candidates[0] ? candidateSummary(candidates[0]) : null,
      },
      selection: (status === "visually_reviewed_pilot" ? "pilot" : wave2Ids.has(hypothesisId) ? "wave2" : "final_remaining") as DiscoveryClosureEntry["selection"],
      review: {
        status: reviewStatus,
        basis,
        validity: reviewValidity,
        sourceCoordinateAtReview,
        actualVisualSource: actualPageUrl ?? null,
        claimResolution: text(visualCase?.claimResolution) ?? null,
        canonicalEligibility: text(visualCase?.canonicalEligibility) ?? null,
      },
      canonical: {
        status: canonicalized ? "canonicalized" as const : linkedClaim ? "existing_match" as const : "not_canonicalized" as const,
        matchId: linkedClaim?.matchId ?? null,
      },
      community: {
        status: communityCases.length ? "published" as const : "none" as const,
        caseIds: communityCases,
      },
    };
    const entry: DiscoveryClosureEntry = { ...baseEntry, ...terminalFor(baseEntry) };
    entries.push(entry);
    for (const claimId of [entry.sourceClaimId, ...entry.relatedSourceClaimIds]) claimToEntry.set(claimId, entry);
  }

  for (const candidate of list((data.get(INPUTS[5]) ?? {}).candidates)) {
    const ref = sourceReference(candidate.sourceResult);
    const candidateId = text(candidate.candidateId);
    if (!ref || !candidateId) continue;
    const resolution = resolveReference(ref, index);
    if (resolution.ambiguity) ambiguousInternalState.push(resolution.ambiguity);
    if (resolution.orphan) orphanDiscoveryReferences.push(resolution.orphan);
    const claim = resolution.claim;
    if (!claim) continue;
    const legacyReviewed = aiCandidateIds.has(candidateId);
    const existing = claimToEntry.get(claim.claimId);
    if (existing) {
      if (!existing.discoveryOrigins.includes("legacy_community_queue")) existing.discoveryOrigins.push("legacy_community_queue");
      if (legacyReviewed && !existing.discoveryOrigins.includes("legacy_ai_review")) existing.discoveryOrigins.push("legacy_ai_review");
      continue;
    }
    const publication = text(record(candidate.publication).status);
    const bestCandidate = candidateSummary(candidate);
    const baseEntry = {
      sourceClaimId: claim.claimId,
      relatedSourceClaimIds: [],
      sourceId: claim.sourceId,
      currentCoordinate: { season: claim.season, no: currentNo(claim), hypothesisId: `${claim.sourceId}#${claim.id}` },
      legacyHypothesisIds: [...new Set([`${ref.sourceId}#${ref.season}-${String(ref.no).padStart(3, "0")}`, ...(index.lineageByClaimId.get(claim.claimId)?.legacyHypothesisIds ?? [])])].sort(),
      discoveryOrigins: ["legacy_community_queue", ...(legacyReviewed ? ["legacy_ai_review"] : [])],
      reviewUnitId: `legacy:${claim.claimId}`,
      retrieval: { hasCandidates: true, candidateCount: 1, candidatePriority: "low" as const, bestCandidate },
      selection: "none" as const,
      review: {
        status: legacyReviewed ? "superseded_review" as const : "never_reviewed" as const,
        basis: legacyReviewed ? "legacy_ai_review" as const : "none" as const,
        validity: "not_applicable" as const,
        sourceCoordinateAtReview: null,
        actualVisualSource: null,
        claimResolution: null,
        canonicalEligibility: null,
      },
      canonical: {
        status: claim.matchId ? "existing_match" as const : "not_canonicalized" as const,
        matchId: claim.matchId,
      },
      community: {
        status: publication === "open" ? "published" as const : "none" as const,
        caseIds: publication === "open" ? [candidateId] : [],
      },
    };
    const entry: DiscoveryClosureEntry = { ...baseEntry, ...terminalFor(baseEntry) };
    entries.push(entry);
    claimToEntry.set(entry.sourceClaimId, entry);
  }

  entries.sort((a, b) => a.currentCoordinate.season - b.currentCoordinate.season || a.sourceClaimId.localeCompare(b.sourceClaimId));
  const duplicatePrimarySourceClaimIds = [...new Set(entries.map((entry) => entry.sourceClaimId).filter((id, index, all) => all.indexOf(id) !== index))].sort();
  const reviewAssignments = entries.filter((entry) => entry.review.basis === "true_visual_review").map((entry) => entry.sourceClaimId);
  const duplicateReviewAssignments = [...new Set(reviewAssignments.filter((id, index, all) => all.indexOf(id) !== index))].sort();

  const totals: Record<string, number> = {
    totalCurrentDiscoveryUniverse: entries.length,
    pr198Hypotheses: list(wide.hypotheses).length,
    candidateCovered: entries.filter((entry) => entry.retrieval.hasCandidates).length,
    uncovered: entries.filter((entry) => !entry.retrieval.hasCandidates).length,
    pilot: entries.filter((entry) => entry.selection === "pilot").length,
    wave2: entries.filter((entry) => entry.selection === "wave2").length,
    remaining: entries.filter((entry) => entry.selection === "final_remaining").length,
    visuallyReviewedValid: entries.filter((entry) => entry.review.status === "valid_review").length,
    visuallyReviewedStale: entries.filter((entry) => entry.review.status === "stale_review").length,
    neverVisuallyReviewed: entries.filter((entry) => entry.review.status === "never_reviewed" || entry.review.status === "superseded_review").length,
    trueVisualReviewed: entries.filter((entry) => entry.review.basis === "true_visual_review").length,
    legacyAiReviewed: entries.filter((entry) => entry.discoveryOrigins.includes("legacy_ai_review")).length,
    supersededReview: entries.filter((entry) => entry.review.status === "superseded_review").length,
    canonicalized: entries.filter((entry) => entry.terminalStatus === "canonicalized").length,
    matchedExisting: entries.filter((entry) => entry.terminalStatus === "matched_existing_canonical").length,
    community: entries.filter((entry) => entry.terminalStatus === "community_research").length,
    rejected: entries.filter((entry) => entry.terminalStatus?.startsWith("rejected_")).length,
    pendingVisualReview: entries.filter((entry) => entry.workflowStatus === "needs_visual_review").length,
    requiresRevalidation: entries.filter((entry) => entry.workflowStatus === "requires_revalidation").length,
    pendingCanonicalization: entries.filter((entry) => entry.workflowStatus === "ready_for_canonicalization").length,
    candidateExhausted: entries.filter((entry) => entry.terminalStatus === "candidate_exhausted").length,
    noCandidate: entries.filter((entry) => entry.terminalStatus === "no_candidate").length,
  };
  for (const status of [
    "canonicalized",
    "matched_existing_canonical",
    "visually_reviewed_unresolved",
    "community_research",
    "rejected_different_event",
    "rejected_non_senior",
    "rejected_source_mismatch",
    "candidate_exhausted",
    "no_candidate",
    "superseded_by_newer_pipeline",
  ] satisfies DiscoveryTerminalStatus[]) {
    totals[`terminal_${status}`] = entries.filter((entry) => entry.terminalStatus === status).length;
  }

  const periods: Record<string, Record<string, number>> = {};
  for (const label of ["1915-1924", "1925-1934", "1935-1944", "1945-1954", "1955-1964", "1965-1974", "1975-1984"]) {
    const periodEntries = entries.filter((entry) => periodFor(entry.currentCoordinate.season) === label);
    periods[label] = {
      total: periodEntries.length,
      pilot: periodEntries.filter((entry) => entry.selection === "pilot").length,
      wave2: periodEntries.filter((entry) => entry.selection === "wave2").length,
      finalRemaining: periodEntries.filter((entry) => entry.selection === "final_remaining").length,
      candidateCovered: periodEntries.filter((entry) => entry.retrieval.hasCandidates).length,
      validReview: periodEntries.filter((entry) => entry.review.status === "valid_review").length,
      staleReview: periodEntries.filter((entry) => entry.review.status === "stale_review").length,
      needsVisualReview: periodEntries.filter((entry) => entry.workflowStatus === "needs_visual_review").length,
      requiresRevalidation: periodEntries.filter((entry) => entry.workflowStatus === "requires_revalidation").length,
      readyForCanonicalization: periodEntries.filter((entry) => entry.workflowStatus === "ready_for_canonicalization").length,
      terminal: periodEntries.filter((entry) => entry.terminalStatus !== null).length,
    };
  }

  const queueIds = (status: DiscoveryWorkflowStatus) => entries.filter((entry) => entry.workflowStatus === status).map((entry) => entry.sourceClaimId);
  const selectionQueue = (selection: DiscoveryClosureEntry["selection"]) => ({
    needsVisualReview: entries.filter((entry) => entry.selection === selection && entry.workflowStatus === "needs_visual_review").map((entry) => entry.sourceClaimId),
    requiresRevalidation: entries.filter((entry) => entry.selection === selection && entry.workflowStatus === "requires_revalidation").map((entry) => entry.sourceClaimId),
    readyForCanonicalization: entries.filter((entry) => entry.selection === selection && entry.workflowStatus === "ready_for_canonicalization").map((entry) => entry.sourceClaimId),
  });
  return {
    contract: "discovery-closure-status@1",
    decisionGate: "DISCOVERY_CLOSURE_QUEUE_ESTABLISHED",
    generatedFrom: { authoritativeAsOf: "working-tree", inputs: [...INPUTS] },
    baseline: {
      pr198: {
        totalHypotheses: integer(record(wide.scope).totalHypotheses) ?? list(wide.hypotheses).length,
        candidateCovered: integer(record(wide.retrievalSummary).hypothesesWithCandidates) ?? 0,
        uncovered: integer(record(record(wide.retrievalSummary).machineVisualReviewQueue).uncovered) ?? 0,
        candidatePages: integer(record(wide.retrievalSummary).totalCandidatesRetrieved) ?? 0,
      },
    },
    totals,
    periods,
    integrity: {
      orphanDiscoveryReferences: [...new Set(orphanDiscoveryReferences)].sort(),
      ambiguousInternalState: [...new Set(ambiguousInternalState)].sort(),
      duplicatePrimarySourceClaimIds,
      duplicateReviewAssignments,
    },
    closureQueue: {
      needsVisualReview: queueIds("needs_visual_review"),
      requiresRevalidation: queueIds("requires_revalidation"),
      readyForCanonicalization: queueIds("ready_for_canonicalization"),
      communityResearch: queueIds("community_research"),
      exhausted: queueIds("candidate_exhausted"),
      terminal: entries.filter((entry) => entry.terminalStatus !== null).map((entry) => entry.sourceClaimId),
      bySelection: {
        pilot: selectionQueue("pilot"),
        wave2: selectionQueue("wave2"),
        final_remaining: selectionQueue("final_remaining"),
        none: selectionQueue("none"),
      },
    },
    entries,
  };
}
