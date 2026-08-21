import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot, dataDir } from "../src/load.js";

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

  it("verifies that pilotSelection is strictly stratified across all 4 periods with external controls separate", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const sel = manifest.pilotSelection;
    expect(sel).toBeDefined();
    expect(sel.strategy).toBe("stratified");
    expect(sel.frozenBeforeReview).toBe(true);
    expect(sel.periods["1945-1954"]).toBe(15);
    expect(sel.periods["1955-1964"]).toBe(25);
    expect(sel.periods["1965-1974"]).toBe(11);
    expect(sel.periods["1975-1984"]).toBe(9);

    expect(sel.externalRegressionControls).toBeDefined();
    expect(sel.externalRegressionControls.length).toBeGreaterThan(0);
    for (const ctrl of sel.externalRegressionControls) {
      expect(ctrl.hypothesisId).toBeTruthy();
      expect(ctrl.disposition).toBeTruthy();
    }
  });

  it("enforces Collision Gate: no two ready claims can claim the exact same observed event", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const readyCases = manifest.cases.filter((c: any) => c.canonicalEligibility === "ready");
    expect(readyCases.length).toBeGreaterThan(0);

    const eventSet = new Set<string>();
    for (const c of readyCases) {
      const activeCand = c.reviewedCandidates[0];
      const obs = activeCand.observed;
      const key = `${c.season}|${obs.opponent.clubId}|${obs.matchDate.value}|${obs.homeAway}|${obs.competition.competitionId}`;
      expect(eventSet.has(key)).toBe(false);
      eventSet.add(key);
    }
  });

  it("verifies known ground truth consistency and checks Rollon 1954 score conflict fix", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const rollon1954 = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1954-007");
    expect(rollon1954).toBeDefined();
    expect(rollon1954.claimResolution).toBe("same_event_score_conflict");
    expect(rollon1954.canonicalEligibility).toBe("score_conflict");
    expect(rollon1954.canonicalEligibility).not.toBe("ready");

    const cand = rollon1954.reviewedCandidates[0];
    expect(cand.observed.score.aafk).toBe(5);
    expect(cand.observed.score.opponent).toBe(3);
  });

  it("enforces canonical club IDs from archive.clubs for all ready records", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const clubsDir = `${dataDir()}/clubs`;
    const clubFiles = await readdir(clubsDir);
    const canonicalClubIds = new Set(
      clubFiles
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
        .map((f) => basename(f, f.endsWith(".yaml") ? ".yaml" : ".yml")),
    );

    const readyCases = manifest.cases.filter((c: any) => c.canonicalEligibility === "ready");
    expect(readyCases.length).toBeGreaterThan(0);
    for (const c of readyCases) {
      const activeCand = c.reviewedCandidates[0];
      const clubId = activeCand.observed.opponent.clubId;
      expect(canonicalClubIds.has(clubId)).toBe(true);
    }
  });

  it("enforces explicit dateEvidence and forbids unevidenced issueDate assumption", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const readyCases = manifest.cases.filter((c: any) => c.canonicalEligibility === "ready");
    for (const c of readyCases) {
      const activeCand = c.reviewedCandidates[0];
      const obs = activeCand.observed;
      expect(obs.dateEvidence).toBeDefined();
      expect(obs.dateEvidence.textSummary.length).toBeGreaterThan(10);

      if (obs.matchDate.value === activeCand.newspaper.issueDate) {
        expect(obs.dateEvidence.type).toBe("explicit_date");
      }
    }
  });

  it("enforces Competition and Home/Away agreement for all ready records", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const readyCases = manifest.cases.filter((c: any) => c.canonicalEligibility === "ready");
    for (const c of readyCases) {
      const activeCand = c.reviewedCandidates[0];
      const obs = activeCand.observed;
      expect(obs.competitionResolution).not.toBe("conflict");
      expect(obs.homeAwayResolution).not.toBe("conflict");
    }
  });

  it("verifies second-pass audit coverage across all 4 periods and checks adjudication propagation", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const audit = manifest.secondPassAudit;
    expect(audit).toBeDefined();
    expect(audit.sampleSize).toBe(30);

    const p1Count = audit.cases.filter((s: any) => s.season >= 1945 && s.season <= 1954).length;
    const p2Count = audit.cases.filter((s: any) => s.season >= 1955 && s.season <= 1964).length;
    const p3Count = audit.cases.filter((s: any) => s.season >= 1965 && s.season <= 1974).length;
    const p4Count = audit.cases.filter((s: any) => s.season >= 1975 && s.season <= 1984).length;

    expect(p1Count).toBeGreaterThan(0);
    expect(p2Count).toBeGreaterThan(0);
    expect(p3Count).toBeGreaterThan(0);
    expect(p4Count).toBeGreaterThan(0);

    // Any disagreement must have adjudication
    for (const s of audit.cases) {
      if (!s.agreed) {
        expect(s.adjudication).toBeDefined();
        const mainCase = manifest.cases.find((c: any) => c.hypothesisId === s.hypothesisId);
        expect(mainCase.canonicalEligibility).toBe(s.adjudication.final);
      }
    }
  });
});
