import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { parseArchiveYaml as parseYaml } from "../src/yaml.js";
import { repoRoot } from "../src/load.js";
import {
  buildCanonicalPlan,
  extractActualVisualSource,
  CanonicalizationResult,
} from "../../../packages/ingest/src/cli/nb-visual-canonicalization-1945-1984.js";

describe("NB Visual Review Canonicalization (1945-1984) - PR 200", () => {
  let plan: CanonicalizationResult;

  beforeAll(async () => {
    const res = await buildCanonicalPlan();
    plan = res.plan;
  }, 60000);

  it("enforces that canonical plan only admits canonicalEligibility: ready and rejects all other states", () => {
    expect(plan.contract).toBe("nb-source-result-canonicalization@1");
    expect(plan.summary.pr199ReadyInput).toBe(25);
    expect(plan.summary.skippedInvalid).toBe(12); // 11 shifted 1955 claims + 1 1976 conflict
    expect(plan.summary.newClubs).toBe(0);
    expect(plan.summary.canonicalMatchesDeleted).toBe(0);
    expect(plan.accounting.total).toBe(25);
    expect(plan.accounting.invalid_input).toBe(12);

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

  it("A & B: source opponent and score mismatch in 1976 #2 is blocked with detailed conflicts", () => {
    const case1976 = plan.items.find((i) => i.hypothesisId === "sunnmore-fotballkrets-arsrapport-1976#1976-002");
    expect(case1976).toBeDefined();
    expect(case1976?.action).toBe("invalid_input");
    expect(case1976?.conflictReason).toContain("opponent_conflict");
    expect(case1976?.conflictReason).toContain("score_conflict");
  });

  it("D & E: handles actualVisualSource distinction from candidate metadata and viewerPage vs printedPage", () => {
    const traeffCase = plan.items.find((i) => i.hypothesisId === "sunnmore-fotballkrets-arsrapport-1975#1975-001");
    expect(traeffCase).toBeDefined();
    expect(traeffCase?.actualVisualSource).toBeDefined();
    expect(traeffCase?.actualVisualSource?.issueDate).toBe("1975-05-30");
    expect(traeffCase?.actualVisualSource?.printedPage).toBe("7");
    expect(traeffCase?.actualVisualSource?.viewerPage).toBe("6");
    expect(traeffCase?.actualVisualSource?.pageUrl).toContain("page=6");

    // Test extraction logic directly
    const mockCand = {
      newspaper: {
        title: "Sunnmørsposten",
        issueDate: "1975-05-29",
        page: 6,
        pageUrl: "https://www.nb.no/items/abc?page=6",
      },
      visualEvidenceSummary: "Sunnmørsposten 30.05.1975 s. 7: Kampreferat.",
      observed: {
        dateEvidence: {
          textSummary: "Sunnmørsposten 30.05.1975 s. 7: NM 1. runde.",
        },
      },
    };
    const actual = extractActualVisualSource(mockCand);
    expect(actual.issueDate).toBe("1975-05-30");
    expect(actual.printedPage).toBe("7");
    expect(actual.viewerPage).toBe("6");
  });

  it("F: observation re-apply gives 0 new writes on clean rerun", () => {
    expect(plan.idempotencyCheck.observationsCreated).toBe(0);
    expect(plan.idempotencyCheck.created).toBe(0);
    expect(plan.summary.alreadyPresent + plan.summary.existingMatchesEnriched).toBe(13);
    expect(plan.idempotencyCheck.filesWritten).toBe(plan.summary.existingMatchesEnriched);
  });

  it("G: canonicalization manifest preserves initial application record alongside idempotency check", () => {
    expect(plan.application.readyInput).toBe(25);
    expect(plan.application.created).toBe(24);
    expect(plan.application.invalid).toBe(1);
    expect(plan.application.sourceResultsLinked).toBe(24);
    expect(plan.application.observationsCreated).toBe(24);
  });

  it("H: invalid ready cases are routed to community rest queue under source_reconciliation", () => {
    const queue = plan.communityRestQueue;
    expect(queue.candidateCount).toBe(35); // 24 original candidates + 11 newly invalidated 1955 claims
    expect(queue.summary.source_reconciliation).toBe(12);
    expect(queue.summary.sibling_resolution).toBe(20);
    expect(queue.summary.score_conflict).toBe(1);
    expect(queue.summary.competition_conflict).toBe(1);
    expect(queue.summary.date_research).toBe(1);
    expect(queue.nonCommunityCount).toBe(588);
  });

  it("regression: Rollon 1954 score_conflict is NEVER canonicalized", async () => {
    const rollon1954 = plan.items.find((i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1954-007");
    expect(rollon1954).toBeUndefined();

    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw);
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
    const manifest = parseYaml(manifestRaw);

    const pilotNonReady = manifest.cases.filter((c: any) => c.reviewStatus === "visually_reviewed_pilot" && c.canonicalEligibility !== "ready");
    expect(pilotNonReady.length).toBe(35); // 60 pilot total - 25 ready = 35

    const canonicalHypothesisIds = new Set(plan.items.map((i) => i.hypothesisId));

    for (const nr of pilotNonReady) {
      expect(canonicalHypothesisIds.has(nr.hypothesisId)).toBe(false);
    }
  });

  it("verifies no raw OCR fields exist in canonical artifacts or discovery manifest", async () => {
    const root = repoRoot();
    const manifestPath = `${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`;
    const manifestRaw = await readFile(manifestPath, "utf8");

    expect(manifestRaw).not.toContain("rawOcr:");
    expect(manifestRaw).not.toContain("fullText:");
    expect(manifestRaw).not.toContain("alto:");
  });
});
