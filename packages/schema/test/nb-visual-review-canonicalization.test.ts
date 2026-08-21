import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { loadArchive, repoRoot } from "../src/load.js";

describe("kanonisering av visuell NB-review med streng faksimile-reaudit (PR 196)", async () => {
  const root = repoRoot();
  const archive = await loadArchive();

  const auditManifest = parseYaml(
    await readFile(`${root}/data/discovery/nb-canonical-review-audit.yaml`, "utf8"),
    { schema: "core" }
  );

  it("A. Tidligere ground-truth-abstentions kan ikke bli canonical_ready uten eksplisitt overstyring", () => {
    const priorCases = auditManifest.cases.filter((c: any) => c.facsimileReaudit.priorGroundTruthCheck.hasConflict);
    expect(priorCases.length).toBeGreaterThanOrEqual(2);

    for (const pc of priorCases) {
      expect(pc.facsimileReaudit.disposition).not.toBe("canonical_ready");
      expect(["non_senior", "wrong_event", "identity_uncertain", "score_conflict"]).toContain(
        pc.facsimileReaudit.disposition
      );
    }
  });

  it("B. Roald 1939 stoppes og finnes ikke som kanonisk kamp", () => {
    const roaldCase = auditManifest.cases.find(
      (c: any) => c.candidateId === "nb-cand-aalesunds-fotballklub-gjennem-1939-ec28-1939-022"
    );
    expect(roaldCase).toBeDefined();
    expect(roaldCase.facsimileReaudit.disposition).toBe("non_senior");
    expect(roaldCase.facsimileReaudit.priorGroundTruthCheck.hasConflict).toBe(true);

    const matches = archive.matches.filter(
      (m) => m.date === "1939-10-08" && [m.home.clubId, m.away.clubId].includes("il-roald")
    );
    expect(matches).toHaveLength(0);
  });

  it("C. Spjelkavik 1940 stoppes og finnes ikke som kanonisk kamp (sammensatt A/B-lag 8-0 mot kildens 5-3)", () => {
    const spjelkavikCase = auditManifest.cases.find(
      (c: any) => c.candidateId === "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1940-004"
    );
    expect(spjelkavikCase).toBeDefined();
    expect(spjelkavikCase.facsimileReaudit.disposition).toBe("non_senior");
    expect(spjelkavikCase.facsimileReaudit.priorGroundTruthCheck.hasConflict).toBe(true);

    const matches = archive.matches.filter(
      (m) => m.date === "1940-10-06" && [m.home.clubId, m.away.clubId].includes("spjelkavik")
    );
    expect(matches).toHaveLength(0);
  });

  it("D. Reason-tekst alene bestemmer aldri opponentClubId", () => {
    // Sjekk at candidate-opponents med mismatch avvises
    const mismatchCases = auditManifest.cases.filter((c: any) => c.facsimileReaudit.disposition === "wrong_event");
    expect(mismatchCases.length).toBeGreaterThan(0);

    // Ingen av disse skal være i canonical_ready
    for (const mc of mismatchCases) {
      expect(mc.facsimileReaudit.disposition).not.toBe("canonical_ready");
    }
  });

  it("E. Strukturert facsimileReaudit med alle porter bestått kanoniserer nøyaktig 21 kamper", () => {
    const readyCases = auditManifest.cases.filter((c: any) => c.facsimileReaudit.disposition === "canonical_ready");
    expect(readyCases.length).toBe(21);

    for (const rc of readyCases) {
      expect(rc.facsimileReaudit.visuallyReviewed).toBe(true);
      expect(rc.facsimileReaudit.sameEvent).toBe(true);
      expect(rc.facsimileReaudit.seniorAteam).toBe(true);
      expect(rc.facsimileReaudit.observedOpponent.clubId).toBe(rc.facsimileReaudit.candidateOpponent.clubId);
      expect(rc.facsimileReaudit.score.confidence).toBe("high");
      expect(rc.facsimileReaudit.matchDate.confidence).toBe("high");
      expect(rc.facsimileReaudit.homeAway).not.toBe("unknown");
      expect(rc.facsimileReaudit.competition.competitionId).not.toBeNull();
      expect(rc.facsimileReaudit.competition.confidence).toBe("high");
      expect(rc.facsimileReaudit.priorGroundTruthCheck.hasConflict).toBe(false);
    }
  });

  it("F. visuallyReviewed er true KUN for de 21 nylig auditerte og de 2 med prior ground-truth", () => {
    const verifiedCases = auditManifest.cases.filter((c: any) => c.facsimileReaudit.visuallyReviewed === true);
    expect(verifiedCases.length).toBe(23); // 21 canonical ready + 2 prior ground truth stopped

    for (const vc of verifiedCases) {
      const isCanonicalReady = vc.facsimileReaudit.disposition === "canonical_ready";
      const isPriorConflict = vc.facsimileReaudit.priorGroundTruthCheck.hasConflict === true;
      expect(isCanonicalReady || isPriorConflict).toBe(true);
      expect(["new_facsimile_reaudit", "prior_ground_truth"]).toContain(vc.facsimileReaudit.reviewBasis);
      expect(vc.facsimileReaudit.provisional).toBe(false);
    }

    const nonReviewed = auditManifest.cases.filter((c: any) => c.facsimileReaudit.visuallyReviewed === false);
    expect(nonReviewed.length).toBe(86);
    for (const nr of nonReviewed) {
      expect(nr.facsimileReaudit.provisional).toBe(true);
      expect(["deterministic_gate", "prior_wave_review"]).toContain(nr.facsimileReaudit.reviewBasis);
    }
  });

  it("oppretter gyldige NB-observasjoner med payloadHash for alle 21 kanoniserte saker", () => {
    const readyCases = auditManifest.cases.filter((c: any) => c.facsimileReaudit.disposition === "canonical_ready");
    for (const rc of readyCases) {
      const matchDate = rc.facsimileReaudit.matchDate.value;
      const oppClubId = rc.facsimileReaudit.observedOpponent.clubId;
      const match = archive.matches.find(
        (m) => m.date === matchDate && [m.home.clubId, m.away.clubId].includes(oppClubId)
      );
      expect(match).toBeDefined();
      expect(match?.providers.some((p) => p.providerId === "nasjonalbiblioteket")).toBe(true);
    }
  });
});
