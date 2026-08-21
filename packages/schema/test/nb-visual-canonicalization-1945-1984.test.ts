import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../src/load.js";
import { buildCanonicalPlan, CanonicalizationResult } from "../../../packages/ingest/src/cli/nb-visual-canonicalization-1945-1984.js";

describe("NB Visual Review Canonicalization (1945-1984) - PR 200", () => {
  let plan: CanonicalizationResult;

  beforeAll(async () => {
    const res = await buildCanonicalPlan();
    plan = res.plan;
  }, 30000);

  it("enforces that canonical plan only admits canonicalEligibility: ready and rejects all other states", () => {
    expect(plan.contract).toBe("nb-source-result-canonicalization@1");
    expect(plan.summary.pr199ReadyInput).toBe(25);
    expect(plan.summary.skippedInvalid).toBe(1);
    expect(plan.summary.newClubs).toBe(0);
    expect(plan.summary.canonicalMatchesDeleted).toBe(0);
    expect(plan.accounting.total).toBe(25);
    expect(plan.accounting.invalid_input).toBe(1);

    for (const item of plan.items) {
      expect(item.canonicalEligibility).toBe("ready");
      expect(["create_match", "enrich_existing_match", "already_present", "invalid_input"]).toContain(item.action);
      if (item.action !== "invalid_input") {
        expect(item.proposedMatchId).toBeTruthy();
        expect(item.observedEvent).toBeDefined();
        expect(item.observedEvent?.score).toBeDefined();
        expect(item.observedEvent?.matchDate).toBeDefined();
        expect(item.observedEvent?.opponentClubId).toBeDefined();
        expect(item.observedEvent?.competitionId).toBeDefined();
      }
    }
  });

  it("regression: Rollon 1954 score_conflict is NEVER canonicalized", async () => {
    const rollon1954 = plan.items.find((i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1954-007");
    expect(rollon1954).toBeUndefined();

    // Check raw visual review manifest directly
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });
    const caseObj = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1954-007");
    expect(caseObj.canonicalEligibility).toBe("score_conflict");
  });

  it("regression: Rollon 1955 #9 (competition_conflict) and #13 (insufficient) are NEVER canonicalized", () => {
    const rollon9 = plan.items.find((i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-009");
    const rollon13 = plan.items.find((i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-013");
    expect(rollon9).toBeUndefined();
    expect(rollon13).toBeUndefined();
  });

  it("regression: Herd 1965 #8 (insufficient) is rejected while #1 (ready) is canonicalized", () => {
    const herd8 = plan.items.find((i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1965-008");
    const herd1 = plan.items.find((i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1965-001");
    expect(herd8).toBeUndefined();
    expect(herd1).toBeDefined();
    expect(herd1?.canonicalEligibility).toBe("ready");
    expect(herd1?.observedEvent?.opponentClubId).toBe("herd");
  });

  it("negative gate test: rejects non-ready cases even if observed attributes look complete", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const nonReady = manifest.cases.filter((c: any) => c.canonicalEligibility !== "ready");
    expect(nonReady.length).toBe(611); // 636 total - 25 ready = 611

    const canonicalHypothesisIds = new Set(plan.items.map((i) => i.hypothesisId));

    for (const nr of nonReady) {
      expect(canonicalHypothesisIds.has(nr.hypothesisId)).toBe(false);
    }
  });

  it("verifies no raw OCR fields exist in canonical artifacts or discovery manifest", async () => {
    const root = repoRoot();
    const manifestPath = `${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`;
    const manifestRaw = await readFile(manifestPath, "utf8");

    // Check for forbidden OCR properties
    expect(manifestRaw).not.toContain("rawOcr:");
    expect(manifestRaw).not.toContain("fullText:");
    expect(manifestRaw).not.toContain("alto:");
  });

  it("validates community rest queue classification", () => {
    const queue = plan.communityRestQueue;
    expect(queue.candidateCount).toBe(23);
    expect(queue.summary.sibling_resolution).toBe(20);
    expect(queue.summary.score_conflict).toBe(1);
    expect(queue.summary.competition_conflict).toBe(1);
    expect(queue.summary.date_research).toBe(1);
    expect(queue.nonCommunityCount).toBe(588);
    expect(queue.summary.non_senior).toBe(2);
    expect(queue.summary.different_event).toBe(10);
    expect(queue.summary.unreviewed_awaiting_visual_batch).toBe(576);
  });
});
