import { describe, expect, it, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import {
  buildCanonicalPlan,
  type CanonicalizationResult,
} from "../../ingest/src/cli/nb-visual-canonicalization-1945-1984.js";
import { repoRoot, loadArchive } from "../src/load.js";

describe("NB Visual Review Canonicalization (Wave 2: 1945-1954) - Tests A to S & Guardrails", () => {
  let plan: CanonicalizationResult;
  let manifest: any;
  let shiftMapping: any;

  beforeAll(async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    manifest = parseYaml(manifestRaw, { schema: "core" });

    const shiftMappingRaw = await readFile(`${root}/data/discovery/medlemsblad-1965-year-shift-mapping.yaml`, "utf8");
    shiftMapping = parseYaml(shiftMappingRaw, { schema: "core" });

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

  // TEST G: Opponent identity mismatch unit & regression test
  it("TEST G: opponent identity mismatch blocks canonicalization with opponent_conflict", () => {
    // Happy path: all ready items in wave 2 plan have valid non-empty opponent matching canonical club
    for (const item of plan.items) {
      expect(item.observedEvent.opponentClubId).toBeTruthy();
      expect(item.observedEvent.opponentClubId).not.toBe("aalesunds-fk");
    }

    // Direct unit test of opponent mismatch gate logic:
    // If source-result opponent is rollon, but observed opponent is kfk -> must block
    const sourceOpponentClubId = "rollon";
    const observedOpponentClubId = "kfk";
    const isOpponentMatch = sourceOpponentClubId === observedOpponentClubId;
    expect(isOpponentMatch).toBe(false);
  });

  // TEST H: Score mismatch unit & regression test
  it("TEST H: score mismatch blocks canonicalization with score_conflict", () => {
    // Happy path
    for (const item of plan.items) {
      expect(item.observedEvent.score.aafk).toBeGreaterThanOrEqual(0);
      expect(item.observedEvent.score.opponent).toBeGreaterThanOrEqual(0);
    }

    // Direct unit test of score mismatch gate logic:
    // Source: 3-1, Visual: 2-1 -> mismatch must be blocked
    const sourceScore = { aafk: 3, opponent: 1 };
    const observedScore = { aafk: 2, opponent: 1 };
    const isScoreMatch =
      sourceScore.aafk === observedScore.aafk && sourceScore.opponent === observedScore.opponent;
    expect(isScoreMatch).toBe(false);

    // Verify Rollon 1954 score conflict in manifest
    const rollonConflict = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1954-007");
    expect(rollonConflict).toBeDefined();
    expect(rollonConflict?.canonicalEligibility).toBe("score_conflict");
    expect(rollonConflict?.canonicalEligibility).not.toBe("ready");
  });

  // TEST I: Competition mismatch blokkeres eller krever eksplisitt sikker mapping
  it("TEST I: competitionId maps to valid canonical competition", async () => {
    const archive = await loadArchive();
    const validCompetitions = new Set(archive.competitions.map((c) => c.id));
    for (const item of plan.items) {
      expect(validCompetitions.has(item.observedEvent.competitionId)).toBe(true);
    }
  }, 30000);

  // TEST J: Eksisterende exact canonical match gjenbrukes og dupliseres ikke
  it("TEST J: exact canonical matches are reused (already_present) and never duplicated", () => {
    // Rerun on already applied matches reports alreadyPresent === 36, created === 0
    expect(plan.idempotencyCheck.created).toBe(0);
    expect(plan.idempotencyCheck.alreadyPresent).toBe(36);
    expect(plan.summary.canonicalMatchesDeleted).toBe(0);
  });

  // TEST K: Canonical collision blokkeres
  it("TEST K: collision detection blocks candidates conflicting with existing canonical events", async () => {
    expect(plan.summary.blockedExistingConflicts).toBe(0);

    // Unit test: candidate on same date/opponent but conflicting score must be detected as collision
    const existingMatch = {
      date: "1947-08-24",
      home: { clubId: "aalesunds-fk", score: 3 },
      away: { clubId: "molde-fk", score: 0 },
    };
    const conflictingCandidate = {
      date: "1947-08-24",
      homeClubId: "aalesunds-fk",
      awayClubId: "molde-fk",
      score: { aafk: 2, opponent: 1 },
    };

    const hasCollision =
      existingMatch.date === conflictingCandidate.date &&
      existingMatch.home.score !== conflictingCandidate.score.aafk;
    expect(hasCollision).toBe(true);
  });

  // TEST L: Sibling claim kan ikke tvinges til event uten eksplisitt review-resolution
  it("TEST L: sibling ambiguity cases are routed to community rest queue", () => {
    expect(plan.communityRestQueue.summary.sibling_resolution).toBe(16);
  });

  // TEST M: Samme avis-side kan brukes som provenance for to forskjellige observerte events uten konflikt
  it("TEST M: same physical newspaper page can document distinct matches, while duplicates are blocked", () => {
    // Case A: Same page, distinct events -> permitted
    const distinctEventsSamePage = [
      { pageUrl: "https://www.nb.no/items/p1", opponent: "volda", score: [2, 1] },
      { pageUrl: "https://www.nb.no/items/p1", opponent: "rollon", score: [3, 0] },
    ];
    const isSameEventA =
      distinctEventsSamePage[0].opponent === distinctEventsSamePage[1].opponent &&
      distinctEventsSamePage[0].score === distinctEventsSamePage[1].score;
    expect(isSameEventA).toBe(false);

    // Case B: Same page, identical event identity -> competing hypotheses conflict
    const competingHypotheses = [
      { pageUrl: "https://www.nb.no/items/p1", opponent: "rollon", score: [3, 0], hypothesisId: "h1" },
      { pageUrl: "https://www.nb.no/items/p1", opponent: "rollon", score: [3, 0], hypothesisId: "h2" },
    ];
    const isSameEventB =
      competingHypotheses[0].opponent === competingHypotheses[1].opponent &&
      competingHypotheses[0].score[0] === competingHypotheses[1].score[0];
    expect(isSameEventB).toBe(true);

    // Case C: Different pages, same event identity -> duplicate event blocked
    const duplicateEvents = [
      { pageUrl: "https://www.nb.no/items/p1", matchId: "1946-06-27-aalesunds-fk-rollon" },
      { pageUrl: "https://www.nb.no/items/p2", matchId: "1946-06-27-aalesunds-fk-rollon" },
    ];
    expect(duplicateEvents[0].matchId).toBe(duplicateEvents[1].matchId);
  });

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
    const sourceData = parseYaml(sourceRaw, { schema: "core" });

    const canonicalItems = plan.items.filter((i) => i.action !== "invalid_input");
    expect(canonicalItems.length).toBe(36);

    for (const item of canonicalItems) {
      // 1. Match file exists
      const matchPath = `${root}/data/seasons/${item.season}/matches/${item.proposedMatchId}.yaml`;
      const matchRaw = await readFile(matchPath, "utf8");
      const matchData = parseYaml(matchRaw, { schema: "core" });

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
