import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { repoRoot, loadArchive } from "@aafkstats/schema/load";

export interface ReviewedCandidate {
  candidateId: string;
  rank: number;
  newspaper: {
    title: string;
    issueDate: string;
    page: string;
    pageUrl: string;
  };
  visuallyReviewed: boolean;
  observed?: {
    aafkPresent: boolean | "uncertain";
    opponent: {
      name: string;
      clubId: string;
      confidence: "high" | "medium" | "low";
    };
    seniorAteam: boolean | "uncertain";
    score: {
      aafk: number;
      opponent: number;
      confidence: "high" | "medium" | "low";
    };
    matchDate: {
      value: string;
      confidence: "high" | "medium" | "low";
    };
    dateEvidence?: {
      type: "explicit_date" | "yesterday_reference" | "weekday_reference" | "fixture_plus_report" | "other";
      textSummary: string;
    };
    homeAway: "home" | "away" | "neutral" | "unknown";
    competition: {
      value: string;
      competitionId: string | null;
      confidence: "high" | "medium" | "low";
    };
    evidenceType: "report" | "result_board" | "retrospective" | "preview" | "fixture" | "unrelated" | "other";
  };
  visualEvidenceSummary?: string;
}

export type ClaimResolution =
  | "exact_match"
  | "exact_sibling"
  | "same_event_score_conflict"
  | "sibling_group_only"
  | "different_event"
  | "non_senior"
  | "insufficient";

export type CanonicalEligibility =
  | "ready"
  | "score_conflict"
  | "date_uncertain"
  | "opponent_uncertain"
  | "home_away_uncertain"
  | "competition_uncertain"
  | "non_senior"
  | "insufficient";

export interface VisualReviewCase {
  hypothesisId: string;
  season: number;
  isSingleton: boolean;
  reviewStatus: "visually_reviewed_pilot" | "unreviewed_awaiting_visual_batch";
  siblingGroup?: {
    id: string;
    size: number;
  };
  sourceResults: Array<{
    sourceId: string;
    no: number;
    opponent: string;
    expectedScore: { aafk: number; opponent: number };
  }>;
  reviewedCandidates: ReviewedCandidate[];
  claimResolution: ClaimResolution;
  matchedSourceResult?: {
    sourceId: string;
    no: number;
  };
  canonicalEligibility: CanonicalEligibility;
  notes?: string;
}

export interface SecondPassAuditEntry {
  hypothesisId: string;
  season: number;
  isSingleton: boolean;
  candidateId: string;
  firstPass: {
    claimResolution: ClaimResolution;
    canonicalEligibility: CanonicalEligibility;
  };
  secondPass: {
    claimResolution: ClaimResolution;
    canonicalEligibility: CanonicalEligibility;
    visuallyReviewed: boolean;
    notes: string;
  };
  agreed: boolean;
  adjudication?: {
    field: string;
    firstPass: CanonicalEligibility;
    secondPass: CanonicalEligibility;
    final: CanonicalEligibility;
    evidenceBasis: string;
  };
}

/**
 * Validates and audits a visual review manifest without inventing facts.
 */
export async function auditVisualReviewManifest(): Promise<{
  manifestPath: string;
  summary: {
    totalHypotheses: number;
    visuallyReviewedPilotCases: number;
    unreviewedAwaitingBatch: number;
    exactMatchCount: number;
    exactSiblingCount: number;
    siblingGroupOnlyCount: number;
    scoreConflictCount: number;
    nonSeniorCount: number;
    wrongEventCount: number;
    insufficientCount: number;
    canonicalReadyCount: number;
    pilotVisualResolutionRate: number;
    secondPassAgreementRate: number;
  };
  errors: string[];
}> {
  const root = repoRoot();
  const manifestPath = `${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`;
  const candidatesPath = `${root}/data/discovery/nb-source-result-wide-candidates-1945-1984.yaml`;

  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = parseYaml(manifestRaw, { schema: "core" });

  const candidatesRaw = await readFile(candidatesPath, "utf8");
  const candidatesData = parseYaml(candidatesRaw, { schema: "core" });

  const archive = await loadArchive();
  const validClubIds = new Set(archive.clubs.map((c) => c.id));

  const validCandidateIds = new Set<string>();
  for (const h of candidatesData.hypotheses) {
    if (h.candidates) {
      for (const cand of h.candidates) {
        validCandidateIds.add(cand.candidateId);
      }
    }
  }

  const errors: string[] = [];
  const cases: VisualReviewCase[] = manifest.cases || [];

  // 1. Validate pilot selection stratification
  const pilotSel = manifest.pilotSelection;
  if (!pilotSel) {
    errors.push("Manifest is missing pilotSelection metadata");
  } else {
    if (pilotSel.periods?.["1945-1954"] !== 15) {
      errors.push(`Pilot selection period 1945-1954 expected 15, found ${pilotSel.periods?.["1945-1954"]}`);
    }
    if (pilotSel.periods?.["1955-1964"] !== 25) {
      errors.push(`Pilot selection period 1955-1964 expected 25, found ${pilotSel.periods?.["1955-1964"]}`);
    }
    if (pilotSel.periods?.["1965-1974"] !== 11) {
      errors.push(`Pilot selection period 1965-1974 expected 11, found ${pilotSel.periods?.["1965-1974"]}`);
    }
    if (pilotSel.periods?.["1975-1984"] !== 9) {
      errors.push(`Pilot selection period 1975-1984 expected 9, found ${pilotSel.periods?.["1975-1984"]}`);
    }
  }

  let visuallyReviewedCasesCount = 0;
  let exactMatchCount = 0;
  let exactSiblingCount = 0;
  let siblingGroupOnlyCount = 0;
  let scoreConflictCount = 0;
  let nonSeniorCount = 0;
  let wrongEventCount = 0;
  let insufficientCount = 0;
  let canonicalReadyCount = 0;

  for (const c of cases) {
    if (c.reviewStatus === "visually_reviewed_pilot") {
      visuallyReviewedCasesCount++;
    }

    if (c.claimResolution === "exact_match") exactMatchCount++;
    else if (c.claimResolution === "exact_sibling") exactSiblingCount++;
    else if (c.claimResolution === "sibling_group_only") siblingGroupOnlyCount++;
    else if (c.claimResolution === "same_event_score_conflict") scoreConflictCount++;
    else if (c.claimResolution === "non_senior") nonSeniorCount++;
    else if (c.claimResolution === "different_event") wrongEventCount++;
    else insufficientCount++;

    if (c.canonicalEligibility === "ready") {
      canonicalReadyCount++;

      // Hard gate checks:
      if (c.reviewedCandidates.length === 0) {
        errors.push(`Case ${c.hypothesisId} is marked ready but has no reviewed candidates`);
        continue;
      }

      const activeCand = c.reviewedCandidates[0];
      if (!activeCand) {
        errors.push(`Case ${c.hypothesisId} is marked ready but active candidate is undefined`);
        continue;
      }
      if (!activeCand.visuallyReviewed) {
        errors.push(`Case ${c.hypothesisId} is ready but candidate is not visuallyReviewed`);
      }
      if (!activeCand.observed) {
        errors.push(`Case ${c.hypothesisId} is ready but lacks observed object`);
        continue;
      }

      const obs = activeCand.observed;
      if (obs.seniorAteam !== true) {
        errors.push(`Case ${c.hypothesisId} is ready but seniorAteam is ${obs.seniorAteam}`);
      }
      if (obs.opponent.confidence !== "high") {
        errors.push(`Case ${c.hypothesisId} is ready but opponent confidence is ${obs.opponent.confidence}`);
      }
      // Validate opponent clubId against canonical clubs
      if (!validClubIds.has(obs.opponent.clubId)) {
        errors.push(`Case ${c.hypothesisId} is ready but clubId '${obs.opponent.clubId}' does not exist in canonical archive clubs`);
      }
      if (obs.score.confidence !== "high") {
        errors.push(`Case ${c.hypothesisId} is ready but score confidence is ${obs.score.confidence}`);
      }
      if (obs.matchDate.confidence !== "high") {
        errors.push(`Case ${c.hypothesisId} is ready but matchDate confidence is ${obs.matchDate.confidence}`);
      }
      // Date evidence validation
      if (!obs.dateEvidence || !obs.dateEvidence.textSummary) {
        errors.push(`Case ${c.hypothesisId} is ready with high confidence date but lacks dateEvidence`);
      }
      if (obs.matchDate.value === activeCand.newspaper.issueDate && obs.dateEvidence?.type !== "explicit_date") {
        errors.push(`Case ${c.hypothesisId} has matchDate equal to issueDate without explicit dateEvidence`);
      }
      if (obs.homeAway === "unknown") {
        errors.push(`Case ${c.hypothesisId} is ready but homeAway is unknown`);
      }
      if (!obs.competition.competitionId || obs.competition.confidence !== "high") {
        errors.push(`Case ${c.hypothesisId} is ready but competition is invalid or not high confidence`);
      }
      if (!activeCand.visualEvidenceSummary || activeCand.visualEvidenceSummary.length < 15) {
        errors.push(`Case ${c.hypothesisId} is ready but has inadequate visualEvidenceSummary`);
      }
    }

    // Verify candidateIds exist in PR #198 retrieval
    for (const cand of c.reviewedCandidates) {
      if (!validCandidateIds.has(cand.candidateId)) {
        errors.push(`Candidate ${cand.candidateId} in case ${c.hypothesisId} does not exist in retrieval manifest`);
      }
    }

    // Verify sibling match integrity
    if (c.claimResolution === "exact_sibling") {
      if (!c.matchedSourceResult) {
        errors.push(`Case ${c.hypothesisId} is exact_sibling but lacks matchedSourceResult`);
      } else {
        const found = c.sourceResults.some(
          (sr) => sr.sourceId === c.matchedSourceResult!.sourceId && sr.no === c.matchedSourceResult!.no,
        );
        if (!found) {
          errors.push(`Case ${c.hypothesisId} matchedSourceResult does not belong to hypothesis sourceResults`);
        }
      }
    }
  }

  // 2. Validate second-pass audit coverage
  const secondPassAudit = manifest.secondPassAudit;
  if (secondPassAudit) {
    const p1Count = secondPassAudit.cases.filter((s: SecondPassAuditEntry) => s.season >= 1945 && s.season <= 1954).length;
    const p2Count = secondPassAudit.cases.filter((s: SecondPassAuditEntry) => s.season >= 1955 && s.season <= 1964).length;
    const p3Count = secondPassAudit.cases.filter((s: SecondPassAuditEntry) => s.season >= 1965 && s.season <= 1974).length;
    const p4Count = secondPassAudit.cases.filter((s: SecondPassAuditEntry) => s.season >= 1975 && s.season <= 1984).length;

    if (p1Count === 0 || p2Count === 0 || p3Count === 0 || p4Count === 0) {
      errors.push(`Second-pass audit does not cover all 4 periods: P1=${p1Count}, P2=${p2Count}, P3=${p3Count}, P4=${p4Count}`);
    }

    for (const entry of secondPassAudit.cases) {
      if (!entry.agreed && !entry.adjudication) {
        errors.push(`Second-pass disagreement on ${entry.hypothesisId} is not adjudicated or propagated`);
      }
    }
  }

  const summary = {
    totalHypotheses: cases.length,
    visuallyReviewedPilotCases: visuallyReviewedCasesCount,
    unreviewedAwaitingBatch: cases.length - visuallyReviewedCasesCount,
    exactMatchCount,
    exactSiblingCount,
    siblingGroupOnlyCount,
    scoreConflictCount,
    nonSeniorCount,
    wrongEventCount,
    insufficientCount,
    canonicalReadyCount,
    pilotVisualResolutionRate: visuallyReviewedCasesCount > 0
      ? Number(((exactMatchCount + exactSiblingCount) / visuallyReviewedCasesCount).toFixed(4))
      : 0,
    secondPassAgreementRate: secondPassAudit?.agreementRate ?? 0,
  };

  return { manifestPath, summary, errors };
}

async function main() {
  console.log("Auditing visual review manifest (1945-1984)...");
  const { manifestPath, summary, errors } = await auditVisualReviewManifest();
  console.log(`Manifest: ${manifestPath}`);
  console.log("Summary:", JSON.stringify(summary, null, 2));
  if (errors.length > 0) {
    console.error(`\nFound ${errors.length} validation errors:`);
    for (const err of errors.slice(0, 10)) console.error(` - ${err}`);
    process.exit(1);
  } else {
    console.log("\n✓ Visual review manifest passed all validation and integrity gates.");
  }
}

if (process.argv[1]?.endsWith("nb-visual-review-1945-1984.ts")) {
  main().catch(console.error);
}
