import { describe, it, expect } from "vitest";
import { auditHarvestBatch } from "../src/historical/harvest-audit-engine.js";
import type { HarvestBatchManifest } from "../src/historical/harvest-manifest.js";
import type { Source } from "../src/source.js";
import type { Person } from "../src/person.js";
import type { SourceResultCollection } from "../src/source-result.js";
import type { HistoricalObservation } from "../src/historical-observation.js";

describe("Historical Harvest Golden Cases", () => {
  it("Golden Case 1 – Medlemsblad (multiple issues, fixtures, results, roles, reprints)", () => {
    const s1: Source = { id: "medlemsblad-1957-1", title: "AaFK Medlemsblad nr 1 1957", sourceType: "member_magazine", year: 1957, providers: [] };
    const s2: Source = { id: "medlemsblad-1957-2", title: "AaFK Medlemsblad nr 2 1957", sourceType: "member_magazine", year: 1957, providers: [] };

    const person1: Person = {
      id: "per-hansen",
      name: "Per Hansen",
      names: [],
      squadNumbers: [],
      coachSpells: [],
      roles: [
        {
          id: "formann-1957",
          category: "board",
          title: "Formann",
          from: "1957",
          to: "1957",
          sources: [{ sourceId: "medlemsblad-1957-1", page: "2", fields: ["roles"] }],
        },
      ],
      providers: [],
      sources: [{ sourceId: "medlemsblad-1957-1", page: "2", fields: ["roles"] }],
      conflicts: [],
    };

    const obs1: HistoricalObservation = {
      id: "1957-kramyra-oppgradering",
      title: "Ny tribune på Kråmyra",
      text: "Årsmøtet vedtok oppgradering av tribunen på Kråmyra.",
      date: "1957",
      personIds: ["per-hansen"],
      seasonYears: [1957],
      matchIds: [],
      competitionIds: [],
      sources: [{ sourceId: "medlemsblad-1957-1", page: "5", fields: ["text"] }],
    };

    const srCol: SourceResultCollection = {
      sourceId: "medlemsblad-1957-1",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1957,
          page: 8,
          results: [
            {
              no: 1,
              date: "1957-05-01",
              opponent: "Langevåg",
              opponentClubId: "langevaag-il",
              score: [3, 1],
              status: "played",
              replay: false,
              extraTime: false,
              round: null,
              matchId: null,
            },
          ],
        },
      ],
    };

    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "medlemsblad-1957",
      title: "AaFK Medlemsblad 1957",
      profile: "member_magazine",
      mode: "initial",
      status: "complete",
      scope: { years: { from: 1957, to: 1957 }, sourceIds: ["medlemsblad-1957-1", "medlemsblad-1957-2"] },
      sourceInventory: [
        { sourceId: "medlemsblad-1957-1", reviewStatus: "reviewed" },
        { sourceId: "medlemsblad-1957-2", reviewStatus: "duplicate_or_reprint", duplicateOf: "medlemsblad-1957-1" },
      ],
      coverage: { mode: "pages", expected: 48, reviewed: 48 },
      passes: {
        facsimile_review: { status: "complete", findings: 4 },
        explicit_results: { status: "complete", findings: 1 },
        fixture_reconciliation: { status: "complete", findings: 1 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 1 },
      },
      findings: [
        {
          id: "f-01",
          source: { sourceId: "medlemsblad-1957-1", page: 8 },
          type: "match_result",
          claim: { text: "AaFK - Langevåg 3-1" },
          disposition: "source_result_created",
          targets: [{ entity: "source_result", id: "medlemsblad-1957-1", path: "1957-001" }],
          status: "normalized",
          notes: [],
        },
        {
          id: "f-02",
          source: { sourceId: "medlemsblad-1957-1", page: 3 },
          type: "fixture",
          claim: { text: "Terminliste for våren 1957" },
          disposition: "fixture_only",
          targets: [],
          status: "normalized",
          notes: [],
        },
        {
          id: "f-03",
          source: { sourceId: "medlemsblad-1957-1", page: 2 },
          type: "person_role",
          claim: { text: "Per Hansen valgt til formann" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "per-hansen", path: "roles/formann-1957" }],
          status: "normalized",
          notes: [],
        },
        {
          id: "f-04",
          source: { sourceId: "medlemsblad-1957-1", page: 5 },
          type: "historical_observation",
          claim: { text: "Tribunebygning Kråmyra" },
          disposition: "observation_created",
          targets: [{ entity: "observation", id: "1957-kramyra-oppgradering" }],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const report = auditHarvestBatch({
      manifest,
      allSources: new Map([["medlemsblad-1957-1", s1], ["medlemsblad-1957-2", s2]]),
      allProviders: new Map(),
      allExtractions: new Map(),
      allSourceResults: new Map([["medlemsblad-1957-1", srCol]]),
      basePeople: new Map(),
      headPeople: new Map([["per-hansen", person1]]),
      baseSourceResults: new Map(),
      headSourceResults: new Map([["medlemsblad-1957-1", srCol]]),
      baseSnapshots: new Map(),
      headSnapshots: new Map(),
      baseObservations: new Map(),
      headObservations: new Map([["1957-kramyra-oppgradering", obs1]]),
      baseMatches: new Map(),
      headMatches: new Map(),
      exceptions: [],
    });

    expect(report.passed).toBe(true);
    expect(report.findingsSummary.normalized).toBe(4);
    expect(report.sourcesSummary.reprints).toBe(1);
  });

  it("Golden Case 2 – NFF Yearbook Re-harvest (mode: reharvest, safe enrichment, preservation)", () => {
    const yearbookSrc: Source = { id: "nff-arbok-1915", title: "NFF Årbok 1915", sourceType: "yearbook", year: 1915, providers: [] };

    // BASE tilstand
    const basePerson: Person = {
      id: "nils-jangaard",
      name: "Nils Jangaard",
      names: [],
      squadNumbers: [],
      coachSpells: [],
      roles: [
        {
          id: "nff-ting-1915",
          category: "board",
          title: "Tingdelegat",
          from: "1915",
          to: "1915",
          sources: [{ sourceId: "nff-arbok-1915", page: "40", fields: ["roles"] }],
        },
      ],
      providers: [],
      sources: [{ sourceId: "nff-arbok-1915", page: "40", fields: ["roles"] }],
      conflicts: [],
    };

    // HEAD tilstand (beriket med ny rolle)
    const headPerson: Person = {
      ...basePerson,
      roles: [
        ...basePerson.roles,
        {
          id: "nff-lovkomite-1915",
          category: "administration",
          title: "Medlem av lovkomiteen",
          from: "1915",
          to: "1915",
          sources: [{ sourceId: "nff-arbok-1915", page: "42", fields: ["roles"] }],
        },
      ],
    };

    const obs: HistoricalObservation = {
      id: "1915-forbundsting-delegasjon",
      title: "Forbundstinget 1915",
      text: "AaFK deltok med delegasjon på forbundstinget.",
      date: "1915",
      personIds: ["nils-jangaard"],
      seasonYears: [1915],
      matchIds: [],
      competitionIds: [],
      sources: [{ sourceId: "nff-arbok-1915", page: "40", fields: ["text"] }],
    };

    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "nff-1915-reharvest",
      title: "NFF Årbok 1915 Re-harvest",
      profile: "yearbook",
      mode: "reharvest",
      status: "complete",
      scope: { sourceIds: ["nff-arbok-1915"] },
      sourceInventory: [{ sourceId: "nff-arbok-1915", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 150, reviewed: 150 },
      passes: {
        facsimile_review: { status: "complete", findings: 2 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 1 },
      },
      findings: [
        {
          id: "f-1915-01",
          source: { sourceId: "nff-arbok-1915", page: 42 },
          type: "person_role",
          claim: { text: "Lovkomite" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "nils-jangaard", path: "roles/nff-lovkomite-1915" }],
          status: "normalized",
          notes: [],
        },
        {
          id: "f-1915-02",
          source: { sourceId: "nff-arbok-1915", page: 40 },
          type: "historical_observation",
          claim: { text: "Forbundsting" },
          disposition: "observation_created",
          targets: [{ entity: "observation", id: "1915-forbundsting-delegasjon" }],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      previousWork: { pullRequests: [140], notes: ["Tidligere innhøsting dekket bare kampresultater."] },
      notes: [],
    };

    const report = auditHarvestBatch({
      manifest,
      allSources: new Map([["nff-arbok-1915", yearbookSrc]]),
      allProviders: new Map(),
      allExtractions: new Map(),
      allSourceResults: new Map(),
      basePeople: new Map([["nils-jangaard", basePerson]]),
      headPeople: new Map([["nils-jangaard", headPerson]]),
      baseSourceResults: new Map(),
      headSourceResults: new Map(),
      baseSnapshots: new Map(),
      headSnapshots: new Map(),
      baseObservations: new Map(),
      headObservations: new Map([["1915-forbundsting-delegasjon", obs]]),
      baseMatches: new Map(),
      headMatches: new Map(),
      exceptions: [],
    });

    expect(report.passed).toBe(true);
    expect(report.metrics.rolesCreated).toBe(1);
    expect(report.metrics.existingPeopleEnriched).toBe(1);
    expect(report.preservation.destructiveChanges).toBe(0);
  });

  it("Golden Case 3 – SFK Annual Report (A-lag vs junior non_senior, kretsverv, tabell)", () => {
    const sfkSrc: Source = { id: "sfk-rapport-1980", title: "SFK Årsrapport 1980", sourceType: "annual_report", year: 1980, providers: [] };

    const person: Person = {
      id: "ole-olsen",
      name: "Ole Olsen",
      names: [],
      squadNumbers: [],
      coachSpells: [],
      roles: [
        {
          id: "sfk-dommerkomite-1980",
          category: "administration",
          title: "Leder av kretsens dommerkomité",
          from: "1980",
          to: "1980",
          sources: [{ sourceId: "sfk-rapport-1980", page: "15", fields: ["roles"] }],
        },
      ],
      providers: [],
      sources: [{ sourceId: "sfk-rapport-1980", page: "15", fields: ["roles"] }],
      conflicts: [],
    };

    const srCol: SourceResultCollection = {
      sourceId: "sfk-rapport-1980",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1980,
          page: 25,
          results: [
            {
              no: 1,
              date: "1980-05-04",
              opponent: "Hødd",
              opponentClubId: "hodd",
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
    };

    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "sfk-1980",
      title: "SFK Årsrapport 1980",
      profile: "annual_report",
      mode: "initial",
      status: "complete",
      scope: { years: { from: 1980, to: 1980 }, sourceIds: ["sfk-rapport-1980"] },
      sourceInventory: [{ sourceId: "sfk-rapport-1980", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 60, reviewed: 60 },
      passes: {
        facsimile_review: { status: "complete", findings: 4 },
        explicit_results: { status: "complete", findings: 1 },
        senior_level_separation: { status: "complete", findings: 1 },
        people_and_roles: { status: "complete", findings: 1 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-1980-01",
          source: { sourceId: "sfk-rapport-1980", page: 25 },
          type: "match_result",
          claim: { text: "AaFK A-lag mot Hødd 2-1" },
          disposition: "source_result_created",
          targets: [{ entity: "source_result", id: "sfk-rapport-1980", path: "1980-001" }],
          status: "normalized",
          notes: [],
        },
        {
          id: "f-1980-02",
          source: { sourceId: "sfk-rapport-1980", page: 32 },
          type: "match_result",
          claim: { text: "AaFK Junior mot Herd Junior 4-2" },
          disposition: "non_senior",
          targets: [],
          status: "normalized",
          notes: ["Junioravdeling; ikke ført i senior source-results"],
        },
        {
          id: "f-1980-03",
          source: { sourceId: "sfk-rapport-1980", page: 15 },
          type: "person_role",
          claim: { text: "Ole Olsen leder av dommerkomité" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "ole-olsen", path: "roles/sfk-dommerkomite-1980" }],
          status: "normalized",
          notes: [],
        },
        {
          id: "f-1980-04",
          source: { sourceId: "sfk-rapport-1980", page: 20 },
          type: "table",
          claim: { text: "Sluttabell 3. divisjon avd E 1980" },
          disposition: "verified_correct",
          targets: [],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const report = auditHarvestBatch({
      manifest,
      allSources: new Map([["sfk-rapport-1980", sfkSrc]]),
      allProviders: new Map(),
      allExtractions: new Map(),
      allSourceResults: new Map([["sfk-rapport-1980", srCol]]),
      basePeople: new Map(),
      headPeople: new Map([["ole-olsen", person]]),
      baseSourceResults: new Map(),
      headSourceResults: new Map([["sfk-rapport-1980", srCol]]),
      baseSnapshots: new Map(),
      headSnapshots: new Map(),
      baseObservations: new Map(),
      headObservations: new Map(),
      baseMatches: new Map(),
      headMatches: new Map(),
      exceptions: [],
    });

    expect(report.passed).toBe(true);
    expect(report.findingsSummary.byDisposition["non_senior"]).toBe(1);
    expect(report.findingsSummary.byDisposition["source_result_created"]).toBe(1);
  });

  it("Golden Case 4 – Anniversary Book (pub year 1964 ≠ fact year 1931, retrospective claims, honors)", () => {
    const bookSrc: Source = { id: "aafk-50-ar-1964", title: "Aalesunds Fotballklubb 50 år (1914–1964)", sourceType: "anniversary_book", year: 1964, providers: [] };

    const person: Person = {
      id: "einar-aae",
      name: "Einar Aae",
      names: [],
      squadNumbers: [],
      coachSpells: [],
      roles: [
        {
          id: "formann-1931",
          category: "board",
          title: "Formann",
          from: "1931",
          to: "1931",
          sources: [{ sourceId: "aafk-50-ar-1964", page: "85", fields: ["roles"] }],
        },
        {
          id: "aeresmedlem-1954",
          category: "honorary",
          title: "Æresmedlem",
          from: "1954",
          to: null,
          sources: [{ sourceId: "aafk-50-ar-1964", page: "110", fields: ["roles"] }],
        },
      ],
      providers: [],
      sources: [{ sourceId: "aafk-50-ar-1964", page: "85", fields: ["roles"] }],
      conflicts: [],
    };

    const srCol: SourceResultCollection = {
      sourceId: "aafk-50-ar-1964",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1931, // Faktum-år 1931, IKKE bokens utgivelsesår 1964!
          page: 86,
          results: [
            {
              no: 1,
              date: "1931-06-14",
              opponent: "Kristiansund FK",
              opponentClubId: "kristiansund-fk",
              score: [4, 2],
              status: "played",
              replay: false,
              extraTime: false,
              round: null,
              matchId: null,
            },
          ],
        },
      ],
    };

    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "aafk-50-ar-book",
      title: "AaFK 50 år (1914–1964)",
      profile: "anniversary_book",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["aafk-50-ar-1964"] },
      sourceInventory: [{ sourceId: "aafk-50-ar-1964", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 220, reviewed: 220 },
      passes: {
        facsimile_review: { status: "complete", findings: 3 },
        chronology_audit: { status: "complete", findings: 3 },
        explicit_results: { status: "complete", findings: 1 },
        people_and_roles: { status: "complete", findings: 2 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 1 },
        observations: { status: "complete", findings: 0 },
      },
      findings: [
        {
          id: "f-50-01",
          source: { sourceId: "aafk-50-ar-1964", page: 86 },
          type: "retrospective_claim",
          claim: { text: "AaFK slo Kristiansund FK 4-2 i 1931" },
          disposition: "source_result_created",
          targets: [{ entity: "source_result", id: "aafk-50-ar-1964", path: "1931-001" }],
          status: "normalized",
          notes: ["Tidfestet til historisk sesong 1931"],
        },
        {
          id: "f-50-02",
          source: { sourceId: "aafk-50-ar-1964", page: 85 },
          type: "person_role",
          claim: { text: "Einar Aae formann i 1931" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "einar-aae", path: "roles/formann-1931" }],
          status: "normalized",
          notes: [],
        },
        {
          id: "f-50-03",
          source: { sourceId: "aafk-50-ar-1964", page: 110 },
          type: "honor",
          claim: { text: "Einar Aae utnevnt til æresmedlem ved 40-årsjubileet 1954" },
          disposition: "honorary_role_created",
          targets: [{ entity: "person", id: "einar-aae", path: "roles/aeresmedlem-1954" }],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const report = auditHarvestBatch({
      manifest,
      allSources: new Map([["aafk-50-ar-1964", bookSrc]]),
      allProviders: new Map(),
      allExtractions: new Map(),
      allSourceResults: new Map([["aafk-50-ar-1964", srCol]]),
      basePeople: new Map(),
      headPeople: new Map([["einar-aae", person]]),
      baseSourceResults: new Map(),
      headSourceResults: new Map([["aafk-50-ar-1964", srCol]]),
      baseSnapshots: new Map(),
      headSnapshots: new Map(),
      baseObservations: new Map(),
      headObservations: new Map(),
      baseMatches: new Map(),
      headMatches: new Map(),
      exceptions: [],
    });

    expect(report.passed).toBe(true);
    expect(report.metrics.rolesCreated).toBe(2);
    expect(report.metrics.honoraryRolesCreated).toBe(1);
    expect(report.metrics.sourceResultEntriesAdded).toBe(1);
  });

  it("Golden Case 5 – Future Unknown Publication (generic_publication fallback)", () => {
    const unknownSrc: Source = { id: "turneringsprogram-1937", title: "Sunnmørsturneringen 1937", sourceType: "other", year: 1937, providers: [] };

    const obs: HistoricalObservation = {
      id: "1937-sunnmorsturneringen",
      title: "Sunnmørsturneringen 1937 arrangert",
      text: "Turneringen ble avholdt i Ålesund med fire deltakende klubber.",
      date: "1937",
      personIds: [],
      seasonYears: [1937],
      matchIds: [],
      competitionIds: [],
      sources: [{ sourceId: "turneringsprogram-1937", page: "1", fields: ["text"] }],
    };

    const manifest: HarvestBatchManifest = {
      version: 1,
      id: "turneringsprogram-1937",
      title: "Sunnmørsturneringen 1937",
      profile: "generic_publication",
      mode: "initial",
      status: "complete",
      scope: { sourceIds: ["turneringsprogram-1937"] },
      sourceInventory: [{ sourceId: "turneringsprogram-1937", reviewStatus: "reviewed" }],
      coverage: { mode: "pages", expected: 16, reviewed: 16 },
      passes: {
        facsimile_review: { status: "complete", findings: 1 },
        explicit_results: { status: "complete", findings: 0 },
        people_and_roles: { status: "complete", findings: 0 },
        organization: { status: "complete", findings: 0 },
        retrospectives_and_claims: { status: "complete", findings: 0 },
        observations: { status: "complete", findings: 1 },
      },
      findings: [
        {
          id: "f-1937-01",
          source: { sourceId: "turneringsprogram-1937", page: 1 },
          type: "historical_observation",
          claim: { text: "Sunnmørsturneringen arrangert" },
          disposition: "observation_created",
          targets: [{ entity: "observation", id: "1937-sunnmorsturneringen" }],
          status: "normalized",
          notes: [],
        },
      ],
      unresolved: [],
      notes: [],
    };

    const report = auditHarvestBatch({
      manifest,
      allSources: new Map([["turneringsprogram-1937", unknownSrc]]),
      allProviders: new Map(),
      allExtractions: new Map(),
      allSourceResults: new Map(),
      basePeople: new Map(),
      headPeople: new Map(),
      baseSourceResults: new Map(),
      headSourceResults: new Map(),
      baseSnapshots: new Map(),
      headSnapshots: new Map(),
      baseObservations: new Map(),
      headObservations: new Map([["1937-sunnmorsturneringen", obs]]),
      baseMatches: new Map(),
      headMatches: new Map(),
      exceptions: [],
    });

    expect(report.passed).toBe(true);
    expect(report.manifest.profile).toBe("generic_publication");
    expect(report.findingsSummary.normalized).toBe(1);
  });
});
