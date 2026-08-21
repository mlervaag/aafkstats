import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot, dataDir } from "../src/load.js";
import { parseCompetitionHint, parseHomeAwayHint } from "../src/source-result.js";

function getPhysicalPageKey(cand: any): string {
  const url = cand.newspaper?.pageUrl || "";
  const match = url.match(/\/items\/([a-f0-9]+)/i);
  if (match) {
    return `${match[1]}|p${cand.newspaper.page}`;
  }
  return `${cand.newspaper?.title}|${cand.newspaper?.issueDate}|p${cand.newspaper?.page}`;
}

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

  it("verifies year-aware historical division parsing logic", () => {
    expect(parseCompetitionHint("1. divisjon", 1955)).toBe("forstedivisjon");
    expect(parseCompetitionHint("1. divisjon", 1965)).toBe("eliteserien");
    expect(parseCompetitionHint("2. divisjon", 1965)).toBe("forstedivisjon");
    expect(parseCompetitionHint("3. divisjon avd. Møre", 1965)).toBe("andredivisjon");
    expect(parseCompetitionHint("3. divisjon Møre", 1977)).toBe("andredivisjon");
    expect(parseCompetitionHint("NM 1. runde", 1975)).toBe("nm");
    expect(parseCompetitionHint("ÅFK's jubileumsturnering", 1955)).toBe("treningskamp");
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

  it("enforces Event and Physical Page Collision Gates across ALL visually reviewed event claims (ready or conflict)", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const eventClaims = manifest.cases.filter((c: any) => {
      const isExact = c.claimResolution === "exact_match" || c.claimResolution === "exact_sibling" || c.claimResolution === "same_event_score_conflict";
      const cand = c.reviewedCandidates?.[0];
      return isExact && cand?.visuallyReviewed && cand.observed?.matchDate?.value && cand.observed?.opponent?.clubId;
    });
    expect(eventClaims.length).toBeGreaterThan(0);

    const eventSet = new Map<string, string>();
    const pageSet = new Map<string, string>();

    for (const c of eventClaims) {
      const activeCand = c.reviewedCandidates[0];
      const obs = activeCand.observed;

      const eventKey = `${c.season}|${obs.opponent.clubId}|${obs.matchDate.value}`;
      expect(eventSet.has(eventKey), `Duplicate event claimed by ${c.hypothesisId} and ${eventSet.get(eventKey)} on ${eventKey}`).toBe(false);
      eventSet.set(eventKey, c.hypothesisId);

      const pageKey = getPhysicalPageKey(activeCand);
      expect(pageSet.has(pageKey), `Duplicate physical page claimed by ${c.hypothesisId} and ${pageSet.get(pageKey)} on ${pageKey}`).toBe(false);
      pageSet.set(pageKey, c.hypothesisId);
    }
  });

  it("regression: Rollon 1955 #9 and #13 cannot both claim the same 1955-03-06 match on the same physical page with conflicting scores", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const rollon9 = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-009");
    const rollon13 = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-013");

    expect(rollon9).toBeDefined();
    expect(rollon13).toBeDefined();

    // #9 is the actual match from 1955-03-06 (3-1, competition conflict)
    expect(rollon9.claimResolution).toBe("exact_sibling");
    expect(rollon9.canonicalEligibility).toBe("competition_conflict");
    expect(rollon9.reviewedCandidates[0].observed.score.aafk).toBe(3);
    expect(rollon9.reviewedCandidates[0].observed.score.opponent).toBe(1);

    // #13 must not collide on the same date/page
    expect(rollon13.claimResolution).toBe("sibling_group_only");
    expect(rollon13.canonicalEligibility).toBe("insufficient");
  });

  it("regression: Herd 1965 #1 and #8 cannot both claim the 1965-05-23 newspaper page as ready", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const herd1 = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1965-001");
    const herd8 = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1965-008");

    expect(herd1).toBeDefined();
    expect(herd8).toBeDefined();

    expect(herd1.canonicalEligibility).toBe("ready");
    expect(herd1.claimResolution).toBe("exact_sibling");

    // Sibling #8 must not collide on the same physical page as ready
    expect(herd8.canonicalEligibility).not.toBe("ready");
    expect(herd8.canonicalEligibility).toBe("insufficient");
    expect(herd8.claimResolution).toBe("sibling_group_only");
  });

  it("regression: 1955 Rollon #9 source-result says 1. divisjon while observed is treningskamp -> competition conflict and never ready", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const case1955Rollon9 = manifest.cases.find((c: any) => c.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-009");
    expect(case1955Rollon9).toBeDefined();

    const medlemsbladRaw = await readFile(`${root}/data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`, "utf8");
    const medlemsblad = parseYaml(medlemsbladRaw, { schema: "core" });
    const s1955 = medlemsblad.seasons.find((s: any) => s.year === 1955);
    const r9 = s1955.results.find((r: any) => r.no === 9);
    expect(r9.note).toContain("1. divisjon");

    const compHint = parseCompetitionHint(r9.note, 1955);
    expect(compHint).toBe("forstedivisjon");

    const cand = case1955Rollon9.reviewedCandidates[0];
    expect(cand.observed.competition.competitionId).toBe("treningskamp");

    expect(cand.observed.competitionResolution).toBe("conflict");
    expect(case1955Rollon9.canonicalEligibility).toBe("competition_conflict");
    expect(case1955Rollon9.canonicalEligibility).not.toBe("ready");
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

  it("recomputes source-vs-observed consistency directly from raw source-result YAMLs and forbids ready on conflict", async () => {
    const root = repoRoot();
    const manifestRaw = await readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8");
    const manifest = parseYaml(manifestRaw, { schema: "core" });

    const srDir = `${dataDir()}/source-results`;
    const srFiles = await readdir(srDir);
    const rawSourceMap = new Map<string, any>();

    for (const f of srFiles) {
      if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
      const content = await readFile(`${srDir}/${f}`, "utf8");
      const parsed = parseYaml(content, { schema: "core" });
      if (!parsed || !parsed.sourceId || !parsed.seasons) continue;
      for (const season of parsed.seasons) {
        for (const res of season.results || []) {
          rawSourceMap.set(`${parsed.sourceId}#${season.year}-${res.no}`, res);
        }
      }
    }

    const readyCases = manifest.cases.filter((c: any) => c.canonicalEligibility === "ready");
    expect(readyCases.length).toBeGreaterThan(0);

    for (const c of readyCases) {
      const msr = c.matchedSourceResult || c.sourceResults[0];
      expect(msr).toBeDefined();

      const rawSr = rawSourceMap.get(`${msr.sourceId}#${c.season}-${msr.no}`);
      expect(rawSr).toBeDefined();

      const sourceCompHint = rawSr.competitionId ?? parseCompetitionHint(rawSr.note, c.season);
      const sourceHaHint = parseHomeAwayHint(rawSr.note, rawSr.opponent);

      const activeCand = c.reviewedCandidates[0];
      const obs = activeCand.observed;

      if (sourceCompHint) {
        expect(obs.competition.competitionId).toBe(sourceCompHint);
        expect(obs.competitionResolution).toBe("agrees");
      }

      if (sourceHaHint) {
        expect(obs.homeAway).toBe(sourceHaHint);
        expect(obs.homeAwayResolution).toBe("agrees");
      }
    }
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

    for (const s of audit.cases) {
      if (!s.agreed) {
        expect(s.adjudication).toBeDefined();
        const mainCase = manifest.cases.find((c: any) => c.hypothesisId === s.hypothesisId);
        expect(mainCase.canonicalEligibility).toBe(s.adjudication.final);
      }
    }
  });
});
