import { describe, expect, it } from "vitest";
import { buildDiscoveryClosureStatus } from "../src/historical/discovery-closure.js";

describe("autoritativ discovery closure-ledger", () => {
  it("avstemmer PR198 og etablerer entydige sluttkøer", async () => {
    const report = await buildDiscoveryClosureStatus();

    expect(report.decisionGate).toBe("DISCOVERY_CLOSURE_QUEUE_ESTABLISHED");
    expect(report.baseline.pr198).toEqual({
      totalHypotheses: 636,
      candidateCovered: 626,
      uncovered: 10,
      candidatePages: 2438,
    });
    expect(report.entries.filter((entry) => entry.discoveryOrigins.includes("pr198_wide_retrieval"))).toHaveLength(636);
    expect(report.integrity.orphanDiscoveryReferences).toEqual([]);
    expect(report.integrity.ambiguousInternalState).toEqual([]);
    expect(report.integrity.duplicatePrimarySourceClaimIds).toEqual([]);
    expect(report.integrity.duplicateReviewAssignments).toEqual([]);
    expect(report.totals.trueVisualReviewed).toBe(122);
    expect(report.totals.legacyAiReviewed).toBe(247);

    const queued = [
      ...report.closureQueue.needsVisualReview,
      ...report.closureQueue.requiresRevalidation,
      ...report.closureQueue.readyForCanonicalization,
      ...report.closureQueue.terminal,
    ];
    expect(new Set(queued).size).toBe(report.entries.length);
    expect(queued).toHaveLength(report.entries.length);
  }, 30_000);

  it("regner PR205-invalidering fra claim og review-koordinat", async () => {
    const report = await buildDiscoveryClosureStatus();
    const stale = report.entries.filter((entry) => entry.review.status === "stale_review");

    expect(stale).toHaveLength(17);
    expect(stale.every((entry) => entry.review.validity === "requires_revalidation")).toBe(true);
    expect(stale.every((entry) => entry.review.sourceCoordinateAtReview?.season !== entry.currentCoordinate.season)).toBe(true);
    expect(report.closureQueue.bySelection.pilot.requiresRevalidation).toHaveLength(17);

    const wave2 = report.entries.filter((entry) => entry.selection === "wave2");
    expect(wave2.filter((entry) => entry.currentCoordinate.season >= 1945 && entry.currentCoordinate.season <= 1954)).toHaveLength(67);
    expect(wave2.filter((entry) => entry.currentCoordinate.season >= 1955 && entry.currentCoordinate.season <= 1964)).toHaveLength(100);
    expect(wave2.filter((entry) => entry.currentCoordinate.season >= 1965 && entry.currentCoordinate.season <= 1974)).toHaveLength(16);
    // To tidligere ukoblede Wave 2-påstander er nå koblet til kanoniske kamper
    // fra medlemsbladene i PR #216 og skal derfor ikke bli liggende i review-køen.
    expect(report.closureQueue.bySelection.wave2.needsVisualReview).toHaveLength(119);
  }, 30_000);
});
