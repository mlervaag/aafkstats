import { describe, it, expect } from "vitest";
import { auditHarvestBatch, type HarvestAuditContext } from "../src/historical/harvest-audit-engine.js";
import type { HarvestBatchManifest } from "../src/historical/harvest-manifest.js";
import type { Source } from "../src/source.js";
import type { Person } from "../src/person.js";
import type { Match } from "../src/match.js";
import type { SourceResultCollection } from "../src/source-result.js";
import type { OrganizationSnapshot } from "../src/organization.js";
import type { HistoricalObservation } from "../src/historical-observation.js";

/**
 * @param options.archiveUnchanged Når true er BASE lik HEAD, altså ingen nye
 *   opplysninger i arkivet. Brukes av tester der funnene ikke skal produsere
 *   data (f.eks. uavklart identitet).
 */
function createMinimalContext(
  manifest: HarvestBatchManifest,
  options: { archiveUnchanged?: boolean } = {},
): HarvestAuditContext {
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
    basePeople: options.archiveUnchanged ? headPeople : new Map(),
    headPeople,
    baseSourceResults: options.archiveUnchanged ? headSourceResults : new Map(),
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

/** Et gyldig complete-manifest der bare funnlisten varierer. */
function completeManifestWithFindings(findings: HarvestBatchManifest["findings"]): HarvestBatchManifest {
  return {
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
    findings,
    unresolved: [],
    notes: [],
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
        {
          id: "f-002",
          source: { sourceId: "nff-arbok-1923", page: 117 },
          type: "match_result",
          claim: { text: "AaFK - Rollon 2-1" },
          disposition: "source_result_created",
          targets: [{ entity: "source_result", id: "nff-arbok-1923" }],
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
    expect(report.unaccountedAdditions).toHaveLength(0);
    expect(report.issues.filter((i) => i.type === "error")).toHaveLength(0);
    expect(report.targetsSummary.roles).toBe(1);
    expect(report.targetsSummary.personTargets).toBe(1);
  });

  it("feiler når arkivet har fått data som ingen funn gjør rede for", () => {
    // Manifestet gjør rede for rollen, men ikke for kilderesultatet som også
    // siterer batchens kilde. Uten den omvendte kontrollen ville et manifest
    // med ett funn kunne ledsage vilkårlig mye udokumentert data.
    const manifest = completeManifestWithFindings([
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
    ]);

    const report = auditHarvestBatch(createMinimalContext(manifest));

    expect(report.passed).toBe(false);
    expect(report.unaccountedAdditions).toHaveLength(1);
    expect(report.unaccountedAdditions[0]?.entity).toBe("source_result");
    expect(
      report.issues.some((i) => i.type === "error" && i.category === "coverage"),
    ).toBe(true);
  });

  it("tilskriver ikke batchen data som siterer en helt annen kilde", () => {
    // En ferdig batch skal ikke felles av at en senere PR legger til data fra
    // et annet verk. Bare det som siterer batchens egne kilder er dens ansvar.
    const manifest = completeManifestWithFindings([
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
      {
        id: "f-002",
        source: { sourceId: "nff-arbok-1923", page: 117 },
        type: "match_result",
        claim: { text: "AaFK - Rollon 2-1" },
        disposition: "source_result_created",
        targets: [{ entity: "source_result", id: "nff-arbok-1923" }],
        status: "normalized",
        notes: [],
      },
    ]);

    const ctx = createMinimalContext(manifest);
    ctx.headObservations = new Map([
      [
        "fremmed-observasjon",
        {
          id: "fremmed-observasjon",
          title: "Fra et annet verk",
          text: "Denne opplysningen kommer fra en kilde utenfor batchen.",
          date: "1930",
          seasonYears: [],
          sources: [{ sourceId: "en-helt-annen-kilde", page: "4" }],
        } as HistoricalObservation,
      ],
    ]);

    const report = auditHarvestBatch(ctx);

    expect(report.unaccountedAdditions).toHaveLength(0);
    expect(report.passed).toBe(true);
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

    const ctx = createMinimalContext(manifest, { archiveUnchanged: true });
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

  it("feiler dersom status er complete og et funn står som reviewed (ikke-terminal)", () => {
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
          id: "f-005",
          source: { sourceId: "nff-arbok-1923", page: 119 },
          type: "person_role",
          claim: { text: "Gjennomgått person" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "nils-jangaard", path: "roles/nff-delegat-1923" }],
          status: "reviewed",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "lifecycle" && i.message.includes("reviewed"))).toBe(true);
  });

  it("feiler dersom status er complete og coverage mangler helt", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }],
      // coverage mangler helt
      passes: {
        facsimile_review: { status: "complete", findings: 0 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 0 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "coverage" && i.message.includes("krever eksplisitt coverage"))).toBe(true);
  });

  it("feiler dersom status er complete og coverage.expected er 0 ved facsimile required", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 0, reviewed: 0 },
      passes: {
        facsimile_review: { status: "complete", findings: 0 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 0 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "coverage" && i.message.includes("expected: 0"))).toBe(true);
  });

  it("feiler dersom en kilde i scope mangler i frosset sourceInventory ved complete", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923", "nff-arbok-1924"] },
      sourceInventory: [{ sourceId: "nff-arbok-1923", reviewStatus: "reviewed" }], // mangler 1924
      coverage: { mode: "pages", expected: 100, reviewed: 100 },
      passes: {
        facsimile_review: { status: "complete", findings: 0 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 0 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "inventory" && i.message.includes("nff-arbok-1924"))).toBe(true);
  });

  it("feiler dersom source-result target path ikke resolve til en reell oppføring", () => {
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
        people_and_roles: { status: "complete", findings: 0 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-006",
          source: { sourceId: "nff-arbok-1923", page: 117 },
          type: "match_result",
          claim: { text: "Ugyldig resultatsti" },
          disposition: "source_result_created",
          targets: [{ entity: "source_result", id: "nff-arbok-1923", path: "seasons/1923/results/999999" }],
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
    expect(report.issues.some((i) => i.category === "target" && i.message.includes("999999"))).toBe(true);
  });

  it("varsler dersom proveniens har samme sourceId men avvikende sidetall", () => {
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
          id: "f-007",
          source: { sourceId: "nff-arbok-1923", page: 200 }, // Side 200, mens rollen har side 117
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

    expect(report.issues.some((i) => i.category === "provenance" && i.message.includes("side-avvik"))).toBe(true);
  });

  it("feiler dersom en kilde i sourceInventory ikke tilhører scope og ikke er merket out_of_scope ved complete", () => {
    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1923",
      title: "NFF Årbok 1923",
      profile: "yearbook",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1923"] },
      sourceInventory: [
        { sourceId: "nff-arbok-1923", reviewStatus: "reviewed" },
        { sourceId: "nff-arbok-1999", reviewStatus: "reviewed" }, // Ikke i scope og ikke out_of_scope
      ],
      coverage: { mode: "pages", expected: 100, reviewed: 100 },
      passes: {
        facsimile_review: { status: "complete", findings: 0 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 0 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [],
      unresolved: [],
      notes: [],
    };

    const ctx = createMinimalContext(manifest);
    const report = auditHarvestBatch(ctx);

    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.category === "inventory" && i.message.includes("nff-arbok-1999") && i.message.includes("out_of_scope"))).toBe(true);
  });
});
