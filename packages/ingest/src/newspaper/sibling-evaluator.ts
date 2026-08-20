import { parse } from "yaml";
import { readFileSync } from "fs";
import type { Archive } from "@aafkstats/schema/load";
import { withSiblings, buildHypotheses, type SourceResultQuery } from "./source-result-query.js";
import { createIssueCache, discoverForGroup, type IssueCache, type SiblingDiscoveryResult } from "./discovery.js";





export interface SiblingPilotHypothesisFixture {
  id: string;
  no: number;
  expectedAllocation: "exact" | "unresolved" | "unverified";
  expectedDate?: string;
  reviewReason?: string;
}

export interface SiblingPilotGroupFixture {
  groupKey: string;
  sourceId: string;
  season: number;
  opponent: string;
  notes?: string;
  hypotheses: SiblingPilotHypothesisFixture[];
}

export interface SiblingPilotManifest {
  version: number;
  description?: string;
  totalGroups?: number;
  totalHypotheses?: number;
  groups: SiblingPilotGroupFixture[];
}


export interface HypothesisEvaluationResult {
  hypothesisId: string;
  no: number;
  expectedAllocation: "exact" | "unresolved" | "unverified";
  expectedDate?: string;
  allocatedEventId?: string;
  allocatedDate?: string;
  confidence: "high" | "medium" | "low";
  margin: number;
  status: string;
  classification: "exact_correct" | "correctly_rejected" | "incorrect" | "unverified";
  isFalseHighConfidence: boolean;
}

export interface GroupEvaluationResult {
  groupKey: string;
  hypotheses: HypothesisEvaluationResult[];
  classification: "fully_correct" | "partially_correct" | "failed" | "unverified";
}

export interface PilotEvaluationReport {
  totalGroups: number;
  totalHypotheses: number;
  exactCorrectAllocations: number;
  incorrectAllocations: number;
  correctlyRejectedAllocations: number;
  falseHighConfidenceAllocations: number;
  unverifiedAllocations: number;
  fullyCorrectGroups: number;
  partiallyCorrectGroups: number;
  failedGroups: number;
  unverifiedGroups: number;
  groups: GroupEvaluationResult[];
}

/**
 * Laster og validerer pilot-manifestet fra disk.
 */
export function loadSiblingPilotManifest(filePath: string): SiblingPilotManifest {
  const content = readFileSync(filePath, "utf8");
  const data = parse(content) as SiblingPilotManifest;

  if (!data.groups || !Array.isArray(data.groups)) {
    throw new Error(`Ugyldig pilot-manifest i ${filePath}: mangler groups-array`);
  }

  // Valider unike ID-er på tvers av alle hypoteser
  const seenIds = new Set<string>();
  let hypothesisCount = 0;
  for (const group of data.groups) {
    for (const h of group.hypotheses) {
      if (seenIds.has(h.id)) {
        throw new Error(`Duplikat hypotese-ID i pilot-manifest: ${h.id}`);
      }
      seenIds.add(h.id);
      hypothesisCount++;
    }
  }

  if (data.totalHypotheses !== undefined && data.totalHypotheses !== hypothesisCount) {
    throw new Error(`Uoverensstemmelse i antall hypoteser: manifest oppgir ${data.totalHypotheses}, fant ${hypothesisCount}`);
  }

  return data;
}

/**
 * Evaluerer en gruppes oppdagelsesresultater mot forventet fasit.
 */
export function evaluateGroupResults(
  groupFixture: SiblingPilotGroupFixture,
  results: Map<string, SiblingDiscoveryResult>,
): GroupEvaluationResult {
  const evaluatedHypotheses: HypothesisEvaluationResult[] = [];
  let correctCount = 0;
  let incorrectCount = 0;
  let verifiedCount = 0;

  for (const hFixture of groupFixture.hypotheses) {
    const res = results.get(hFixture.id);
    const allocatedEventId = res?.allocation.eventId;
    const allocatedDate = res?.event?.inferredDate;
    const confidence = res?.allocation.confidence ?? "low";
    const margin = res?.allocation.margin ?? 0;
    const status = res?.status ?? "not_found";

    let classification: HypothesisEvaluationResult["classification"];
    let isFalseHighConfidence = false;

    if (hFixture.expectedAllocation === "exact") {
      verifiedCount++;
      if (allocatedDate === hFixture.expectedDate) {
        classification = "exact_correct";
        correctCount++;
      } else {
        classification = "incorrect";
        incorrectCount++;
        if (confidence === "high") isFalseHighConfidence = true;
      }
    } else if (hFixture.expectedAllocation === "unresolved") {
      verifiedCount++;
      if (allocatedEventId === undefined) {
        classification = "correctly_rejected";
        correctCount++;
      } else {
        classification = "incorrect";
        incorrectCount++;
        if (confidence === "high") isFalseHighConfidence = true;
      }
    } else {
      classification = "unverified";
    }

    evaluatedHypotheses.push({
      hypothesisId: hFixture.id,
      no: hFixture.no,
      expectedAllocation: hFixture.expectedAllocation,
      expectedDate: hFixture.expectedDate,
      allocatedEventId,
      allocatedDate,
      confidence,
      margin,
      status,
      classification,
      isFalseHighConfidence,
    });
  }

  let groupClassification: GroupEvaluationResult["classification"];
  if (verifiedCount === 0) {
    groupClassification = "unverified";
  } else if (incorrectCount === 0) {
    groupClassification = "fully_correct";
  } else if (correctCount > 0) {
    groupClassification = "partially_correct";
  } else {
    groupClassification = "failed";
  }

  return {
    groupKey: groupFixture.groupKey,
    hypotheses: evaluatedHypotheses,
    classification: groupClassification,
  };
}

/**
 * Kjører full evaluering av alle grupper i manifestet.
 */
export async function evaluateSiblingPilot(
  archive: Archive,
  manifestPath: string,
  options?: { cache?: IssueCache },
): Promise<PilotEvaluationReport> {

  const manifest = loadSiblingPilotManifest(manifestPath);
  const cache = options?.cache ?? createIssueCache();

  const groupResults: GroupEvaluationResult[] = [];
  let exactCorrectAllocations = 0;
  let incorrectAllocations = 0;
  let correctlyRejectedAllocations = 0;
  let falseHighConfidenceAllocations = 0;
  let unverifiedAllocations = 0;
  let fullyCorrectGroups = 0;
  let partiallyCorrectGroups = 0;
  let failedGroups = 0;
  let unverifiedGroups = 0;

  for (const groupFixture of manifest.groups) {
    const season = Number(groupFixture.groupKey.split("|")[0]);
    const sourceId = groupFixture.sourceId ?? "medlemsblad-for-aalesunds-fotb-1965-a2c9";
    let matchedGroup: SourceResultQuery[] | null = null;
    for (const [key, g] of withSiblings(archive, {


      sourceId,
      fromYear: season,
      toYear: season,
      unlinkedOnly: true,
    })) {
      if (key === groupFixture.groupKey) {
        matchedGroup = g;
        break;
      }
    }



    if (!matchedGroup) {
      throw new Error(`Fant ikke søskengruppe ${groupFixture.groupKey} i arkivet`);
    }

    const hypotheses = buildHypotheses(matchedGroup);
    const results = await discoverForGroup(hypotheses, { cache });
    const evaluatedGroup = evaluateGroupResults(groupFixture, results);
    groupResults.push(evaluatedGroup);

    for (const h of evaluatedGroup.hypotheses) {
      if (h.classification === "exact_correct") exactCorrectAllocations++;
      else if (h.classification === "correctly_rejected") correctlyRejectedAllocations++;
      else if (h.classification === "incorrect") incorrectAllocations++;
      else if (h.classification === "unverified") unverifiedAllocations++;

      if (h.isFalseHighConfidence) falseHighConfidenceAllocations++;
    }

    if (evaluatedGroup.classification === "fully_correct") fullyCorrectGroups++;
    else if (evaluatedGroup.classification === "partially_correct") partiallyCorrectGroups++;
    else if (evaluatedGroup.classification === "failed") failedGroups++;
    else if (evaluatedGroup.classification === "unverified") unverifiedGroups++;
  }

  return {
    totalGroups: manifest.groups.length,
    totalHypotheses: manifest.totalHypotheses ?? manifest.groups.reduce((acc, g) => acc + g.hypotheses.length, 0),
    exactCorrectAllocations,
    incorrectAllocations,
    correctlyRejectedAllocations,
    falseHighConfidenceAllocations,
    unverifiedAllocations,
    fullyCorrectGroups,
    partiallyCorrectGroups,
    failedGroups,
    unverifiedGroups,
    groups: groupResults,
  };

}
