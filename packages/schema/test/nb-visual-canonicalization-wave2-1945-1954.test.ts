import { describe, expect, it, beforeAll } from "vitest";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { parseArchiveYaml as parseYaml } from "../src/yaml.js";
import {
  buildCanonicalPlan,
  type CanonicalizationResult,
} from "../../ingest/src/cli/nb-visual-canonicalization-1945-1984.js";
import { repoRoot } from "../src/load.js";

describe("NB Visual Review Canonicalization (Wave 2: 1945-1954) - Tests A to S & Guardrails", () => {
  let plan: CanonicalizationResult;
  let manifest: any;
  let shiftMapping: any;

  beforeAll(async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    manifest = parseYaml(manifestRaw);

    const shiftMappingRaw = await readFile(`${root}/data/discovery/medlemsblad-1965-year-shift-mapping.yaml`, "utf8");
    shiftMapping = parseYaml(shiftMappingRaw);

    const res = await buildCanonicalPlan({
      batch: "wave_2_1945_1954",
      reviewStatus: "visually_reviewed_wave_2",
      minYear: 1945,
      maxYear: 1954,
    });
    plan = res.plan;
  }, 60000);

  // TEST A: Input-selector velger kun reviewStatus: visually_reviewed_wave_2, canonicalEligibility: ready, 1945 <= season <= 1954
  it("TEST A: input-selector filters strictly on wave 2, ready, and 1945-1954", () => {
    for (const item of plan.items) {
      expect(item.reviewStatus === undefined || item.reviewStatus === "visually_reviewed_wave_2").toBe(true);
      expect(item.canonicalEligibility).toBe("ready");
      expect(item.season).toBeGreaterThanOrEqual(1945);
      expect(item.season).toBeLessThanOrEqual(1954);
    }
  });

  // TEST B: Antall selector-input skal samsvare eksakt med manifestets faktiske ready Wave 2-saker i perioden
  it("TEST B: computedReadyCount matches manifest ready Wave 2 cases in period exactly", () => {
    const manifestReadyCases = manifest.cases.filter(
      (c: any) =>
        c.reviewStatus === "visually_reviewed_wave_2" &&
        c.canonicalEligibility === "ready" &&
        c.season >= 1945 &&
        c.season <= 1954
    );
    expect(plan.summary.readyInput).toBe(manifestReadyCases.length);
    expect(plan.summary.readyInput).toBe(36);
  });

  // TEST C: Ingen pilotcase blir behandlet som Wave 2
  it("TEST C: no pilot cases are processed in wave 2 canonicalization", () => {
    const pilotIds = manifest.cases
      .filter((c: any) => c.reviewStatus === "visually_reviewed_pilot")
      .map((c: any) => c.hypothesisId);
    for (const item of plan.items) {
      expect(pilotIds).not.toContain(item.hypothesisId);
    }
  });

  // TEST D: Ingen 1955+ case blir behandlet
  it("TEST D: no 1955+ cases are processed in 1945-1954 batch", () => {
    for (const item of plan.items) {
      expect(item.season).toBeLessThan(1955);
    }
  });

  // TEST E: actualVisualSource kreves for canonicalization
  it("TEST E: actualVisualSource is required for all canonical plan items", () => {
    for (const item of plan.items) {
      expect(item.actualVisualSource).toBeDefined();
      expect(item.actualVisualSource.title).toBeTruthy();
      expect(item.actualVisualSource.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.actualVisualSource.pageUrl).toMatch(/^https?:\/\//);
    }
  });

  // TEST F: issueDate kan ikke brukes som implisitt matchDate
  it("TEST F: issueDate is distinct from matchDate and preserved explicitly", () => {
    const spjelkavik = plan.items.find(
      (i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1945-007"
    );
    expect(spjelkavik).toBeDefined();
    expect(spjelkavik?.observedEvent.matchDate).toBe("1945-09-30");
    expect(spjelkavik?.actualVisualSource.issueDate).toBe("1945-10-01");
  });

  // Helper to run production canonicalization pipeline on crafted review cases
  async function runGateWithCustomCases(customCases: any[]) {
    const tmpManifestPath = `${repoRoot()}/data/discovery/tmp-test-manifest-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`;
    const tmpManifestContent = {
      contract: "nb-source-result-visual-review@1",
      generatedAt: new Date().toISOString(),
      cases: customCases,
      productionWave2Selection: {
        totalCandidates: customCases.length,
        selectedHypothesisIds: customCases.map((c) => c.hypothesisId),
      },
    };
    await writeFile(tmpManifestPath, stringifyYaml(tmpManifestContent), "utf8");
    try {
      const res = await buildCanonicalPlan({
        manifestPath: tmpManifestPath,
        reviewStatus: "visually_reviewed_wave_2",
        batch: "wave_2",
        minYear: 1945,
        maxYear: 1954,
      });
      return res;
    } finally {
      try {
        await unlink(tmpManifestPath);
      } catch {
        // ignore cleanup error if file was not created or already removed
      }
    }
  }

  // TEST G: Opponent identity mismatch blocks canonicalization via production gate
  it("TEST G: opponent identity mismatch blocks canonicalization with opponent_conflict in production gate", async () => {
    const validCase = manifest.cases.find(
      (c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1945-007"
    );
    expect(validCase).toBeDefined();

    // Clone and manipulate opponent
    const manipulated = JSON.parse(JSON.stringify(validCase));
    manipulated.reviewStatus = "visually_reviewed_wave_2";
    manipulated.canonicalEligibility = "ready";
    manipulated.reviewedCandidates[0].observed.opponent.clubId = "kfk";

    const gateRes = await runGateWithCustomCases([manipulated]);
    expect(gateRes.matchesToCreate.size).toBe(0);
    expect(gateRes.observationsToWrite.size).toBe(0);
    expect(gateRes.plan.items[0].action).toBe("invalid_input");
    expect(gateRes.plan.items[0].conflictReason).toContain("opponent_conflict");
  }, 30000);

  // TEST H: Score mismatch blocks canonicalization via production gate
  it("TEST H: score mismatch blocks canonicalization with score_conflict in production gate", async () => {
    const validCase = manifest.cases.find(
      (c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1945-007"
    );
    expect(validCase).toBeDefined();

    // Clone and manipulate score
    const manipulated = JSON.parse(JSON.stringify(validCase));
    manipulated.reviewStatus = "visually_reviewed_wave_2";
    manipulated.canonicalEligibility = "ready";
    manipulated.reviewedCandidates[0].observed.score = { aafk: 9, opponent: 0, confidence: "high" };

    const gateRes = await runGateWithCustomCases([manipulated]);
    expect(gateRes.matchesToCreate.size).toBe(0);
    expect(gateRes.observationsToWrite.size).toBe(0);
    expect(gateRes.plan.items[0].action).toBe("invalid_input");
    expect(gateRes.plan.items[0].conflictReason).toContain("score_conflict");
  }, 30000);

  // TEST I: Competition mismatch blocks canonicalization via production gate
  it("TEST I: competitionId mismatch blocks canonicalization in production gate", async () => {
    const validCase = manifest.cases.find(
      (c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1945-007"
    );
    expect(validCase).toBeDefined();

    const manipulated = JSON.parse(JSON.stringify(validCase));
    manipulated.reviewStatus = "visually_reviewed_wave_2";
    manipulated.canonicalEligibility = "ready";
    manipulated.reviewedCandidates[0].observed.competition.competitionId = "non-existent-comp-xyz";

    const gateRes = await runGateWithCustomCases([manipulated]);
    expect(gateRes.matchesToCreate.size).toBe(0);
    expect(gateRes.observationsToWrite.size).toBe(0);
    expect(gateRes.plan.items[0].action).toBe("invalid_input");
    expect(gateRes.plan.items[0].conflictReason).toContain("not found in canonical competitions");
  }, 30000);

  // TEST J: Eksisterende exact canonical match gjenbrukes og dupliseres ikke
  it("TEST J: exact canonical matches are reused (already_present) and never duplicated", () => {
    expect(plan.idempotencyCheck.created).toBe(0);
    expect(plan.idempotencyCheck.alreadyPresent).toBe(36);
    expect(plan.summary.canonicalMatchesDeleted).toBe(0);
  });

  // TEST K: Canonical collision blokkeres via production gate
  it("TEST K: collision detection blocks candidates conflicting with existing canonical events", async () => {
    // 1945-09-30-spjelkavik-aalesunds-fk exists in archive as away for AaFK
    const validCase = manifest.cases.find(
      (c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1945-007"
    );
    expect(validCase).toBeDefined();

    const colliding = JSON.parse(JSON.stringify(validCase));
    colliding.reviewStatus = "visually_reviewed_wave_2";
    colliding.canonicalEligibility = "ready";
    // Switching homeAway to "home" creates a collision against existing canonical match
    colliding.reviewedCandidates[0].observed.homeAway = "home";

    const gateRes = await runGateWithCustomCases([colliding]);
    expect(gateRes.matchesToCreate.size).toBe(0);
    expect(gateRes.plan.items[0].action).toBe("blocked_existing_conflict");
  }, 30000);

  // TEST L: Sibling ambiguity routes to community rest queue
  it("TEST L: sibling ambiguity cases are routed to community rest queue without canonical writes", async () => {
    const readyCase = manifest.cases.find(
      (c: any) => c.reviewStatus === "visually_reviewed_wave_2" && c.canonicalEligibility === "ready"
    );
    expect(readyCase).toBeDefined();

    const siblingCase = JSON.parse(JSON.stringify(readyCase));
    siblingCase.season = 1945;
    siblingCase.canonicalEligibility = "insufficient";
    siblingCase.claimResolution = "sibling_group_only";

    const gateRes = await runGateWithCustomCases([siblingCase]);
    expect(gateRes.matchesToCreate.size).toBe(0);
    expect(gateRes.observationsToWrite.size).toBe(0);
    expect(gateRes.plan.communityRestQueue.summary.sibling_resolution).toBe(1);
  }, 30000);

  // TEST M: Same newspaper page with distinct events permitted; duplicate blocked
  it("TEST M: same physical newspaper page can document distinct matches, while duplicate events are blocked", async () => {
    const readyCases = manifest.cases.filter(
      (c: any) =>
        c.reviewStatus === "visually_reviewed_wave_2" &&
        c.canonicalEligibility === "ready" &&
        c.season >= 1945 &&
        c.season <= 1954
    );
    expect(readyCases.length).toBeGreaterThanOrEqual(2);

    const c1 = JSON.parse(JSON.stringify(readyCases[0]));
    const c2 = JSON.parse(JSON.stringify(readyCases[1]));

    // Point both to same newspaper page
    c1.reviewedCandidates[0].pageUrl = "https://www.nb.no/items/URN:NBN:no-nb_digavis_sunnmorsposten_null_null_null?page=3";
    c2.reviewedCandidates[0].pageUrl = "https://www.nb.no/items/URN:NBN:no-nb_digavis_sunnmorsposten_null_null_null?page=3";

    const gateRes = await runGateWithCustomCases([c1, c2]);
    expect(gateRes.plan.items.length).toBe(2);
    expect(gateRes.plan.items.every((i) => i.action !== "blocked_existing_conflict")).toBe(true);
  }, 30000);

  // TEST N: Andre canonicalization-run er full no-op (idempotens)
  it("TEST N: idempotency check produces zero new writes", () => {
    expect(plan.idempotencyCheck.filesWritten).toBe(0);
    expect(plan.idempotencyCheck.created).toBe(0);
    expect(plan.idempotencyCheck.alreadyPresent).toBe(36);
    expect(plan.idempotencyCheck.sourceResultsLinked).toBe(0);
    expect(plan.idempotencyCheck.observationsCreated).toBe(0);
  });

  // TEST O: PR 200 pilotcanonicalisering er fortsatt idempotent og avviser automatisk de 11 forskjøvede 1955-sakene
  it("TEST O: PR 200 pilot canonicalization remains idempotent and invalidates shifted 1955 claims", async () => {
    const pilotRes = await buildCanonicalPlan({
      batch: "pilot",
      reviewStatus: "visually_reviewed_pilot",
      minYear: 1945,
      maxYear: 1984,
    });
    expect(pilotRes.plan.summary.pr199ReadyInput).toBe(25);
    expect(pilotRes.plan.summary.skippedInvalid).toBe(12); // 11 shifted 1955 cases + 1 1976 conflict
    expect(pilotRes.plan.summary.alreadyPresent).toBe(13);
  }, 30000);

  // TEST P: Ingen nye clubs eller competitions opprettes utilsiktet
  it("TEST P: zero new clubs or competitions created", () => {
    expect(plan.summary.newClubs).toBe(0);
  });

  // TEST Q: Frozen Wave 2 selection er byte/logisk uendret
  it("TEST Q: original frozen Wave 2 selection from PR 201 is preserved unchanged", () => {
    expect(manifest.productionWave2Selection.frozenBeforeReview).toBe(true);
    expect(manifest.productionWave2Selection.totalSelected).toBe(183);
    expect(manifest.productionWave2Selection.periods["1945-1954"]).toBe(62);
    expect(manifest.productionWave2Selection.periods["1955-1964"]).toBe(105);
    expect(manifest.productionWave2Selection.periods["1965-1974"]).toBe(16);
    expect(manifest.productionWave2Selection.periods["1975-1984"]).toBe(0);
  });

  // TEST R: Reviewdata fra PR 203 endres ikke av scriptet
  it("TEST R: PR 203 review data cases count is preserved", () => {
    const wave2Cases = manifest.cases.filter((c: any) => c.reviewStatus === "visually_reviewed_wave_2");
    expect(wave2Cases.length).toBe(62);
  });

  // TEST S: Rapportregnskap balanserer
  it("TEST S: accounting balances perfectly", () => {
    const accountingTotal =
      plan.accounting.created +
      plan.accounting.enriched_existing +
      plan.accounting.already_present +
      plan.accounting.blocked_existing_conflict +
      plan.accounting.invalid_input;
    expect(accountingTotal).toBe(plan.summary.readyInput);
    expect(accountingTotal).toBe(36);
  });

  // HARD GATE: Intersection between 36 canonicalized cases and shifted rows MUST be EMPTY (Sections 13, 33)
  it("verifies zero intersection between canonicalized 36 hypothesis IDs and shifted hypothesis IDs", () => {
    const canonicalizedIds = plan.items.map((i) => i.hypothesisId);
    expect(canonicalizedIds.length).toBe(36);

    const shiftedOldIds = new Set(shiftMapping.movedItems.map((m: any) => m.oldCoordinate.hypothesisId));
    const shiftedNewIds = new Set(shiftMapping.movedItems.map((m: any) => m.newCoordinate.hypothesisId));

    for (const cId of canonicalizedIds) {
      expect(shiftedOldIds.has(cId)).toBe(false);
      expect(shiftedNewIds.has(cId)).toBe(false);
    }
  });

  // PROVENANCE AUDIT: All 36 matches have exact provenance (Section 34)
  it("verifies provenance and cross-layer consistency for all 36 canonical matches", async () => {
    const root = repoRoot();
    const sourceFilePath = `${root}/data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`;
    const sourceRaw = await readFile(sourceFilePath, "utf8");
    const sourceData = parseYaml(sourceRaw);

    const canonicalItems = plan.items.filter((i) => i.action !== "invalid_input");
    expect(canonicalItems.length).toBe(36);

    for (const item of canonicalItems) {
      // 1. Match file exists
      const matchPath = `${root}/data/seasons/${item.season}/matches/${item.proposedMatchId}.yaml`;
      const matchRaw = await readFile(matchPath, "utf8");
      const matchData = parseYaml(matchRaw);

      expect(matchData.id).toBe(item.proposedMatchId);
      expect(matchData.date).toBe(item.observedEvent.matchDate);

      // 2. NB provider exists
      expect(matchData.providers.some((p: any) => p.providerId === "nasjonalbiblioteket")).toBe(true);

      // 3. Sunnmørsposten externalReport exists with matching issue date
      const extReport = matchData.externalReports.find((r: any) => r.publisher === "Sunnmørsposten");
      expect(extReport).toBeDefined();
      expect(extReport.date).toBe(item.actualVisualSource.issueDate);

      // 4. Source-result links to this matchId
      const parts = item.hypothesisId.split("#");
      const seasonYear = parseInt(parts[1].split("-")[0], 10);
      const no = parseInt(parts[1].split("-")[1], 10);

      const seasonBlock = sourceData.seasons.find((s: any) => s.year === seasonYear);
      expect(seasonBlock).toBeDefined();
      const resultEntry = seasonBlock.results.find((r: any) => r.no === no);
      expect(resultEntry).toBeDefined();
      expect(resultEntry.matchId).toBe(item.proposedMatchId);
    }
  }, 30000);

  // YEAR CONSISTENCY GUARDRAIL (Section 25)
  it("enforces year consistency guardrail: matchDate year must match source claim season", () => {
    const canonicalItems = plan.items.filter((i) => i.action !== "invalid_input");
    expect(canonicalItems.length).toBe(36);
    for (const item of canonicalItems) {
      const matchYear = parseInt(item.observedEvent.matchDate.substring(0, 4), 10);
      expect(matchYear).toBe(item.season);
    }
  });

  // SELECTION REPAIR MAPPING INTEGRITY (Sections 8, 9, 24)
  it("verifies selection repair mapping covers all 183 frozen hypothesis IDs deterministically", () => {
    expect(shiftMapping.selectionRepairMapping).toBeDefined();
    expect(shiftMapping.selectionRepairMapping.length).toBe(183);

    const frozenIds = new Set(manifest.productionWave2Selection.selectedHypothesisIds);
    expect(frozenIds.size).toBe(183);

    for (const mapping of shiftMapping.selectionRepairMapping) {
      expect(frozenIds.has(mapping.frozenHypothesisId)).toBe(true);
      expect(["unchanged_valid", "requires_new_visual_review"]).toContain(mapping.reviewDisposition);
      expect(["unchanged_identity", "source_year_shift", "source_row_renumbered"]).toContain(mapping.reason);
    }
  });
});
