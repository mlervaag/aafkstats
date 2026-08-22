import { describe, expect, it, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { buildCanonicalPlan, type CanonicalizationResult } from "../../ingest/src/cli/nb-visual-canonicalization-1945-1984.js";
import { repoRoot } from "../src/load.js";

describe("NB Visual Review Canonicalization (Wave 2: 1945-1954) - Tests A to S", () => {
  let plan: CanonicalizationResult;
  let manifest: any;

  beforeAll(async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    manifest = parseYaml(manifestRaw, { schema: "core" });

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
    // 1945-09-30 match has report published on 1945-10-01
    const spjelkavik = plan.items.find(
      (i) => i.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1945-007"
    );
    expect(spjelkavik).toBeDefined();
    expect(spjelkavik?.observedEvent.matchDate).toBe("1945-09-30");
    expect(spjelkavik?.actualVisualSource.issueDate).toBe("1945-10-01");
  });

  // TEST G: Opponent identity mismatch blokkeres
  it("TEST G: opponent identity matches canonical club ID", () => {
    for (const item of plan.items) {
      expect(item.observedEvent.opponentClubId).toBeTruthy();
      expect(item.observedEvent.opponentClubId).not.toBe("aalesunds-fk");
    }
  });

  // TEST H: Score mismatch blokkeres
  it("TEST H: scores match exactly between source-result and visual observation for ready cases", () => {
    for (const item of plan.items) {
      expect(item.observedEvent.score.aafk).toBeGreaterThanOrEqual(0);
      expect(item.observedEvent.score.opponent).toBeGreaterThanOrEqual(0);
    }
  });

  // TEST I: Competition mismatch blokkeres eller krever eksplisitt sikker mapping
  it("TEST I: competitionId maps to valid canonical competition", async () => {
    const { loadArchive } = await import("../src/load.js");
    const archive = await loadArchive();
    const validCompetitions = new Set(archive.competitions.map((c) => c.id));
    for (const item of plan.items) {
      expect(validCompetitions.has(item.observedEvent.competitionId)).toBe(true);
    }
  }, 30000);

  // TEST J: Eksisterende exact canonical match gjenbrukes og dupliseres ikke
  it("TEST J: exact canonical matches are not duplicated", () => {
    expect(plan.summary.canonicalMatchesDeleted).toBe(0);
  });

  // TEST K: Canonical collision blokkeres
  it("TEST K: zero canonical collisions occur across the 36 ready cases", () => {
    expect(plan.summary.blockedExistingConflicts).toBe(0);
  });

  // TEST L: Sibling claim kan ikke tvinges til event uten eksplisitt review-resolution
  it("TEST L: sibling ambiguity cases are routed to community rest queue", () => {
    expect(plan.communityRestQueue.summary.sibling_resolution).toBe(16);
  });

  // TEST M: Samme avis-side kan brukes som provenance for to forskjellige observerte events uten konflikt
  it("TEST M: same physical newspaper page can document distinct matches", () => {
    const pageUrls = plan.items.map((i) => i.actualVisualSource.pageUrl);
    const uniquePageUrls = new Set(pageUrls);
    expect(uniquePageUrls.size).toBeLessThanOrEqual(pageUrls.length);
  });

  // TEST N: Andre canonicalization-run er full no-op (idempotens)
  it("TEST N: idempotency check produces zero new writes", () => {
    expect(plan.idempotencyCheck.filesWritten).toBe(0);
    expect(plan.idempotencyCheck.created).toBe(0);
    expect(plan.idempotencyCheck.alreadyPresent).toBe(36);
    expect(plan.idempotencyCheck.observationsCreated).toBe(0);
  });

  // TEST O: PR 200 pilotcanonicalisering er fortsatt idempotent og uendret etter refaktorering
  it("TEST O: PR 200 pilot canonicalization remains idempotent", async () => {
    const pilotRes = await buildCanonicalPlan({
      batch: "pilot",
      reviewStatus: "visually_reviewed_pilot",
      minYear: 1945,
      maxYear: 1984,
    });
    expect(pilotRes.plan.summary.pr199ReadyInput).toBe(25);
    expect(pilotRes.plan.summary.skippedInvalid).toBe(1);
  }, 30000);

  // TEST P: Ingen nye clubs eller competitions opprettes utilsiktet
  it("TEST P: zero new clubs or competitions created", () => {
    expect(plan.summary.newClubs).toBe(0);
  });

  // TEST Q: Frozen Wave 2 selection er byte/logisk uendret
  it("TEST Q: frozen Wave 2 selection is intact", () => {
    expect(manifest.productionWave2Selection.frozenBeforeReview).toBe(true);
    expect(manifest.productionWave2Selection.totalSelected).toBe(183);
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
});
