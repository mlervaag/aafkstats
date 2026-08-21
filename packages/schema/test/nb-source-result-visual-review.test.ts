import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../src/load.js";

describe("NB Source-Result Visual Review (1945-1984)", () => {
  it("validates that visual review manifest adheres to contract nb-source-result-visual-review@1 and decision gate TRUE_VISUAL_PIPELINE_VALIDATED", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    expect(manifest.contract).toBe("nb-source-result-visual-review@1");
    expect(manifest.decisionGate).toBe("TRUE_VISUAL_PIPELINE_VALIDATED");
    expect(manifest.cases.length).toBe(636);
    expect(manifest.scope.visuallyReviewedPilotCases).toBe(60);
    expect(manifest.scope.unreviewedAwaitingBatch).toBe(576);
  });

  it("enforces strict canonical eligibility gates for every ready claim", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const readyCases = manifest.cases.filter((c: any) => c.canonicalEligibility === "ready");
    expect(readyCases.length).toBe(40);

    for (const c of readyCases) {
      expect(c.reviewStatus).toBe("visually_reviewed_pilot");
      expect(c.reviewedCandidates.length).toBeGreaterThan(0);
      const activeCand = c.reviewedCandidates[0];
      expect(activeCand.visuallyReviewed).toBe(true);

      const obs = activeCand.observed;
      expect(obs).toBeDefined();
      expect(obs.seniorAteam).toBe(true);
      expect(obs.opponent.confidence).toBe("high");
      expect(obs.score.confidence).toBe("high");
      expect(obs.matchDate.confidence).toBe("high");
      expect(["home", "away", "neutral"]).toContain(obs.homeAway);
      expect(obs.competition.competitionId).not.toBeNull();
      expect(obs.competition.confidence).toBe("high");
      expect(["exact_match", "exact_sibling"]).toContain(c.claimResolution);
      expect(activeCand.visualEvidenceSummary?.length).toBeGreaterThan(10);
    }
  });

  it("ensures unreviewed cases and non_senior/sibling_group_only are never canonical ready", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    for (const c of manifest.cases) {
      if (c.reviewStatus === "unreviewed_awaiting_visual_batch") {
        expect(c.canonicalEligibility).toBe("insufficient");
        expect(c.claimResolution).toBe("insufficient");
        expect(c.reviewedCandidates.length).toBe(0);
      }
      if (c.claimResolution === "non_senior") {
        expect(c.canonicalEligibility).toBe("non_senior");
      }
      if (c.claimResolution === "sibling_group_only") {
        expect(c.canonicalEligibility).not.toBe("ready");
      }
    }
  });

  it("ensures exact_sibling requires matchedSourceResult belonging to the sibling group", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const exactSiblingCases = manifest.cases.filter((c: any) => c.claimResolution === "exact_sibling");
    expect(exactSiblingCases.length).toBe(20);

    for (const c of exactSiblingCases) {
      expect(c.matchedSourceResult).toBeDefined();
      expect(c.matchedSourceResult.sourceId).toBeTruthy();
      expect(c.matchedSourceResult.no).toBeGreaterThan(0);

      const foundInGroup = c.sourceResults.some(
        (sr: any) => sr.sourceId === c.matchedSourceResult.sourceId && sr.no === c.matchedSourceResult.no,
      );
      expect(foundInGroup).toBe(true);
    }
  });

  it("verifies candidateId integrity and prevents raw OCR or unauthenticated NB URLs", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const retrievalRaw = await readFile(`${root}/data/discovery/nb-source-result-wide-candidates-1945-1984.yaml`, "utf8");
    const retrieval = parseYaml(retrievalRaw, { schema: "core" });

    const validCandidateIds = new Set<string>();
    for (const h of retrieval.hypotheses) {
      if (h.candidates) {
        for (const cand of h.candidates) {
          validCandidateIds.add(cand.candidateId);
        }
      }
    }

    for (const c of manifest.cases) {
      for (const cand of c.reviewedCandidates) {
        expect(validCandidateIds.has(cand.candidateId)).toBe(true);
        expect(cand.newspaper.pageUrl).toMatch(/^https:\/\/www\.nb\.no\/items\/[a-f0-9]+(\?page=\d+)?$/);

        // Disallow fullText / raw OCR fields
        expect((cand as any).ocrText).toBeUndefined();
        expect((cand as any).fullText).toBeUndefined();
        expect((cand as any).rawText).toBeUndefined();
      }
    }
  });

  it("verifies that second pass audit covers 30 cases across periods and reports honest agreement rate", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    expect(manifest.secondPassAudit).toBeDefined();
    expect(manifest.secondPassAudit.sampleSize).toBe(30);
    expect(manifest.secondPassAudit.cases.length).toBe(30);
    expect(manifest.secondPassAudit.agreementRate).toBeGreaterThan(0.9);
    expect(manifest.secondPassAudit.agreementRate).toBeLessThanOrEqual(1.0);
  });
});
