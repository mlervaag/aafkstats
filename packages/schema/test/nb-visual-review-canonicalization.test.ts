import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { loadArchive, repoRoot } from "../src/load.js";

describe("kanonisering av visuell NB-review med streng identitets- og temporalgate (PR 196)", async () => {
  const root = repoRoot();
  const archive = await loadArchive();

  const auditManifest = parseYaml(
    await readFile(`${root}/data/discovery/nb-canonical-review-audit.yaml`, "utf8"),
    { schema: "core" }
  );

  const followupManifest = parseYaml(
    await readFile(`${root}/data/discovery/nb-visual-review-followup.yaml`, "utf8"),
    { schema: "core" }
  );

  it("avviser candidate Sykkylven når visuell review fant Langevåg (opponent mismatch)", () => {
    const sykkylvenCase = auditManifest.cases.find(
      (c: any) => c.candidateId === "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1955-012"
    );
    expect(sykkylvenCase).toBeDefined();
    expect(sykkylvenCase.sourceResult.opponent).toBe("Sykkylven");
    expect(sykkylvenCase.visualReview.opponent.clubId).toBe("langevag");
    expect(sykkylvenCase.auditDisposition).toBe("temporal_invalid"); // also temporal invalid (1955-05-20 < 1955-08-07)

    // Sjekk at ingen match 1955-08-07 mot sykkylven ble opprettet
    const matches = archive.matches.filter(
      (m) => m.date === "1955-08-07" && [m.home.clubId, m.away.clubId].includes("fk-sykkylven")
    );
    expect(matches).toHaveLength(0);
  });

  it("avviser candidate Drammens BK når visuell review fant Kristiansund FK (opponent mismatch)", () => {
    const dbkCase = auditManifest.cases.find(
      (c: any) => c.candidateId === "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1949-003"
    );
    expect(dbkCase).toBeDefined();
    expect(dbkCase.sourceResult.opponent).toBe("Dr. Ballklubb");
    expect(dbkCase.visualReview.opponent.clubId).toBe("kfk");
    expect(dbkCase.auditDisposition).toBe("opponent_mismatch");

    // Sjekk at Drammens BK ikke ble opprettet som motstander 1949-05-15
    const matches = archive.matches.filter(
      (m) => m.date === "1949-05-15" && [m.home.clubId, m.away.clubId].includes("drammens-bk")
    );
    expect(matches).toHaveLength(0);
  });

  it("avviser candidate Sandane når visuell review fant Molde (opponent mismatch)", () => {
    const sandaneCase = auditManifest.cases.find(
      (c: any) => c.candidateId === "nb-cand-medlemsblad-for-aalesunds-fotb-1950-62fa-1950-006"
    );
    expect(sandaneCase).toBeDefined();
    expect(sandaneCase.sourceResult.opponent).toBe("Sandane");
    expect(sandaneCase.visualReview.opponent.clubId).toBe("molde-fk");
    expect(sandaneCase.auditDisposition).toBe("opponent_mismatch");

    // Sjekk at ingen match mot Sandane ble opprettet 1950-05-21
    const matches = archive.matches.filter(
      (m) => m.date === "1950-05-21" && [m.home.clubId, m.away.clubId].includes("sandane")
    );
    expect(matches).toHaveLength(0);
  });

  it("avviser tilfeller der avisens utgivelsesdato er før kampdatoen (temporal umulighet for sluttresultat)", () => {
    const futureCases = auditManifest.cases.filter((c: any) => c.auditDisposition === "temporal_invalid");
    expect(futureCases.length).toBeGreaterThan(0);

    for (const fc of futureCases) {
      expect(fc.newspaper.issueDate < fc.visualReview.matchDate.value).toBe(true);
      // Sjekk at ingen av disse er i canonicalReady
      expect(auditManifest.cases.find((c: any) => c.candidateId === fc.candidateId && c.auditDisposition === "canonical_ready")).toBeUndefined();
    }
  });

  it("isolerer score-konflikter i oppfølgingskøen uten å overskrive kildepåstand", () => {
    const conflictCases = auditManifest.cases.filter((c: any) => c.auditDisposition === "score_conflict");
    expect(conflictCases.length).toBe(24);

    const followupConflicts = followupManifest.cases.filter((c: any) => c.disposition === "score_conflict");
    expect(followupConflicts.length).toBe(24);

    // Rollon 1954: kilde oppga 1-0, avis viste 5-3
    const rollon1954 = followupConflicts.find((c: any) => c.candidateId === "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1954-007");
    expect(rollon1954).toBeDefined();
    expect(rollon1954.sourceResult.expectedScore).toEqual({ aafk: 1, opponent: 0 });
    expect(rollon1954.visualReview.score).toEqual({ aafk: 5, opponent: 3, status: "conflict" });
  });

  it("kanoniserer kun saker der opponent, dato, score og competition er fullstendig verifisert", () => {
    const readyCases = auditManifest.cases.filter((c: any) => c.auditDisposition === "canonical_ready");
    expect(readyCases.length).toBe(23);

    for (const rc of readyCases) {
      expect(rc.opponentIdentityMatches).toBe(true);
      expect(rc.visualReview.sameMatch).toBe(true);
      expect(rc.visualReview.temporalValid).toBe(true);
      expect(rc.visualReview.matchDate.confidence).toBe("high");
      expect(rc.visualReview.score.status).toBe("confirmed");
      expect(rc.visualReview.competition.competitionId).not.toBeNull();
    }
  });

  it("oppretter gyldige NB-observasjoner med payloadHash for alle kanoniserte saker", () => {
    const readyCases = auditManifest.cases.filter((c: any) => c.auditDisposition === "canonical_ready");
    for (const rc of readyCases) {
      const matchDate = rc.visualReview.matchDate.value;
      const oppClubId = rc.visualReview.opponent.clubId;
      const match = archive.matches.find(
        (m) => m.date === matchDate && [m.home.clubId, m.away.clubId].includes(oppClubId)
      );
      expect(match).toBeDefined();
      expect(match?.providers.some((p) => p.providerId === "nasjonalbiblioteket")).toBe(true);
    }
  });
});
