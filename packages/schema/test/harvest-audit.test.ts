import { describe, it, expect } from "vitest";
import { auditHarvestBatch, type HarvestAuditContext } from "../src/historical/harvest-audit-engine.js";
import type { HarvestBatchManifest } from "../src/historical/harvest-manifest.js";
import type { Source } from "../src/source.js";
import type { Person } from "../src/person.js";
import type { Match } from "../src/match.js";
import type { SourceResultCollection } from "../src/source-result.js";
import type { OrganizationSnapshot } from "../src/organization.js";
import type { HistoricalObservation } from "../src/historical-observation.js";

function createMinimalContext(manifest: HarvestBatchManifest): HarvestAuditContext {
  const allSources = new Map<string, Source>([
    [
      "nff-arbok-1923",
      {
        id: "nff-arbok-1923",
        title: "NFF Årbok 1923",
        sourceType: "yearbook",
        year: 1923,
        providers: [],
      },
    ],
  ]);

  const headPeople = new Map<string, Person>([
    [
      "nils-jangaard",
      {
        id: "nils-jangaard",
        name: "Nils Jangaard",
        names: [],
        squadNumbers: [],
        coachSpells: [],
        roles: [
          {
            id: "nff-delegat-1923",
            category: "board",
            title: "Delegat til NFFs Forbundsting",
            from: "1923",
            to: "1923",
            sources: [{ sourceId: "nff-arbok-1923", page: "117", fields: ["roles"] }],
          },
        ],
        providers: [],
        sources: [{ sourceId: "nff-arbok-1923", page: "117", fields: ["roles"] }],
        conflicts: [],
      },
    ],
  ]);

  const headSourceResults = new Map<string, SourceResultCollection>([
    [
      "nff-arbok-1923",
      {
        sourceId: "nff-arbok-1923",
        scorePerspective: "aafk",
        seasons: [
          {
            year: 1923,
            page: 117,
            results: [
              {
                no: 1,
                date: "1923-08-12",
                opponent: "Rollon",
                opponentClubId: "rollon",
                score: [2, 1],
                status: "played",
                replay: false,
                extraTime: false,
                round: 1,
                matchId: null,
              },
            ],
          },
        ],
      },
    ],
  ]);

  const headMatches = new Map<string, Match>();
  const headSnapshots = new Map<string, OrganizationSnapshot>();
  const headObservations = new Map<string, HistoricalObservation>();

  return {
    manifest,
    allSources,
    allProviders: new Map(),
    allExtractions: new Map(),
    allSourceResults: headSourceResults,
    basePeople: new Map(),
    headPeople,
    baseSourceResults: new Map(),
    headSourceResults,
    baseSnapshots: new Map(),
    headSnapshots,
    baseObservations: new Map(),
    headObservations,
    baseMatches: new Map(),
    headMatches,
    exceptions: [],
  };
}

describe("Cross-Layer Harvest Audit Engine", () => {
  it("godkjenner en fullstendig og gyldig batch med status complete", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 100, reviewed: 100 },
      passes: {
        facsimile_review: { status: "complete", findings: 1 },
        explicit_results: { status: "complete", findings: 1 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-001",
          source: { sourceId: "nff-arbok-1923", page: 117 },
          type: "person_role",
          claim: { text: "Delegat" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "nils-jangaard", path: "roles/nff-delegat-1923" }],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(true);
    expect(report.issues.filter((i) => i.type === "error")).toHaveLength(0);
    expect(report.targetsSummary.roles).toBe(1);
    expect(report.targetsSummary.personTargets).toBe(1);
  });

  it("feiler dersom status er complete men person-target mangler", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 100, reviewed: 100 },
      passes: {
        facsimile_review: { status: "complete", findings: 1 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-001",
          source: { sourceId: "nff-arbok-1923", page: 117 },
          type: "person_role",
          claim: { text: "Delegat" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "ikke-eksisterende-person", path: "roles/nff-delegat-1923" }],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "target" && i.message.includes("ikke-eksisterende-person"))).toBe(true);
  });

  it("godkjenner zero-target disposisjoner (f.eks. identity_uncertain) med tomme targets", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 100, reviewed: 100 },
      passes: {
        facsimile_review: { status: "complete", findings: 1 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-002",
          source: { sourceId: "nff-arbok-1923", page: 118 },
          type: "person",
          claim: { text: "Ukjent spiller nevnt som Olsen" },
          disposition: "identity_uncertain",
          targets: [],
          status: "unresolved",
          notes: [],
        },
      ],
      unresolved: [
        {
          findingId: "f-002",
          type: "identity_uncertain",
          note: "Fornavn mangler i årboken.",
        },
      ],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(true);
    expect(report.findingsSummary.unresolved).toBe(1);
  });

  it("feiler dersom en target-required disposisjon oppgis uten targets", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 100, reviewed: 100 },
      passes: {
        facsimile_review: { status: "complete", findings: 1 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-003",
          source: { sourceId: "nff-arbok-1923", page: 118 },
          type: "person_role",
          claim: { text: "Styreverv" },
          disposition: "role_created",
          targets: [],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "target" && i.message.includes("krever minst ett target"))).toBe(true);
  });

  it("feiler dersom status er complete og et funn står igjen som ubehandlet observed", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 100, reviewed: 100 },
      passes: {
        facsimile_review: { status: "complete", findings: 1 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-004",
          source: { sourceId: "nff-arbok-1923", page: 119 },
          type: "match_result",
          claim: { text: "Kampresultat" },
          disposition: "source_result_created",
          targets: [{ entity: "source_result", id: "nff-arbok-1923" }],
          status: "observed",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "lifecycle" && i.message.includes("observed"))).toBe(true);
  });
});
